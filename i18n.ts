import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all locale files
import en from './locales/en.json';
import et from './locales/et.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';
import ru from './locales/ru.json';
import fi from './locales/fi.json';
import sv from './locales/sv.json';
import lv from './locales/lv.json';
import lt from './locales/lt.json';
import pl from './locales/pl.json';
import pt from './locales/pt.json';
import nl from './locales/nl.json';
import uk from './locales/uk.json';

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
      et: { translation: et },
      de: { translation: de },
      fr: { translation: fr },
      es: { translation: es },
      it: { translation: it },
      ru: { translation: ru },
      fi: { translation: fi },
      sv: { translation: sv },
      lv: { translation: lv },
      lt: { translation: lt },
      pl: { translation: pl },
      pt: { translation: pt },
      nl: { translation: nl },
      uk: { translation: uk },
    },
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

export default i18n;
