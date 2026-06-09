
// ============================================================
// Supabase Database Types
// ============================================================

type DatabaseRow<T> = T & Record<string, any>;
type DatabaseInsert<T> = Partial<T> & Record<string, any>;
type DatabaseUpdate<T> = Partial<T> & Record<string, any>;

export interface Database {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      };
      profiles: {
        Row: DatabaseRow<Profile>;
        Insert: DatabaseInsert<Partial<Profile> & { id: string }>;
        Update: DatabaseUpdate<Partial<Profile>>;
        Relationships: [];
      };
      quests: {
        Row: DatabaseRow<DbQuest>;
        Insert: DatabaseInsert<Partial<DbQuest>>;
        Update: DatabaseUpdate<Partial<DbQuest>>;
        Relationships: [];
      };
      communities: {
        Row: DatabaseRow<Community>;
        Insert: DatabaseInsert<Partial<Community>>;
        Update: DatabaseUpdate<Partial<Community>>;
        Relationships: [];
      };
      community_members: {
        Row: DatabaseRow<CommunityMember>;
        Insert: DatabaseInsert<Omit<CommunityMember, 'joined_at'>>;
        Update: DatabaseUpdate<Partial<CommunityMember>>;
        Relationships: [];
      };
      chat_messages: {
        Row: DatabaseRow<DbChatMessage>;
        Insert: DatabaseInsert<Omit<DbChatMessage, 'id' | 'created_at'>>;
        Update: DatabaseUpdate<Partial<DbChatMessage>>;
        Relationships: [];
      };
      connections: {
        Row: DatabaseRow<Connection>;
        Insert: DatabaseInsert<Omit<Connection, 'id' | 'created_at'>>;
        Update: DatabaseUpdate<Partial<Connection>>;
        Relationships: [];
      };
      posts: {
        Row: DatabaseRow<Post>;
        Insert: DatabaseInsert<Omit<Post, 'id' | 'created_at'>>;
        Update: DatabaseUpdate<Partial<Post>>;
        Relationships: [];
      };
      post_comments: {
        Row: DatabaseRow<PostComment>;
        Insert: DatabaseInsert<Omit<PostComment, 'id' | 'created_at'>>;
        Update: DatabaseUpdate<Partial<PostComment>>;
        Relationships: [];
      };
      post_likes: {
        Row: DatabaseRow<PostLike>;
        Insert: DatabaseInsert<Omit<PostLike, 'created_at'>>;
        Update: DatabaseUpdate<Partial<PostLike>>;
        Relationships: [];
      };
      followers: {
        Row: DatabaseRow<Follower>;
        Insert: DatabaseInsert<Omit<Follower, 'created_at'>>;
        Update: DatabaseUpdate<Partial<Follower>>;
        Relationships: [];
      };
      friendships: {
        Row: DatabaseRow<Friendship>;
        Insert: DatabaseInsert<Omit<Friendship, 'id' | 'created_at' | 'updated_at'>>;
        Update: DatabaseUpdate<Partial<Friendship>>;
        Relationships: [];
      };
      quest_members: {
        Row: DatabaseRow<QuestMember>;
        Insert: DatabaseInsert<Omit<QuestMember, 'id' | 'joined_at'>>;
        Update: DatabaseUpdate<Partial<QuestMember>>;
        Relationships: [];
      };
      quest_messages: {
        Row: DatabaseRow<QuestMessage>;
        Insert: DatabaseInsert<Omit<QuestMessage, 'id' | 'created_at' | 'updated_at'>>;
        Update: DatabaseUpdate<Partial<QuestMessage>>;
        Relationships: [];
      };
      quest_files: {
        Row: DatabaseRow<QuestFile>;
        Insert: DatabaseInsert<Omit<QuestFile, 'id' | 'uploaded_at'>>;
        Update: DatabaseUpdate<Partial<QuestFile>>;
        Relationships: [];
      };
      quest_milestones: {
        Row: DatabaseRow<QuestMilestone>;
        Insert: DatabaseInsert<Omit<QuestMilestone, 'id' | 'created_at'>>;
        Update: DatabaseUpdate<Partial<QuestMilestone>>;
        Relationships: [];
      };
      quest_matches: {
        Row: DatabaseRow<QuestMatch>;
        Insert: DatabaseInsert<Omit<QuestMatch, 'id' | 'created_at'>>;
        Update: DatabaseUpdate<Partial<QuestMatch>>;
        Relationships: [];
      };
      xp_history: {
        Row: DatabaseRow<XpHistoryEntry>;
        Insert: DatabaseInsert<Omit<XpHistoryEntry, 'id' | 'created_at'>>;
        Update: DatabaseUpdate<Partial<XpHistoryEntry>>;
        Relationships: [];
      };
      platform_admins: {
        Row: DatabaseRow<PlatformAdmin>;
        Insert: DatabaseInsert<Omit<PlatformAdmin, 'created_at'>>;
        Update: DatabaseUpdate<Partial<PlatformAdmin>>;
        Relationships: [];
      };
      locations: {
        Row: DatabaseRow<Location>;
        Insert: DatabaseInsert<Omit<Location, 'id' | 'created_at' | 'updated_at'>>;
        Update: DatabaseUpdate<Partial<Location>>;
        Relationships: [];
      };
      profile_locations: {
        Row: DatabaseRow<ProfileLocation>;
        Insert: DatabaseInsert<Omit<ProfileLocation, 'id' | 'created_at' | 'updated_at'>>;
        Update: DatabaseUpdate<Partial<ProfileLocation>>;
        Relationships: [];
      };
      ai_usage: {
        Row: DatabaseRow<{ user_id: string; usage_date: string; message_count: number; quest_gen_count: number }>;
        Insert: DatabaseInsert<Partial<{ user_id: string; usage_date: string; message_count: number; quest_gen_count: number }>>;
        Update: DatabaseUpdate<Partial<{ user_id: string; usage_date: string; message_count: number; quest_gen_count: number }>>;
        Relationships: [];
      };
      subscriptions: {
        Row: DatabaseRow<{ user_id: string; stripe_subscription_id: string | null; plan: string; status: string; current_period_end: string | null }>;
        Insert: DatabaseInsert<Partial<{ user_id: string; stripe_subscription_id: string | null; plan: string; status: string; current_period_end: string | null }>>;
        Update: DatabaseUpdate<Partial<{ user_id: string; stripe_subscription_id: string | null; plan: string; status: string; current_period_end: string | null }>>;
        Relationships: [];
      };
      quest_translations: {
        Row: DatabaseRow<{ quest_id: string; locale: string; title: string; description: string; steps: string[] | null }>;
        Insert: DatabaseInsert<Partial<{ quest_id: string; locale: string; title: string; description: string; steps: string[] | null }>>;
        Update: DatabaseUpdate<Partial<{ quest_id: string; locale: string; title: string; description: string; steps: string[] | null }>>;
        Relationships: [];
      };
      user_reports: {
        Row: DatabaseRow<UserReport>;
        Insert: DatabaseInsert<Omit<UserReport, 'id' | 'created_at' | 'updated_at' | 'reviewed_at'>>;
        Update: DatabaseUpdate<Partial<UserReport>>;
        Relationships: [];
      };
      platform_events: {
        Row: DatabaseRow<PlatformEvent>;
        Insert: DatabaseInsert<Omit<PlatformEvent, 'id' | 'created_at'>>;
        Update: DatabaseUpdate<Partial<PlatformEvent>>;
        Relationships: [];
      };
      user_badges: {
        Row: DatabaseRow<UserBadge>;
        Insert: DatabaseInsert<Omit<UserBadge, 'id' | 'unlocked_at'>>;
        Update: DatabaseUpdate<Partial<UserBadge>>;
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, any>;
        Relationships: [];
      };
      leaderboard: {
        Row: DatabaseRow<LeaderboardEntry>;
        Relationships: [];
      };
      community_with_member_count: {
        Row: DatabaseRow<Community & { member_count: number }>;
        Relationships: [];
      };
    };
    Functions: {
      [key: string]: { Args: Record<string, unknown> | never; Returns: unknown };
      check_ai_usage: {
        Args: { p_user_id?: string | null; p_type: 'chat' | 'quest_gen' };
        Returns: { allowed: boolean; limit: number } | null;
      };
      count_user_created_quests: {
        Args: { p_user_id: string };
        Returns: number | null;
      };
      increment_xp: {
        Args: { p_user_id: string | null; p_amount: number };
        Returns: null;
      };
      verify_quest_member_proof: {
        Args: { p_quest_id: string; p_member_user_id: string; p_verified: boolean };
        Returns: null;
      };
    };
  };
}

// ============================================================
// Domain Models
// ============================================================

export interface Profile {
  id: string;
  name: string;
  age: number | null;
  role: 'Sage' | 'Seeker' | 'Hybrid';
  preferred_language: string | null;
  spoken_languages: string[];
  skills: string[];
  interests: string[];
  avatar_url: string | null;
  banner_url: string | null;
  banner_position_x: number | null;
  banner_position_y: number | null;
  bio: string | null;
  xp: number;
  level: number;
  plan: 'free' | 'pro' | 'org' | 'admin';
  stripe_customer_id: string | null;
  login_streak_days: number;
  best_streak_days: number;
  last_login_date: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

/** Legacy compat alias used in components */
export interface User {
  id: string;
  name: string;
  age: number;
  role: 'Sage' | 'Seeker' | 'Hybrid';
  skills: string[];
  interests: string[];
  avatar: string;
  xp: number;
  level: number;
}

/** Convert Supabase profile to legacy User shape */
export function profileToUser(p: Profile): User {
  return {
    id: p.id,
    name: p.name,
    age: p.age ?? 0,
    role: p.role,
    skills: p.skills ?? [],
    interests: p.interests ?? [],
    avatar: p.avatar_url ?? '',
    xp: p.xp,
    level: p.level,
  };
}

export type QuestRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface DbQuest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  community_id?: string | null;
  status: 'draft' | 'published' | 'matched' | 'in_progress' | 'submitted' | 'verified' | 'completed';
  quest_type: 'duo' | 'team' | 'solo';
  is_virtual: boolean;
  location: string | null;
  address_lat: number | null;
  address_lng: number | null;
  skills_required: string[];
  age_range_min: number | null;
  age_range_max: number | null;
  reward_xp: number;
  rarity: QuestRarity;
  image_url: string | null;
  steps: string[];
  created_by: string | null;
  is_user_created?: boolean;
  created_at: string;
  updated_at: string;
}

/** Enriched Quest with participant list (used in UI) */
export interface Quest {
  id: string;
  title: string;
  description: string;
  category: string;
  communityId?: string;
  status: 'draft' | 'published' | 'matched' | 'in_progress' | 'submitted' | 'verified' | 'completed';
  questType: 'duo' | 'team' | 'solo';
  type?: 'duo' | 'team' | 'solo';
  isVirtual: boolean;
  location?: string;
  skillsRequired?: string[];
  ageRangeMin?: number;
  ageRangeMax?: number;
  participants: string[];
  rewardXP: number;
  reward_xp?: number;
  rarity?: QuestRarity;
  imageUrl?: string;
  steps?: string[];
  createdBy?: string;
}

// ============================================================
// Gamification
// ============================================================

export type BadgeId =
  | 'first_quest'
  | 'quest_5'
  | 'quest_20'
  | 'sage'
  | 'polyglot'
  | 'connector'
  | 'community_builder'
  | 'profile_complete'
  | 'streak_7'
  | 'streak_30'
  | 'legend_level';

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: BadgeId;
  unlocked_at: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar_url: string | null;
  role: 'Sage' | 'Seeker' | 'Hybrid';
  xp: number;
  level: number;
  rank: number;
}

/** Quest Member with role and proof tracking */
export interface QuestMember {
  id: string;
  quest_id: string;
  user_id: string;
  role: 'creator' | 'mentor' | 'learner';
  status: 'invited' | 'accepted' | 'active' | 'declined' | 'in_progress' | 'completed';
  proof_submitted: { type: 'text' | 'image' | 'photo' | 'video'; content: string } | null;
  proof_submitted_at: string | null;
  proof_verified: boolean;
  proof_verified_by: string | null;
  proof_verified_at: string | null;
  xp_awarded: boolean;
  joined_at: string;
}

/** Quest Messages for collaboration */
export interface QuestMessage {
  id: string;
  quest_id: string;
  user_id: string;
  content: string;
  attachments: { url: string; type: string }[] | null;
  created_at: string;
  updated_at: string;
}

/** Quest Files (uploads) */
export interface QuestFile {
  id: string;
  quest_id: string;
  user_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  created_at: string | null;
}

/** Quest Milestones */
export interface QuestMilestone {
  id: string;
  quest_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  status: 'pending' | 'completed';
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  ordering: number;
}

/** Smart Matching Suggestion */
export interface QuestMatch {
  id: string;
  quest_id: string;
  proposed_user_id: string;
  match_score: number;
  match_reason: string | null;
  status: 'suggested' | 'invited' | 'accepted' | 'declined';
  created_at: string;
}

/** Convert DB quest + participants to UI Quest */


export interface Community {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  category: string;
  brand_color?: string | null;
  logo_url?: string | null;
  member_limit?: number | null;
  created_by: string | null;
  created_at: string;
}

export interface CommunityMember {
  community_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface CommunityWithCount extends Community {
  member_count: number;
}

export interface Connection {
  id: string;
  user_id: string;
  partner_id: string;
  topic: string | null;
  scheduled_at: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface PostLike {
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface Follower {
  follower_id: string;
  user_id: string;
  created_at: string;
}

export interface Friendship {
  id: string;
  user_id_a: string;
  user_id_b: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface DbChatMessage {
  id: string;
  user_id: string;
  sender: 'user' | 'ai' | 'partner';
  text: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai' | 'partner';
  text: string;
  timestamp: Date;
}

export interface XpHistoryEntry {
  id: string;
  user_id: string;
  xp_gained: number;
  source: string;
  created_at: string;
}

export interface PlatformAdmin {
  user_id: string;
  role: 'super_admin' | 'admin';
  created_by: string | null;
  created_at: string;
}

export interface Location {
  id: string;
  country: string;
  county: string | null;
  city: string | null;
  locality: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  normalized_name: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileLocation {
  id: string;
  profile_id: string;
  location_id: string;
  is_primary: boolean;
  visibility: 'public' | 'private';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserReport {
  id: string;
  reporter_id: string;
  report_type: 'user' | 'post' | 'bug' | 'suggestion' | 'other';
  target_user_id: string | null;
  target_post_id: string | null;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  source_path: string | null;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformEvent {
  id: string;
  name: string;
  user_id: string | null;
  properties: Record<string, string | number | boolean | null | undefined> | null;
  url: string | null;
  created_at: string;
}

/** Generate initials from a name */
export function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  return name
    .trim()
    .split(' ')
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
