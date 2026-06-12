-- =====================================================================
-- PASSWORD RESET SECURITY AND AUDITING SCHEMA
-- =====================================================================

-- 1. Create table for password reset OTP codes
CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    attempt_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create table for auditing password resets
CREATE TABLE IF NOT EXISTS public.password_reset_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    action TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_logs ENABLE ROW LEVEL SECURITY;

-- No public policies are created. All queries are restricted to backend execution using service_role key.
