-- ============================================================
-- Rootwise: AI Mentor Memory — persistent user facts
-- Run this in Supabase SQL Editor
-- ============================================================

-- Table to store AI-learned facts about each user
-- The "facts" column is a JSONB object like:
--   { "career_goal": "wants to learn coding", "family": "has 2 grandchildren" }
CREATE TABLE IF NOT EXISTS user_ai_memory (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  facts JSONB DEFAULT '{}'::jsonb NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Users can only read/update their own memory
ALTER TABLE user_ai_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own AI memory"
  ON user_ai_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own AI memory"
  ON user_ai_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own AI memory"
  ON user_ai_memory FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role (edge functions) needs full access
CREATE POLICY "Service role full access to AI memory"
  ON user_ai_memory FOR ALL
  USING (auth.role() = 'service_role');

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_ai_memory_user_id ON user_ai_memory(user_id);
