-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: ADD AUDIT COLUMNS TO HOSTEL MANAGEMENT SYSTEM TABLES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. hostels Table
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostels ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostels_created_by ON public.hostels (created_by);
CREATE INDEX IF NOT EXISTS idx_hostels_updated_by ON public.hostels (updated_by);

-- 2. hostel_blocks Table
ALTER TABLE public.hostel_blocks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_blocks ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_blocks_created_by ON public.hostel_blocks (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_blocks_updated_by ON public.hostel_blocks (updated_by);

-- 3. hostel_rooms Table
ALTER TABLE public.hostel_rooms ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_rooms ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_created_by ON public.hostel_rooms (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_rooms_updated_by ON public.hostel_rooms (updated_by);

-- 4. hostel_beds Table
ALTER TABLE public.hostel_beds ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_beds ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_beds_created_by ON public.hostel_beds (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_beds_updated_by ON public.hostel_beds (updated_by);

-- 5. hostel_wardens Table
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_wardens_created_by ON public.hostel_wardens (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_wardens_updated_by ON public.hostel_wardens (updated_by);

-- 6. hostel_admissions Table
ALTER TABLE public.hostel_admissions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_admissions ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_admissions_created_by ON public.hostel_admissions (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_admissions_updated_by ON public.hostel_admissions (updated_by);

-- 7. hostel_attendance Table
ALTER TABLE public.hostel_attendance ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_attendance ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_attendance_created_by ON public.hostel_attendance (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_attendance_updated_by ON public.hostel_attendance (updated_by);

-- 8. hostel_fees Table
ALTER TABLE public.hostel_fees ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_fees ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_fees_created_by ON public.hostel_fees (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_fees_updated_by ON public.hostel_fees (updated_by);

-- 9. hostel_payments Table
ALTER TABLE public.hostel_payments ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_payments ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_payments_created_by ON public.hostel_payments (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_payments_updated_by ON public.hostel_payments (updated_by);

-- 10. hostel_leave_requests Table
ALTER TABLE public.hostel_leave_requests ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_leave_requests ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_leave_requests_created_by ON public.hostel_leave_requests (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_leave_requests_updated_by ON public.hostel_leave_requests (updated_by);

-- 11. hostel_visitors Table
ALTER TABLE public.hostel_visitors ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_visitors ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_visitors_created_by ON public.hostel_visitors (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_visitors_updated_by ON public.hostel_visitors (updated_by);

-- 12. hostel_complaints Table
ALTER TABLE public.hostel_complaints ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_complaints ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_complaints_created_by ON public.hostel_complaints (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_complaints_updated_by ON public.hostel_complaints (updated_by);

-- 13. hostel_mess_menu Table
ALTER TABLE public.hostel_mess_menu ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.hostel_mess_menu ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hostel_mess_menu_created_by ON public.hostel_mess_menu (created_by);
CREATE INDEX IF NOT EXISTS idx_hostel_mess_menu_updated_by ON public.hostel_mess_menu (updated_by);
