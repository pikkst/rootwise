import { Plan } from './stripeService';

// ============================================================
// Plan-based feature gating
// ============================================================

export const PLAN_LIMITS = {
  free: { maxActiveQuests: 3, aiChatPerDay: 5, questGenPerDay: 1 },
  pro:  { maxActiveQuests: Infinity, aiChatPerDay: Infinity, questGenPerDay: Infinity },
  org:  { maxActiveQuests: Infinity, aiChatPerDay: Infinity, questGenPerDay: Infinity },
} as const;

/** Does this plan include Pro-level features? */
export function isPro(plan: Plan): boolean {
  return plan === 'pro' || plan === 'org';
}

/** Does this plan include Org-level features? */
export function isOrg(plan: Plan): boolean {
  return plan === 'org';
}

/** Can the user join another quest? */
export function canJoinQuest(plan: Plan, activeQuestCount: number): boolean {
  return activeQuestCount < PLAN_LIMITS[plan].maxActiveQuests;
}

/** Get remaining quest slots */
export function remainingQuestSlots(plan: Plan, activeQuestCount: number): number {
  const max = PLAN_LIMITS[plan].maxActiveQuests;
  if (max === Infinity) return Infinity;
  return Math.max(0, max - activeQuestCount);
}

/** Get a human label for the plan */
export function planLabel(plan: Plan): string {
  switch (plan) {
    case 'pro': return 'Pro';
    case 'org': return 'Organization';
    default: return 'Free';
  }
}
