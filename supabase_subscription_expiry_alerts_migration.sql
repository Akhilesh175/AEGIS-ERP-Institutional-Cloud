-- =====================================================================
-- AEGIS ERP: SUBSCRIPTION EXPIRY ALERTS MIGRATION
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard
-- =====================================================================

-- Add alert tracking and renewal fields to subscriptions table
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_notification_date DATE,
  ADD COLUMN IF NOT EXISTS notification_sent TEXT,
  ADD COLUMN IF NOT EXISTS renewed_at TIMESTAMPTZ;

-- Enable full replica identity for subscriptions table to support Realtime broadcasts
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
