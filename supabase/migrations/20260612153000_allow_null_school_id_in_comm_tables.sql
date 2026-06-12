-- =====================================================================
-- AEGIS COMMUNICATOR: Make school_id nullable to support
-- Super Admin ↔ School Admin cross-tenant messaging
-- =====================================================================
-- Super Admins have no school_id of their own. When they create a
-- direct channel with a School Admin, the channel and messages must
-- still be insertable without a school_id constraint violation.
-- The receiver's school_id is used where available.
-- =====================================================================

-- Allow NULL school_id on communication_channels (cross-school SA channels)
ALTER TABLE public.communication_channels
  ALTER COLUMN school_id DROP NOT NULL;

-- Allow NULL school_id on communication_messages (same reason)
ALTER TABLE public.communication_messages
  ALTER COLUMN school_id DROP NOT NULL;

-- Drop the existing FK constraints that reference schools(id) ON DELETE CASCADE
-- and recreate them as optional (nullable FK is already supported by Postgres)
-- The CASCADE delete will only fire when school_id IS NOT NULL and the school IS deleted.

-- Re-index to keep query performance after schema change
CREATE INDEX IF NOT EXISTS idx_comm_channels_school_nullable
  ON public.communication_channels(school_id)
  WHERE school_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comm_messages_school_nullable
  ON public.communication_messages(school_id)
  WHERE school_id IS NOT NULL;
