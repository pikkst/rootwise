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
  | 'video_limit_reached'    // Free user hit 5-min wall — hot upgrade lead
  | 'upgrade_modal_shown'    // Upgrade modal appeared
  | 'upgrade_cta_clicked'    // User clicked any upgrade button
  | 'quest_joined'           // User joined a quest
  | 'proof_submitted'        // User submitted proof
  | 'ai_limit_reached'       // Free AI message quota hit
  | 'quest_gen_limit_reached'; // Free quest gen quota hit

export interface EventProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export async function trackEvent(
  name: EventName,
  properties?: EventProperties,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('platform_events').insert({
      name,
      user_id: user?.id ?? null,
      properties: properties ?? {},
      url: typeof window !== 'undefined' ? window.location.pathname : null,
    });
  } catch {
    // Analytics should never break the app — fail silently
  }
}
