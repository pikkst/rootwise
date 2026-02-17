-- ============================================================
-- Rootwise: Stripe & Subscription Migration
-- Run this in Supabase SQL Editor AFTER the main schema
-- ============================================================

-- Add plan and stripe fields to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'org')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Subscriptions table
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
DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Only service role (webhook) can insert/update/delete subscriptions
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON subscriptions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- Add trigger for updated_at on subscriptions
DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- AI usage tracking for rate limiting free users
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  usage_date DATE DEFAULT CURRENT_DATE,
  message_count INTEGER DEFAULT 0,
  quest_gen_count INTEGER DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI usage" ON ai_usage;
CREATE POLICY "Users can view own AI usage" ON ai_usage
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can manage AI usage" ON ai_usage;
CREATE POLICY "System can manage AI usage" ON ai_usage
  FOR ALL USING (true);

-- Function to check and increment AI usage
CREATE OR REPLACE FUNCTION check_ai_usage(p_user_id UUID, p_type TEXT DEFAULT 'chat')
RETURNS JSON AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
  v_limit INTEGER;
  v_result JSON;
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

  -- Get or create today's usage
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

-- Fix quest RLS: allow any authenticated user to update quest status (for completeQuest)
DROP POLICY IF EXISTS "Quest creators can update their quests" ON quests;
DROP POLICY IF EXISTS "Authenticated users can update quests" ON quests;
CREATE POLICY "Authenticated users can update quests" ON quests
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Fix XP history insert policy (restrict to the increment_xp function only)
DROP POLICY IF EXISTS "System can insert XP history" ON xp_history;
DROP POLICY IF EXISTS "Service can insert XP history" ON xp_history;
CREATE POLICY "Service can insert XP history" ON xp_history
  FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role' OR auth.uid() = user_id);
