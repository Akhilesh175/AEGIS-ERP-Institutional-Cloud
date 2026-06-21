-- =====================================================================
-- SPORTS MANAGEMENT ERP — SPORTS INVOICE MANAGEMENT SYSTEM MIGRATION
-- Author: Antigravity
-- Created: 2026-06-20
-- =====================================================================

-- 1. Create sports_invoices table
CREATE TABLE IF NOT EXISTS public.sports_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_title TEXT NOT NULL,
  invoice_description TEXT,
  invoice_category TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  late_fee DECIMAL(12,2) DEFAULT 0.00,
  remarks TEXT,
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'CANCELLED')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Drop legacy sports_fee_payments
DROP TABLE IF EXISTS public.sports_fee_payments CASCADE;

-- 3. Create sports_fee_payments
CREATE TABLE public.sports_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.sports_invoices(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  utr_number TEXT NOT NULL,
  proof_image_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMP WITH TIME ZONE,
  remarks TEXT,
  rejection_reason TEXT
);

-- 4. Enable RLS on tables
ALTER TABLE public.sports_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fee_payments ENABLE ROW LEVEL SECURITY;

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

-- Drop duplicate policies if they exist to prevent errors during execution
DROP POLICY IF EXISTS sports_invoices_select ON public.sports_invoices;
DROP POLICY IF EXISTS sports_invoices_insert ON public.sports_invoices;
DROP POLICY IF EXISTS sports_invoices_update ON public.sports_invoices;
DROP POLICY IF EXISTS sports_invoices_delete ON public.sports_invoices;

DROP POLICY IF EXISTS sports_fee_payments_select ON public.sports_fee_payments;
DROP POLICY IF EXISTS sports_fee_payments_insert ON public.sports_fee_payments;
DROP POLICY IF EXISTS sports_fee_payments_update ON public.sports_fee_payments;
DROP POLICY IF EXISTS sports_fee_payments_delete ON public.sports_fee_payments;

-- 5. Policies for sports_invoices
CREATE POLICY sports_invoices_select ON public.sports_invoices
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY sports_invoices_insert ON public.sports_invoices
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  );

CREATE POLICY sports_invoices_update ON public.sports_invoices
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  );

CREATE POLICY sports_invoices_delete ON public.sports_invoices
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  );

-- 6. Policies for sports_fee_payments
CREATE POLICY sports_fee_payments_select ON public.sports_fee_payments
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY sports_fee_payments_insert ON public.sports_fee_payments
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY sports_fee_payments_update ON public.sports_fee_payments
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN')
  );

CREATE POLICY sports_fee_payments_delete ON public.sports_fee_payments
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN')
  );

-- 7. Add tables to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_invoices;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_fee_payments;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fee_payments;

-- 8. Register and secure sports-payment-proofs bucket
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
