-- =====================================================================
-- GRANT SEQUENCE PERMISSIONS AND SET TRIGGER TO SECURITY DEFINER
-- =====================================================================

-- 1. Grant usage and select on the ticket number sequence to the app roles
GRANT USAGE, SELECT ON SEQUENCE public.support_ticket_number_seq TO authenticated, service_role, anon;

-- 2. Re-create the ticket number generation function with SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || nextval('public.support_ticket_number_seq')::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
