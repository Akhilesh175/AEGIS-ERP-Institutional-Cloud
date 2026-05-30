-- =====================================================================
-- AEGIS DATABASE MIGRATION: SECURE SECTION MAPPINGS & HOMEWORK STORAGE
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create Sections Table if not exists
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, -- e.g. "A", "B", "C"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (class_id, name)
);

-- 2. Add section_id columns if not exists
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL;

-- 2b. Add school_id and academic_session_id to homework_submissions if not exists
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL;

-- 3. Ensure section_id foreign key constraint in homeworks
ALTER TABLE public.homeworks DROP CONSTRAINT IF EXISTS fk_homeworks_section;
ALTER TABLE public.homeworks 
ADD CONSTRAINT fk_homeworks_section 
FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE SET NULL;

-- 4. Enable Row Level Security (RLS) on sections
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for public.sections
DROP POLICY IF EXISTS "Users can view sections in their school" ON public.sections;
CREATE POLICY "Users can view sections in their school" 
ON public.sections FOR SELECT USING (
  school_id = get_auth_user_school_id()
  OR (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
);

DROP POLICY IF EXISTS "Admins can manage sections in their school" ON public.sections;
CREATE POLICY "Admins can manage sections in their school" 
ON public.sections FOR ALL USING (
  school_id = get_auth_user_school_id()
  AND (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SUPER_ADMIN')
);

-- 6. Parse legacy class names (Grade 10-A -> Section name A) and auto-seed sections
INSERT INTO public.sections (school_id, class_id, name)
SELECT school_id, id, SPLIT_PART(name, '-', 2)
FROM public.classes
ON CONFLICT (class_id, name) DO NOTHING;

-- 7. Update existing students to link to their corresponding sections
UPDATE public.students s
SET section_id = (SELECT id FROM public.sections WHERE class_id = s.class_id LIMIT 1)
WHERE section_id IS NULL;

-- 8. Grant Access Permissions
GRANT ALL ON TABLE public.sections TO authenticated;
GRANT ALL ON TABLE public.sections TO service_role;

-- =====================================================================
-- STORAGE SETUP: SECURE 'homeworks' STORAGE BUCKET
-- =====================================================================

-- 9. Create the public 'homeworks' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'homeworks', 
  'homeworks', 
  true, 
  52428800, -- 50 MB size limit
  ARRAY[
    'application/pdf', 
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
    'image/jpeg', 
    'image/jpg',
    'image/png', 
    'application/zip',
    'application/x-zip-compressed',
    'video/mp4'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 10. Enable RLS on storage objects (Disabled since Supabase manages this system schema and enables it by default)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 11. Create storage SELECT policy so authenticated school users can view files in their school
DROP POLICY IF EXISTS "Users can view homework attachments in their school" ON storage.objects;
CREATE POLICY "Users can view homework attachments in their school"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'homeworks'
  AND (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
    OR
    SPLIT_PART(name, '/', 1) = (SELECT school_id::text FROM public.users WHERE id = auth.uid())
  )
);

-- 12. Create storage INSERT policy: Authenticated users can upload under their school folder prefix
DROP POLICY IF EXISTS "Authenticated users can upload homework files" ON storage.objects;
CREATE POLICY "Authenticated users can upload homework files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'homeworks'
  AND SPLIT_PART(name, '/', 1) = (SELECT school_id::text FROM public.users WHERE id = auth.uid())
);

-- 13. Create storage UPDATE policy: Owners or Super Admins can update
DROP POLICY IF EXISTS "Users can update their own homework files" ON storage.objects;
CREATE POLICY "Users can update their own homework files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'homeworks'
  AND (
    owner = auth.uid() 
    OR (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  )
)
WITH CHECK (
  bucket_id = 'homeworks'
  AND (
    owner = auth.uid() 
    OR (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  )
);

-- 14. Create storage DELETE policy: Owners or Super Admins can delete
DROP POLICY IF EXISTS "Users can delete their own homework files" ON storage.objects;
CREATE POLICY "Users can delete their own homework files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'homeworks'
  AND (
    owner = auth.uid() 
    OR (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  )
);
