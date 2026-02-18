-- Security hardening: prevent client roles from reading Stripe customer IDs from profiles
-- Keep payment identifiers server-side only (service role / edge functions).

BEGIN;

REVOKE SELECT (stripe_customer_id)
ON TABLE public.profiles
FROM anon, authenticated;

COMMIT;
