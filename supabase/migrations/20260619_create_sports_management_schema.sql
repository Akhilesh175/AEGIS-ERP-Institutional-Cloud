-- =====================================================================
-- SPORTS & PHYSICAL ACTIVITIES ERP SYSTEM MIGRATION
-- Author: Antigravity
-- Created: 2026-06-19
-- =====================================================================

-- Helper function to fetch current user's school_id (bypass RLS)
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 1. Create sports_categories Table
CREATE TABLE IF NOT EXISTS public.sports_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create sports Table
CREATE TABLE IF NOT EXISTS public.sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.sports_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('INDOOR', 'OUTDOOR')),
  format TEXT NOT NULL CHECK (format IN ('INDIVIDUAL', 'TEAM')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create sports_coaches Table
CREATE TABLE IF NOT EXISTS public.sports_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  specialization TEXT NOT NULL,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create sports_enrollments Table
CREATE TABLE IF NOT EXISTS public.sports_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  enroll_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uniq_student_sport UNIQUE (student_id, sport_id)
);

-- 5. Create sports_teams Table
CREATE TABLE IF NOT EXISTS public.sports_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  coach_id UUID REFERENCES public.sports_coaches(id) ON DELETE SET NULL,
  captain_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  vice_captain_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  age_group TEXT,
  gender TEXT CHECK (gender IN ('MALE', 'FEMALE', 'MIXED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create sports_team_members Table
CREATE TABLE IF NOT EXISTS public.sports_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.sports_teams(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uniq_team_member UNIQUE (team_id, student_id)
);

-- 7. Create sports_training_sessions Table
CREATE TABLE IF NOT EXISTS public.sports_training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.sports_teams(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES public.sports_coaches(id) ON DELETE SET NULL,
  session_name TEXT NOT NULL,
  session_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  venue TEXT NOT NULL,
  recurrence TEXT DEFAULT 'NONE',
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create sports_attendance Table
CREATE TABLE IF NOT EXISTS public.sports_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.sports_training_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'MEDICAL_LEAVE')),
  remarks TEXT,
  marked_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uniq_session_student UNIQUE (session_id, student_id)
);

-- 9. Create sports_performance_metrics Table
CREATE TABLE IF NOT EXISTS public.sports_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  recorded_date DATE NOT NULL DEFAULT CURRENT_DATE,
  speed INTEGER NOT NULL CHECK (speed BETWEEN 0 AND 100),
  stamina INTEGER NOT NULL CHECK (stamina BETWEEN 0 AND 100),
  strength INTEGER NOT NULL CHECK (strength BETWEEN 0 AND 100),
  agility INTEGER NOT NULL CHECK (agility BETWEEN 0 AND 100),
  skill INTEGER NOT NULL CHECK (skill BETWEEN 0 AND 100),
  discipline INTEGER NOT NULL CHECK (discipline BETWEEN 0 AND 100),
  teamwork INTEGER NOT NULL CHECK (teamwork BETWEEN 0 AND 100),
  fitness INTEGER NOT NULL CHECK (fitness BETWEEN 0 AND 100),
  coach_rating DECIMAL(3,1) CHECK (coach_rating BETWEEN 0.0 AND 10.0),
  tournament_performance INTEGER CHECK (tournament_performance BETWEEN 0 AND 100),
  achievement_progress INTEGER CHECK (achievement_progress BETWEEN 0 AND 100),
  coach_id UUID REFERENCES public.sports_coaches(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Create sports_tournaments Table
CREATE TABLE IF NOT EXISTS public.sports_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('LEAGUE', 'KNOCKOUT', 'ROUND_ROBIN', 'GROUP_STAGE', 'HYBRID')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  venue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Create sports_fixtures Table
CREATE TABLE IF NOT EXISTS public.sports_fixtures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.sports_tournaments(id) ON DELETE CASCADE,
  team1_id UUID REFERENCES public.sports_teams(id) ON DELETE CASCADE,
  team2_id UUID REFERENCES public.sports_teams(id) ON DELETE CASCADE,
  match_date DATE NOT NULL,
  match_time TEXT NOT NULL,
  venue TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED')),
  round TEXT,
  referee_officials TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Create sports_matches Table
CREATE TABLE IF NOT EXISTS public.sports_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  fixture_id UUID NOT NULL REFERENCES public.sports_fixtures(id) ON DELETE CASCADE UNIQUE,
  winner_team_id UUID REFERENCES public.sports_teams(id) ON DELETE SET NULL,
  team1_score TEXT,
  team2_score TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Create sports_results Table
CREATE TABLE IF NOT EXISTS public.sports_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES public.sports_matches(id) ON DELETE CASCADE UNIQUE,
  winner_team_id UUID REFERENCES public.sports_teams(id) ON DELETE SET NULL,
  team1_score TEXT,
  team2_score TEXT,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Create sports_rankings Table
CREATE TABLE IF NOT EXISTS public.sports_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.sports_teams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  matches_lost INTEGER NOT NULL DEFAULT 0,
  matches_drawn INTEGER NOT NULL DEFAULT 0,
  rank_score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uniq_ranking_team UNIQUE (academic_session_id, sport_id, team_id),
  CONSTRAINT uniq_ranking_student UNIQUE (academic_session_id, sport_id, student_id)
);

-- 15. Create sports_certificates Table
CREATE TABLE IF NOT EXISTS public.sports_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  tournament_id UUID REFERENCES public.sports_tournaments(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('PARTICIPATION', 'WINNER', 'RUNNER_UP', 'BEST_PLAYER', 'SPORTS_EXCELLENCE')),
  certificate_number TEXT NOT NULL UNIQUE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  file_url TEXT NOT NULL,
  verification_qr_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Create sports_achievements Table
CREATE TABLE IF NOT EXISTS public.sports_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  sport_id UUID NOT NULL REFERENCES public.sports(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('GOLD', 'SILVER', 'BRONZE', 'PARTICIPATION', 'WINNER', 'RUNNER_UP', 'BEST_PLAYER', 'SPORTS_EXCELLENCE')),
  level TEXT NOT NULL CHECK (level IN ('SCHOOL', 'DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL')),
  title TEXT NOT NULL,
  description TEXT,
  date_awarded DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. Create sports_medical_records Table
CREATE TABLE IF NOT EXISTS public.sports_medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE UNIQUE,
  blood_group TEXT,
  medical_conditions TEXT,
  emergency_contact TEXT,
  injury_history JSONB DEFAULT '[]'::jsonb,
  recovery_status TEXT NOT NULL DEFAULT 'FIT' CHECK (recovery_status IN ('FIT', 'INJURED', 'RECOVERING')),
  fitness_expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. Create sports_equipment Table
CREATE TABLE IF NOT EXISTS public.sports_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  available_quantity INTEGER NOT NULL DEFAULT 0,
  condition TEXT NOT NULL DEFAULT 'GOOD' CHECK (condition IN ('EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED')),
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 19. Create sports_equipment_logs Table
CREATE TABLE IF NOT EXISTS public.sports_equipment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.sports_equipment(id) ON DELETE CASCADE,
  assigned_to_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  return_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'RETURNED', 'DAMAGED', 'LOST')),
  damage_report TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 20. Create sports_fees Table
CREATE TABLE IF NOT EXISTS public.sports_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  academic_session_id UUID NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('REGISTRATION_FEE', 'TRAINING_FEE', 'TOURNAMENT_FEE', 'EQUIPMENT_FEE', 'UNIFORM_FEE')),
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 21. Create sports_fee_payments Table
CREATE TABLE IF NOT EXISTS public.sports_fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sports_fee_id UUID NOT NULL REFERENCES public.sports_fees(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount_paid DECIMAL(12,2) NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method TEXT NOT NULL,
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  payment_screenshot_url TEXT,
  utr_number TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 22. Create sports_notifications Table
CREATE TABLE IF NOT EXISTS public.sports_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 23. Create sports_activity_logs Table
CREATE TABLE IF NOT EXISTS public.sports_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sports_school ON public.sports(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_coaches_school ON public.sports_coaches(school_id);
CREATE INDEX IF NOT EXISTS idx_sports_coaches_user ON public.sports_coaches(user_id);
CREATE INDEX IF NOT EXISTS idx_sports_enrollments_student ON public.sports_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_enrollments_sport ON public.sports_enrollments(sport_id);
CREATE INDEX IF NOT EXISTS idx_sports_teams_sport ON public.sports_teams(sport_id);
CREATE INDEX IF NOT EXISTS idx_sports_team_members_team ON public.sports_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_sports_team_members_student ON public.sports_team_members(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_training_sport ON public.sports_training_sessions(sport_id);
CREATE INDEX IF NOT EXISTS idx_sports_training_team ON public.sports_training_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_sports_attendance_session ON public.sports_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_sports_attendance_student ON public.sports_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_perf_student ON public.sports_performance_metrics(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_perf_sport ON public.sports_performance_metrics(sport_id);
CREATE INDEX IF NOT EXISTS idx_sports_tournaments_sport ON public.sports_tournaments(sport_id);
CREATE INDEX IF NOT EXISTS idx_sports_fixtures_tournament ON public.sports_fixtures(tournament_id);
CREATE INDEX IF NOT EXISTS idx_sports_rankings_sport ON public.sports_rankings(sport_id);
CREATE INDEX IF NOT EXISTS idx_sports_rankings_student ON public.sports_rankings(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_cert_student ON public.sports_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_ach_student ON public.sports_achievements(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_med_student ON public.sports_medical_records(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_eq_logs_eq ON public.sports_equipment_logs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_sports_fees_session ON public.sports_fees(academic_session_id);
CREATE INDEX IF NOT EXISTS idx_sports_fee_pmts_fee ON public.sports_fee_payments(sports_fee_id);
CREATE INDEX IF NOT EXISTS idx_sports_fee_pmts_student ON public.sports_fee_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_sports_notif_user ON public.sports_notifications(user_id);

-- ---------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ---------------------------------------------------------------------
ALTER TABLE public.sports_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_equipment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_activity_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- DEFINE ROW LEVEL SECURITY POLICIES (SCHOOL ISOLATION)
-- ---------------------------------------------------------------------

-- Drop existing policies if any to prevent failures on rerun
DROP POLICY IF EXISTS "sports_categories_policy" ON public.sports_categories;
DROP POLICY IF EXISTS "sports_policy" ON public.sports;
DROP POLICY IF EXISTS "sports_coaches_policy" ON public.sports_coaches;
DROP POLICY IF EXISTS "sports_enrollments_policy" ON public.sports_enrollments;
DROP POLICY IF EXISTS "sports_teams_policy" ON public.sports_teams;
DROP POLICY IF EXISTS "sports_team_members_policy" ON public.sports_team_members;
DROP POLICY IF EXISTS "sports_training_sessions_policy" ON public.sports_training_sessions;
DROP POLICY IF EXISTS "sports_attendance_policy" ON public.sports_attendance;
DROP POLICY IF EXISTS "sports_performance_metrics_policy" ON public.sports_performance_metrics;
DROP POLICY IF EXISTS "sports_tournaments_policy" ON public.sports_tournaments;
DROP POLICY IF EXISTS "sports_fixtures_policy" ON public.sports_fixtures;
DROP POLICY IF EXISTS "sports_matches_policy" ON public.sports_matches;
DROP POLICY IF EXISTS "sports_results_policy" ON public.sports_results;
DROP POLICY IF EXISTS "sports_rankings_policy" ON public.sports_rankings;
DROP POLICY IF EXISTS "sports_certificates_policy" ON public.sports_certificates;
DROP POLICY IF EXISTS "sports_achievements_policy" ON public.sports_achievements;
DROP POLICY IF EXISTS "sports_medical_records_policy" ON public.sports_medical_records;
DROP POLICY IF EXISTS "sports_equipment_policy" ON public.sports_equipment;
DROP POLICY IF EXISTS "sports_equipment_logs_policy" ON public.sports_equipment_logs;
DROP POLICY IF EXISTS "sports_fees_policy" ON public.sports_fees;
DROP POLICY IF EXISTS "sports_fee_payments_policy" ON public.sports_fee_payments;
DROP POLICY IF EXISTS "sports_notifications_policy" ON public.sports_notifications;
DROP POLICY IF EXISTS "sports_activity_logs_policy" ON public.sports_activity_logs;

-- Re-create Unified Policies that enforce school isolation
CREATE POLICY "sports_categories_policy" ON public.sports_categories
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_policy" ON public.sports
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_coaches_policy" ON public.sports_coaches
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_enrollments_policy" ON public.sports_enrollments
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_teams_policy" ON public.sports_teams
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_team_members_policy" ON public.sports_team_members
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_training_sessions_policy" ON public.sports_training_sessions
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_attendance_policy" ON public.sports_attendance
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_performance_metrics_policy" ON public.sports_performance_metrics
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_tournaments_policy" ON public.sports_tournaments
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_fixtures_policy" ON public.sports_fixtures
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_matches_policy" ON public.sports_matches
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_results_policy" ON public.sports_results
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_rankings_policy" ON public.sports_rankings
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_certificates_policy" ON public.sports_certificates
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_achievements_policy" ON public.sports_achievements
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_medical_records_policy" ON public.sports_medical_records
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_equipment_policy" ON public.sports_equipment
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_equipment_logs_policy" ON public.sports_equipment_logs
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_fees_policy" ON public.sports_fees
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_fee_payments_policy" ON public.sports_fee_payments
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_notifications_policy" ON public.sports_notifications
  FOR ALL USING (school_id = get_auth_user_school_id());

CREATE POLICY "sports_activity_logs_policy" ON public.sports_activity_logs
  FOR ALL USING (school_id = get_auth_user_school_id());

-- ---------------------------------------------------------------------
-- ENABLE SUPABASE REALTIME FOR ALL MAJOR SPORTS EVENT TABLES
-- ---------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_enrollments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_teams;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_training_sessions;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_attendance;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_performance_metrics;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fixtures;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_matches;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_results;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_rankings;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_certificates;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_achievements;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_fee_payments;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_medical_records;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_equipment;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_equipment_logs;
  END IF;
END $$;
