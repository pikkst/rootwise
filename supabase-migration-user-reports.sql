-- User report system (users, posts, bugs, suggestions)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('user', 'post', 'bug', 'suggestion', 'other')),
  target_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  source_path TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_reports_reporter_id ON user_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports(status);
CREATE INDEX IF NOT EXISTS idx_user_reports_report_type ON user_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_user_reports_target_user_id ON user_reports(target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_target_post_id ON user_reports(target_post_id);

CREATE OR REPLACE FUNCTION set_user_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_reports_updated_at ON user_reports;
CREATE TRIGGER trg_user_reports_updated_at
BEFORE UPDATE ON user_reports
FOR EACH ROW
EXECUTE FUNCTION set_user_reports_updated_at();

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reports' AND policyname = 'Users can create reports'
  ) THEN
    CREATE POLICY "Users can create reports" ON user_reports
      FOR INSERT WITH CHECK (auth.uid() = reporter_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reports' AND policyname = 'Users can view own reports'
  ) THEN
    CREATE POLICY "Users can view own reports" ON user_reports
      FOR SELECT USING (auth.uid() = reporter_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reports' AND policyname = 'Platform admins can view all reports'
  ) THEN
    CREATE POLICY "Platform admins can view all reports" ON user_reports
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM platform_admins pa
          WHERE pa.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_reports' AND policyname = 'Platform admins can update reports'
  ) THEN
    CREATE POLICY "Platform admins can update reports" ON user_reports
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM platform_admins pa
          WHERE pa.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM platform_admins pa
          WHERE pa.user_id = auth.uid()
        )
      );
  END IF;
END $$;
