-- =====================================================================
-- AEGIS DATABASE FIX: RESOLVE UNIQUE CONSTRAINT ON SCHOOL_SUBSCRIPTIONS
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Clean up any duplicate rows to prevent constraint creation failure
DELETE FROM public.school_subscriptions a
USING public.school_subscriptions b
WHERE a.id < b.id
  AND a.school_id = b.school_id
  AND a.plan = b.plan;

-- 2. Drop the constraint if it exists under a different name
ALTER TABLE public.school_subscriptions 
DROP CONSTRAINT IF EXISTS school_sub_uniq;

-- 3. Add the unique constraint on (school_id, plan)
ALTER TABLE public.school_subscriptions 
ADD CONSTRAINT school_sub_uniq UNIQUE (school_id, plan);

-- 4. Verify/Recreate the sync trigger function
CREATE OR REPLACE FUNCTION sync_school_subscriptions()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.school_subscriptions (school_id, plan, status, expiry_date, created_at, updated_at)
  VALUES (
    NEW.school_id,
    UPPER(NEW.plan_code),
    CASE 
      WHEN NEW.status = 'ACTIVE' THEN 'ACTIVE'
      WHEN NEW.status = 'TRIAL' THEN 'ACTIVE'
      ELSE 'EXPIRED'
    END,
    NEW.expiry_date,
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (school_id, plan) DO UPDATE SET
    status = EXCLUDED.status,
    expiry_date = EXCLUDED.expiry_date,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
