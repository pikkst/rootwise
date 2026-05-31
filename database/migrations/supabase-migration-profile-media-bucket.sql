-- ============================================================
-- Rootwise — Create profile-media Storage bucket
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-media', 'profile-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Profile media is publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'profile-media');

-- Upload (authenticated users only to their own folder)
CREATE POLICY "Users can upload own profile media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'profile-media'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Update own files
CREATE POLICY "Users can update own profile media" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'profile-media'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Delete own files
CREATE POLICY "Users can delete own profile media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'profile-media'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
