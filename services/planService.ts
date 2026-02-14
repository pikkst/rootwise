import { Plan } from './stripeService';

// ============================================================
// Plan-based feature gating
// ============================================================

// Beta mode flag — when true, free users get Pro features
export const BETA_MODE = true;

export const PLAN_LIMITS = {
  free: { maxActiveQuests: 3, aiChatPerDay: 5, questGenPerDay: 1, maxOrgMembers: 0 },
  pro:  { maxActiveQuests: Infinity, aiChatPerDay: Infinity, questGenPerDay: Infinity, maxOrgMembers: 0 },
  org:  { maxActiveQuests: Infinity, aiChatPerDay: Infinity, questGenPerDay: Infinity, maxOrgMembers: 50 },
} as const;

/** Does this plan include Pro-level features? */
export function isPro(plan: Plan): boolean {
  if (BETA_MODE) return true;
  return plan === 'pro' || plan === 'org';
}

/** Does this plan include Org-level features? */
export function isOrg(plan: Plan): boolean {
  return plan === 'org';
}

/** Get the effective plan (considering beta mode) */
export function getEffectivePlan(plan: Plan): Plan {
  if (BETA_MODE && plan === 'free') return 'pro';
  return plan;
}

/** Can the user join another quest? */
export function canJoinQuest(plan: Plan, activeQuestCount: number): boolean {
  const effectivePlan = getEffectivePlan(plan);
  return activeQuestCount < PLAN_LIMITS[effectivePlan].maxActiveQuests;
}

/** Get remaining quest slots */
export function remainingQuestSlots(plan: Plan, activeQuestCount: number): number {
  const effectivePlan = getEffectivePlan(plan);
  const max = PLAN_LIMITS[effectivePlan].maxActiveQuests;
  if (max === Infinity) return Infinity;
  return Math.max(0, max - activeQuestCount);
}

/** Can the organization add more members? */
export function canAddOrgMember(plan: Plan, currentMemberCount: number): boolean {
  if (!isOrg(plan)) return false;
  return currentMemberCount < PLAN_LIMITS.org.maxOrgMembers;
}

/** Get remaining org member slots */
export function remainingOrgSlots(currentMemberCount: number): number {
  return Math.max(0, PLAN_LIMITS.org.maxOrgMembers - currentMemberCount);
}

/** Get a human label for the plan */
export function planLabel(plan: Plan): string {
  switch (plan) {
    case 'pro': return 'Pro';
    case 'org': return 'Organization';
    default: return 'Free';
  }
}

/** Get plan price label */
export function planPrice(plan: Plan): string {
  switch (plan) {
    case 'pro': return '$9.99/mo';
    case 'org': return '$49/mo';
    default: return 'Free';
  }
}

/** Feature descriptions for each plan */
export const PLAN_FEATURES = {
  free: [
    { label: '3 active quests', included: true },
    { label: 'Community access', included: true },
    { label: 'AI mentor (5 msgs/day)', included: true },
    { label: 'Basic profile & XP', included: true },
    { label: 'Quest generation (1/day)', included: true },
  ],
  pro: [
    { label: 'Unlimited quests', included: true },
    { label: 'Unlimited AI mentor', included: true },
    { label: 'AI quest generation', included: true },
    { label: 'Advanced analytics', included: true },
    { label: 'Priority matching', included: true },
  ],
  org: [
    { label: 'Everything in Pro', included: true },
    { label: 'Up to 50 members', included: true },
    { label: 'Admin dashboard', included: true },
    { label: 'Branded communities', included: true },
    { label: 'Reporting & analytics', included: true },
  ],
} as const;
