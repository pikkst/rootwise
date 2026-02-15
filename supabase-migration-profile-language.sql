-- Profile language support for Rootwise
-- Run in Supabase SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT,
  ADD COLUMN IF NOT EXISTS spoken_languages TEXT[] DEFAULT '{}';

-- Optional light validation via CHECK (keeps existing rows valid)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_preferred_language_not_empty'
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_preferred_language_not_empty
      CHECK (preferred_language IS NULL OR length(trim(preferred_language)) > 0);
  END IF;
END $$;
