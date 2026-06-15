-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: PAYMENT SETTINGS & FACULTY BANKING DETAILS
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create school_payment_settings Table
CREATE TABLE IF NOT EXISTS public.school_payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE UNIQUE,
    qr_code_url TEXT,
    upi_id TEXT,
    account_holder_name TEXT,
    bank_name TEXT,
    account_number TEXT, -- Stores AES-GCM encrypted account number
    ifsc_code TEXT,
    branch_name TEXT,
    swift_code TEXT,
    qr_payment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    bank_transfer_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    show_qr_to_parents BOOLEAN NOT NULL DEFAULT TRUE,
    show_bank_to_parents BOOLEAN NOT NULL DEFAULT TRUE,
    enable_utr_upload BOOLEAN NOT NULL DEFAULT TRUE,
    auto_remind_unpaid BOOLEAN NOT NULL DEFAULT FALSE,
    payment_instructions TEXT DEFAULT 'Please scan the QR code or use the bank details to make the payment. After payment, upload the payment proof with UTR number.',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.school_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all operations for school admins on settings" ON public.school_payment_settings;
DROP POLICY IF EXISTS "Enable select for parents on school settings" ON public.school_payment_settings;

-- RLS Policies
CREATE POLICY "Enable all operations for school admins on settings" ON public.school_payment_settings
    FOR ALL
    TO authenticated
    USING (
      school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()) 
      AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'FINANCE_ADMIN')
    )
    WITH CHECK (
      school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()) 
      AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'FINANCE_ADMIN')
    );

CREATE POLICY "Enable select for parents on school settings" ON public.school_payment_settings
    FOR SELECT
    TO authenticated
    USING (
      school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
      AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('PARENT', 'STUDENT')
    );

-- 2. Create faculty_payment_settings Table
CREATE TABLE IF NOT EXISTS public.faculty_payment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    qr_code_url TEXT,
    upi_id TEXT,
    bank_name TEXT,
    account_number TEXT, -- Stores AES-GCM encrypted account number
    ifsc_code TEXT,
    branch_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.faculty_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable own operations for faculty settings" ON public.faculty_payment_settings;
DROP POLICY IF EXISTS "Enable select for finance admin for payroll" ON public.faculty_payment_settings;

CREATE POLICY "Enable own operations for faculty settings" ON public.faculty_payment_settings
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable select for finance admin for payroll" ON public.faculty_payment_settings
    FOR SELECT
    TO authenticated
    USING (
      (SELECT role FROM public.users WHERE id = auth.uid()) IN ('FINANCE_ADMIN', 'SUPER_ADMIN')
    );

-- 3. Add parent proof columns to fee_payments table
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS utr_number TEXT;
ALTER TABLE public.fee_payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 4. Enable Realtime Replication
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.school_payment_settings;
    alter publication supabase_realtime add table public.faculty_payment_settings;
  end if;
exception
  when others then null;
end;
$$;
