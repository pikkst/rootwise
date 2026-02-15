import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Quest, DbQuest, QuestMember } from '../types';
import { canJoinQuest } from '../services/planService';
import { Plan } from '../services/stripeService';

export function useQuests() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');

  // Fetch quests with members count
  const fetchQuests = useCallback(async () => {
    setLoading(true);

    let query = supabase.from('quests').select('*');
    if (filter !== 'All') {
      query = query.eq('category', filter);
    }

    const { data: questsData } = await query.order('created_at', { ascending: false });

    if (questsData) {
      // Fetch all members for these quests to get participant list
      const questIds = questsData.map((q: DbQuest) => q.id);
      let members: QuestMember[] = [];
      if (questIds.length > 0) {
        const { data: membersData } = await supabase
          .from('quest_members')
          .select('quest_id, user_id')
          .in('quest_id', questIds);
        members = membersData ?? [];
      }

      // Build participant map
      const participantMap: Record<string, string[]> = {};
      members.forEach((m: QuestMember) => {
        if (!participantMap[m.quest_id]) participantMap[m.quest_id] = [];
        participantMap[m.quest_id].push(m.user_id);
      });

      // Convert DbQuest to Quest with participants list
      const enriched = questsData.map((q: DbQuest) => ({
        ...q,
        participants: participantMap[q.id] || [],
      } as Quest));
      
      setQuests(enriched);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  // Join quest as learner (adds quest_member with role='learner', status='active')
  const joinQuest = async (questId: string, userId: string) => {
    // Check if already a member
    const quest = quests.find((q) => q.id === questId);
    if (quest && quest.participants.includes(userId)) {
      return { error: 'Already joined this quest' };
    }

    // Enforce quest limit based on plan
    const { data: profileData } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .maybeSingle();
    
    const plan = (profileData?.plan as Plan) || 'free';
    
    // Count active quest memberships (status = 'in_progress')
    const { data: activeMemberships } = await supabase
      .from('quest_members')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'in_progress');
    
    const activeCount = activeMemberships?.length ?? 0;
    if (!canJoinQuest(plan, activeCount)) {
      return { error: 'Free plan allows only 3 active quests. Upgrade to Pro for unlimited!' };
    }

    // Add as member with learner role
    const { error } = await supabase.from('quest_members').insert({
      quest_id: questId,
      user_id: userId,
      role: 'learner',
      status: 'active',
      joined_at: new Date().toISOString(),
      proof_submitted: null,
      proof_verified: false,
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

  // Submit proof (learner workflow)
  const submitProof = async (questId: string, userId: string, proofData: { type: 'text' | 'image' | 'video'; content: string }) => {
    const { error } = await supabase
      .from('quest_members')
      .update({
        proof_submitted: proofData,
        proof_submitted_at: new Date().toISOString(),
      })
      .eq('quest_id', questId)
      .eq('user_id', userId);

    if (!error) {
      await fetchQuests();
    }
    return { error: error?.message ?? null };
  };

  // Verify proof and award XP (mentor/creator workflow)
  const verifyProof = async (questId: string, userId: string, verified: boolean) => {
    if (verified) {
      // Award XP atomically via RPC
      const quest = quests.find((q) => q.id === questId);
      if (quest) {
        await supabase.rpc('increment_xp', { p_user_id: userId, p_amount: quest.reward_xp });
      }
    }

    const { error } = await supabase
      .from('quest_members')
      .update({
        proof_verified: verified,
        proof_verified_at: new Date().toISOString(),
        status: verified ? 'completed' : 'needs_revision',
      })
      .eq('quest_id', questId)
      .eq('user_id', userId);

    if (!error) {
      await fetchQuests();
    }
    return { error: error?.message ?? null };
  };

  // Create quest (creator workflow)
  const createQuest = async (questData: Omit<DbQuest, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('quests')
      .insert({
        title: questData.title,
        description: questData.description,
        category: questData.category,
        quest_type: questData.quest_type ?? 'solo',
        is_virtual: questData.is_virtual ?? false,
        location: questData.location ?? null,
        address_lat: questData.address_lat ?? null,
        address_lng: questData.address_lng ?? null,
        skills_required: questData.skills_required ?? [],
        age_range_min: questData.age_range_min ?? null,
        age_range_max: questData.age_range_max ?? null,
        reward_xp: questData.reward_xp ?? 0,
        image_url: questData.image_url ?? null,
        steps: questData.steps ?? [],
        created_by: questData.created_by ?? null,
        status: 'draft',
      })
      .select()
      .single();

    if (data && !error) {
      const newQuest = { ...data, participants: [] } as Quest;
      setQuests((prev) => [newQuest, ...prev]);
      return newQuest;
    }
    return null;
  };

  // Publish quest (transition from draft to published)
  const publishQuest = async (questId: string) => {
    const { error } = await supabase
      .from('quests')
      .update({ status: 'published' })
      .eq('id', questId);

    if (!error) {
      await fetchQuests();
    }
    return { error: error?.message ?? null };
  };

  // Start quest (transition to in_progress)
  const startQuest = async (questId: string) => {
    const { error } = await supabase
      .from('quests')
      .update({ status: 'in_progress' })
      .eq('id', questId);

    if (!error) {
      await fetchQuests();
    }
    return { error: error?.message ?? null };
  };

  // Legacy completeQuest for backwards compatibility - combines submission and verification
  const completeQuest = async (questId: string, userId: string) => {
    // Submit proof
    const submitResult = await submitProof(questId, userId, {
      type: 'text',
      content: 'Marked complete via legacy interface',
    });
    if (submitResult.error) return submitResult;

    // Auto-verify and award XP
    return await verifyProof(questId, userId, true);
  };

  return {
    quests,
    loading,
    filter,
    setFilter,
    fetchQuests,
    joinQuest,
    submitProof,
    verifyProof,
    completeQuest,
    createQuest,
    publishQuest,
    startQuest,
  };
}
