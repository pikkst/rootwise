-- Platform admin setup for Rootwise
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS platform_admins (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_admins' AND policyname = 'Users can view own platform admin status'
  ) THEN
    CREATE POLICY "Users can view own platform admin status" ON platform_admins
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'platform_admins' AND policyname = 'Service role can manage platform admins'
  ) THEN
    CREATE POLICY "Service role can manage platform admins" ON platform_admins
      FOR ALL USING (auth.jwt()->>'role' = 'service_role')
      WITH CHECK (auth.jwt()->>'role' = 'service_role');
  END IF;
END $$;

INSERT INTO platform_admins (user_id, role)
VALUES ('10cb219e-fae6-420e-8615-b8fd91860018', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
