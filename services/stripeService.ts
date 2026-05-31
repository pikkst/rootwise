import { supabase } from './supabase';
import { trackEvent } from './analyticsService';

export type Plan = 'free' | 'pro' | 'org' | 'admin';

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
    .maybeSingle();

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

export async function createCheckoutSession(plan: 'pro' | 'org'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { plan },
  });

  if (error) {
    console.error('Checkout error:', error);
    throw new Error(error.message || 'Failed to create checkout session');
  }

  const url = data?.url;
  if (!url) {
    throw new Error('No checkout URL returned');
  }

  return url;
}

export async function redirectToCheckout(
  plan: 'pro' | 'org',
  source?: string,
  onError?: (message: string) => void
) {
  void trackEvent('checkout_started', { plan, source: source ?? 'unknown' });
  try {
    const url = await createCheckoutSession(plan);
    window.location.href = url;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    console.error('Checkout error:', message);
    onError?.(message);
  }
}

export async function openBillingPortal(): Promise<string | null> {
  void trackEvent('billing_portal_opened');
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
