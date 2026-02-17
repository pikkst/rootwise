import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';

export interface QuestTranslation {
  title: string;
  description: string;
  steps: string[];
}

/**
 * Hook that translates quest content to the current UI language.
 * - If locale matches original → returns originals immediately
 * - Checks DB cache first → returns cached translation instantly
 * - Falls back to Gemini edge function → caches result for future
 */
export function useQuestTranslation(
  questId: string | undefined,
  originalTitle: string,
  originalDescription: string,
  originalSteps: string[]
) {
  const { i18n } = useTranslation();
  const locale = i18n.language?.slice(0, 2) || 'en';

  const [translated, setTranslated] = useState<QuestTranslation>({
    title: originalTitle,
    description: originalDescription,
    steps: originalSteps,
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);

  // Update originals when they change
  useEffect(() => {
    setTranslated({
      title: originalTitle,
      description: originalDescription,
      steps: originalSteps,
    });
    setIsTranslated(false);
  }, [originalTitle, originalDescription, originalSteps]);

  const translate = useCallback(async () => {
    if (!questId || !originalTitle) return;

    // Simple heuristic: detect if quest is already in user's language
    // by checking common words. If uncertain, try translating anyway.
    // The edge function caches results, so repeat calls are cheap.

    // Skip English → English (most quests are in English)
    if (locale === 'en') {
      setIsTranslated(false);
      return;
    }

    setIsTranslating(true);

    try {
      // 1. Check DB cache first (fast, no AI call)
      const { data: cached } = await supabase
        .from('quest_translations')
        .select('title, description, steps')
        .eq('quest_id', questId)
        .eq('locale', locale)
        .maybeSingle();

      if (cached) {
        setTranslated({
          title: cached.title,
          description: cached.description,
          steps: cached.steps || [],
        });
        setIsTranslated(true);
        setIsTranslating(false);
        return;
      }

      // 2. Call edge function to translate & cache
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const res = await supabase.functions.invoke('gemini-proxy', {
        body: {
          action: 'translateQuest',
          payload: { questId, targetLocale: locale },
        },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.translation) {
        setTranslated({
          title: res.data.translation.title,
          description: res.data.translation.description,
          steps: res.data.translation.steps || [],
        });
        setIsTranslated(true);
      }
    } catch (err) {
      console.warn('Quest translation failed, using original:', err);
      // Silently fail — user sees original text
    } finally {
      setIsTranslating(false);
    }
  }, [questId, locale, originalTitle, originalDescription, originalSteps]);

  // Auto-translate when quest or locale changes
  useEffect(() => {
    translate();
  }, [translate]);

  return {
    title: translated.title,
    description: translated.description,
    steps: translated.steps,
    isTranslating,
    isTranslated,
    locale,
  };
}

/**
 * Batch-fetch cached translations for a list of quests.
 * Used in quest list/card views. Only fetches from DB cache,
 * does NOT trigger AI translation (too expensive for lists).
 */
export async function batchGetCachedTranslations(
  questIds: string[],
  locale: string
): Promise<Record<string, QuestTranslation>> {
  if (locale === 'en' || questIds.length === 0) return {};

  const { data } = await supabase
    .from('quest_translations')
    .select('quest_id, title, description, steps')
    .eq('locale', locale)
    .in('quest_id', questIds);

  const map: Record<string, QuestTranslation> = {};
  for (const row of data ?? []) {
    map[row.quest_id] = {
      title: row.title,
      description: row.description,
      steps: row.steps || [],
    };
  }
  return map;
}
