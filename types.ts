
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
      quest_participants: {
        Row: QuestParticipant;
        Insert: Omit<QuestParticipant, 'joined_at'>;
        Update: Partial<QuestParticipant>;
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
  xp: number;
  level: number;
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
    avatar: p.avatar_url ?? `https://i.pravatar.cc/150?u=${p.id}`,
    xp: p.xp,
  };
}

export interface DbQuest {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: 'active' | 'completed' | 'pending';
  reward_xp: number;
  image_url: string | null;
  steps: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestParticipant {
  quest_id: string;
  user_id: string;
  completed: boolean;
  joined_at: string;
}

/** Enriched Quest with participant list (used in UI) */
export interface Quest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: 'active' | 'completed' | 'pending';
  participants: string[];
  rewardXP: number;
  imageUrl?: string;
  steps?: string[];
  createdBy?: string;
}

/** Convert DB quest + participants to UI Quest */
export function dbQuestToQuest(q: DbQuest, participantIds: string[]): Quest {
  return {
    id: q.id,
    title: q.title,
    description: q.description ?? '',
    category: q.category,
    status: q.status,
    participants: participantIds,
    rewardXP: q.reward_xp,
    imageUrl: q.image_url ?? undefined,
    steps: q.steps,
    createdBy: q.created_by ?? undefined,
  };
}

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

export enum AppView {
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD',
  QUESTS = 'QUESTS',
  COMMUNITY = 'COMMUNITY',
  AI_NEXUS = 'AI_NEXUS',
  PROFILE = 'PROFILE',
  AUTH = 'AUTH',
}
