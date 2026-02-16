/**
 * Hook that returns a locale-prefixed path builder.
 * 
 * Usage:
 *   const lp = useLocalePath();
 *   <Link to={lp('/quests')}>Quests</Link>
 *   // → "/et/quests" if language is Estonian, "/quests" if English
 */
import { useTranslation } from 'react-i18next';

export function useLocalePath() {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';
  const prefix = lang === 'en' ? '' : `/${lang}`;

  return (path: string) => `${prefix}${path}`;
}
