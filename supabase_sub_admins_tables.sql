-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: DEDICATED SUB-ADMIN PROFILE TABLES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 0. Extend user_role ENUM to support CUSTOM_SUB_ADMIN
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'CUSTOM_SUB_ADMIN';

-- 1. Create finance_admins Table
CREATE TABLE IF NOT EXISTS public.finance_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create academic_admins Table
CREATE TABLE IF NOT EXISTS public.academic_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create exam_controllers Table
CREATE TABLE IF NOT EXISTS public.exam_controllers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create librarians Table
CREATE TABLE IF NOT EXISTS public.librarians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create transport_managers Table
CREATE TABLE IF NOT EXISTS public.transport_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create custom_sub_admins Table
CREATE TABLE IF NOT EXISTS public.custom_sub_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Setup Performance & Access Indexes
CREATE INDEX IF NOT EXISTS idx_finance_admins_school ON public.finance_admins (school_id);
CREATE INDEX IF NOT EXISTS idx_finance_admins_user ON public.finance_admins (user_id);

CREATE INDEX IF NOT EXISTS idx_academic_admins_school ON public.academic_admins (school_id);
CREATE INDEX IF NOT EXISTS idx_academic_admins_user ON public.academic_admins (user_id);

CREATE INDEX IF NOT EXISTS idx_exam_controllers_school ON public.exam_controllers (school_id);
CREATE INDEX IF NOT EXISTS idx_exam_controllers_user ON public.exam_controllers (user_id);

CREATE INDEX IF NOT EXISTS idx_librarians_school ON public.librarians (school_id);
CREATE INDEX IF NOT EXISTS idx_librarians_user ON public.librarians (user_id);

CREATE INDEX IF NOT EXISTS idx_transport_managers_school ON public.transport_managers (school_id);
CREATE INDEX IF NOT EXISTS idx_transport_managers_user ON public.transport_managers (user_id);

CREATE INDEX IF NOT EXISTS idx_custom_sub_admins_school ON public.custom_sub_admins (school_id);
CREATE INDEX IF NOT EXISTS idx_custom_sub_admins_user ON public.custom_sub_admins (user_id);

-- 8. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.finance_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_controllers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.librarians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_sub_admins ENABLE ROW LEVEL SECURITY;

-- 9. Define School-Scoped RLS Policies
-- SELECT Policies
DROP POLICY IF EXISTS "Users can view school finance admins" ON public.finance_admins;
CREATE POLICY "Users can view school finance admins" ON public.finance_admins FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school academic admins" ON public.academic_admins;
CREATE POLICY "Users can view school academic admins" ON public.academic_admins FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school exam controllers" ON public.exam_controllers;
CREATE POLICY "Users can view school exam controllers" ON public.exam_controllers FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school librarians" ON public.librarians;
CREATE POLICY "Users can view school librarians" ON public.librarians FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school transport managers" ON public.transport_managers;
CREATE POLICY "Users can view school transport managers" ON public.transport_managers FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school custom sub admins" ON public.custom_sub_admins;
CREATE POLICY "Users can view school custom sub admins" ON public.custom_sub_admins FOR SELECT USING (school_id = get_auth_user_school_id());

-- ALL Manage Policies (Restricted to Main ADMIN / SUPER_ADMIN)
DROP POLICY IF EXISTS "Admins can manage school finance admins" ON public.finance_admins;
CREATE POLICY "Admins can manage school finance admins" ON public.finance_admins FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school academic admins" ON public.academic_admins;
CREATE POLICY "Admins can manage school academic admins" ON public.academic_admins FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school exam controllers" ON public.exam_controllers;
CREATE POLICY "Admins can manage school exam controllers" ON public.exam_controllers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school librarians" ON public.librarians;
CREATE POLICY "Admins can manage school librarians" ON public.librarians FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school transport managers" ON public.transport_managers;
CREATE POLICY "Admins can manage school transport managers" ON public.transport_managers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school custom sub admins" ON public.custom_sub_admins;
CREATE POLICY "Admins can manage school custom sub admins" ON public.custom_sub_admins FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- 10. Migrate Existing Users into Dedicated Profile Tables
DO $$
DECLARE
  r RECORD;
  r_id UUID;
BEGIN
  FOR r IN SELECT id, role::text AS role_str, school_id, role_id, is_active FROM public.users WHERE role::text IN ('FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN') LOOP
    -- Determine role_id if not present
    r_id := r.role_id;
    IF r_id IS NULL AND r.school_id IS NOT NULL THEN
      SELECT id INTO r_id FROM public.roles WHERE school_id = r.school_id AND role_code = r.role_str LIMIT 1;
    END IF;

    -- FINANCE_ADMIN
    IF r.role_str = 'FINANCE_ADMIN' THEN
      INSERT INTO public.finance_admins (user_id, school_id, role_id, status)
      VALUES (r.id, r.school_id, r_id, CASE WHEN r.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END)
      ON CONFLICT (user_id) DO NOTHING;
    
    -- ACADEMIC_ADMIN
    ELSIF r.role_str = 'ACADEMIC_ADMIN' THEN
      INSERT INTO public.academic_admins (user_id, school_id, role_id, status)
      VALUES (r.id, r.school_id, r_id, CASE WHEN r.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END)
      ON CONFLICT (user_id) DO NOTHING;
      
    -- EXAM_CONTROLLER
    ELSIF r.role_str = 'EXAM_CONTROLLER' THEN
      INSERT INTO public.exam_controllers (user_id, school_id, role_id, status)
      VALUES (r.id, r.school_id, r_id, CASE WHEN r.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END)
      ON CONFLICT (user_id) DO NOTHING;
      
    -- LIBRARIAN
    ELSIF r.role_str = 'LIBRARIAN' THEN
      INSERT INTO public.librarians (user_id, school_id, role_id, status)
      VALUES (r.id, r.school_id, r_id, CASE WHEN r.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END)
      ON CONFLICT (user_id) DO NOTHING;
      
    -- TRANSPORT_MANAGER
    ELSIF r.role_str = 'TRANSPORT_MANAGER' THEN
      INSERT INTO public.transport_managers (user_id, school_id, role_id, status)
      VALUES (r.id, r.school_id, r_id, CASE WHEN r.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END)
      ON CONFLICT (user_id) DO NOTHING;

    -- CUSTOM_SUB_ADMIN
    ELSIF r.role_str = 'CUSTOM_SUB_ADMIN' THEN
      INSERT INTO public.custom_sub_admins (user_id, school_id, role_id, status)
      VALUES (r.id, r.school_id, r_id, CASE WHEN r.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END)
      ON CONFLICT (user_id) DO NOTHING;
      
    END IF;
  END LOOP;
END $$;

-- 11. Enable Realtime Replication on Dedicated Tables
ALTER TABLE public.finance_admins REPLICA IDENTITY FULL;
ALTER TABLE public.academic_admins REPLICA IDENTITY FULL;
ALTER TABLE public.exam_controllers REPLICA IDENTITY FULL;
ALTER TABLE public.librarians REPLICA IDENTITY FULL;
ALTER TABLE public.transport_managers REPLICA IDENTITY FULL;
ALTER TABLE public.custom_sub_admins REPLICA IDENTITY FULL;

COMMENT ON TABLE public.finance_admins IS 'Dedicated finance administrative profiles.';
COMMENT ON TABLE public.academic_admins IS 'Dedicated academic administrative profiles.';
COMMENT ON TABLE public.exam_controllers IS 'Dedicated exam controllers administrative profiles.';
COMMENT ON TABLE public.librarians IS 'Dedicated librarians profiles.';
COMMENT ON TABLE public.transport_managers IS 'Dedicated transport managers profiles.';
COMMENT ON TABLE public.custom_sub_admins IS 'Dedicated custom sub admin operator profiles.';
