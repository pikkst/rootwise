-- ============================================================
-- Rootwise — Add one-time trial flag
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN NOT NULL DEFAULT FALSE;
