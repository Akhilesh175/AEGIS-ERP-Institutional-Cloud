-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: ENABLE REALTIME FOR SUBSCRIPTIONS
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'schools'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.schools;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'school_subscriptions'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.school_subscriptions;
    END IF;
  END IF;
END $$;
