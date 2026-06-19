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
  deactivated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  deactivated_at TIMESTAMP WITH TIME ZONE,
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

-- Fix legacy/broken chat sync trigger functions that reference non-existent status/deleted_at columns on public.teachers
CREATE OR REPLACE FUNCTION public.sync_teacher_chat_membership(p_class_id UUID, p_teacher_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
  v_school_id UUID;
  v_session_id UUID;
  v_is_class_teacher BOOLEAN;
  v_is_subject_teacher BOOLEAN;
  v_role TEXT;
BEGIN
  -- Get teacher's user_id and school_id (teachers table does not have status or deleted_at columns)
  SELECT user_id, school_id INTO v_user_id, v_school_id FROM public.teachers WHERE id = p_teacher_id;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Get class group details
  SELECT id, academic_session_id INTO v_group_id, v_session_id 
  FROM public.class_chat_groups 
  WHERE class_id = p_class_id AND is_archived = FALSE;
  
  IF v_group_id IS NULL THEN
    RETURN;
  END IF;

  -- Check if teacher is assigned as class teacher
  SELECT EXISTS (
    SELECT 1 FROM public.classes 
    WHERE id = p_class_id AND class_teacher_id = p_teacher_id
  ) INTO v_is_class_teacher;

  -- Check if teacher has subject mapping
  SELECT EXISTS (
    SELECT 1 FROM public.teacher_class_subject_mappings 
    WHERE class_id = p_class_id AND teacher_id = p_teacher_id
  ) INTO v_is_subject_teacher;

  -- Sync membership
  IF v_is_class_teacher OR v_is_subject_teacher THEN
    v_role := CASE WHEN v_is_class_teacher THEN 'CLASS_TEACHER' ELSE 'TEACHER' END;
    INSERT INTO public.class_chat_members (school_id, academic_session_id, group_id, user_id, role)
    VALUES (v_school_id, v_session_id, v_group_id, v_user_id, v_role)
    ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  ELSE
    -- Revoke access / remove member from group
    DELETE FROM public.class_chat_members 
    WHERE group_id = v_group_id AND user_id = v_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.process_user_deactivation_chat_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_student RECORD;
  v_teacher RECORD;
  v_mapping RECORD;
BEGIN
  IF NEW.is_active = FALSE AND OLD.is_active = TRUE THEN
    -- Remove all chat memberships instantly
    DELETE FROM public.class_chat_members WHERE user_id = NEW.id;
  ELSIF NEW.is_active = TRUE AND OLD.is_active = FALSE THEN
    -- Re-enroll if student
    IF NEW.role = 'STUDENT' THEN
      SELECT * INTO v_student FROM public.students WHERE user_id = NEW.id;
      IF v_student.id IS NOT NULL AND v_student.class_id IS NOT NULL THEN
        INSERT INTO public.class_chat_members (school_id, academic_session_id, group_id, user_id, role)
        SELECT v_student.school_id, v_student.academic_session_id, id, NEW.id, 'STUDENT'
        FROM public.class_chat_groups 
        WHERE class_id = v_student.class_id AND academic_session_id = v_student.academic_session_id AND is_archived = FALSE
        ON CONFLICT (group_id, user_id) DO NOTHING;
      END IF;
    -- Re-enroll if teacher (teachers table does not have status or deleted_at columns)
    ELSIF NEW.role = 'TEACHER' THEN
      SELECT * INTO v_teacher FROM public.teachers WHERE user_id = NEW.id;
      IF v_teacher.id IS NOT NULL THEN
        -- Recheck all maps
        FOR v_mapping IN 
          SELECT DISTINCT class_id FROM public.teacher_class_subject_mappings WHERE teacher_id = v_teacher.id
          UNION
          SELECT id AS class_id FROM public.classes WHERE class_teacher_id = v_teacher.id
        LOOP
          PERFORM sync_teacher_chat_membership(v_mapping.class_id, v_teacher.id);
        END LOOP;
      END IF;
    -- Re-enroll if Admin
    ELSIF NEW.role IN ('ADMIN', 'ACADEMIC_ADMIN') THEN
      INSERT INTO public.class_chat_members (school_id, academic_session_id, group_id, user_id, role)
      SELECT school_id, academic_session_id, id, NEW.id, NEW.role
      FROM public.class_chat_groups 
      WHERE school_id = NEW.school_id AND is_archived = FALSE
      ON CONFLICT (group_id, user_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill active roles from public.users
INSERT INTO public.user_roles (user_id, school_id, role_code, status, assigned_by)
SELECT id, school_id, role, CASE WHEN is_active THEN 'ACTIVE' ELSE 'INACTIVE' END, id
FROM public.users
ON CONFLICT (user_id, school_id, role_code) DO NOTHING;

-- Self-healing: If a user is registered in teachers table, ensure they have TEACHER role as ACTIVE in user_roles
INSERT INTO public.user_roles (user_id, school_id, role_code, status, assigned_by)
SELECT user_id, school_id, 'TEACHER', 'ACTIVE', user_id
FROM public.teachers
ON CONFLICT (user_id, school_id, role_code) 
DO UPDATE SET status = 'ACTIVE', updated_at = NOW();

-- Self-healing: If a user is registered in sports_coaches table, ensure they have COACH role as ACTIVE in user_roles
INSERT INTO public.user_roles (user_id, school_id, role_code, status, assigned_by)
SELECT user_id, school_id, 'COACH', 'ACTIVE', user_id
FROM public.sports_coaches
ON CONFLICT (user_id, school_id, role_code) 
DO UPDATE SET status = 'ACTIVE', updated_at = NOW();

-- Self-healing: Re-enable users (is_active = true) in public.users if they have any ACTIVE role in user_roles
UPDATE public.users u
SET is_active = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = u.id AND ur.status = 'ACTIVE'
);

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

