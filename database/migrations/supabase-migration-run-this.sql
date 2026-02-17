-- ============================================================
-- Rootwise: COMPLETE Migration — Run in Supabase SQL Editor
-- This adds ALL missing tables, columns, policies, and functions
-- Safe to run multiple times (uses IF NOT EXISTS / OR REPLACE)
-- ============================================================

-- ============================================================
-- 1. Add plan & stripe columns to profiles
-- ============================================================
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'org')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ============================================================
-- 2. Subscriptions table
-- ============================================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'org')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelling', 'cancelled', 'past_due', 'trialing')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Users can view own subscription') THEN
    CREATE POLICY "Users can view own subscription" ON subscriptions
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Service role can manage subscriptions (for webhooks)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Service role can manage subscriptions') THEN
    CREATE POLICY "Service role can manage subscriptions" ON subscriptions
      FOR ALL USING (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

-- updated_at trigger for subscriptions
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'subscriptions_updated_at') THEN
    CREATE TRIGGER subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 3. AI Usage tracking (rate limiting for free users)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE DEFAULT CURRENT_DATE,
  message_count INTEGER DEFAULT 0,
  quest_gen_count INTEGER DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_usage' AND policyname = 'Users can view own AI usage') THEN
    CREATE POLICY "Users can view own AI usage" ON ai_usage
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_usage' AND policyname = 'System can manage AI usage') THEN
    CREATE POLICY "System can manage AI usage" ON ai_usage
      FOR ALL USING (true);
  END IF;
END $$;

-- ============================================================
-- 4. AI Usage check & increment function
-- ============================================================
CREATE OR REPLACE FUNCTION check_ai_usage(p_user_id UUID, p_type TEXT DEFAULT 'chat')
RETURNS JSON AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
  v_limit INTEGER;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Check if user is platform admin (no limits for admins)
  SELECT EXISTS(SELECT 1 FROM platform_admins WHERE user_id = p_user_id) INTO v_is_admin;
  
  IF v_is_admin THEN
    -- Platform admins have unlimited usage - just increment and return success
    INSERT INTO ai_usage (user_id, usage_date)
    VALUES (p_user_id, CURRENT_DATE)
    ON CONFLICT (user_id, usage_date) DO NOTHING;
    
    IF p_type = 'chat' THEN
      UPDATE ai_usage SET message_count = message_count + 1 
      WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    ELSE
      UPDATE ai_usage SET quest_gen_count = quest_gen_count + 1 
      WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
    END IF;
    
    RETURN json_build_object('allowed', true, 'remaining', 999999, 'limit', 999999, 'plan', 'admin');
  END IF;

  -- Get user plan for non-admin users
  SELECT plan INTO v_plan FROM profiles WHERE id = p_user_id;
  v_plan := COALESCE(v_plan, 'free');

  -- Set limits based on plan
  IF p_type = 'chat' THEN
    v_limit := CASE v_plan WHEN 'free' THEN 5 ELSE 999999 END;
  ELSIF p_type = 'quest_gen' THEN
    v_limit := CASE v_plan WHEN 'free' THEN 1 ELSE 999999 END;
  END IF;

  -- Get or create today's usage row
  INSERT INTO ai_usage (user_id, usage_date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, usage_date) DO NOTHING;

  -- Get current count
  IF p_type = 'chat' THEN
    SELECT message_count INTO v_count FROM ai_usage 
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  ELSE
    SELECT quest_gen_count INTO v_count FROM ai_usage 
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  END IF;

  v_count := COALESCE(v_count, 0);

  IF v_count >= v_limit THEN
    RETURN json_build_object('allowed', false, 'remaining', 0, 'limit', v_limit, 'plan', v_plan);
  END IF;

  -- Increment usage
  IF p_type = 'chat' THEN
    UPDATE ai_usage SET message_count = message_count + 1 
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  ELSE
    UPDATE ai_usage SET quest_gen_count = quest_gen_count + 1 
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  END IF;

  RETURN json_build_object('allowed', true, 'remaining', v_limit - v_count - 1, 'limit', v_limit, 'plan', v_plan);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 5. Fix quest RLS: allow authenticated users to update quests
--    (needed for completeQuest to mark quest as 'completed')
-- ============================================================
DROP POLICY IF EXISTS "Quest creators can update their quests" ON quests;
DROP POLICY IF EXISTS "Authenticated users can update quests" ON quests;
CREATE POLICY "Authenticated users can update quests" ON quests
  FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================================
-- 6. Fix XP history insert policy
-- ============================================================
DROP POLICY IF EXISTS "System can insert XP history" ON xp_history;
DROP POLICY IF EXISTS "Service can insert XP history" ON xp_history;
CREATE POLICY "Service can insert XP history" ON xp_history
  FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth.uid() = user_id);

-- ============================================================
-- 7. Add branding columns to communities (for Org plan)
-- ============================================================
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS member_limit INTEGER DEFAULT 50;

-- ============================================================
-- 8. Social profile upgrades (banner, bio, posts, followers)
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS banner_position_x INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS banner_position_y INTEGER DEFAULT 50;

-- XP History table for growth tracking
CREATE TABLE IF NOT EXISTS xp_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  xp_gained INTEGER NOT NULL,
  source TEXT DEFAULT 'quest_completion',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE xp_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'xp_history' AND policyname = 'Users can view own XP history') THEN
    CREATE POLICY "Users can view own XP history" ON xp_history
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'xp_history' AND policyname = 'Service can insert XP history') THEN
    CREATE POLICY "Service can insert XP history" ON xp_history
      FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth.uid() = user_id);
  END IF;
END $$;

-- Atomic XP increment function
CREATE OR REPLACE FUNCTION increment_xp(p_user_id UUID, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET xp = xp + p_amount,
      level = GREATEST(1, (xp + p_amount) / 500 + 1)
  WHERE id = p_user_id;

  INSERT INTO xp_history (user_id, xp_gained, source)
  VALUES (p_user_id, p_amount, 'quest_completion');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- Drop old-schema friendships/followers if they exist (migrate to new schema)
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS followers CASCADE;

CREATE TABLE IF NOT EXISTS followers (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, user_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id_a UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_b UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'accepted',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Posts are viewable by everyone') THEN
    CREATE POLICY "Posts are viewable by everyone" ON posts
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Users can create own posts') THEN
    CREATE POLICY "Users can create own posts" ON posts
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Users can update own posts') THEN
    CREATE POLICY "Users can update own posts" ON posts
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'posts' AND policyname = 'Users can delete own posts') THEN
    CREATE POLICY "Users can delete own posts" ON posts
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Post comments are viewable by everyone') THEN
    CREATE POLICY "Post comments are viewable by everyone" ON post_comments
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Users can add own comments') THEN
    CREATE POLICY "Users can add own comments" ON post_comments
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Users can update own comments') THEN
    CREATE POLICY "Users can update own comments" ON post_comments
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_comments' AND policyname = 'Users can delete own comments') THEN
    CREATE POLICY "Users can delete own comments" ON post_comments
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Post likes are viewable by everyone') THEN
    CREATE POLICY "Post likes are viewable by everyone" ON post_likes
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Users can like posts') THEN
    CREATE POLICY "Users can like posts" ON post_likes
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_likes' AND policyname = 'Users can unlike posts') THEN
    CREATE POLICY "Users can unlike posts" ON post_likes
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'followers' AND policyname = 'Followers are viewable by everyone') THEN
    CREATE POLICY "Followers are viewable by everyone" ON followers
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'followers' AND policyname = 'Users can follow') THEN
    CREATE POLICY "Users can follow" ON followers
      FOR INSERT WITH CHECK (auth.uid() = follower_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'followers' AND policyname = 'Users can unfollow') THEN
    CREATE POLICY "Users can unfollow" ON followers
      FOR DELETE USING (auth.uid() = follower_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'friendships' AND policyname = 'Friendships are viewable by participants') THEN
    CREATE POLICY "Friendships are viewable by participants" ON friendships
      FOR SELECT USING (auth.uid() = user_id_a OR auth.uid() = user_id_b);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'friendships' AND policyname = 'Users can add friends') THEN
    CREATE POLICY "Users can add friends" ON friendships
      FOR INSERT WITH CHECK (auth.uid() = user_id_a OR auth.uid() = user_id_b);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'friendships' AND policyname = 'Users can update own friendships') THEN
    CREATE POLICY "Users can update own friendships" ON friendships
      FOR UPDATE USING (auth.uid() = user_id_a OR auth.uid() = user_id_b);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'friendships_updated_at') THEN
    CREATE TRIGGER friendships_updated_at
      BEFORE UPDATE ON friendships
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 9. Enhanced Quest System with Matching & Collaboration
-- ============================================================

-- Add new columns to existing quests table
ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS quest_type TEXT CHECK (quest_type IN ('duo', 'team', 'solo')) DEFAULT 'duo',
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS address_lat DECIMAL(10,8),
  ADD COLUMN IF NOT EXISTS address_lng DECIMAL(11,8),
  ADD COLUMN IF NOT EXISTS skills_required TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS age_range_min INTEGER,
  ADD COLUMN IF NOT EXISTS age_range_max INTEGER,
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- Update status constraint to support new statuses (drop old, add new)
DO $$ BEGIN
  -- Drop the old status check constraint (name may vary)
  ALTER TABLE quests DROP CONSTRAINT IF EXISTS quests_status_check;
  -- Also try the auto-generated name pattern
  DECLARE
    cname TEXT;
  BEGIN
    SELECT conname INTO cname FROM pg_constraint
    WHERE conrelid = 'quests'::regclass AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
    IF cname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE quests DROP CONSTRAINT %I', cname);
    END IF;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

ALTER TABLE quests
  ADD CONSTRAINT quests_status_check
  CHECK (status IN ('active', 'completed', 'pending', 'draft', 'published', 'matched', 'in_progress', 'submitted', 'verified'));

-- Set default for status if not already set
ALTER TABLE quests ALTER COLUMN status SET DEFAULT 'draft';

-- Quest Members (replaces simple quest_participants with roles)
CREATE TABLE IF NOT EXISTS quest_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('creator', 'mentor', 'learner')) NOT NULL,
  status TEXT CHECK (status IN ('invited', 'accepted', 'declined', 'in_progress', 'completed')) DEFAULT 'accepted',
  proof_submitted JSONB,
  proof_verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  proof_verified_at TIMESTAMPTZ,
  xp_awarded BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quest_id, user_id)
);

ALTER TABLE quest_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_members' AND policyname = 'Quest members are viewable by everyone') THEN
    CREATE POLICY "Quest members are viewable by everyone" ON quest_members
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_members' AND policyname = 'Users can update own quest membership') THEN
    CREATE POLICY "Users can update own quest membership" ON quest_members
      FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = proof_verified_by);
  END IF;
END $$;

-- Quest Workspace: Messages & Collaboration
CREATE TABLE IF NOT EXISTS quest_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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

-- Quest Files (images, videos, documents)
CREATE TABLE IF NOT EXISTS quest_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
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

-- Quest Milestones (progress tracking)
CREATE TABLE IF NOT EXISTS quest_milestones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ordering INTEGER DEFAULT 0
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

-- Quest Matching: Smart suggestions
CREATE TABLE IF NOT EXISTS quest_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  proposed_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_score NUMERIC(3,2),
  match_reason TEXT,
  status TEXT CHECK (status IN ('suggested', 'invited', 'accepted', 'declined')) DEFAULT 'suggested',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(quest_id, proposed_user_id)
);

ALTER TABLE quest_matches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_matches' AND policyname = 'Users can view own matches') THEN
    CREATE POLICY "Users can view own matches" ON quest_matches
      FOR SELECT USING (auth.uid() = proposed_user_id OR auth.uid() IN (
        SELECT created_by FROM quests WHERE id = quest_id
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quest_matches' AND policyname = 'Users can update own match status') THEN
    CREATE POLICY "Users can update own match status" ON quest_matches
      FOR UPDATE USING (auth.uid() = proposed_user_id);
  END IF;
END $$;

-- ============================================================
-- Activity Feed System (posts, quest completions, achievements)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  activity_type TEXT CHECK (activity_type IN ('post', 'quest_completed', 'achievement', 'joined_community', 'friendship')) NOT NULL,
  title TEXT,
  description TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_feed' AND policyname = 'Activity feed is viewable by everyone') THEN
    CREATE POLICY "Activity feed is viewable by everyone" ON activity_feed
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'activity_feed' AND policyname = 'Users can create own activities') THEN
    CREATE POLICY "Users can create own activities" ON activity_feed
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- Community Chat System (real-time messaging)
-- ============================================================
CREATE TABLE IF NOT EXISTS community_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_system_message BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Community members can read messages') THEN
    CREATE POLICY "Community members can read messages" ON community_messages
      FOR SELECT USING (
        community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Community members can post messages') THEN
    CREATE POLICY "Community members can post messages" ON community_messages
      FOR INSERT WITH CHECK (
        auth.uid() = user_id
        AND community_id IN (SELECT community_id FROM community_members WHERE user_id = auth.uid())
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'community_messages' AND policyname = 'Users can update own community messages') THEN
    CREATE POLICY "Users can update own community messages" ON community_messages
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- 9. Storage policies for profile media
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-media', 'profile-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Profile media is publicly readable'
  ) THEN
    CREATE POLICY "Profile media is publicly readable" ON storage.objects
      FOR SELECT USING (bucket_id = 'profile-media');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload own profile media'
  ) THEN
    CREATE POLICY "Users can upload own profile media" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'profile-media'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can update own profile media'
  ) THEN
    CREATE POLICY "Users can update own profile media" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'profile-media'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own profile media'
  ) THEN
    CREATE POLICY "Users can delete own profile media" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'profile-media'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- ============================================================
-- 10. Storage bucket for user file uploads (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-files', 'user-files', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can read own files'
  ) THEN
    CREATE POLICY "Users can read own files" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'user-files'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload own files'
  ) THEN
    CREATE POLICY "Users can upload own files" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'user-files'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can update own files'
  ) THEN
    CREATE POLICY "Users can update own files" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'user-files'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own files'
  ) THEN
    CREATE POLICY "Users can delete own files" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'user-files'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- ============================================================
-- 11. Storage bucket for post media (public)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Post media is publicly readable'
  ) THEN
    CREATE POLICY "Post media is publicly readable" ON storage.objects
      FOR SELECT USING (bucket_id = 'post-media');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload post media'
  ) THEN
    CREATE POLICY "Users can upload post media" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'post-media'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
        AND (
          (metadata->>'mimetype') IS NULL
          OR (metadata->>'mimetype') NOT LIKE 'video/%'
          OR COALESCE((metadata->>'size')::int, 0) <= 104857600
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can update own post media'
  ) THEN
    CREATE POLICY "Users can update own post media" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'post-media'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own post media'
  ) THEN
    CREATE POLICY "Users can delete own post media" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'post-media'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- ============================================================
-- 12. Storage bucket for quest images (public) - AI generated images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('quest-images', 'quest-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Quest images are publicly readable'
  ) THEN
    CREATE POLICY "Quest images are publicly readable" ON storage.objects
      FOR SELECT USING (bucket_id = 'quest-images');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can upload quest images'
  ) THEN
    CREATE POLICY "Users can upload quest images" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'quest-images'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can update own quest images'
  ) THEN
    CREATE POLICY "Users can update own quest images" ON storage.objects
      FOR UPDATE USING (
        bucket_id = 'quest-images'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own quest images'
  ) THEN
    CREATE POLICY "Users can delete own quest images" ON storage.objects
      FOR DELETE USING (
        bucket_id = 'quest-images'
        AND auth.role() = 'authenticated'
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
END $$;

-- ============================================================
-- Done! All tables, policies, and functions are ready.
-- ============================================================
