import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Canonical plan prices — matches subscriptionService.ts PLAN_DEFINITIONS
const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  freemium:   { monthly: 0,    yearly: 0 },
  basic:      { monthly: 999,  yearly: 9999 },
  pro:        { monthly: 2499, yearly: 24999 },
  enterprise: { monthly: 4999, yearly: 49999 },
};

// Normalize legacy plan codes
const NORMALIZE_PLAN: Record<string, string> = {
  standard: 'pro',
  premium:  'enterprise',
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { schoolId, planCode, billingCycle } = req.body;
  if (!schoolId || !planCode || !billingCycle) {
    return res.status(400).json({ error: 'School ID, plan code, and billing cycle are required' });
  }

  const cleanPlan  = NORMALIZE_PLAN[planCode.trim().toLowerCase()] || planCode.trim().toLowerCase();
  const cleanCycle = billingCycle.trim().toUpperCase() as 'MONTHLY' | 'YEARLY';

  if (!PLAN_PRICES[cleanPlan]) {
    return res.status(400).json({ error: `Invalid plan selected: ${cleanPlan}` });
  }
  if (cleanCycle !== 'MONTHLY' && cleanCycle !== 'YEARLY') {
    return res.status(400).json({ error: 'Invalid billing cycle. Choose MONTHLY or YEARLY.' });
  }
  if (cleanPlan === 'freemium') {
    return res.status(400).json({ error: 'Freemium plan does not require payment.' });
  }

  try {
    // ── 1. Verify school exists ──────────────────────────────────────
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('id, name, email')
      .eq('id', schoolId)
      .maybeSingle();

    if (schoolError || !school) {
      return res.status(400).json({ error: 'School record not found' });
    }

    // ── 2. Duplicate payment protection ─────────────────────────────
    // Block if an active subscription with a pending payment already exists
    const { data: activePending } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, subscription_status, plan_code')
      .eq('school_id', schoolId)
      .in('status', ['PENDING', 'ACTIVE'])
      .maybeSingle();

    if (activePending && activePending.status === 'ACTIVE' &&
        activePending.subscription_status === 'active' &&
        activePending.plan_code === cleanPlan) {
      return res.status(409).json({
        error: 'An active subscription for this plan already exists. Use the Renew or Upgrade flow instead.',
        code: 'DUPLICATE_SUBSCRIPTION'
      });
    }

    // ── 3. Resolve amount ────────────────────────────────────────────
    let amount = PLAN_PRICES[cleanPlan][cleanCycle === 'MONTHLY' ? 'monthly' : 'yearly'];

    // Try subscription_plans table (authoritative DB source)
    const { data: dbPlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('price_monthly, price_yearly')
      .eq('code', cleanPlan)
      .maybeSingle();

    if (dbPlan) {
      amount = cleanCycle === 'MONTHLY' ? dbPlan.price_monthly : dbPlan.price_yearly;
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'This plan is free and does not require payment.' });
    }

    // ── 4. Upsert subscription record ────────────────────────────────
    let subscriptionId: string | undefined;

    if (activePending) {
      // Reuse existing subscription record (e.g. pending from earlier attempt)
      subscriptionId = activePending.id;
      await supabaseAdmin
        .from('subscriptions')
        .update({
          plan_code:    cleanPlan,
          billing_cycle: cleanCycle,
          status:       'PENDING',
          subscription_status: 'trial',
          updated_at:   new Date().toISOString(),
        })
        .eq('id', subscriptionId);
    } else {
      const { data: newSub } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          school_id:          schoolId,
          plan_code:          cleanPlan,
          billing_cycle:      cleanCycle,
          status:             'PENDING',
          subscription_status: 'trial',
          expiry_date:        new Date().toISOString().split('T')[0], // placeholder — updated on verify
        })
        .select('id')
        .single();
      subscriptionId = newSub?.id;
    }

    if (!subscriptionId) {
      return res.status(500).json({ error: 'Failed to initialise subscription record' });
    }

    // ── 5. Create pending payment record ─────────────────────────────
    const { data: payment, error: payError } = await supabaseAdmin
      .from('payments')
      .insert({
        school_id:       schoolId,
        subscription_id: subscriptionId,
        amount:          amount,
        currency:        'INR',
        status:          'PENDING',
      })
      .select('id')
      .single();

    if (payError || !payment) {
      console.error('Payment insert error:', payError?.message);
      return res.status(500).json({ error: 'Failed to record transaction initialisation' });
    }

    // ── 6. Connect to Razorpay ────────────────────────────────────────
    const razorpayKeyId     = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret    = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpaySecret) {
      // Mock order for local development / testing
      const mockOrderId = 'order_mock_' + Math.random().toString(36).substring(2, 9);
      await supabaseAdmin
        .from('payment_transactions')
        .insert({
          payment_id:       payment.id,
          gateway_name:     'RAZORPAY_MOCK',
          gateway_order_id: mockOrderId,
          status:           'PENDING',
        });

      return res.status(200).json({
        success:    true,
        orderId:    mockOrderId,
        amount,
        currency:   'INR',
        paymentId:  payment.id,
        isMock:     true,
        keyId:      'rzp_test_placeholder',
      });
    }

    const authString = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:   amount * 100, // paise
        currency: 'INR',
        receipt:  payment.id,
        notes: { schoolId, plan: cleanPlan, cycle: cleanCycle },
      }),
    });

    if (!rzpRes.ok) {
      const errText = await rzpRes.text();
      console.error('Razorpay Order API failed:', errText);
      return res.status(500).json({ error: 'Razorpay payment gateway connection failed' });
    }

    const rzpOrder = await rzpRes.json();

    await supabaseAdmin
      .from('payment_transactions')
      .insert({
        payment_id:       payment.id,
        gateway_name:     'RAZORPAY',
        gateway_order_id: rzpOrder.id,
        status:           'PENDING',
        raw_response:     rzpOrder,
      });

    return res.status(200).json({
      success:   true,
      orderId:   rzpOrder.id,
      amount,
      currency:  'INR',
      paymentId: payment.id,
      keyId:     razorpayKeyId,
    });
  } catch (err: any) {
    console.error('Unhandled create-payment error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
