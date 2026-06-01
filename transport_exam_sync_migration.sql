-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: TRANSPORT MODULE & EXAM SCHEMA FIXES
-- Run this in your Supabase SQL Editor (https://supabase.com) to resolve
-- all missing columns and schema mismatches.
-- =====================================================================

-- 1. Upgrade public.buses Table
ALTER TABLE public.buses 
  ADD COLUMN IF NOT EXISTS number_plate TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

-- Backfill number_plate column using existing plate_number
UPDATE public.buses 
SET number_plate = plate_number 
WHERE number_plate IS NULL AND plate_number IS NOT NULL;

-- 2. Upgrade public.routes Table
ALTER TABLE public.routes 
  ADD COLUMN IF NOT EXISTS route_code TEXT;

-- 3. Upgrade public.pickup_points Table
ALTER TABLE public.pickup_points 
  ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE;

-- 4. Upgrade public.transport_assignments Table
ALTER TABLE public.transport_assignments 
  ADD COLUMN IF NOT EXISTS pickup_point_id UUID REFERENCES public.pickup_points(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- 5. Upgrade public.exams Table (add missing term column)
ALTER TABLE public.exams 
  ADD COLUMN IF NOT EXISTS term TEXT;

-- 6. Indices for high performance queries
CREATE INDEX IF NOT EXISTS idx_buses_driver ON public.buses (driver_id);
CREATE INDEX IF NOT EXISTS idx_pickup_points_route ON public.pickup_points (route_id);
CREATE INDEX IF NOT EXISTS idx_transport_assignments_pickup_point ON public.transport_assignments (pickup_point_id);

-- Ensure replication is enabled on all affected tables for realtime websocket sync
ALTER TABLE public.buses REPLICA IDENTITY FULL;
ALTER TABLE public.routes REPLICA IDENTITY FULL;
ALTER TABLE public.pickup_points REPLICA IDENTITY FULL;
ALTER TABLE public.transport_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.exams REPLICA IDENTITY FULL;

-- Re-apply SELECT policies to guarantee cross-portal access for assigned schools
DROP POLICY IF EXISTS "Users can view school buses" ON public.buses;
CREATE POLICY "Users can view school buses" ON public.buses FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school routes" ON public.routes;
CREATE POLICY "Users can view school routes" ON public.routes FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school pickup points" ON public.pickup_points;
CREATE POLICY "Users can view school pickup points" ON public.pickup_points FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school transport assignments" ON public.transport_assignments;
CREATE POLICY "Users can view school transport assignments" ON public.transport_assignments FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school exams" ON public.exams;
CREATE POLICY "Users can view school exams" ON public.exams FOR SELECT USING (school_id = get_auth_user_school_id());

COMMIT;
