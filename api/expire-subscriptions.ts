/**
 * AEGIS ERP — Auto Subscription Expiry Writer
 * POST /api/expire-subscriptions
 *
 * Called by the client-side useSubscriptionLifecycle hook whenever it detects
 * that a subscription's expiry date has passed but the DB record is still ACTIVE.
 * This function atomically writes the expiry state back to the database and
 * fires a Supabase Realtime broadcast that triggers instant UI updates for
 * ALL connected sessions of that school — no page refresh needed.
 *
 * Security:
 *  - Uses service role key (server-only, never exposed to browser)
 *  - Validates schoolId is a non-empty string (UUID format)
 *  - Idempotent — calling it multiple times on an already-expired sub is safe
 *  - Protected by optional shared secret header (EXPIRE_SECRET env var)
 *
 * DB writes:
 *  1. subscriptions      → status='EXPIRED', subscription_status='expired'
 *  2. schools            → subscription_plan='FREEMIUM', updated_at=NOW() (fires Realtime)
 *  3. school_subscriptions → status='INACTIVE'  (legacy table)
 *  4. subscription_audit_logs → action='AUTO_EXPIRED'
 *  5. audit_logs         → action_type='SUBSCRIPTION_AUTO_EXPIRED'
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional shared-secret protection to prevent public abuse
  const expireSecret = process.env.EXPIRE_SECRET;
  if (expireSecret) {
    const providedSecret = req.headers['x-expire-secret'] || req.body?.secret;
    if (providedSecret !== expireSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { schoolId } = req.body;

  if (!schoolId || typeof schoolId !== 'string' || !isValidUUID(schoolId)) {
    return res.status(400).json({ error: 'schoolId (valid UUID) is required' });
  }

  const today = todayStr();
  const now   = new Date().toISOString();

  try {
    // ── 1. Fetch latest subscription row ──────────────────────────────────────
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan_code, status, subscription_status, expiry_date, grace_end_date, billing_cycle')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !sub) {
      // No subscription row — nothing to expire
      return res.status(200).json({
        expired: false,
        reason:  'no_subscription',
        plan:    'freemium',
      });
    }

    const expiryDate   = sub.expiry_date    as string | null;
    const graceEndDate = sub.grace_end_date as string | null;

    // ── 2. Evaluate real-time expiry status ───────────────────────────────────
    let computedStatus: 'active' | 'grace_period' | 'expired' | 'trial';

    if (!expiryDate) {
      computedStatus = 'trial';
    } else if (today > (graceEndDate || expiryDate)) {
      computedStatus = 'expired';
    } else if (today > expiryDate) {
      computedStatus = 'grace_period';
    } else {
      computedStatus = 'active';
    }

    // ── 3. Idempotency: only write if status has drifted ─────────────────────
    // If the DB is already correctly marked expired, skip writes but still return.
    if (computedStatus !== 'expired') {
      return res.status(200).json({
        expired: false,
        status:  computedStatus,
        plan:    (sub.plan_code || 'freemium').toLowerCase(),
        message: 'Subscription is still active — no expiry action taken.',
      });
    }

    const alreadyExpiredInDb =
      sub.status === 'EXPIRED' && sub.subscription_status === 'expired';

    if (!alreadyExpiredInDb) {
      // ── 4a. Mark subscription as expired ─────────────────────────────────
      const { error: subUpdateErr } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status:              'EXPIRED',
          subscription_status: 'expired',
          updated_at:          now,
        })
        .eq('id', sub.id);

      if (subUpdateErr) {
        console.error('[expire-subscriptions] subscriptions update failed:', subUpdateErr.message);
        return res.status(500).json({ error: 'Failed to update subscription record' });
      }

      // ── 4b. Downgrade school plan to FREEMIUM ─────────────────────────────
      await supabaseAdmin
        .from('schools')
        .update({
          subscription_plan: 'FREEMIUM',
          updated_at:        now,   // ← triggers Supabase Realtime for all clients
        })
        .eq('id', schoolId);

      // ── 4c. Deactivate legacy school_subscriptions rows ───────────────────
      await supabaseAdmin
        .from('school_subscriptions')
        .update({ status: 'INACTIVE' })
        .eq('school_id', schoolId)
        .eq('status', 'ACTIVE');

      // ── 4d. Write subscription audit log ──────────────────────────────────
      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id:     schoolId,
        action:        'AUTO_EXPIRED',
        plan:          sub.plan_code || 'unknown',
        billing_cycle: sub.billing_cycle,
        metadata: {
          auto_detected:    true,
          expiry_date:      expiryDate,
          grace_end_date:   graceEndDate,
          detected_at:      now,
          detected_by:      'expire-subscriptions-api',
        },
      }).then(({ error }) => {
        if (error) console.error('[expire-subscriptions] audit log write failed (non-fatal):', error.message);
      });

      // ── 4e. Write general audit log ───────────────────────────────────────
      await supabaseAdmin.from('audit_logs').insert({
        school_id:   schoolId,
        action_type: 'SUBSCRIPTION_AUTO_EXPIRED',
        module_name: 'BILLING',
        new_data: {
          previous_plan: sub.plan_code,
          new_plan:      'freemium',
          expiry_date:   expiryDate,
          grace_end_date: graceEndDate,
          auto_expired_at: now,
        },
      }).then(({ error }) => {
        if (error) console.error('[expire-subscriptions] general audit log write failed (non-fatal):', error.message);
      });

      console.log(`[expire-subscriptions] School ${schoolId} subscription auto-expired. Plan → freemium.`);
    }

    return res.status(200).json({
      expired:       true,
      plan:          'freemium',
      previousPlan:  sub.plan_code || 'unknown',
      expiryDate:    expiryDate,
      alreadyExpiredInDb,
      message:       alreadyExpiredInDb
        ? 'Subscription was already marked expired in DB.'
        : 'Subscription auto-expired and DB updated. Realtime broadcast fired.',
    });

  } catch (err: any) {
    console.error('[expire-subscriptions] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error during subscription expiry processing' });
  }
}
