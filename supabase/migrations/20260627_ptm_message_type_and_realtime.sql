-- Fix parameter ambiguity (Postgres 42702) by prefixing parameters with p_ to avoid column name conflicts in subqueries
-- Drop the existing functions CASCADE to bypass parameter rename limitations (Postgres 42P13)
DROP FUNCTION IF EXISTS public.is_storage_meeting_participant(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_meeting_participant(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.is_meeting_participant(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_participant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.ptm_meetings m
    WHERE m.id = p_meeting_id
      AND (
        m.parent_id = p_user_id
        OR m.teacher_id IN (SELECT id FROM public.teachers WHERE user_id = p_user_id)
        OR m.student_id IN (SELECT id FROM public.students WHERE user_id = p_user_id)
        OR EXISTS (
          SELECT 1 
          FROM public.users u 
          WHERE u.id = p_user_id 
            AND u.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN')
        )
      )
  ) INTO is_participant;
  RETURN is_participant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_storage_meeting_participant(p_object_name TEXT, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  m_id UUID;
  s_id UUID;
  user_school_id UUID;
BEGIN
  -- Extract school_id and meeting_id from path segments
  s_id := public.safe_uuid(split_part(p_object_name, '/', 1));
  m_id := public.safe_uuid(split_part(p_object_name, '/', 2));
  
  IF s_id IS NULL OR m_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify school isolation (tenant matching)
  SELECT school_id INTO user_school_id FROM public.users WHERE id = p_user_id;
  IF user_school_id IS NULL OR user_school_id != s_id THEN
    RETURN FALSE;
  END IF;

  -- Verify meeting participant authorization
  RETURN public.is_meeting_participant(m_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate dropped dependent storage RLS policies (ptm-chat-files bucket isolation)
DROP POLICY IF EXISTS "Allow meeting participants select" ON storage.objects;
CREATE POLICY "Allow meeting participants select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ptm-chat-files' 
    AND public.is_storage_meeting_participant(name, auth.uid())
  );

DROP POLICY IF EXISTS "Allow meeting participants insert" ON storage.objects;
CREATE POLICY "Allow meeting participants insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ptm-chat-files' 
    AND public.is_storage_meeting_participant(name, auth.uid())
  );

DROP POLICY IF EXISTS "Allow meeting participants update" ON storage.objects;
CREATE POLICY "Allow meeting participants update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'ptm-chat-files' 
    AND public.is_storage_meeting_participant(name, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'ptm-chat-files' 
    AND public.is_storage_meeting_participant(name, auth.uid())
  );

DROP POLICY IF EXISTS "Allow meeting participants delete" ON storage.objects;
CREATE POLICY "Allow meeting participants delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ptm-chat-files' 
    AND public.is_storage_meeting_participant(name, auth.uid())
  );

-- Recreate dropped dependent chat tables RLS policies to restrict strictly to meeting participants
DROP POLICY IF EXISTS ptm_chat_attachments_policy ON public.ptm_chat_attachments;
CREATE POLICY ptm_chat_attachments_policy ON public.ptm_chat_attachments
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND public.is_meeting_participant(meeting_id, auth.uid())
  );

DROP POLICY IF EXISTS ptm_messages_policy ON public.ptm_messages;
CREATE POLICY ptm_messages_policy ON public.ptm_messages
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND public.is_meeting_participant(meeting_id, auth.uid())
  );

-- 1. Add message_type column to public.ptm_messages table
ALTER TABLE public.ptm_messages ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'TEXT';

-- 2. Create public.ptm_screenshare_logs table
CREATE TABLE IF NOT EXISTS public.ptm_screenshare_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'START' or 'STOP'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS on ptm_screenshare_logs
ALTER TABLE public.ptm_screenshare_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy for ptm_screenshare_logs
DROP POLICY IF EXISTS ptm_screenshare_logs_policy ON public.ptm_screenshare_logs;
CREATE POLICY ptm_screenshare_logs_policy ON public.ptm_screenshare_logs
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND public.is_meeting_participant(meeting_id, auth.uid())
  );

-- 5. Add tables to Supabase Realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- ptm_messages
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_messages;
    END IF;

    -- ptm_chat_attachments
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_chat_attachments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_chat_attachments;
    END IF;

    -- ptm_meetings
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_meetings'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_meetings;
    END IF;

    -- ptm_attendance
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_attendance'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_attendance;
    END IF;

    -- ptm_feedback
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_feedback'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_feedback;
    END IF;

    -- ptm_parent_feedback
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_parent_feedback'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_parent_feedback;
    END IF;

    -- ptm_followups
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_followups'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_followups;
    END IF;

    -- ptm_notifications
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_notifications;
    END IF;

    -- ptm_participants
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_participants'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_participants;
    END IF;

    -- meeting_waiting_room
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meeting_waiting_room'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_waiting_room;
    END IF;

    -- ptm_screenshare_logs
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ptm_screenshare_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_screenshare_logs;
    END IF;
  END IF;
END $$;
