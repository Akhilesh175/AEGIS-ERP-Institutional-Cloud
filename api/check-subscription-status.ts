import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getDaysRemaining(endDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr + 'T00:00:00');
  const diff = end.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * POST /api/check-subscription-status
 * Body: { schoolId: string }
 *
 * Returns the current real-time subscription status, auto-updating DB
 * if status has changed (e.g. active→grace_period or grace_period→expired).
 *
 * Used on app load, route change, and by useSubscriptionLifecycle hook.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { schoolId } = req.body;
  if (!schoolId) {
    return res.status(400).json({ error: 'schoolId is required' });
  }

  try {
    const todayStr = toDateStr(new Date());

    // ── 1. Fetch latest subscription ─────────────────────────────────
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !sub) {
      // No subscription — return freemium
      return res.status(200).json({
        plan:               'freemium',
        subscriptionStatus: 'trial',
        billingCycle:       null,
        daysRemaining:      0,
        endDate:            null,
        graceEndDate:       null,
        startDate:          null,
        amount:             0,
      });
    }

    // ── 2. Evaluate real-time status ─────────────────────────────────
    const endDate      = sub.expiry_date    as string | null;
    const graceEndDate = sub.grace_end_date as string | null;
    const currentDbStatus = sub.subscription_status as string;

    let computedStatus: string;

    if (!endDate) {
      computedStatus = 'trial';
    } else if (todayStr > (graceEndDate || endDate)) {
      computedStatus = 'expired';
    } else if (todayStr > endDate) {
      computedStatus = 'grace_period';
    } else if (sub.status === 'ACTIVE') {
      computedStatus = 'active';
    } else {
      computedStatus = currentDbStatus || 'trial';
    }

    // ── 3. Auto-update DB if status has drifted ──────────────────────
    if (computedStatus !== currentDbStatus && sub.status === 'ACTIVE') {
      const updates: Record<string, any> = { subscription_status: computedStatus };

      if (computedStatus === 'expired') {
        updates.status = 'EXPIRED';

        // Lock down school plan to 'freemium' on expiry
        await supabaseAdmin
          .from('schools')
          .update({ subscription_plan: 'FREEMIUM' })
          .eq('id', schoolId);

        // Deactivate in school_subscriptions
        await supabaseAdmin
          .from('school_subscriptions')
          .update({ status: 'EXPIRED' })
          .eq('school_id', schoolId)
          .eq('status', 'ACTIVE');

        // Write audit log
        await supabaseAdmin.from('subscription_audit_logs').insert({
          school_id: schoolId,
          action:    computedStatus === 'grace_period' ? 'GRACE_PERIOD' : 'EXPIRED',
          plan:      sub.plan_code || 'unknown',
          billing_cycle: sub.billing_cycle,
          metadata:  { auto_detected: true, as_of: todayStr },
        });
      } else if (computedStatus === 'grace_period') {
        // Write audit for grace period entry
        await supabaseAdmin.from('subscription_audit_logs').insert({
          school_id: schoolId,
          action:    'GRACE_PERIOD',
          plan:      sub.plan_code || 'unknown',
          billing_cycle: sub.billing_cycle,
          grace_end_date: graceEndDate,
          metadata:  { auto_detected: true, as_of: todayStr },
        });
      }

      await supabaseAdmin
        .from('subscriptions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', sub.id);
    }

    // ── 4. Compute plan (normalize) ──────────────────────────────────
    const NORMALIZE: Record<string, string> = { standard: 'pro', premium: 'enterprise' };
    const rawPlan = (sub.plan_code || 'freemium').toLowerCase();
    const plan    = computedStatus === 'expired' ? 'freemium' : (NORMALIZE[rawPlan] || rawPlan);

    const daysRemaining = endDate ? getDaysRemaining(endDate) : 0;

    return res.status(200).json({
      plan,
      subscriptionStatus: computedStatus,
      billingCycle:       sub.billing_cycle || null,
      daysRemaining,
      endDate:            endDate || null,
      graceEndDate:       graceEndDate || null,
      startDate:          sub.start_date || null,
      amount:             sub.amount_paid || null,
      transactionId:      sub.transaction_id || null,
    });
  } catch (err: any) {
    console.error('Unhandled check-subscription-status error:', err);
    // Non-fatal — return freemium on unexpected errors
    return res.status(200).json({
      plan:               'freemium',
      subscriptionStatus: 'trial',
      billingCycle:       null,
      daysRemaining:      0,
      endDate:            null,
      graceEndDate:       null,
      startDate:          null,
      amount:             null,
    });
  }
}
