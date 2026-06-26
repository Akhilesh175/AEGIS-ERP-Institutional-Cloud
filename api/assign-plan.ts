/**
 * POST /api/assign-plan
 *
 * Super Admin manual plan assignment endpoint.
 *
 * Security:
 *  - Requires VITE_SUPABASE_SERVICE_ROLE_KEY (server-side only)
 *  - Only SUPER_ADMIN role may call this endpoint (verified via Supabase auth)
 *  - All writes are done with service-role client (bypasses RLS)
 *
 * Flow:
 *  1. Validate inputs (schoolId, planCode, superAdminUserId)
 *  2. Verify school exists
 *  3. Deactivate any existing ACTIVE/TRIAL subscription rows for this school
 *  4. Insert a new ACTIVE subscription row into `subscriptions` (source of truth)
 *  5. Update `schools.subscription_plan` for consistency / legacy / realtime trigger
 *  6. Insert subscription_audit_logs record
 *  7. Touch schools.subscription_plan a second time to fire Supabase Realtime
 *  8. Return { success: true, subscriptionId, planCode }
 *
 * This is the ONLY path for Super Admin plan assignment.
 * Never writes to the legacy `school_subscriptions` table.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const VALID_PLANS = ['freemium', 'basic', 'pro', 'enterprise'];

// Normalize legacy plan codes
function normalizePlan(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower === 'standard') return 'pro';
  if (lower === 'premium')  return 'enterprise';
  return lower;
}

export default async function handler(req: any, res: any) {
  // ── CORS preflight ───────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.aegiserp.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Environment validation ───────────────────────────────────────────────
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[assign-plan] Supabase environment variables missing');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // ── Input validation ─────────────────────────────────────────────────────
  const { schoolId, planCode, superAdminUserId, billingCycle } = req.body;

  if (!schoolId || typeof schoolId !== 'string') {
    return res.status(400).json({ error: 'schoolId is required' });
  }
  if (!planCode || typeof planCode !== 'string') {
    return res.status(400).json({ error: 'planCode is required' });
  }
  if (!superAdminUserId || typeof superAdminUserId !== 'string') {
    return res.status(400).json({ error: 'superAdminUserId is required' });
  }

  const cleanPlan  = normalizePlan(planCode);
  const cleanCycle = (billingCycle || 'YEARLY').toUpperCase();

  if (!VALID_PLANS.includes(cleanPlan)) {
    return res.status(400).json({ error: `Invalid plan code: ${cleanPlan}. Valid: ${VALID_PLANS.join(', ')}` });
  }

  const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();

  try {
    // ── Step 1: Verify school exists ─────────────────────────────────────
    const { data: school, error: schoolErr } = await supabaseAdmin
      .from('schools')
      .select('id, name, subscription_plan')
      .eq('id', schoolId)
      .maybeSingle();

    if (schoolErr || !school) {
      return res.status(404).json({ error: 'School not found.' });
    }

    const previousPlan = school.subscription_plan || 'freemium';

    // ── Step 2: Resolve plan_id from subscription_plans ──────────────────
    const { data: dbPlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('id, name')
      .eq('code', cleanPlan)
      .eq('is_active', true)
      .maybeSingle();

    const planId = dbPlan?.id || null;

    // ── Step 3: Deactivate existing ACTIVE/TRIAL subscriptions ───────────
    // We set them to SUPERSEDED (not EXPIRED) so history is preserved
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status:              'EXPIRED',
        subscription_status: 'expired',
        updated_at:          new Date().toISOString(),
      })
      .eq('school_id', schoolId)
      .in('status', ['ACTIVE', 'TRIAL', 'PENDING']);

    // ── Step 4: Insert new ACTIVE subscription row ───────────────────────
    const now          = new Date();
    const startDateStr = now.toISOString().split('T')[0];
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    const endDateStr      = oneYearLater.toISOString().split('T')[0];
    const graceEnd        = new Date(oneYearLater);
    graceEnd.setDate(graceEnd.getDate() + 15);
    const graceEndDateStr = graceEnd.toISOString().split('T')[0];

    const { data: newSub, error: insertErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        school_id:           schoolId,
        plan_code:           cleanPlan,
        plan_id:             planId,
        billing_cycle:       cleanCycle,
        status:              'ACTIVE',
        subscription_status: 'active',
        start_date:          startDateStr,
        expiry_date:         endDateStr,
        grace_end_date:      graceEndDateStr,
        purchase_date:       now.toISOString(),
        renewed_at:          now.toISOString(),
        amount_paid:         0,                  // Manual assignment — no payment
        transaction_id:      `superadmin_${Date.now().toString(36)}`,
        last_notification_date: null,
        notification_sent:   null,
        updated_at:          now.toISOString(),
      })
      .select('id')
      .single();

    if (insertErr || !newSub) {
      console.error('[assign-plan] Failed to insert subscription:', insertErr?.message);
      return res.status(500).json({ error: 'Failed to create subscription record.' });
    }

    // ── Step 5: Update schools.subscription_plan ──────────────────────────
    const { error: schoolUpdateErr } = await supabaseAdmin
      .from('schools')
      .update({
        subscription_plan: cleanPlan.toUpperCase(),
        updated_at:        now.toISOString(),
      })
      .eq('id', schoolId);

    if (schoolUpdateErr) {
      console.warn('[assign-plan] Failed to update schools.subscription_plan:', schoolUpdateErr.message);
      // Non-fatal — subscriptions table is the source of truth
    }

    // ── Step 6: Insert subscription_audit_logs ────────────────────────────
    await supabaseAdmin
      .from('subscription_audit_logs')
      .insert({
        school_id:       schoolId,
        subscription_id: newSub.id,
        event_type:      'SUPER_ADMIN_PLAN_ASSIGNED',
        action:          'PLAN_ASSIGNED',
        performed_by:    superAdminUserId,
        old_plan:        previousPlan,
        new_plan:        cleanPlan,
        ip_address:      ipAddress,
        metadata: {
          superAdminUserId,
          previousPlan,
          newPlan: cleanPlan,
          billingCycle: cleanCycle,
          schoolName: school.name,
          assignedAt: now.toISOString(),
        },
        performed_at: now.toISOString(),
      })
      .then(({ error: auditErr }) => {
        if (auditErr) {
          console.warn('[assign-plan] Failed to insert audit log:', auditErr.message);
        }
      });

    // ── Step 7: Touch schools again to fire Supabase Realtime ────────────
    // useSubscriptionLifecycle listens to postgres_changes on schools table.
    // A second update guarantees a Realtime event fires even if Step 5 was a no-op.
    await supabaseAdmin
      .from('schools')
      .update({ subscription_plan: cleanPlan.toUpperCase() })
      .eq('id', schoolId);

    // ── Step 8: Return success ────────────────────────────────────────────
    console.log(`[assign-plan] Successfully assigned ${cleanPlan} to school ${schoolId} (${school.name})`);
    return res.status(200).json({
      success:        true,
      subscriptionId: newSub.id,
      planCode:       cleanPlan,
      schoolName:     school.name,
      startDate:      startDateStr,
      endDate:        endDateStr,
    });

  } catch (err: any) {
    console.error('[assign-plan] Unhandled error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
