import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Quest, dbQuestToQuest, DbQuest } from '../types';

export function useQuests() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');

  const fetchQuests = useCallback(async () => {
    setLoading(true);

    let query = supabase.from('quests').select('*');
    if (filter !== 'All') {
      query = query.eq('category', filter);
    }

    const { data: questsData } = await query.order('created_at', { ascending: false });

    if (questsData) {
      // Fetch all participants for these quests
      const questIds = questsData.map((q: DbQuest) => q.id);
      const { data: participants } = await supabase
        .from('quest_participants')
        .select('quest_id, user_id')
        .in('quest_id', questIds);

      const participantMap: Record<string, string[]> = {};
      (participants ?? []).forEach((p: { quest_id: string; user_id: string }) => {
        if (!participantMap[p.quest_id]) participantMap[p.quest_id] = [];
        participantMap[p.quest_id].push(p.user_id);
      });

      const enriched = questsData.map((q: DbQuest) =>
        dbQuestToQuest(q, participantMap[q.id] || [])
      );
      setQuests(enriched);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  const joinQuest = async (questId: string, userId: string) => {
    // Check if already a participant
    const quest = quests.find((q) => q.id === questId);
    if (quest && quest.participants.includes(userId)) {
      return { error: 'Already joined this quest' };
    }

    const { error } = await supabase.from('quest_participants').insert({
      quest_id: questId,
      user_id: userId,
      completed: false,
    });
    if (!error) {
      setQuests((prev) =>
        prev.map((q) =>
          q.id === questId
            ? { ...q, participants: [...q.participants, userId] }
            : q
        )
      );
    }
    return { error: error?.message ?? null };
  };

  const completeQuest = async (questId: string, userId: string) => {
    // Mark participant as completed
    const { error: participantError } = await supabase
      .from('quest_participants')
      .update({ completed: true })
      .eq('quest_id', questId)
      .eq('user_id', userId);

    if (participantError) return { error: participantError.message };

    // Award XP atomically via RPC
    const quest = quests.find((q) => q.id === questId);
    if (quest) {
      await supabase.rpc('increment_xp', { p_user_id: userId, p_amount: quest.rewardXP });
    }

    // Check if all participants completed — if so, mark quest as completed
    const { data: participants } = await supabase
      .from('quest_participants')
      .select('completed')
      .eq('quest_id', questId);

    const allCompleted = participants && participants.length > 0 && participants.every((p: { completed: boolean }) => p.completed);
    if (allCompleted) {
      await supabase.from('quests').update({ status: 'completed' }).eq('id', questId);
    }

    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId
          ? { ...q, status: allCompleted ? ('completed' as const) : q.status }
          : q
      )
    );

    return { error: null };
  };

  const createQuest = async (
    quest: Omit<Quest, 'id' | 'participants' | 'status'>
  ) => {
    const { data, error } = await supabase
      .from('quests')
      .insert({
        title: quest.title,
        description: quest.description,
        category: quest.category,
        reward_xp: quest.rewardXP,
        image_url: quest.imageUrl ?? null,
        steps: quest.steps ?? [],
        created_by: quest.createdBy ?? null,
        status: 'active',
      })
      .select()
      .single();

    if (data && !error) {
      const newQuest = dbQuestToQuest(data as DbQuest, []);
      setQuests((prev) => [newQuest, ...prev]);
      return newQuest;
    }
    return null;
  };

  return {
    quests,
    loading,
    filter,
    setFilter,
    fetchQuests,
    joinQuest,
    completeQuest,
    createQuest,
  };
}
