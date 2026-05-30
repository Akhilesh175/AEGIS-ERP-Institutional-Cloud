-- =====================================================================
-- AEGIS DATABASE MIGRATION: UPGRADE HOMEWORK ATTACHMENTS & RLS POLICIES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Alter public.homework_attachments to add school_id, academic_session_id, and mime_type
ALTER TABLE public.homework_attachments ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.homework_attachments ADD COLUMN IF NOT EXISTS academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.homework_attachments ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 2. Populate school_id and academic_session_id from linked homework record
UPDATE public.homework_attachments a
SET 
  school_id = h.school_id,
  academic_session_id = h.academic_session_id
FROM public.homeworks h
WHERE a.homework_id = h.id
  AND (a.school_id IS NULL OR a.academic_session_id IS NULL);

-- 3. Enable RLS on homework_attachments
ALTER TABLE public.homework_attachments ENABLE ROW LEVEL SECURITY;

-- 4. Create SELECT policy: Users matching school_id and authorized roles can view
DROP POLICY IF EXISTS "Users can view homework attachments in their school" ON public.homework_attachments;
CREATE POLICY "Users can view homework attachments in their school"
ON public.homework_attachments FOR SELECT
USING (
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR (
    school_id = get_auth_user_school_id()
    AND (
      (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('TEACHER', 'ADMIN')
      OR
      (
        (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'STUDENT'
        AND homework_id IN (
          SELECT id FROM public.homeworks WHERE class_id = (SELECT class_id FROM public.students WHERE user_id = auth.uid() LIMIT 1)
        )
      )
      OR
      (
        (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'PARENT'
        AND homework_id IN (
          SELECT id FROM public.homeworks WHERE class_id IN (
            SELECT class_id FROM public.students WHERE id IN (
              SELECT student_id FROM public.parent_student_mapping WHERE parent_id = (
                SELECT id FROM public.parents WHERE user_id = auth.uid() LIMIT 1
              )
            )
          )
        )
      )
    )
  )
);

-- 5. Create INSERT/ALL policy: Teachers and Admins in the school can manage attachments
DROP POLICY IF EXISTS "Teachers and Admins can manage homework attachments" ON public.homework_attachments;
CREATE POLICY "Teachers and Admins can manage homework attachments"
ON public.homework_attachments FOR ALL
USING (
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR (
    school_id = get_auth_user_school_id()
    AND (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('TEACHER', 'ADMIN')
  )
)
WITH CHECK (
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR (
    school_id = get_auth_user_school_id()
    AND (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('TEACHER', 'ADMIN')
  )
);

-- 6. Grant Permissions
GRANT ALL ON TABLE public.homework_attachments TO authenticated;
GRANT ALL ON TABLE public.homework_attachments TO service_role;
