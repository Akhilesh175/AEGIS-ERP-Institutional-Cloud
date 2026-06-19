-- =====================================================================
-- MULTI-ROLE RBAC & AUDIT LOGGING MIGRATION
-- Author: Antigravity
-- Created: 2026-06-19
-- =====================================================================

-- 1. Create user_roles Table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  role_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uniq_user_school_role UNIQUE (user_id, school_id, role_code)
);

-- Index user_roles for query speed
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_school ON public.user_roles(school_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_code ON public.user_roles(role_code);

-- 2. Create role_changes Table (Audit Logging)
CREATE TABLE IF NOT EXISTS public.role_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DEACTIVATED', 'ROLE_REACTIVATED', 'ROLE_REMOVED', 'ROLE_SWITCHED', 'PASSWORD_RESET')),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  device_id TEXT
);

-- Index role_changes
CREATE INDEX IF NOT EXISTS idx_role_changes_user ON public.role_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_role_changes_event ON public.role_changes(event_type);

-- Prevent deletes/updates on audit logs to guarantee compliance
CREATE OR REPLACE FUNCTION public.prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are read-only and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_delete_role_changes ON public.role_changes;
CREATE TRIGGER trg_prevent_delete_role_changes
BEFORE UPDATE OR DELETE ON public.role_changes
FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_modification();

-- 3. Backfill active roles from public.users
INSERT INTO public.user_roles (user_id, school_id, role_code, status, assigned_by)
SELECT id, school_id, role, CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END, id
FROM public.users
ON CONFLICT (user_id, school_id, role_code) DO NOTHING;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_read_own" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_manage" ON public.user_roles;
DROP POLICY IF EXISTS "role_changes_read_own" ON public.role_changes;
DROP POLICY IF EXISTS "role_changes_admin_read" ON public.role_changes;

-- User Roles Policies
CREATE POLICY "user_roles_read_own" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_roles_admin_manage" ON public.user_roles
  FOR ALL USING (
    school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
  );

-- Role Changes Audit Policies
CREATE POLICY "role_changes_read_own" ON public.role_changes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "role_changes_admin_read" ON public.role_changes
  FOR SELECT USING (
    school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
    AND 
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
  );

-- 5. Enable Supabase Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_roles') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'role_changes') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.role_changes;
    END IF;
  END IF;
END $$;

-- 6. Helper function to check user role (session cache fallback)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

