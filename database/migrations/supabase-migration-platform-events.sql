-- ============================================================
-- Rootwise — Platform events log table
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL DEFAULT 'stripe_webhook',
  event_name TEXT,
  user_id UUID,
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_created_at ON platform_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_user_id ON platform_events(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_status ON platform_events(status);

ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert platform events"
  ON platform_events FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can read platform events"
  ON platform_events FOR SELECT
  USING (auth.jwt()->>'role' = 'service_role');
