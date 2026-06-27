import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: { [key: string]: string } = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const paymentId = "0b0177af-8d86-45f8-837d-622f68772455"; // From our pending payment check
  
  const { data: payment, error: fetchErr } = await supabaseAdmin
    .from('payments')
    .select('*, subscriptions(*)')
    .eq('id', paymentId)
    .maybeSingle();

  if (fetchErr || !payment) {
    console.error("Payment fetch failed:", fetchErr);
    return;
  }

  const cycle = (payment.subscriptions?.billing_cycle || 'MONTHLY') as 'MONTHLY' | 'YEARLY';
  const planCode = payment.subscriptions?.plan_code || payment.plan_code || 'basic';
  const schoolId = payment.school_id;
  const now = new Date();

  const startDateStr = "2026-06-26";
  const endDateStr = "2026-07-26";
  const graceEndDateStr = "2026-07-29";
  
  const couponCode = payment.coupon_code || null;
  const discountAmount = Number(payment.discount_amount || 0);
  const originalAmount = Number(payment.original_amount || payment.amount);
  const gstAmount = Number(payment.gst_amount || Math.round(payment.amount * 0.18));
  const totalAmount = payment.amount + gstAmount;
  const razorpayPaymentId = 'pay_test_' + Date.now();
  const razorpayOrderId = 'order_test_' + Date.now();
  const razorpaySignature = 'sig_test_' + Date.now();
  const ipAddress = "127.0.0.1";
  
  console.log("Checking Plan ID...");
  const { data: dbPlan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id, name')
    .eq('code', planCode.toLowerCase())
    .eq('is_active', true)
    .maybeSingle();
  const planId = dbPlan?.id || null;
  console.log("Plan ID:", planId);

  // We wrap everything in a try-catch to see exactly where it fails
  try {
    console.log("1. Updating payment status...");
    const { error: payUpdateErr } = await supabaseAdmin.from('payments').update({
      status:              'SUCCESS',
      razorpay_order_id:   razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      razorpay_signature:  razorpaySignature,
      payment_method:      'RAZORPAY',
      updated_at:          now.toISOString(),
    }).eq('id', paymentId);
    if (payUpdateErr) throw new Error("Step 1 payUpdateErr: " + payUpdateErr.message);

    console.log("2. Updating payment_transaction...");
    const { error: payTxErr } = await supabaseAdmin.from('payment_transactions').update({
      status:             'SUCCESS',
      gateway_payment_id: razorpayPaymentId,
      gateway_signature:  razorpaySignature,
      updated_at:         now.toISOString(),
    }).eq('payment_id', paymentId);
    if (payTxErr) throw new Error("Step 2 payTxErr: " + payTxErr.message);

    console.log("3. Updating payment_order...");
    const { error: orderUpdateErr } = await supabaseAdmin.from('payment_orders').update({
      status:     'paid',
      updated_at: now.toISOString(),
    }).eq('payment_id', paymentId);
    if (orderUpdateErr) throw new Error("Step 3 orderUpdateErr: " + orderUpdateErr.message);

    console.log("4. Updating subscriptions...");
    const { error: subErr } = await supabaseAdmin.from('subscriptions').update({
      status:               'ACTIVE',
      subscription_status:  'active',
      plan_code:            planCode,
      plan_id:              planId,
      billing_cycle:        cycle,
      start_date:           startDateStr,
      expiry_date:          endDateStr,
      grace_end_date:       graceEndDateStr,
      purchase_date:        now.toISOString(),
      amount_paid:          payment.amount,
      transaction_id:       razorpayPaymentId,
      renewed_at:           now.toISOString(),
      updated_at:           now.toISOString(),
    }).eq('id', payment.subscription_id);
    if (subErr) throw new Error("Step 4 subErr: " + subErr.message);

    console.log("5. Updating schools subscription_plan...");
    const { error: schoolUpdateErr } = await supabaseAdmin.from('schools').update({
      subscription_plan: planCode.toUpperCase(),
    }).eq('id', schoolId);
    if (schoolUpdateErr) throw new Error("Step 5 schoolUpdateErr: " + schoolUpdateErr.message);

    /*
    console.log("6. Syncing school_subscriptions...");
    const upperPlan = planCode.toUpperCase();
    const { error: schoolSubErr } = await supabaseAdmin.from('school_subscriptions').upsert({
      school_id:   schoolId,
      plan:        upperPlan,
      status:      'ACTIVE',
      expiry_date: endDateStr,
    });
    if (schoolSubErr) throw new Error("Step 6 schoolSubErr: " + schoolSubErr.message);
    */
    console.log("6. Syncing school_subscriptions (skipped manual sync, relying on DB trigger)...");

    console.log("7. Generating invoice...");
    const invoiceNum = 'INV-TEST-' + Date.now();
    const { data: newInvoice, error: invoiceErr } = await supabaseAdmin.from('subscription_invoices').insert({
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
      billing_email:   'billing@aegiserp.xyz',
      billing_address: 'AEGIS ERP Institutional Cloud',
      plan_code:       planCode,
      billing_cycle:   cycle,
    }).select('id').single();
    if (invoiceErr) throw new Error("Step 7 invoiceErr: " + invoiceErr.message);
    const invoiceId = newInvoice?.id;
    console.log("Created invoice ID:", invoiceId);

    console.log("8. Creating subscription_audit_logs...");
    const { data: subAudit, error: subAuditErr } = await supabaseAdmin.from('subscription_audit_logs').insert({
      school_id:      schoolId,
      action:         'PURCHASED',
      plan:           planCode,
      billing_cycle:  cycle,
      amount:         payment.amount,
      payment_id:     paymentId,
      transaction_id: razorpayPaymentId,
      start_date:     startDateStr,
      end_date:       endDateStr,
      grace_end_date: graceEndDateStr,
    }).select('id').single();
    if (subAuditErr) throw new Error("Step 8 subAuditErr: " + subAuditErr.message);

    console.log("9. Creating audit_logs...");
    const { data: insertedAudit, error: auditErr } = await supabaseAdmin.from('audit_logs').insert({
      school_id:   schoolId,
      action_type: 'SUBSCRIPTION_PAYMENT_SUCCESS',
      module_name: 'BILLING',
      ip_address:  ipAddress,
      new_data: {
        paymentId, invoiceNum, planCode, cycle,
        startDateStr, endDateStr, graceEndDateStr,
        razorpayPaymentId, razorpayOrderId,
      },
    }).select('id').single();
    if (auditErr) throw new Error("Step 9 auditErr: " + auditErr.message);

    console.log("10. Creating payment_audit_logs...");
    const { data: insertedPayAudit, error: payAuditErr } = await supabaseAdmin.from('payment_audit_logs').insert({
      payment_id:          paymentId,
      school_id:           schoolId,
      event_type:          'PAYMENT_VERIFIED',
      action:              'APPROVED', // Set to APPROVED to satisfy CHECK constraint if needed
      performed_by:        '7a7321a6-0c91-4132-b444-731219bcd150', // Admin ID
      razorpay_order_id:   razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      amount:              payment.amount,
      ip_address:          ipAddress,
      performed_at:        now.toISOString(),
    }).select('id').single();
    if (payAuditErr) throw new Error("Step 10 payAuditErr: " + payAuditErr.message);

    console.log("ALL STEPS PASSED SUCCESSFULLY!");
  } catch (err: any) {
    console.error("TRANSACTION FAILED:", err.message);
  }
}

run().catch(console.error);
