import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../types';

const LeaderboardWidget: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { entries, loading } = useLeaderboard();

  if (loading) {
    return (
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h3 className="font-bold mb-4 flex items-center gap-2">🏆 {t('leaderboard.title')}</h3>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  const top5 = entries.slice(0, 5);
  const myEntry = profile ? entries.find((e) => e.id === profile.id) : null;

  const rankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        🏆 {t('leaderboard.title')}
      </h3>

      <ol className="space-y-2">
        {top5.map((entry) => {
          const isMe = entry.id === profile?.id;
          return (
            <li
              key={entry.id}
              onClick={() => navigate(`/users/${entry.id}`)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all hover:bg-slate-50 ${
                isMe ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''
              }`}
            >
              <span className="w-8 text-center text-sm font-bold text-slate-500 shrink-0">
                {rankEmoji(entry.rank)}
              </span>
              {entry.avatar_url ? (
                <img
                  src={entry.avatar_url}
                  alt={entry.name}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {getInitials(entry.name)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold truncate ${isMe ? 'text-indigo-700' : 'text-slate-800'}`}>
                  {isMe ? t('common.you') : entry.name}
                </p>
                <p className="text-[10px] text-slate-400">{t('leaderboard.levelXp', { level: entry.level, xp: entry.xp })}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Show user's own rank if not in top 5 */}
      {myEntry && myEntry.rank > 5 && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-indigo-50 ring-1 ring-indigo-200">
            <span className="w-8 text-center text-sm font-bold text-slate-500">{rankEmoji(myEntry.rank)}</span>
            {myEntry.avatar_url ? (
              <img src={myEntry.avatar_url} alt={myEntry.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                {getInitials(myEntry.name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-indigo-700 truncate">{t('common.you')}</p>
              <p className="text-[10px] text-slate-400">{t('leaderboard.levelXp', { level: myEntry.level, xp: myEntry.xp })}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default LeaderboardWidget;
