-- 1. Create meeting_waiting_room table
CREATE TABLE IF NOT EXISTS public.meeting_waiting_room (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  participant_role TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  request_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create meeting_chat_messages table
CREATE TABLE IF NOT EXISTS public.meeting_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create meeting_files table
CREATE TABLE IF NOT EXISTS public.meeting_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create meeting_attendance table
CREATE TABLE IF NOT EXISTS public.meeting_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  join_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  leave_time TIMESTAMP WITH TIME ZONE,
  meeting_duration INTEGER, -- in seconds
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create meeting_recordings table
CREATE TABLE IF NOT EXISTS public.meeting_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  recording_url TEXT NOT NULL,
  duration_seconds INTEGER,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.meeting_waiting_room ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;

-- 7. Policies for school isolation and meeting participant restrictions

-- Helper function get_auth_user_school_id() or fallback
CREATE OR REPLACE FUNCTION public.get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- policies
DROP POLICY IF EXISTS meeting_waiting_room_policy ON public.meeting_waiting_room;
CREATE POLICY meeting_waiting_room_policy ON public.meeting_waiting_room
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN'))
      OR EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id AND (teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid()) OR parent_id = auth.uid() OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())))
    )
  );

DROP POLICY IF EXISTS meeting_chat_messages_policy ON public.meeting_chat_messages;
CREATE POLICY meeting_chat_messages_policy ON public.meeting_chat_messages
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

DROP POLICY IF EXISTS meeting_files_policy ON public.meeting_files;
CREATE POLICY meeting_files_policy ON public.meeting_files
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

DROP POLICY IF EXISTS meeting_attendance_policy ON public.meeting_attendance;
CREATE POLICY meeting_attendance_policy ON public.meeting_attendance
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

DROP POLICY IF EXISTS meeting_recordings_policy ON public.meeting_recordings;
CREATE POLICY meeting_recordings_policy ON public.meeting_recordings
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

-- 8. Add to Realtime Publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_waiting_room;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_chat_messages;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_files;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_attendance;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_recordings;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
