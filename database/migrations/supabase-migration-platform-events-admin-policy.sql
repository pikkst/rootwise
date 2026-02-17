-- Allow platform admins to read all platform_events
-- Run in Supabase SQL Editor after platform_events table exists

DROP POLICY IF EXISTS "pe_select_own" ON platform_events;

CREATE POLICY "pe_select_own_or_admin"
  ON platform_events FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM platform_admins pa
      WHERE pa.user_id = auth.uid()
    )
  );
