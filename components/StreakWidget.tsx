import React from 'react';
import { useTranslation } from 'react-i18next';
import { Profile } from '../types';

interface StreakWidgetProps {
  profile: Profile;
}

const StreakWidget: React.FC<StreakWidgetProps> = ({ profile }) => {
  const { t } = useTranslation();
  const streak = profile.login_streak_days ?? 0;
  const best = profile.best_streak_days ?? 0;

  // How many trailing active days to show (up to 7)
  const activeDays = Math.min(streak, 7);

  const flameColor = (s: number) => {
    if (s >= 30) return 'text-violet-500';
    if (s >= 14) return 'text-amber-500';
    if (s >= 7) return 'text-orange-500';
    return 'text-rose-400';
  };

  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold flex items-center gap-2">
          🔥 {t('streak.title')}
        </h3>
        {best > 0 && (
          <span className="text-xs text-slate-400">{t('streak.best', { days: best })}</span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4">
        <span className={`text-4xl font-black ${flameColor(streak)}`}>{streak}</span>
        <div>
          <p className="text-sm font-semibold text-slate-700">
            {t('streak.days_one', { count: streak })}
          </p>
          <p className="text-xs text-slate-400">{t('streak.loginDaily')}</p>
        </div>
      </div>

      {/* 7-day dot trail */}
      <div className="flex gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => {
          const active = i < activeDays;
          const isToday = i === activeDays - 1;
          return (
            <div
              key={i}
              className={`flex-1 h-2 rounded-full transition-all ${
                active
                  ? isToday
                    ? 'bg-orange-500'
                    : 'bg-orange-300'
                  : 'bg-slate-100'
              }`}
            />
          );
        })}
      </div>

      {streak >= 7 && (
        <p className="text-xs text-orange-600 font-semibold mt-3 flex items-center gap-1">
          🏅 {t('streak.onFire')}
        </p>
      )}
      {streak === 0 && (
        <p className="text-xs text-slate-400 mt-3">{t('streak.startToday')}</p>
      )}
    </section>
  );
};

export default StreakWidget;
