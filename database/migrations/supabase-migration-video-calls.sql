-- ============================================================
-- Quest Video Calls — call history & analytics
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create quest_video_calls table
CREATE TABLE IF NOT EXISTS quest_video_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
  room_name TEXT NOT NULL,
  created_by UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  participant_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_quest_video_calls_quest_id ON quest_video_calls(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_video_calls_status ON quest_video_calls(status);

-- 3. Enable RLS
ALTER TABLE quest_video_calls ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Quest members + creator can view calls for their quest
DROP POLICY IF EXISTS "Quest participants can view calls" ON quest_video_calls;
CREATE POLICY "Quest participants can view calls" ON quest_video_calls
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quest_members
      WHERE quest_members.quest_id = quest_video_calls.quest_id
        AND quest_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM quests
      WHERE quests.id = quest_video_calls.quest_id
        AND quests.created_by = auth.uid()
    )
  );

-- Any authenticated quest member can create a call record
DROP POLICY IF EXISTS "Quest members can create calls" ON quest_video_calls;
CREATE POLICY "Quest members can create calls" ON quest_video_calls
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND (
      EXISTS (
        SELECT 1 FROM quest_members
        WHERE quest_members.quest_id = quest_video_calls.quest_id
          AND quest_members.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM quests
        WHERE quests.id = quest_video_calls.quest_id
          AND quests.created_by = auth.uid()
      )
    )
  );

-- Call creator can update (e.g., mark ended)
DROP POLICY IF EXISTS "Call creator can update" ON quest_video_calls;
CREATE POLICY "Call creator can update" ON quest_video_calls
  FOR UPDATE USING (created_by = auth.uid());

-- ============================================================
-- Done! Video call history table is ready.
-- ============================================================
