-- Idempotently update the schools table with country-based currency columns
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'USA';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) NOT NULL DEFAULT 'USD';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) NOT NULL DEFAULT '$';
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'America/New_York';

-- Idempotently update the driver_salary_payouts table to track payout currency parameters
ALTER TABLE public.driver_salary_payouts ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) NOT NULL DEFAULT 'USD';
ALTER TABLE public.driver_salary_payouts ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(10) NOT NULL DEFAULT '$';
