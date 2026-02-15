-- ============================================================
-- FIX: Update quests status constraint + create missing tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Find and drop the old status constraint
DO $$ 
DECLARE
  cname TEXT;
BEGIN
  FOR cname IN 
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'quests'::regclass 
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE quests DROP CONSTRAINT %I', cname);
    RAISE NOTICE 'Dropped constraint: %', cname;
  END LOOP;
END $$;

-- Step 2: Add the new constraint with all valid statuses
ALTER TABLE quests
  ADD CONSTRAINT quests_status_check
  CHECK (status IN ('active', 'completed', 'pending', 'draft', 'published', 'matched', 'in_progress', 'submitted', 'verified'));

-- Step 3: Set default status to 'draft' for new quests
ALTER TABLE quests ALTER COLUMN status SET DEFAULT 'draft';

-- Step 4: Add missing columns to quests table
ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS quest_type TEXT DEFAULT 'duo',
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS address_lat DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS address_lng DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS skills_required TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS age_range_min INTEGER,
  ADD COLUMN IF NOT EXISTS age_range_max INTEGER,
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- Step 5: Quest Members table
CREATE TABLE IF NOT EXISTS quest_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('creator', 'mentor', 'learner')) NOT NULL,
  status TEXT CHECK (status IN ('invited', 'accepted', 'declined', 'in_progress', 'completed', 'active')) DEFAULT 'accepted',
  proof_submitted JSONB,
  proof_verified BOOLEAN DEFAULT false,
  proof_verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  proof_verified_at TIMESTAMPTZ,
  proof_submitted_at TIMESTAMPTZ,
  xp_awarded BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quest_id, user_id)
);

ALTER TABLE quest_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_members' AND policyname = 'Quest members can view members') THEN
    CREATE POLICY "Quest members can view members" ON quest_members
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_members' AND policyname = 'Users can join quests') THEN
    CREATE POLICY "Users can join quests" ON quest_members
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_members' AND policyname = 'Users can update own membership') THEN
    CREATE POLICY "Users can update own membership" ON quest_members
      FOR UPDATE USING (auth.uid() = user_id OR quest_id IN (
        SELECT quest_id FROM quest_members WHERE user_id = auth.uid() AND role = 'creator'
      ));
  END IF;
END $$;

-- Step 6: Quest Messages table
CREATE TABLE IF NOT EXISTS quest_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quest_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_messages' AND policyname = 'Quest members can read messages') THEN
    CREATE POLICY "Quest members can read messages" ON quest_messages
      FOR SELECT USING (
        quest_id IN (SELECT quest_id FROM quest_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_messages' AND policyname = 'Quest members can post messages') THEN
    CREATE POLICY "Quest members can post messages" ON quest_messages
      FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND quest_id IN (SELECT quest_id FROM quest_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Step 7: Quest Files table
CREATE TABLE IF NOT EXISTS quest_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quest_files ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_files' AND policyname = 'Quest members can view files') THEN
    CREATE POLICY "Quest members can view files" ON quest_files
      FOR SELECT USING (
        quest_id IN (SELECT quest_id FROM quest_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_files' AND policyname = 'Users can upload quest files') THEN
    CREATE POLICY "Users can upload quest files" ON quest_files
      FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND quest_id IN (SELECT quest_id FROM quest_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

-- Step 8: Quest Milestones table
CREATE TABLE IF NOT EXISTS quest_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quest_milestones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_milestones' AND policyname = 'Quest members can view milestones') THEN
    CREATE POLICY "Quest members can view milestones" ON quest_milestones
      FOR SELECT USING (
        quest_id IN (SELECT quest_id FROM quest_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_milestones' AND policyname = 'Users can update milestones') THEN
    CREATE POLICY "Users can update milestones" ON quest_milestones
      FOR UPDATE USING (
        quest_id IN (SELECT quest_id FROM quest_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;
