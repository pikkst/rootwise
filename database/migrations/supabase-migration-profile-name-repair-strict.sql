-- Strict one-time repair for profile names that are stuck on placeholder/test values.
-- This migration intentionally updates only clearly invalid names.

BEGIN;

UPDATE public.profiles p
SET
  name = COALESCE(
    NULLIF(BTRIM(au.raw_user_meta_data->>'name'), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'display_name'), ''),
    NULLIF(BTRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'user_name'), ''),
    au.email
  ),
  updated_at = NOW()
FROM auth.users au
WHERE p.id = au.id
  AND COALESCE(
    NULLIF(BTRIM(au.raw_user_meta_data->>'name'), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'display_name'), ''),
    NULLIF(BTRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'user_name'), ''),
    au.email
  ) IS NOT NULL
  AND (
    p.name IS NULL
    OR BTRIM(p.name) = ''
    OR lower(BTRIM(p.name)) = lower(BTRIM(au.email))
    OR lower(BTRIM(p.name)) IN (
      'user',
      'test user',
      'villu test',
      'default user',
      'unknown user'
    )
  )
  AND p.name IS DISTINCT FROM COALESCE(
    NULLIF(BTRIM(au.raw_user_meta_data->>'name'), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'display_name'), ''),
    NULLIF(BTRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'user_name'), ''),
    au.email
  );

COMMIT;
