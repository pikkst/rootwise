import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';
import { Plan, Subscription } from '../services/stripeService';
import { isPro, isOrg, PLAN_LIMITS, planLabel, getEffectivePlan } from '../services/planService';

export interface PlanInfo {
  plan: Plan;
  effectivePlan: Plan;
  subscription: Subscription | null;
  isPro: boolean;
  isOrg: boolean;
  label: string;
  limits: typeof PLAN_LIMITS['free'];
  loading: boolean;
  trialEndsAt: string | null;
  canUseFeature: (feature: 'unlimited_quests' | 'unlimited_ai' | 'quest_generation' | 'analytics' | 'matching' | 'video_calls' | 'admin' | 'branded_communities' | 'reporting') => boolean;
  refreshSubscription: () => Promise<void>;
}

// video_calls is available on all plans (free = 5 min via meet.jit.si, pro = unlimited via JaaS)
const PRO_FEATURES = new Set(['unlimited_quests', 'unlimited_ai', 'quest_generation', 'analytics', 'matching']);
const ORG_FEATURES = new Set(['admin', 'branded_communities', 'reporting']);

export function usePlan(): PlanInfo {
  const { profile } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (error) {
        setSubscription(null);
      } else {
        setSubscription(data as Subscription | null);
      }
    } catch {
      setSubscription(null);
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const rawPlan: Plan = profile?.plan || 'free';

  const effectivePlan: Plan = getEffectivePlan(rawPlan);

  const hasPro = isPro(effectivePlan);
  const hasOrg = isOrg(effectivePlan);

  const trialEndsAt = subscription?.status === 'trialing'
    ? subscription.current_period_end
    : null;

  const canUseFeature = useCallback((feature: string): boolean => {
    if (ORG_FEATURES.has(feature)) return hasOrg;
    if (PRO_FEATURES.has(feature)) return hasPro;
    return true; // free features
  }, [hasPro, hasOrg]);

  return {
    plan: rawPlan,
    effectivePlan,
    subscription,
    isPro: hasPro,
    isOrg: hasOrg,
    label: planLabel(effectivePlan),
    limits: PLAN_LIMITS[effectivePlan],
    loading,
    trialEndsAt,
    canUseFeature,
    refreshSubscription: fetchSubscription,
  };
}
