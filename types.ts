
// ============================================================
// Supabase Database Types
// ============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
      };
      quests: {
        Row: DbQuest;
        Insert: Partial<DbQuest>;
        Update: Partial<DbQuest>;
      };
      communities: {
        Row: Community;
        Insert: Partial<Community>;
        Update: Partial<Community>;
      };
      community_members: {
        Row: CommunityMember;
        Insert: Omit<CommunityMember, 'joined_at'>;
        Update: Partial<CommunityMember>;
      };
      chat_messages: {
        Row: DbChatMessage;
        Insert: Omit<DbChatMessage, 'id' | 'created_at'>;
        Update: Partial<DbChatMessage>;
      };
      connections: {
        Row: Connection;
        Insert: Omit<Connection, 'id' | 'created_at'>;
        Update: Partial<Connection>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at'>;
        Update: Partial<Post>;
      };
      post_comments: {
        Row: PostComment;
        Insert: Omit<PostComment, 'id' | 'created_at'>;
        Update: Partial<PostComment>;
      };
      post_likes: {
        Row: PostLike;
        Insert: Omit<PostLike, 'created_at'>;
        Update: Partial<PostLike>;
      };
      followers: {
        Row: Follower;
        Insert: Omit<Follower, 'created_at'>;
        Update: Partial<Follower>;
      };
      friendships: {
        Row: Friendship;
        Insert: Omit<Friendship, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Friendship>;
      };
      quest_members: {
        Row: QuestMember;
        Insert: Omit<QuestMember, 'id' | 'joined_at'>;
        Update: Partial<QuestMember>;
      };
      quest_messages: {
        Row: QuestMessage;
        Insert: Omit<QuestMessage, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<QuestMessage>;
      };
      quest_files: {
        Row: QuestFile;
        Insert: Omit<QuestFile, 'id' | 'uploaded_at'>;
        Update: Partial<QuestFile>;
      };
      quest_milestones: {
        Row: QuestMilestone;
        Insert: Omit<QuestMilestone, 'id' | 'created_at'>;
        Update: Partial<QuestMilestone>;
      };
      quest_matches: {
        Row: QuestMatch;
        Insert: Omit<QuestMatch, 'id' | 'created_at'>;
        Update: Partial<QuestMatch>;
      };
      xp_history: {
        Row: XpHistoryEntry;
        Insert: Omit<XpHistoryEntry, 'id' | 'created_at'>;
        Update: Partial<XpHistoryEntry>;
      };
    };
    Views: {
      community_with_member_count: {
        Row: Community & { member_count: number };
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
  skills: string[];
  interests: string[];
  avatar_url: string | null;
  banner_url: string | null;
  banner_position_x: number | null;
  banner_position_y: number | null;
  bio: string | null;
  xp: number;
  level: number;
  plan: 'free' | 'pro' | 'org';
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
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

export interface DbQuest {
  id: string;
  title: string;
  description: string | null;
  category: string;
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
  image_url: string | null;
  steps: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Enriched Quest with participant list (used in UI) */
export interface Quest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'draft' | 'published' | 'matched' | 'in_progress' | 'submitted' | 'verified' | 'completed';
  questType: 'duo' | 'team' | 'solo';
  isVirtual: boolean;
  location?: string;
  skillsRequired?: string[];
  ageRangeMin?: number;
  ageRangeMax?: number;
  participants: string[];
  rewardXP: number;
  imageUrl?: string;
  steps?: string[];
  createdBy?: string;
}

/** Quest Member with role and proof tracking */
export interface QuestMember {
  id: string;
  quest_id: string;
  user_id: string;
  role: 'creator' | 'mentor' | 'learner';
  status: 'invited' | 'accepted' | 'declined' | 'in_progress' | 'completed';
  proof_submitted: { type: 'photo' | 'video' | 'text'; content: string } | null;
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
  uploaded_at: string;
}

/** Quest Milestones */
export interface QuestMilestone {
  id: string;
  quest_id: string;
  title: string;
  description: string | null;
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
