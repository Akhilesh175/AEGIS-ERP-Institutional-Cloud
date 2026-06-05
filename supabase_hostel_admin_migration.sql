-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: ADD HOSTEL_ADMIN ROLE AND CONFIGURATION
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Extend user_role ENUM to support HOSTEL_ADMIN
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'HOSTEL_ADMIN';

-- 2. Create hostel_admins Table
CREATE TABLE IF NOT EXISTS public.hostel_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  employee_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deactivated_at TIMESTAMP WITH TIME ZONE,
  deactivated_by UUID
);

-- 3. Setup Performance & Access Indexes
CREATE INDEX IF NOT EXISTS idx_hostel_admins_school ON public.hostel_admins (school_id);
CREATE INDEX IF NOT EXISTS idx_hostel_admins_user ON public.hostel_admins (user_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.hostel_admins ENABLE ROW LEVEL SECURITY;

-- 5. Define School-Scoped RLS Policies
DROP POLICY IF EXISTS "Users can view school hostel admins" ON public.hostel_admins;
CREATE POLICY "Users can view school hostel admins" ON public.hostel_admins FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Admins can manage school hostel admins" ON public.hostel_admins;
CREATE POLICY "Admins can manage school hostel admins" ON public.hostel_admins FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- 6. Enable Realtime Replication
ALTER TABLE public.hostel_admins REPLICA IDENTITY FULL;

COMMENT ON TABLE public.hostel_admins IS 'Dedicated hostel administrator profiles.';

-- 7. Seed Default HOSTEL_ADMIN Role and Module Permissions for All Schools
DO $$
DECLARE
  r RECORD;
  hostel_role_id UUID;
  role_rec RECORD;
BEGIN
  FOR r IN SELECT id FROM public.schools LOOP
    -- Ensure HOSTEL_ADMIN role exists
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE school_id = r.id AND role_code = 'HOSTEL_ADMIN') THEN
      INSERT INTO public.roles (role_name, role_code, description, school_id)
      VALUES ('Hostel Admin', 'HOSTEL_ADMIN', 'Responsible for hostels, blocks, floors, rooms, beds, admissions, leave requests, visitor logs, complaints, and mess menus.', r.id)
      RETURNING id INTO hostel_role_id;

      -- Seed permissions for standard modules for HOSTEL_ADMIN
      INSERT INTO public.role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      VALUES 
        (hostel_role_id, 'billing', false, false, false, false, false, false),
        (hostel_role_id, 'directory', false, false, false, false, false, false),
        (hostel_role_id, 'academics', false, false, false, false, false, false),
        (hostel_role_id, 'grading', false, false, false, false, false, false),
        (hostel_role_id, 'security', false, false, false, false, false, false),
        (hostel_role_id, 'books', false, false, false, false, false, false),
        (hostel_role_id, 'transport', false, false, false, false, false, false);
    END IF;
  END LOOP;

  -- Ensure 'hostel' module row is added for all existing roles
  FOR role_rec IN SELECT id, role_code FROM public.roles LOOP
    IF NOT EXISTS (SELECT 1 FROM public.role_permissions WHERE role_id = role_rec.id AND module_name = 'hostel') THEN
      INSERT INTO public.role_permissions (role_id, module_name, can_view, can_create, can_edit, can_delete, can_export, can_approve)
      VALUES (
        role_rec.id, 
        'hostel', 
        CASE WHEN role_rec.role_code = 'HOSTEL_ADMIN' THEN true ELSE false END, 
        CASE WHEN role_rec.role_code = 'HOSTEL_ADMIN' THEN true ELSE false END, 
        CASE WHEN role_rec.role_code = 'HOSTEL_ADMIN' THEN true ELSE false END, 
        CASE WHEN role_rec.role_code = 'HOSTEL_ADMIN' THEN true ELSE false END, 
        CASE WHEN role_rec.role_code = 'HOSTEL_ADMIN' THEN true ELSE false END, 
        CASE WHEN role_rec.role_code = 'HOSTEL_ADMIN' THEN true ELSE false END
      );
    END IF;
  END LOOP;
END $$;
