-- =====================================================================
-- AEGIS ERP: COMPLETE RAZORPAY PAYMENT SYSTEM MIGRATION
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- Safe to run multiple times — all statements use IF NOT EXISTS
-- =====================================================================

-- ─── 1. payment_orders ────────────────────────────────────────────────
-- Stores Razorpay order records with full metadata before payment
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID          NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subscription_id       UUID          REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payment_id            UUID          REFERENCES public.payments(id) ON DELETE SET NULL,
  razorpay_order_id     TEXT          UNIQUE NOT NULL,
  amount                NUMERIC(12,2) NOT NULL,
  currency              TEXT          NOT NULL DEFAULT 'INR',
  status                TEXT          NOT NULL DEFAULT 'created',
  -- 'created' | 'attempted' | 'paid' | 'failed' | 'expired'
  plan_code             TEXT,
  billing_cycle         TEXT,
  coupon_code           TEXT,
  original_amount       NUMERIC(12,2),
  discount_amount       NUMERIC(12,2) DEFAULT 0,
  gst_amount            NUMERIC(12,2) DEFAULT 0,
  notes                 JSONB,
  receipt               TEXT,
  attempts              INTEGER       DEFAULT 0,
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_orders_service_policy" ON public.payment_orders;
CREATE POLICY "payment_orders_service_policy" ON public.payment_orders
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.payment_orders REPLICA IDENTITY FULL;

-- ─── 2. payment_failures ──────────────────────────────────────────────
-- Logs every failed payment attempt with full error details
CREATE TABLE IF NOT EXISTS public.payment_failures (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID          REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id            UUID          REFERENCES public.payments(id) ON DELETE SET NULL,
  payment_order_id      TEXT,
  razorpay_payment_id   TEXT,
  razorpay_order_id     TEXT,
  error_code            TEXT,
  error_description     TEXT,
  error_reason          TEXT,
  error_source          TEXT,
  error_step            TEXT,
  error_metadata        JSONB,
  amount                NUMERIC(12,2),
  plan_code             TEXT,
  billing_cycle         TEXT,
  ip_address            TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE public.payment_failures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_failures_service_policy" ON public.payment_failures;
CREATE POLICY "payment_failures_service_policy" ON public.payment_failures
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 3. refunds ───────────────────────────────────────────────────────
-- Tracks all refund requests and their Razorpay status
CREATE TABLE IF NOT EXISTS public.refunds (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID          REFERENCES public.schools(id) ON DELETE CASCADE,
  payment_id            UUID          REFERENCES public.payments(id) ON DELETE SET NULL,
  razorpay_payment_id   TEXT,
  razorpay_refund_id    TEXT          UNIQUE,
  amount                NUMERIC(12,2) NOT NULL,
  currency              TEXT          DEFAULT 'INR',
  status                TEXT          DEFAULT 'pending',
  -- 'pending' | 'processed' | 'failed' | 'cancelled'
  reason                TEXT,
  notes                 JSONB,
  speed                 TEXT          DEFAULT 'normal',
  -- 'normal' | 'optimum'
  processed_at          TIMESTAMPTZ,
  initiated_by          UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  raw_response          JSONB,
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "refunds_service_policy" ON public.refunds;
CREATE POLICY "refunds_service_policy" ON public.refunds
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 4. webhook_logs ──────────────────────────────────────────────────
-- Stores every incoming Razorpay webhook event for audit and replay
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              TEXT          UNIQUE,
  -- Razorpay webhook event ID (for deduplication)
  event_type            TEXT          NOT NULL,
  -- e.g. 'payment.captured', 'refund.processed'
  entity_id             TEXT,
  -- Razorpay payment/order/refund ID from the event
  school_id             UUID          REFERENCES public.schools(id) ON DELETE SET NULL,
  payload               JSONB         NOT NULL,
  signature_valid       BOOLEAN       DEFAULT false,
  processing_status     TEXT          DEFAULT 'received',
  -- 'received' | 'processed' | 'failed' | 'ignored'
  processing_error      TEXT,
  processed_at          TIMESTAMPTZ,
  ip_address            TEXT,
  created_at            TIMESTAMPTZ   DEFAULT NOW()
);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_logs_service_policy" ON public.webhook_logs;
CREATE POLICY "webhook_logs_service_policy" ON public.webhook_logs
  FOR ALL USING (true) WITH CHECK (true);

-- ─── 5. Enhance payments table with new columns ────────────────────────
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS razorpay_order_id    TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_signature   TEXT,
  ADD COLUMN IF NOT EXISTS plan_code            TEXT,
  ADD COLUMN IF NOT EXISTS billing_cycle        TEXT,
  ADD COLUMN IF NOT EXISTS original_amount      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount      NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code          TEXT,
  ADD COLUMN IF NOT EXISTS gst_amount           NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS receipt_number       TEXT,
  ADD COLUMN IF NOT EXISTS invoice_number       TEXT,
  ADD COLUMN IF NOT EXISTS refunded_amount      NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_refunded          BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS failure_reason       TEXT,
  ADD COLUMN IF NOT EXISTS ip_address           TEXT,
  ADD COLUMN IF NOT EXISTS metadata             JSONB,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ;

-- ─── 6. Enhance payment_transactions with richer fields ────────────────
ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS gateway_refund_id    TEXT,
  ADD COLUMN IF NOT EXISTS amount               NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency             TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ;

-- ─── 7. Enhance payment_audit_logs with more fields ───────────────────
ALTER TABLE public.payment_audit_logs
  ADD COLUMN IF NOT EXISTS school_id            UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type           TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_order_id    TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS amount               NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS metadata             JSONB,
  ADD COLUMN IF NOT EXISTS ip_address           TEXT,
  ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ DEFAULT NOW();

-- ─── 8. Create indexes for query performance ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_payment_orders_school_id ON public.payment_orders(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order_id ON public.payment_orders(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_failures_school_id ON public.payment_failures(school_id);
CREATE INDEX IF NOT EXISTS idx_payment_failures_razorpay_payment_id ON public.payment_failures(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_school_id ON public.refunds(school_id);
CREATE INDEX IF NOT EXISTS idx_refunds_razorpay_payment_id ON public.refunds(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON public.webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON public.webhook_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_entity_id ON public.webhook_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON public.payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON public.payments(razorpay_order_id);

-- ─── 9. Enable realtime for payment tables ─────────────────────────────
ALTER TABLE public.payment_orders REPLICA IDENTITY FULL;
ALTER TABLE public.payment_failures REPLICA IDENTITY FULL;
ALTER TABLE public.refunds REPLICA IDENTITY FULL;
ALTER TABLE public.webhook_logs REPLICA IDENTITY FULL;
