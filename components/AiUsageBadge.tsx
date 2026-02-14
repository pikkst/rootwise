import React from 'react';

interface AiUsageBadgeProps {
  used: number;
  limit: number;
  label: string;
  compact?: boolean;
}

const AiUsageBadge: React.FC<AiUsageBadgeProps> = ({ used, limit, label, compact = false }) => {
  const isUnlimited = limit === Infinity || limit > 99999;
  const remaining = isUnlimited ? Infinity : Math.max(0, limit - used);
  const percentage = isUnlimited ? 100 : (used / limit) * 100;

  const isLow = !isUnlimited && remaining <= 1;
  const isEmpty = !isUnlimited && remaining === 0;

  if (compact) {
    return (
      <span className={`text-xs font-medium ${isEmpty ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-400'}`}>
        {isUnlimited ? '∞' : `${remaining}/${limit}`} {label}
      </span>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className={`text-xs font-bold ${isEmpty ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-slate-500'}`}>
          {isUnlimited ? 'Unlimited' : `${remaining} remaining`}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isEmpty ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-indigo-500'
          }`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
    </div>
  );
};

export default AiUsageBadge;
