-- =====================================================================
-- GROUP DISCUSSION SYSTEM MIGRATION
-- Author: Antigravity
-- Created: 2026-06-19
-- =====================================================================

-- 1. Create class_chat_groups Table
CREATE TABLE IF NOT EXISTS public.class_chat_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT class_chat_groups_uniq UNIQUE (school_id, academic_session_id, class_id)
);

-- 2. Create class_chat_members Table
CREATE TABLE IF NOT EXISTS public.class_chat_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.class_chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('STUDENT', 'TEACHER', 'CLASS_TEACHER', 'ACADEMIC_ADMIN', 'SCHOOL_ADMIN')),
  muted_until TIMESTAMP WITH TIME ZONE,
  is_permanently_muted BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT group_member_uniq UNIQUE (group_id, user_id)
);

-- 3. Create class_messages Table
CREATE TABLE IF NOT EXISTS public.class_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.class_chat_groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'CHAT' CHECK (message_type IN ('CHAT', 'ANNOUNCEMENT', 'SYSTEM')),
  system_notice_type TEXT CHECK (system_notice_type IN ('HOMEWORK', 'ASSIGNMENT', 'EXAM', 'TIMETABLE', 'NOTICE')),
  edited_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create class_message_reactions Table
CREATE TABLE IF NOT EXISTS public.class_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.class_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT message_reaction_uniq UNIQUE (message_id, user_id, reaction)
);

-- 5. Create class_message_replies Table
CREATE TABLE IF NOT EXISTS public.class_message_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  parent_message_id UUID NOT NULL REFERENCES public.class_messages(id) ON DELETE CASCADE,
  reply_message_id UUID NOT NULL REFERENCES public.class_messages(id) ON DELETE CASCADE UNIQUE
);

-- 6. Create class_message_attachments Table
CREATE TABLE IF NOT EXISTS public.class_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.class_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create class_pinned_messages Table
CREATE TABLE IF NOT EXISTS public.class_pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.class_chat_groups(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.class_messages(id) ON DELETE CASCADE UNIQUE,
  pinned_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pinned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create class_announcements Table
CREATE TABLE IF NOT EXISTS public.class_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.class_chat_groups(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.class_messages(id) ON DELETE CASCADE UNIQUE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create class_chat_audit_logs Table
CREATE TABLE IF NOT EXISTS public.class_chat_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.class_chat_groups(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create class_typing_status Table
CREATE TABLE IF NOT EXISTS public.class_typing_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.class_chat_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT group_user_typing_uniq UNIQUE (group_id, user_id)
);

-- 11. Create class_online_presence Table
CREATE TABLE IF NOT EXISTS public.class_online_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  status TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('ONLINE', 'OFFLINE')),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_chat_groups_class ON public.class_chat_groups(class_id);
CREATE INDEX IF NOT EXISTS idx_class_chat_members_group ON public.class_chat_members(group_id);
CREATE INDEX IF NOT EXISTS idx_class_chat_members_user ON public.class_chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_class_messages_group ON public.class_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_class_messages_sender ON public.class_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_class_messages_created ON public.class_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_message_reactions_message ON public.class_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_class_pinned_group ON public.class_pinned_messages(group_id);

-- Enforce Row Level Security (RLS)
ALTER TABLE public.class_chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_message_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_pinned_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_chat_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_typing_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_online_presence ENABLE ROW LEVEL SECURITY;

-- Helper function to fetch current user's school_id bypass RLS
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Helper function to check if auth.uid() is member of class group
CREATE OR REPLACE FUNCTION is_class_group_member(group_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_chat_members 
    WHERE class_chat_members.group_id = is_class_group_member.group_id 
      AND class_chat_members.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- RLS POLICIES FOR CLASS CHAT GROUPS
CREATE POLICY "class_chat_groups_select" ON public.class_chat_groups
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      is_class_group_member(id) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'ACADEMIC_ADMIN')
      )
    )
  );

CREATE POLICY "class_chat_groups_all_admin" ON public.class_chat_groups
  FOR ALL USING (
    school_id = get_auth_user_school_id() AND EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- RLS POLICIES FOR MEMBERS
CREATE POLICY "class_chat_members_select" ON public.class_chat_members
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      is_class_group_member(group_id) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'ACADEMIC_ADMIN')
      )
    )
  );

CREATE POLICY "class_chat_members_write_admin" ON public.class_chat_members
  FOR ALL USING (
    school_id = get_auth_user_school_id() AND EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text IN ('ADMIN', 'SUPER_ADMIN', 'TEACHER', 'CLASS_TEACHER', 'ACADEMIC_ADMIN')
    )
  );

-- RLS POLICIES FOR MESSAGES
CREATE POLICY "class_messages_select" ON public.class_messages
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      is_class_group_member(group_id) OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'ACADEMIC_ADMIN')
      )
    )
  );

CREATE POLICY "class_messages_insert" ON public.class_messages
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND 
    sender_id = auth.uid() AND 
    is_class_group_member(group_id) AND NOT EXISTS (
      SELECT 1 FROM public.class_chat_members 
      WHERE user_id = auth.uid() AND group_id = class_messages.group_id 
        AND (is_permanently_muted = TRUE OR muted_until > NOW())
    )
  );

CREATE POLICY "class_messages_update" ON public.class_messages
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND (
      sender_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text IN ('ADMIN', 'SUPER_ADMIN', 'ACADEMIC_ADMIN', 'TEACHER', 'CLASS_TEACHER')
      )
    )
  );

-- RLS POLICIES FOR REACTIONS, REPLIES, ATTACHMENTS, PINS, ANNOUNCEMENTS
CREATE POLICY "reactions_all" ON public.class_message_reactions
  FOR ALL USING (
    school_id = get_auth_user_school_id() AND (
      user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'ACADEMIC_ADMIN')
      )
    )
  );

CREATE POLICY "replies_all" ON public.class_message_replies
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "attachments_all" ON public.class_message_attachments
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "pinned_all" ON public.class_pinned_messages
  FOR ALL USING (
    school_id = get_auth_user_school_id() AND EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text IN ('ADMIN', 'SUPER_ADMIN', 'ACADEMIC_ADMIN', 'TEACHER', 'CLASS_TEACHER')
    )
  );

CREATE POLICY "announcements_all" ON public.class_announcements
  FOR ALL USING (
    school_id = get_auth_user_school_id() AND EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text IN ('ADMIN', 'SUPER_ADMIN', 'ACADEMIC_ADMIN', 'TEACHER', 'CLASS_TEACHER')
    )
  );

CREATE POLICY "audit_logs_select" ON public.class_chat_audit_logs
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND EXISTS (
      SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "typing_status_all" ON public.class_typing_status
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "online_presence_all" ON public.class_online_presence
  FOR ALL USING (school_id = get_auth_user_school_id());


-- =====================================================================
-- MEMBERSHIP AUTO-SYNC ENGINE (DATABASE TRIGGERS)
-- =====================================================================

-- Trigger function for Class Chat Group creation and sync
CREATE OR REPLACE FUNCTION process_class_chat_group_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_admin RECORD;
BEGIN
  -- Insert group automatically when a class is created
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.class_chat_groups (school_id, academic_session_id, class_id, name)
    VALUES (NEW.school_id, NEW.academic_session_id, NEW.id, NEW.name || ' Group Discussion')
    RETURNING id INTO v_group_id;

    -- Auto-enroll all admins and academic admins of the school into the new group
    FOR v_admin IN 
      SELECT id, role FROM public.users 
      WHERE school_id = NEW.school_id AND role IN ('ADMIN', 'ACADEMIC_ADMIN') AND is_active = TRUE
    LOOP
      INSERT INTO public.class_chat_members (school_id, academic_session_id, group_id, user_id, role)
      VALUES (NEW.school_id, NEW.academic_session_id, v_group_id, v_admin.id, v_admin.role)
      ON CONFLICT (group_id, user_id) DO NOTHING;
    END LOOP;

  -- Rename group automatically when class is renamed
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.class_chat_groups 
    SET name = NEW.name || ' Group Discussion'
    WHERE class_id = NEW.id;

    -- Handle class teacher assignment/changes
    IF NEW.class_teacher_id IS DISTINCT FROM OLD.class_teacher_id THEN
      -- If there is a new class teacher, auto-add
      IF NEW.class_teacher_id IS NOT NULL THEN
        PERFORM sync_teacher_chat_membership(NEW.id, NEW.class_teacher_id);
      END IF;
      -- If there was an old class teacher, evaluate removal
      IF OLD.class_teacher_id IS NOT NULL THEN
        PERFORM sync_teacher_chat_membership(NEW.id, OLD.class_teacher_id);
      END IF;
    END IF;

  -- Archive group automatically on class delete
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.class_chat_groups 
    SET is_archived = TRUE 
    WHERE class_id = OLD.id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_class_chat_group_sync
AFTER INSERT OR UPDATE OR DELETE ON public.classes
FOR EACH ROW EXECUTE FUNCTION process_class_chat_group_sync();


-- Helper function to evaluate and sync teacher membership
CREATE OR REPLACE FUNCTION sync_teacher_chat_membership(p_class_id UUID, p_teacher_id UUID)
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
  -- Get teacher's user_id and school_id
  SELECT user_id, school_id INTO v_user_id, v_school_id FROM public.teachers WHERE id = p_teacher_id AND (status = 'ACTIVE' OR deleted_at IS NULL);
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
    SELECT 1 FROM public.teacher_class_subject_mapping 
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


-- Trigger function for teacher subject mapping changes
CREATE OR REPLACE FUNCTION process_teacher_mapping_sync()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM sync_teacher_chat_membership(NEW.class_id, NEW.teacher_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM sync_teacher_chat_membership(OLD.class_id, OLD.teacher_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_teacher_mapping_sync
AFTER INSERT OR UPDATE OR DELETE ON public.teacher_class_subject_mapping
FOR EACH ROW EXECUTE FUNCTION process_teacher_mapping_sync();


-- Trigger function for Student admission/promotion/exits
CREATE OR REPLACE FUNCTION process_student_chat_sync()
RETURNS TRIGGER AS $$
DECLARE
  v_group_id UUID;
  v_user_active BOOLEAN;
  v_user_role TEXT;
BEGIN
  -- Handle student admission or class promotion (insert/update class_id)
  IF TG_OP = 'INSERT' THEN
    -- Check if student's user is active
    SELECT is_active, role INTO v_user_active, v_user_role FROM public.users WHERE id = NEW.user_id;
    IF v_user_active = TRUE AND NEW.class_id IS NOT NULL THEN
      SELECT id INTO v_group_id FROM public.class_chat_groups 
      WHERE class_id = NEW.class_id AND academic_session_id = NEW.academic_session_id AND is_archived = FALSE;
      
      IF v_group_id IS NOT NULL THEN
        INSERT INTO public.class_chat_members (school_id, academic_session_id, group_id, user_id, role)
        VALUES (NEW.school_id, NEW.academic_session_id, v_group_id, NEW.user_id, 'STUDENT')
        ON CONFLICT (group_id, user_id) DO NOTHING;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.class_id IS DISTINCT FROM OLD.class_id THEN
      -- Remove from old group
      IF OLD.class_id IS NOT NULL THEN
        DELETE FROM public.class_chat_members 
        WHERE user_id = NEW.user_id AND group_id = (
          SELECT id FROM public.class_chat_groups 
          WHERE class_id = OLD.class_id AND academic_session_id = OLD.academic_session_id
        );
      END IF;

      -- Add to new group
      SELECT is_active INTO v_user_active FROM public.users WHERE id = NEW.user_id;
      IF v_user_active = TRUE AND NEW.class_id IS NOT NULL THEN
        SELECT id INTO v_group_id FROM public.class_chat_groups 
        WHERE class_id = NEW.class_id AND academic_session_id = NEW.academic_session_id AND is_archived = FALSE;
        
        IF v_group_id IS NOT NULL THEN
          INSERT INTO public.class_chat_members (school_id, academic_session_id, group_id, user_id, role)
          VALUES (NEW.school_id, NEW.academic_session_id, v_group_id, NEW.user_id, 'STUDENT')
          ON CONFLICT (group_id, user_id) DO NOTHING;
        END IF;
      END IF;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.class_chat_members WHERE user_id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER trg_student_chat_sync
AFTER INSERT OR UPDATE OR DELETE ON public.students
FOR EACH ROW EXECUTE FUNCTION process_student_chat_sync();


-- Trigger function for User deactivation
CREATE OR REPLACE FUNCTION process_user_deactivation_chat_sync()
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
    -- Re-enroll if teacher
    ELSIF NEW.role = 'TEACHER' THEN
      SELECT * INTO v_teacher FROM public.teachers WHERE user_id = NEW.id AND (status = 'ACTIVE' OR deleted_at IS NULL);
      IF v_teacher.id IS NOT NULL THEN
        -- Recheck all maps
        FOR v_mapping IN 
          SELECT DISTINCT class_id FROM public.teacher_class_subject_mapping WHERE teacher_id = v_teacher.id
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

CREATE OR REPLACE TRIGGER trg_user_deactivation_chat_sync
AFTER UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION process_user_deactivation_chat_sync();


-- Enable Realtime for the discussion tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_chat_groups;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_chat_members;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_message_reactions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_message_replies;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_message_attachments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_pinned_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_announcements;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_typing_status;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_online_presence;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;
