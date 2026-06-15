-- ============================================================
-- AEGIS ERP Final Production-Grade Payment System Migration
-- Created: 2026-06-15
-- ============================================================

-- 1. Alter fee_payments safely to support additional audit/isolation fields
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fee_payments'
  ) THEN
    -- invoice_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fee_payments' AND column_name = 'invoice_id'
    ) THEN
      ALTER TABLE public.fee_payments ADD COLUMN invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;
    END IF;

    -- parent_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fee_payments' AND column_name = 'parent_id'
    ) THEN
      ALTER TABLE public.fee_payments ADD COLUMN parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- school_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fee_payments' AND column_name = 'school_id'
    ) THEN
      ALTER TABLE public.fee_payments ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
    END IF;

    -- amount
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fee_payments' AND column_name = 'amount'
    ) THEN
      ALTER TABLE public.fee_payments ADD COLUMN amount NUMERIC;
    END IF;

    -- submitted_at
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fee_payments' AND column_name = 'submitted_at'
    ) THEN
      ALTER TABLE public.fee_payments ADD COLUMN submitted_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- 2. Create Global UTR Unique Filtered Index on fee_payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_utr_unique 
  ON public.fee_payments (utr_number) 
  WHERE utr_number IS NOT NULL;

-- 3. Create salary_payments Table
CREATE TABLE IF NOT EXISTS public.salary_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  utr_number TEXT NOT NULL,
  payment_screenshot_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason TEXT,
  rejected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT salary_payments_utr_unique UNIQUE (utr_number)
);

-- 4. Create employee_salary_ledger Table
CREATE TABLE IF NOT EXISTS public.employee_salary_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  salary_payment_id UUID NOT NULL REFERENCES public.salary_payments(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMPTZ NOT NULL,
  utr_number TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_salary_ledger_payment_unique UNIQUE (salary_payment_id)
);

-- 5. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_ledger ENABLE ROW LEVEL SECURITY;

-- 6. Helper function to fetch user's school_id bypassing RLS (if not already created)
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 7. Define RLS Policies for salary_payments
DROP POLICY IF EXISTS "salary_payments_select" ON public.salary_payments;
CREATE POLICY "salary_payments_select" ON public.salary_payments 
  FOR SELECT USING (
    employee_id = auth.uid() OR school_id = get_auth_user_school_id()
  );

DROP POLICY IF EXISTS "salary_payments_all_admin" ON public.salary_payments;
CREATE POLICY "salary_payments_all_admin" ON public.salary_payments 
  FOR ALL USING (
    school_id = get_auth_user_school_id() AND EXISTS (
      SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'FINANCE_ADMIN')
    )
  );

-- 8. Define RLS Policies for employee_salary_ledger
DROP POLICY IF EXISTS "employee_salary_ledger_select" ON public.employee_salary_ledger;
CREATE POLICY "employee_salary_ledger_select" ON public.employee_salary_ledger 
  FOR SELECT USING (
    employee_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('ADMIN', 'FINANCE_ADMIN') 
        AND users.school_id = (SELECT school_id FROM public.users WHERE users.id = employee_salary_ledger.employee_id)
    )
  );

DROP POLICY IF EXISTS "employee_salary_ledger_all_admin" ON public.employee_salary_ledger;
CREATE POLICY "employee_salary_ledger_all_admin" ON public.employee_salary_ledger 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('ADMIN', 'FINANCE_ADMIN') 
        AND users.school_id = (SELECT school_id FROM public.users WHERE users.id = employee_salary_ledger.employee_id)
    )
  );

-- 9. Realtime Publication settings
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_payments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_salary_ledger;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
