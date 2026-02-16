
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Quest } from '../types';

// Category to emoji mapping for quest images
const categoryEmoji: Record<string, string> = {
  Technology: '💻',
  Environment: '🌿',
  Finance: '💰',
  Arts: '🎨',
  Lifestyle: '🏡',
  Education: '🎓',
  History: '📜',
  General: '⚡',
};

// Color gradients per category
const categoryGradient: Record<string, string> = {
  Technology: 'from-blue-500 to-cyan-500',
  Environment: 'from-emerald-500 to-teal-500',
  Finance: 'from-amber-500 to-orange-500',
  Arts: 'from-pink-500 to-rose-500',
  Lifestyle: 'from-violet-500 to-purple-500',
  Education: 'from-indigo-500 to-blue-500',
  History: 'from-yellow-600 to-amber-500',
  General: 'from-slate-500 to-slate-600',
};

interface QuestCardProps {
  quest: Quest;
  isParticipant?: boolean;
  onJoin?: (id: string) => void;
  onComplete?: (id: string) => void;
}

const QuestCard: React.FC<QuestCardProps> = ({ quest, isParticipant, onJoin, onComplete }) => {
  const { t } = useTranslation();
  const isCompleted = quest.status === 'completed';
  const emoji = categoryEmoji[quest.category] || '⚡';
  const gradient = categoryGradient[quest.category] || categoryGradient.General;

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all ${isCompleted ? 'opacity-75 grayscale-[0.5]' : ''}`}>
      <div className="h-40 relative">
        {quest.imageUrl ? (
          <img
            src={quest.imageUrl}
            alt={quest.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <span className="text-6xl opacity-80">{emoji}</span>
          </div>
        )}
        <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm">
          {isCompleted ? t('questCard.completed') : t('questCard.xpReward', { xp: quest.rewardXP })}
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded">
            {quest.category}
          </span>
        </div>
        <h3 className="font-bold text-lg text-slate-800 mb-2">{quest.title}</h3>
        <p className="text-sm text-slate-500 line-clamp-2 mb-4">
          {quest.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2 items-center">
            {quest.participants.slice(0, 3).map((_, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold"
              >
                {i + 1}
              </div>
            ))}
            {quest.participants.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-medium">
                +{quest.participants.length - 3}
              </div>
            )}
            <span className="text-[10px] text-slate-400 font-medium pl-2">
              {quest.participants.length === 0
                ? t('questCard.beFirst')
                : t('questCard.countJoined', { count: quest.participants.length })}
            </span>
          </div>
          
          {isCompleted ? (
            <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold">{t('questCard.done')}</span>
          ) : isParticipant ? (
            <button 
              onClick={() => onComplete?.(quest.id)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-600/20"
            >
              {t('questCard.markComplete')}
            </button>
          ) : (
            <button 
              onClick={() => onJoin?.(quest.id)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              {t('questCard.joinQuest')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestCard;
