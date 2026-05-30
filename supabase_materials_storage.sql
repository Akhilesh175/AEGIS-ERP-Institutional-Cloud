-- =====================================================================
-- AEGIS DATABASE MIGRATION: SECURE STUDY MATERIALS & VIDEO LECTURES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create the public 'materials' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'materials', 
  'materials', 
  true, 
  104857600, -- 100 MB size limit for large video lectures
  ARRAY[
    'application/pdf', 
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'video/mp4', 
    'video/quicktime', 
    'video/webm', 
    'video/ogg', 
    'video/x-msvideo'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Enable RLS on storage objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Create public SELECT policy so students/parents can stream videos seamlessly via CDN
DROP POLICY IF EXISTS "Public Materials Reading" ON storage.objects;
CREATE POLICY "Public Materials Reading" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'materials');

-- 4. Create secure mutation policies for 'materials' bucket
-- Authenticated users who are TEACHER, ADMIN, or SUPER_ADMIN can upload, replace, or delete
DROP POLICY IF EXISTS "Authorized Faculty Materials Mutation" ON storage.objects;
CREATE POLICY "Authorized Faculty Materials Mutation" 
ON storage.objects FOR ALL 
TO authenticated 
USING (
  bucket_id = 'materials' 
  AND (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  )
)
WITH CHECK (
  bucket_id = 'materials' 
  AND (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('TEACHER', 'ADMIN', 'SUPER_ADMIN')
  )
);

-- 5. Enrich study_materials table columns
-- Relax the old file_type check constraint to support 'stream' live stream format
ALTER TABLE public.study_materials DROP CONSTRAINT IF EXISTS study_materials_file_type_check;

-- Add new columns safely
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE public.study_materials ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 6. Legacy Data Migration
-- Populate new metadata fields for existing study materials
DO $$
DECLARE
  r RECORD;
  v_user_id UUID;
  v_session_id UUID;
  v_default_class_id UUID;
BEGIN
  FOR r IN SELECT * FROM public.study_materials LOOP
    -- Resolve user_id of the uploading teacher
    IF r.teacher_id IS NOT NULL THEN
      SELECT user_id INTO v_user_id FROM public.teachers WHERE id = r.teacher_id LIMIT 1;
    ELSE
      -- Fallback to first ADMIN / SUPER_ADMIN in the school
      SELECT id INTO v_user_id FROM public.users WHERE school_id = r.school_id AND role IN ('ADMIN', 'SUPER_ADMIN') LIMIT 1;
    END IF;

    -- Resolve active academic session
    SELECT id INTO v_session_id FROM public.academic_sessions WHERE school_id = r.school_id AND is_current = true LIMIT 1;

    -- Resolve first class of the school as default class_id
    SELECT id INTO v_default_class_id FROM public.classes WHERE school_id = r.school_id LIMIT 1;

    -- Update existing records
    UPDATE public.study_materials 
    SET 
      uploaded_by = COALESCE(v_user_id, r.teacher_id), -- fallback
      academic_session_id = v_session_id,
      class_id = COALESCE(class_id, v_default_class_id)
    WHERE id = r.id;
  END LOOP;
END
$$;

-- Make uploaded_by NOT NULL after migration
ALTER TABLE public.study_materials ALTER COLUMN uploaded_by SET NOT NULL;

-- 7. Update public.study_materials RLS Policies for class isolation
DROP POLICY IF EXISTS "Users can view school study materials" ON public.study_materials;
CREATE POLICY "Users can view school study materials" 
ON public.study_materials FOR SELECT USING (
  -- Super Admin sees all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR
  -- Users must match school ID boundary
  (
    school_id = get_auth_user_school_id()
    AND (
      -- Teachers/Admins see all materials in their school
      (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('TEACHER', 'ADMIN')
      OR
      -- Students see only unassigned class_id OR matching homeroom class_id
      (
        (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'STUDENT'
        AND (
          class_id IS NULL 
          OR class_id = (SELECT class_id FROM public.students WHERE user_id = auth.uid() LIMIT 1)
        )
      )
      OR
      -- Parents see only matching homeroom class_id for their linked students
      (
        (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'PARENT'
        AND (
          class_id IS NULL
          OR class_id IN (
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

DROP POLICY IF EXISTS "Teachers can manage school study materials" ON public.study_materials;
CREATE POLICY "Teachers can manage school study materials" 
ON public.study_materials FOR ALL USING (
  -- Super Admin manages all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR
  -- Admins manage all within their school
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'ADMIN'
    AND school_id = get_auth_user_school_id()
  )
  OR
  -- Teachers manage their own uploaded materials
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'TEACHER'
    AND school_id = get_auth_user_school_id()
    AND uploaded_by = auth.uid()
  )
);

-- 8. Grant Access Permissions
GRANT ALL ON TABLE public.study_materials TO authenticated;
GRANT ALL ON TABLE public.study_materials TO service_role;
