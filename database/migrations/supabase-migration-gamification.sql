-- ============================================================
-- Rootwise — Gamification: Badges, Streaks, Quest Rarity
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- 1. QUEST RARITY
-- Adds a rarity tier to quests for RPG feel
-- ============================================================
ALTER TABLE quests
  ADD COLUMN IF NOT EXISTS rarity TEXT NOT NULL DEFAULT 'common'
  CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'));

CREATE INDEX IF NOT EXISTS idx_quests_rarity ON quests(rarity);

-- ============================================================
-- 2. DAILY STREAK TRACKING
-- Stored on profiles for simplicity; updated by RPC below
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS login_streak_days  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak_days   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date    DATE;

-- RPC: Increments streak if user logs in on a new day,
--      resets to 1 if they missed a day.
--      Returns: { streak_days, best_streak_days, is_new_day }
CREATE OR REPLACE FUNCTION update_streak()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today        DATE := CURRENT_DATE;
  v_yesterday    DATE := CURRENT_DATE - INTERVAL '1 day';
  v_last_login   DATE;
  v_streak       INT;
  v_best         INT;
  v_is_new_day   BOOLEAN := FALSE;
BEGIN
  SELECT last_login_date, login_streak_days, best_streak_days
    INTO v_last_login, v_streak, v_best
    FROM profiles
    WHERE id = auth.uid();

  -- Already logged in today — nothing to do
  IF v_last_login = v_today THEN
    RETURN jsonb_build_object(
      'streak_days',      v_streak,
      'best_streak_days', v_best,
      'is_new_day',       FALSE
    );
  END IF;

  v_is_new_day := TRUE;

  IF v_last_login = v_yesterday THEN
    -- Consecutive day
    v_streak := v_streak + 1;
  ELSE
    -- Missed at least one day or first login
    v_streak := 1;
  END IF;

  IF v_streak > v_best THEN
    v_best := v_streak;
  END IF;

  UPDATE profiles
     SET login_streak_days = v_streak,
         best_streak_days  = v_best,
         last_login_date   = v_today,
         last_seen_at      = NOW()
   WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'streak_days',      v_streak,
    'best_streak_days', v_best,
    'is_new_day',       TRUE
  );
END;
$$;

REVOKE ALL ON FUNCTION update_streak() FROM public;
GRANT EXECUTE ON FUNCTION update_streak() TO authenticated;

-- ============================================================
-- 3. USER BADGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Users cannot manually insert badges — only the RPC below can
CREATE POLICY "user_badges_select"
  ON user_badges FOR SELECT
  USING (TRUE);  -- badges are public (shown on profiles)

CREATE POLICY "user_badges_insert_deny"
  ON user_badges FOR INSERT
  WITH CHECK (FALSE);

CREATE POLICY "user_badges_update_deny"
  ON user_badges FOR UPDATE
  USING (FALSE);

CREATE POLICY "user_badges_delete_deny"
  ON user_badges FOR DELETE
  USING (FALSE);

-- ============================================================
-- 4. BADGE UNLOCK RPC
-- Called from client after relevant actions (quest complete,
-- profile update, etc.). Checks conditions and inserts new
-- badges atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION unlock_earned_badges(p_user_id UUID DEFAULT NULL)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           UUID := COALESCE(p_user_id, auth.uid());
  v_profile       RECORD;
  v_quests_joined INT;
  v_quests_done   INT;
  v_sage_done     INT;
  v_connections   INT;
  v_communities   INT;
  v_languages     INT;
  v_newly_unlocked TEXT[] := '{}';
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = v_uid;

  -- Count quests joined (as member)
  SELECT COUNT(*) INTO v_quests_joined
    FROM quest_members WHERE user_id = v_uid;

  -- Count quests completed (xp_awarded = true)
  SELECT COUNT(*) INTO v_quests_done
    FROM quest_members WHERE user_id = v_uid AND xp_awarded = TRUE;

  -- Count quests completed as mentor/creator (sage role)
  SELECT COUNT(*) INTO v_sage_done
    FROM quest_members
    WHERE user_id = v_uid
      AND xp_awarded = TRUE
      AND role IN ('creator', 'mentor');

  -- Count accepted connections
  SELECT COUNT(*) INTO v_connections
    FROM connections
    WHERE (user_id = v_uid OR partner_id = v_uid)
      AND status = 'completed';

  -- Count community memberships
  SELECT COUNT(*) INTO v_communities
    FROM community_members WHERE user_id = v_uid;

  -- Count spoken languages
  v_languages := COALESCE(array_length(v_profile.spoken_languages, 1), 0);

  -- Helper: try to insert a badge, add to result if newly inserted
  -- We use a local function pattern with exception handling
  DECLARE
    badge_definitions TEXT[] := ARRAY[
      'first_quest',
      'quest_5',
      'quest_20',
      'sage',
      'polyglot',
      'connector',
      'community_builder',
      'profile_complete',
      'streak_7',
      'streak_30',
      'legend_level'
    ];
    b TEXT;
    should_unlock BOOLEAN;
  BEGIN
    FOREACH b IN ARRAY badge_definitions LOOP
      -- Already has this badge? Skip
      IF EXISTS (SELECT 1 FROM user_badges WHERE user_id = v_uid AND badge_id = b) THEN
        CONTINUE;
      END IF;

      should_unlock := FALSE;
      CASE b
        WHEN 'first_quest'        THEN should_unlock := v_quests_joined >= 1;
        WHEN 'quest_5'            THEN should_unlock := v_quests_done >= 5;
        WHEN 'quest_20'           THEN should_unlock := v_quests_done >= 20;
        WHEN 'sage'               THEN should_unlock := v_sage_done >= 5;
        WHEN 'polyglot'           THEN should_unlock := v_languages >= 3;
        WHEN 'connector'          THEN should_unlock := v_connections >= 5;
        WHEN 'community_builder'  THEN should_unlock := v_communities >= 3;
        WHEN 'profile_complete'   THEN should_unlock :=
          v_profile.bio IS NOT NULL
          AND v_profile.age IS NOT NULL
          AND array_length(v_profile.skills, 1) > 0
          AND array_length(v_profile.interests, 1) > 0
          AND v_profile.avatar_url IS NOT NULL;
        WHEN 'streak_7'           THEN should_unlock := v_profile.best_streak_days >= 7;
        WHEN 'streak_30'          THEN should_unlock := v_profile.best_streak_days >= 30;
        WHEN 'legend_level'       THEN should_unlock := v_profile.level >= 20;
        ELSE should_unlock := FALSE;
      END CASE;

      IF should_unlock THEN
        INSERT INTO user_badges (user_id, badge_id)
          VALUES (v_uid, b)
          ON CONFLICT (user_id, badge_id) DO NOTHING;
        v_newly_unlocked := array_append(v_newly_unlocked, b);
      END IF;
    END LOOP;
  END;

  RETURN v_newly_unlocked;
END;
$$;

REVOKE ALL ON FUNCTION unlock_earned_badges(UUID) FROM public;
GRANT EXECUTE ON FUNCTION unlock_earned_badges(UUID) TO authenticated;

-- ============================================================
-- 5. LEADERBOARD VIEW (top 50 by XP, only public-safe fields)
-- ============================================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  p.id,
  p.name,
  p.avatar_url,
  p.role,
  p.xp,
  p.level,
  RANK() OVER (ORDER BY p.xp DESC) AS rank
FROM public.profiles p
ORDER BY p.xp DESC
LIMIT 50;

GRANT SELECT ON public.leaderboard TO anon, authenticated;

-- ============================================================
-- Done! Next steps:
--  - Deploy new Edge Function or update badge check on quest complete
--  - Call update_streak() on each page_view / auth event
-- ============================================================
