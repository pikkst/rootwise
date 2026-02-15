-- Locations database for Rootwise
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL DEFAULT 'Estonia',
  county TEXT,
  city TEXT,
  locality TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (normalized_name)
);

CREATE TABLE IF NOT EXISTS profile_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_locations_country_city ON locations(country, city);
CREATE INDEX IF NOT EXISTS idx_locations_county ON locations(county);
CREATE INDEX IF NOT EXISTS idx_profile_locations_profile_id ON profile_locations(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_locations_location_id ON profile_locations(location_id);
CREATE INDEX IF NOT EXISTS idx_profile_locations_primary ON profile_locations(profile_id, is_primary);

CREATE OR REPLACE FUNCTION set_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locations_updated_at ON locations;
CREATE TRIGGER trg_locations_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW
EXECUTE FUNCTION set_locations_updated_at();

DROP TRIGGER IF EXISTS trg_profile_locations_updated_at ON profile_locations;
CREATE TRIGGER trg_profile_locations_updated_at
BEFORE UPDATE ON profile_locations
FOR EACH ROW
EXECUTE FUNCTION set_locations_updated_at();

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_locations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'locations' AND policyname = 'Locations are viewable by everyone'
  ) THEN
    CREATE POLICY "Locations are viewable by everyone" ON locations
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'locations' AND policyname = 'Authenticated users can insert locations'
  ) THEN
    CREATE POLICY "Authenticated users can insert locations" ON locations
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'locations' AND policyname = 'Platform admins can update locations'
  ) THEN
    CREATE POLICY "Platform admins can update locations" ON locations
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_locations' AND policyname = 'Public profile locations are viewable by everyone'
  ) THEN
    CREATE POLICY "Public profile locations are viewable by everyone" ON profile_locations
      FOR SELECT USING (visibility = 'public' OR auth.uid() = profile_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_locations' AND policyname = 'Users can insert own profile locations'
  ) THEN
    CREATE POLICY "Users can insert own profile locations" ON profile_locations
      FOR INSERT WITH CHECK (auth.uid() = profile_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_locations' AND policyname = 'Users can update own profile locations'
  ) THEN
    CREATE POLICY "Users can update own profile locations" ON profile_locations
      FOR UPDATE USING (auth.uid() = profile_id)
      WITH CHECK (auth.uid() = profile_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profile_locations' AND policyname = 'Users can delete own profile locations'
  ) THEN
    CREATE POLICY "Users can delete own profile locations" ON profile_locations
      FOR DELETE USING (auth.uid() = profile_id);
  END IF;
END $$;
