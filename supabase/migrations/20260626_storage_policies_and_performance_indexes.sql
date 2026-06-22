-- 1. Helper function to safely cast text to UUID without throwing syntax exceptions
CREATE OR REPLACE FUNCTION public.safe_uuid(text_val TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN text_val::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Create the helper function to check if a user is a participant of a meeting
CREATE OR REPLACE FUNCTION public.is_meeting_participant(meeting_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_participant BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 
    FROM public.ptm_meetings m
    WHERE m.id = meeting_id
      AND (
        m.parent_id = user_id
        OR m.teacher_id IN (SELECT id FROM public.teachers WHERE user_id = user_id)
        OR m.student_id IN (SELECT id FROM public.students WHERE user_id = user_id)
        OR EXISTS (
          SELECT 1 
          FROM public.users u 
          WHERE u.id = user_id 
            AND u.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN')
        )
      )
  ) INTO is_participant;
  RETURN is_participant;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the helper function to check if a user is a participant of a meeting for a given storage object name (path: school_id/meeting_id/...)
CREATE OR REPLACE FUNCTION public.is_storage_meeting_participant(object_name TEXT, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  m_id UUID;
  s_id UUID;
  user_school_id UUID;
BEGIN
  -- Extract school_id and meeting_id from path segments
  s_id := public.safe_uuid(split_part(object_name, '/', 1));
  m_id := public.safe_uuid(split_part(object_name, '/', 2));
  
  IF s_id IS NULL OR m_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verify school isolation (tenant matching)
  SELECT school_id INTO user_school_id FROM public.users WHERE id = user_id;
  IF user_school_id IS NULL OR user_school_id != s_id THEN
    RETURN FALSE;
  END IF;

  -- Verify meeting participant authorization
  RETURN public.is_meeting_participant(m_id, user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create or configure storage bucket: ptm-chat-files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ptm-chat-files', 
  'ptm-chat-files', 
  false, -- Private bucket
  52428800, -- 50 MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET 
  public = false, 
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/zip',
    'image/png',
    'image/jpeg',
    'image/webp'
  ];

-- 5. Enable RLS on storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 6. Storage Object RLS Policies (ptm-chat-files bucket isolation)
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

-- 7. Update PTM chat tables RLS policies to restrict strictly to meeting participants
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

-- 8. Database Indexes for Parent Portal & Meeting Performance Optimization
CREATE INDEX IF NOT EXISTS idx_ptm_meetings_parent_id ON public.ptm_meetings(parent_id);
CREATE INDEX IF NOT EXISTS idx_ptm_meetings_student_id ON public.ptm_meetings(student_id);
CREATE INDEX IF NOT EXISTS idx_ptm_meetings_school_id ON public.ptm_meetings(school_id);
CREATE INDEX IF NOT EXISTS idx_ptm_meetings_class_id ON public.ptm_meetings(class_id);
CREATE INDEX IF NOT EXISTS idx_ptm_meetings_teacher_id ON public.ptm_meetings(teacher_id);

CREATE INDEX IF NOT EXISTS idx_ptm_chat_attachments_meeting_id ON public.ptm_chat_attachments(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ptm_chat_attachments_school_id ON public.ptm_chat_attachments(school_id);

CREATE INDEX IF NOT EXISTS idx_ptm_messages_meeting_id ON public.ptm_messages(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ptm_messages_school_id ON public.ptm_messages(school_id);

CREATE INDEX IF NOT EXISTS idx_ptm_participants_meeting_id ON public.ptm_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_ptm_participants_user_id ON public.ptm_participants(user_id);

CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_parent_id ON public.parent_student_mappings(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_mappings_student_id ON public.parent_student_mappings(student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON public.attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_homeworks_class_id ON public.homeworks(class_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student_id ON public.homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_marks_student_id ON public.student_marks(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_schedules_class_id ON public.exam_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_class_id ON public.quizzes(class_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON public.quiz_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_study_materials_class_id ON public.study_materials(class_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_student_id ON public.book_issues(student_id);
CREATE INDEX IF NOT EXISTS idx_library_fines_student_id ON public.library_fines(student_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_student_id ON public.transport_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_admissions_student_id ON public.hostel_admissions(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_leave_requests_student_id ON public.hostel_leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_complaints_student_id ON public.hostel_complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_attendance_student_id ON public.hostel_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_visitors_student_id ON public.hostel_visitors(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_payments_student_id ON public.hostel_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
