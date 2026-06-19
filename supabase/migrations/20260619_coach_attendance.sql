-- =====================================================================
-- SPORTS COACH ATTENDANCE MANAGEMENT SCHEMA
-- Author: Antigravity
-- Created: 2026-06-19
-- Enhanced for Biometric, Soft Delete & Audit History
-- =====================================================================

-- 1. Create sports_coach_attendance
CREATE TABLE IF NOT EXISTS public.sports_coach_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.sports_coaches(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'TRAINING_DUTY', 'TOURNAMENT_DUTY', 'MEDICAL_LEAVE')),
  check_in TIME WITH TIME ZONE,
  check_out TIME WITH TIME ZONE,
  working_hours DECIMAL(5,2) DEFAULT 0.00,
  remarks TEXT,
  
  -- Biometric/Device/GPS Metadata
  device_id TEXT,
  ip_address TEXT,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  attendance_source TEXT CHECK (attendance_source IN ('MANUAL', 'QR_CODE', 'BIOMETRIC', 'FACE_RECOGNITION', 'MOBILE_GPS')),
  
  -- Soft Delete columns
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uniq_coach_date UNIQUE(school_id, coach_id, attendance_date)
);

-- 2. Create sports_coach_leaves
CREATE TABLE IF NOT EXISTS public.sports_coach_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.sports_coaches(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('CASUAL', 'SICK', 'MEDICAL', 'MATERNITY', 'PATERNITY', 'DUTY_LEAVE', 'OTHER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reason TEXT,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create sports_coach_work_logs (Session History)
CREATE TABLE IF NOT EXISTS public.sports_coach_work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.sports_coaches(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  session_name TEXT, -- e.g. Cricket Training, Football Training
  login_time TIMESTAMP WITH TIME ZONE,
  logout_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  session_type TEXT NOT NULL DEFAULT 'PRACTICE',
  
  -- Biometric/Device/GPS Metadata for sessions
  device_id TEXT,
  ip_address TEXT,
  latitude DECIMAL(9,6),
  longitude DECIMAL(9,6),
  attendance_source TEXT CHECK (attendance_source IN ('MANUAL', 'QR_CODE', 'BIOMETRIC', 'FACE_RECOGNITION', 'MOBILE_GPS')),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create sports_coach_attendance_corrections
CREATE TABLE IF NOT EXISTS public.sports_coach_attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  attendance_id UUID NOT NULL REFERENCES public.sports_coach_attendance(id) ON DELETE CASCADE,
  requested_status TEXT NOT NULL CHECK (requested_status IN ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE', 'TRAINING_DUTY', 'TOURNAMENT_DUTY', 'MEDICAL_LEAVE')),
  requested_check_in TIME WITH TIME ZONE,
  requested_check_out TIME WITH TIME ZONE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create sports_coach_attendance_history (Audit Logs)
CREATE TABLE IF NOT EXISTS public.sports_coach_attendance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  attendance_id UUID NOT NULL REFERENCES public.sports_coach_attendance(id) ON DELETE CASCADE,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  edited_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  edit_reason TEXT
);

-- ---------------------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sports_coach_att_school ON public.sports_coach_attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_coach_att_coach ON public.sports_coach_attendance(coach_id);
CREATE INDEX IF NOT EXISTS idx_sports_coach_att_date ON public.sports_coach_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_sports_coach_leaves_school ON public.sports_coach_leaves(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_coach_leaves_coach ON public.sports_coach_leaves(coach_id);
CREATE INDEX IF NOT EXISTS idx_sports_coach_work_logs_school ON public.sports_coach_work_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_coach_work_logs_coach ON public.sports_coach_work_logs(coach_id);
CREATE INDEX IF NOT EXISTS idx_sports_coach_att_corr_school ON public.sports_coach_attendance_corrections(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_coach_att_hist_school ON public.sports_coach_attendance_history(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_coach_att_hist_att ON public.sports_coach_attendance_history(attendance_id);

-- ---------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
ALTER TABLE public.sports_coach_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_coach_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_coach_work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_coach_attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_coach_attendance_history ENABLE ROW LEVEL SECURITY;

-- Helper function to fetch current user's school_id (bypass RLS)
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Create Policies
DROP POLICY IF EXISTS "sports_coach_attendance_policy" ON public.sports_coach_attendance;
CREATE POLICY "sports_coach_attendance_policy" ON public.sports_coach_attendance
  FOR ALL USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "sports_coach_leaves_policy" ON public.sports_coach_leaves;
CREATE POLICY "sports_coach_leaves_policy" ON public.sports_coach_leaves
  FOR ALL USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "sports_coach_work_logs_policy" ON public.sports_coach_work_logs;
CREATE POLICY "sports_coach_work_logs_policy" ON public.sports_coach_work_logs
  FOR ALL USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "sports_coach_att_corr_policy" ON public.sports_coach_attendance_corrections;
CREATE POLICY "sports_coach_att_corr_policy" ON public.sports_coach_attendance_corrections
  FOR ALL USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "sports_coach_att_hist_policy" ON public.sports_coach_attendance_history;
CREATE POLICY "sports_coach_att_hist_policy" ON public.sports_coach_attendance_history
  FOR ALL USING (school_id = get_auth_user_school_id());

-- ---------------------------------------------------------------------
-- ENABLE SUPABASE REALTIME
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_coach_attendance;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_coach_leaves;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_coach_work_logs;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_coach_attendance_corrections;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_coach_attendance_history;
  END IF;
END $$;
