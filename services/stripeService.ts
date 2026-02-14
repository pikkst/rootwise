import { supabase } from './supabase';

export type Plan = 'free' | 'pro' | 'org';

export interface Subscription {
  user_id: string;
  stripe_subscription_id: string | null;
  plan: Plan;
  status: string;
  current_period_end: string | null;
}

export async function getUserSubscription(): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .single();

  if (error || !data) return null;
  return data as Subscription;
}

export async function getUserPlan(): Promise<Plan> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'free';

  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  return (data?.plan as Plan) || 'free';
}

export async function createCheckoutSession(plan: 'pro' | 'org'): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { plan },
  });

  if (error) {
    console.error('Checkout error:', error);
    return null;
  }

  return data?.url || null;
}

export async function redirectToCheckout(plan: 'pro' | 'org') {
  const url = await createCheckoutSession(plan);
  if (url) {
    window.location.href = url;
  }
}

export async function openBillingPortal(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('stripe-portal', {});

  if (error) {
    console.error('Portal error:', error);
    return null;
  }

  const url = data?.url;
  if (url) {
    window.location.href = url;
  }
  return url || null;
}

export async function cancelSubscription(): Promise<boolean> {
  // Cancellation is handled through the Stripe billing portal
  const url = await openBillingPortal();
  return !!url;
}
