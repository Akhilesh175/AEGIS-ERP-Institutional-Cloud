import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  basic: { monthly: 999, yearly: 9590 },
  standard: { monthly: 2499, yearly: 23990 },
  premium: { monthly: 4999, yearly: 47990 },
  enterprise: { monthly: 0, yearly: 0 }
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  const { schoolId, planCode, billingCycle } = req.body;
  if (!schoolId || !planCode || !billingCycle) {
    return res.status(400).json({ error: 'School ID, plan code, and billing cycle are required' });
  }

  const cleanPlan = planCode.trim().toLowerCase();
  const cleanCycle = billingCycle.trim().toUpperCase() as 'MONTHLY' | 'YEARLY';

  if (!PLAN_PRICES[cleanPlan]) {
    return res.status(400).json({ error: 'Invalid plan selected' });
  }

  if (cleanCycle !== 'MONTHLY' && cleanCycle !== 'YEARLY') {
    return res.status(400).json({ error: 'Invalid billing cycle. Choose MONTHLY or YEARLY.' });
  }

  try {
    // 1. Double check school exists
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('id, name, email')
      .eq('id', schoolId)
      .maybeSingle();

    if (schoolError || !school) {
      return res.status(400).json({ error: 'School record not found' });
    }

    // 2. Fetch price details (fall back to static if plan_plans table select fails)
    let amount = PLAN_PRICES[cleanPlan][cleanCycle === 'MONTHLY' ? 'monthly' : 'yearly'];
    
    const { data: dbPlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('price_monthly, price_yearly')
      .eq('code', cleanPlan)
      .maybeSingle();
      
    if (dbPlan) {
      amount = cleanCycle === 'MONTHLY' ? dbPlan.price_monthly : dbPlan.price_yearly;
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Enterprise custom plan requires direct billing setup' });
    }

    // 3. Create active subscription draft or get existing subscription
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id')
      .eq('school_id', schoolId)
      .maybeSingle();

    let subscriptionId = existingSub?.id;

    if (!subscriptionId) {
      const { data: newSub } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          school_id: schoolId,
          plan_code: cleanPlan,
          status: 'PENDING',
          billing_cycle: cleanCycle,
          expiry_date: new Date().toISOString().split('T')[0] // default placeholder
        })
        .select()
        .single();
      subscriptionId = newSub?.id;
    }

    // 4. Create pending payment record
    const { data: payment, error: payError } = await supabaseAdmin
      .from('payments')
      .insert({
        school_id: schoolId,
        subscription_id: subscriptionId,
        amount: amount,
        currency: 'INR',
        status: 'PENDING'
      })
      .select()
      .single();

    if (payError || !payment) {
      console.error('Payment insert error:', payError?.message);
      return res.status(500).json({ error: 'Failed to record transaction initialization' });
    }

    // 5. Connect to Razorpay API to generate transaction order
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpaySecret) {
      console.warn('Razorpay credentials are not configured on Vercel.');
      // Direct mock order ID for testing fallback if credentials not present (e.g. locally without env)
      const mockOrderId = 'order_mock_' + Math.random().toString(36).substring(2, 9);
      await supabaseAdmin
        .from('payment_transactions')
        .insert({
          payment_id: payment.id,
          gateway_name: 'RAZORPAY_MOCK',
          gateway_order_id: mockOrderId,
          status: 'PENDING'
        });

      return res.status(200).json({
        success: true,
        orderId: mockOrderId,
        amount: amount,
        currency: 'INR',
        paymentId: payment.id,
        isMock: true,
        keyId: 'rzp_test_placeholder'
      });
    }

    const authString = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString('base64');
    
    const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount * 100, // in paise
        currency: 'INR',
        receipt: payment.id,
        notes: {
          schoolId: schoolId,
          plan: cleanPlan,
          cycle: cleanCycle
        }
      })
    });

    if (!razorpayResponse.ok) {
      const errText = await razorpayResponse.text();
      console.error('Razorpay Order API failed:', errText);
      return res.status(500).json({ error: 'Razorpay payment gateway connection failed' });
    }

    const rzpOrder = await razorpayResponse.json();

    // 6. Record Gateway Order transaction details
    const { error: transError } = await supabaseAdmin
      .from('payment_transactions')
      .insert({
        payment_id: payment.id,
        gateway_name: 'RAZORPAY',
        gateway_order_id: rzpOrder.id,
        status: 'PENDING',
        raw_response: rzpOrder
      });

    if (transError) {
      console.error('Transaction logs failed:', transError.message);
    }

    return res.status(200).json({
      success: true,
      orderId: rzpOrder.id,
      amount: amount,
      currency: 'INR',
      paymentId: payment.id,
      keyId: razorpayKeyId
    });
  } catch (err: any) {
    console.error('Unhandled create-payment error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
