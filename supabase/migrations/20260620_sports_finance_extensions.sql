-- =====================================================================
-- SPORTS FINANCE EXTENSIONS MIGRATION
-- Author: Antigravity
-- Created: 2026-06-20
-- =====================================================================

-- 1. Alter sports_budget_allocations to add created_by
ALTER TABLE public.sports_budget_allocations ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Create sports_budget_history Table
CREATE TABLE IF NOT EXISTS public.sports_budget_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES public.sports_budget_allocations(id) ON DELETE CASCADE,
  old_amount DECIMAL(12,2) NOT NULL,
  new_amount DECIMAL(12,2) NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create sports_expense_requests Table
CREATE TABLE IF NOT EXISTS public.sports_expense_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  vendor_name TEXT,
  invoice_number TEXT,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'RELEASED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create sports_fine_payments Table
CREATE TABLE IF NOT EXISTS public.sports_fine_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  reason TEXT NOT NULL,
  utr_number TEXT,
  proof_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Alter sports_fee_payments to add columns if they do not exist
ALTER TABLE public.sports_fee_payments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.sports_fee_payments ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.sports_fee_payments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sports_fee_payments ADD COLUMN IF NOT EXISTS remarks TEXT;

-- ---------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
ALTER TABLE public.sports_budget_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fine_payments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- RLS POLICIES (SCHOOL ISOLATION)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "sports_budget_history_policy" ON public.sports_budget_history;
CREATE POLICY "sports_budget_history_policy" ON public.sports_budget_history
  FOR ALL USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "sports_expense_requests_policy" ON public.sports_expense_requests;
CREATE POLICY "sports_expense_requests_policy" ON public.sports_expense_requests
  FOR ALL USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "sports_fine_payments_policy" ON public.sports_fine_payments;
CREATE POLICY "sports_fine_payments_policy" ON public.sports_fine_payments
  FOR ALL USING (school_id = get_auth_user_school_id());

-- ---------------------------------------------------------------------
-- ENABLE SUPABASE REALTIME FOR NEW TABLES
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_budget_history;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_expense_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fine_payments;
  END IF;
END $$;
