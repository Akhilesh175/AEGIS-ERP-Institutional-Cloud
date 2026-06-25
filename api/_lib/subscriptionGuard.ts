/**
 * AEGIS ERP — Subscription Guard (Server-Side)
 *
 * Shared utility for Vercel serverless API routes to validate that a school's
 * subscription is active and meets the minimum required tier before serving
 * protected data or performing gated operations.
 *
 * Security model:
 *  - Uses supabaseAdmin (service role key) — server-side only, never sent to browser
 *  - Reads subscriptions table directly; applies the same date math as
 *    checkSubscriptionStatus() in subscriptionService.ts
 *  - Supports plan tier hierarchy: 0=freemium, 1=basic, 2=pro, 3=enterprise
 *
 * Usage:
 *   const ok = await requireSubscription(schoolId, 1, res); // Basic+
 *   if (!ok) return; // response already sent
 *   // ... proceed with protected logic
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Plan tier map (mirrors subscriptionService.ts) ───────────────────────────

const PLAN_TIER: Record<string, number> = {
  freemium:   0,
  basic:      1,
  pro:        2,
  enterprise: 3,
  // Legacy aliases
  standard:   2,
  premium:    3,
};

function normalizePlan(raw: string | null | undefined): string {
  if (!raw) return 'freemium';
  const lower = raw.toLowerCase();
  if (lower === 'standard') return 'pro';
  if (lower === 'premium')  return 'enterprise';
  return lower;
}

// ─── Core status evaluator ────────────────────────────────────────────────────

/**
 * Returns true if the school's subscription is currently NOT expired/cancelled.
 * Applies real-time date math — does NOT rely on the cached `status` column
 * (which might be stale if the auto-expiry writer hasn't run yet).
 */
async function resolveSubscriptionTier(schoolId: string): Promise<{
  tier: number;
  planCode: string;
  status: 'active' | 'grace_period' | 'expired' | 'trial';
  subscriptionId: string | null;
}> {
  const todayStr = new Date().toISOString().split('T')[0];

  // Primary source: subscriptions table
  const { data: sub, error } = await supabaseAdmin
    .from('subscriptions')
    .select('id, plan_code, status, subscription_status, expiry_date, grace_end_date')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !sub) {
    // No subscription row → freemium trial
    return { tier: 0, planCode: 'freemium', status: 'trial', subscriptionId: null };
  }

  const expiryDate    = sub.expiry_date    as string | null;
  const graceEndDate  = sub.grace_end_date as string | null;

  let status: 'active' | 'grace_period' | 'expired' | 'trial';

  if (!expiryDate) {
    status = 'trial';
  } else if (todayStr > (graceEndDate || expiryDate)) {
    status = 'expired';
  } else if (todayStr > expiryDate) {
    status = 'grace_period';
  } else {
    status = 'active';
  }

  const planCode = status === 'expired'
    ? 'freemium'
    : normalizePlan(sub.plan_code || 'freemium');

  const tier = PLAN_TIER[planCode] ?? 0;

  return { tier, planCode, status, subscriptionId: sub.id };
}

// ─── Public guard function ────────────────────────────────────────────────────

/**
 * Validates that the school's subscription meets the minimum required tier.
 *
 * @param schoolId      UUID of the school to validate
 * @param requiredTier  Minimum tier: 0=freemium, 1=basic, 2=pro, 3=enterprise
 * @param res           Vercel Response object
 * @returns             `true` if subscription is sufficient (caller may proceed)
 *                      `false` if insufficient (403 response already sent — caller must return)
 *
 * @example
 *   const ok = await requireSubscription(schoolId, 1, res);
 *   if (!ok) return;
 */
export async function requireSubscription(
  schoolId: string,
  requiredTier: 0 | 1 | 2 | 3,
  res: any
): Promise<boolean> {
  if (!schoolId) {
    res.status(400).json({ error: 'schoolId is required for subscription validation' });
    return false;
  }

  try {
    const { tier, planCode, status } = await resolveSubscriptionTier(schoolId);

    if (status === 'expired') {
      res.status(403).json({
        error: 'Subscription expired',
        code:  'SUBSCRIPTION_EXPIRED',
        message: 'Your school\'s subscription has expired. Please renew to continue using this feature.',
        currentPlan: 'freemium',
        requiredTier,
      });
      return false;
    }

    if (tier < requiredTier) {
      const tierNames = ['Freemium', 'Basic', 'Pro', 'Enterprise'];
      res.status(403).json({
        error:        'Insufficient subscription tier',
        code:         'SUBSCRIPTION_TIER_INSUFFICIENT',
        message:      `This feature requires a ${tierNames[requiredTier]} or higher subscription. Current plan: ${planCode}.`,
        currentPlan:  planCode,
        currentTier:  tier,
        requiredTier,
      });
      return false;
    }

    return true;
  } catch (err: any) {
    console.error('[subscriptionGuard] Unexpected error resolving subscription:', err);
    // On error, fail open for non-destructive reads but fail closed for writes
    // We re-throw so the caller can handle it explicitly
    res.status(500).json({ error: 'Failed to validate subscription status' });
    return false;
  }
}

/**
 * Returns the current subscription info for a school without enforcing a gate.
 * Useful for conditional logic in API handlers.
 */
export async function getSubscriptionInfo(schoolId: string) {
  return resolveSubscriptionTier(schoolId);
}
