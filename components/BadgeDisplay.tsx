import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BadgeId, UserBadge } from '../types';
import { BADGE_META, ALL_BADGE_IDS } from '../hooks/useBadges';

interface BadgeDisplayProps {
  /** Badges the user has actually earned */
  earnedIds: Set<BadgeId>;
  /** Show locked badges as greyed-out outlines */
  showLocked?: boolean;
  /** 'compact' = small grid, 'full' = larger with labels */
  variant?: 'compact' | 'full';
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({
  earnedIds,
  showLocked = false,
  variant = 'compact',
}) => {
  const { t } = useTranslation();
  const [tooltip, setTooltip] = useState<string | null>(null);

  const displayIds = showLocked ? ALL_BADGE_IDS : ALL_BADGE_IDS.filter((id) => earnedIds.has(id));

  if (displayIds.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">{t('badges.none')}</p>
    );
  }

  if (variant === 'full') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {displayIds.map((id) => {
          const meta = BADGE_META[id];
          const earned = earnedIds.has(id);
          return (
            <div
              key={id}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                earned
                  ? `${meta.color} shadow-sm`
                  : 'bg-slate-50 border-slate-200 opacity-40 grayscale'
              }`}
            >
              <span className="text-2xl leading-none">{meta.emoji}</span>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">
                  {t(`${meta.i18nKey}.title`)}
                </p>
                <p className="text-[10px] leading-snug opacity-80 truncate">
                  {earned ? t(`${meta.i18nKey}.desc`) : t('badges.lockedHint')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // compact
  return (
    <div className="flex flex-wrap gap-2">
      {displayIds.map((id) => {
        const meta = BADGE_META[id];
        const earned = earnedIds.has(id);
        return (
          <div
            key={id}
            className="relative"
            onMouseEnter={() => setTooltip(id)}
            onMouseLeave={() => setTooltip(null)}
          >
            <div
              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-lg cursor-default select-none transition-all ${
                earned
                  ? `${meta.color} shadow-sm`
                  : 'bg-slate-50 border-slate-200 opacity-30 grayscale'
              }`}
            >
              {meta.emoji}
            </div>
            {tooltip === id && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-44 pointer-events-none">
                <div className="bg-slate-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg">
                  <p className="font-bold">{t(`${meta.i18nKey}.title`)}</p>
                  <p className="opacity-80 leading-snug">
                    {earned ? t(`${meta.i18nKey}.desc`) : t('badges.lockedHint')}
                  </p>
                </div>
                <div className="w-2 h-2 bg-slate-900 rotate-45 mx-auto -mt-1" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default BadgeDisplay;
