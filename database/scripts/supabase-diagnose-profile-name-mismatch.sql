-- Diagnostic: compare names used in Admin UI (public.profiles.name)
-- vs. values available in auth metadata per user.

SELECT
  cm.community_id,
  cm.user_id,
  p.name AS profile_name,
  au.email,
  au.raw_user_meta_data->>'name' AS meta_name,
  au.raw_user_meta_data->>'full_name' AS meta_full_name,
  au.raw_user_meta_data->>'display_name' AS meta_display_name,
  CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name') AS meta_first_last,
  au.raw_user_meta_data->>'user_name' AS meta_user_name,
  COALESCE(
    NULLIF(BTRIM(au.raw_user_meta_data->>'name'), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'display_name'), ''),
    NULLIF(BTRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
    NULLIF(BTRIM(au.raw_user_meta_data->>'user_name'), ''),
    au.email
  ) AS expected_name,
  CASE
    WHEN p.name IS DISTINCT FROM COALESCE(
      NULLIF(BTRIM(au.raw_user_meta_data->>'name'), ''),
      NULLIF(BTRIM(au.raw_user_meta_data->>'full_name'), ''),
      NULLIF(BTRIM(au.raw_user_meta_data->>'display_name'), ''),
      NULLIF(BTRIM(CONCAT_WS(' ', au.raw_user_meta_data->>'first_name', au.raw_user_meta_data->>'last_name')), ''),
      NULLIF(BTRIM(au.raw_user_meta_data->>'user_name'), ''),
      au.email
    ) THEN true
    ELSE false
  END AS is_mismatch
FROM public.community_members cm
LEFT JOIN public.profiles p ON p.id = cm.user_id
LEFT JOIN auth.users au ON au.id = cm.user_id
ORDER BY cm.community_id, cm.user_id;
