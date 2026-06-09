/**
 * Rootwise Analytics — lightweight event tracker
 *
 * Salvestab sündmused Supabase `platform_events` tabelisse.
 * Ei sõltu kolmandatest tööriistadest (PostHog, GA jne).
 * Tulevikus saab lisada paralleelse välise trackeri siia ühte kohta.
 *
 * Kasuta: trackEvent('video_limit_reached', { questId, userId, questTitle })
 *
 * "Hot lead" tuvastamine AdminPage/AnalyticsPage kaudu:
 *   SELECT user_id, COUNT(*) as hits
 *   FROM platform_events WHERE name = 'video_limit_reached'
 *   AND created_at > now() - interval '7 days'
 *   GROUP BY user_id HAVING COUNT(*) >= 2
 *   ORDER BY hits DESC;
 */
import { supabase } from './supabase';

export type EventName =
  | 'page_view'              // Generic page view for funnel/source tracking
  | 'landing_cta_clicked'    // Landing CTA click
  | 'pricing_viewed'         // Pricing page viewed
  | 'pricing_plan_selected'  // User selected pro/org plan
  | 'checkout_started'       // Stripe checkout session started
  | 'billing_portal_opened'  // Billing portal opened
  | 'auth_submitted'         // Sign-in/sign-up form submitted
  | 'auth_success'           // Sign-in/sign-up success
  | 'auth_failed'            // Sign-in/sign-up failed
  | 'video_limit_reached'    // Free user hit 5-min wall — hot upgrade lead
  | 'upgrade_modal_shown'    // Upgrade modal appeared
  | 'upgrade_cta_clicked'    // User clicked any upgrade button
  | 'quest_joined'           // User joined a quest
  | 'proof_submitted'        // User submitted proof
  | 'ai_limit_reached'       // Free AI message quota hit
  | 'quest_gen_limit_reached' // Free quest gen quota hit
  | 'quest_generated_ai'      // AI-generated quest successfully created
  | 'user_quest_created'
  | 'ai_intro_requested';     // User asked AI to initiate contact with a match

export interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export async function trackEvent(
  name: EventName,
  properties?: EventProperties,
): Promise<void> {
  try {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');
    const referrerHost = typeof document !== 'undefined' && document.referrer
      ? (() => {
          try {
            return new URL(document.referrer).host;
          } catch {
            return null;
          }
        })()
      : null;

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('platform_events').insert({
      name,
      user_id: user?.id ?? null,
      properties: {
        ...(properties ?? {}),
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        referrer_host: referrerHost,
      },
      url: typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : null,
    });
  } catch {
    // Analytics should never break the app — fail silently
  }
}
