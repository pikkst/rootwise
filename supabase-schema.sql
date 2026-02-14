-- ============================================================
-- Rootwise: Intergenerational Wisdom Hub - Supabase Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Profiles (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  age INTEGER,
  role TEXT CHECK (role IN ('Sage', 'Seeker', 'Hybrid')) DEFAULT 'Hybrid',
  skills TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  avatar_url TEXT,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Quests
CREATE TABLE IF NOT EXISTS quests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  status TEXT CHECK (status IN ('active', 'completed', 'pending')) DEFAULT 'active',
  reward_xp INTEGER DEFAULT 100,
  image_url TEXT,
  steps TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Quest Participants (many-to-many)
CREATE TABLE IF NOT EXISTS quest_participants (
  quest_id UUID REFERENCES quests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (quest_id, user_id)
);

-- 4. Communities / Groups
CREATE TABLE IF NOT EXISTS communities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🌍',
  category TEXT DEFAULT 'General',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Community Members (many-to-many)
CREATE TABLE IF NOT EXISTS community_members (
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- 6. Chat Messages (for AI Nexus conversations)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sender TEXT CHECK (sender IN ('user', 'ai', 'partner')) NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Connections / Upcoming sessions
CREATE TABLE IF NOT EXISTS connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  topic TEXT,
  scheduled_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Quests: readable by all, insertable/updatable by authenticated users
CREATE POLICY "Quests are viewable by everyone" ON quests
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create quests" ON quests
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Quest creators can update their quests" ON quests
  FOR UPDATE USING (auth.uid() = created_by);

-- Quest Participants
CREATE POLICY "Quest participants are viewable by everyone" ON quest_participants
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can join quests" ON quest_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation" ON quest_participants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave quests" ON quest_participants
  FOR DELETE USING (auth.uid() = user_id);

-- Communities: readable by all
CREATE POLICY "Communities are viewable by everyone" ON communities
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create communities" ON communities
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Community Members
CREATE POLICY "Community members are viewable by everyone" ON community_members
  FOR SELECT USING (true);

CREATE POLICY "Users can join communities" ON community_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave communities" ON community_members
  FOR DELETE USING (auth.uid() = user_id);

-- Chat Messages: users can read/write only their own
CREATE POLICY "Users can read own messages" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Connections
CREATE POLICY "Users can view own connections" ON connections
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = partner_id);

CREATE POLICY "Users can create connections" ON connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections" ON connections
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = partner_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://i.pravatar.cc/150?u=' || NEW.id)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER quests_updated_at
  BEFORE UPDATE ON quests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SEED DATA: Default communities
-- ============================================================

INSERT INTO communities (name, description, icon, category) VALUES
  ('Traditional Cooking', 'Share recipes and cooking wisdom across generations', '🥘', 'Lifestyle'),
  ('Eco-Warriors', 'Building a sustainable future together', '🌿', 'Environment'),
  ('Tech Pioneers', 'Bridging the digital divide with hands-on learning', '🚀', 'Technology'),
  ('Historical Archivists', 'Preserving local and family histories', '📚', 'History'),
  ('Storytellers Circle', 'The art of oral storytelling and narrative craft', '📖', 'Arts'),
  ('Youth Mentorship', 'Structured mentorship between generations', '🎓', 'Education')
ON CONFLICT DO NOTHING;

-- Default quests
INSERT INTO quests (title, description, category, reward_xp, status) VALUES
  ('Digital Literacy Workshop', 'Teach an elder how to use video calls or learn the history of early computing from a veteran developer.', 'Technology', 250, 'active'),
  ('Urban Gardening Co-op', 'Seniors share soil wisdom while youth provide the muscle for a local sustainable food garden.', 'Environment', 300, 'active'),
  ('Financial Wisdom Series', 'Real-world wealth management talks where Gen X shares savings strategies with Gen Z.', 'Finance', 200, 'active')
ON CONFLICT DO NOTHING;

-- Create member count view for communities
CREATE OR REPLACE VIEW community_with_member_count AS
SELECT 
  c.*,
  COUNT(cm.user_id)::int AS member_count
FROM communities c
LEFT JOIN community_members cm ON c.id = cm.community_id
GROUP BY c.id;
