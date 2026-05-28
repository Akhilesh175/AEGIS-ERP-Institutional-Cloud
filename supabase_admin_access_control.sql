-- =====================================================================
-- AEGIS DATABASE SECURITY FIX: MULTI-TENANT SCHOOL RLS ISOLATION
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Helper function to fetch the auth user's school_id bypassing RLS
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. Ensure RLS is active on ALL tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;

-- 3. USERS SELECT policy
DROP POLICY IF EXISTS "Users can view other users in their school" ON public.users;
CREATE POLICY "Users can view other users in their school" 
ON public.users FOR SELECT USING (
  id = auth.uid() OR 
  school_id = get_auth_user_school_id()
);

-- 4. ACADEMIC SESSIONS SELECT policy
DROP POLICY IF EXISTS "Users can view their school sessions" ON public.academic_sessions;
CREATE POLICY "Users can view their school sessions" 
ON public.academic_sessions FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 5. CLASSES SELECT policy
DROP POLICY IF EXISTS "Users can view their school classes" ON public.classes;
CREATE POLICY "Users can view their school classes" 
ON public.classes FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 6. SUBJECTS SELECT policy
DROP POLICY IF EXISTS "Users can view their school subjects" ON public.subjects;
CREATE POLICY "Users can view their school subjects" 
ON public.subjects FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 7. TEACHERS SELECT policy
DROP POLICY IF EXISTS "Users can view their school teachers" ON public.teachers;
CREATE POLICY "Users can view their school teachers" 
ON public.teachers FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 8. STUDENTS SELECT policy
DROP POLICY IF EXISTS "Users can view their school students" ON public.students;
CREATE POLICY "Users can view their school students" 
ON public.students FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 9. PARENTS SELECT policy
DROP POLICY IF EXISTS "Users can view their school parents" ON public.parents;
CREATE POLICY "Users can view their school parents" 
ON public.parents FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 10. PARENT-STUDENT MAPPING SELECT policy
DROP POLICY IF EXISTS "Users can view mappings" ON public.parent_student_mapping;
CREATE POLICY "Users can view mappings" 
ON public.parent_student_mapping FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.students 
    WHERE students.id = parent_student_mapping.student_id 
    AND students.school_id = get_auth_user_school_id()
  )
);

-- 11. TIMETABLES SELECT policy
DROP POLICY IF EXISTS "Users can view their school timetables" ON public.timetables;
CREATE POLICY "Users can view their school timetables" 
ON public.timetables FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.classes 
    WHERE classes.id = timetables.class_id 
    AND classes.school_id = get_auth_user_school_id()
  )
);

-- 12. ATTENDANCE SELECT policy
DROP POLICY IF EXISTS "Users can view their school attendance" ON public.attendance;
CREATE POLICY "Users can view their school attendance" 
ON public.attendance FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.students 
    WHERE students.id = attendance.student_id 
    AND students.school_id = get_auth_user_school_id()
  )
);

-- 13. ASSIGNMENTS SELECT policy
DROP POLICY IF EXISTS "Users can view their school assignments" ON public.assignments;
CREATE POLICY "Users can view their school assignments" 
ON public.assignments FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 14. QUIZZES SELECT policy
DROP POLICY IF EXISTS "Users can view their school quizzes" ON public.quizzes;
CREATE POLICY "Users can view their school quizzes" 
ON public.quizzes FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 15. FEE STRUCTURES SELECT policy
DROP POLICY IF EXISTS "Users can view their school fee structures" ON public.fee_structures;
CREATE POLICY "Users can view their school fee structures" 
ON public.fee_structures FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 16. FEE PAYMENTS SELECT policy
DROP POLICY IF EXISTS "Users can view their school fee payments" ON public.fee_payments;
CREATE POLICY "Users can view their school fee payments" 
ON public.fee_payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.students 
    WHERE students.id = fee_payments.student_id 
    AND students.school_id = get_auth_user_school_id()
  )
);
