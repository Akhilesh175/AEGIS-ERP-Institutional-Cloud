-- =========================================================================
-- AEGIS ERP – Registration Photo Fix (MINIMAL – No enum comparisons)
-- Run in Supabase → SQL Editor → New Query → Run
-- Safe to run multiple times (IDEMPOTENT)
-- =========================================================================

-- Step 1: Add registration_photo_url column to students table
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS registration_photo_url TEXT;

-- Step 2: Add profile_photo_url column to users table  
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Step 3: Backfill existing students from student_profiles.photo_url
UPDATE public.students s
SET registration_photo_url = sp.photo_url
FROM public.student_profiles sp
WHERE sp.student_id = s.id
  AND sp.photo_url IS NOT NULL
  AND sp.photo_url <> ''
  AND (s.registration_photo_url IS NULL OR s.registration_photo_url = '');

-- Step 4: Make student-photos bucket PUBLIC
-- (required so photo URLs load in generated PDFs without authentication)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-photos',
  'student-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- Step 5: Allow anyone to READ student photos (needed for PDFs)
DROP POLICY IF EXISTS "student_photos_public_select" ON storage.objects;
CREATE POLICY "student_photos_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos');

-- Step 6: Allow any authenticated user to upload student photos
-- (the app code enforces role checks — no enum needed here)
DROP POLICY IF EXISTS "student_photos_auth_insert" ON storage.objects;
CREATE POLICY "student_photos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'student-photos');

-- Step 7: Allow any authenticated user to update student photos
DROP POLICY IF EXISTS "student_photos_auth_update" ON storage.objects;
CREATE POLICY "student_photos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'student-photos');

-- Step 8: Allow any authenticated user to delete student photos
DROP POLICY IF EXISTS "student_photos_auth_delete" ON storage.objects;
CREATE POLICY "student_photos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'student-photos');

-- Step 9: Verify — check column exists and photo counts
SELECT
  'students.registration_photo_url column' AS check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'students'
        AND column_name = 'registration_photo_url'
    ) THEN 'EXISTS ✓'
    ELSE 'MISSING ✗'
  END AS status;

SELECT
  COUNT(*) AS total_students,
  COUNT(registration_photo_url) AS students_with_photo,
  COUNT(*) - COUNT(registration_photo_url) AS students_without_photo
FROM public.students;
