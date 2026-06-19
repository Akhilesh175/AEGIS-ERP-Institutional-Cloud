-- =====================================================================
-- SPORTS & PHYSICAL ACTIVITIES ERP SYSTEM — RBAC & FINANCE MIGRATION
-- Author: Antigravity
-- Created: 2026-06-19
-- =====================================================================

-- 1. Create or Alter sports_coaches Table with requested columns
CREATE TABLE IF NOT EXISTS public.sports_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  specialization TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alter sports_coaches Table to add the new columns if they do not exist
ALTER TABLE public.sports_coaches ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.sports_coaches ADD COLUMN IF NOT EXISTS coach_name TEXT;
ALTER TABLE public.sports_coaches ADD COLUMN IF NOT EXISTS experience_years INTEGER DEFAULT 0;
ALTER TABLE public.sports_coaches ADD COLUMN IF NOT EXISTS certification TEXT;
ALTER TABLE public.sports_coaches ADD COLUMN IF NOT EXISTS salary DECIMAL(12,2) NOT NULL DEFAULT 0.00;

-- Populate coach_name from users for existing rows where it's NULL
UPDATE public.sports_coaches c
SET coach_name = COALESCE(u.first_name || ' ' || u.last_name, 'Coach')
FROM public.users u
WHERE c.user_id = u.id AND c.coach_name IS NULL;

-- Now apply NOT NULL constraint to coach_name
ALTER TABLE public.sports_coaches ALTER COLUMN coach_name SET NOT NULL;

-- Drop foreign keys if they exist, then recreate to ensure name and policy match
ALTER TABLE public.sports_teams DROP CONSTRAINT IF EXISTS sports_teams_coach_id_fkey;
ALTER TABLE public.sports_teams DROP CONSTRAINT IF EXISTS fk_sports_teams_coach;
ALTER TABLE public.sports_teams ADD CONSTRAINT fk_sports_teams_coach FOREIGN KEY (coach_id) REFERENCES public.sports_coaches(id) ON DELETE SET NULL;

ALTER TABLE public.sports_training_sessions DROP CONSTRAINT IF EXISTS sports_training_sessions_coach_id_fkey;
ALTER TABLE public.sports_training_sessions DROP CONSTRAINT IF EXISTS fk_sports_training_sessions_coach;
ALTER TABLE public.sports_training_sessions ADD CONSTRAINT fk_sports_training_sessions_coach FOREIGN KEY (coach_id) REFERENCES public.sports_coaches(id) ON DELETE SET NULL;

ALTER TABLE public.sports_performance_metrics DROP CONSTRAINT IF EXISTS sports_performance_metrics_coach_id_fkey;
ALTER TABLE public.sports_performance_metrics DROP CONSTRAINT IF EXISTS fk_sports_performance_metrics_coach;
ALTER TABLE public.sports_performance_metrics ADD CONSTRAINT fk_sports_performance_metrics_coach FOREIGN KEY (coach_id) REFERENCES public.sports_coaches(id) ON DELETE SET NULL;

-- Drop activity logs table which is non-referenced log table
DROP TABLE IF EXISTS public.sports_activity_logs CASCADE;

-- 2. Create sports_admins Table
CREATE TABLE IF NOT EXISTS public.sports_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  employee_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create sports_finance_transactions (Centralized ledger)
CREATE TABLE IF NOT EXISTS public.sports_finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('REVENUE', 'EXPENSE')),
  category TEXT NOT NULL CHECK (category IN ('FEE_PAYMENT', 'EQUIPMENT_PURCHASE', 'SALARY_PAYOUT', 'TOURNAMENT_EXPENSE', 'FINE', 'OTHER')),
  amount DECIMAL(12,2) NOT NULL,
  reference_id UUID NOT NULL,
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create sports_salary_records (Payroll system)
CREATE TABLE IF NOT EXISTS public.sports_salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  employee_role TEXT NOT NULL CHECK (employee_role IN ('SPORTS_ADMIN', 'COACH')),
  amount DECIMAL(12,2) NOT NULL,
  bonus DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  month TEXT NOT NULL, -- Format: YYYY-MM
  status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (status IN ('GENERATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  payment_date TIMESTAMP WITH TIME ZONE,
  transaction_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create sports_budget_allocations
CREATE TABLE IF NOT EXISTS public.sports_budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(12,2) NOT NULL,
  spent_amount DECIMAL(12,2) DEFAULT 0.00,
  category TEXT NOT NULL CHECK (category IN ('EQUIPMENT', 'TOURNAMENT', 'SALARY', 'TRAVEL', 'OTHER')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uniq_school_session_cat UNIQUE (school_id, academic_session_id, category)
);

-- 6. Create sports_expenses (Equipment & Tournament Purchase Requests)
CREATE TABLE IF NOT EXISTS public.sports_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('EQUIPMENT_PURCHASE', 'TOURNAMENT_EXPENSE', 'OTHER')),
  title TEXT NOT NULL,
  description TEXT,
  amount_requested DECIMAL(12,2) NOT NULL,
  amount_approved DECIMAL(12,2),
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  vendor TEXT,
  invoice_number TEXT,
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'RELEASED')),
  reference_id UUID, -- Links to sports_equipment.id or sports_tournaments.id if relevant
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create sports_fines
CREATE TABLE IF NOT EXISTS public.sports_fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID')),
  due_date DATE NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE,
  utr_number TEXT,
  payment_screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create sports_activity_logs (Audit Trails)
CREATE TABLE public.sports_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  affected_record TEXT,
  ip_address TEXT,
  device TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helper function to fetch current user's school_id (bypass RLS)
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Drop check constraint on users role if it exists to allow SPORTS_ADMIN
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS check_user_role;
  ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_role_check_val;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sports_admins_school ON public.sports_admins(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_admins_user ON public.sports_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_sports_coaches_school ON public.sports_coaches(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_coaches_user ON public.sports_coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_sports_fin_tx_school ON public.sports_finance_transactions(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_sal_rec_school ON public.sports_salary_records(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_bud_all_school ON public.sports_budget_allocations(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_exp_school ON public.sports_expenses(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_fines_school ON public.sports_fines(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_act_logs_school ON public.sports_activity_logs(school_id);

-- ---------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
ALTER TABLE public.sports_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_budget_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop policies if exist to prevent errors on re-run
DROP POLICY IF EXISTS "sports_admins_policy" ON public.sports_admins;
DROP POLICY IF EXISTS "sports_coaches_policy" ON public.sports_coaches;
DROP POLICY IF EXISTS "sports_finance_transactions_policy" ON public.sports_finance_transactions;
DROP POLICY IF EXISTS "sports_salary_records_policy" ON public.sports_salary_records;
DROP POLICY IF EXISTS "sports_budget_allocations_policy" ON public.sports_budget_allocations;
DROP POLICY IF EXISTS "sports_expenses_policy" ON public.sports_expenses;
DROP POLICY IF EXISTS "sports_fines_policy" ON public.sports_fines;
DROP POLICY IF EXISTS "sports_activity_logs_policy" ON public.sports_activity_logs;

-- Re-create Unified Policies that enforce school isolation
CREATE POLICY "sports_admins_policy" ON public.sports_admins
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_coaches_policy" ON public.sports_coaches
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_finance_transactions_policy" ON public.sports_finance_transactions
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_salary_records_policy" ON public.sports_salary_records
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_budget_allocations_policy" ON public.sports_budget_allocations
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_expenses_policy" ON public.sports_expenses
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_fines_policy" ON public.sports_fines
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_activity_logs_policy" ON public.sports_activity_logs
  FOR ALL USING (school_id = get_auth_user_school_id());

-- ---------------------------------------------------------------------
-- ENABLE SUPABASE REALTIME
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_admins;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_coaches;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_finance_transactions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_salary_records;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_budget_allocations;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_expenses;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fines;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_activity_logs;
  END IF;
END $$;
