import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { CommunityWithCount } from '../types';

export function useCommunities() {
  const [communities, setCommunities] = useState<CommunityWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [userCommunities, setUserCommunities] = useState<string[]>([]);

  const fetchCommunities = useCallback(async () => {
    setLoading(true);

    const { data } = await supabase
      .from('community_with_member_count')
      .select('*');

    if (data) {
      setCommunities(data as CommunityWithCount[]);
    }
    setLoading(false);
  }, []);

  const fetchUserCommunities = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('community_members')
      .select('community_id')
      .eq('user_id', userId);

    if (data) {
      setUserCommunities(data.map((d: { community_id: string }) => d.community_id));
    }
  }, []);

  useEffect(() => {
    fetchCommunities();
  }, [fetchCommunities]);

  const joinCommunity = async (communityId: string, userId: string) => {
    const { data: community } = await supabase
      .from('communities')
      .select('member_limit')
      .eq('id', communityId)
      .maybeSingle();

    if (community?.member_limit && community.member_limit > 0) {
      const { count } = await supabase
        .from('community_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('community_id', communityId);

      if ((count ?? 0) >= community.member_limit) {
        return { error: `Community member limit reached (${community.member_limit}).` };
      }
    }

    const { error } = await supabase.from('community_members').insert({
      community_id: communityId,
      user_id: userId,
      role: 'member',
    });

    if (!error) {
      setUserCommunities((prev) => [...prev, communityId]);
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === communityId ? { ...c, member_count: c.member_count + 1 } : c
        )
      );
    }
    return { error: error?.message ?? null };
  };

  const leaveCommunity = async (communityId: string, userId: string) => {
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', userId);

    if (!error) {
      setUserCommunities((prev) => prev.filter((id) => id !== communityId));
      setCommunities((prev) =>
        prev.map((c) =>
          c.id === communityId ? { ...c, member_count: Math.max(0, c.member_count - 1) } : c
        )
      );
    }
    return { error: error?.message ?? null };
  };

  return {
    communities,
    userCommunities,
    loading,
    fetchCommunities,
    fetchUserCommunities,
    joinCommunity,
    leaveCommunity,
  };
}
