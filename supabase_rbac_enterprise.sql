-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: ROLE-BASED ACCESS CONTROL (RBAC) SYSTEM
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create Roles Table
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL,
  role_code TEXT NOT NULL, -- e.g. 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN'
  description TEXT,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (school_id, role_code)
);

-- 2. Create Role Permissions Table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL, -- e.g. 'billing', 'directory', 'academics', 'grading', 'security', 'books', 'transport'
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_export BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (role_id, module_name)
);

-- 3. Create Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  module_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Update public.users Table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS login_device TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'OFFLINE';

-- 5. Create Module Specific Custom Tables if they do not exist
-- Librarian Tables
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  category TEXT,
  quantity INTEGER DEFAULT 1,
  available INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.book_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  status TEXT DEFAULT 'ISSUED', -- 'ISSUED', 'RETURNED', 'OVERDUE'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.library_fines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES public.book_issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'UNPAID', -- 'UNPAID', 'PAID'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transport Manager Tables
CREATE TABLE IF NOT EXISTS public.buses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  plate_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  driver_phone TEXT,
  capacity INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., 'Route A - North'
  start_point TEXT,
  end_point TEXT,
  fare DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transport_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id)
);

-- Exam Controller Tables
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g., 'Midterm Exam'
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL,
  max_marks INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gradebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  marks_obtained INTEGER NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (student_id, exam_id)
);

-- 6. Enable Row Level Security (RLS) on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gradebooks ENABLE ROW LEVEL SECURITY;

-- 7. Define RLS Policies for Core RBAC
-- Roles
DROP POLICY IF EXISTS "Users can view roles in their school" ON public.roles;
CREATE POLICY "Users can view roles in their school" 
  ON public.roles FOR SELECT 
  USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;
CREATE POLICY "Admins can manage roles" 
  ON public.roles FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- Role Permissions
DROP POLICY IF EXISTS "Users can view role permissions" ON public.role_permissions;
CREATE POLICY "Users can view role permissions" 
  ON public.role_permissions FOR SELECT 
  USING (
    role_id IN (
      SELECT id FROM public.roles 
      WHERE roles.school_id = get_auth_user_school_id()
    )
  );

DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Admins can manage role permissions" 
  ON public.role_permissions FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- Audit Logs
DROP POLICY IF EXISTS "Users can view audit logs" ON public.audit_logs;
CREATE POLICY "Users can view audit logs" 
  ON public.audit_logs FOR SELECT 
  USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can insert audit logs" 
  ON public.audit_logs FOR INSERT 
  WITH CHECK (school_id = get_auth_user_school_id());

-- Books
DROP POLICY IF EXISTS "Users can view school books" ON public.books;
CREATE POLICY "Users can view school books" 
  ON public.books FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Authenticated users can manage books" ON public.books;
CREATE POLICY "Authenticated users can manage books" 
  ON public.books FOR ALL USING (school_id = get_auth_user_school_id());

-- Buses
DROP POLICY IF EXISTS "Users can view school buses" ON public.buses;
CREATE POLICY "Users can view school buses" 
  ON public.buses FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Authenticated users can manage buses" ON public.buses;
CREATE POLICY "Authenticated users can manage buses" 
  ON public.buses FOR ALL USING (school_id = get_auth_user_school_id());

-- 8. Seed Default Roles and Permissions for All Existing Schools
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
        (finance_role_id, 'transport', true, false, false, false, false, false);
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
        (academic_role_id, 'transport', true, false, false, false, false, false);
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
        (exam_role_id, 'transport', false, false, false, false, false, false);
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
        (lib_role_id, 'transport', false, false, false, false, false, false);
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
        (trans_role_id, 'transport', true, true, true, true, true, true);
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
        (custom_role_id, 'transport', false, false, false, false, false, false);
    END IF;

  END LOOP;
END $$;

-- 9. Enable real-time replication for RBAC tables
ALTER TABLE public.roles REPLICA IDENTITY FULL;
ALTER TABLE public.role_permissions REPLICA IDENTITY FULL;
ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

COMMENT ON TABLE public.roles IS 'Enterprise role definition profiles with multi-tenant school RLS isolation.';
COMMENT ON TABLE public.role_permissions IS 'Dynamic permission mappings linking modular operations to roles.';
COMMENT ON TABLE public.audit_logs IS 'Full traceability history detailing database changes and system activities.';
