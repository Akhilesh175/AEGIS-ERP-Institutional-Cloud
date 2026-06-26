/**
 * POST /api/cancel-payment
 *
 * Called by the frontend when the user dismisses the Razorpay checkout modal
 * (ondismiss, ESC, back button, browser close) WITHOUT completing payment.
 *
 * CRITICAL PRODUCTION RULES:
 *  1. NEVER touch the school's ACTIVE or TRIAL subscription row.
 *  2. Only modify the PENDING checkout row (subscription_status → 'cancelled').
 *  3. DB CONSTRAINT: subscriptions.status only allows PENDING|ACTIVE|TRIAL|EXPIRED
 *                    subscriptions.subscription_status only allows trial|active|expired|cancelled|grace_period
 *     Therefore:
 *       - Cancelled checkout row stays status='PENDING' (not 'CANCELLED' — invalid)
 *       - subscription_status is set to 'cancelled' (valid)
 *     This keeps the cancelled row invisible to all queries that
 *     filter .not('status', 'in', '("PENDING")').
 *
 * Flow:
 *  1. Validate paymentId
 *  2. Guard: if payment is already SUCCESS → return 200 (idempotent)
 *  3. Mark payment_orders.status = 'cancelled' (payment_orders has no strict enum)
 *  4. Mark payments.status = 'FAILED', failure_reason = 'Payment cancelled by user'
 *  5. Mark subscriptions: subscription_status = 'cancelled' (keep status='PENDING')
 *  6. Insert PAYMENT_CANCELLED into subscription_audit_logs
 *  7. Return 200
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL             || '',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: any, res: any) {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  'https://www.aegiserp.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { paymentId, orderId } = req.body;

  if (!paymentId) {
    return res.status(400).json({ error: 'paymentId is required' });
  }

  try {
    // ── 1. Fetch the payment record ─────────────────────────────────────────
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from('payments')
      .select('id, school_id, status, subscription_id')
      .eq('id', paymentId)
      .maybeSingle();

    if (fetchErr || !payment) {
      // Non-fatal: payment may not exist if the checkout errored before the DB write
      console.warn('[cancel-payment] Payment record not found for id:', paymentId);
      return res.status(200).json({ success: true, message: 'No payment record to cancel.' });
    }

    // ── 2. Idempotency guard ─────────────────────────────────────────────────
    // If the payment was already verified (SUCCESS), do NOT touch anything.
    // This can happen in the rare case where payment completes AND ondismiss fires.
    if (payment.status === 'SUCCESS') {
      console.log('[cancel-payment] Payment already verified — skipping cancel:', paymentId);
      return res.status(200).json({
        success:    true,
        message:    'Payment already verified — no cancellation applied.',
        idempotent: true,
      });
    }

    const schoolId       = payment.school_id;
    const subscriptionId = payment.subscription_id;
    const now            = new Date().toISOString();

    // ── 3. Cancel the payment_order row (payment_orders uses string status) ──
    if (orderId) {
      await supabaseAdmin
        .from('payment_orders')
        .update({ status: 'cancelled', updated_at: now })
        .eq('razorpay_order_id', orderId)
        .neq('status', 'paid');   // Guard: never cancel an already-paid order
    }

    // ── 4. Mark the payment record as FAILED ─────────────────────────────────
    await supabaseAdmin
      .from('payments')
      .update({
        status:         'FAILED',
        failure_reason: 'Payment cancelled by user',
        updated_at:     now,
      })
      .eq('id', paymentId)
      .neq('status', 'SUCCESS');  // Guard: never overwrite a SUCCESS

    // ── 5. Mark the linked PENDING subscription as cancelled ─────────────────
    // CRITICAL DB CONSTRAINT RULES:
    //   subscriptions.status allowed values:   PENDING | ACTIVE | TRIAL | EXPIRED
    //   subscriptions.subscription_status:     trial | active | expired | cancelled | grace_period
    //
    // We do NOT change status from 'PENDING' (since 'CANCELLED' is not allowed).
    // Instead we set subscription_status = 'cancelled' to mark it as abandoned.
    // The row stays PENDING + cancelled, so all queries filtering .not('status','in','("PENDING")')
    // will continue to correctly exclude it — the school's ACTIVE row remains authoritative.
    if (subscriptionId) {
      await supabaseAdmin
        .from('subscriptions')
        .update({
          subscription_status: 'cancelled',  // Valid DB value ✅
          updated_at:          now,
          // status stays 'PENDING' — 'CANCELLED' is NOT a valid status value
        })
        .eq('id', subscriptionId)
        .eq('status', 'PENDING');   // Guard: only touch PENDING rows, never ACTIVE/TRIAL/EXPIRED
    }

    // ── 6. Write audit log ───────────────────────────────────────────────────
    try {
      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id:  schoolId,
        action:     'PAYMENT_CANCELLED',
        plan:       null,
        payment_id: paymentId,
        metadata: {
          reason:          'User dismissed Razorpay checkout modal',
          razorpayOrderId: orderId || null,
          cancelledAt:     now,
        },
      });
    } catch (auditErr) {
      console.error('[cancel-payment] Audit log write failed (non-fatal):', auditErr);
    }

    console.log(`[cancel-payment] Checkout cancelled — payment ${paymentId}, school ${schoolId}`);

    return res.status(200).json({
      success: true,
      message: 'Checkout cancelled. Active subscription unchanged.',
    });

  } catch (err: any) {
    console.error('[cancel-payment] Unhandled error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
