-- Idempotently create the driver_salary_payouts table
CREATE TABLE IF NOT EXISTS public.driver_salary_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    attendance_record_id UUID REFERENCES public.driver_attendance(id) ON DELETE SET NULL,
    payout_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payout_status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    payout_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    transaction_reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.driver_salary_payouts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent duplication
DROP POLICY IF EXISTS "Enable all operations for school members" ON public.driver_salary_payouts;

-- Create school-scoped tenant isolation policy
CREATE POLICY "Enable all operations for school members" ON public.driver_salary_payouts
    FOR ALL
    TO authenticated
    USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));

-- Enable full realtime replication for WebSocket updates
ALTER TABLE public.driver_salary_payouts REPLICA IDENTITY FULL;

-- Ensure table is added to the real-time publication registry if exists
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.driver_salary_payouts;
  end if;
exception
  when others then null;
end;
$$;
