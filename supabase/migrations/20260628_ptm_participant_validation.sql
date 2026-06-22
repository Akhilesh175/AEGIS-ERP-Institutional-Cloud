-- Centralized meeting participant validation function
DROP FUNCTION IF EXISTS public.validateMeetingParticipant(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_storage_meeting_participant(TEXT, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_meeting_participant(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.validateMeetingParticipant(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_valid BOOLEAN;
  m_school_id UUID;
  u_school_id UUID;
BEGIN
  -- 1. Check if meeting exists and retrieve its school_id
  SELECT school_id INTO m_school_id FROM public.ptm_meetings WHERE id = p_meeting_id;
  IF m_school_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Check tenant/school matching to ensure cross-school isolation
  SELECT school_id INTO u_school_id FROM public.users WHERE id = p_user_id;
  IF u_school_id IS NULL OR u_school_id != m_school_id THEN
    RETURN FALSE;
  END IF;

  -- 3. Check if user is registered as an active participant (joined the call and hasn't left)
  SELECT EXISTS (
    SELECT 1 
    FROM public.ptm_participants p
    WHERE p.meeting_id = p_meeting_id
      AND p.user_id = p_user_id
      AND p.left_at IS NULL
  ) INTO is_valid;

  -- 4. Admin and Staff fallback for spectator/auditing rights
  IF NOT is_valid THEN
    SELECT EXISTS (
      SELECT 1 
      FROM public.users u 
      WHERE u.id = p_user_id 
        AND u.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN')
    ) INTO is_valid;
  END IF;

  RETURN is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Redefine is_meeting_participant to delegate strictly to validateMeetingParticipant
CREATE OR REPLACE FUNCTION public.is_meeting_participant(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.validateMeetingParticipant(p_meeting_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate is_storage_meeting_participant
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate storage RLS policies (ptm-chat-files bucket isolation)
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

-- Recreate dropped dependent chat tables RLS policies
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

DROP POLICY IF EXISTS ptm_screenshare_logs_policy ON public.ptm_screenshare_logs;
CREATE POLICY ptm_screenshare_logs_policy ON public.ptm_screenshare_logs
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND public.is_meeting_participant(meeting_id, auth.uid())
  );
