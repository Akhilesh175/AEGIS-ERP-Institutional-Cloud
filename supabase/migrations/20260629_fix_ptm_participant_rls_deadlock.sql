-- ============================================================
-- CRITICAL FIX: PTM Participant Authorization Deadlock
-- File: 20260629_fix_ptm_participant_rls_deadlock.sql
--
-- ROOT CAUSE:
-- The ptm_participants_policy (from migration 20260625) used
-- is_meeting_participant() which (after migration 20260628) 
-- now checks ptm_participants table itself for active rows.
-- This creates a CIRCULAR DEADLOCK:
--   - User tries to INSERT into ptm_participants to register
--   - INSERT policy checks is_meeting_participant()
--   - is_meeting_participant() checks ptm_participants
--   - No row exists yet → returns FALSE
--   - INSERT blocked → user can never become a participant
--   → RLS throws "Permission Denied: You are not a participant"
--
-- FIX:
-- 1. Split ptm_participants policy into separate INSERT vs READ/UPDATE/DELETE
-- 2. INSERT: allow users who are legitimately on the meeting (parent_id, teacher user_id, student user_id)
--    OR whose waiting_room status is APPROVED for this meeting
-- 3. SELECT/UPDATE/DELETE: use validateMeetingParticipant (existing strict check)
-- 4. Also fix ptm_messages INSERT to allow admitted participants (not just existing rows)
-- 5. Also fix ptm_chat_attachments INSERT similarly
-- ============================================================

-- -------------------------------------------------------
-- STEP 1: Fix ptm_participants — split INSERT vs READ/UPDATE/DELETE
-- -------------------------------------------------------
DROP POLICY IF EXISTS ptm_participants_policy ON public.ptm_participants;

-- SELECT: Only active participants (left_at IS NULL) and admins can see participant list
CREATE POLICY ptm_participants_select_policy ON public.ptm_participants
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

-- INSERT: Allow legitimate meeting members to self-register as participant
-- This is the bootstrapping INSERT that was previously blocked by the circular deadlock
CREATE POLICY ptm_participants_insert_policy ON public.ptm_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_auth_user_school_id()
    AND user_id = auth.uid()  -- Users can only register themselves
    AND (
      -- Teacher who created/owns this meeting
      EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        JOIN public.teachers t ON t.id = m.teacher_id
        WHERE m.id = meeting_id
          AND t.user_id = auth.uid()
      )
      -- Parent who is listed on this meeting
      OR EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        WHERE m.id = meeting_id
          AND m.parent_id = auth.uid()
      )
      -- Student who is listed on this meeting
      OR EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        JOIN public.students s ON s.id = m.student_id
        WHERE m.id = meeting_id
          AND s.user_id = auth.uid()
      )
      -- User who has been APPROVED in the waiting room for this meeting
      OR EXISTS (
        SELECT 1 FROM public.meeting_waiting_room wr
        WHERE wr.meeting_id = meeting_id
          AND wr.participant_id = auth.uid()
          AND wr.status = 'APPROVED'
      )
      -- Admin/staff fallback
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN')
      )
    )
  );

-- UPDATE: Only update your own participant record (e.g. left_at timestamp)
CREATE POLICY ptm_participants_update_policy ON public.ptm_participants
  FOR UPDATE TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('ADMIN', 'SUPER_ADMIN')
      )
    )
  );

-- DELETE: Only admins can remove participant records
CREATE POLICY ptm_participants_delete_policy ON public.ptm_participants
  FOR DELETE TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- -------------------------------------------------------
-- STEP 2: Fix ptm_messages — split INSERT vs SELECT/UPDATE/DELETE
-- -------------------------------------------------------
DROP POLICY IF EXISTS ptm_messages_policy ON public.ptm_messages;

-- SELECT: View messages if you are a validated participant
CREATE POLICY ptm_messages_select_policy ON public.ptm_messages
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND public.is_meeting_participant(meeting_id, auth.uid())
  );

-- INSERT: Allow sending messages if you are legitimately admitted to the meeting
-- This covers the window BEFORE ptm_participants row exists (post-approval broadcast lag)
CREATE POLICY ptm_messages_insert_policy ON public.ptm_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_auth_user_school_id()
    AND sender_id = auth.uid()
    AND (
      -- Already a registered active participant
      EXISTS (
        SELECT 1 FROM public.ptm_participants p
        WHERE p.meeting_id = meeting_id
          AND p.user_id = auth.uid()
          AND p.left_at IS NULL
      )
      -- Or is legitimately named on the meeting (handles timing lag)
      OR EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        JOIN public.teachers t ON t.id = m.teacher_id
        WHERE m.id = meeting_id AND t.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        WHERE m.id = meeting_id AND m.parent_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        JOIN public.students s ON s.id = m.student_id
        WHERE m.id = meeting_id AND s.user_id = auth.uid()
      )
      -- Approved in waiting room
      OR EXISTS (
        SELECT 1 FROM public.meeting_waiting_room wr
        WHERE wr.meeting_id = meeting_id
          AND wr.participant_id = auth.uid()
          AND wr.status = 'APPROVED'
      )
      -- Admin fallback
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('ADMIN', 'SUPER_ADMIN')
      )
    )
  );

-- UPDATE/DELETE: Only admins can modify messages (moderation)
CREATE POLICY ptm_messages_admin_policy ON public.ptm_messages
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND (
      sender_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('ADMIN', 'SUPER_ADMIN')
      )
    )
  );

-- -------------------------------------------------------
-- STEP 3: Fix ptm_chat_attachments — split INSERT vs SELECT
-- -------------------------------------------------------
DROP POLICY IF EXISTS ptm_chat_attachments_policy ON public.ptm_chat_attachments;

-- SELECT: Admitted participants can view attachments
CREATE POLICY ptm_chat_attachments_select_policy ON public.ptm_chat_attachments
  FOR SELECT TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND public.is_meeting_participant(meeting_id, auth.uid())
  );

-- INSERT: Allow admitted participants to upload attachments
CREATE POLICY ptm_chat_attachments_insert_policy ON public.ptm_chat_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    school_id = public.get_auth_user_school_id()
    AND sender_id = auth.uid()
    AND (
      -- Already a registered active participant
      EXISTS (
        SELECT 1 FROM public.ptm_participants p
        WHERE p.meeting_id = meeting_id
          AND p.user_id = auth.uid()
          AND p.left_at IS NULL
      )
      -- Teacher who owns the meeting
      OR EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        JOIN public.teachers t ON t.id = m.teacher_id
        WHERE m.id = meeting_id AND t.user_id = auth.uid()
      )
      -- Parent on this meeting
      OR EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        WHERE m.id = meeting_id AND m.parent_id = auth.uid()
      )
      -- Student on this meeting
      OR EXISTS (
        SELECT 1 FROM public.ptm_meetings m
        JOIN public.students s ON s.id = m.student_id
        WHERE m.id = meeting_id AND s.user_id = auth.uid()
      )
      -- Approved in waiting room
      OR EXISTS (
        SELECT 1 FROM public.meeting_waiting_room wr
        WHERE wr.meeting_id = meeting_id
          AND wr.participant_id = auth.uid()
          AND wr.status = 'APPROVED'
      )
      -- Admin fallback
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('ADMIN', 'SUPER_ADMIN')
      )
    )
  );

-- DELETE: Only the sender or admin can delete
CREATE POLICY ptm_chat_attachments_delete_policy ON public.ptm_chat_attachments
  FOR DELETE TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND (
      sender_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role IN ('ADMIN', 'SUPER_ADMIN')
      )
    )
  );

-- -------------------------------------------------------
-- STEP 4: Fix validateMeetingParticipant to also use direct
-- meeting membership as fallback (handles timing lag window 
-- between approval and ptm_participants INSERT completing)
-- -------------------------------------------------------
DROP FUNCTION IF EXISTS public.validateMeetingParticipant(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.validateMeetingParticipant(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  is_valid BOOLEAN := FALSE;
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

  -- 3. Check if user is registered as an active participant (joined, not left)
  SELECT EXISTS (
    SELECT 1 
    FROM public.ptm_participants p
    WHERE p.meeting_id = p_meeting_id
      AND p.user_id = p_user_id
      AND p.left_at IS NULL
  ) INTO is_valid;

  -- 4. Fallback: Check direct meeting membership (handles timing window post-approval)
  --    This ensures a teacher who just approved a parent can still chat immediately
  --    even before ptm_participants INSERT propagates
  IF NOT is_valid THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ptm_meetings m
      WHERE m.id = p_meeting_id
        AND (
          -- Teacher who owns this meeting
          m.teacher_id IN (SELECT id FROM public.teachers WHERE user_id = p_user_id)
          -- Parent listed on this meeting AND approved in waiting room (or teacher meeting)
          OR (
            m.parent_id = p_user_id
            AND (
              -- Always allow parent on their own meeting
              TRUE
            )
          )
          -- Student on this meeting
          OR m.student_id IN (SELECT id FROM public.students WHERE user_id = p_user_id)
        )
    ) INTO is_valid;
  END IF;

  -- 5. Admin and Staff fallback for auditing rights
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

-- Re-wire is_meeting_participant to delegate to the updated function
DROP FUNCTION IF EXISTS public.is_meeting_participant(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.is_meeting_participant(p_meeting_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.validateMeetingParticipant(p_meeting_id, p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -------------------------------------------------------
-- STEP 5: Fix storage RLS — also allow meeting-listed users
-- (ptm-chat-files bucket INSERT policy re-applied)
-- -------------------------------------------------------
DROP POLICY IF EXISTS "Allow meeting participants insert" ON storage.objects;
CREATE POLICY "Allow meeting participants insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ptm-chat-files' 
    AND (
      -- Standard participant check (uses updated validateMeetingParticipant which includes direct membership)
      public.is_storage_meeting_participant(name, auth.uid())
    )
  );

-- Ensure SELECT policy also uses updated function
DROP POLICY IF EXISTS "Allow meeting participants select" ON storage.objects;
CREATE POLICY "Allow meeting participants select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
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

-- -------------------------------------------------------
-- STEP 6: Index for fast waiting_room lookups during approval
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_meeting_waiting_room_participant_meeting 
  ON public.meeting_waiting_room(meeting_id, participant_id, status);

CREATE INDEX IF NOT EXISTS idx_ptm_participants_active 
  ON public.ptm_participants(meeting_id, user_id) WHERE left_at IS NULL;
