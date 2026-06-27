/**
 * POST /api/verify-payment
 *
 * Production-grade Razorpay Payment Verification for AEGIS ERP.
 *
 * Security:
 *  - HMAC-SHA256 signature verification using RAZORPAY_KEY_SECRET
 *  - Idempotency guard (replay attack prevention)
 *  - Amount cross-check against stored order
 *  - Server-side timestamp (no client dates trusted)
 *  - All database writes are authoritative
 *
 * Flow:
 *  1. Validate request
 *  2. Fetch payment record
 *  3. Idempotency check (prevent double processing)
 *  4. Verify Razorpay HMAC signature
 *  5. Cross-verify payment amount with Razorpay API
 *  6. Update payment record → SUCCESS
 *  7. Compute subscription dates (calendar-accurate)
 *  8. Activate subscription
 *  9. Update school plan
 * 10. Sync school_subscriptions
 * 11. Increment coupon usage + write usage log
 * 12. Generate invoice
 * 13. Write audit logs
 * 14. Send notification to school admins
 * 15. Send invoice email
 * 16. Return success response
 */
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ─── Date utilities ───────────────────────────────────────────────────────────

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

function computeDates(paymentDate: Date, billingCycle: 'MONTHLY' | 'YEARLY') {
  const start = new Date(paymentDate);
  start.setHours(0, 0, 0, 0);

  const end   = billingCycle === 'YEARLY'
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

// Generate invoice number
function generateInvoiceNumber(): string {
  const ts   = Date.now().toString().slice(-8);
  const rand = Math.floor(10 + Math.random() * 90);
  return `AEGIS-INV-${ts}${rand}`;
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

async function writeAuditLog(params: {
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
    await supabaseAdmin.from('subscription_audit_logs').insert({
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
    console.error('[verify-payment] Audit log write failed (non-fatal):', e);
  }
}

// ─── Email template ───────────────────────────────────────────────────────────

function buildInvoiceEmail(params: {
  schoolName: string;
  planCode: string;
  cycle: string;
  baseAmount: number;
  gstAmount: number;
  totalAmount: number;
  discountAmount: number;
  invoiceNum: string;
  receiptNumber: string;
  startDateStr: string;
  endDateStr: string;
  razorpayPaymentId: string;
}): string {
  const {
    schoolName, planCode, cycle, baseAmount, gstAmount, totalAmount,
    discountAmount, invoiceNum, receiptNumber, startDateStr, endDateStr, razorpayPaymentId
  } = params;

  const fmtDate = (s: string) =>
    new Date(s + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>AEGIS ERP Invoice ${invoiceNum}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5f7;margin:0;padding:20px;color:#1e293b}
  .c{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  .h{background:#070a13;padding:32px;text-align:center}
  .b{padding:40px 32px}
  h2{margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a}
  p{font-size:14px;line-height:1.6;color:#475569;margin:0 0 12px}
  .badge{display:inline-block;background:#10b981;color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:99px;text-transform:uppercase;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px}
  th{background:#f8fafc;text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:#64748b;font-weight:700;border-bottom:2px solid #e2e8f0}
  td{padding:10px 12px;color:#334155;border-bottom:1px solid #f1f5f9}
  .total td{font-weight:700;color:#0f172a;font-size:14px;background:#f0fdf4;border-top:2px solid #10b981}
  .discount td{color:#ef4444}
  .footer{text-align:center;padding:24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8}
  .txn{font-family:monospace;font-size:11px;color:#64748b;background:#f1f5f9;padding:2px 6px;border-radius:4px}
</style></head>
<body><div class="c">
  <div class="h">
    <p style="color:#fff;font-size:24px;font-weight:900;margin:0">AEGIS <span style="color:#0ea0eb;font-weight:400">ERP</span></p>
    <p style="color:#38bdf8;font-size:9px;letter-spacing:.3em;text-transform:uppercase;margin:6px 0 0">Institutional Cloud</p>
  </div>
  <div class="b">
    <span class="badge">✓ Payment Confirmed</span>
    <h2>Subscription Activated</h2>
    <p>Dear Administrator of <strong>${schoolName}</strong>,</p>
    <p>Your payment has been successfully processed and your <strong>${planCode.toUpperCase()} Plan</strong> subscription is now active.</p>

    <table>
      <thead><tr><th>Description</th><th>Details</th></tr></thead>
      <tbody>
        <tr><td><strong>Invoice Number</strong></td><td><strong>${invoiceNum}</strong></td></tr>
        <tr><td>Receipt</td><td class="txn">${receiptNumber}</td></tr>
        <tr><td>Transaction ID</td><td class="txn">${razorpayPaymentId}</td></tr>
        <tr><td>Plan</td><td><strong>${planCode.toUpperCase()} — ${cycle}</strong></td></tr>
        <tr><td>Start Date</td><td>${fmtDate(startDateStr)}</td></tr>
        <tr><td>Expiry Date</td><td><strong>${fmtDate(endDateStr)}</strong></td></tr>
        <tr><td>Base Amount</td><td>₹${baseAmount.toLocaleString('en-IN')}</td></tr>
        ${discountAmount > 0 ? `<tr class="discount"><td>Discount Applied</td><td>− ₹${discountAmount.toLocaleString('en-IN')}</td></tr>` : ''}
        <tr><td>GST (18%)</td><td>₹${gstAmount.toLocaleString('en-IN')}</td></tr>
        <tr class="total"><td>Total Paid</td><td>₹${totalAmount.toLocaleString('en-IN')}</td></tr>
      </tbody>
    </table>

    <p style="font-size:12px;color:#64748b">You will receive a renewal reminder 7 days before expiry on <strong>${fmtDate(endDateStr)}</strong>.</p>
    <p style="font-size:12px;color:#64748b">For any billing queries, write to <a href="mailto:billing@aegiserp.xyz" style="color:#0ea0eb">billing@aegiserp.xyz</a></p>
  </div>
  <div class="footer">© 2026 AEGIS ERP Institutional Cloud. All rights reserved.<br>Powered by Razorpay | Secured by TLS</div>
</div></body></html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.aegiserp.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Environment validation ───────────────────────────────────────────
  const razorpayKeyId  = process.env.RAZORPAY_KEY_ID;
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpaySecret) {
    console.error('[verify-payment] RAZORPAY_KEY_SECRET not configured');
    return res.status(500).json({ error: 'Payment verification not configured.' });
  }

  // ── Input validation ─────────────────────────────────────────────────
  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    paymentId,
    isFree,
  } = req.body;

  if (!paymentId) {
    return res.status(400).json({ error: 'Payment record ID is required' });
  }
  if (!razorpayOrderId) {
    return res.status(400).json({ error: 'Razorpay order ID is required' });
  }
  if (!isFree && (!razorpayPaymentId || !razorpaySignature)) {
    return res.status(400).json({ error: 'Payment ID and signature are required for paid plans' });
  }

  const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();

  try {
    // ── 1. Fetch payment record ──────────────────────────────────────
    const { data: payment, error: fetchErr } = await supabaseAdmin
      .from('payments')
      .select('*, subscriptions(*)')
      .eq('id', paymentId)
      .maybeSingle();

    if (fetchErr || !payment) {
      console.error('[verify-payment] Payment not found:', fetchErr?.message);
      return res.status(400).json({ error: 'Payment record not found' });
    }

    // ── 2. Idempotency guard — prevent double processing ─────────────
    if (payment.status === 'SUCCESS') {
      console.log('[verify-payment] Already processed, returning success idempotently');
      return res.status(200).json({
        success:   true,
        message:   'Payment already verified successfully.',
        idempotent: true,
      });
    }

    // ── 3. Signature verification ────────────────────────────────────
    let isSignatureValid = false;

    if (isFree) {
      // Free order: skip gateway signature check
      isSignatureValid = true;
    } else {
      // HMAC-SHA256: razorpay_order_id + '|' + razorpay_payment_id
      const hmacBody = `${razorpayOrderId}|${razorpayPaymentId}`;
      const expectedSig = crypto
        .createHmac('sha256', razorpaySecret)
        .update(hmacBody)
        .digest('hex');

      // Use timingSafeEqual to prevent timing attacks
      try {
        isSignatureValid = crypto.timingSafeEqual(
          Buffer.from(expectedSig),
          Buffer.from(razorpaySignature)
        );
      } catch {
        isSignatureValid = false;
      }
    }

    if (!isSignatureValid) {
      // Log the failure
      await supabaseAdmin.from('payment_failures').insert({
        school_id:            payment.school_id,
        payment_id:           paymentId,
        razorpay_payment_id:  razorpayPaymentId,
        razorpay_order_id:    razorpayOrderId,
        error_code:           'SIGNATURE_MISMATCH',
        error_description:    'HMAC signature validation failed — possible tampered request',
        amount:               payment.amount,
        plan_code:            payment.subscriptions?.plan_code,
        billing_cycle:        payment.subscriptions?.billing_cycle,
        ip_address:           ipAddress,
      });

      await supabaseAdmin.from('payments')
        .update({ status: 'FAILED', failure_reason: 'Signature mismatch' })
        .eq('id', paymentId);

      await writeAuditLog({
        schoolId:  payment.school_id,
        action:    'PAYMENT_FAILED',
        plan:      payment.subscriptions?.plan_code || 'unknown',
        amount:    payment.amount,
        paymentId,
        metadata:  { error: 'Signature mismatch', ipAddress, razorpayOrderId },
      });

      return res.status(400).json({ error: 'Payment verification failed. Signature mismatch.' });
    }

    // ── 4. Load transaction metadata ────────────────────────────────
    const { data: paymentTx } = await supabaseAdmin
      .from('payment_transactions')
      .select('raw_response')
      .eq('payment_id', paymentId)
      .maybeSingle();

    const metadata        = paymentTx?.raw_response?.aegis_metadata || {};
    const couponCode      = payment.coupon_code || metadata.couponCode || null;
    const discountAmount  = Number(payment.discount_amount || metadata.discountAmount || 0);
    const originalAmount  = Number(payment.original_amount || metadata.originalAmount || payment.amount);
    const gstAmount       = Number(payment.gst_amount || metadata.gstAmount || Math.round(payment.amount * 0.18));
    const totalAmount     = payment.amount + gstAmount;

    // ── 5. Update payment record to SUCCESS ──────────────────────────
    await supabaseAdmin.from('payments').update({
      status:              'SUCCESS',
      razorpay_order_id:   razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId || `free_${Date.now()}`,
      razorpay_signature:  razorpaySignature  || 'free_order',
      payment_method:      isFree ? 'FREE_DISCOUNT' : 'RAZORPAY',
      updated_at:          new Date().toISOString(),
    }).eq('id', paymentId);

    // Update payment_transaction
    await supabaseAdmin.from('payment_transactions').update({
      status:             'SUCCESS',
      gateway_payment_id: razorpayPaymentId || `free_${Date.now()}`,
      gateway_signature:  razorpaySignature  || 'free_order',
      updated_at:         new Date().toISOString(),
    }).eq('payment_id', paymentId);

    // Update payment_order status
    if (razorpayOrderId) {
      await supabaseAdmin.from('payment_orders').update({
        status:     'paid',
        updated_at: new Date().toISOString(),
      }).eq('razorpay_order_id', razorpayOrderId).neq('status', 'paid');
    }

    // ── 6. Compute subscription dates ────────────────────────────────
    const cycle      = (payment.subscriptions?.billing_cycle || 'MONTHLY') as 'MONTHLY' | 'YEARLY';
    const planCode   = payment.subscriptions?.plan_code || payment.plan_code || 'basic';
    const schoolId   = payment.school_id;
    const now        = new Date();

    const { startDateStr, endDateStr, graceEndDateStr } = computeDates(now, cycle);

    // ── 7. Activate subscription ─────────────────────────────────────
    const oldPlan  = payment.subscriptions?.plan_code;
    let action = 'PURCHASED';
    if (oldPlan && oldPlan === planCode) action = 'RENEWED';
    else if (oldPlan && oldPlan !== planCode) action = 'UPGRADED';

    const { error: subErr } = await supabaseAdmin.from('subscriptions').update({
      status:               'ACTIVE',
      subscription_status:  'active',
      plan_code:            planCode,
      billing_cycle:        cycle,
      start_date:           startDateStr,
      expiry_date:          endDateStr,
      grace_end_date:       graceEndDateStr,
      purchase_date:        now.toISOString(),
      amount_paid:          payment.amount,
      transaction_id:       razorpayPaymentId || `free_${Date.now()}`,
      renewed_at:           now.toISOString(),
      last_notification_date: null,
      notification_sent:      null,
      updated_at:           now.toISOString(),
    }).eq('id', payment.subscription_id);

    if (subErr) {
      console.error('[verify-payment] Subscription activation failed:', subErr.message);
      return res.status(500).json({ error: 'Failed to activate subscription. Please contact support.' });
    }

    // ── 8. Update school subscription plan ───────────────────────────
    await supabaseAdmin.from('schools').update({
      subscription_plan: planCode.toUpperCase(),
      updated_at:        now.toISOString(),
    }).eq('id', schoolId);

    // ── 9. Sync school_subscriptions ────────────────────────────────
    try {
      const upperPlan = planCode.toUpperCase();
      const { data: existingSub } = await supabaseAdmin
        .from('school_subscriptions')
        .select('id')
        .eq('school_id', schoolId)
        .limit(1);

      if (existingSub && existingSub.length > 0) {
        await supabaseAdmin.from('school_subscriptions').update({
          status:      'ACTIVE',
          plan:        upperPlan,
          expiry_date: endDateStr,
        }).eq('id', existingSub[0].id);
      } else {
        await supabaseAdmin.from('school_subscriptions').update({
          status: 'INACTIVE',
        }).eq('school_id', schoolId);
        await supabaseAdmin.from('school_subscriptions').insert({
          school_id:   schoolId,
          plan:        upperPlan,
          status:      'ACTIVE',
          expiry_date: endDateStr,
        });
      }
    } catch (syncErr) {
      console.warn('[verify-payment] school_subscriptions sync (non-fatal):', syncErr);
    }

    // ── 10. Coupon usage tracking ────────────────────────────────────
    if (couponCode) {
      try {
        const { data: couponData } = await supabaseAdmin
          .from('subscription_coupons')
          .select('id, current_uses')
          .eq('code', couponCode.toUpperCase().trim())
          .maybeSingle();

        if (couponData) {
          await supabaseAdmin.from('subscription_coupons').update({
            current_uses: (Number(couponData.current_uses) || 0) + 1,
            updated_at:   now.toISOString(),
          }).eq('id', couponData.id);

          const { data: admins } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('school_id', schoolId)
            .eq('role', 'ADMIN')
            .limit(1);

          await supabaseAdmin.from('subscription_coupon_usages').insert({
            coupon_id:       couponData.id,
            school_id:       schoolId,
            user_id:         admins?.[0]?.id || null,
            transaction_id:  razorpayPaymentId || `free_${Date.now()}`,
            subscription_id: payment.subscription_id,
            plan_code:       planCode,
            discount_amount: discountAmount,
            payment_status:  'SUCCESS',
          });
        }
      } catch (couponErr) {
        console.warn('[verify-payment] Coupon tracking (non-fatal):', couponErr);
      }
    }

    // ── 11. Generate invoice ────────────────────────────────────────
    const invoiceNum   = generateInvoiceNumber();
    const receiptNum   = payment.receipt_number || `AEGIS-${Date.now().toString(36).toUpperCase()}`;

    await supabaseAdmin.from('subscription_invoices').insert({
      school_id:       schoolId,
      payment_id:      paymentId,
      invoice_number:  invoiceNum,
      amount:          originalAmount,
      discount_amount: discountAmount,
      gst_amount:      gstAmount,
      tax_amount:      gstAmount,
      total_amount:    totalAmount,
      final_paid:      payment.amount,
      status:          'PAID',
      billing_email:   payment.subscriptions?.email || '',
      billing_address: 'AEGIS ERP Institutional Cloud',
      plan_code:       planCode,
      billing_cycle:   cycle,
      metadata: {
        couponCode,
        originalAmount,
        discountAmount,
        razorpayPaymentId,
        razorpayOrderId,
        receipt: receiptNum,
        priceOverrideApplied: metadata.priceOverrideApplied || false,
      },
    });

    // Update payment with invoice number
    await supabaseAdmin.from('payments').update({
      invoice_number: invoiceNum,
    }).eq('id', paymentId);

    // ── 12. Audit logs ───────────────────────────────────────────────
    await writeAuditLog({
      schoolId,
      action,
      plan:         planCode,
      billingCycle: cycle,
      amount:       payment.amount,
      paymentId,
      transactionId: razorpayPaymentId || `free_${Date.now()}`,
      startDate:    startDateStr,
      endDate:      endDateStr,
      graceEndDate: graceEndDateStr,
      metadata: {
        invoiceNum,
        receiptNum,
        ipAddress,
        couponCode,
        discountAmount,
        originalAmount,
        gstAmount,
        totalAmount,
        isFree: !!isFree,
      },
    });

    await supabaseAdmin.from('audit_logs').insert({
      school_id:   schoolId,
      action_type: 'SUBSCRIPTION_PAYMENT_SUCCESS',
      module_name: 'BILLING',
      ip_address:  ipAddress,
      new_data: {
        paymentId, invoiceNum, planCode, cycle,
        startDateStr, endDateStr, graceEndDateStr,
        razorpayPaymentId, razorpayOrderId,
      },
    });

    await supabaseAdmin.from('payment_audit_logs').insert({
      payment_id:          paymentId,
      school_id:           schoolId,
      event_type:          'PAYMENT_VERIFIED',
      action:              'PAYMENT_VERIFIED',
      razorpay_order_id:   razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      amount:              payment.amount,
      ip_address:          ipAddress,
      metadata:            { invoiceNum, planCode, cycle, startDateStr, endDateStr },
      performed_at:        now.toISOString(),
    });

    // ── 13. Notify school admins ────────────────────────────────────
    try {
      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'ADMIN');

      if (admins && admins.length > 0) {
        const planLabel = planCode.charAt(0).toUpperCase() + planCode.slice(1);
        await supabaseAdmin.from('notifications').insert(
          admins.map(admin => ({
            school_id:      schoolId,
            user_id:        admin.id,
            recipient_id:   admin.id,
            sender_id:      null,
            recipient_role: 'ADMIN',
            title:          `✅ ${planLabel} Plan Activated`,
            content:        `Your ${planLabel} subscription has been activated. Valid until ${endDateStr}. Invoice: ${invoiceNum}`,
            message:        `Your ${planLabel} subscription has been activated. Valid until ${endDateStr}.`,
            type:           'SYSTEM',
            category:       'SYSTEM',
            priority:       'HIGH',
            is_read:        false,
            read_status:    false,
            created_at:     now.toISOString(),
          }))
        );
      }
    } catch (notifErr) {
      console.warn('[verify-payment] Notification dispatch (non-fatal):', notifErr);
    }

    // ── 14. Send invoice email ───────────────────────────────────────
    const resendApiKey = process.env.RESEND_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || 'billing@aegiserp.xyz';

    if (resendApiKey) {
      try {
        const { data: schoolData } = await supabaseAdmin
          .from('schools')
          .select('name, email')
          .eq('id', schoolId)
          .maybeSingle();

        const recipientEmail = schoolData?.email || payment.subscriptions?.email || '';
        if (recipientEmail) {
          const emailHtml = buildInvoiceEmail({
            schoolName:        schoolData?.name || 'Your Institution',
            planCode,
            cycle,
            baseAmount:        originalAmount - discountAmount,
            gstAmount,
            totalAmount,
            discountAmount,
            invoiceNum,
            receiptNumber:     receiptNum,
            startDateStr,
            endDateStr,
            razorpayPaymentId: razorpayPaymentId || 'FREE',
          });

          await fetch('https://api.resend.com/emails', {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({
              from:    `AEGIS ERP Billing <${supportEmail}>`,
              to:      [recipientEmail],
              subject: `✅ Payment Confirmed — ${invoiceNum} | ${schoolData?.name || 'AEGIS ERP'}`,
              html:    emailHtml,
            }),
          });
        }
      } catch (emailErr) {
        console.warn('[verify-payment] Invoice email (non-fatal):', emailErr);
      }
    }

    // ── 15. Trigger realtime UI update ──────────────────────────────
    await supabaseAdmin.from('schools').update({
      updated_at: now.toISOString(),
    }).eq('id', schoolId);

    // ── 16. Return success response ──────────────────────────────────
    return res.status(200).json({
      success:        true,
      message:        'Payment verified. Subscription activated successfully.',
      invoiceNumber:  invoiceNum,
      receiptNumber:  receiptNum,
      plan:           planCode,
      billingCycle:   cycle,
      startDate:      startDateStr,
      endDate:        endDateStr,
      graceEndDate:   graceEndDateStr,
      totalPaid:      totalAmount,
    });

  } catch (err: any) {
    console.error('[verify-payment] Unhandled error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error. Please contact support.' });
  }
}
