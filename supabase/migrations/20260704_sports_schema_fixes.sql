-- =====================================================================
-- AEGIS ERP SPORTS MODULE DATABASE FIXES
-- Migration: 20260704_sports_schema_fixes.sql
-- =====================================================================

-- 1. Alter sports_notifications check constraint to include all lowercase and uppercase channels
ALTER TABLE public.sports_notifications DROP CONSTRAINT IF EXISTS sports_notifications_channel_check;
ALTER TABLE public.sports_notifications ADD CONSTRAINT sports_notifications_channel_check 
  CHECK (channel IN ('system', 'sports', 'email', 'push', 'parent', 'student', 'coach', 'IN_APP', 'EMAIL', 'SMS', 'SPORTS'));

-- 2. Update the trigger function trg_sports_notifications() to use lowercase 'sports' channel
CREATE OR REPLACE FUNCTION public.trg_sports_notifications()
RETURNS TRIGGER AS $$
DECLARE
  v_title TEXT;
  v_message TEXT;
  v_school_id UUID;
  v_rec_id UUID;
  v_user_row RECORD;
  v_parent_row RECORD;
BEGIN
  IF TG_TABLE_NAME = 'sports_tournaments' THEN
    IF TG_OP = 'INSERT' THEN
      v_school_id := NEW.school_id;
      -- Notify admins
      FOR v_user_row IN SELECT id FROM public.users WHERE school_id = v_school_id AND role::text IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN') LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_user_row.id, 'New Tournament Scheduled', concat('A new tournament "', NEW.name, '" has been scheduled at ', NEW.venue, '.'), 'sports');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_tournament_players' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT school_id, name INTO v_school_id, v_title FROM public.sports_tournaments WHERE id = NEW.tournament_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Assigned to Tournament', concat('You have been selected to play in the tournament: ', v_title, '.'), 'sports');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Student Assigned to Tournament', concat('Your child has been selected to play in the tournament: ', v_title, '.'), 'sports');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_achievements' THEN
    IF TG_OP = 'INSERT' THEN
      v_school_id := NEW.school_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Achievement Logged', concat('Congratulations! A new achievement "', NEW.title, '" has been recorded for you.'), 'sports');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Student Achievement Logged', concat('Congratulations! A new achievement "', NEW.title, '" has been recorded for your child.'), 'sports');
      END LOOP;

      -- Notify admins
      FOR v_user_row IN SELECT id FROM public.users WHERE school_id = v_school_id AND role::text IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN') LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_user_row.id, 'Student Achievement Added', concat('A new achievement "', NEW.title, '" has been added for student.'), 'sports');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_certificates' THEN
    IF TG_OP = 'INSERT' THEN
      v_school_id := NEW.school_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Sports Certificate Generated', concat('A new sports certificate has been generated for you (No: ', NEW.certificate_number, ').'), 'sports');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Student Certificate Generated', concat('A new sports certificate has been generated for your child (No: ', NEW.certificate_number, ').'), 'sports');
      END LOOP;

      -- Notify admins
      FOR v_user_row IN SELECT id FROM public.users WHERE school_id = v_school_id AND role::text IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN') LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_user_row.id, 'Sports Certificate Issued', concat('Certificate ', NEW.certificate_number, ' has been issued to student.'), 'sports');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_attendance' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
      v_school_id := NEW.school_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Sports Practice Attendance', concat('You have been marked ', NEW.status, ' for sports session on ', NEW.date, '.'), 'sports');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Sports Practice Attendance Update', concat('Your child has been marked ', NEW.status, ' for sports session on ', NEW.date, '.'), 'sports');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_medical_records' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.fitness_expiry_date IS DISTINCT FROM NEW.fitness_expiry_date)) THEN
      v_school_id := NEW.school_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Medical Fitness Profile Update', concat('Your medical fitness profile status has been updated to: ', COALESCE(NEW.status, 'Fit'), '.'), 'sports');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Student Medical Fitness Update', concat('Your child''s medical fitness profile status has been updated to: ', COALESCE(NEW.status, 'Fit'), '.'), 'sports');
      END LOOP;

      -- Notify admins
      FOR v_user_row IN SELECT id FROM public.users WHERE school_id = v_school_id AND role::text IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN') LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_user_row.id, 'Student Medical Profile Update', concat('A student''s medical profile status was updated to: ', COALESCE(NEW.status, 'Fit'), '.'), 'sports');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Fix active academic session lookup in create_tournament() RPC and add format support
CREATE OR REPLACE FUNCTION public.create_tournament(
  p_user_id UUID,
  p_name TEXT,
  p_sport_id UUID,
  p_team_ids UUID[],
  p_student_ids UUID[],
  p_opponent TEXT,
  p_venue TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_description TEXT DEFAULT NULL,
  p_banner TEXT DEFAULT NULL,
  p_format TEXT DEFAULT 'LEAGUE'
)
RETURNS JSONB AS $$
DECLARE
  v_school_id UUID;
  v_academic_session_id UUID;
  v_user_role TEXT;
  v_tournament_id UUID;
  v_team_id UUID;
  v_student_id UUID;
  v_result JSONB;
BEGIN
  SELECT u.school_id, u.role::text
  INTO v_school_id, v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to schedule tournaments';
  END IF;

  -- Get active academic session using is_current instead of is_active
  SELECT id INTO v_academic_session_id 
  FROM public.academic_sessions 
  WHERE school_id = v_school_id AND is_current = true 
  LIMIT 1;

  -- Insert Tournament record
  INSERT INTO public.sports_tournaments (
    school_id, academic_session_id, sport_id, name, start_date, end_date, venue, status,
    opponent, start_time, end_time, description, banner, format, created_by, created_at, updated_at
  ) VALUES (
    v_school_id, v_academic_session_id, p_sport_id, p_name, p_start_date, p_end_date, p_venue, 'UPCOMING',
    p_opponent, p_start_time, p_end_time, p_description, p_banner, p_format, p_user_id, now(), now()
  ) RETURNING id INTO v_tournament_id;

  -- Insert assigned teams
  IF p_team_ids IS NOT NULL THEN
    FOREACH v_team_id IN ARRAY p_team_ids LOOP
      INSERT INTO public.sports_tournament_teams (school_id, tournament_id, team_id)
      VALUES (v_school_id, v_tournament_id, v_team_id);
    END LOOP;
  END IF;

  -- Insert assigned players
  IF p_student_ids IS NOT NULL THEN
    FOREACH v_student_id IN ARRAY p_student_ids LOOP
      INSERT INTO public.sports_tournament_players (school_id, tournament_id, student_id)
      VALUES (v_school_id, v_tournament_id, v_student_id);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'tournament_id', v_tournament_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix active academic session lookup in create_achievement() RPC
CREATE OR REPLACE FUNCTION public.create_achievement(
  p_user_id UUID,
  p_title TEXT,
  p_tournament_id UUID,
  p_student_id UUID,
  p_team_id UUID,
  p_sport_id UUID,
  p_position TEXT,
  p_medal TEXT,
  p_rank TEXT,
  p_level TEXT,
  p_certificate_eligible BOOLEAN,
  p_description TEXT DEFAULT NULL,
  p_images TEXT[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_school_id UUID;
  v_academic_session_id UUID;
  v_user_role TEXT;
  v_achievement_id UUID;
BEGIN
  SELECT u.school_id, u.role::text
  INTO v_school_id, v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to log achievements';
  END IF;

  -- Get active academic session using is_current instead of is_active
  SELECT id INTO v_academic_session_id 
  FROM public.academic_sessions 
  WHERE school_id = v_school_id AND is_current = true 
  LIMIT 1;

  INSERT INTO public.sports_achievements (
    school_id, academic_session_id, student_id, sport_id, type, level, title, description, date_awarded,
    tournament_id, team_id, position, medal, rank, certificate_eligible, images, created_by, created_at, updated_at
  ) VALUES (
    v_school_id, v_academic_session_id, p_student_id, p_sport_id, p_medal, p_level, p_title, p_description, now()::DATE,
    p_tournament_id, p_team_id, p_position, p_medal, p_rank, p_certificate_eligible, p_images, p_user_id, now(), now()
  ) RETURNING id INTO v_achievement_id;

  RETURN jsonb_build_object('success', true, 'achievement_id', v_achievement_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fix active academic session lookup in issue_certificate() RPC
CREATE OR REPLACE FUNCTION public.issue_certificate(
  p_user_id UUID,
  p_student_id UUID,
  p_sport_id UUID,
  p_tournament_id UUID,
  p_category TEXT,
  p_certificate_number TEXT,
  p_issue_date DATE,
  p_file_url TEXT,
  p_verification_qr_code TEXT,
  p_verification_url TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_school_id UUID;
  v_academic_session_id UUID;
  v_user_role TEXT;
  v_certificate_id UUID;
BEGIN
  SELECT u.school_id, u.role::text
  INTO v_school_id, v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to issue certificates';
  END IF;

  -- Get active academic session using is_current instead of is_active
  SELECT id INTO v_academic_session_id 
  FROM public.academic_sessions 
  WHERE school_id = v_school_id AND is_current = true 
  LIMIT 1;

  INSERT INTO public.sports_certificates (
    school_id, academic_session_id, student_id, sport_id, tournament_id, category,
    certificate_number, issue_date, file_url, verification_qr_code, verification_url, created_by, created_at, updated_at
  ) VALUES (
    v_school_id, v_academic_session_id, p_student_id, p_sport_id, p_tournament_id, p_category,
    p_certificate_number, p_issue_date, p_file_url, p_verification_qr_code, p_verification_url, p_user_id, now(), now()
  ) RETURNING id INTO v_certificate_id;

  RETURN jsonb_build_object('success', true, 'certificate_id', v_certificate_id);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add missing columns is_active to sports_certificates, sports_achievements, and sports_coaches
ALTER TABLE public.sports_certificates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.sports_achievements ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.sports_coaches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 7. Add foreign key constraints to sports_attendance_audit to allow relational mapping queries
ALTER TABLE public.sports_attendance_audit DROP CONSTRAINT IF EXISTS fk_sports_attendance_audit_student;
ALTER TABLE public.sports_attendance_audit
  ADD CONSTRAINT fk_sports_attendance_audit_student
  FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;

ALTER TABLE public.sports_attendance_audit DROP CONSTRAINT IF EXISTS fk_sports_attendance_audit_session;
ALTER TABLE public.sports_attendance_audit
  ADD CONSTRAINT fk_sports_attendance_audit_session
  FOREIGN KEY (session_id) REFERENCES public.sports_training_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.sports_attendance_audit DROP CONSTRAINT IF EXISTS fk_sports_attendance_audit_school;
ALTER TABLE public.sports_attendance_audit
  ADD CONSTRAINT fk_sports_attendance_audit_school
  FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.sports_attendance_audit DROP CONSTRAINT IF EXISTS fk_sports_attendance_audit_editor;
ALTER TABLE public.sports_attendance_audit
  ADD CONSTRAINT fk_sports_attendance_audit_editor
  FOREIGN KEY (edited_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- 8. Fix sports_certificates category check constraint to accept both uppercase and frontend camelcase values
ALTER TABLE public.sports_certificates DROP CONSTRAINT IF EXISTS sports_certificates_category_check;
ALTER TABLE public.sports_certificates ADD CONSTRAINT sports_certificates_category_check
  CHECK (category IN ('PARTICIPATION', 'WINNER', 'RUNNER_UP', 'BEST_PLAYER', 'SPORTS_EXCELLENCE', 'Participation', 'Winner', 'Runner Up', 'Best Player', 'Attendance', 'Excellence', 'Appreciation'));

-- 9. Fix sports_achievements level and type check constraints to accept both uppercase and frontend camelcase values
ALTER TABLE public.sports_achievements DROP CONSTRAINT IF EXISTS sports_achievements_level_check;
ALTER TABLE public.sports_achievements ADD CONSTRAINT sports_achievements_level_check
  CHECK (level IN ('SCHOOL', 'DISTRICT', 'STATE', 'NATIONAL', 'INTERNATIONAL', 'School', 'District', 'State', 'National', 'International'));

ALTER TABLE public.sports_achievements DROP CONSTRAINT IF EXISTS sports_achievements_type_check;
ALTER TABLE public.sports_achievements ADD CONSTRAINT sports_achievements_type_check
  CHECK (type IN ('GOLD', 'SILVER', 'BRONZE', 'PARTICIPATION', 'WINNER', 'RUNNER_UP', 'BEST_PLAYER', 'SPORTS_EXCELLENCE', 'Gold', 'Silver', 'Bronze', 'Participation', 'Winner', 'Runner Up', 'Best Player', 'Excellence'));

-- 10. Update save_medical_fitness() RPC to keep status & recovery_status fully synchronized and add check constraint
ALTER TABLE public.sports_medical_records DROP CONSTRAINT IF EXISTS sports_medical_records_status_check;
ALTER TABLE public.sports_medical_records ADD CONSTRAINT sports_medical_records_status_check
  CHECK (status IN ('FIT', 'UNFIT', 'TEMPORARILY_UNFIT', 'MEDICAL_LEAVE'));

CREATE OR REPLACE FUNCTION public.save_medical_fitness(
  p_user_id UUID,
  p_student_id UUID,
  p_blood_group TEXT,
  p_height NUMERIC,
  p_weight NUMERIC,
  p_bmi NUMERIC,
  p_allergies TEXT,
  p_medical_conditions TEXT,
  p_emergency_contact TEXT,
  p_doctor TEXT,
  p_fitness_expiry_date DATE,
  p_status TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_school_id UUID;
  v_user_role TEXT;
  v_medical_record_id UUID;
  v_recovery_status TEXT;
BEGIN
  SELECT u.school_id, u.role::text
  INTO v_school_id, v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to manage medical fitness profiles';
  END IF;

  -- Determine recovery_status from status for backwards compatibility
  IF p_status = 'FIT' THEN
    v_recovery_status := 'FIT';
  ELSIF p_status = 'UNFIT' THEN
    v_recovery_status := 'INJURED';
  ELSE
    v_recovery_status := 'RECOVERING';
  END IF;

  INSERT INTO public.sports_medical_records (
    school_id, student_id, blood_group, medical_conditions, emergency_contact,
    fitness_expiry_date, height, weight, bmi, allergies, doctor, status, recovery_status, created_by, created_at, updated_at
  ) VALUES (
    v_school_id, p_student_id, p_blood_group, p_medical_conditions, p_emergency_contact,
    p_fitness_expiry_date, p_height, p_weight, p_bmi, p_allergies, p_doctor, p_status, v_recovery_status, p_user_id, now(), now()
  )
  ON CONFLICT (student_id)
  DO UPDATE SET
    blood_group = EXCLUDED.blood_group,
    medical_conditions = EXCLUDED.medical_conditions,
    emergency_contact = EXCLUDED.emergency_contact,
    fitness_expiry_date = EXCLUDED.fitness_expiry_date,
    height = EXCLUDED.height,
    weight = EXCLUDED.weight,
    bmi = EXCLUDED.bmi,
    allergies = EXCLUDED.allergies,
    doctor = EXCLUDED.doctor,
    status = EXCLUDED.status,
    recovery_status = EXCLUDED.recovery_status,
    updated_at = now();

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Add public read access policy to storage objects bucket 'sports-certificates' for guest verification
DROP POLICY IF EXISTS "Allow public to read certificates" ON storage.objects;
CREATE POLICY "Allow public to read certificates" ON storage.objects
FOR SELECT USING (
  bucket_id = 'sports-certificates'
);
