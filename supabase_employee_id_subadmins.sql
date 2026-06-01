-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: EMPLOYEE ID FOR SUB-ADMIN PROFILES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Add employee_id column to all sub-admin profile tables
ALTER TABLE public.finance_admins ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.academic_admins ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.exam_controllers ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.librarians ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.transport_managers ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.custom_sub_admins ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- 2. Add employee_id to users table for universal lookup
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id TEXT;

-- 3. Create unique constraints: employee_id must be unique per school
--    This prevents duplicate Employee IDs within the same school tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_admins_emp_school
  ON public.finance_admins (school_id, employee_id) WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_admins_emp_school
  ON public.academic_admins (school_id, employee_id) WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_exam_controllers_emp_school
  ON public.exam_controllers (school_id, employee_id) WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_librarians_emp_school
  ON public.librarians (school_id, employee_id) WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_transport_managers_emp_school
  ON public.transport_managers (school_id, employee_id) WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_sub_admins_emp_school
  ON public.custom_sub_admins (school_id, employee_id) WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_emp_school
  ON public.users (school_id, employee_id) WHERE employee_id IS NOT NULL;

-- 4. Performance indices for employee_id lookups
CREATE INDEX IF NOT EXISTS idx_finance_admins_emp ON public.finance_admins (employee_id);
CREATE INDEX IF NOT EXISTS idx_academic_admins_emp ON public.academic_admins (employee_id);
CREATE INDEX IF NOT EXISTS idx_exam_controllers_emp ON public.exam_controllers (employee_id);
CREATE INDEX IF NOT EXISTS idx_librarians_emp ON public.librarians (employee_id);
CREATE INDEX IF NOT EXISTS idx_transport_managers_emp ON public.transport_managers (employee_id);
CREATE INDEX IF NOT EXISTS idx_custom_sub_admins_emp ON public.custom_sub_admins (employee_id);
CREATE INDEX IF NOT EXISTS idx_users_emp ON public.users (employee_id);

-- Done. All sub-admin tables and the users table now have an employee_id column
-- with unique constraints scoped per school to prevent duplicate IDs.
