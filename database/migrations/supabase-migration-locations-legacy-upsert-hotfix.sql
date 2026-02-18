-- Rootwise: temporary hotfix for legacy clients using locations upsert
-- Run in Supabase SQL Editor

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'locations' AND policyname = 'Authenticated users can update locations (legacy upsert hotfix)'
  ) THEN
    CREATE POLICY "Authenticated users can update locations (legacy upsert hotfix)" ON locations
      FOR UPDATE
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
