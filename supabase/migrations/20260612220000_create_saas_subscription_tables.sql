-- =====================================================================
-- AEGIS ERP SAAS MODULE: SUBSCRIPTION, BILLING AND REGISTRATION TABLES
-- =====================================================================

-- 1. Create subscription plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE, -- 'basic', 'standard', 'premium', 'enterprise'
    price_monthly NUMERIC NOT NULL,
    price_yearly NUMERIC NOT NULL,
    features JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert default subscription plans
INSERT INTO public.subscription_plans (name, code, price_monthly, price_yearly, features) VALUES
('Basic', 'basic', 999, 9590, '["Student Management", "Attendance", "Fee Management"]'),
('Standard', 'standard', 2499, 23990, '["Student Management", "Attendance", "Fee Management", "Teacher Portal", "Parent Portal", "Reports"]'),
('Premium', 'premium', 4999, 47990, '["Student Management", "Attendance", "Fee Management", "Teacher Portal", "Parent Portal", "Reports", "Hostel Management", "Library Management", "Transport Management", "Analytics Dashboard"]'),
('Enterprise', 'enterprise', 0, 0, '["All Modules", "Custom Branding", "Priority Support", "Multi-Campus Support"]')
ON CONFLICT (code) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    features = EXCLUDED.features;

-- 3. Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    plan_code TEXT NOT NULL, -- 'basic', 'standard', 'premium', 'enterprise'
    status TEXT NOT NULL CHECK (status IN ('TRIAL', 'ACTIVE', 'INACTIVE', 'EXPIRED', 'PENDING')),
    billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('MONTHLY', 'YEARLY', 'TRIAL')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create payments table (for subscription purchases)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount NUMERIC NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT, -- 'CARD', 'UPI', 'NET_BANKING', etc.
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create payment transactions table (gateway level details)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
    gateway_name TEXT NOT NULL DEFAULT 'RAZORPAY',
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    gateway_signature TEXT,
    status TEXT NOT NULL,
    raw_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create subscription invoices table (SaaS billing invoices)
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL UNIQUE,
    amount NUMERIC NOT NULL,
    tax_amount NUMERIC DEFAULT 0,
    total_amount NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('UNPAID', 'PAID', 'CANCELLED')),
    billing_email TEXT,
    billing_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create OTP verification table for school registration
CREATE TABLE IF NOT EXISTS public.otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'SCHOOL_REGISTRATION',
    attempt_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Add Indexes for queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_school ON public.subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_school ON public.payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_trans_gateway ON public.payment_transactions(gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_sub_invoices_school ON public.subscription_invoices(school_id);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON public.otp_verifications(email, verified);

-- 9. Enable Row Level Security (RLS) on all new tables
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Grant RLS Select for authenticated users to view plans
CREATE POLICY "Allow select for active subscription plans" ON public.subscription_plans
  FOR SELECT TO authenticated, anon USING (true);

-- 10. Database Trigger to automatically sync `school_subscriptions`
CREATE OR REPLACE FUNCTION sync_school_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.school_subscriptions (school_id, plan, status, expiry_date, created_at, updated_at)
  VALUES (
    NEW.school_id,
    UPPER(NEW.plan_code),
    CASE 
      WHEN NEW.status = 'ACTIVE' THEN 'ACTIVE'
      WHEN NEW.status = 'TRIAL' THEN 'ACTIVE'
      ELSE 'EXPIRED'
    END,
    NEW.expiry_date,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (school_id, plan) DO UPDATE SET
    status = EXCLUDED.status,
    expiry_date = EXCLUDED.expiry_date,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_school_subscriptions ON public.subscriptions;
CREATE TRIGGER trigger_sync_school_subscriptions
AFTER INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION sync_school_subscriptions();
