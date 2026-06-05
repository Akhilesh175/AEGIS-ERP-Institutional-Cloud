-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: CREATE SCHOOL SUBSCRIPTIONS TABLE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.school_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plan TEXT NOT NULL, -- 'ENTERPRISE', 'PRO', 'BASIC', etc.
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')),
  expiry_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT school_sub_uniq UNIQUE (school_id, plan)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_school ON public.school_subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_school_subscriptions_plan_status ON public.school_subscriptions(plan, status);

-- Enable RLS
ALTER TABLE public.school_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view school subscriptions" ON public.school_subscriptions;
DROP POLICY IF EXISTS "Admins can manage school subscriptions" ON public.school_subscriptions;

-- RLS Policies
CREATE POLICY "Users can view school subscriptions" ON public.school_subscriptions 
  FOR SELECT USING (school_id = get_auth_user_school_id());

CREATE POLICY "Admins can manage school subscriptions" ON public.school_subscriptions 
  FOR ALL USING (school_id = get_auth_user_school_id());
