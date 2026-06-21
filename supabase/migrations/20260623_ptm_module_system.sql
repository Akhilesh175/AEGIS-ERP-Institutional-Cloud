-- 1. Create ptm_meetings table
CREATE TABLE IF NOT EXISTS public.ptm_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  meeting_mode TEXT NOT NULL CHECK (meeting_mode IN ('OFFLINE', 'ONLINE', 'HYBRID')),
  venue TEXT,
  meeting_link TEXT,
  meeting_password TEXT,
  scheduled_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'RESCHEDULE_REQUESTED')),
  reschedule_reason TEXT,
  reschedule_suggested_date DATE,
  reschedule_suggested_time TIME,
  parent_confirmed_attendance BOOLEAN DEFAULT FALSE,
  parent_pre_questions TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create ptm_attendance table
CREATE TABLE IF NOT EXISTS public.ptm_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE UNIQUE,
  teacher_join_time TIMESTAMP WITH TIME ZONE,
  teacher_leave_time TIMESTAMP WITH TIME ZONE,
  parent_join_time TIMESTAMP WITH TIME ZONE,
  parent_leave_time TIMESTAMP WITH TIME ZONE,
  student_join_time TIMESTAMP WITH TIME ZONE,
  student_leave_time TIMESTAMP WITH TIME ZONE,
  attendance_status TEXT DEFAULT 'ABSENT' CHECK (attendance_status IN ('PRESENT', 'ABSENT', 'LATE', 'PARTIAL'))
);

-- 3. Create ptm_feedback table (Teacher Feedback)
CREATE TABLE IF NOT EXISTS public.ptm_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE UNIQUE,
  strengths TEXT,
  weaknesses TEXT, -- Areas of Improvement
  recommendations TEXT,
  behavioural_notes TEXT, -- Behaviour Notes
  action_plan TEXT,
  assignments TEXT,
  study_plan TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create ptm_parent_feedback table
CREATE TABLE IF NOT EXISTS public.ptm_parent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE UNIQUE,
  questions TEXT,
  concerns TEXT,
  suggestions TEXT,
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create ptm_followups table (Action Plans / Tasks)
CREATE TABLE IF NOT EXISTS public.ptm_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  task TEXT NOT NULL,
  assigned_to TEXT NOT NULL CHECK (assigned_to IN ('STUDENT', 'PARENT', 'TEACHER')),
  due_date DATE NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  completion_status BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create ptm_notifications table
CREATE TABLE IF NOT EXISTS public.ptm_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create ptm_recordings table
CREATE TABLE IF NOT EXISTS public.ptm_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  recording_url TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create ptm_documents table
CREATE TABLE IF NOT EXISTS public.ptm_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create ptm_chat_messages table
CREATE TABLE IF NOT EXISTS public.ptm_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.ptm_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_parent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_chat_messages ENABLE ROW LEVEL SECURITY;

-- 11. Create secure RLS policies for each table
DROP POLICY IF EXISTS ptm_meetings_policy ON public.ptm_meetings;
CREATE POLICY ptm_meetings_policy ON public.ptm_meetings
  FOR ALL TO authenticated
  USING (
    school_id = get_auth_user_school_id()
    AND (
      EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN'))
      OR teacher_id IN (SELECT id FROM public.teachers WHERE user_id = auth.uid())
      OR parent_id = auth.uid()
      OR student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS ptm_attendance_policy ON public.ptm_attendance;
CREATE POLICY ptm_attendance_policy ON public.ptm_attendance
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id));

DROP POLICY IF EXISTS ptm_feedback_policy ON public.ptm_feedback;
CREATE POLICY ptm_feedback_policy ON public.ptm_feedback
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id));

DROP POLICY IF EXISTS ptm_parent_feedback_policy ON public.ptm_parent_feedback;
CREATE POLICY ptm_parent_feedback_policy ON public.ptm_parent_feedback
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id));

DROP POLICY IF EXISTS ptm_followups_policy ON public.ptm_followups;
CREATE POLICY ptm_followups_policy ON public.ptm_followups
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id));

DROP POLICY IF EXISTS ptm_notifications_policy ON public.ptm_notifications;
CREATE POLICY ptm_notifications_policy ON public.ptm_notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ptm_recordings_policy ON public.ptm_recordings;
CREATE POLICY ptm_recordings_policy ON public.ptm_recordings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id));

DROP POLICY IF EXISTS ptm_documents_policy ON public.ptm_documents;
CREATE POLICY ptm_documents_policy ON public.ptm_documents
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id));

DROP POLICY IF EXISTS ptm_chat_messages_policy ON public.ptm_chat_messages;
CREATE POLICY ptm_chat_messages_policy ON public.ptm_chat_messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id));

-- 12. Add tables to Supabase Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_meetings;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_attendance;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_feedback;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_parent_feedback;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_followups;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_notifications;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_recordings;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_documents;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_chat_messages;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
