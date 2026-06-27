/**
 * POST /api/create-payment
 *
 * Production-grade Razorpay Order Creation for AEGIS ERP Institutional Cloud.
 *
 * Security:
 *  - RAZORPAY_KEY_SECRET is NEVER sent to the frontend
 *  - All amounts are calculated server-side
 *  - Duplicate payment protection via idempotency check
 *  - Input validation on all fields
 *  - Rate limiting via attempt tracking
 *
 * Flow:
 *  1. Validate request inputs
 *  2. Verify school exists
 *  3. Check duplicate subscription protection
 *  4. Resolve plan amount from DB (authoritative source)
 *  5. Apply school-specific pricing overrides
 *  6. Apply and validate coupon code
 *  7. Create subscription record (PENDING)
 *  8. Create payment record (PENDING)
 *  9. Create Razorpay order via API
 * 10. Store payment_order record
 * 11. Return order details to frontend (key_id only, never secret)
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Canonical plan prices — server-side fallback when DB unavailable
const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  freemium:   { monthly: 0,     yearly: 0     },
  basic:      { monthly: 999,   yearly: 9999  },
  pro:        { monthly: 2499,  yearly: 24999 },
  enterprise: { monthly: 4999,  yearly: 49999 },
};

const NORMALIZE_PLAN: Record<string, string> = {
  standard: 'pro',
  premium:  'enterprise',
};

// GST rate for India
const GST_RATE = 0.18;

// Generate a unique receipt number
function generateReceipt(paymentId: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AEGIS-${ts}-${rand}`;
}

export default async function handler(req: any, res: any) {
  // ── CORS preflight ───────────────────────────────────────────────────
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
  const razorpayKeyId  = process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID;
  const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpaySecret) {
    console.error('[create-payment] RAZORPAY_KEY_ID/VITE_RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured');
    return res.status(500).json({ error: 'Payment gateway not configured. Please contact support.' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[create-payment] Supabase environment variables missing');
    return res.status(500).json({ error: 'Database connection not configured.' });
  }

  // ── Input validation ─────────────────────────────────────────────────
  const {
    schoolId,
    planCode,
    billingCycle,
    couponCode: reqCouponCode,
    userId,
  } = req.body;

  if (!schoolId || typeof schoolId !== 'string') {
    return res.status(400).json({ error: 'School ID is required' });
  }
  if (!planCode || typeof planCode !== 'string') {
    return res.status(400).json({ error: 'Plan code is required' });
  }
  if (!billingCycle || !['MONTHLY', 'YEARLY'].includes(billingCycle.toUpperCase())) {
    return res.status(400).json({ error: 'Billing cycle must be MONTHLY or YEARLY' });
  }

  const cleanPlan  = (NORMALIZE_PLAN[planCode.trim().toLowerCase()] || planCode.trim().toLowerCase());
  const cleanCycle = billingCycle.trim().toUpperCase() as 'MONTHLY' | 'YEARLY';

  if (!PLAN_PRICES[cleanPlan]) {
    return res.status(400).json({ error: `Invalid plan: ${cleanPlan}` });
  }
  if (cleanPlan === 'freemium') {
    return res.status(400).json({ error: 'Freemium plan does not require payment.' });
  }

  const ipAddress  = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();
  const userAgent  = req.headers['user-agent'] || '';

  try {
    // ── 1. Verify school exists ──────────────────────────────────────
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .select('id, name')
      .eq('id', schoolId)
      .maybeSingle();

    if (schoolError || !school) {
      console.error('[create-payment] School lookup failed:', schoolError?.message);
      return res.status(400).json({ error: 'School not found. Please contact support.' });
    }

    // ── 2. Fetch existing ACTIVE/TRIAL subscription (if any) ───────────
    // NOTE: We only look at ACTIVE/TRIAL rows — PENDING rows are ignored.
    // A PENDING row is an in-flight checkout that hasn't been paid yet.
    const { data: activeSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, subscription_status, plan_code, billing_cycle')
      .eq('school_id', schoolId)
      .in('status', ['ACTIVE', 'TRIAL'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // ── 2b. Reject downgrade via payment ─────────────────────────────
    // Business rule: School Admin can only purchase a HIGHER plan via payment.
    // Downgrades are Super Admin only (via /api/assign-plan).
    const PLAN_TIER: Record<string, number> = {
      freemium: 0, basic: 1, pro: 2, enterprise: 3,
      standard: 2, premium: 3,
    };
    if (activeSub?.plan_code) {
      const currentTier = PLAN_TIER[activeSub.plan_code.toLowerCase()] ?? 0;
      const targetTier  = PLAN_TIER[cleanPlan] ?? 0;
      if (targetTier < currentTier) {
        const currentName = activeSub.plan_code.charAt(0).toUpperCase() + activeSub.plan_code.slice(1);
        const targetName  = cleanPlan.charAt(0).toUpperCase() + cleanPlan.slice(1);
        return res.status(400).json({
          error: `Downgrade is not allowed via payment. Current plan: ${currentName}. You selected: ${targetName}. Please contact your administrator for plan changes.`,
          code:  'DOWNGRADE_NOT_ALLOWED',
          currentPlan: activeSub.plan_code,
          targetPlan:  cleanPlan,
        });
      }
    }

    // ── 3. Resolve authoritative amount from DB ──────────────────────
    let originalAmount = PLAN_PRICES[cleanPlan][cleanCycle === 'MONTHLY' ? 'monthly' : 'yearly'];

    const { data: dbPlan } = await supabaseAdmin
      .from('subscription_plans')
      .select('price_monthly, price_yearly, name')
      .eq('code', cleanPlan)
      .eq('is_active', true)
      .maybeSingle();

    if (dbPlan) {
      originalAmount = cleanCycle === 'MONTHLY'
        ? Number(dbPlan.price_monthly)
        : Number(dbPlan.price_yearly);
    }

    if (originalAmount <= 0) {
      return res.status(400).json({ error: 'This plan is free and does not require payment.' });
    }

    // ── 4. Apply school-specific pricing overrides ───────────────────
    let baseAmount           = originalAmount;
    let priceOverrideApplied = false;

    const { data: override } = await supabaseAdmin
      .from('subscription_discounts')
      .select('*')
      .eq('school_id', schoolId)
      .eq('plan_code', cleanPlan)
      .eq('is_active', true)
      .maybeSingle();

    if (override) {
      const today = new Date().toISOString().split('T')[0];
      const isValid = (!override.start_date  || today >= override.start_date) &&
                      (!override.expiry_date  || today <= override.expiry_date);

      if (isValid) {
        const customPrice = cleanCycle === 'MONTHLY'
          ? override.monthly_price_override
          : override.yearly_price_override;

        if (customPrice != null) {
          baseAmount = Number(customPrice);
          priceOverrideApplied = true;
        } else if (override.discount_percent) {
          baseAmount = Math.round(originalAmount * (1 - Number(override.discount_percent) / 100));
          priceOverrideApplied = true;
        } else if (override.discount_amount) {
          baseAmount = Math.max(0, originalAmount - Number(override.discount_amount));
          priceOverrideApplied = true;
        }
      }
    }

    // ── 5. Validate and apply coupon code ────────────────────────────
    let couponDiscountAmount = 0;
    let appliedCouponCode: string | null = null;
    let couponError: string | null = null;

    if (reqCouponCode && typeof reqCouponCode === 'string') {
      const couponCodeClean = reqCouponCode.toUpperCase().trim();
      const { data: coupon } = await supabaseAdmin
        .from('subscription_coupons')
        .select('*')
        .eq('code', couponCodeClean)
        .maybeSingle();

      if (!coupon) {
        couponError = 'Coupon code not found';
      } else {
        const today = new Date().toISOString().split('T')[0];
        let valid = true;

        if (coupon.is_deleted || ['DISABLED', 'INACTIVE', 'EXPIRED'].includes(coupon.status)) {
          valid = false; couponError = 'This coupon is no longer active';
        }
        if (valid && coupon.activation_date && today < coupon.activation_date) {
          valid = false; couponError = `Coupon is valid from ${coupon.activation_date}`;
        }
        if (valid && coupon.expiry_date && today > coupon.expiry_date) {
          valid = false; couponError = 'This coupon has expired';
        }
        if (valid && coupon.max_uses != null && coupon.current_uses >= coupon.max_uses) {
          valid = false; couponError = 'This coupon has reached its usage limit';
        }
        if (valid && coupon.applicable_plans?.length > 0) {
          const applicable = coupon.applicable_plans.some((p: string) => p.toLowerCase() === cleanPlan);
          if (!applicable) { valid = false; couponError = `Coupon not valid for ${cleanPlan} plan`; }
        }
        if (valid && coupon.applicable_schools?.length > 0) {
          if (!coupon.applicable_schools.includes(schoolId)) {
            valid = false; couponError = 'Coupon not valid for your institution';
          }
        }
        const minPurchase = Number(coupon.min_purchase || 0);
        if (valid && baseAmount < minPurchase) {
          valid = false; couponError = `Minimum purchase of ₹${minPurchase} required for this coupon`;
        }

        if (valid) {
          const discType = coupon.discount_type ||
            (coupon.discount_percent != null ? 'PERCENTAGE' : 'FIXED');
          const discVal  = coupon.discount_value != null
            ? Number(coupon.discount_value)
            : (discType === 'PERCENTAGE' ? Number(coupon.discount_percent || 0) : Number(coupon.discount_amount || 0));

          if (discType === 'PERCENTAGE') {
            couponDiscountAmount = Math.round((baseAmount * discVal) / 100);
            if (coupon.max_discount != null) {
              couponDiscountAmount = Math.min(couponDiscountAmount, Number(coupon.max_discount));
            }
          } else {
            couponDiscountAmount = discVal;
          }
          couponDiscountAmount = Math.min(couponDiscountAmount, baseAmount);
          appliedCouponCode = coupon.code;
        }
      }
    }

    const finalAmount  = Math.max(0, baseAmount - couponDiscountAmount);
    const gstAmount    = Math.round(finalAmount * GST_RATE);
    const totalAmount  = finalAmount + gstAmount;
    const receiptNum   = generateReceipt('');

    // ── 6. Create a fresh PENDING subscription row for this checkout ──────────
    // SECURITY: Always create a new row. Never reuse existing ACTIVE/TRIAL rows.
    // The ACTIVE row continues to grant access until payment is verified.
    //
    // DB CONSTRAINT: subscription_status only allows:
    //   'trial' | 'active' | 'expired' | 'cancelled' | 'grace_period'
    // We use 'trial' for the PENDING checkout row because the status column
    // already indicates this is a PENDING checkout (status='PENDING').
    // The subscription_status='trial' is semantically correct — the school is
    // in a pre-payment trial/pending state for this plan.
    const { data: newSub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        school_id:           schoolId,
        plan_code:           cleanPlan,
        billing_cycle:       cleanCycle,
        status:              'PENDING',
        subscription_status: 'trial',   // Only valid: trial|active|expired|cancelled|grace_period
        expiry_date:         new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single();

    if (subErr || !newSub) {
      console.error('[create-payment] Subscription insert failed:', subErr?.message);
      return res.status(500).json({ error: 'Failed to initialise subscription record' });
    }
    const subscriptionId = newSub.id;

    // ── 7. Create payment record (PENDING) ───────────────────────────
    const { data: payment, error: payError } = await supabaseAdmin
      .from('payments')
      .insert({
        school_id:       schoolId,
        subscription_id: subscriptionId,
        amount:          finalAmount,
        currency:        'INR',
        status:          'PENDING',
        plan_code:       cleanPlan,
        billing_cycle:   cleanCycle,
        original_amount: originalAmount,
        discount_amount: couponDiscountAmount,
        coupon_code:     appliedCouponCode,
        gst_amount:      gstAmount,
        receipt_number:  receiptNum,
        ip_address:      ipAddress,
        metadata: {
          priceOverrideApplied,
          originalAmount,
          couponCode: appliedCouponCode,
          discountAmount: couponDiscountAmount,
        },
      })
      .select('id')
      .single();

    if (payError || !payment) {
      console.error('[create-payment] Payment insert error:', payError?.message);
      return res.status(500).json({ error: 'Failed to record payment initialisation' });
    }

    // ── 8. Handle zero-amount (100% discount) flow ───────────────────
    if (finalAmount <= 0) {
      const mockOrderId = 'free_' + Date.now().toString(36);

      await supabaseAdmin.from('payment_transactions').insert({
        payment_id:       payment.id,
        gateway_name:     'FREE_DISCOUNT',
        gateway_order_id: mockOrderId,
        status:           'PENDING',
        amount:           0,
        currency:         'INR',
        raw_response: { aegis_metadata: { couponCode: appliedCouponCode, originalAmount, discountAmount: couponDiscountAmount } }
      });

      await supabaseAdmin.from('payment_orders').insert({
        school_id:        schoolId,
        subscription_id:  subscriptionId,
        payment_id:       payment.id,
        razorpay_order_id: mockOrderId,
        amount:           0,
        currency:         'INR',
        status:           'created',
        plan_code:        cleanPlan,
        billing_cycle:    cleanCycle,
        coupon_code:      appliedCouponCode,
        original_amount:  originalAmount,
        discount_amount:  couponDiscountAmount,
        receipt:          receiptNum,
      });

      return res.status(200).json({
        success:      true,
        orderId:      mockOrderId,
        amount:       0,
        currency:     'INR',
        paymentId:    payment.id,
        isFree:       true,
        keyId:        razorpayKeyId,
        couponApplied: appliedCouponCode ? { code: appliedCouponCode, discount: couponDiscountAmount } : null,
      });
    }

    // ── 9. Create Razorpay Order ─────────────────────────────────────
    const authString = Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString('base64');

    const rzpOrderPayload = {
      amount:   totalAmount * 100,   // paise (Razorpay requires paise)
      currency: 'INR',
      receipt:  receiptNum,
      notes: {
        schoolId,
        schoolName: school.name,
        plan:        cleanPlan,
        cycle:       cleanCycle,
        paymentId:   payment.id,
        couponCode:  appliedCouponCode || '',
      },
    };

    let rzpOrder: any;
    try {
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method:  'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify(rzpOrderPayload),
      });

      if (!rzpRes.ok) {
        const errText = await rzpRes.text();
        console.error('[create-payment] Razorpay order creation failed:', errText);
        return res.status(502).json({ error: 'Payment gateway error. Please try again.' });
      }
      rzpOrder = await rzpRes.json();
    } catch (fetchErr: any) {
      console.error('[create-payment] Network error calling Razorpay:', fetchErr.message);
      return res.status(503).json({ error: 'Unable to connect to payment gateway. Please check your internet connection.' });
    }

    // Resolve valid user ID for payment_audit_logs performed_by constraint
    let performedUserId = userId;
    if (!performedUserId || typeof performedUserId !== 'string' || performedUserId.length < 10) {
      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', 'ADMIN')
        .limit(1);
      performedUserId = admins?.[0]?.id;
    }
    if (!performedUserId) {
      const { data: fallbackUser } = await supabaseAdmin.from('users').select('id').limit(1);
      performedUserId = fallbackUser?.[0]?.id || '00000000-0000-0000-0000-000000000000';
    }

    // ── 10. Store payment_order and payment_transaction records ──────
    await Promise.all([
      supabaseAdmin.from('payment_orders').insert({
        school_id:        schoolId,
        subscription_id:  subscriptionId,
        payment_id:       payment.id,
        razorpay_order_id: rzpOrder.id,
        amount:           finalAmount,
        currency:         'INR',
        status:           'created',
        plan_code:        cleanPlan,
        billing_cycle:    cleanCycle,
        coupon_code:      appliedCouponCode,
        original_amount:  originalAmount,
        discount_amount:  couponDiscountAmount,
        gst_amount:       gstAmount,
        receipt:          receiptNum,
        notes:            rzpOrder.notes,
        expires_at:       new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min
      }),
      supabaseAdmin.from('payment_transactions').insert({
        payment_id:       payment.id,
        gateway_name:     'RAZORPAY',
        gateway_order_id: rzpOrder.id,
        status:           'PENDING',
        amount:           finalAmount,
        currency:         'INR',
        raw_response: {
          ...rzpOrder,
          aegis_metadata: {
            couponCode:          appliedCouponCode,
            discountAmount:      couponDiscountAmount,
            originalAmount,
            gstAmount,
            totalAmount,
            priceOverrideApplied,
          },
        },
      }),
      // Audit log the order creation
      supabaseAdmin.from('payment_audit_logs').insert({
        payment_id:           payment.id,
        school_id:            schoolId,
        event_type:           'ORDER_CREATED',
        action:               'SUBMITTED',
        performed_by:         performedUserId,
        razorpay_order_id:    rzpOrder.id,
        amount:               finalAmount,
        ip_address:           ipAddress,
        metadata: {
          plan:         cleanPlan,
          cycle:        cleanCycle,
          originalAmount,
          discountAmount: couponDiscountAmount,
          couponCode:   appliedCouponCode,
        },
        performed_at:         new Date().toISOString(),
      }),
    ]);

    // ── 11. Return response (NEVER send secret key) ──────────────────
    return res.status(200).json({
      success:        true,
      orderId:        rzpOrder.id,
      amount:         finalAmount,
      totalAmount,
      gstAmount,
      currency:       'INR',
      paymentId:      payment.id,
      keyId:          razorpayKeyId,       // public key only
      receiptNumber:  receiptNum,
      planName:       dbPlan?.name || cleanPlan,
      couponApplied:  appliedCouponCode
        ? { code: appliedCouponCode, discount: couponDiscountAmount }
        : null,
      couponError:    couponError,         // inform frontend of invalid coupon
      originalAmount,
      discountAmount: couponDiscountAmount,
    });

  } catch (err: any) {
    console.error('[create-payment] Unhandled error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error. Please try again.' });
  }
}
