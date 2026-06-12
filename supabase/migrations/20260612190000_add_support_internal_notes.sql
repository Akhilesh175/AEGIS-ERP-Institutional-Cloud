-- =====================================================================
-- CREATE SUPPORT INTERNAL NOTES TABLE & POLICIES
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.support_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE public.support_internal_notes ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Super Admins can manage internal notes" ON public.support_internal_notes;

-- Create policy restricting it exclusively to SUPER_ADMIN role
CREATE POLICY "Super Admins can manage internal notes" ON public.support_internal_notes
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );
