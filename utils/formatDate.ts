/**
 * Locale-aware date/time formatting using the browser's Intl API.
 * Always formats according to the user's selected i18n language.
 */
import i18next from 'i18next';

/** Map i18next language codes to BCP 47 locale tags for Intl */
const LOCALE_MAP: Record<string, string> = {
  en: 'en-GB', // UK date format (dd/mm/yyyy) — friendlier for EU audience
  et: 'et-EE',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  ru: 'ru-RU',
  fi: 'fi-FI',
  sv: 'sv-SE',
  lv: 'lv-LV',
  lt: 'lt-LT',
  pl: 'pl-PL',
  pt: 'pt-PT',
  nl: 'nl-NL',
  uk: 'uk-UA',
};

function getLocale(): string {
  return LOCALE_MAP[i18next.language] || i18next.language || 'en-GB';
}

/** Guard against invalid / missing dates — returns '' instead of throwing */
function safeDate(date: string | Date): Date | null {
  const d = typeof date === 'string' ? new Date(date) : date;
  return isNaN(d.getTime()) ? null : d;
}

/** "14. veebr 2026" or "14 Feb 2026" */
export function formatDateShort(date: string | Date): string {
  const d = safeDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'short',
  }).format(d);
}

/** "14. veebruar 2026" or "14 February 2026" */
export function formatDateLong(date: string | Date): string {
  const d = safeDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

/** "14.02.2026" or "14/02/2026" — locale-appropriate numeric date */
export function formatDateNumeric(date: string | Date): string {
  const d = safeDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).format(d);
}

/** "14.02.2026, 15:30" — date + time */
export function formatDateTime(date: string | Date): string {
  const d = safeDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat(getLocale(), {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** "15:30" — time only */
export function formatTime(date: string | Date): string {
  const d = safeDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat(getLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** "Jan 14" or "14. jaan" — for chart axis labels */
export function formatChartDate(date: Date): string {
  const d = safeDate(date);
  if (!d) return '';
  return new Intl.DateTimeFormat(getLocale(), {
    month: 'short',
    day: 'numeric',
  }).format(d);
}
