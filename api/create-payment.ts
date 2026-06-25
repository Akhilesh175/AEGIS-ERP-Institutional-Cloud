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
    let originalAmount = PLAN_PRICES[cleanPlan][cleanCycle === 'MONTHLY' ? 'monthly' : 'yearly'];

    // Try subscription_plans table (authoritative DB source)
    const { data: dbPlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('price_monthly, price_yearly')
      .eq('code', cleanPlan)
      .maybeSingle();

    if (dbPlan) {
      originalAmount = cleanCycle === 'MONTHLY' ? dbPlan.price_monthly : dbPlan.price_yearly;
    }

    if (originalAmount <= 0) {
      return res.status(400).json({ error: 'This plan is free and does not require payment.' });
    }

    // ── 3a. Apply School-specific pricing overrides ──
    let baseAmount = originalAmount;
    let priceOverrideApplied = false;

    const { data: discountOverride } = await supabaseAdmin
      .from('subscription_discounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('plan_code', cleanPlan)
      .eq('is_active', true)
      .maybeSingle();

    if (discountOverride) {
      const todayStr = new Date().toISOString().split('T')[0];
      let validOverride = true;
      if (discountOverride.start_date && todayStr < discountOverride.start_date) {
        validOverride = false;
      }
      if (discountOverride.expiry_date && todayStr > discountOverride.expiry_date) {
        validOverride = false;
      }

      if (validOverride) {
        const customPrice = cleanCycle === 'MONTHLY' 
          ? discountOverride.monthly_price_override 
          : discountOverride.yearly_price_override;

        if (customPrice !== null && customPrice !== undefined) {
          baseAmount = Number(customPrice);
          priceOverrideApplied = true;
        } else if (discountOverride.discount_percent) {
          baseAmount = Math.round(originalAmount * (1 - Number(discountOverride.discount_percent) / 100));
          priceOverrideApplied = true;
        } else if (discountOverride.discount_amount) {
          baseAmount = Math.max(0, originalAmount - Number(discountOverride.discount_amount));
          priceOverrideApplied = true;
        }
      }
    }

    // ── 3b. Apply Coupon Code ──
    let couponDiscountAmount = 0;
    let appliedCouponCode: string | null = null;
    const reqCouponCode = req.body.couponCode;

    if (reqCouponCode) {
      const { data: couponRecord } = await supabaseAdmin
        .from('subscription_coupons')
        .select('*')
        .eq('code', reqCouponCode.toUpperCase().trim())
        .eq('is_active', true)
        .maybeSingle();

      if (couponRecord) {
        const todayStr = new Date().toISOString().split('T')[0];
        let validCoupon = true;
        
        if (couponRecord.expiry_date && todayStr > couponRecord.expiry_date) {
          validCoupon = false;
        }
        if (couponRecord.max_uses !== null && couponRecord.current_uses !== null) {
          if (couponRecord.current_uses >= couponRecord.max_uses) {
            validCoupon = false;
          }
        }
        if (couponRecord.applicable_plans && couponRecord.applicable_plans.length > 0) {
          const isPlanApplicable = couponRecord.applicable_plans.some((p: string) => p.toLowerCase() === cleanPlan.toLowerCase());
          if (!isPlanApplicable) {
            validCoupon = false;
          }
        }
        if (couponRecord.applicable_schools && couponRecord.applicable_schools.length > 0) {
          const isSchoolApplicable = couponRecord.applicable_schools.some((s: string) => s === schoolId);
          if (!isSchoolApplicable) {
            validCoupon = false;
          }
        }

        if (validCoupon) {
          if (couponRecord.discount_percent !== null && couponRecord.discount_percent !== undefined) {
            couponDiscountAmount = Math.round((baseAmount * Number(couponRecord.discount_percent)) / 100);
          } else if (couponRecord.discount_amount !== null && couponRecord.discount_amount !== undefined) {
            couponDiscountAmount = Number(couponRecord.discount_amount);
          }
          couponDiscountAmount = Math.min(couponDiscountAmount, baseAmount);
          appliedCouponCode = couponRecord.code;
        }
      }
    }

    const finalAmount = Math.max(0, baseAmount - couponDiscountAmount);
    const amount = finalAmount;

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

    // ── 4b. Handle zero-amount checkout (free due to coupon/override) ──
    if (amount <= 0) {
      const mockOrderId = 'free_discount_order_' + Math.random().toString(36).substring(2, 9);
      
      const { data: payment, error: payError } = await supabaseAdmin
        .from('payments')
        .insert({
          school_id:       schoolId,
          subscription_id: subscriptionId,
          amount:          0,
          currency:        'INR',
          status:          'PENDING',
        })
        .select('id')
        .single();

      if (payError || !payment) {
        return res.status(500).json({ error: 'Failed to record free transaction' });
      }

      await supabaseAdmin
        .from('payment_transactions')
        .insert({
          payment_id:       payment.id,
          gateway_name:     'FREE_DISCOUNT',
          gateway_order_id: mockOrderId,
          status:           'PENDING',
          raw_response: {
            aegis_metadata: {
              couponCode: appliedCouponCode,
              discountAmount: originalAmount - amount,
              originalAmount: originalAmount,
              priceOverrideApplied: priceOverrideApplied
            }
          }
        });

      return res.status(200).json({
        success:    true,
        orderId:    mockOrderId,
        amount:     0,
        currency:   'INR',
        paymentId:  payment.id,
        isMock:     true,
        keyId:      'rzp_test_placeholder',
      });
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
          raw_response: {
            aegis_metadata: {
              couponCode: appliedCouponCode,
              discountAmount: originalAmount - amount,
              originalAmount: originalAmount,
              priceOverrideApplied: priceOverrideApplied
            }
          }
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
        raw_response: {
          ...rzpOrder,
          aegis_metadata: {
            couponCode: appliedCouponCode,
            discountAmount: originalAmount - amount,
            originalAmount: originalAmount,
            priceOverrideApplied: priceOverrideApplied
          }
        },
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
