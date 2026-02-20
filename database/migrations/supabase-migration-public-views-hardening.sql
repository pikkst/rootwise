-- ============================================================
-- Rootwise — Public Data Hardening (table-private + public views)
--
-- Goal:
--   1) Keep base tables (`profiles`, `quests`) non-public for anon role
--   2) Expose only safe field subsets via views
-- ============================================================

-- 1) Public-safe profile subset
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.name,
  p.age,
  p.role,
  p.bio,
  p.avatar_url,
  p.banner_url,
  p.banner_position_x,
  p.banner_position_y,
  p.skills,
  p.interests,
  p.preferred_language,
  p.spoken_languages,
  p.xp,
  p.level,
  p.created_at,
  p.updated_at
FROM public.profiles p;

-- 2) Public-safe quest subset (exclude draft)
CREATE OR REPLACE VIEW public.public_quests AS
SELECT
  q.id,
  q.title,
  q.description,
  q.category,
  q.community_id,
  q.status,
  q.quest_type,
  q.is_virtual,
  q.location,
  q.skills_required,
  q.age_range_min,
  q.age_range_max,
  q.reward_xp,
  q.image_url,
  q.steps,
  q.created_by,
  q.created_at,
  q.updated_at
FROM public.quests q
WHERE q.status <> 'draft';

-- 3) Public-safe posts subset
CREATE OR REPLACE VIEW public.public_posts AS
SELECT
  p.id,
  p.user_id,
  p.content,
  p.created_at
FROM public.posts p;

-- 4) Public-safe communities subset with member_count
CREATE OR REPLACE VIEW public.public_communities AS
SELECT
  c.id,
  c.name,
  c.description,
  c.icon,
  c.category,
  c.brand_color,
  c.logo_url,
  c.member_limit,
  c.created_by,
  c.created_at,
  COUNT(cm.user_id)::int AS member_count
FROM public.communities c
LEFT JOIN public.community_members cm ON c.id = cm.community_id
GROUP BY
  c.id,
  c.name,
  c.description,
  c.icon,
  c.category,
  c.brand_color,
  c.logo_url,
  c.member_limit,
  c.created_by,
  c.created_at;

-- 5) View grants for public consumption
GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT SELECT ON public.public_quests TO anon, authenticated;
GRANT SELECT ON public.public_posts TO anon, authenticated;
GRANT SELECT ON public.public_communities TO anon, authenticated;

-- 6) Tighten table-level SELECT policies (remove anonymous open-read)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Quests are viewable by everyone" ON public.quests;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Communities are viewable by everyone" ON public.communities;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Authenticated users can read profiles'
  ) THEN
    CREATE POLICY "Authenticated users can read profiles"
      ON public.profiles
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quests'
      AND policyname = 'Authenticated users can read quests'
  ) THEN
    CREATE POLICY "Authenticated users can read quests"
      ON public.quests
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posts'
      AND policyname = 'Authenticated users can read posts'
  ) THEN
    CREATE POLICY "Authenticated users can read posts"
      ON public.posts
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'communities'
      AND policyname = 'Authenticated users can read communities'
  ) THEN
    CREATE POLICY "Authenticated users can read communities"
      ON public.communities
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;