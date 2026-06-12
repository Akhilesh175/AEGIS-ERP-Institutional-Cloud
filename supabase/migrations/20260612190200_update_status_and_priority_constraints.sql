-- =====================================================================
-- UPDATE STATUS AND PRIORITY CHECK CONSTRAINTS ON SUPPORT_TICKETS
-- =====================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- 1. Drop existing check constraints containing 'status' on the support_tickets table
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

    -- 2. Drop existing check constraints containing 'priority' on the support_tickets table
    FOR r IN
        SELECT conname
        FROM pg_constraint con
        INNER JOIN pg_class rel ON rel.oid = con.conrelid
        INNER JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE nsp.nspname = 'public'
          AND rel.relname = 'support_tickets'
          AND con.contype = 'c'
          AND conname LIKE '%priority%'
    LOOP
        EXECUTE 'ALTER TABLE public.support_tickets DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- 3. Add the updated status check constraint
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check CHECK (status IN ('OPEN', 'IN_PROGRESS', 'AWAITING_USER_RESPONSE', 'RESOLVED', 'CLOSED', 'REOPENED'));

-- 4. Add the updated priority check constraint
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_priority_check CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));
