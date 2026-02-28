import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { BadgeId, UserBadge } from '../types';
import { useAuth } from '../context/AuthContext';

/** All badge metadata — icon, colour, key name */
export const BADGE_META: Record<BadgeId, { emoji: string; color: string; i18nKey: string }> = {
  first_quest:        { emoji: '🔥', color: 'bg-orange-100 text-orange-700 border-orange-200', i18nKey: 'badges.firstQuest' },
  quest_5:            { emoji: '⚡', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', i18nKey: 'badges.quest5' },
  quest_20:           { emoji: '🏆', color: 'bg-amber-100 text-amber-700 border-amber-200',  i18nKey: 'badges.quest20' },
  sage:               { emoji: '🧙', color: 'bg-violet-100 text-violet-700 border-violet-200', i18nKey: 'badges.sage' },
  polyglot:           { emoji: '🌍', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', i18nKey: 'badges.polyglot' },
  connector:          { emoji: '🤝', color: 'bg-sky-100 text-sky-700 border-sky-200', i18nKey: 'badges.connector' },
  community_builder:  { emoji: '🏡', color: 'bg-teal-100 text-teal-700 border-teal-200', i18nKey: 'badges.communityBuilder' },
  profile_complete:   { emoji: '✨', color: 'bg-pink-100 text-pink-700 border-pink-200', i18nKey: 'badges.profileComplete' },
  streak_7:           { emoji: '🔆', color: 'bg-lime-100 text-lime-700 border-lime-200', i18nKey: 'badges.streak7' },
  streak_30:          { emoji: '🌟', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', i18nKey: 'badges.streak30' },
  legend_level:       { emoji: '💎', color: 'bg-purple-100 text-purple-700 border-purple-200', i18nKey: 'badges.legendLevel' },
};

export const ALL_BADGE_IDS = Object.keys(BADGE_META) as BadgeId[];

export interface UseBadgesReturn {
  badges: UserBadge[];
  earnedIds: Set<BadgeId>;
  loading: boolean;
  /** Triggers a server-side badge check and refreshes the list */
  checkAndRefresh: () => Promise<BadgeId[]>;
}

export function useBadges(targetUserId?: string): UseBadgesReturn {
  const { profile } = useAuth();
  const userId = targetUserId ?? profile?.id;

  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from('user_badges')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: true });
    setBadges((data ?? []) as UserBadge[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchBadges(); }, [fetchBadges]);

  const checkAndRefresh = useCallback(async (): Promise<BadgeId[]> => {
    if (!userId) return [];
    // Only check badges for the authenticated user's own profile
    if (userId !== profile?.id) return [];
    const { data } = await supabase.rpc('unlock_earned_badges');
    const newly = (data ?? []) as BadgeId[];
    if (newly.length > 0) await fetchBadges();
    return newly;
  }, [userId, profile?.id, fetchBadges]);

  const earnedIds = new Set(badges.map((b) => b.badge_id as BadgeId));

  return { badges, earnedIds, loading, checkAndRefresh };
}
