import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';

const localeLoaders = import.meta.glob('./locales/!(*en).json');

const normalizeLanguageCode = (lng: string) => (lng?.split?.('-')?.[0] ?? 'en') as LanguageCode;

const loadLocale = async (lng: string) => {
  const normalizedLng = normalizeLanguageCode(lng);
  if (i18n.hasResourceBundle(normalizedLng, 'translation')) return;

  const loader = localeLoaders[`./locales/${normalizedLng}.json`];
  if (!loader) return;

  const resources = await loader();
  i18n.addResourceBundle(
    normalizedLng,
    'translation',
    (resources as { default: Record<string, any> }).default ?? resources,
    true,
    true,
  );
};

export const SUPPORTED_LANGUAGES = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'et', name: 'Eesti', flag: '🇪🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'lv', name: 'Latviešu', flag: '🇱🇻' },
  { code: 'lt', name: 'Lietuvių', flag: '🇱🇹' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'fi', name: 'Suomi', flag: '🇫🇮' },
  { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
    },
    supportedLngs: SUPPORTED_LANGUAGES.map((lang) => lang.code),
    fallbackLng: 'en',
    compatibilityJSON: 'v4',   // Enables proper plural rules (one/few/many/other)
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'rootwise_language',
      caches: ['localStorage'],
    },
  });

i18n.on('languageChanged', (lng) => {
  void loadLocale(lng);
});

if (i18n.language && i18n.language !== 'en') {
  void loadLocale(i18n.language);
}

export default i18n;
