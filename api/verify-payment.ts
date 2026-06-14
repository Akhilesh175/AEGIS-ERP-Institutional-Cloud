import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  const {
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    paymentId,
    isMock // optional flag to allow testing offline
  } = req.body;

  if (!paymentId || !razorpayOrderId) {
    return res.status(400).json({ error: 'Payment record ID and order ID are required' });
  }

  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  try {
    // 1. Fetch payment record
    const { data: payment, error: selectError } = await supabaseAdmin
      .from('payments')
      .select('*, subscriptions(*)')
      .eq('id', paymentId)
      .maybeSingle();

    if (selectError || !payment) {
      return res.status(400).json({ error: 'Payment transaction record not found' });
    }

    if (payment.status === 'SUCCESS') {
      return res.status(200).json({ success: true, message: 'Payment already processed.' });
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    // 2. Perform Signature Verification
    let isSignatureValid = false;

    if (isMock && (!razorpayKeyId || !razorpaySecret)) {
      // Allow testing offline / mock payment verify in developer sandbox
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
      // Signature mismatch: Record failure
      await supabaseAdmin
        .from('payments')
        .update({ status: 'FAILED' })
        .eq('id', paymentId);

      await supabaseAdmin
        .from('payment_transactions')
        .update({ status: 'FAILED', raw_response: { error: 'Signature mismatch' } })
        .eq('payment_id', paymentId);

      return res.status(400).json({ error: 'Gateway signature validation failed' });
    }

    // 3. Update payment and transaction logs
    const { error: payUpdateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'SUCCESS',
        payment_method: isMock ? 'MOCK_CARD' : 'GATEWAY_CARD'
      })
      .eq('id', paymentId);

    if (payUpdateError) console.error('Error updating payment:', payUpdateError.message);

    await supabaseAdmin
      .from('payment_transactions')
      .update({
        status: 'SUCCESS',
        gateway_payment_id: razorpayPaymentId || 'mock_pay_id',
        gateway_signature: razorpaySignature || 'mock_sig'
      })
      .eq('payment_id', paymentId);

    // 4. Retrieve plan details and compute subscription expiry
    const cycle = payment.subscriptions?.billing_cycle || 'MONTHLY';
    const planCode = payment.subscriptions?.plan_code || 'basic';
    
    // Add 30 days for monthly billing, 365 days for yearly
    const durationDays = cycle === 'YEARLY' ? 365 : 30;
    const startDate = new Date();
    const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedExpiryDate = expiryDate.toISOString().split('T')[0];

    // 5. Activate Subscription
    const { error: subUpdateError } = await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'ACTIVE',
        start_date: formattedStartDate,
        expiry_date: formattedExpiryDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.subscription_id);

    if (subUpdateError) {
      console.error('Subscription update failed:', subUpdateError.message);
      return res.status(500).json({ error: 'Failed to activate subscription' });
    }

    // 6. Update school plan name
    await supabaseAdmin
      .from('schools')
      .update({
        subscription_plan: planCode.toUpperCase()
      })
      .eq('id', payment.school_id);

    // 7. Generate Invoice Record
    const invoiceNum = 'INV-' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);
    const { data: invoice } = await supabaseAdmin
      .from('subscription_invoices')
      .insert({
        school_id: payment.school_id,
        payment_id: paymentId,
        invoice_number: invoiceNum,
        amount: payment.amount,
        tax_amount: Math.round(payment.amount * 0.18), // 18% GST estimate
        total_amount: Math.round(payment.amount * 1.18),
        status: 'PAID',
        billing_email: payment.subscriptions?.email || 'admin@institution.edu',
        billing_address: 'ERP Institutional Cloud Console'
      })
      .select()
      .single();

    // 8. Log audit trail
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        school_id: payment.school_id,
        action_type: 'SUBSCRIPTION_PAYMENT_SUCCESS',
        module_name: 'BILLING',
        ip_address: ipAddress,
        new_data: { paymentId, invoiceNum, planCode, cycle }
      });

    // 9. Dispatch Invoice Success Email
    const resendApiKey = process.env.RESEND_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || 'noreply@aegiserp.xyz';

    if (resendApiKey) {
      // Lookup school details for email personalization
      const { data: school } = await supabaseAdmin
        .from('schools')
        .select('name')
        .eq('id', payment.school_id)
        .maybeSingle();

      const recipientEmail = school?.email || payment.subscriptions?.email || '';
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Aegis ERP Billing Invoice</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
            .header { background: #070a13; padding: 30px; text-align: center; border-bottom: 3px solid #0ea0eb; }
            .logo { color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1px; margin: 0; }
            .logo span { color: #0ea0eb; font-weight: 400; }
            .content { padding: 40px 30px; }
            h2 { margin-top: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
            p { font-size: 14px; line-height: 1.6; color: #475569; }
            .invoice-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
            .invoice-table th { background: #f8fafc; text-align: left; padding: 12px; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; border-bottom: 1px solid #e2e8f0; }
            .invoice-table td { padding: 12px; font-size: 13px; color: #334155; border-bottom: 1px solid #f1f5f9; }
            .total-row td { font-weight: 700; color: #0ea0eb; border-top: 2px solid #e2e8f0; }
            .meta { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">AEGIS <span>ERP</span></h1>
            </div>
            <div class="content">
              <h2>Subscription Payment Successful!</h2>
              <p>Dear Administrator,</p>
              <p>We have received payment for your <strong>Aegis ERP Institutional Cloud</strong> subscription. Your active subscription has been successfully updated.</p>
              
              <table class="invoice-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Billing Cycle</th>
                    <th>Total Price</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>${planCode.toUpperCase()} Plan</strong> subscription for ${school?.name || 'your institution'}</td>
                    <td>${cycle}</td>
                    <td>₹${payment.amount}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="text-align: right; font-weight: bold; color: #64748b;">Invoice Number:</td>
                    <td><strong>${invoiceNum}</strong></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="text-align: right; font-weight: bold; color: #64748b;">Subtotal:</td>
                    <td>₹${payment.amount}</td>
                  </tr>
                  <tr>
                    <td colspan="2" style="text-align: right; font-weight: bold; color: #64748b;">Tax (18% Estimated GST):</td>
                    <td>₹${Math.round(payment.amount * 0.18)}</td>
                  </tr>
                  <tr class="total-row">
                    <td colspan="2" style="text-align: right;">Total Amount:</td>
                    <td>₹${Math.round(payment.amount * 1.18)}</td>
                  </tr>
                </tbody>
              </table>

              <p><strong>Subscription Expiry:</strong> Your plan will remain active until <strong>${formattedExpiryDate}</strong>. You will receive an automated renewal reminder 7 days before expiration.</p>
              
              <div class="meta">
                Thank you for your business. For billing queries, reply to this email.<br>
                &copy; 2026 Aegis ERP. All rights reserved.
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      if (recipientEmail) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `Aegis ERP Billing <${supportEmail}>`,
            to: [recipientEmail],
            subject: 'Payment Successful: Invoice ' + invoiceNum + ' - ' + (school?.name || ''),
            html: emailHtml
          })
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Payment verified and subscription activated successfully.',
      invoiceNumber: invoiceNum
    });
  } catch (err: any) {
    console.error('Unhandled verify-payment error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
