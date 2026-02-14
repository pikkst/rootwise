import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { PLAN_LIMITS } from '../services/planService';
import { Plan } from '../services/stripeService';

export interface AiUsageInfo {
  messagesUsed: number;
  questGensUsed: number;
  messageLimit: number;
  questGenLimit: number;
  messagesRemaining: number;
  questGensRemaining: number;
  canChat: boolean;
  canGenerateQuest: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useAiUsage(): AiUsageInfo {
  const { profile } = useAuth();
  const [messagesUsed, setMessagesUsed] = useState(0);
  const [questGensUsed, setQuestGensUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  const plan: Plan = profile?.plan || 'free';
  const limits = PLAN_LIMITS[plan];
  const messageLimit = limits.aiChatPerDay;
  const questGenLimit = limits.questGenPerDay;

  const fetchUsage = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('ai_usage')
        .select('message_count, quest_gen_count')
        .eq('user_id', profile.id)
        .eq('usage_date', today)
        .single();

      if (data) {
        setMessagesUsed(data.message_count || 0);
        setQuestGensUsed(data.quest_gen_count || 0);
      } else {
        setMessagesUsed(0);
        setQuestGensUsed(0);
      }
    } catch {
      setMessagesUsed(0);
      setQuestGensUsed(0);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const messagesRemaining = messageLimit === Infinity
    ? Infinity
    : Math.max(0, messageLimit - messagesUsed);

  const questGensRemaining = questGenLimit === Infinity
    ? Infinity
    : Math.max(0, questGenLimit - questGensUsed);

  return {
    messagesUsed,
    questGensUsed,
    messageLimit,
    questGenLimit,
    messagesRemaining,
    questGensRemaining,
    canChat: messagesRemaining > 0,
    canGenerateQuest: questGensRemaining > 0,
    loading,
    refresh: fetchUsage,
  };
}
