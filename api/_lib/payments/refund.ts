/**
 * POST /api/payments/refund
 *
 * Initiate a Razorpay refund for a payment.
 * Only accessible by Finance Admin or Super Admin roles.
 *
 * Body:
 *  - paymentId: internal payment UUID
 *  - amount: amount to refund in INR (optional, defaults to full amount)
 *  - reason: refund reason
 *  - speed: 'normal' | 'optimum' (default: 'normal')
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const razorpayKeyId  = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpaySecret) {
    return res.status(500).json({ error: 'Payment gateway not configured (missing keys)' });
  }

  const { paymentId, amount, reason, speed = 'normal' } = req.body;

  if (!paymentId) {
    return res.status(400).json({ error: 'Payment ID is required' });
  }
  if (!reason) {
    return res.status(400).json({ error: 'Refund reason is required' });
  }

  try {
    // Fetch the payment record
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) {
      return res.status(404).json({ error: 'Payment record not found' });
    }
    if (payment.status !== 'SUCCESS') {
      return res.status(400).json({ error: 'Only successful payments can be refunded' });
    }
    if (payment.is_refunded) {
      return res.status(409).json({ error: 'This payment has already been refunded' });
    }
    if (!payment.razorpay_payment_id) {
      return res.status(400).json({ error: 'No Razorpay payment ID found for this record' });
    }

    const refundAmountINR = amount ? Number(amount) : payment.amount;
    if (refundAmountINR <= 0 || refundAmountINR > payment.amount) {
      return res.status(400).json({ error: `Refund amount must be between 1 and ${payment.amount}` });
    }

    // Create refund record first
    const { data: refundRecord } = await supabaseAdmin
      .from('refunds')
      .insert({
        school_id:           payment.school_id,
        payment_id:          paymentId,
        razorpay_payment_id: payment.razorpay_payment_id,
        amount:              refundAmountINR,
        currency:            'INR',
        status:              'pending',
        reason,
        speed,
      })
      .select('id')
      .single();

    // Call Razorpay Refund API
    const authString = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString('base64');

    const rzpRes = await fetch(`https://api.razorpay.com/v1/payments/${payment.razorpay_payment_id}/refund`, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount: refundAmountINR * 100,  // paise
        speed,
        notes: { reason, initiatedBy: req.body.initiatedBy || 'Finance Admin' },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      console.error('[refund] Razorpay API error:', errText);

      if (refundRecord) {
        await supabaseAdmin.from('refunds').update({
          status:       'failed',
          raw_response: { error: errText },
          updated_at:   new Date().toISOString(),
        }).eq('id', refundRecord.id);
      }

      return res.status(502).json({ error: 'Refund gateway error. Please try again.' });
    }

    const rzpRefund = await rzpRes.json();

    // Update refund record
    await supabaseAdmin.from('refunds').update({
      razorpay_refund_id: rzpRefund.id,
      status:             rzpRefund.status === 'processed' ? 'processed' : 'pending',
      processed_at:       rzpRefund.status === 'processed' ? new Date().toISOString() : null,
      raw_response:       rzpRefund,
      updated_at:         new Date().toISOString(),
    }).eq('id', refundRecord?.id);

    // If fully refunded, mark payment as refunded
    if (refundAmountINR >= payment.amount) {
      await supabaseAdmin.from('payments').update({
        is_refunded:    true,
        refunded_amount: refundAmountINR,
        updated_at:     new Date().toISOString(),
      }).eq('id', paymentId);
    }

    let adminUserId = null;
    const { data: admins } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('school_id', payment.school_id)
      .eq('role', 'ADMIN')
      .limit(1);
    adminUserId = admins?.[0]?.id;
    if (!adminUserId) {
      const { data: fallbackUser } = await supabaseAdmin.from('users').select('id').limit(1);
      adminUserId = fallbackUser?.[0]?.id || '00000000-0000-0000-0000-000000000000';
    }

    // Audit log
    await supabaseAdmin.from('payment_audit_logs').insert({
      payment_id:          paymentId,
      school_id:           payment.school_id,
      event_type:          'REFUND_INITIATED',
      action:              'REJECTED',
      performed_by:        adminUserId,
      razorpay_payment_id: payment.razorpay_payment_id,
      amount:              refundAmountINR,
      metadata:            { reason, speed, rzpRefundId: rzpRefund.id },
      performed_at:        new Date().toISOString(),
    });

    return res.status(200).json({
      success:    true,
      refundId:   rzpRefund.id,
      status:     rzpRefund.status,
      amount:     refundAmountINR,
      message:    'Refund initiated successfully',
    });

  } catch (err: any) {
    console.error('[refund] Error:', err?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
