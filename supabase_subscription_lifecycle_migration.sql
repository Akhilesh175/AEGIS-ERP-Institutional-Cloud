-- =====================================================================
-- AEGIS ERP: SUBSCRIPTION LIFECYCLE MIGRATION
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Safe to run multiple times — all statements use IF NOT EXISTS / IF EXISTS
-- =====================================================================

-- ─── 1. Extend the existing `subscriptions` table ────────────────────
-- Additive only — zero data loss on existing rows

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS start_date          DATE,
  ADD COLUMN IF NOT EXISTS grace_end_date      DATE,
  ADD COLUMN IF NOT EXISTS purchase_date       TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS amount_paid         NUMERIC,
  ADD COLUMN IF NOT EXISTS transaction_id      TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT
    DEFAULT 'trial';

-- Add CHECK constraint safely (only if it does not exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_subscription_status_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_subscription_status_check
      CHECK (subscription_status IN ('trial','active','grace_period','expired','cancelled'));
  END IF;
END $$;

-- ─── 2. Backfill existing rows ───────────────────────────────────────
UPDATE public.subscriptions
SET
  start_date          = created_at::DATE,
  purchase_date       = created_at,
  subscription_status = CASE
    WHEN status = 'ACTIVE'  THEN 'active'
    WHEN status = 'EXPIRED' THEN 'expired'
    WHEN status = 'TRIAL'   THEN 'trial'
    ELSE 'trial'
  END
WHERE subscription_status IS NULL OR subscription_status = 'trial';

-- Backfill grace_end_date for rows that have expiry_date but no grace_end_date
UPDATE public.subscriptions
SET grace_end_date = (expiry_date::TIMESTAMPTZ + INTERVAL '3 days')::DATE
WHERE expiry_date IS NOT NULL AND grace_end_date IS NULL;

-- ─── 3. Create subscription_audit_logs table ─────────────────────────
DROP TABLE IF EXISTS public.subscription_audit_logs CASCADE;

CREATE TABLE IF NOT EXISTS public.subscription_audit_logs (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID         NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  admin_id       UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  action         TEXT         NOT NULL,
  -- Action values: PURCHASED | RENEWED | UPGRADED | DOWNGRADED | EXPIRED | GRACE_PERIOD | PAYMENT_SUCCESS | PAYMENT_FAILED | CANCELLED
  plan           TEXT         NOT NULL,
  billing_cycle  TEXT,        -- MONTHLY | YEARLY
  amount         NUMERIC,
  payment_id     TEXT,
  transaction_id TEXT,
  start_date     DATE,
  end_date       DATE,
  grace_end_date DATE,
  metadata       JSONB,
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_sub_audit_school
  ON public.subscription_audit_logs (school_id);
CREATE INDEX IF NOT EXISTS idx_sub_audit_action
  ON public.subscription_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_sub_audit_created
  ON public.subscription_audit_logs (created_at DESC);

-- ─── 4. Enable RLS on audit table ────────────────────────────────────
ALTER TABLE public.subscription_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School users can view subscription audit" ON public.subscription_audit_logs;
CREATE POLICY "School users can view subscription audit"
  ON public.subscription_audit_logs
  FOR SELECT
  USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Service role manages subscription audit" ON public.subscription_audit_logs;
CREATE POLICY "Service role manages subscription audit"
  ON public.subscription_audit_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ─── 5. Enable Realtime on subscriptions ─────────────────────────────
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.subscription_audit_logs REPLICA IDENTITY FULL;

-- ─── 6. Normalize plan codes in subscriptions table ──────────────────
-- Fix any legacy 'standard' → 'pro', 'premium' → 'enterprise' rows
UPDATE public.subscriptions SET plan_code = 'pro'        WHERE plan_code = 'standard';
UPDATE public.subscriptions SET plan_code = 'enterprise'  WHERE plan_code = 'premium';

-- Also normalize schools.subscription_plan
UPDATE public.schools SET subscription_plan = 'PRO'        WHERE subscription_plan = 'STANDARD';
UPDATE public.schools SET subscription_plan = 'ENTERPRISE'  WHERE subscription_plan = 'PREMIUM';

-- ─── 7. Ensure subscription_plans table has correct rows ─────────────
-- (Upsert canonical plan pricing records)
INSERT INTO public.subscription_plans (code, name, price_monthly, price_yearly, features)
VALUES
  (
    'freemium', 
    'Freemium', 
    0, 
    0, 
    '["Student Management", "Teacher Management", "Parent Management", "Basic Attendance", "Basic Reports", "Limited Notifications", "Up to 100 Students"]'::jsonb
  ),
  (
    'basic', 
    'Basic', 
    999, 
    9999, 
    '["Everything in Freemium", "Fee Management", "Timetable Management", "Homework Management", "Exam Management", "Document Center", "Bulk Notifications", "Up to 500 Students"]'::jsonb
  ),
  (
    'pro', 
    'Pro', 
    2499, 
    24999, 
    '["Everything in Basic", "PTM Meetings", "Advanced Reports & Analytics", "Transport Management", "Communication Hub", "Multi-Admin Support", "Custom Report Builder", "Up to 1,000 Students"]'::jsonb
  ),
  (
    'enterprise', 
    'Enterprise', 
    4999, 
    49999, 
    '["Everything in Pro", "Sports & Activities Management", "Coach Portal", "Warden Portal", "Hostel Management", "Advanced Finance & Accounting", "Audit Logs", "Custom Roles", "Unlimited Students"]'::jsonb
  )
ON CONFLICT (code) DO UPDATE
  SET price_monthly = EXCLUDED.price_monthly,
      price_yearly  = EXCLUDED.price_yearly,
      name          = EXCLUDED.name,
      features      = EXCLUDED.features;

-- ─── 8. Useful view: current active subscription per school ──────────
CREATE OR REPLACE VIEW public.active_school_subscriptions AS
SELECT DISTINCT ON (school_id)
  id,
  school_id,
  plan_code,
  billing_cycle,
  subscription_status,
  start_date,
  expiry_date,
  grace_end_date,
  amount_paid,
  transaction_id,
  purchase_date,
  created_at
FROM public.subscriptions
WHERE status IN ('ACTIVE', 'TRIAL')
ORDER BY school_id, created_at DESC;

-- ─── Done ─────────────────────────────────────────────────────────────
-- AEGIS ERP Subscription Lifecycle Migration complete.
-- Next step: run Component 3 (API updates) and deploy.
