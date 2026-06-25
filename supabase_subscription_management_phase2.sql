-- =====================================================================
-- AEGIS ERP: SUBSCRIPTION SYSTEM PHASE 2 MIGRATION
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS
-- =====================================================================

-- ─── 1. Alter subscription_plans table ────────────────────────────────
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS color_theme TEXT DEFAULT 'brand',
  ADD COLUMN IF NOT EXISTS max_students INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_teachers INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS max_parents INTEGER DEFAULT 200,
  ADD COLUMN IF NOT EXISTS max_storage_gb INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS notification_limits INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS has_ptm_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_transport_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_library_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_finance_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_hostel_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_analytics_access BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_coach_portal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS has_warden_portal BOOLEAN DEFAULT FALSE;

-- Update defaults for existing plan codes
UPDATE public.subscription_plans SET 
  display_order = 0, is_recommended = false, is_popular = false, color_theme = 'slate',
  max_students = 100, max_teachers = 10, max_parents = 200, max_storage_gb = 5, notification_limits = 1000,
  has_ptm_access = false, has_transport_access = false, has_library_access = false, 
  has_finance_access = false, has_hostel_access = false, has_analytics_access = false, 
  has_coach_portal = false, has_warden_portal = false
WHERE code = 'freemium';

UPDATE public.subscription_plans SET 
  display_order = 1, is_recommended = false, is_popular = false, color_theme = 'brand',
  max_students = 500, max_teachers = 50, max_parents = 1000, max_storage_gb = 20, notification_limits = 5000,
  has_ptm_access = false, has_transport_access = false, has_library_access = false, 
  has_finance_access = true, has_hostel_access = false, has_analytics_access = false, 
  has_coach_portal = false, has_warden_portal = false
WHERE code = 'basic';

UPDATE public.subscription_plans SET 
  display_order = 2, is_recommended = true, is_popular = true, color_theme = 'indigo',
  max_students = 1000, max_teachers = 100, max_parents = 2000, max_storage_gb = 50, notification_limits = 10000,
  has_ptm_access = true, has_transport_access = true, has_library_access = true, 
  has_finance_access = true, has_hostel_access = true, has_analytics_access = true, 
  has_coach_portal = false, has_warden_portal = false
WHERE code = 'pro';

UPDATE public.subscription_plans SET 
  display_order = 3, is_recommended = false, is_popular = false, color_theme = 'purple',
  max_students = 9999999, max_teachers = 999999, max_parents = 9999999, max_storage_gb = 500, notification_limits = 9999999,
  has_ptm_access = true, has_transport_access = true, has_library_access = true, 
  has_finance_access = true, has_hostel_access = true, has_analytics_access = true, 
  has_coach_portal = true, has_warden_portal = true
WHERE code = 'enterprise';

-- ─── 2. Create subscription_discounts table ──────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_discounts (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              UUID         NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan_code              TEXT         NOT NULL,
  monthly_price_override NUMERIC,
  yearly_price_override  NUMERIC,
  discount_percent       NUMERIC,
  discount_amount        NUMERIC,
  reason                 TEXT,
  start_date             DATE,
  expiry_date            DATE,
  created_by             UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at             TIMESTAMPTZ  DEFAULT NOW(),
  is_active              BOOLEAN      DEFAULT TRUE
);

-- Enable RLS and define policies
ALTER TABLE public.subscription_discounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Discounts select policy" ON public.subscription_discounts;
CREATE POLICY "Discounts select policy" ON public.subscription_discounts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Discounts write policy" ON public.subscription_discounts;
CREATE POLICY "Discounts write policy" ON public.subscription_discounts
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 3. Create subscription_coupons table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_coupons (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT         NOT NULL UNIQUE,
  discount_percent   NUMERIC,
  discount_amount    NUMERIC,
  applicable_plans   TEXT[],      -- e.g. ARRAY['pro', 'enterprise']
  applicable_schools UUID[],      -- ARRAY of school IDs (empty/null = all)
  max_uses           INTEGER,
  current_uses       INTEGER      DEFAULT 0,
  expiry_date        DATE,
  is_active          BOOLEAN      DEFAULT TRUE,
  created_by         UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  DEFAULT NOW()
);

-- Enable RLS and define policies
ALTER TABLE public.subscription_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coupons select policy" ON public.subscription_coupons;
CREATE POLICY "Coupons select policy" ON public.subscription_coupons
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Coupons write policy" ON public.subscription_coupons;
CREATE POLICY "Coupons write policy" ON public.subscription_coupons
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 4. Create subscription_notifications table ──────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_notifications (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID         NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  notification_type TEXT         NOT NULL, -- EMAIL, PUSH, BANNER, IN_APP
  reminder_level    TEXT         NOT NULL, -- 30_DAYS, 15_DAYS, 7_DAYS, 3_DAYS, 1_DAY, EXPIRY_DAY, GRACE_PERIOD
  sent_at           TIMESTAMPTZ  DEFAULT NOW(),
  status            TEXT         NOT NULL DEFAULT 'SENT', -- SENT, FAILED
  payload           JSONB
);

-- Enable RLS and define policies
ALTER TABLE public.subscription_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications select policy" ON public.subscription_notifications;
CREATE POLICY "Notifications select policy" ON public.subscription_notifications
  FOR SELECT TO authenticated USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Notifications write policy" ON public.subscription_notifications;
CREATE POLICY "Notifications write policy" ON public.subscription_notifications
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 5. Create subscription_revenue table ────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_revenue (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_date  DATE         NOT NULL UNIQUE,
  monthly_revenue NUMERIC     DEFAULT 0,
  yearly_revenue NUMERIC      DEFAULT 0,
  gst_collected  NUMERIC      DEFAULT 0,
  discounts_given NUMERIC     DEFAULT 0,
  active_schools INTEGER      DEFAULT 0
);

-- Enable RLS and define policies
ALTER TABLE public.subscription_revenue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Revenue select policy" ON public.subscription_revenue;
CREATE POLICY "Revenue select policy" ON public.subscription_revenue
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Revenue write policy" ON public.subscription_revenue;
CREATE POLICY "Revenue write policy" ON public.subscription_revenue
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 6. Alter subscription_invoices table ────────────────────────────
ALTER TABLE public.subscription_invoices
  ADD COLUMN IF NOT EXISTS plan_code TEXT,
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_paid NUMERIC,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ─── 7. Enable Realtime ──────────────────────────────────────────────
ALTER TABLE public.subscription_plans REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_discounts REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_coupons REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_revenue REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_invoices REPLICA IDENTITY FULL;

-- Add triggers or configurations for publishing realtime
-- (All alter tables should enable replica identity full to publish updates via Supabase realtime channels)
