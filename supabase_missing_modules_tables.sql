-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: DEDICATED EXTRA MODULES TABLES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create drivers Table
CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  license_number TEXT NOT NULL,
  phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create pickup_points Table
CREATE TABLE IF NOT EXISTS public.pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  latitude DECIMAL,
  longitude DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create vehicle_logs Table
CREATE TABLE IF NOT EXISTS public.vehicle_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  bus_id UUID REFERENCES public.buses(id) ON DELETE CASCADE,
  log_type TEXT NOT NULL, -- MAINTENANCE, TRIP_START, TRIP_END, FUEL
  description TEXT,
  amount DECIMAL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create book_inventory Table
CREATE TABLE IF NOT EXISTS public.book_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  barcode TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE', -- AVAILABLE, ISSUED, DAMAGED, LOST
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create digital_library_assets Table
CREATE TABLE IF NOT EXISTS public.digital_library_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  author TEXT,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'pdf', -- pdf, epub, docx, mp4
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create report_cards Table
CREATE TABLE IF NOT EXISTS public.report_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  term TEXT NOT NULL, -- TERM 1, TERM 2, FINAL
  attendance_percentage DECIMAL,
  grade_point_average DECIMAL,
  remarks TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create quiz_results Table
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  quiz_id UUID REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  score DECIMAL NOT NULL,
  total_marks DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID, PARTIAL
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create payment_logs Table
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID REFERENCES public.academic_sessions(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  transaction_reference TEXT UNIQUE NOT NULL,
  payment_method TEXT NOT NULL,
  log_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create transport_fee_records Table
CREATE TABLE IF NOT EXISTS public.transport_fee_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNPAID', -- UNPAID, PAID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Create Performance & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_drivers_school ON public.drivers (school_id);
CREATE INDEX IF NOT EXISTS idx_pickup_points_school ON public.pickup_points (school_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_school ON public.vehicle_logs (school_id);
CREATE INDEX IF NOT EXISTS idx_book_inventory_school ON public.book_inventory (school_id);
CREATE INDEX IF NOT EXISTS idx_digital_assets_school ON public.digital_library_assets (school_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_school ON public.report_cards (school_id);
CREATE INDEX IF NOT EXISTS idx_report_cards_student ON public.report_cards (student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_school ON public.quiz_results (school_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_student ON public.quiz_results (student_id);
CREATE INDEX IF NOT EXISTS idx_invoices_school ON public.invoices (school_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student ON public.invoices (student_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_school ON public.payment_logs (school_id);
CREATE INDEX IF NOT EXISTS idx_transport_fees_school ON public.transport_fee_records (school_id);
CREATE INDEX IF NOT EXISTS idx_transport_fees_student ON public.transport_fee_records (student_id);

-- 12. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_library_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_fee_records ENABLE ROW LEVEL SECURITY;

-- 13. Define School-Scoped RLS Policies
-- SELECT Policies (Isolated by School ID)
DROP POLICY IF EXISTS "Users can view school drivers" ON public.drivers;
CREATE POLICY "Users can view school drivers" ON public.drivers FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school pickup points" ON public.pickup_points;
CREATE POLICY "Users can view school pickup points" ON public.pickup_points FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school vehicle logs" ON public.vehicle_logs;
CREATE POLICY "Users can view school vehicle logs" ON public.vehicle_logs FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school book inventory" ON public.book_inventory;
CREATE POLICY "Users can view school book inventory" ON public.book_inventory FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school digital assets" ON public.digital_library_assets;
CREATE POLICY "Users can view school digital assets" ON public.digital_library_assets FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school report cards" ON public.report_cards;
CREATE POLICY "Users can view school report cards" ON public.report_cards FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school quiz results" ON public.quiz_results;
CREATE POLICY "Users can view school quiz results" ON public.quiz_results FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school invoices" ON public.invoices;
CREATE POLICY "Users can view school invoices" ON public.invoices FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school payment logs" ON public.payment_logs;
CREATE POLICY "Users can view school payment logs" ON public.payment_logs FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school transport fees" ON public.transport_fee_records;
CREATE POLICY "Users can view school transport fees" ON public.transport_fee_records FOR SELECT USING (school_id = get_auth_user_school_id());

-- ALL Management Policies (Restricted to Core Admin, Super Admin, and Authorized Role Operators)
-- Finance Admin Policies
DROP POLICY IF EXISTS "Finance admins manage fee billing" ON public.invoices;
CREATE POLICY "Finance admins manage fee billing" ON public.invoices FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')))
);

DROP POLICY IF EXISTS "Finance admins manage payments" ON public.payment_logs;
CREATE POLICY "Finance admins manage payments" ON public.payment_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')))
);

DROP POLICY IF EXISTS "Finance admins manage transit fees" ON public.transport_fee_records;
CREATE POLICY "Finance admins manage transit fees" ON public.transport_fee_records FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'TRANSPORT_MANAGER')))
);

-- Exam Controller Policies
DROP POLICY IF EXISTS "Exam controllers manage report cards" ON public.report_cards;
CREATE POLICY "Exam controllers manage report cards" ON public.report_cards FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER')))
);

DROP POLICY IF EXISTS "Exam controllers manage quiz results" ON public.quiz_results;
CREATE POLICY "Exam controllers manage quiz results" ON public.quiz_results FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'EXAM_CONTROLLER', 'TEACHER')))
);

-- Librarian Policies
DROP POLICY IF EXISTS "Librarians manage inventory" ON public.book_inventory;
CREATE POLICY "Librarians manage inventory" ON public.book_inventory FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

DROP POLICY IF EXISTS "Librarians manage digital assets" ON public.digital_library_assets;
CREATE POLICY "Librarians manage digital assets" ON public.digital_library_assets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'LIBRARIAN')))
);

-- Transport Manager Policies
DROP POLICY IF EXISTS "Transport managers manage drivers" ON public.drivers;
CREATE POLICY "Transport managers manage drivers" ON public.drivers FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

DROP POLICY IF EXISTS "Transport managers manage pickup points" ON public.pickup_points;
CREATE POLICY "Transport managers manage pickup points" ON public.pickup_points FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

DROP POLICY IF EXISTS "Transport managers manage logs" ON public.vehicle_logs;
CREATE POLICY "Transport managers manage logs" ON public.vehicle_logs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND (users.role IN ('ADMIN', 'SUPER_ADMIN', 'TRANSPORT_MANAGER')))
);

-- 14. Enable Realtime Replication on Dedicated Tables
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER TABLE public.pickup_points REPLICA IDENTITY FULL;
ALTER TABLE public.vehicle_logs REPLICA IDENTITY FULL;
ALTER TABLE public.book_inventory REPLICA IDENTITY FULL;
ALTER TABLE public.digital_library_assets REPLICA IDENTITY FULL;
ALTER TABLE public.report_cards REPLICA IDENTITY FULL;
ALTER TABLE public.quiz_results REPLICA IDENTITY FULL;
ALTER TABLE public.invoices REPLICA IDENTITY FULL;
ALTER TABLE public.payment_logs REPLICA IDENTITY FULL;
ALTER TABLE public.transport_fee_records REPLICA IDENTITY FULL;

COMMENT ON TABLE public.drivers IS 'Dedicated transport drivers database registry.';
COMMENT ON TABLE public.pickup_points IS 'Dedicated transit routes pickup points coordinates.';
COMMENT ON TABLE public.vehicle_logs IS 'Dedicated vehicle maintenance and trip activity loggers.';
COMMENT ON TABLE public.book_inventory IS 'Granular barcode and checkout status registry for school books.';
COMMENT ON TABLE public.digital_library_assets IS 'Digital asset links, audio books, and e-learning catalogs.';
COMMENT ON TABLE public.report_cards IS 'Permanently linked historical report cards and GPAs.';
COMMENT ON TABLE public.quiz_results IS 'Dynamic quiz score trackers for student performance progress.';
COMMENT ON TABLE public.invoices IS 'Enterprise invoicing ledger isolating academic fee payments.';
COMMENT ON TABLE public.payment_logs IS 'Transaction references, methods, and details loggers.';
COMMENT ON TABLE public.transport_fee_records IS 'Vehicle specific transit fees isolating routes dues.';
