-- Fix profile name mismatches between auth.users and public.profiles
-- Root cause: some profiles may be created/kept with stale default names.
-- This migration:
--  1) Creates robust sync trigger for auth.users -> public.profiles
--  2) Backfills likely auto-created stale profile names safely

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_profile_identity_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_name text;
  v_avatar text;
BEGIN
  v_name := COALESCE(
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(BTRIM(CONCAT_WS(' ', NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'last_name')), ''),
    NULLIF(BTRIM(NEW.raw_user_meta_data->>'user_name'), ''),
    NEW.email
  );
  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', '')
  );

  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (NEW.id, v_name, v_avatar)
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

-- Recreate insert trigger to use robust sync function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_identity_from_auth();

-- Keep profile identity in sync when auth metadata/email changes
DROP TRIGGER IF EXISTS on_auth_user_identity_updated ON auth.users;
CREATE TRIGGER on_auth_user_identity_updated
  AFTER UPDATE OF raw_user_meta_data, email ON auth.users
  FOR EACH ROW
  WHEN (
    OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data
    OR OLD.email IS DISTINCT FROM NEW.email
  )
  EXECUTE FUNCTION public.sync_profile_identity_from_auth();

-- Backfill existing profiles likely affected by stale auto-created names.
-- Safety: only update profiles that look untouched since creation (<= 5 minutes),
-- or are empty; this avoids overwriting manually edited profile names.
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
  avatar_url = COALESCE(
    NULLIF(au.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(au.raw_user_meta_data->>'picture', ''),
    p.avatar_url
  ),
  updated_at = NOW()
FROM auth.users au
WHERE p.id = au.id
  AND (
    p.name IS NULL
    OR BTRIM(p.name) = ''
    OR (
      COALESCE(p.updated_at, p.created_at) <= p.created_at + INTERVAL '5 minutes'
      AND p.name IS DISTINCT FROM COALESCE(
        NULLIF(BTRIM(au.raw_user_meta_data->>'name'), ''),
        NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
        NULLIF(BTRIM(au.raw_user_meta_data->>'display_name'), ''),
        NULLIF(BTRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
        NULLIF(BTRIM(au.raw_user_meta_data->>'user_name'), ''),
        au.email
      )
    )
  );

COMMIT;
