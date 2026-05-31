// Stripe Checkout Session — creates a checkout URL for Pro/Org subscription
// Deploy: supabase functions deploy stripe-checkout
// Env vars needed: STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, STRIPE_ORG_PRICE_ID, CLIENT_URL

import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const CLIENT_URL = Deno.env.get('CLIENT_URL') || 'https://rootwise.site';
const TRIAL_DAYS = parseInt(Deno.env.get('TRIAL_DAYS') || '30', 10);

function resolveAppUrl(req: Request) {
  const origin = req.headers.get('origin');
  if (origin && /^https?:\/\//.test(origin)) return origin;
  return CLIENT_URL;
}

async function stripeRequest(endpoint: string, body: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error(`Stripe API error ${res.status}: ${text}`);
    throw new Error(`Stripe API error (${res.status}): ${text}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error('Invalid Stripe response:', text);
    throw new Error('Invalid response from Stripe');
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const appUrl = resolveAppUrl(req);

    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError?.message);
      return new Response(JSON.stringify({ error: 'Invalid token', detail: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const plan = body?.plan;

    // Validate plan value — only 'pro' or 'org' are accepted
    if (plan !== 'pro' && plan !== 'org') {
      return new Response(JSON.stringify({ error: 'Invalid plan. Must be "pro" or "org".' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceId = plan === 'org'
      ? Deno.env.get('STRIPE_ORG_PRICE_ID')!
      : Deno.env.get('STRIPE_PRO_PRICE_ID')!;

    // Check if user already has a Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripeRequest('/customers', {
        email: user.email!,
        'metadata[supabase_user_id]': user.id,
      });
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create checkout session
    const future = Math.floor(Date.now() / 1000) + TRIAL_DAYS * 24 * 60 * 60;
    const session = await stripeRequest('/checkout/sessions', {
      'customer': customerId,
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': `${appUrl}/profile?checkout=success`,
      'cancel_url': `${appUrl}/pricing?checkout=cancelled`,
      'metadata[supabase_user_id]': user.id,
      'subscription_data[metadata][supabase_user_id]': user.id,
      'subscription_data[trial_end]': future,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create checkout' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
