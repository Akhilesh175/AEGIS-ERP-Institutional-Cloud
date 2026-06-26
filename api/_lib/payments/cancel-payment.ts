/**
 * POST /api/cancel-payment
 *
 * Called by the frontend when the user dismisses the Razorpay checkout modal
 * (modal.ondismiss, ESC key, back button, etc.) WITHOUT completing payment.
 *
 * CRITICAL PRODUCTION RULE:
 *  This handler MUST NEVER touch the school's ACTIVE or TRIAL subscription row.
 *  It only marks the PENDING checkout session records as CANCELLED so they don't
 *  remain as noise in the DB. The school's active subscription is left completely
 *  unchanged.
 *
 * Flow:
 *  1. Validate inputs (paymentId, orderId)
 *  2. Guard: if payment is already SUCCESS → return 200 (idempotent, do nothing)
 *  3. Mark payment_orders.status = 'CANCELLED'
 *  4. Mark payments.status = 'FAILED', failure_reason = 'Payment cancelled by user'
 *  5. Mark subscriptions.status = 'CANCELLED' for the PENDING row linked to this payment
 *  6. Insert PAYMENT_CANCELLED into subscription_audit_logs
 *  7. Return 200
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL        || '',
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
      // Non-fatal: payment may not exist yet if checkout errored before DB write
      console.warn('[cancel-payment] Payment record not found for id:', paymentId);
      return res.status(200).json({ success: true, message: 'No payment record to cancel.' });
    }

    // ── 2. Idempotency guard ────────────────────────────────────────────────
    // If the payment was already verified (SUCCESS), do NOT touch anything.
    // This can happen if the user completes payment and then the dismiss fires too.
    if (payment.status === 'SUCCESS') {
      console.log('[cancel-payment] Payment already verified — skipping cancel:', paymentId);
      return res.status(200).json({
        success:   true,
        message:   'Payment already verified — no cancellation applied.',
        idempotent: true,
      });
    }

    const schoolId       = payment.school_id;
    const subscriptionId = payment.subscription_id;
    const now            = new Date().toISOString();

    // ── 3. Cancel the payment_order row ────────────────────────────────────
    if (orderId) {
      await supabaseAdmin
        .from('payment_orders')
        .update({ status: 'CANCELLED', updated_at: now })
        .eq('razorpay_order_id', orderId)
        .neq('status', 'paid');   // Guard: never cancel an already-paid order
    }

    // ── 4. Mark the payment record as FAILED ────────────────────────────────
    await supabaseAdmin
      .from('payments')
      .update({
        status:         'FAILED',
        failure_reason: 'Payment cancelled by user',
        updated_at:     now,
      })
      .eq('id', paymentId)
      .neq('status', 'SUCCESS');   // Guard: never overwrite a SUCCESS

    // ── 5. Mark the linked PENDING subscription as CANCELLED ────────────────
    // CRITICAL: We only cancel the PENDING row linked to THIS payment.
    //           We NEVER touch ACTIVE or TRIAL rows — those remain the source of truth.
    if (subscriptionId) {
      await supabaseAdmin
        .from('subscriptions')
        .update({
          status:              'CANCELLED',
          subscription_status: 'cancelled',
          updated_at:          now,
        })
        .eq('id', subscriptionId)
        .eq('status', 'PENDING');   // Guard: only cancel if still PENDING
    }

    // ── 6. Write audit log ──────────────────────────────────────────────────
    try {
      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id:  schoolId,
        action:     'PAYMENT_CANCELLED',
        plan:       null,
        payment_id: paymentId,
        metadata: {
          reason:        'User dismissed Razorpay checkout modal',
          razorpayOrderId: orderId || null,
          cancelledAt:   now,
        },
      });
    } catch (auditErr) {
      console.error('[cancel-payment] Audit log write failed (non-fatal):', auditErr);
    }

    console.log(`[cancel-payment] Checkout cancelled for payment ${paymentId}, school ${schoolId}`);

    return res.status(200).json({
      success: true,
      message: 'Checkout cancelled. Active subscription unchanged.',
    });

  } catch (err: any) {
    console.error('[cancel-payment] Unhandled error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
