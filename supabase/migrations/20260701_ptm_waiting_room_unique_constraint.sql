-- Migration: PTM Waiting Room Unique Constraint
-- Required for UPSERT onConflict: 'meeting_id,participant_id' in AegisMeet.tsx
-- This prevents duplicate waiting room rows on component re-mount.

-- Add unique constraint if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'meeting_waiting_room'::regclass
      AND contype = 'u'
      AND conname = 'meeting_waiting_room_meeting_participant_unique'
  ) THEN
    ALTER TABLE meeting_waiting_room
      ADD CONSTRAINT meeting_waiting_room_meeting_participant_unique
      UNIQUE (meeting_id, participant_id);
    RAISE NOTICE 'Added unique constraint on meeting_waiting_room(meeting_id, participant_id)';
  ELSE
    RAISE NOTICE 'Unique constraint already exists — skipping';
  END IF;
END;
$$;

-- Also reload schema cache to pick up constraint changes
NOTIFY pgrst, 'reload schema';
