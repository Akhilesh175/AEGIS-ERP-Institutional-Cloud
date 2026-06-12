-- =====================================================================
-- AEGIS COMMUNICATOR MIGRATION: CREATE NEW COMMUNICATION TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.communication_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('DIRECT', 'GROUP')),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.communication_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.communication_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT comm_channel_participant_uniq UNIQUE (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.communication_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.communication_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_role TEXT NOT NULL,
  message_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_status BOOLEAN NOT NULL DEFAULT FALSE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.communication_message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.communication_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT comm_message_read_uniq UNIQUE (message_id, user_id)
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_comm_channels_school ON public.communication_channels(school_id);
CREATE INDEX IF NOT EXISTS idx_comm_participants_channel ON public.communication_participants(channel_id);
CREATE INDEX IF NOT EXISTS idx_comm_participants_user ON public.communication_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_comm_messages_channel ON public.communication_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_comm_messages_sender ON public.communication_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_comm_messages_receiver ON public.communication_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_comm_message_reads_msg ON public.communication_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_comm_message_reads_user ON public.communication_message_reads(user_id);

-- Enable Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'communication_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_messages;
    END IF;
  END IF;
END $$;
