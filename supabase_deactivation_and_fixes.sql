-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: SUB-ADMIN CONSOLE MANAGEMENT & DEACTIVATION
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Extend public.users Table with tracking & active columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Extend dedicated sub-admin profile tables with identical status tracking
ALTER TABLE public.finance_admins ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.finance_admins ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.finance_admins ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.academic_admins ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.academic_admins ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.academic_admins ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.exam_controllers ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.exam_controllers ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.exam_controllers ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.librarians ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.librarians ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.librarians ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.transport_managers ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.transport_managers ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.transport_managers ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.custom_sub_admins ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.custom_sub_admins ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.custom_sub_admins ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Enforce Unique constraints per school tenant for Employee IDs
--    These indices strictly prevent duplicate Employee IDs within the same school tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_emp_school 
  ON public.users (school_id, employee_id) WHERE employee_id IS NOT NULL;

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

-- 4. Idempotently Seed Default Roles and Permissions for All Existing Schools if missing
DO $$
DECLARE
  r RECORD;
  finance_role_id UUID;
  academic_role_id UUID;
  exam_role_id UUID;
  lib_role_id UUID;
  trans_role_id UUID;
  custom_role_id UUID;
BEGIN
  FOR r IN SELECT id FROM public.schools LOOP
    -- 1. FINANCE_ADMIN
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE school_id = r.id AND role_code = 'FINANCE_ADMIN') THEN
      INSERT INTO public.roles (role_name, role_code, description, school_id)
      VALUES ('Finance Admin', 'FINANCE_ADMIN', 'Responsible for billing, invoices, payment structures, and fee tracking.', r.id)
      RETURNING id INTO finance_role_id;

      INSERT INTO public.role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      VALUES 
        (finance_role_id, 'billing', true, true, true, true, true, true),
        (finance_role_id, 'directory', true, false, false, false, true, false),
        (finance_role_id, 'academics', false, false, false, false, false, false),
        (finance_role_id, 'grading', false, false, false, false, false, false),
        (finance_role_id, 'security', false, false, false, false, false, false),
        (finance_role_id, 'books', false, false, false, false, false, false),
        (finance_role_id, 'transport', true, false, false, false, false, false)
      ON CONFLICT (role_id, module_name) DO NOTHING;
    END IF;

    -- 2. ACADEMIC_ADMIN
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE school_id = r.id AND role_code = 'ACADEMIC_ADMIN') THEN
      INSERT INTO public.roles (role_name, role_code, description, school_id)
      VALUES ('Academic Admin', 'ACADEMIC_ADMIN', 'Manages classes, sections, timetables, subjects, and study structures.', r.id)
      RETURNING id INTO academic_role_id;

      INSERT INTO public.role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      VALUES 
        (academic_role_id, 'billing', false, false, false, false, false, false),
        (academic_role_id, 'directory', true, true, true, false, true, false),
        (academic_role_id, 'academics', true, true, true, true, true, true),
        (academic_role_id, 'grading', true, false, false, false, false, false),
        (academic_role_id, 'security', false, false, false, false, false, false),
        (academic_role_id, 'books', true, false, false, false, false, false),
        (academic_role_id, 'transport', true, false, false, false, false, false)
      ON CONFLICT (role_id, module_name) DO NOTHING;
    END IF;

    -- 3. EXAM_CONTROLLER
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE school_id = r.id AND role_code = 'EXAM_CONTROLLER') THEN
      INSERT INTO public.roles (role_name, role_code, description, school_id)
      VALUES ('Exam Controller', 'EXAM_CONTROLLER', 'Administers examinations, quiz configurations, marksheets, and grading books.', r.id)
      RETURNING id INTO exam_role_id;

      INSERT INTO public.role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      VALUES 
        (exam_role_id, 'billing', false, false, false, false, false, false),
        (exam_role_id, 'directory', true, false, false, false, false, false),
        (exam_role_id, 'academics', true, false, false, false, false, false),
        (exam_role_id, 'grading', true, true, true, true, true, true),
        (exam_role_id, 'security', false, false, false, false, false, false),
        (exam_role_id, 'books', false, false, false, false, false, false),
        (exam_role_id, 'transport', false, false, false, false, false, false)
      ON CONFLICT (role_id, module_name) DO NOTHING;
    END IF;

    -- 4. LIBRARIAN
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE school_id = r.id AND role_code = 'LIBRARIAN') THEN
      INSERT INTO public.roles (role_name, role_code, description, school_id)
      VALUES ('Librarian', 'LIBRARIAN', 'Manages library book inventory, issue/return logs, and late fee tracking.', r.id)
      RETURNING id INTO lib_role_id;

      INSERT INTO public.role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      VALUES 
        (lib_role_id, 'billing', false, false, false, false, false, false),
        (lib_role_id, 'directory', true, false, false, false, false, false),
        (lib_role_id, 'academics', true, false, false, false, false, false),
        (lib_role_id, 'grading', false, false, false, false, false, false),
        (lib_role_id, 'security', false, false, false, false, false, false),
        (lib_role_id, 'books', true, true, true, true, true, true),
        (lib_role_id, 'transport', false, false, false, false, false, false)
      ON CONFLICT (role_id, module_name) DO NOTHING;
    END IF;

    -- 5. TRANSPORT_MANAGER
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE school_id = r.id AND role_code = 'TRANSPORT_MANAGER') THEN
      INSERT INTO public.roles (role_name, role_code, description, school_id)
      VALUES ('Transport Manager', 'TRANSPORT_MANAGER', 'Administers school buses, routes, driver information, and passenger maps.', r.id)
      RETURNING id INTO trans_role_id;

      INSERT INTO public.role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      VALUES 
        (trans_role_id, 'billing', true, false, false, false, false, false),
        (trans_role_id, 'directory', true, false, false, false, false, false),
        (trans_role_id, 'academics', false, false, false, false, false, false),
        (trans_role_id, 'grading', false, false, false, false, false, false),
        (trans_role_id, 'security', false, false, false, false, false, false),
        (trans_role_id, 'books', false, false, false, false, false, false),
        (trans_role_id, 'transport', true, true, true, true, true, true)
      ON CONFLICT (role_id, module_name) DO NOTHING;
    END IF;

    -- 6. CUSTOM_SUB_ADMIN
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE school_id = r.id AND role_code = 'CUSTOM_SUB_ADMIN') THEN
      INSERT INTO public.roles (role_name, role_code, description, school_id)
      VALUES ('Custom Operator', 'CUSTOM_SUB_ADMIN', 'Customizable operator role with custom-assigned modular access tags.', r.id)
      RETURNING id INTO custom_role_id;

      INSERT INTO public.role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      VALUES 
        (custom_role_id, 'billing', true, false, false, false, false, false),
        (custom_role_id, 'directory', true, false, false, false, false, false),
        (custom_role_id, 'academics', false, false, false, false, false, false),
        (custom_role_id, 'grading', false, false, false, false, false, false),
        (custom_role_id, 'security', false, false, false, false, false, false),
        (custom_role_id, 'books', false, false, false, false, false, false),
        (custom_role_id, 'transport', false, false, false, false, false, false)
      ON CONFLICT (role_id, module_name) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- 5. Backfill existing NULL role_ids for all sub-admins based on their role code
DO $$
DECLARE
  r RECORD;
  r_id UUID;
BEGIN
  FOR r IN SELECT id, role::text AS role_str, school_id, role_id FROM public.users WHERE role::text IN ('FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN') LOOP
    -- Try to match role ID if users.role_id is null
    IF r.role_id IS NULL AND r.school_id IS NOT NULL THEN
      SELECT id INTO r_id FROM public.roles WHERE school_id = r.school_id AND role_code = r.role_str LIMIT 1;
      IF r_id IS NOT NULL THEN
        UPDATE public.users SET role_id = r_id WHERE id = r.id;
        
        -- Also update dedicated tables
        UPDATE public.finance_admins SET role_id = r_id WHERE user_id = r.id AND role_id IS NULL;
        UPDATE public.academic_admins SET role_id = r_id WHERE user_id = r.id AND role_id IS NULL;
        UPDATE public.exam_controllers SET role_id = r_id WHERE user_id = r.id AND role_id IS NULL;
        UPDATE public.librarians SET role_id = r_id WHERE user_id = r.id AND role_id IS NULL;
        UPDATE public.transport_managers SET role_id = r_id WHERE user_id = r.id AND role_id IS NULL;
        UPDATE public.custom_sub_admins SET role_id = r_id WHERE user_id = r.id AND role_id IS NULL;
      END IF;
    END IF;
  END LOOP;
END $$;
