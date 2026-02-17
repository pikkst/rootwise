import { Plan } from './stripeService';

// ============================================================
// Plan-based feature gating
// ============================================================

export const PLAN_LIMITS = {
  free: { maxActiveQuests: 3, aiChatPerDay: 5, questGenPerDay: 1, maxOrgMembers: 0 },
  pro:  { maxActiveQuests: Infinity, aiChatPerDay: Infinity, questGenPerDay: Infinity, maxOrgMembers: 0 },
  org:  { maxActiveQuests: Infinity, aiChatPerDay: Infinity, questGenPerDay: Infinity, maxOrgMembers: 50 },
  admin: { maxActiveQuests: Infinity, aiChatPerDay: Infinity, questGenPerDay: Infinity, maxOrgMembers: Infinity },
} as const;

/** Does this plan include Pro-level features? */
export function isPro(plan: Plan): boolean {
  return plan === 'pro' || plan === 'org' || plan === 'admin';
}

/** Does this plan include Org-level features? */
export function isOrg(plan: Plan): boolean {
  return plan === 'org' || plan === 'admin';
}

/** Get the effective plan — admin is treated as org for org operations */
export function getEffectivePlan(plan: Plan): Plan {
  if (plan === 'admin') return 'org';
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
  const max = PLAN_LIMITS[plan as 'org' | 'admin'].maxOrgMembers;
  if (max === Infinity) return true;
  return currentMemberCount < max;
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
    case 'admin': return 'Admin';
    default: return 'Free';
  }
}

/** Get plan price label */
export function planPrice(plan: Plan): string {
  switch (plan) {
    case 'pro': return '€9.99/mo';
    case 'org': return '€49/mo';
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
    { label: 'Video calls', included: false },
  ],
  pro: [
    { label: 'Unlimited quests', included: true },
    { label: 'Unlimited AI mentor', included: true },
    { label: 'AI quest generation', included: true },
    { label: 'Advanced analytics', included: true },
    { label: 'Priority matching', included: true },
    { label: 'Unlimited video calls', included: true },
  ],
  org: [
    { label: 'Everything in Pro', included: true },
    { label: 'Up to 50 members', included: true },
    { label: 'Admin dashboard', included: true },
    { label: 'Branded communities', included: true },
    { label: 'Reporting & analytics', included: true },
    { label: 'Org-level analytics', included: true },
  ],
} as const;
