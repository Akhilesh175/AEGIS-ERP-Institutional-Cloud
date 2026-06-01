-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: STRICT SCHOOL-SCOPED RBAC ISOLATION FIX
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. FINANCE ADMIN ISOLATION POLICIES
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Finance admins manage fee billing" ON public.invoices;
CREATE POLICY "Finance admins manage fee billing" ON public.invoices FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')))
);

DROP POLICY IF EXISTS "Finance admins manage payments" ON public.payment_logs;
CREATE POLICY "Finance admins manage payments" ON public.payment_logs FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')))
);

DROP POLICY IF EXISTS "Finance admins manage transit fees" ON public.transport_fee_records;
CREATE POLICY "Finance admins manage transit fees" ON public.transport_fee_records FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'TRANSPORT_MANAGER')))
);

-- ---------------------------------------------------------------------
-- 2. EXAM CONTROLLER ISOLATION POLICIES
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Exam controllers manage report cards" ON public.report_cards;
CREATE POLICY "Exam controllers manage report cards" ON public.report_cards FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
);

DROP POLICY IF EXISTS "Exam controllers manage quiz results" ON public.quiz_results;
CREATE POLICY "Exam controllers manage quiz results" ON public.quiz_results FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
);

DROP POLICY IF EXISTS "Exam controllers manage subjects mapping" ON public.exam_subjects;
CREATE POLICY "Exam controllers manage subjects mapping" ON public.exam_subjects FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
);

DROP POLICY IF EXISTS "Exam controllers manage marks" ON public.student_marks;
CREATE POLICY "Exam controllers manage marks" ON public.student_marks FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
);

DROP POLICY IF EXISTS "Exam controllers manage exam results" ON public.exam_results;
CREATE POLICY "Exam controllers manage exam results" ON public.exam_results FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
);

-- Core Exams Table
DROP POLICY IF EXISTS "Authenticated users can manage exams" ON public.exams;
CREATE POLICY "Authenticated users can manage exams" ON public.exams FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
);

-- Core Gradebooks Table
DROP POLICY IF EXISTS "Authenticated users can manage gradebooks" ON public.gradebooks;
CREATE POLICY "Authenticated users can manage gradebooks" ON public.gradebooks FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
);


-- ---------------------------------------------------------------------
-- 3. LIBRARIAN ISOLATION POLICIES
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Librarians manage inventory" ON public.book_inventory;
CREATE POLICY "Librarians manage inventory" ON public.book_inventory FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

DROP POLICY IF EXISTS "Librarians manage digital assets" ON public.digital_library_assets;
CREATE POLICY "Librarians manage digital assets" ON public.digital_library_assets FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

DROP POLICY IF EXISTS "Librarians manage categories" ON public.book_categories;
CREATE POLICY "Librarians manage categories" ON public.book_categories FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

DROP POLICY IF EXISTS "Librarians manage returns" ON public.book_returns;
CREATE POLICY "Librarians manage returns" ON public.book_returns FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

DROP POLICY IF EXISTS "Librarians manage library invoices" ON public.library_invoices;
CREATE POLICY "Librarians manage library invoices" ON public.library_invoices FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN', 'FINANCE_ADMIN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN', 'FINANCE_ADMIN')))
);

-- Core Books Table
DROP POLICY IF EXISTS "Authenticated users can manage books" ON public.books;
CREATE POLICY "Authenticated users can manage books" ON public.books FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

-- Core Book Issues Table
DROP POLICY IF EXISTS "Authenticated users can manage book_issues" ON public.book_issues;
CREATE POLICY "Authenticated users can manage book_issues" ON public.book_issues FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

-- Core Library Fines Table
DROP POLICY IF EXISTS "Authenticated users can manage library_fines" ON public.library_fines;
CREATE POLICY "Authenticated users can manage library_fines" ON public.library_fines FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN', 'FINANCE_ADMIN')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN', 'FINANCE_ADMIN')))
);


-- ---------------------------------------------------------------------
-- 4. TRANSPORT MANAGER ISOLATION POLICIES
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Transport managers manage drivers" ON public.drivers;
CREATE POLICY "Transport managers manage drivers" ON public.drivers FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

DROP POLICY IF EXISTS "Transport managers manage pickup points" ON public.pickup_points;
CREATE POLICY "Transport managers manage pickup points" ON public.pickup_points FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

DROP POLICY IF EXISTS "Transport managers manage logs" ON public.vehicle_logs;
CREATE POLICY "Transport managers manage logs" ON public.vehicle_logs FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

DROP POLICY IF EXISTS "Transport managers manage maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Transport managers manage maintenance logs" ON public.maintenance_logs FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

DROP POLICY IF EXISTS "Transport managers manage driver attendance" ON public.driver_attendance;
CREATE POLICY "Transport managers manage driver attendance" ON public.driver_attendance FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

-- Core Buses Table
DROP POLICY IF EXISTS "Authenticated users can manage buses" ON public.buses;
CREATE POLICY "Authenticated users can manage buses" ON public.buses FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

-- Core Routes Table
DROP POLICY IF EXISTS "Authenticated users can manage routes" ON public.routes;
CREATE POLICY "Authenticated users can manage routes" ON public.routes FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

-- Core Transport Assignments Table
DROP POLICY IF EXISTS "Authenticated users can manage transport_assignments" ON public.transport_assignments;
CREATE POLICY "Authenticated users can manage transport_assignments" ON public.transport_assignments FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

-- ---------------------------------------------------------------------
-- 5. SUB-ADMIN PROFILE MANAGERS ISOLATION (Only Core Admins Manage These)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can manage school finance admins" ON public.finance_admins;
CREATE POLICY "Admins can manage school finance admins" ON public.finance_admins FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school academic admins" ON public.academic_admins;
CREATE POLICY "Admins can manage school academic admins" ON public.academic_admins FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school exam controllers" ON public.exam_controllers;
CREATE POLICY "Admins can manage school exam controllers" ON public.exam_controllers FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school librarians" ON public.librarians;
CREATE POLICY "Admins can manage school librarians" ON public.librarians FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school transport managers" ON public.transport_managers;
CREATE POLICY "Admins can manage school transport managers" ON public.transport_managers FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

DROP POLICY IF EXISTS "Admins can manage school custom sub admins" ON public.custom_sub_admins;
CREATE POLICY "Admins can manage school custom sub admins" ON public.custom_sub_admins FOR ALL 
USING (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
)
WITH CHECK (
  school_id = get_auth_user_school_id() AND 
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role IN ('ADMIN', 'SUPER_ADMIN'))
);

-- Done. All RLS policies for extra modules and admin profiles now strictly enforce `school_id = get_auth_user_school_id()`.
