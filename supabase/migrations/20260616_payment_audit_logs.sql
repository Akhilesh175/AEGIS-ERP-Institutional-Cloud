-- ============================================================
-- AEGIS ERP Payment Audit Logs & Schema Extension Migration
-- Created: 2026-06-16
-- ============================================================

-- 1. Create salary_payments Table (Idempotent Definition)
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

-- 2. Create employee_salary_ledger Table (Idempotent Definition)
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

-- 3. Create payment_audit_logs Table
CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id   UUID NOT NULL, -- references either fee_payment or salary_payment ID
  action       TEXT NOT NULL CHECK (action IN ('SUBMITTED', 'APPROVED', 'REJECTED')),
  performed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details      JSONB
);

-- Enable RLS on new tables
ALTER TABLE public.salary_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_audit_logs
DROP POLICY IF EXISTS "payment_audit_logs_select" ON public.payment_audit_logs;
CREATE POLICY "payment_audit_logs_select" ON public.payment_audit_logs 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
        AND users.role IN ('ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')
    )
  );

DROP POLICY IF EXISTS "payment_audit_logs_insert" ON public.payment_audit_logs;
CREATE POLICY "payment_audit_logs_insert" ON public.payment_audit_logs 
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Helper function to fetch user's school_id bypassing RLS (if not already created)
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- RLS Policies for salary_payments
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

-- RLS Policies for employee_salary_ledger
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

-- 4. Alter fee_payments safely to support additional audit/isolation fields
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

    -- approved_by
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fee_payments' AND column_name = 'approved_by'
    ) THEN
      ALTER TABLE public.fee_payments ADD COLUMN approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- approved_at
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fee_payments' AND column_name = 'approved_at'
    ) THEN
      ALTER TABLE public.fee_payments ADD COLUMN approved_at TIMESTAMPTZ;
    END IF;
  END IF;
END $$;

-- 5. Create Global UTR Unique Filtered Index on fee_payments
DROP INDEX IF EXISTS public.idx_fee_payments_utr_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_payments_utr_unique 
  ON public.fee_payments (utr_number) 
  WHERE utr_number IS NOT NULL;

-- 6. Define Realtime settings for new tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.salary_payments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_salary_ledger;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_audit_logs;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
