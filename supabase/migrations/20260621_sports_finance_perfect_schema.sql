-- =====================================================================
-- SPORTS FINANCE MODULE — PERFECT SCHEMA ALIGNMENT MIGRATION
-- Author: Antigravity
-- Created: 2026-06-21
-- =====================================================================

-- Drop legacy/temporary tables to prevent conflict
DROP TABLE IF EXISTS public.sports_fee_payments CASCADE;
DROP TABLE IF EXISTS public.sports_invoices CASCADE;
DROP TABLE IF EXISTS public.sports_budget_history CASCADE;
DROP TABLE IF EXISTS public.sports_expense_requests CASCADE;
DROP TABLE IF EXISTS public.sports_salary_requests CASCADE;
DROP TABLE IF EXISTS public.sports_salary_records CASCADE;
DROP TABLE IF EXISTS public.sports_fine_payments CASCADE;

-- 1. Create sports_invoices table
CREATE TABLE public.sports_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  late_fee DECIMAL(12,2) DEFAULT 0.00,
  due_date DATE NOT NULL,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'CANCELLED')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create sports_fee_payments table
CREATE TABLE public.sports_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.sports_invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  utr_number TEXT NOT NULL,
  proof_image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED')),
  submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- 3. Create sports_budget_history table
CREATE TABLE public.sports_budget_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  old_amount DECIMAL(12,2) NOT NULL,
  new_amount DECIMAL(12,2) NOT NULL,
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create sports_expense_requests table
CREATE TABLE public.sports_expense_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  invoice_id TEXT,
  amount DECIMAL(12,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'RELEASED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- 5. Create sports_salary_requests table
CREATE TABLE public.sports_salary_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  employee_type TEXT CHECK (employee_type IN ('COACH', 'ADMIN')),
  salary_month TEXT NOT NULL,
  gross_salary DECIMAL(12,2) NOT NULL,
  bonus DECIMAL(12,2) DEFAULT 0.00,
  deductions DECIMAL(12,2) DEFAULT 0.00,
  net_salary DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'PAID')),
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  transaction_id TEXT,
  payment_date TIMESTAMP WITH TIME ZONE
);

-- 6. Create sports_fine_payments table
CREATE TABLE public.sports_fine_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  utr_reference TEXT NOT NULL,
  proof_image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- 7. Enable RLS on all tables
ALTER TABLE public.sports_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_budget_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_expense_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_salary_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fine_payments ENABLE ROW LEVEL SECURITY;

-- Helper functions for parent & student access verification (using CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION public.is_parent_linked_to_student(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.parent_student_mapping m ON p.id = m.parent_id
    WHERE p.user_id = auth.uid() AND m.student_id = p_student_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_student_self(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid() AND s.id = p_student_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Drop previous policies to avoid duplication errors
DROP POLICY IF EXISTS sports_invoices_policy ON public.sports_invoices;
DROP POLICY IF EXISTS sports_fee_payments_policy ON public.sports_fee_payments;
DROP POLICY IF EXISTS sports_budget_history_policy ON public.sports_budget_history;
DROP POLICY IF EXISTS sports_expense_requests_policy ON public.sports_expense_requests;
DROP POLICY IF EXISTS sports_salary_requests_policy ON public.sports_salary_requests;
DROP POLICY IF EXISTS sports_fine_payments_policy ON public.sports_fine_payments;

-- 8. Add basic RLS policies allowing school isolation checks
CREATE POLICY sports_invoices_policy ON public.sports_invoices
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY sports_fee_payments_policy ON public.sports_fee_payments
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY sports_budget_history_policy ON public.sports_budget_history
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY sports_expense_requests_policy ON public.sports_expense_requests
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY sports_salary_requests_policy ON public.sports_salary_requests
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY sports_fine_payments_policy ON public.sports_fine_payments
  FOR ALL USING (school_id = get_auth_user_school_id());

-- 9. Add tables to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_invoices;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_fee_payments;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_budget_history;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_expense_requests;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_salary_requests;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_fine_payments;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fee_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_budget_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_expense_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_salary_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fine_payments;

-- 10. Register bucket policies if not set up
INSERT INTO storage.buckets (id, name, public)
VALUES ('sports-payment-proofs', 'sports-payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS sports_proof_upload ON storage.objects;
CREATE POLICY sports_proof_upload ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'sports-payment-proofs' AND
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS sports_proof_select ON storage.objects;
CREATE POLICY sports_proof_select ON storage.objects
  FOR SELECT USING (
    bucket_id = 'sports-payment-proofs' AND
    auth.role() = 'authenticated'
  );
