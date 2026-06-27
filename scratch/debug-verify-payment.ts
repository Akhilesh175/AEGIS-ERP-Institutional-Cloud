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
  console.log("Fetching last payment record...");
  const { data: payments, error: fetchErr } = await supabaseAdmin
    .from('payments')
    .select('*, subscriptions(*)')
    .order('created_at', { ascending: false })
    .limit(5);

  if (fetchErr || !payments || payments.length === 0) {
    console.error("No payments found or error:", fetchErr);
    return;
  }

  console.log(`Found ${payments.length} recent payments.`);
  for (const payment of payments) {
    console.log(`Payment ID: ${payment.id}, Status: ${payment.status}, Plan: ${payment.plan_code || payment.subscriptions?.plan_code}, Amount: ${payment.amount}`);
  }

  // Pick the first one
  const payment = payments[0];
  const paymentId = payment.id;
  const schoolId = payment.school_id;
  const planCode = payment.plan_code || payment.subscriptions?.plan_code || 'pro';
  const cycle = (payment.subscriptions?.billing_cycle || 'YEARLY') as 'MONTHLY' | 'YEARLY';
  const originalAmount = payment.original_amount || payment.amount;
  const discountAmount = payment.discount_amount || 0;
  const gstAmount = payment.gst_amount || Math.round(payment.amount * 0.18);
  const totalAmount = payment.amount + gstAmount;
  const razorpayPaymentId = 'pay_debug_' + Date.now();
  const razorpayOrderId = payment.razorpay_order_id || 'order_debug_' + Date.now();
  const razorpaySignature = 'sig_debug_' + Date.now();
  const now = new Date();
  const startDateStr = now.toISOString().split('T')[0];
  const endDateStr = new Date(now.setMonth(now.getMonth() + 1)).toISOString().split('T')[0];
  const graceEndDateStr = new Date(now.setDate(now.getDate() + 3)).toISOString().split('T')[0];

  console.log("\nTesting Step 9: subscription_invoices insert...");
  const invoiceNum = `AEGIS-INV-DBG-${Date.now().toString().slice(-4)}`;
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
    billing_email:   'test@aegiserp.xyz',
    billing_address: 'AEGIS ERP Institutional Cloud',
    plan_code:       planCode,
    billing_cycle:   cycle,
  }).select('id').maybeSingle();

  if (invoiceErr) {
    console.error("Step 9 FAILED:", invoiceErr);
  } else {
    console.log("Step 9 SUCCEEDED, invoice ID:", newInvoice?.id);
    // Cleanup invoice
    if (newInvoice?.id) {
      await supabaseAdmin.from('subscription_invoices').delete().eq('id', newInvoice.id);
    }
  }

  console.log("\nTesting Step 10: subscription_audit_logs insert...");
  const { data: insertedSubAudit, error: subAuditErr } = await supabaseAdmin.from('subscription_audit_logs').insert({
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
  }).select('id').maybeSingle();

  if (subAuditErr) {
    console.error("Step 10 FAILED:", subAuditErr);
  } else {
    console.log("Step 10 SUCCEEDED, audit log ID:", insertedSubAudit?.id);
    if (insertedSubAudit?.id) {
      await supabaseAdmin.from('subscription_audit_logs').delete().eq('id', insertedSubAudit.id);
    }
  }
}

run().catch(console.error);
