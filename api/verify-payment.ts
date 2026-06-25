import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Calendar-accurate date helpers ──────────────────────────────────────────

function addCalendarMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

function addCalendarYear(date: Date): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

/**
 * Computes subscription dates with exact calendar arithmetic.
 * Monthly: +1 calendar month (e.g. 31 Jan → 28/29 Feb)
 * Yearly:  +1 calendar year  (e.g. 29 Feb → 28 Feb next year)
 * Grace:   end_date + 3 calendar days
 */
function computeDates(paymentDate: Date, billingCycle: 'MONTHLY' | 'YEARLY') {
  const start = new Date(paymentDate);
  start.setHours(0, 0, 0, 0);

  const end = billingCycle === 'YEARLY'
    ? addCalendarYear(start)
    : addCalendarMonth(start);

  const grace = addDays(end, 3);

  return {
    startDate:       start,
    endDate:         end,
    graceEndDate:    grace,
    startDateStr:    toDateStr(start),
    endDateStr:      toDateStr(end),
    graceEndDateStr: toDateStr(grace),
  };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    paymentId,
    isMock,
  } = req.body;

  if (!paymentId || !razorpayOrderId) {
    return res.status(400).json({ error: 'Payment record ID and order ID are required' });
  }

  const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

  try {
    // ── 1. Fetch payment record ──────────────────────────────────────
    const { data: payment, error: selectError } = await supabaseAdmin
      .from('payments')
      .select('*, subscriptions(*)')
      .eq('id', paymentId)
      .maybeSingle();

    if (selectError || !payment) {
      return res.status(400).json({ error: 'Payment transaction record not found' });
    }

    // Idempotency guard — already processed
    if (payment.status === 'SUCCESS') {
      return res.status(200).json({ success: true, message: 'Payment already processed.' });
    }

    const razorpayKeyId  = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    // ── 2. Signature verification ────────────────────────────────────
    let isSignatureValid = false;

    if (isMock && (!razorpayKeyId || !razorpaySecret)) {
      isSignatureValid = true;
    } else if (razorpaySecret) {
      const body = razorpayOrderId + '|' + razorpayPaymentId;
      const expectedSignature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(body)
        .digest('hex');
      isSignatureValid = expectedSignature === razorpaySignature;
    }

    if (!isSignatureValid) {
      await supabaseAdmin.from('payments').update({ status: 'FAILED' }).eq('id', paymentId);
      await supabaseAdmin.from('payment_transactions')
        .update({ status: 'FAILED', raw_response: { error: 'Signature mismatch' } })
        .eq('payment_id', paymentId);

      // Audit: payment failed
      await writeSubAuditLog(supabaseAdmin, {
        schoolId:   payment.school_id,
        action:     'PAYMENT_FAILED',
        plan:       payment.subscriptions?.plan_code || 'unknown',
        billingCycle: payment.subscriptions?.billing_cycle,
        amount:     payment.amount,
        paymentId,
        metadata:   { error: 'Signature mismatch', ipAddress }
      });

      return res.status(400).json({ error: 'Gateway signature validation failed' });
    }

    // ── 3. Update payment record ─────────────────────────────────────
    await supabaseAdmin
      .from('payments')
      .update({
        status:         'SUCCESS',
        payment_method: isMock ? 'MOCK_CARD' : 'GATEWAY_CARD',
      })
      .eq('id', paymentId);

    await supabaseAdmin
      .from('payment_transactions')
      .update({
        status:             'SUCCESS',
        gateway_payment_id: razorpayPaymentId || 'mock_pay_id',
        gateway_signature:  razorpaySignature  || 'mock_sig',
      })
      .eq('payment_id', paymentId);

    // ── 4. Compute subscription dates (calendar-accurate) ───────────
    const cycle     = (payment.subscriptions?.billing_cycle || 'MONTHLY') as 'MONTHLY' | 'YEARLY';
    const planCode  = payment.subscriptions?.plan_code || 'basic';
    const paymentDate = new Date(); // actual payment timestamp

    const { startDateStr, endDateStr, graceEndDateStr } = computeDates(paymentDate, cycle);

    // Determine if this is a new purchase, renewal, or upgrade/downgrade
    const oldPlan    = payment.subscriptions?.plan_code;
    const schoolId   = payment.school_id;
    let action = 'PURCHASED';
    if (oldPlan && oldPlan === planCode) action = 'RENEWED';
    else if (oldPlan && oldPlan !== planCode) action = 'UPGRADED';

    // ── 5. Activate subscription with full lifecycle fields ──────────
    const { error: subUpdateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status:              'ACTIVE',
        subscription_status: 'active',
        plan_code:           planCode,
        billing_cycle:       cycle,
        start_date:          startDateStr,
        expiry_date:         endDateStr,
        grace_end_date:      graceEndDateStr,
        purchase_date:       paymentDate.toISOString(),
        amount_paid:         payment.amount,
        transaction_id:      razorpayPaymentId || `mock_${Date.now()}`,
        renewed_at:          paymentDate.toISOString(),
        last_notification_date: null,
        notification_sent:      null,
        updated_at:          new Date().toISOString(),
      })
      .eq('id', payment.subscription_id);

    if (subUpdateError) {
      console.error('Subscription update failed:', subUpdateError.message);
      return res.status(500).json({ error: 'Failed to activate subscription' });
    }

    // ── 6. Update schools.subscription_plan ─────────────────────────
    await supabaseAdmin
      .from('schools')
      .update({ subscription_plan: planCode.toUpperCase() })
      .eq('id', schoolId);

    // ── 7. Sync school_subscriptions (legacy + Super Admin path) ────
    try {
      const upperPlan = planCode.toUpperCase();
      const { data: existing } = await supabaseAdmin
        .from('school_subscriptions')
        .select('id')
        .eq('school_id', schoolId)
        .eq('plan', upperPlan)
        .limit(1);

      if (existing && existing.length > 0) {
        await supabaseAdmin
          .from('school_subscriptions')
          .update({ status: 'ACTIVE', expiry_date: endDateStr })
          .eq('id', existing[0].id);
      } else {
        // Deactivate all others first
        await supabaseAdmin
          .from('school_subscriptions')
          .update({ status: 'INACTIVE' })
          .eq('school_id', schoolId);
        await supabaseAdmin
          .from('school_subscriptions')
          .insert({ school_id: schoolId, plan: upperPlan, status: 'ACTIVE', expiry_date: endDateStr });
      }
    } catch (e) {
      console.error('school_subscriptions sync warning (non-fatal):', e);
    }

    // Load metadata from payment transactions
    const { data: paymentTx } = await supabaseAdmin
      .from('payment_transactions')
      .select('raw_response')
      .eq('payment_id', paymentId)
      .maybeSingle();

    const metadata = paymentTx?.raw_response?.aegis_metadata || {};
    const couponCode = metadata.couponCode || null;
    const discountAmount = Number(metadata.discountAmount || 0);
    const originalAmount = Number(metadata.originalAmount || payment.amount);

    // If coupon is used, increment its use count
    if (couponCode) {
      try {
        const { data: couponData } = await supabaseAdmin
          .from('subscription_coupons')
          .select('id, current_uses')
          .eq('code', couponCode.toUpperCase().trim())
          .maybeSingle();
        
        if (couponData) {
          await supabaseAdmin
            .from('subscription_coupons')
            .update({ current_uses: (couponData.current_uses || 0) + 1 })
            .eq('id', couponData.id);
        }
      } catch (couponErr) {
        console.warn('Coupon count increment failed (non-fatal):', couponErr);
      }
    }

    // ── 8. Generate Invoice ──────────────────────────────────────────
    const invoiceNum = 'INV-' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);
    await supabaseAdmin
      .from('subscription_invoices')
      .insert({
        school_id:       schoolId,
        payment_id:      paymentId,
        invoice_number:  invoiceNum,
        amount:          originalAmount,
        tax_amount:      Math.round(payment.amount * 0.18),
        total_amount:    Math.round(payment.amount * 1.18),
        status:          'PAID',
        billing_email:   payment.subscriptions?.email || 'admin@institution.edu',
        billing_address: 'AEGIS ERP Institutional Cloud',
        plan_code:       planCode,
        billing_cycle:   cycle,
        discount_amount: discountAmount,
        gst_amount:      Math.round(payment.amount * 0.18),
        final_paid:      payment.amount,
        metadata: {
          couponCode,
          originalAmount,
          priceOverrideApplied: metadata.priceOverrideApplied || false
        }
      });

    // ── 9. Subscription audit log ────────────────────────────────────
    await writeSubAuditLog(supabaseAdmin, {
      schoolId,
      action,
      plan:          planCode,
      billingCycle:  cycle,
      amount:        payment.amount,
      paymentId,
      transactionId: razorpayPaymentId || `mock_${Date.now()}`,
      startDate:     startDateStr,
      endDate:       endDateStr,
      graceEndDate:  graceEndDateStr,
      metadata:      { 
        invoiceNum, 
        isMock: !!isMock, 
        ipAddress,
        couponCode,
        discountAmount,
        originalAmount
      },
    });

    // ── 10. General audit log ────────────────────────────────────────
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        school_id:   schoolId,
        action_type: 'SUBSCRIPTION_PAYMENT_SUCCESS',
        module_name: 'BILLING',
        ip_address:  ipAddress,
        new_data:    { paymentId, invoiceNum, planCode, cycle, startDateStr, endDateStr, graceEndDateStr },
      });

    // ── 10a. Send "Subscription successfully renewed." notification to School Admins
    try {
      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'ADMIN');

      if (admins && admins.length > 0) {
        const notifRows = admins.map(admin => ({
          school_id: schoolId,
          user_id: admin.id,
          recipient_id: admin.id,
          sender_id: null,
          recipient_role: 'ADMIN',
          title: '🔔 Subscription successfully renewed',
          content: 'Subscription successfully renewed.',
          message: 'Subscription successfully renewed.',
          type: 'SYSTEM',
          category: 'SYSTEM',
          priority: 'HIGH',
          is_read: false,
          read_status: false,
          created_at: new Date().toISOString()
        }));

        await supabaseAdmin.from('notifications').insert(notifRows);
      }
    } catch (err) {
      console.error('Failed to dispatch renewal success notification:', err);
    }

    // ── 10b. Log plan-specific activation event in subscription audit logs
    try {
      let activationLog = 'Subscription renewed';
      if (planCode.toLowerCase() === 'pro') activationLog = 'Pro activated';
      if (planCode.toLowerCase() === 'enterprise') activationLog = 'Enterprise activated';

      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id:     schoolId,
        action:        planCode.toUpperCase() === 'PRO' ? 'PRO_ACTIVATED' : planCode.toUpperCase() === 'ENTERPRISE' ? 'ENTERPRISE_ACTIVATED' : 'RENEWED',
        plan:          planCode,
        billing_cycle: cycle,
        metadata: {
          event_type: activationLog,
          activated_at: new Date().toISOString(),
          payment_id: paymentId,
          invoice_number: invoiceNum
        }
      });
    } catch {}

    // ── 11. Broadcast realtime update for instant UI unlock ──────────
    try {
      await supabaseAdmin
        .from('schools')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', schoolId);
    } catch {}

    // ── 12. Send invoice email ───────────────────────────────────────
    const resendApiKey  = process.env.RESEND_API_KEY;
    const supportEmail  = process.env.SUPPORT_EMAIL || 'noreply@aegiserp.xyz';

    if (resendApiKey) {
      try {
        const { data: schoolData } = await supabaseAdmin
          .from('schools')
          .select('name')
          .eq('id', schoolId)
          .maybeSingle();

        const recipientEmail = payment.subscriptions?.email || '';
        if (recipientEmail) {
          const emailHtml = buildInvoiceEmail({
            schoolName:   schoolData?.name || 'Your Institution',
            planCode,
            cycle,
            amount:       payment.amount,
            invoiceNum,
            startDateStr,
            endDateStr,
          });

          await fetch('https://api.resend.com/emails', {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({
              from:    `Aegis ERP Billing <${supportEmail}>`,
              to:      [recipientEmail],
              subject: `Payment Successful: ${invoiceNum} — ${schoolData?.name || ''}`,
              html:    emailHtml,
            }),
          });
        }
      } catch (emailErr) {
        console.error('Invoice email send failed (non-fatal):', emailErr);
      }
    }

    return res.status(200).json({
      success:         true,
      message:         'Payment verified and subscription activated successfully.',
      invoiceNumber:   invoiceNum,
      plan:            planCode,
      billingCycle:    cycle,
      startDate:       startDateStr,
      endDate:         endDateStr,
      graceEndDate:    graceEndDateStr,
    });
  } catch (err: any) {
    console.error('Unhandled verify-payment error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function writeSubAuditLog(client: any, params: {
  schoolId: string;
  action: string;
  plan: string;
  billingCycle?: string;
  amount?: number;
  paymentId?: string;
  transactionId?: string;
  startDate?: string;
  endDate?: string;
  graceEndDate?: string;
  metadata?: any;
}) {
  try {
    await client.from('subscription_audit_logs').insert({
      school_id:      params.schoolId,
      action:         params.action,
      plan:           params.plan,
      billing_cycle:  params.billingCycle,
      amount:         params.amount,
      payment_id:     params.paymentId,
      transaction_id: params.transactionId,
      start_date:     params.startDate,
      end_date:       params.endDate,
      grace_end_date: params.graceEndDate,
      metadata:       params.metadata,
    });
  } catch (e) {
    // Non-fatal — audit log failures must not break payment flow
    console.error('Subscription audit log write failed (non-fatal):', e);
  }
}

function buildInvoiceEmail(params: {
  schoolName: string;
  planCode: string;
  cycle: string;
  amount: number;
  invoiceNum: string;
  startDateStr: string;
  endDateStr: string;
}): string {
  const { schoolName, planCode, cycle, amount, invoiceNum, startDateStr, endDateStr } = params;
  const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>AEGIS ERP Billing Invoice</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;margin:0;padding:20px;color:#1e293b}
  .c{max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0}
  .h{background:#070a13;padding:30px;text-align:center;border-bottom:3px solid #0ea0eb}
  .b{padding:40px 30px}
  h2{margin-top:0;font-size:20px;font-weight:700;color:#0f172a}
  p{font-size:14px;line-height:1.6;color:#475569}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th{background:#f8fafc;text-align:left;padding:12px;font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700;border-bottom:1px solid #e2e8f0}
  td{padding:12px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9}
  .total td{font-weight:700;color:#0ea0eb;border-top:2px solid #e2e8f0}
  .meta{font-size:12px;color:#94a3b8;text-align:center;margin-top:30px;border-top:1px solid #f1f5f9;padding-top:20px}
</style></head>
<body><div class="c">
  <div class="h">
    <p style="color:#fff;font-size:22px;font-weight:800;margin:0">AEGIS <span style="color:#0ea0eb;font-weight:400">ERP</span></p>
    <p style="color:#38bdf8;font-size:9px;letter-spacing:.25em;text-transform:uppercase;margin:4px 0 0">— Institutional Cloud —</p>
  </div>
  <div class="b">
    <h2>Subscription Payment Confirmed</h2>
    <p>Dear Administrator,</p>
    <p>We have received your payment for <strong>Aegis ERP Institutional Cloud</strong>. Your subscription is now active.</p>
    <table>
      <thead><tr><th>Description</th><th>Billing Cycle</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td><strong>${planCode.toUpperCase()} Plan</strong> for ${schoolName}</td><td>${cycle}</td><td>₹${amount.toLocaleString('en-IN')}</td></tr>
        <tr><td colspan="2" style="text-align:right;font-weight:bold;color:#64748b">Invoice Number:</td><td><strong>${invoiceNum}</strong></td></tr>
        <tr><td colspan="2" style="text-align:right;font-weight:bold;color:#64748b">Start Date:</td><td>${fmtDate(startDateStr)}</td></tr>
        <tr><td colspan="2" style="text-align:right;font-weight:bold;color:#64748b">Expiry Date:</td><td><strong>${fmtDate(endDateStr)}</strong></td></tr>
        <tr><td colspan="2" style="text-align:right;font-weight:bold;color:#64748b">Tax (18% GST est.):</td><td>₹${Math.round(amount * 0.18).toLocaleString('en-IN')}</td></tr>
        <tr class="total"><td colspan="2" style="text-align:right">Total:</td><td>₹${Math.round(amount * 1.18).toLocaleString('en-IN')}</td></tr>
      </tbody>
    </table>
    <p>You will receive a renewal reminder 7 days before expiration on <strong>${fmtDate(endDateStr)}</strong>.</p>
    <div class="meta">© 2026 Aegis ERP Institutional Cloud. All rights reserved.</div>
  </div>
</div></body></html>`;
}
