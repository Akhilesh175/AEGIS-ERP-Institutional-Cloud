-- Drop legacy tables if they exist to prevent conflict
DROP TABLE IF EXISTS public.sports_fee_payments CASCADE;
DROP TABLE IF EXISTS public.sports_fee_invoices CASCADE;

-- 1. Create sports_fee_invoices table
CREATE TABLE public.sports_fee_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sport_id UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  invoice_title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Custom' CHECK (category IN ('Registration Fee', 'Coaching Fee', 'Tournament Fee', 'Equipment Fee', 'Fine', 'Custom')),
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'PAID')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create sports_fee_payments table
CREATE TABLE public.sports_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.sports_fee_invoices(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  utr_number TEXT NOT NULL,
  proof_image_url TEXT NOT NULL,
  remarks TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (status IN ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT
);

-- 3. Enable RLS
ALTER TABLE public.sports_fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fee_payments ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
DROP POLICY IF EXISTS sports_fee_invoices_policy ON public.sports_fee_invoices;
CREATE POLICY sports_fee_invoices_policy ON public.sports_fee_invoices
  FOR ALL USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS sports_fee_payments_policy ON public.sports_fee_payments;
CREATE POLICY sports_fee_payments_policy ON public.sports_fee_payments
  FOR ALL USING (school_id = get_auth_user_school_id());

-- 5. Add tables to realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_fee_invoices;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_fee_payments;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fee_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fee_payments;
