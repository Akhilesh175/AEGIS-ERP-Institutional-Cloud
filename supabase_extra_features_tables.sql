-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: DEDICATED EXTRA MODULES EXTRA SCHEMAS
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create maintenance_logs Table
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  bus_id UUID NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  cost DECIMAL NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create driver_attendance Table
CREATE TABLE IF NOT EXISTS public.driver_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'PRESENT', -- PRESENT, ABSENT, LEAVE
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT driver_attendance_uniq UNIQUE (driver_id, date)
);

-- 3. Create book_categories Table
CREATE TABLE IF NOT EXISTS public.book_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT book_category_code_uniq UNIQUE (school_id, code)
);

-- 4. Create book_returns Table
CREATE TABLE IF NOT EXISTS public.book_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL REFERENCES public.book_issues(id) ON DELETE CASCADE,
  return_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fine_amount DECIMAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'RETURNED', -- RETURNED, DAMAGED, LOST
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create library_invoices Table
CREATE TABLE IF NOT EXISTS public.library_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create exam_subjects Table
CREATE TABLE IF NOT EXISTS public.exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  max_marks DECIMAL NOT NULL DEFAULT 100,
  passing_marks DECIMAL NOT NULL DEFAULT 40,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT exam_subject_uniq UNIQUE (exam_id, subject_id)
);

-- 7. Create student_marks Table
CREATE TABLE IF NOT EXISTS public.student_marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  marks_obtained DECIMAL NOT NULL DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT student_exam_subject_uniq UNIQUE (exam_id, subject_id, student_id)
);

-- 8. Create exam_results Table
CREATE TABLE IF NOT EXISTS public.exam_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  total_marks DECIMAL NOT NULL DEFAULT 0,
  marks_obtained DECIMAL NOT NULL DEFAULT 0,
  percentage DECIMAL NOT NULL DEFAULT 0,
  grade TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PASSED', -- PASSED, FAILED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT student_exam_result_uniq UNIQUE (student_id, exam_id)
);

-- 9. Create Performance & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_bus ON public.maintenance_logs (bus_id);
CREATE INDEX IF NOT EXISTS idx_driver_attendance_driver ON public.driver_attendance (driver_id);
CREATE INDEX IF NOT EXISTS idx_book_returns_issue ON public.book_returns (issue_id);
CREATE INDEX IF NOT EXISTS idx_library_invoices_student ON public.library_invoices (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON public.exam_subjects (exam_id);
CREATE INDEX IF NOT EXISTS idx_student_marks_student ON public.student_marks (student_id);
CREATE INDEX IF NOT EXISTS idx_student_marks_exam_subject ON public.student_marks (exam_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON public.exam_results (student_id);

-- 10. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

-- 11. Define School-Scoped RLS Policies (Isolated by School ID)
DROP POLICY IF EXISTS "Users can view school maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Users can view school maintenance logs" ON public.maintenance_logs FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school driver attendance" ON public.driver_attendance;
CREATE POLICY "Users can view school driver attendance" ON public.driver_attendance FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school book categories" ON public.book_categories;
CREATE POLICY "Users can view school book categories" ON public.book_categories FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school book returns" ON public.book_returns;
CREATE POLICY "Users can view school book returns" ON public.book_returns FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school library invoices" ON public.library_invoices;
CREATE POLICY "Users can view school library invoices" ON public.library_invoices FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school exam subjects" ON public.exam_subjects;
CREATE POLICY "Users can view school exam subjects" ON public.exam_subjects FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school student marks" ON public.student_marks;
CREATE POLICY "Users can view school student marks" ON public.student_marks FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school exam results" ON public.exam_results;
CREATE POLICY "Users can view school exam results" ON public.exam_results FOR SELECT USING (school_id = get_auth_user_school_id());

-- ALL Management Policies (Restricted to Core Admin, Super Admin, and Authorized Role Operators)
-- Transport Manager Policies
DROP POLICY IF EXISTS "Transport managers manage maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Transport managers manage maintenance logs" ON public.maintenance_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

DROP POLICY IF EXISTS "Transport managers manage driver attendance" ON public.driver_attendance;
CREATE POLICY "Transport managers manage driver attendance" ON public.driver_attendance FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

-- Librarian Policies
DROP POLICY IF EXISTS "Librarians manage categories" ON public.book_categories;
CREATE POLICY "Librarians manage categories" ON public.book_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

DROP POLICY IF EXISTS "Librarians manage returns" ON public.book_returns;
CREATE POLICY "Librarians manage returns" ON public.book_returns FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

DROP POLICY IF EXISTS "Librarians manage library invoices" ON public.library_invoices;
CREATE POLICY "Librarians manage library invoices" ON public.library_invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN', 'FINANCE_ADMIN')))
);

-- Exam Controller Policies
DROP POLICY IF EXISTS "Exam controllers manage subjects mapping" ON public.exam_subjects;
CREATE POLICY "Exam controllers manage subjects mapping" ON public.exam_subjects FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
);

DROP POLICY IF EXISTS "Exam controllers manage marks" ON public.student_marks;
CREATE POLICY "Exam controllers manage marks" ON public.student_marks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
);

DROP POLICY IF EXISTS "Exam controllers manage exam results" ON public.exam_results;
CREATE POLICY "Exam controllers manage exam results" ON public.exam_results FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
);

-- 12. Enable Realtime Replication on Extra Tables
ALTER TABLE public.maintenance_logs REPLICA IDENTITY FULL;
ALTER TABLE public.driver_attendance REPLICA IDENTITY FULL;
ALTER TABLE public.book_categories REPLICA IDENTITY FULL;
ALTER TABLE public.book_returns REPLICA IDENTITY FULL;
ALTER TABLE public.library_invoices REPLICA IDENTITY FULL;
ALTER TABLE public.exam_subjects REPLICA IDENTITY FULL;
ALTER TABLE public.student_marks REPLICA IDENTITY FULL;
ALTER TABLE public.exam_results REPLICA IDENTITY FULL;

COMMENT ON TABLE public.maintenance_logs IS 'Vehicle maintenance expenses and logs.';
COMMENT ON TABLE public.driver_attendance IS 'Attendance records for transport drivers.';
COMMENT ON TABLE public.book_categories IS 'Library book genres and categories.';
COMMENT ON TABLE public.book_returns IS 'Detailed return records and overdue fine loggers.';
COMMENT ON TABLE public.library_invoices IS 'Outstanding library fines and invoices ledger.';
COMMENT ON TABLE public.exam_subjects IS 'Subject-wise marks structure for examinations.';
COMMENT ON TABLE public.student_marks IS 'Student marks obtained per subject in exams.';
COMMENT ON TABLE public.exam_results IS 'Final aggregated marks and percentages for exams.';
