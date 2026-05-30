-- =====================================================================
-- PARENT HOMEWORK VISIBILITY: RLS POLICIES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================
-- These policies allow parents to read homework data for their linked
-- children via parent_student_mapping.
-- =====================================================================

-- 1. Parents can SELECT homeworks assigned to their child's class
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'parents_read_child_homeworks'
      AND tablename = 'homeworks'
  ) THEN
    EXECUTE format(
      'CREATE POLICY parents_read_child_homeworks ON public.homeworks
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM public.parent_student_mapping psm
            JOIN public.students s ON s.id = psm.student_id
            JOIN public.parents p ON p.id = psm.parent_id
            WHERE p.user_id = auth.uid()
              AND s.class_id = homeworks.class_id
              AND s.school_id = homeworks.school_id
              AND (
                homeworks.section_id IS NULL
                OR s.section_id IS NULL
                OR s.section_id = homeworks.section_id
              )
          )
        )'
    );
    RAISE NOTICE 'Created policy: parents_read_child_homeworks';
  ELSE
    RAISE NOTICE 'Policy parents_read_child_homeworks already exists, skipping.';
  END IF;
END $$;

-- 2. Parents can SELECT homework_attachments for their child's homework
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'parents_read_child_homework_attachments'
      AND tablename = 'homework_attachments'
  ) THEN
    EXECUTE format(
      'CREATE POLICY parents_read_child_homework_attachments ON public.homework_attachments
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM public.homeworks h
            JOIN public.parent_student_mapping psm ON TRUE
            JOIN public.students s ON s.id = psm.student_id
            JOIN public.parents p ON p.id = psm.parent_id
            WHERE p.user_id = auth.uid()
              AND h.id = homework_attachments.homework_id
              AND s.class_id = h.class_id
              AND s.school_id = h.school_id
              AND (
                h.section_id IS NULL
                OR s.section_id IS NULL
                OR s.section_id = h.section_id
              )
          )
        )'
    );
    RAISE NOTICE 'Created policy: parents_read_child_homework_attachments';
  ELSE
    RAISE NOTICE 'Policy parents_read_child_homework_attachments already exists, skipping.';
  END IF;
END $$;

-- 3. Parents can SELECT homework_submissions for their own child only
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'parents_read_child_homework_submissions'
      AND tablename = 'homework_submissions'
  ) THEN
    EXECUTE format(
      'CREATE POLICY parents_read_child_homework_submissions ON public.homework_submissions
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1
            FROM public.parent_student_mapping psm
            JOIN public.parents p ON p.id = psm.parent_id
            WHERE p.user_id = auth.uid()
              AND psm.student_id = homework_submissions.student_id
          )
        )'
    );
    RAISE NOTICE 'Created policy: parents_read_child_homework_submissions';
  ELSE
    RAISE NOTICE 'Policy parents_read_child_homework_submissions already exists, skipping.';
  END IF;
END $$;

-- 4. Grant parents SELECT on Supabase Storage objects for homework bucket
-- =====================================================================
-- This ensures parents can download/view attachment files from storage.
-- Adjust bucket name if yours differs from 'homework-attachments'.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'parents_read_homework_storage'
      AND tablename = 'objects'
      AND schemaname = 'storage'
  ) THEN
    EXECUTE format(
      'CREATE POLICY parents_read_homework_storage ON storage.objects
        FOR SELECT
        USING (
          bucket_id = ''homework-attachments''
          AND EXISTS (
            SELECT 1
            FROM public.parents p
            WHERE p.user_id = auth.uid()
          )
        )'
    );
    RAISE NOTICE 'Created policy: parents_read_homework_storage';
  ELSE
    RAISE NOTICE 'Policy parents_read_homework_storage already exists, skipping.';
  END IF;
END $$;

-- 5. Ensure RLS is enabled on all relevant tables
-- =====================================================================
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- VERIFICATION: Check all parent homework policies exist
-- =====================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE policyname IN (
  'parents_read_child_homeworks',
  'parents_read_child_homework_attachments',
  'parents_read_child_homework_submissions',
  'parents_read_homework_storage'
)
ORDER BY tablename, policyname;
