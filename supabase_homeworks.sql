-- =====================================================================
-- AEGIS DATABASE MIGRATION: SECURE HOMEWORKS & SUBMISSIONS MODULE
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create Homeworks Table
CREATE TABLE IF NOT EXISTS public.homeworks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
  section_id UUID, -- Optional section boundary
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT,
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  attachment_url TEXT,
  status TEXT DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create Homework Submissions Table
CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  homework_id UUID REFERENCES public.homeworks(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  submission_text TEXT,
  submitted_file_url TEXT,
  marks NUMERIC,
  remarks TEXT,
  submission_status TEXT DEFAULT 'SUBMITTED' CHECK (submission_status IN ('SUBMITTED', 'GRADED', 'REJECTED')),
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  graded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (homework_id, student_id)
);

-- 3. Create Homework Attachments Table
CREATE TABLE IF NOT EXISTS public.homework_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  homework_id UUID REFERENCES public.homeworks(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.homeworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_attachments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for homeworks
DROP POLICY IF EXISTS "Users can view assigned homeworks" ON public.homeworks;
CREATE POLICY "Users can view assigned homeworks" 
ON public.homeworks FOR SELECT USING (
  -- Super Admin sees all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR
  -- Users must match school ID boundary
  (
    school_id = get_auth_user_school_id()
    AND (
      -- Teachers/Admins see all homework in their school
      (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('TEACHER', 'ADMIN')
      OR
      -- Students see only matching homeroom class_id
      (
        (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'STUDENT'
        AND class_id = (SELECT class_id FROM public.students WHERE user_id = auth.uid() LIMIT 1)
      )
      OR
      -- Parents see only matching class_id for their linked students
      (
        (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'PARENT'
        AND class_id IN (
          SELECT class_id FROM public.students WHERE id IN (
            SELECT student_id FROM public.parent_student_mapping WHERE parent_id = (
              SELECT id FROM public.parents WHERE user_id = auth.uid() LIMIT 1
            )
          )
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "Teachers can manage homeworks" ON public.homeworks;
CREATE POLICY "Teachers can manage homeworks" 
ON public.homeworks FOR ALL USING (
  -- Super Admin manages all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR
  -- Admins manage all within their school
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'ADMIN'
    AND school_id = get_auth_user_school_id()
  )
  OR
  -- Teachers manage their own uploaded homeworks
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'TEACHER'
    AND school_id = get_auth_user_school_id()
    AND teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1)
  )
);

-- 6. RLS Policies for homework_submissions
DROP POLICY IF EXISTS "Users can view submissions" ON public.homework_submissions;
CREATE POLICY "Users can view submissions" 
ON public.homework_submissions FOR SELECT USING (
  -- Super Admin / Admins see all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN')
  OR
  -- Teachers see submissions for homework they created
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'TEACHER'
    AND homework_id IN (
      SELECT id FROM public.homeworks WHERE teacher_id = (
        SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1
      )
    )
  )
  OR
  -- Students see their own submissions
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'STUDENT'
    AND student_id = (SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1)
  )
  OR
  -- Parents see their linked student's submissions
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'PARENT'
    AND student_id IN (
      SELECT student_id FROM public.parent_student_mapping WHERE parent_id = (
        SELECT id FROM public.parents WHERE user_id = auth.uid() LIMIT 1
      )
    )
  )
);

DROP POLICY IF EXISTS "Students can insert own submissions" ON public.homework_submissions;
CREATE POLICY "Students can insert own submissions" 
ON public.homework_submissions FOR INSERT WITH CHECK (
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'STUDENT'
  AND student_id = (SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Students can update own submissions" ON public.homework_submissions;
CREATE POLICY "Students can update own submissions" 
ON public.homework_submissions FOR UPDATE USING (
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'STUDENT'
  AND student_id = (SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "Teachers can grade submissions" ON public.homework_submissions;
CREATE POLICY "Teachers can grade submissions" 
ON public.homework_submissions FOR UPDATE USING (
  (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER')
);

-- 7. Grant Access Permissions
GRANT ALL ON TABLE public.homeworks TO authenticated;
GRANT ALL ON TABLE public.homeworks TO service_role;
GRANT ALL ON TABLE public.homework_submissions TO authenticated;
GRANT ALL ON TABLE public.homework_submissions TO service_role;
GRANT ALL ON TABLE public.homework_attachments TO authenticated;
GRANT ALL ON TABLE public.homework_attachments TO service_role;
