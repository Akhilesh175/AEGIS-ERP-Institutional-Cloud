-- =====================================================================
-- AEGIS COMMUNICATOR MIGRATION: CREATE MESSAGING TABLES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.messaging_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('DIRECT', 'GROUP')),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messaging_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.messaging_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT channel_participant_uniq UNIQUE (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.messaging_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_read BOOLEAN NOT NULL DEFAULT FALSE
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_messaging_channels_school ON public.messaging_channels(school_id);
CREATE INDEX IF NOT EXISTS idx_messaging_participants_channel ON public.messaging_participants(channel_id);
CREATE INDEX IF NOT EXISTS idx_messaging_participants_user ON public.messaging_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
