import React from 'react';
import { useTranslation } from 'react-i18next';

interface PlanBadgeProps {
  plan: string;
  size?: 'sm' | 'md';
}

const PlanBadge: React.FC<PlanBadgeProps> = ({ plan, size = 'sm' }) => {
  const { t } = useTranslation();
  const styles: Record<string, string> = {
    free: 'bg-slate-100 text-slate-600',
    pro: 'bg-indigo-100 text-indigo-700',
    org: 'bg-amber-100 text-amber-700',
  };

  const labels: Record<string, string> = {
    free: t('common.free'),
    pro: t('common.pro'),
    org: t('common.org'),
  };

  const sizeClass = size === 'md'
    ? 'px-3 py-1 text-xs'
    : 'px-2 py-0.5 text-[10px]';

  return (
    <span className={`${sizeClass} rounded-full font-bold uppercase tracking-wide ${styles[plan] || styles.free} inline-flex items-center gap-1`}>
      {labels[plan] || t('common.free')}
    </span>
  );
};

export default PlanBadge;
