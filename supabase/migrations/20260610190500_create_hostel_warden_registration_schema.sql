-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: HOSTEL WARDEN REGISTRATION SCHEMA
-- =====================================================================

-- 1. Create hostel_buildings Table (used for mapping buildings)
CREATE TABLE IF NOT EXISTS public.hostel_buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BOYS', 'GIRLS', 'MIXED')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Copy existing hostels to hostel_buildings
INSERT INTO public.hostel_buildings (id, school_id, name, type, status, created_at, updated_at)
SELECT id, school_id, name, type, status, created_at, updated_at FROM public.hostels
ON CONFLICT (id) DO NOTHING;

-- Create sync triggers to keep hostels and hostel_buildings in sync
CREATE OR REPLACE FUNCTION public.sync_hostels_to_buildings()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hostel_buildings (id, school_id, name, type, status, created_at, updated_at)
    VALUES (NEW.id, NEW.school_id, NEW.name, NEW.type, NEW.status, NEW.created_at, NEW.updated_at);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.hostel_buildings
    SET name = NEW.name, type = NEW.type, status = NEW.status, updated_at = NEW.updated_at
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.hostel_buildings WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_buildings_to_hostels()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hostels (id, school_id, name, type, status, created_at, updated_at)
    VALUES (NEW.id, NEW.school_id, NEW.name, NEW.type, NEW.status, NEW.created_at, NEW.updated_at);
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.hostels
    SET name = NEW.name, type = NEW.type, status = NEW.status, updated_at = NEW.updated_at
    WHERE id = NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.hostels WHERE id = OLD.id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_hostels_to_buildings ON public.hostels;
CREATE TRIGGER trigger_sync_hostels_to_buildings
AFTER INSERT OR UPDATE OR DELETE ON public.hostels
FOR EACH ROW EXECUTE FUNCTION public.sync_hostels_to_buildings();

DROP TRIGGER IF EXISTS trigger_sync_buildings_to_hostels ON public.hostel_buildings;
CREATE TRIGGER trigger_sync_buildings_to_hostels
AFTER INSERT OR UPDATE OR DELETE ON public.hostel_buildings
FOR EACH ROW EXECUTE FUNCTION public.sync_buildings_to_hostels();

-- 2. Alter hostel_wardens Table to add missing columns
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'));

-- Populate existing warden columns from users table if null
UPDATE public.hostel_wardens hw
SET 
  first_name = COALESCE(hw.first_name, u.first_name),
  last_name = COALESCE(hw.last_name, u.last_name),
  email = COALESCE(hw.email, u.email),
  employee_id = COALESCE(hw.employee_id, u.employee_id)
FROM public.users u
WHERE hw.user_id = u.id;

-- 3. Create hostel_warden_assignments Table
CREATE TABLE IF NOT EXISTS public.hostel_warden_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warden_id UUID NOT NULL REFERENCES public.hostel_wardens(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.hostel_buildings(id) ON DELETE CASCADE,
  block_id UUID REFERENCES public.hostel_blocks(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- Populate hostel_warden_assignments with existing hostel_id assignments from hostel_wardens
INSERT INTO public.hostel_warden_assignments (warden_id, building_id, status)
SELECT id, hostel_id, 'ACTIVE'
FROM public.hostel_wardens
WHERE hostel_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Enable RLS and add Policies
ALTER TABLE public.hostel_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostel_warden_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view school hostel buildings" ON public.hostel_buildings;
CREATE POLICY "Users can view school hostel buildings" ON public.hostel_buildings FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Admins can manage hostel buildings" ON public.hostel_buildings;
CREATE POLICY "Admins can manage hostel buildings" ON public.hostel_buildings FOR ALL USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can view school hostel warden assignments" ON public.hostel_warden_assignments;
CREATE POLICY "Users can view school hostel warden assignments" ON public.hostel_warden_assignments FOR SELECT 
USING (
  warden_id IN (SELECT id FROM public.hostel_wardens WHERE school_id = get_auth_user_school_id())
);

DROP POLICY IF EXISTS "Admins can manage hostel warden assignments" ON public.hostel_warden_assignments;
CREATE POLICY "Admins can manage hostel warden assignments" ON public.hostel_warden_assignments FOR ALL
USING (
  warden_id IN (SELECT id FROM public.hostel_wardens WHERE school_id = get_auth_user_school_id())
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_hostel_buildings_school ON public.hostel_buildings(school_id);
CREATE INDEX IF NOT EXISTS idx_hostel_warden_assignments_warden ON public.hostel_warden_assignments(warden_id);
CREATE INDEX IF NOT EXISTS idx_hostel_warden_assignments_building ON public.hostel_warden_assignments(building_id);
CREATE INDEX IF NOT EXISTS idx_hostel_warden_assignments_block ON public.hostel_warden_assignments(block_id);
