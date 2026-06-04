-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: HOSTEL MANAGEMENT SYSTEM TABLES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. hostels Table
CREATE TABLE IF NOT EXISTS public.hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BOYS', 'GIRLS', 'MIXED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. hostel_blocks Table
CREATE TABLE IF NOT EXISTS public.hostel_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. hostel_rooms Table
CREATE TABLE IF NOT EXISTS public.hostel_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES public.hostel_blocks(id) ON DELETE CASCADE,
  floor INTEGER NOT NULL,
  room_number TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT hostel_room_number_uniq UNIQUE (block_id, room_number)
);

-- 4. hostel_beds Table
CREATE TABLE IF NOT EXISTS public.hostel_beds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  bed_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'VACANT' CHECK (status IN ('VACANT', 'OCCUPIED', 'MAINTENANCE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT hostel_bed_room_uniq UNIQUE (room_id, bed_name)
);

-- 5. hostel_wardens Table
CREATE TABLE IF NOT EXISTS public.hostel_wardens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT hostel_warden_user_uniq UNIQUE (user_id)
);

-- 6. hostel_admissions Table
CREATE TABLE IF NOT EXISTS public.hostel_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.hostel_rooms(id) ON DELETE CASCADE,
  bed_id UUID NOT NULL REFERENCES public.hostel_beds(id) ON DELETE CASCADE,
  admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_date DATE,
  check_out_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CHECKED_OUT')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT hostel_student_admission_uniq UNIQUE (student_id, status)
);

-- 7. hostel_attendance Table
CREATE TABLE IF NOT EXISTS public.hostel_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time_slot TEXT NOT NULL CHECK (time_slot IN ('MORNING', 'EVENING')),
  status TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LEAVE')),
  recorded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT hostel_attendance_uniq UNIQUE (student_id, date, time_slot)
);

-- 8. hostel_fees Table
CREATE TABLE IF NOT EXISTS public.hostel_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL NOT NULL CHECK (amount >= 0),
  fee_type TEXT NOT NULL CHECK (fee_type IN ('MONTHLY', 'ANNUAL', 'ONE_TIME', 'MESS')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. hostel_payments Table
CREATE TABLE IF NOT EXISTS public.hostel_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_id UUID NOT NULL REFERENCES public.hostel_fees(id) ON DELETE CASCADE,
  amount_paid DECIMAL NOT NULL CHECK (amount_paid >= 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'ONLINE', 'BANK_TRANSFER')),
  tx_id TEXT,
  status TEXT NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'PENDING', 'PARTIAL')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. hostel_leave_requests Table
CREATE TABLE IF NOT EXISTS public.hostel_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  reason TEXT NOT NULL,
  parent_approval TEXT NOT NULL DEFAULT 'PENDING' CHECK (parent_approval IN ('PENDING', 'APPROVED', 'REJECTED')),
  warden_approval TEXT NOT NULL DEFAULT 'PENDING' CHECK (warden_approval IN ('PENDING', 'APPROVED', 'REJECTED')),
  admin_approval TEXT NOT NULL DEFAULT 'PENDING' CHECK (admin_approval IN ('PENDING', 'APPROVED', 'REJECTED')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. hostel_visitors Table
CREATE TABLE IF NOT EXISTS public.hostel_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  relation TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  exit_time TIMESTAMP WITH TIME ZONE,
  purpose TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. hostel_complaints Table
CREATE TABLE IF NOT EXISTS public.hostel_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('ROOM', 'ELECTRICITY', 'WATER', 'MAINTENANCE', 'OTHER')),
  description TEXT NOT NULL,
  assigned_staff TEXT,
  resolution_notes TEXT,
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'ASSIGNED', 'RESOLVED', 'CLOSED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. hostel_mess_menu Table
CREATE TABLE IF NOT EXISTS public.hostel_mess_menu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  breakfast TEXT NOT NULL,
  lunch TEXT NOT NULL,
  dinner TEXT NOT NULL,
  special_menu TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT hostel_mess_day_uniq UNIQUE (hostel_id, day_of_week)
);


-- =====================================================================
-- PERFORMANCE INDEXES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_hostels_school ON public.hostels(school_id);
CREATE INDEX IF NOT EXISTS idx_hostel_blocks_hostel ON public.hostel_blocks(hostel_id);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_block ON public.hostel_rooms(block_id);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_room ON public.hostel_beds(room_id);
CREATE INDEX IF NOT EXISTS idx_hostel_admissions_student ON public.hostel_admissions(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_attendance_student ON public.hostel_attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_attendance_date ON public.hostel_attendance(date);
CREATE INDEX IF NOT EXISTS idx_hostel_leave_requests_student ON public.hostel_leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_complaints_student ON public.hostel_complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_hostel_visitors_student ON public.hostel_visitors(student_id);


-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_wardens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_mess_menu ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "Users can view school hostels" ON public.hostels FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel blocks" ON public.hostel_blocks FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel rooms" ON public.hostel_rooms FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel beds" ON public.hostel_beds FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel wardens" ON public.hostel_wardens FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel admissions" ON public.hostel_admissions FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel attendance" ON public.hostel_attendance FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel fees" ON public.hostel_fees FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel payments" ON public.hostel_payments FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel leave requests" ON public.hostel_leave_requests FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel visitors" ON public.hostel_visitors FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel complaints" ON public.hostel_complaints FOR SELECT USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can view school hostel mess menu" ON public.hostel_mess_menu FOR SELECT USING (school_id = get_auth_user_school_id());

-- Write policies (Admins / Wardens)
CREATE POLICY "Admins can manage hostels" ON public.hostels FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins can manage hostel blocks" ON public.hostel_blocks FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins can manage hostel rooms" ON public.hostel_rooms FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins can manage hostel beds" ON public.hostel_beds FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins can manage hostel wardens" ON public.hostel_wardens FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins can manage hostel admissions" ON public.hostel_admissions FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins and wardens can manage hostel attendance" ON public.hostel_attendance FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins can manage hostel fees" ON public.hostel_fees FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins can manage hostel payments" ON public.hostel_payments FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can manage hostel leave requests" ON public.hostel_leave_requests FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins and wardens can manage hostel visitors" ON public.hostel_visitors FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Users can manage hostel complaints" ON public.hostel_complaints FOR ALL USING (school_id = get_auth_user_school_id());
CREATE POLICY "Admins can manage hostel mess menu" ON public.hostel_mess_menu FOR ALL USING (school_id = get_auth_user_school_id());
