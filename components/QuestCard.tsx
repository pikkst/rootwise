
import React from 'react';
import { Quest } from '../types';

interface QuestCardProps {
  quest: Quest;
  isParticipant?: boolean;
  onJoin?: (id: string) => void;
  onComplete?: (id: string) => void;
}

const QuestCard: React.FC<QuestCardProps> = ({ quest, isParticipant, onJoin, onComplete }) => {
  const isCompleted = quest.status === 'completed';

  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md transition-all ${isCompleted ? 'opacity-75 grayscale-[0.5]' : ''}`}>
      <div className="h-40 bg-slate-200 relative">
        <img 
          src={quest.imageUrl || `https://picsum.photos/seed/${quest.id}/800/400`} 
          alt={quest.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3 bg-white/90 px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm">
          {isCompleted ? '✓ COMPLETED' : `+${quest.rewardXP} XP`}
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
          <div className="flex -space-x-2">
            {quest.participants.slice(0, 3).map((p, i) => (
              <img 
                key={i}
                className="w-8 h-8 rounded-full border-2 border-white object-cover" 
                src={`https://picsum.photos/seed/user${p}/100/100`} 
                alt="user"
              />
            ))}
            {quest.participants.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] text-slate-500 font-medium">
                +{quest.participants.length - 3}
              </div>
            )}
            {quest.participants.length === 0 && <span className="text-[10px] text-slate-400 font-medium pl-2">Be the first!</span>}
          </div>
          
          {isCompleted ? (
            <span className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-bold">Done!</span>
          ) : isParticipant ? (
            <button 
              onClick={() => onComplete?.(quest.id)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-emerald-600/20"
            >
              Mark Complete
            </button>
          ) : (
            <button 
              onClick={() => onJoin?.(quest.id)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Join Quest
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestCard;
