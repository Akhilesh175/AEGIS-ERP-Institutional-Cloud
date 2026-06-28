-- Extend user_role ENUM to support sports roles
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'COACH';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'SPORTS_ADMIN';

-- ─────────────────────────────────────────────────────────────────
-- 1. ATHLETE ATTENDANCE SCHEMAS
-- ─────────────────────────────────────────────────────────────────

-- Ensure date column is DATE type
ALTER TABLE public.sports_attendance ALTER COLUMN date TYPE DATE USING date::DATE;

-- Add Unique Constraint to sports_attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uniq_sports_att'
  ) THEN
    ALTER TABLE public.sports_attendance 
    ADD CONSTRAINT uniq_sports_att UNIQUE (session_id, student_id, date);
  END IF;
END $$;

-- Create sports_attendance_audit Table
CREATE TABLE IF NOT EXISTS public.sports_attendance_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID,
  school_id UUID NOT NULL,
  session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT,
  date DATE NOT NULL,
  edited_by UUID,
  editor_name TEXT,
  remarks TEXT,
  device TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger Function for Athlete Attendance Audit
CREATE OR REPLACE FUNCTION public.trg_audit_sports_attendance()
RETURNS TRIGGER AS $$
DECLARE
  v_editor_id UUID;
  v_editor_name TEXT;
  v_device TEXT;
  v_ip TEXT;
BEGIN
  v_editor_id := NULLIF(current_setting('aegis.editor_id', true), '')::UUID;
  v_editor_name := NULLIF(current_setting('aegis.editor_name', true), '');
  v_device := NULLIF(current_setting('aegis.device', true), '');
  v_ip := NULLIF(current_setting('aegis.ip', true), '');

  IF v_editor_id IS NULL THEN
    v_editor_id := NEW.marked_by;
  END IF;
  IF v_editor_name IS NULL AND v_editor_id IS NOT NULL THEN
    SELECT concat(first_name, ' ', last_name) INTO v_editor_name
    FROM public.users WHERE id = v_editor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sports_attendance_audit (
      attendance_id, school_id, session_id, student_id,
      old_status, new_status, date,
      edited_by, editor_name, remarks, device, ip
    ) VALUES (
      NEW.id, NEW.school_id, NEW.session_id, NEW.student_id,
      NULL, NEW.status, NEW.date,
      v_editor_id, v_editor_name, NEW.remarks, v_device, v_ip
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM NEW.status OR OLD.remarks IS DISTINCT FROM NEW.remarks) THEN
      INSERT INTO public.sports_attendance_audit (
        attendance_id, school_id, session_id, student_id,
        old_status, new_status, date,
        edited_by, editor_name, remarks, device, ip
      ) VALUES (
        NEW.id, NEW.school_id, NEW.session_id, NEW.student_id,
        OLD.status, NEW.status, NEW.date,
        v_editor_id, v_editor_name, NEW.remarks, v_device, v_ip
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_audit_sports_attendance ON public.sports_attendance;
CREATE TRIGGER trg_audit_sports_attendance
AFTER INSERT OR UPDATE ON public.sports_attendance
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_sports_attendance();

-- RPC Function: save_attendance()
CREATE OR REPLACE FUNCTION public.save_attendance(
  p_user_id UUID,
  p_session_id UUID,
  p_date DATE,
  p_attendance_records JSONB,
  p_device TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_school_id UUID;
  v_user_role TEXT;
  v_user_name TEXT;
  v_record JSONB;
  v_student_id UUID;
  v_status TEXT;
  v_remarks TEXT;
  v_success_count INT := 0;
BEGIN
  SELECT u.school_id, u.role, concat(u.first_name, ' ', u.last_name)
  INTO v_school_id, v_user_role, v_user_name
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to mark athlete attendance';
  END IF;

  PERFORM set_config('aegis.editor_id', p_user_id::TEXT, true);
  PERFORM set_config('aegis.editor_name', v_user_name, true);
  PERFORM set_config('aegis.device', p_device, true);
  PERFORM set_config('aegis.ip', p_ip, true);

  FOR v_record IN SELECT * FROM jsonb_array_elements(p_attendance_records) LOOP
    v_student_id := (v_record->>'student_id')::UUID;
    v_status := v_record->>'status';
    v_remarks := v_record->>'remarks';

    IF NOT EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = v_student_id AND s.school_id = v_school_id
    ) THEN
      RAISE EXCEPTION 'Student ID % is invalid or does not belong to your school', v_student_id;
    END IF;

    INSERT INTO public.sports_attendance (
      school_id, session_id, student_id, date, status, remarks, marked_by, updated_at
    ) VALUES (
      v_school_id, p_session_id, v_student_id, p_date, v_status, v_remarks, p_user_id, now()
    )
    ON CONFLICT (session_id, student_id, date)
    DO UPDATE SET
      status = EXCLUDED.status,
      remarks = EXCLUDED.remarks,
      marked_by = EXCLUDED.marked_by,
      updated_at = now();

    v_success_count := v_success_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'count', v_success_count);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────
-- 2. TOURNAMENT ENGINE SCHEMAS
-- ─────────────────────────────────────────────────────────────────

-- Alter sports_tournaments to add columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_tournaments' AND column_name = 'opponent') THEN
    ALTER TABLE public.sports_tournaments ADD COLUMN opponent TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_tournaments' AND column_name = 'start_time') THEN
    ALTER TABLE public.sports_tournaments ADD COLUMN start_time TIME;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_tournaments' AND column_name = 'end_time') THEN
    ALTER TABLE public.sports_tournaments ADD COLUMN end_time TIME;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_tournaments' AND column_name = 'description') THEN
    ALTER TABLE public.sports_tournaments ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_tournaments' AND column_name = 'banner') THEN
    ALTER TABLE public.sports_tournaments ADD COLUMN banner TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_tournaments' AND column_name = 'result') THEN
    ALTER TABLE public.sports_tournaments ADD COLUMN result TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_tournaments' AND column_name = 'created_by') THEN
    ALTER TABLE public.sports_tournaments ADD COLUMN created_by UUID;
  END IF;
END $$;

-- Create sports_tournament_teams
CREATE TABLE IF NOT EXISTS public.sports_tournament_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  tournament_id UUID NOT NULL REFERENCES public.sports_tournaments(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.sports_teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create sports_tournament_players
CREATE TABLE IF NOT EXISTS public.sports_tournament_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL,
  tournament_id UUID NOT NULL REFERENCES public.sports_tournaments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RPC Function: create_tournament()
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
  p_banner TEXT DEFAULT NULL
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
  SELECT u.school_id, u.role
  INTO v_school_id, v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to schedule tournaments';
  END IF;

  -- Get active academic session
  SELECT id INTO v_academic_session_id 
  FROM public.academic_sessions 
  WHERE school_id = v_school_id AND is_active = true 
  LIMIT 1;

  -- Insert Tournament record
  INSERT INTO public.sports_tournaments (
    school_id, academic_session_id, sport_id, name, start_date, end_date, venue, status,
    opponent, start_time, end_time, description, banner, created_by, created_at, updated_at
  ) VALUES (
    v_school_id, v_academic_session_id, p_sport_id, p_name, p_start_date, p_end_date, p_venue, 'UPCOMING',
    p_opponent, p_start_time, p_end_time, p_description, p_banner, p_user_id, now(), now()
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


-- ─────────────────────────────────────────────────────────────────
-- 3. ACHIEVEMENTS MODULE SCHEMAS
-- ─────────────────────────────────────────────────────────────────

-- Alter sports_achievements to add columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_achievements' AND column_name = 'tournament_id') THEN
    ALTER TABLE public.sports_achievements ADD COLUMN tournament_id UUID REFERENCES public.sports_tournaments(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_achievements' AND column_name = 'team_id') THEN
    ALTER TABLE public.sports_achievements ADD COLUMN team_id UUID REFERENCES public.sports_teams(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_achievements' AND column_name = 'position') THEN
    ALTER TABLE public.sports_achievements ADD COLUMN position TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_achievements' AND column_name = 'medal') THEN
    ALTER TABLE public.sports_achievements ADD COLUMN medal TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_achievements' AND column_name = 'rank') THEN
    ALTER TABLE public.sports_achievements ADD COLUMN rank TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_achievements' AND column_name = 'certificate_eligible') THEN
    ALTER TABLE public.sports_achievements ADD COLUMN certificate_eligible BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_achievements' AND column_name = 'images') THEN
    ALTER TABLE public.sports_achievements ADD COLUMN images TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_achievements' AND column_name = 'created_by') THEN
    ALTER TABLE public.sports_achievements ADD COLUMN created_by UUID;
  END IF;
END $$;

-- Create sports_achievements_audit Table
CREATE TABLE IF NOT EXISTS public.sports_achievements_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  achievement_id UUID,
  school_id UUID NOT NULL,
  student_id UUID NOT NULL,
  old_title TEXT,
  new_title TEXT,
  old_medal TEXT,
  new_medal TEXT,
  old_rank TEXT,
  new_rank TEXT,
  edited_by UUID,
  editor_name TEXT,
  action_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger Function for achievements Audits
CREATE OR REPLACE FUNCTION public.trg_audit_sports_achievements()
RETURNS TRIGGER AS $$
DECLARE
  v_editor_id UUID;
  v_editor_name TEXT;
  v_action TEXT;
BEGIN
  v_editor_id := auth.uid();
  IF v_editor_id IS NOT NULL THEN
    SELECT concat(first_name, ' ', last_name) INTO v_editor_name FROM public.users WHERE id = v_editor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.sports_achievements_audit (
      achievement_id, school_id, student_id, old_title, new_title, old_medal, new_medal, old_rank, new_rank, edited_by, editor_name, action_type
    ) VALUES (
      NEW.id, NEW.school_id, NEW.student_id, NULL, NEW.title, NULL, NEW.medal, NULL, NEW.rank, v_editor_id, v_editor_name, 'INSERT'
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.sports_achievements_audit (
      achievement_id, school_id, student_id, old_title, new_title, old_medal, new_medal, old_rank, new_rank, edited_by, editor_name, action_type
    ) VALUES (
      NEW.id, NEW.school_id, NEW.student_id, OLD.title, NEW.title, OLD.medal, NEW.medal, OLD.rank, NEW.rank, v_editor_id, v_editor_name, 'UPDATE'
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.sports_achievements_audit (
      achievement_id, school_id, student_id, old_title, new_title, old_medal, new_medal, old_rank, new_rank, edited_by, editor_name, action_type
    ) VALUES (
      OLD.id, OLD.school_id, OLD.student_id, OLD.title, NULL, OLD.medal, NULL, OLD.rank, NULL, v_editor_id, v_editor_name, 'DELETE'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_audit_sports_achievements ON public.sports_achievements;
CREATE TRIGGER trg_audit_sports_achievements
AFTER INSERT OR UPDATE OR DELETE ON public.sports_achievements
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_sports_achievements();

-- RPC Function: create_achievement()
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
  SELECT u.school_id, u.role
  INTO v_school_id, v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to log achievements';
  END IF;

  SELECT id INTO v_academic_session_id 
  FROM public.academic_sessions 
  WHERE school_id = v_school_id AND is_active = true 
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


-- ─────────────────────────────────────────────────────────────────
-- 4. CERTIFICATE CENTER SCHEMAS
-- ─────────────────────────────────────────────────────────────────

-- Alter sports_certificates to add columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_certificates' AND column_name = 'verification_url') THEN
    ALTER TABLE public.sports_certificates ADD COLUMN verification_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_certificates' AND column_name = 'created_by') THEN
    ALTER TABLE public.sports_certificates ADD COLUMN created_by UUID;
  END IF;
END $$;

-- RPC Function: issue_certificate()
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
  SELECT u.school_id, u.role
  INTO v_school_id, v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to issue certificates';
  END IF;

  SELECT id INTO v_academic_session_id 
  FROM public.academic_sessions 
  WHERE school_id = v_school_id AND is_active = true 
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


-- ─────────────────────────────────────────────────────────────────
-- 5. MEDICAL FITNESS SCHEMAS
-- ─────────────────────────────────────────────────────────────────

-- Alter sports_medical_records to add columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_medical_records' AND column_name = 'height') THEN
    ALTER TABLE public.sports_medical_records ADD COLUMN height NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_medical_records' AND column_name = 'weight') THEN
    ALTER TABLE public.sports_medical_records ADD COLUMN weight NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_medical_records' AND column_name = 'bmi') THEN
    ALTER TABLE public.sports_medical_records ADD COLUMN bmi NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_medical_records' AND column_name = 'allergies') THEN
    ALTER TABLE public.sports_medical_records ADD COLUMN allergies TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_medical_records' AND column_name = 'doctor') THEN
    ALTER TABLE public.sports_medical_records ADD COLUMN doctor TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_medical_records' AND column_name = 'status') THEN
    ALTER TABLE public.sports_medical_records ADD COLUMN status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sports_medical_records' AND column_name = 'created_by') THEN
    ALTER TABLE public.sports_medical_records ADD COLUMN created_by UUID;
  END IF;
END $$;

-- RPC Function: save_medical_fitness()
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
  v_result public.sports_medical_records;
BEGIN
  SELECT u.school_id, u.role
  INTO v_school_id, v_user_role
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'User does not exist or has no school associated';
  END IF;

  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'COACH') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to manage medical fitness profiles';
  END IF;

  INSERT INTO public.sports_medical_records (
    school_id, student_id, blood_group, medical_conditions, emergency_contact,
    fitness_expiry_date, height, weight, bmi, allergies, doctor, status, created_by, created_at, updated_at
  ) VALUES (
    v_school_id, p_student_id, p_blood_group, p_medical_conditions, p_emergency_contact,
    p_fitness_expiry_date, p_height, p_weight, p_bmi, p_allergies, p_doctor, p_status, p_user_id, now(), now()
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
    created_by = EXCLUDED.created_by,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN to_jsonb(v_result);
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─────────────────────────────────────────────────────────────────
-- 6. AUTOMATIC NOTIFICATIONS ENGINE TRIGGER
-- ─────────────────────────────────────────────────────────────────

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
      FOR v_user_row IN SELECT id FROM public.users WHERE school_id = v_school_id AND role IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN') LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_user_row.id, 'New Tournament Scheduled', concat('A new tournament "', NEW.name, '" has been scheduled at ', NEW.venue, '.'), 'SPORTS');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_tournament_players' THEN
    IF TG_OP = 'INSERT' THEN
      SELECT school_id, name INTO v_school_id, v_title FROM public.sports_tournaments WHERE id = NEW.tournament_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Assigned to Tournament', concat('You have been selected to play in the tournament: ', v_title, '.'), 'SPORTS');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Student Assigned to Tournament', concat('Your child has been selected to play in the tournament: ', v_title, '.'), 'SPORTS');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_achievements' THEN
    IF TG_OP = 'INSERT' THEN
      v_school_id := NEW.school_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Achievement Logged', concat('Congratulations! A new achievement "', NEW.title, '" has been recorded for you.'), 'SPORTS');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Student Achievement Logged', concat('Congratulations! A new achievement "', NEW.title, '" has been recorded for your child.'), 'SPORTS');
      END LOOP;

      -- Notify admins
      FOR v_user_row IN SELECT id FROM public.users WHERE school_id = v_school_id AND role IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN') LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_user_row.id, 'Student Achievement Added', concat('A new achievement "', NEW.title, '" has been added for student.'), 'SPORTS');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_certificates' THEN
    IF TG_OP = 'INSERT' THEN
      v_school_id := NEW.school_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Sports Certificate Generated', concat('A new sports certificate has been generated for you (No: ', NEW.certificate_number, ').'), 'SPORTS');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Student Certificate Generated', concat('A new sports certificate has been generated for your child (No: ', NEW.certificate_number, ').'), 'SPORTS');
      END LOOP;

      -- Notify admins
      FOR v_user_row IN SELECT id FROM public.users WHERE school_id = v_school_id AND role IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN') LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_user_row.id, 'Sports Certificate Issued', concat('Certificate ', NEW.certificate_number, ' has been issued to student.'), 'SPORTS');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_attendance' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
      v_school_id := NEW.school_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Sports Practice Attendance', concat('You have been marked ', NEW.status, ' for sports session on ', NEW.date, '.'), 'SPORTS');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Sports Practice Attendance Update', concat('Your child has been marked ', NEW.status, ' for sports session on ', NEW.date, '.'), 'SPORTS');
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'sports_medical_records' THEN
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.fitness_expiry_date IS DISTINCT FROM NEW.fitness_expiry_date)) THEN
      v_school_id := NEW.school_id;
      
      -- Notify student
      SELECT user_id INTO v_rec_id FROM public.students WHERE id = NEW.student_id;
      IF v_rec_id IS NOT NULL THEN
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_rec_id, 'Medical Fitness Profile Update', concat('Your medical fitness profile status has been updated to: ', COALESCE(NEW.status, 'Fit'), '.'), 'SPORTS');
      END IF;

      -- Notify parents
      FOR v_parent_row IN SELECT p.user_id FROM public.parents p JOIN public.parent_student_mapping m ON p.id = m.parent_id WHERE m.student_id = NEW.student_id LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_parent_row.user_id, 'Student Medical Fitness Update', concat('Your child''s medical fitness profile status has been updated to: ', COALESCE(NEW.status, 'Fit'), '.'), 'SPORTS');
      END LOOP;

      -- Notify admins
      FOR v_user_row IN SELECT id FROM public.users WHERE school_id = v_school_id AND role IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN') LOOP
        INSERT INTO public.sports_notifications (school_id, user_id, title, message, channel)
        VALUES (v_school_id, v_user_row.id, 'Student Medical Profile Update', concat('A student''s medical profile status was updated to: ', COALESCE(NEW.status, 'Fit'), '.'), 'SPORTS');
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach Notification Triggers
DROP TRIGGER IF EXISTS trg_sports_tournaments_notif ON public.sports_tournaments;
CREATE TRIGGER trg_sports_tournaments_notif AFTER INSERT ON public.sports_tournaments FOR EACH ROW EXECUTE FUNCTION public.trg_sports_notifications();

DROP TRIGGER IF EXISTS trg_sports_tournament_players_notif ON public.sports_tournament_players;
CREATE TRIGGER trg_sports_tournament_players_notif AFTER INSERT ON public.sports_tournament_players FOR EACH ROW EXECUTE FUNCTION public.trg_sports_notifications();

DROP TRIGGER IF EXISTS trg_sports_achievements_notif ON public.sports_achievements;
CREATE TRIGGER trg_sports_achievements_notif AFTER INSERT ON public.sports_achievements FOR EACH ROW EXECUTE FUNCTION public.trg_sports_notifications();

DROP TRIGGER IF EXISTS trg_sports_certificates_notif ON public.sports_certificates;
CREATE TRIGGER trg_sports_certificates_notif AFTER INSERT ON public.sports_certificates FOR EACH ROW EXECUTE FUNCTION public.trg_sports_notifications();

DROP TRIGGER IF EXISTS trg_sports_attendance_notif ON public.sports_attendance;
CREATE TRIGGER trg_sports_attendance_notif AFTER INSERT OR UPDATE ON public.sports_attendance FOR EACH ROW EXECUTE FUNCTION public.trg_sports_notifications();

DROP TRIGGER IF EXISTS trg_sports_medical_notif ON public.sports_medical_records;
CREATE TRIGGER trg_sports_medical_notif AFTER INSERT OR UPDATE ON public.sports_medical_records FOR EACH ROW EXECUTE FUNCTION public.trg_sports_notifications();


-- ─────────────────────────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ─────────────────────────────────────────────────────────────────

-- Enable RLS on newly created tables
ALTER TABLE public.sports_tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_tournament_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_attendance_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_achievements_audit ENABLE ROW LEVEL SECURITY;

-- 7.1 sports_attendance select policies
DROP POLICY IF EXISTS "Select sports_attendance policy" ON public.sports_attendance;
CREATE POLICY "Select sports_attendance policy" ON public.sports_attendance
FOR SELECT USING (
  -- Admins
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN')
  OR
  -- Coach
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'COACH'
  OR
  -- Student (own)
  student_id = (SELECT id FROM public.students WHERE user_id = auth.uid())
  OR
  -- Parent (mapped student)
  student_id IN (SELECT student_id FROM public.parent_student_mapping WHERE parent_id = (SELECT id FROM public.parents WHERE user_id = auth.uid()))
);

-- 7.2 sports_attendance_audit select policies
DROP POLICY IF EXISTS "Select sports_attendance_audit policy" ON public.sports_attendance_audit;
CREATE POLICY "Select sports_attendance_audit policy" ON public.sports_attendance_audit
FOR SELECT USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN')
  OR
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'COACH'
  OR
  student_id = (SELECT id FROM public.students WHERE user_id = auth.uid())
  OR
  student_id IN (SELECT student_id FROM public.parent_student_mapping WHERE parent_id = (SELECT id FROM public.parents WHERE user_id = auth.uid()))
);

-- 7.3 sports_tournaments select policies
DROP POLICY IF EXISTS "Select sports_tournaments policy" ON public.sports_tournaments;
CREATE POLICY "Select sports_tournaments policy" ON public.sports_tournaments
FOR SELECT USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN')
  OR
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'COACH'
  OR
  EXISTS (
    SELECT 1 FROM public.sports_tournament_players p 
    WHERE p.tournament_id = sports_tournaments.id 
      AND p.student_id = (SELECT id FROM public.students WHERE user_id = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.sports_tournament_players p 
    WHERE p.tournament_id = sports_tournaments.id 
      AND p.student_id IN (
        SELECT student_id FROM public.parent_student_mapping 
        WHERE parent_id = (SELECT id FROM public.parents WHERE user_id = auth.uid())
      )
  )
);

-- 7.4 sports_achievements select policies
DROP POLICY IF EXISTS "Select sports_achievements policy" ON public.sports_achievements;
CREATE POLICY "Select sports_achievements policy" ON public.sports_achievements
FOR SELECT USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN')
  OR
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'COACH'
  OR
  student_id = (SELECT id FROM public.students WHERE user_id = auth.uid())
  OR
  student_id IN (SELECT student_id FROM public.parent_student_mapping WHERE parent_id = (SELECT id FROM public.parents WHERE user_id = auth.uid()))
);

-- 7.5 sports_certificates select policies
DROP POLICY IF EXISTS "Select sports_certificates policy" ON public.sports_certificates;
CREATE POLICY "Select sports_certificates policy" ON public.sports_certificates
FOR SELECT USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN')
  OR
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'COACH'
  OR
  student_id = (SELECT id FROM public.students WHERE user_id = auth.uid())
  OR
  student_id IN (SELECT student_id FROM public.parent_student_mapping WHERE parent_id = (SELECT id FROM public.parents WHERE user_id = auth.uid()))
);

-- 7.6 sports_medical_records select policies
DROP POLICY IF EXISTS "Select sports_medical_records policy" ON public.sports_medical_records;
CREATE POLICY "Select sports_medical_records policy" ON public.sports_medical_records
FOR SELECT USING (
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SPORTS_ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN')
  OR
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'COACH'
  OR
  student_id = (SELECT id FROM public.students WHERE user_id = auth.uid())
  OR
  student_id IN (SELECT student_id FROM public.parent_student_mapping WHERE parent_id = (SELECT id FROM public.parents WHERE user_id = auth.uid()))
);


-- ─────────────────────────────────────────────────────────────────
-- 8. SUPABASE STORAGE BUCKET CREATION
-- ─────────────────────────────────────────────────────────────────

-- Create public storage bucket for certificates if not exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('sports-certificates', 'sports-certificates', true) 
ON CONFLICT (id) DO NOTHING;

-- Storage object policies
DROP POLICY IF EXISTS "Allow coaches and admins to upload certificates" ON storage.objects;
CREATE POLICY "Allow coaches and admins to upload certificates" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'sports-certificates' AND
  (SELECT role FROM public.users WHERE id = auth.uid()) IN ('ADMIN', 'SPORTS_ADMIN', 'COACH', 'SUPER_ADMIN')
);

DROP POLICY IF EXISTS "Allow authenticated users to read certificates" ON storage.objects;
CREATE POLICY "Allow authenticated users to read certificates" ON storage.objects
FOR SELECT USING (
  bucket_id = 'sports-certificates' AND auth.role() = 'authenticated'
);
