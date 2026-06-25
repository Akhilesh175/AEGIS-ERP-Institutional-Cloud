-- =====================================================================
-- AEGIS ERP: SUPER ADMIN COUPON MANAGEMENT SYSTEM MIGRATION
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS
-- =====================================================================

-- ─── 1. Alter subscription_coupons table ──────────────────────────────
ALTER TABLE public.subscription_coupons
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'PERCENTAGE', -- 'PERCENTAGE' or 'FIXED'
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_discount NUMERIC,
  ADD COLUMN IF NOT EXISTS min_purchase NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_user_redemption INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE', 'EXPIRED', 'SCHEDULED', 'DISABLED'
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'indigo',
  ADD COLUMN IF NOT EXISTS tag TEXT,
  ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS activation_date DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS audit_log_ref TEXT;

-- ─── 2. Create subscription_coupon_usages table ───────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_coupon_usages (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id           UUID         NOT NULL REFERENCES public.subscription_coupons(id) ON DELETE CASCADE,
  school_id           UUID         NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id             UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  redeemed_at         TIMESTAMPTZ  DEFAULT NOW(),
  transaction_id      TEXT,
  subscription_id     UUID,
  plan_code           TEXT,
  discount_amount     NUMERIC,
  payment_status      TEXT         DEFAULT 'SUCCESS'
);

-- Enable RLS and define policies for usages
ALTER TABLE public.subscription_coupon_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usages select policy" ON public.subscription_coupon_usages;
CREATE POLICY "Usages select policy" ON public.subscription_coupon_usages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usages write policy" ON public.subscription_coupon_usages;
CREATE POLICY "Usages write policy" ON public.subscription_coupon_usages
  FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime sync for usages
ALTER TABLE public.subscription_coupon_usages REPLICA IDENTITY FULL;

-- ─── 3. Populate defaults for backward compatibility ──────────────────
UPDATE public.subscription_coupons SET
  name = COALESCE(name, 'Promo Campaign ' || code),
  discount_type = CASE WHEN discount_percent IS NOT NULL THEN 'PERCENTAGE' ELSE 'FIXED' END,
  discount_value = COALESCE(discount_percent, discount_amount, 0),
  status = CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END
WHERE name IS NULL;
