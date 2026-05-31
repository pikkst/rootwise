-- ============================================================
-- Rootwise — JaaS video call events table
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS jaas_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  room_name TEXT,
  user_id TEXT,
  participant_id TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jaas_events_room_name ON jaas_events(room_name);
CREATE INDEX IF NOT EXISTS idx_jaas_events_received_at ON jaas_events(received_at DESC);

ALTER TABLE jaas_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert jaas events"
  ON jaas_events FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role can read jaas events"
  ON jaas_events FOR SELECT
  USING (auth.jwt()->>'role' = 'service_role');
