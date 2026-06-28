-- 1. Rename sports_coach_attendance to coach_attendance if it exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sports_coach_attendance') THEN
    ALTER TABLE public.sports_coach_attendance RENAME TO coach_attendance;
  END IF;
END $$;

-- 2. Validate/Add Unique Constraint (school_id, coach_id, attendance_date) on coach_attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'uniq_coach_date'
  ) THEN
    ALTER TABLE public.coach_attendance 
    ADD CONSTRAINT uniq_coach_date UNIQUE (school_id, coach_id, attendance_date);
  END IF;
END $$;

-- 3. Create coach_attendance_audit table with all required columns
CREATE TABLE IF NOT EXISTS public.coach_attendance_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id UUID NOT NULL,
  school_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  editor_id UUID,
  editor_name TEXT,
  old_status TEXT,
  new_status TEXT,
  old_check_in TEXT,
  new_check_in TEXT,
  old_check_out TEXT,
  new_check_out TEXT,
  old_working_hours NUMERIC,
  new_working_hours NUMERIC,
  remarks TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  ip_address TEXT,
  device_info TEXT
);

-- Ensure foreign keys exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_audit_coach'
  ) THEN
    ALTER TABLE public.coach_attendance_audit 
    ADD CONSTRAINT fk_audit_coach FOREIGN KEY (coach_id) REFERENCES public.sports_coaches(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Create the Audit Trigger Function
CREATE OR REPLACE FUNCTION public.trg_audit_coach_attendance()
RETURNS TRIGGER AS $$
DECLARE
  v_editor_id UUID;
  v_editor_name TEXT;
  v_reason TEXT;
  v_ip_address TEXT;
  v_device_info TEXT;
BEGIN
  -- Retrieve editor details from current transaction context or session variables
  v_editor_id := NULLIF(current_setting('aegis.editor_id', true), '')::UUID;
  v_editor_name := NULLIF(current_setting('aegis.editor_name', true), '');
  v_reason := NULLIF(current_setting('aegis.reason', true), '');
  v_ip_address := NULLIF(current_setting('aegis.ip_address', true), '');
  v_device_info := NULLIF(current_setting('aegis.device_info', true), '');

  -- Fallbacks if session settings are not present (e.g. direct client calls or soft deletes)
  IF TG_OP = 'INSERT' THEN
    IF v_editor_id IS NULL THEN
      v_editor_id := NEW.created_by;
    END IF;
    IF v_editor_name IS NULL AND v_editor_id IS NOT NULL THEN
      SELECT concat(first_name, ' ', last_name) INTO v_editor_name
      FROM public.users WHERE id = v_editor_id;
    END IF;
    IF v_reason IS NULL THEN
      v_reason := 'Initial attendance record created';
    END IF;

    INSERT INTO public.coach_attendance_audit (
      attendance_id, school_id, coach_id, editor_id, editor_name,
      old_status, new_status,
      old_check_in, new_check_in,
      old_check_out, new_check_out,
      old_working_hours, new_working_hours,
      remarks, reason, ip_address, device_info
    ) VALUES (
      NEW.id, NEW.school_id, NEW.coach_id, v_editor_id, v_editor_name,
      NULL, NEW.status,
      NULL, NEW.check_in,
      NULL, NEW.check_out,
      NULL, NEW.working_hours,
      NEW.remarks, v_reason, NEW.ip_address, NEW.device_id
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Only audit if something changed
    IF (OLD.status IS DISTINCT FROM NEW.status OR
        OLD.check_in IS DISTINCT FROM NEW.check_in OR
        OLD.check_out IS DISTINCT FROM NEW.check_out OR
        OLD.working_hours IS DISTINCT FROM NEW.working_hours OR
        OLD.remarks IS DISTINCT FROM NEW.remarks OR
        OLD.deleted_at IS DISTINCT FROM NEW.deleted_at) THEN
        
      IF v_editor_id IS NULL THEN
        v_editor_id := COALESCE(NEW.deleted_by, NEW.created_by);
      END IF;
      IF v_editor_name IS NULL AND v_editor_id IS NOT NULL THEN
        SELECT concat(first_name, ' ', last_name) INTO v_editor_name
        FROM public.users WHERE id = v_editor_id;
      END IF;
      IF v_reason IS NULL THEN
        IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
          v_reason := 'Record soft deleted';
        ELSE
          v_reason := 'Attendance record updated';
        END IF;
      END IF;

      INSERT INTO public.coach_attendance_audit (
        attendance_id, school_id, coach_id, editor_id, editor_name,
        old_status, new_status,
        old_check_in, new_check_in,
        old_check_out, new_check_out,
        old_working_hours, new_working_hours,
        remarks, reason, ip_address, device_info
      ) VALUES (
        NEW.id, NEW.school_id, NEW.coach_id, v_editor_id, v_editor_name,
        OLD.status, CASE WHEN NEW.deleted_at IS NOT NULL THEN 'DELETED' ELSE NEW.status END,
        OLD.check_in, NEW.check_in,
        OLD.check_out, NEW.check_out,
        OLD.working_hours, NEW.working_hours,
        NEW.remarks, v_reason, NEW.ip_address, NEW.device_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach trigger to coach_attendance
DROP TRIGGER IF EXISTS trg_audit_coach_attendance ON public.coach_attendance;
CREATE TRIGGER trg_audit_coach_attendance
AFTER INSERT OR UPDATE ON public.coach_attendance
FOR EACH ROW
EXECUTE FUNCTION public.trg_audit_coach_attendance();

-- 6. Create the Supabase RPC Function
CREATE OR REPLACE FUNCTION public.save_coach_attendance(
  p_user_id UUID,
  p_coach_id UUID,
  p_attendance_date DATE,
  p_status TEXT,
  p_check_in TEXT DEFAULT NULL,
  p_check_out TEXT DEFAULT NULL,
  p_working_hours NUMERIC DEFAULT 0,
  p_remarks TEXT DEFAULT NULL,
  p_edit_reason TEXT DEFAULT NULL,
  p_device_info TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_latitude NUMERIC DEFAULT NULL,
  p_longitude NUMERIC DEFAULT NULL,
  p_attendance_source TEXT DEFAULT 'MANUAL'
)
RETURNS JSONB AS $$
DECLARE
  v_school_id UUID;
  v_user_role TEXT;
  v_user_name TEXT;
  v_attendance_row public.coach_attendance;
  v_result JSONB;
BEGIN
  -- Validate Logged User and fetch school_id & role & name
  SELECT u.school_id, u.role, concat(u.first_name, ' ', u.last_name)
  INTO v_school_id, v_user_role, v_user_name
  FROM public.users u
  WHERE u.id = p_user_id;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'Logged User does not exist or has no school associated';
  END IF;

  -- Validate permissions
  IF v_user_role NOT IN ('ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Unauthorized: User does not have permissions to log attendance';
  END IF;

  -- Validate coach exists and belongs to the same school
  IF NOT EXISTS (
    SELECT 1 FROM public.sports_coaches c
    WHERE c.id = p_coach_id AND c.school_id = v_school_id
  ) THEN
    RAISE EXCEPTION 'Coach is invalid or does not belong to your school';
  END IF;

  -- Validate date is not null
  IF p_attendance_date IS NULL THEN
    RAISE EXCEPTION 'Attendance date is required';
  END IF;

  -- Set session local settings for the trigger to capture
  PERFORM set_config('aegis.editor_id', p_user_id::TEXT, true);
  PERFORM set_config('aegis.editor_name', v_user_name, true);
  PERFORM set_config('aegis.reason', COALESCE(p_edit_reason, 'Attendance update'), true);
  PERFORM set_config('aegis.ip_address', p_ip_address, true);
  PERFORM set_config('aegis.device_info', p_device_info, true);

  -- Perform UPSERT on coach_attendance
  INSERT INTO public.coach_attendance (
    school_id, coach_id, attendance_date, status,
    check_in, check_out, working_hours, remarks,
    device_id, ip_address, latitude, longitude,
    attendance_source, created_by, updated_at
  ) VALUES (
    v_school_id, p_coach_id, p_attendance_date, p_status,
    NULLIF(p_check_in, '')::timetz, NULLIF(p_check_out, '')::timetz, p_working_hours, p_remarks,
    p_device_info, p_ip_address, p_latitude, p_longitude,
    p_attendance_source, p_user_id, now()
  )
  ON CONFLICT (school_id, coach_id, attendance_date)
  DO UPDATE SET
    status = EXCLUDED.status,
    check_in = EXCLUDED.check_in,
    check_out = EXCLUDED.check_out,
    working_hours = EXCLUDED.working_hours,
    remarks = EXCLUDED.remarks,
    device_id = COALESCE(EXCLUDED.device_id, coach_attendance.device_id),
    ip_address = COALESCE(EXCLUDED.ip_address, coach_attendance.ip_address),
    latitude = COALESCE(EXCLUDED.latitude, coach_attendance.latitude),
    longitude = COALESCE(EXCLUDED.longitude, coach_attendance.longitude),
    attendance_source = COALESCE(EXCLUDED.attendance_source, coach_attendance.attendance_source),
    updated_at = now()
  RETURNING * INTO v_attendance_row;

  v_result := to_jsonb(v_attendance_row);
  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RLS Configuration
ALTER TABLE public.coach_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_attendance_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow sports admins to select coach attendance" ON public.coach_attendance;
CREATE POLICY "Allow sports admins to select coach attendance" ON public.coach_attendance
FOR SELECT USING (
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Allow sports admins to insert coach attendance" ON public.coach_attendance;
CREATE POLICY "Allow sports admins to insert coach attendance" ON public.coach_attendance
FOR INSERT WITH CHECK (
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Allow sports admins to update coach attendance" ON public.coach_attendance;
CREATE POLICY "Allow sports admins to update coach attendance" ON public.coach_attendance
FOR UPDATE USING (
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
) WITH CHECK (
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Allow sports admins to select coach attendance audit" ON public.coach_attendance_audit;
CREATE POLICY "Allow sports admins to select coach attendance audit" ON public.coach_attendance_audit
FOR SELECT USING (
  school_id = (SELECT school_id FROM public.users WHERE id = auth.uid())
);
