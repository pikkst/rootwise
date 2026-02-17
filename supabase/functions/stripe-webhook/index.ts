// Stripe Webhook — handles subscription lifecycle events
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// Env vars needed: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!;

async function resolveUserIdFromCustomer(supabase: any, customerId?: string | null): Promise<string | null> {
  if (!customerId) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (profile?.id) return profile.id;

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  return subscription?.user_id ?? null;
}

// Verify Stripe webhook signature using Web Crypto API
async function verifySignature(payload: string, sigHeader: string): Promise<boolean> {
  const parts = sigHeader.split(',').reduce((acc: Record<string, string>, part: string) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return false;

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(STRIPE_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const computed = new Uint8Array(sig);
  const expected = new Uint8Array(
    signature.match(/.{2}/g)!.map((b: string) => parseInt(b, 16))
  );

  // Timing-safe comparison to prevent timing attacks
  if (computed.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computed.length; i++) {
    mismatch |= computed[i] ^ expected[i];
  }
  return mismatch === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const sigHeader = req.headers.get('stripe-signature');

  if (!sigHeader) {
    return new Response('Missing signature', { status: 400 });
  }

  const isValid = await verifySignature(body, sigHeader);
  if (!isValid) {
    console.error('Invalid webhook signature');
    return new Response('Invalid signature', { status: 400 });
  }

  const event = JSON.parse(body);
  console.log(`Webhook received: ${event.type}, id: ${event.id}`);

  // Use service role to bypass RLS
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id || await resolveUserIdFromCustomer(supabase, session.customer);
        const subscriptionId = session.subscription;
        console.log(`checkout.session.completed — userId: ${userId}, subscriptionId: ${subscriptionId}, customer: ${session.customer}`);
        if (!userId || !subscriptionId) break;

        // Fetch subscription details from Stripe
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
          headers: { 'Authorization': `Bearer ${STRIPE_SECRET_KEY}` },
        });
        const subscription = await subRes.json();
        console.log(`Stripe subscription response status: ${subRes.status}, current_period_end: ${subscription.current_period_end}`);
        const priceId = subscription.items?.data?.[0]?.price?.id;

        // Determine plan
        const plan = priceId === Deno.env.get('STRIPE_ORG_PRICE_ID') ? 'org' : 'pro';
        console.log(`Resolved plan: ${plan}, priceId: ${priceId}`);

        // Safely convert period end timestamp
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        // Upsert subscription record
        const { error: upsertErr } = await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: session.customer,
          plan,
          status: 'active',
          current_period_end: periodEnd,
        }, { onConflict: 'user_id' });
        if (upsertErr) console.error('Subscription upsert error:', upsertErr);

        // Update profile plan
        const { error: profileErr } = await supabase.from('profiles').update({ plan }).eq('id', userId);
        if (profileErr) console.error('Profile update error:', profileErr);
        console.log(`Successfully upgraded user ${userId} to ${plan}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id || await resolveUserIdFromCustomer(supabase, subscription.customer);
        if (!userId) break;

        const status = subscription.cancel_at_period_end ? 'cancelling' : subscription.status;

        const subPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null;

        await supabase.from('subscriptions').update({
          status,
          current_period_end: subPeriodEnd,
        }).eq('stripe_subscription_id', subscription.id);

        if (subscription.status === 'active') {
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const plan = priceId === Deno.env.get('STRIPE_ORG_PRICE_ID') ? 'org' : 'pro';
          await supabase.from('profiles').update({ plan }).eq('id', userId);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id || await resolveUserIdFromCustomer(supabase, subscription.customer);
        if (!userId) break;

        await supabase.from('subscriptions').update({
          status: 'cancelled',
        }).eq('stripe_subscription_id', subscription.id);

        // Downgrade to free
        await supabase.from('profiles').update({ plan: 'free' }).eq('id', userId);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;
        if (!subscriptionId) break;

        await supabase.from('subscriptions').update({
          status: 'past_due',
        }).eq('stripe_subscription_id', subscriptionId);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(JSON.stringify({ error: 'Webhook handler failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
