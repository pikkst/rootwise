-- Add a platform admin user
-- 1) Replace the email below
-- 2) Run in Supabase SQL Editor

WITH target_user AS (
  SELECT id
  FROM auth.users
  WHERE lower(email) = lower('replace-with-email@example.com')
  LIMIT 1
)
INSERT INTO platform_admins (user_id, role)
SELECT id, 'admin'
FROM target_user
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
