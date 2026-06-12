-- =====================================================================
-- ADD 'REOPENED' STATUS TO SUPPORT_TICKETS CONSTRAINT
-- =====================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Find and drop any existing check constraints containing 'status' on the support_tickets table
    FOR r IN
        SELECT conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'support_tickets'
          AND con.contype = 'c'
          AND conname LIKE '%status%'
    LOOP
        EXECUTE 'ALTER TABLE public.support_tickets DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Add the new status check constraint containing 'REOPENED'
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'));
