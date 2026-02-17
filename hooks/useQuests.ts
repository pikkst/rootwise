import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { Quest, DbQuest, QuestMember } from '../types';
import { canJoinQuest } from '../services/planService';
import { Plan } from '../services/stripeService';

export function useQuests() {
  const { t } = useTranslation();
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
        id: q.id,
        title: q.title,
        description: q.description ?? '',
        category: q.category,
        communityId: q.community_id ?? undefined,
        status: q.status,
        questType: q.quest_type ?? 'solo',
        isVirtual: q.is_virtual ?? false,
        location: q.location ?? undefined,
        skillsRequired: q.skills_required ?? [],
        ageRangeMin: q.age_range_min ?? undefined,
        ageRangeMax: q.age_range_max ?? undefined,
        participants: participantMap[q.id] || [],
        rewardXP: q.reward_xp ?? 0,
        imageUrl: q.image_url ?? undefined,
        steps: q.steps ?? [],
        createdBy: q.created_by ?? undefined,
      } as Quest));
      
      setQuests(enriched);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  // Join quest as learner
  const joinQuest = async (questId: string, userId: string) => {
    // Check if already a member
    const quest = quests.find((q) => q.id === questId);
    if (quest && quest.participants.includes(userId)) {
      return { error: t('hooks.alreadyJoined') };
    }

    // If this is a community quest, user must be a member of that community
    const { data: questRow } = await supabase
      .from('quests')
      .select('community_id')
      .eq('id', questId)
      .maybeSingle();

    if (questRow?.community_id) {
      const { data: memberRow } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('community_id', questRow.community_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (!memberRow) {
        return { error: t('hooks.communityQuestFirst') };
      }
    }

    // Enforce quest limit based on plan
    const { data: profileData } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .maybeSingle();
    
    const plan = (profileData?.plan as Plan) || 'free';
    
    // Count active quest memberships
    const { data: activeMemberships } = await supabase
      .from('quest_members')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['accepted', 'in_progress']);
    
    const activeCount = activeMemberships?.length ?? 0;
    if (!canJoinQuest(plan, activeCount)) {
      return { error: t('hooks.freeQuestLimit') };
    }

    // Add as member with learner role
    const { error } = await supabase.from('quest_members').insert({
      quest_id: questId,
      user_id: userId,
      role: 'learner',
      status: 'accepted',
      proof_submitted: null,
      xp_awarded: false,
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
        status: 'in_progress',
      })
      .eq('quest_id', questId)
      .eq('user_id', userId);

    if (!error) {
      await fetchQuests();
    }
    return { error: error?.message ?? null };
  };

  // Verify proof and award XP (mentor/creator workflow)
  const verifyProof = async (questId: string, userId: string, verified: boolean, verifierId?: string) => {
    if (verified) {
      // Award XP atomically via RPC
      const quest = quests.find((q) => q.id === questId);
      if (quest) {
        await supabase.rpc('increment_xp', { p_user_id: userId, p_amount: quest.rewardXP });
      }
    }

    const { error } = await supabase
      .from('quest_members')
      .update({
        proof_verified_by: verified ? (verifierId ?? userId) : null,
        proof_verified_at: verified ? new Date().toISOString() : null,
        xp_awarded: verified,
        status: verified ? 'completed' : 'in_progress',
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
    // Solo quests auto-publish; group/community quests remain draft for review
    const resolvedStatus = questData.quest_type === 'solo'
      ? 'published'
      : (questData.status ?? 'draft');

    const { data, error } = await supabase
      .from('quests')
      .insert({
        title: questData.title,
        description: questData.description,
        category: questData.category,
        community_id: questData.community_id ?? null,
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
        status: resolvedStatus,
      })
      .select()
      .single();

    if (data && !error) {
      if (data.created_by) {
        await supabase.from('quest_members').upsert({
          quest_id: data.id,
          user_id: data.created_by,
          role: 'creator',
          status: 'accepted',
          proof_submitted: null,
          xp_awarded: false,
        });
      }

      const newQuest = {
        id: data.id,
        title: data.title,
        description: data.description ?? '',
        category: data.category,
        communityId: data.community_id ?? undefined,
        status: data.status,
        questType: data.quest_type ?? 'solo',
        isVirtual: data.is_virtual ?? false,
        location: data.location ?? undefined,
        skillsRequired: data.skills_required ?? [],
        ageRangeMin: data.age_range_min ?? undefined,
        ageRangeMax: data.age_range_max ?? undefined,
        participants: data.created_by ? [data.created_by] : [],
        rewardXP: data.reward_xp ?? 0,
        imageUrl: data.image_url ?? undefined,
        steps: data.steps ?? [],
        createdBy: data.created_by ?? undefined,
      } as Quest;
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
      content: t('hooks.legacyComplete'),
    });
    if (submitResult.error) return submitResult;

    // Auto-verify and award XP
    const verifyResult = await verifyProof(questId, userId, true);
    if (verifyResult.error) return verifyResult;

    // Check if all members have completed – if so, mark quest row as completed
    const { data: allMembers } = await supabase
      .from('quest_members')
      .select('status')
      .eq('quest_id', questId);

    const allDone = allMembers && allMembers.length > 0 &&
      allMembers.every((m: { status: string }) => m.status === 'completed');

    if (allDone) {
      await supabase
        .from('quests')
        .update({ status: 'completed' })
        .eq('id', questId);
    }

    await fetchQuests();
    return { error: null };
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
