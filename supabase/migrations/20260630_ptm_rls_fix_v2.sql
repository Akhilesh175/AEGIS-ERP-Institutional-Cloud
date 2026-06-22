-- ============================================================
-- AEGIS PTM — CORRECTED FINAL FIX (v2)
-- Safe to apply even if v1 (20260630) was already applied.
-- 
-- KEY CHANGE FROM V1:
--   - Use CREATE OR REPLACE instead of DROP...CASCADE for functions
--   - DROP CASCADE was breaking dependent policy references
--   - Policies are explicitly re-created after function replacement
-- ============================================================

-- -------------------------------------------------------
-- STEP 1: Replace validateMeetingParticipant safely (no CASCADE)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validateMeetingParticipant(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_valid BOOLEAN := FALSE;
  m_school_id UUID;
  u_school_id UUID;
BEGIN
  -- Check meeting exists
  SELECT school_id INTO m_school_id FROM public.ptm_meetings WHERE id = p_meeting_id;
  IF m_school_id IS NULL THEN RETURN FALSE; END IF;

  -- Check school tenant isolation
  SELECT school_id INTO u_school_id FROM public.users WHERE id = p_user_id;
  IF u_school_id IS NULL OR u_school_id != m_school_id THEN RETURN FALSE; END IF;

  -- 1. Active participant session
  SELECT EXISTS (
    SELECT 1 FROM public.ptm_participants p
    WHERE p.meeting_id = p_meeting_id AND p.user_id = p_user_id AND p.left_at IS NULL
  ) INTO is_valid;

  -- 2. Direct meeting membership fallback (handles timing window)
  IF NOT is_valid THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ptm_meetings m
      WHERE m.id = p_meeting_id
        AND (
          m.teacher_id IN (SELECT id FROM public.teachers WHERE user_id = p_user_id)
          OR m.parent_id = p_user_id
          OR m.student_id IN (SELECT id FROM public.students WHERE user_id = p_user_id)
        )
    ) INTO is_valid;
  END IF;

  -- 3. Admin/staff fallback
  IF NOT is_valid THEN
    SELECT EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_user_id
        AND u.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN',
                       'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER',
                       'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN')
    ) INTO is_valid;
  END IF;

  RETURN is_valid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -------------------------------------------------------
-- STEP 2: Replace is_meeting_participant safely (no CASCADE)
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_meeting_participant(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.validateMeetingParticipant(p_meeting_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- -------------------------------------------------------
-- STEP 3: Recreate ptm_participants policies (split INSERT/SELECT)
-- -------------------------------------------------------
DROP POLICY IF EXISTS ptm_participants_policy ON public.ptm_participants;
DROP POLICY IF EXISTS ptm_participants_select_policy ON public.ptm_participants;
DROP POLICY IF EXISTS ptm_participants_insert_policy ON public.ptm_participants;
DROP POLICY IF EXISTS ptm_participants_update_policy ON public.ptm_participants;
DROP POLICY IF EXISTS ptm_participants_delete_policy ON public.ptm_participants;

CREATE POLICY ptm_participants_select_policy ON public.ptm_participants
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

CREATE POLICY ptm_participants_insert_policy ON public.ptm_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_auth_user_school_id()
    AND user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.ptm_meetings m JOIN public.teachers t ON t.id = m.teacher_id WHERE m.id = meeting_id AND t.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.ptm_meetings m WHERE m.id = meeting_id AND m.parent_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.ptm_meetings m JOIN public.students s ON s.id = m.student_id WHERE m.id = meeting_id AND s.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.meeting_waiting_room wr WHERE wr.meeting_id = meeting_id AND wr.participant_id = auth.uid() AND wr.status = 'APPROVED')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN'))
    )
  );

CREATE POLICY ptm_participants_update_policy ON public.ptm_participants
  FOR UPDATE TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'SUPER_ADMIN')))
  );

CREATE POLICY ptm_participants_delete_policy ON public.ptm_participants
  FOR DELETE TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'SUPER_ADMIN'))
  );

-- -------------------------------------------------------
-- STEP 4: Recreate ptm_messages policies (split INSERT/SELECT)
-- -------------------------------------------------------
DROP POLICY IF EXISTS ptm_messages_policy ON public.ptm_messages;
DROP POLICY IF EXISTS ptm_messages_select_policy ON public.ptm_messages;
DROP POLICY IF EXISTS ptm_messages_insert_policy ON public.ptm_messages;
DROP POLICY IF EXISTS ptm_messages_admin_policy ON public.ptm_messages;

CREATE POLICY ptm_messages_select_policy ON public.ptm_messages
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND public.is_meeting_participant(meeting_id, auth.uid())
  );

CREATE POLICY ptm_messages_insert_policy ON public.ptm_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_auth_user_school_id()
    AND sender_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.ptm_participants p WHERE p.meeting_id = meeting_id AND p.user_id = auth.uid() AND p.left_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.ptm_meetings m JOIN public.teachers t ON t.id = m.teacher_id WHERE m.id = meeting_id AND t.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.ptm_meetings m WHERE m.id = meeting_id AND m.parent_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.ptm_meetings m JOIN public.students s ON s.id = m.student_id WHERE m.id = meeting_id AND s.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.meeting_waiting_room wr WHERE wr.meeting_id = meeting_id AND wr.participant_id = auth.uid() AND wr.status = 'APPROVED')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'SUPER_ADMIN'))
    )
  );

CREATE POLICY ptm_messages_admin_policy ON public.ptm_messages
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'SUPER_ADMIN')))
  );

-- -------------------------------------------------------
-- STEP 5: Recreate ptm_chat_attachments policies (split INSERT/SELECT)
-- -------------------------------------------------------
DROP POLICY IF EXISTS ptm_chat_attachments_policy ON public.ptm_chat_attachments;
DROP POLICY IF EXISTS ptm_chat_attachments_select_policy ON public.ptm_chat_attachments;
DROP POLICY IF EXISTS ptm_chat_attachments_insert_policy ON public.ptm_chat_attachments;
DROP POLICY IF EXISTS ptm_chat_attachments_delete_policy ON public.ptm_chat_attachments;

CREATE POLICY ptm_chat_attachments_select_policy ON public.ptm_chat_attachments
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND public.is_meeting_participant(meeting_id, auth.uid())
  );

CREATE POLICY ptm_chat_attachments_insert_policy ON public.ptm_chat_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_auth_user_school_id()
    AND sender_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.ptm_participants p WHERE p.meeting_id = meeting_id AND p.user_id = auth.uid() AND p.left_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.ptm_meetings m JOIN public.teachers t ON t.id = m.teacher_id WHERE m.id = meeting_id AND t.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.ptm_meetings m WHERE m.id = meeting_id AND m.parent_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.ptm_meetings m JOIN public.students s ON s.id = m.student_id WHERE m.id = meeting_id AND s.user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.meeting_waiting_room wr WHERE wr.meeting_id = meeting_id AND wr.participant_id = auth.uid() AND wr.status = 'APPROVED')
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'SUPER_ADMIN'))
    )
  );

CREATE POLICY ptm_chat_attachments_delete_policy ON public.ptm_chat_attachments
  FOR DELETE TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND (sender_id = auth.uid() OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('ADMIN', 'SUPER_ADMIN')))
  );

-- -------------------------------------------------------
-- STEP 6: Performance indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meeting_waiting_room_participant_meeting
  ON public.meeting_waiting_room(meeting_id, participant_id, status);

CREATE INDEX IF NOT EXISTS idx_ptm_participants_active
  ON public.ptm_participants(meeting_id, user_id) WHERE left_at IS NULL;

-- Confirm success
SELECT 'PTM RLS fix v2 applied successfully - schema cache notified!' AS result;
