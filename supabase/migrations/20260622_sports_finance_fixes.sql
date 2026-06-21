-- Drop NOT NULL constraints from sports_fine_payments columns
ALTER TABLE public.sports_fine_payments ALTER COLUMN utr_reference DROP NOT NULL;
ALTER TABLE public.sports_fine_payments ALTER COLUMN proof_image_url DROP NOT NULL;

-- Create sports_expense_history table if not exists
CREATE TABLE IF NOT EXISTS public.sports_expense_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.sports_expense_requests(id) ON DELETE SET NULL,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on sports_expense_history
ALTER TABLE public.sports_expense_history ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists and create new one
DROP POLICY IF EXISTS sports_expense_history_policy ON public.sports_expense_history;
CREATE POLICY sports_expense_history_policy ON public.sports_expense_history
  FOR ALL USING (school_id = get_auth_user_school_id());

-- Add sports_expense_history to supabase_realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sports_expense_history;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_expense_history;
