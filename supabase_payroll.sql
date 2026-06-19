-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: PAYROLL MANAGEMENT & DRIVER IDENTITY MIGRATION
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Add employee_id column to drivers table
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS employee_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_emp_school 
  ON public.drivers (school_id, employee_id) WHERE employee_id IS NOT NULL;

-- 2. Add snapshot columns to driver_salary_payouts table
ALTER TABLE public.driver_salary_payouts ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE public.driver_salary_payouts ADD COLUMN IF NOT EXISTS driver_employee_id TEXT;
ALTER TABLE public.driver_salary_payouts ADD COLUMN IF NOT EXISTS driver_license_number TEXT;
ALTER TABLE public.driver_salary_payouts ADD COLUMN IF NOT EXISTS driver_phone TEXT;

-- 3. Create payroll_records Table for Teachers and Staff
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    employee_type VARCHAR(50) NOT NULL, -- 'TEACHER' or 'STAFF'
    employee_role VARCHAR(100) NOT NULL, -- e.g., 'TEACHER', 'ACCOUNTANT', 'CLERK', 'LIBRARIAN', etc.
    employee_name VARCHAR(255) NOT NULL,
    employee_id_number VARCHAR(100),
    employee_phone VARCHAR(50),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- link to system user if exists
    payout_month VARCHAR(50) NOT NULL, -- e.g., 'June 2026' or '2026-06'
    base_salary NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    allowances NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    deductions NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    net_salary NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payout_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'PAID', 'CANCELLED', 'REVERSED'
    payout_date TIMESTAMPTZ,
    paid_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    transaction_reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ, -- for soft-delete support
    currency_code VARCHAR(10) NOT NULL DEFAULT 'USD',
    currency_symbol VARCHAR(10) NOT NULL DEFAULT '$'
);

-- Enable Row Level Security (RLS) on payroll_records
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent duplication
DROP POLICY IF EXISTS "Enable all operations for school members" ON public.payroll_records;

-- Create school-scoped tenant isolation policy
CREATE POLICY "Enable all operations for school members" ON public.payroll_records
    FOR ALL
    TO authenticated
    USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));

-- Enable full realtime replication for WebSocket updates
ALTER TABLE public.payroll_records REPLICA IDENTITY FULL;

-- Ensure table is added to the real-time publication registry if exists
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.payroll_records;
  end if;
exception
  when others then null;
end;
$$;

-- =====================================================================
-- 4. DRIVER IDENTITY BACKFILL (Run ONCE to fix all historical records)
--
-- Backfills all driver_salary_payouts rows where driver snapshot columns
-- are NULL by joining with the drivers table. This permanently resolves
-- the "Unknown Driver" display for all legacy payroll records.
-- After running this, every historical payout will retain driver identity
-- even if the driver is later deleted or deactivated.
-- =====================================================================
UPDATE public.driver_salary_payouts AS p
SET
    driver_name           = d.name,
    driver_employee_id    = d.employee_id,
    driver_license_number = d.license_number,
    driver_phone          = d.phone,
    updated_at            = NOW()
FROM public.drivers AS d
WHERE p.driver_id = d.id
  AND (
    p.driver_name IS NULL OR
    p.driver_employee_id IS NULL OR
    p.driver_license_number IS NULL OR
    p.driver_phone IS NULL
  );

-- Verify backfill results
SELECT
    COUNT(*) AS total_payouts,
    COUNT(*) FILTER (WHERE driver_name IS NOT NULL) AS with_identity,
    COUNT(*) FILTER (WHERE driver_name IS NULL) AS still_missing_identity
FROM public.driver_salary_payouts;

-- =====================================================================
-- 5. AUDIT LOG INDEX OPTIMISATION (Optional but Recommended)
--
-- Adds index on audit_logs for efficient school-wide finance action queries
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_school_action
  ON public.audit_logs (school_id, action_type)
  WHERE school_id IS NOT NULL;

