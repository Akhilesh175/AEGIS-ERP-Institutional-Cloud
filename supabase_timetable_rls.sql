-- Migration: Enable Row Level Security and configure INSERT, SELECT, UPDATE, DELETE policies on timetables table

-- Ensure RLS is enabled on timetables table
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;

-- 1. SELECT: Users (students, parents, teachers, admins) can view timetables of classes belonging to their school
DROP POLICY IF EXISTS "Users can view their school timetables" ON public.timetables;
CREATE POLICY "Users can view their school timetables" ON public.timetables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.classes 
    WHERE classes.id = timetables.class_id 
    AND classes.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
);

-- 2. INSERT: Teachers can insert timetable entries where they are the assigned teacher and belong to the same school
DROP POLICY IF EXISTS "Teachers can insert their own timetable entries" ON public.timetables;
CREATE POLICY "Teachers can insert their own timetable entries" ON public.timetables
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teachers 
    WHERE teachers.id = timetables.teacher_id 
    AND teachers.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
);

-- 3. UPDATE: Teachers can update their own timetable entries
DROP POLICY IF EXISTS "Teachers can update their own timetable entries" ON public.timetables;
CREATE POLICY "Teachers can update their own timetable entries" ON public.timetables
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.teachers 
    WHERE teachers.id = timetables.teacher_id 
    AND teachers.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teachers 
    WHERE teachers.id = timetables.teacher_id 
    AND teachers.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
);

-- 4. DELETE: Teachers can delete their own timetable entries
DROP POLICY IF EXISTS "Teachers can delete their own timetable entries" ON public.timetables;
CREATE POLICY "Teachers can delete their own timetable entries" ON public.timetables
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.teachers 
    WHERE teachers.id = timetables.teacher_id 
    AND teachers.school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
  )
);
