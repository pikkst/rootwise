-- Quest translations cache table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS quest_translations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quest_id uuid REFERENCES quests(id) ON DELETE CASCADE NOT NULL,
  locale text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  steps text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE (quest_id, locale)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_quest_translations_quest_locale
  ON quest_translations(quest_id, locale);

-- Enable RLS
ALTER TABLE quest_translations ENABLE ROW LEVEL SECURITY;

-- Anyone can read translations
CREATE POLICY "Anyone can read quest translations"
  ON quest_translations FOR SELECT
  USING (true);

-- Authenticated users can insert translations (via edge function)
CREATE POLICY "Authenticated users can insert translations"
  ON quest_translations FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can update translations
CREATE POLICY "Authenticated users can update translations"
  ON quest_translations FOR UPDATE
  USING (auth.role() = 'authenticated');
