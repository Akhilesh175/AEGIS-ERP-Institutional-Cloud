-- =====================================================================
-- AEGIS DATABASE MIGRATION: FIX SCHOOL DELETION (CASCADE ACADEMIC SESSIONS)
-- Run this in your Supabase SQL Editor
-- This alters academic_session_id foreign keys to ON DELETE CASCADE
-- =====================================================================

-- 1. Alter students table constraint
ALTER TABLE public.students 
  DROP CONSTRAINT IF EXISTS students_academic_session_id_fkey;
ALTER TABLE public.students 
  ADD CONSTRAINT students_academic_session_id_fkey 
  FOREIGN KEY (academic_session_id) 
  REFERENCES public.academic_sessions(id) 
  ON DELETE CASCADE;

-- 2. Alter timetables table constraint
ALTER TABLE public.timetables 
  DROP CONSTRAINT IF EXISTS timetables_academic_session_id_fkey;
ALTER TABLE public.timetables 
  ADD CONSTRAINT timetables_academic_session_id_fkey 
  FOREIGN KEY (academic_session_id) 
  REFERENCES public.academic_sessions(id) 
  ON DELETE CASCADE;

-- 3. Alter attendance table constraint
ALTER TABLE public.attendance 
  DROP CONSTRAINT IF EXISTS attendance_academic_session_id_fkey;
ALTER TABLE public.attendance 
  ADD CONSTRAINT attendance_academic_session_id_fkey 
  FOREIGN KEY (academic_session_id) 
  REFERENCES public.academic_sessions(id) 
  ON DELETE CASCADE;

-- 4. Alter assignments table constraint
ALTER TABLE public.assignments 
  DROP CONSTRAINT IF EXISTS assignments_academic_session_id_fkey;
ALTER TABLE public.assignments 
  ADD CONSTRAINT assignments_academic_session_id_fkey 
  FOREIGN KEY (academic_session_id) 
  REFERENCES public.academic_sessions(id) 
  ON DELETE CASCADE;

-- 5. Alter quizzes table constraint
ALTER TABLE public.quizzes 
  DROP CONSTRAINT IF EXISTS quizzes_academic_session_id_fkey;
ALTER TABLE public.quizzes 
  ADD CONSTRAINT quizzes_academic_session_id_fkey 
  FOREIGN KEY (academic_session_id) 
  REFERENCES public.academic_sessions(id) 
  ON DELETE CASCADE;

-- 6. Alter exams table constraint
ALTER TABLE public.exams 
  DROP CONSTRAINT IF EXISTS exams_academic_session_id_fkey;
ALTER TABLE public.exams 
  ADD CONSTRAINT exams_academic_session_id_fkey 
  FOREIGN KEY (academic_session_id) 
  REFERENCES public.academic_sessions(id) 
  ON DELETE CASCADE;

-- 7. Alter fee_structures table constraint
ALTER TABLE public.fee_structures 
  DROP CONSTRAINT IF EXISTS fee_structures_academic_session_id_fkey;
ALTER TABLE public.fee_structures 
  ADD CONSTRAINT fee_structures_academic_session_id_fkey 
  FOREIGN KEY (academic_session_id) 
  REFERENCES public.academic_sessions(id) 
  ON DELETE CASCADE;
