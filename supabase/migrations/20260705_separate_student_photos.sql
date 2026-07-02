-- =========================================================================
-- AEGIS ERP – Student Photo Separation Migration
-- Run this in your Supabase SQL Editor (Database → SQL Editor)
-- =========================================================================

-- 1. Add registration_photo_url to public.students (Official Academic Photo)
ALTER TABLE public.students 
  ADD COLUMN IF NOT EXISTS registration_photo_url TEXT;

-- 2. Add profile_photo_url to public.users (Student Profile Photo / Avatar)
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- 3. Backpopulate official registration_photo_url from student_profiles.photo_url
UPDATE public.students s
SET registration_photo_url = sp.photo_url
FROM public.student_profiles sp
WHERE sp.student_id = s.id AND s.registration_photo_url IS NULL;

-- 4. Backpopulate profile_photo_url from legacy users.avatar_url
UPDATE public.users
SET profile_photo_url = avatar_url
WHERE profile_photo_url IS NULL;
