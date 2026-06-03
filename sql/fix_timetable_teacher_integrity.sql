-- 1. Add index on timetables.teacher_id for FK performance
CREATE INDEX IF NOT EXISTS idx_timetables_teacher_id ON public.timetables(teacher_id);

-- 2. Add index on teachers.school_id for filtering
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON public.teachers(school_id);

-- 3. Add index on users.school_id + role for teacher queries
CREATE INDEX IF NOT EXISTS idx_users_school_id_role ON public.users(school_id, role);

-- 4. Verify foreign key exists (it already does based on error message)
-- timetables.teacher_id -> teachers.id  (timetables_teacher_id_fkey)

-- 5. Clean up any orphan timetable references (safety check)
-- DELETE FROM public.timetables 
-- WHERE teacher_id IS NOT NULL 
--   AND teacher_id NOT IN (SELECT id FROM public.teachers);
