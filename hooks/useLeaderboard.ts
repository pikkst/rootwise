import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { LeaderboardEntry } from '../types';

export interface UseLeaderboardReturn {
  entries: LeaderboardEntry[];
  loading: boolean;
  refetch: () => void;
}

/** Cache leaderboard for 5 minutes to avoid hammering DB */
let _cache: { entries: LeaderboardEntry[]; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

export function useLeaderboard(): UseLeaderboardReturn {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async (force = false) => {
    if (!force && _cache && Date.now() - _cache.ts < CACHE_TTL) {
      setEntries(_cache.entries);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('leaderboard')
      .select('*')
      .order('rank', { ascending: true })
      .limit(20);
    const list = (data ?? []) as LeaderboardEntry[];
    _cache = { entries: list, ts: Date.now() };
    setEntries(list);
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { entries, loading, refetch: () => fetch(true) };
}
