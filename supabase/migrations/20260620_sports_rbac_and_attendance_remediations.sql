-- =====================================================================
-- SPORTS MANAGEMENT ERP — RBAC, ATTENDANCE & SECURITY REMEDIATIONS
-- Author: Antigravity
-- Created: 2026-06-20
-- =====================================================================

-- 1. Alter Type enum user_role to include SPORTS_ADMIN
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SPORTS_ADMIN';

-- 2. Repair sports_coach_attendance columns
ALTER TABLE public.sports_coach_attendance ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.sports_coach_attendance ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE public.sports_coach_attendance ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6);
ALTER TABLE public.sports_coach_attendance ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6);
ALTER TABLE public.sports_coach_attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.sports_coach_attendance ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Remove old constraint on attendance_source if it exists and add standard check constraint
ALTER TABLE public.sports_coach_attendance DROP CONSTRAINT IF EXISTS sports_coach_attendance_attendance_source_check;
ALTER TABLE public.sports_coach_attendance ADD COLUMN IF NOT EXISTS attendance_source TEXT;
ALTER TABLE public.sports_coach_attendance DROP CONSTRAINT IF EXISTS check_attendance_source;
ALTER TABLE public.sports_coach_attendance ADD CONSTRAINT check_attendance_source 
  CHECK (attendance_source IN ('MANUAL', 'QR_CODE', 'BIOMETRIC', 'FACE_RECOGNITION', 'MOBILE_GPS'));

-- 3. Define parent/student access control helper functions
CREATE OR REPLACE FUNCTION public.is_parent_linked_to_student(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parents p
    JOIN public.parent_student_mapping m ON p.id = m.parent_id
    WHERE p.user_id = auth.uid() AND m.student_id = p_student_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_student_self(p_student_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.user_id = auth.uid() AND s.id = p_student_id
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 4. Rebuild Row Level Security (RLS) policies for student-specific tables

-- 4.1 sports_enrollments
DROP POLICY IF EXISTS "sports_enrollments_policy" ON public.sports_enrollments;
DROP POLICY IF EXISTS "sports_enrollments_select" ON public.sports_enrollments;
DROP POLICY IF EXISTS "sports_enrollments_insert" ON public.sports_enrollments;
DROP POLICY IF EXISTS "sports_enrollments_update" ON public.sports_enrollments;
DROP POLICY IF EXISTS "sports_enrollments_delete" ON public.sports_enrollments;

CREATE POLICY "sports_enrollments_select" ON public.sports_enrollments
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_enrollments_insert" ON public.sports_enrollments
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

CREATE POLICY "sports_enrollments_update" ON public.sports_enrollments
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

CREATE POLICY "sports_enrollments_delete" ON public.sports_enrollments
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

-- 4.2 sports_attendance
DROP POLICY IF EXISTS "sports_attendance_policy" ON public.sports_attendance;
DROP POLICY IF EXISTS "sports_attendance_select" ON public.sports_attendance;
DROP POLICY IF EXISTS "sports_attendance_insert" ON public.sports_attendance;
DROP POLICY IF EXISTS "sports_attendance_update" ON public.sports_attendance;
DROP POLICY IF EXISTS "sports_attendance_delete" ON public.sports_attendance;

CREATE POLICY "sports_attendance_select" ON public.sports_attendance
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_attendance_insert" ON public.sports_attendance
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH')
  );

CREATE POLICY "sports_attendance_update" ON public.sports_attendance
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH')
  );

CREATE POLICY "sports_attendance_delete" ON public.sports_attendance
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

-- 4.3 sports_performance_metrics
DROP POLICY IF EXISTS "sports_performance_metrics_policy" ON public.sports_performance_metrics;
DROP POLICY IF EXISTS "sports_performance_metrics_select" ON public.sports_performance_metrics;
DROP POLICY IF EXISTS "sports_performance_metrics_insert" ON public.sports_performance_metrics;
DROP POLICY IF EXISTS "sports_performance_metrics_update" ON public.sports_performance_metrics;
DROP POLICY IF EXISTS "sports_performance_metrics_delete" ON public.sports_performance_metrics;

CREATE POLICY "sports_performance_metrics_select" ON public.sports_performance_metrics
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_performance_metrics_insert" ON public.sports_performance_metrics
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH')
  );

CREATE POLICY "sports_performance_metrics_update" ON public.sports_performance_metrics
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH')
  );

CREATE POLICY "sports_performance_metrics_delete" ON public.sports_performance_metrics
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

-- 4.4 sports_certificates
DROP POLICY IF EXISTS "sports_certificates_policy" ON public.sports_certificates;
DROP POLICY IF EXISTS "sports_certificates_select" ON public.sports_certificates;
DROP POLICY IF EXISTS "sports_certificates_insert" ON public.sports_certificates;
DROP POLICY IF EXISTS "sports_certificates_update" ON public.sports_certificates;
DROP POLICY IF EXISTS "sports_certificates_delete" ON public.sports_certificates;

CREATE POLICY "sports_certificates_select" ON public.sports_certificates
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_certificates_insert" ON public.sports_certificates
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

CREATE POLICY "sports_certificates_update" ON public.sports_certificates
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

CREATE POLICY "sports_certificates_delete" ON public.sports_certificates
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

-- 4.5 sports_achievements
DROP POLICY IF EXISTS "sports_achievements_policy" ON public.sports_achievements;
DROP POLICY IF EXISTS "sports_achievements_select" ON public.sports_achievements;
DROP POLICY IF EXISTS "sports_achievements_insert" ON public.sports_achievements;
DROP POLICY IF EXISTS "sports_achievements_update" ON public.sports_achievements;
DROP POLICY IF EXISTS "sports_achievements_delete" ON public.sports_achievements;

CREATE POLICY "sports_achievements_select" ON public.sports_achievements
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_achievements_insert" ON public.sports_achievements
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

CREATE POLICY "sports_achievements_update" ON public.sports_achievements
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

CREATE POLICY "sports_achievements_delete" ON public.sports_achievements
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

-- 4.6 sports_medical_records
DROP POLICY IF EXISTS "sports_medical_records_policy" ON public.sports_medical_records;
DROP POLICY IF EXISTS "sports_medical_records_select" ON public.sports_medical_records;
DROP POLICY IF EXISTS "sports_medical_records_insert" ON public.sports_medical_records;
DROP POLICY IF EXISTS "sports_medical_records_update" ON public.sports_medical_records;
DROP POLICY IF EXISTS "sports_medical_records_delete" ON public.sports_medical_records;

CREATE POLICY "sports_medical_records_select" ON public.sports_medical_records
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_medical_records_insert" ON public.sports_medical_records
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH')
  );

CREATE POLICY "sports_medical_records_update" ON public.sports_medical_records
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH')
  );

CREATE POLICY "sports_medical_records_delete" ON public.sports_medical_records
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

-- 4.7 sports_fee_payments
DROP POLICY IF EXISTS "sports_fee_payments_policy" ON public.sports_fee_payments;
DROP POLICY IF EXISTS "sports_fee_payments_select" ON public.sports_fee_payments;
DROP POLICY IF EXISTS "sports_fee_payments_insert" ON public.sports_fee_payments;
DROP POLICY IF EXISTS "sports_fee_payments_update" ON public.sports_fee_payments;
DROP POLICY IF EXISTS "sports_fee_payments_delete" ON public.sports_fee_payments;

CREATE POLICY "sports_fee_payments_select" ON public.sports_fee_payments
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_fee_payments_insert" ON public.sports_fee_payments
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_fee_payments_update" ON public.sports_fee_payments
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN')
  );

CREATE POLICY "sports_fee_payments_delete" ON public.sports_fee_payments
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN')
  );

-- 4.8 sports_fines & sports_fine_payments
DROP POLICY IF EXISTS "sports_fines_policy" ON public.sports_fines;
DROP POLICY IF EXISTS "sports_fines_select" ON public.sports_fines;
DROP POLICY IF EXISTS "sports_fines_insert" ON public.sports_fines;
DROP POLICY IF EXISTS "sports_fines_update" ON public.sports_fines;
DROP POLICY IF EXISTS "sports_fines_delete" ON public.sports_fines;

CREATE POLICY "sports_fines_select" ON public.sports_fines
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH', 'TEACHER', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_fines_insert" ON public.sports_fines
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH', 'TEACHER')
  );

CREATE POLICY "sports_fines_update" ON public.sports_fines
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_fines_delete" ON public.sports_fines
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN')
  );

DROP POLICY IF EXISTS "sports_fine_payments_policy" ON public.sports_fine_payments;
DROP POLICY IF EXISTS "sports_fine_payments_select" ON public.sports_fine_payments;
DROP POLICY IF EXISTS "sports_fine_payments_insert" ON public.sports_fine_payments;
DROP POLICY IF EXISTS "sports_fine_payments_update" ON public.sports_fine_payments;
DROP POLICY IF EXISTS "sports_fine_payments_delete" ON public.sports_fine_payments;

CREATE POLICY "sports_fine_payments_select" ON public.sports_fine_payments
  FOR SELECT USING (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_fine_payments_insert" ON public.sports_fine_payments
  FOR INSERT WITH CHECK (
    school_id = get_auth_user_school_id() AND (
      get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN') OR
      is_student_self(student_id) OR
      is_parent_linked_to_student(student_id)
    )
  );

CREATE POLICY "sports_fine_payments_update" ON public.sports_fine_payments
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN')
  );

CREATE POLICY "sports_fine_payments_delete" ON public.sports_fine_payments
  FOR DELETE USING (
    school_id = get_auth_user_school_id() AND
    get_auth_user_role() IN ('SCHOOL_ADMIN', 'ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'FINANCE_ADMIN')
  );
