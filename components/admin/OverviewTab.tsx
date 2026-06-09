import React from 'react';
import { useTranslation } from 'react-i18next';
import BarChartWrapper from '../charts/BarChartWrapper';

interface Props {
  isPlatformAdmin: boolean;
  platformStats: any;
  stats: any;
}

const OverviewTab: React.FC<Props> = ({ isPlatformAdmin, platformStats, stats }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      {isPlatformAdmin && platformStats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">{t('admin.totalUsers')}</p>
            <p className="text-3xl font-black text-indigo-600">{platformStats.totalUsers}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">{t('admin.activeUsers')}</p>
            <p className="text-3xl font-black text-emerald-600">{platformStats.activeUsers7d}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">{t('admin.totalQuests')}</p>
            <p className="text-3xl font-black text-amber-600">{platformStats.totalQuests}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">{t('admin.totalCommunities')}</p>
            <p className="text-3xl font-black text-purple-600">{platformStats.totalCommunities}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">{t('admin.totalMembers')}</p>
            <p className="text-3xl font-black text-indigo-600">{stats.totalMembers}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">{t('admin.tabCommunities')}</p>
            <p className="text-3xl font-black text-emerald-600">{stats.totalCommunities}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">{t('admin.questActivity')}</p>
            <p className="text-3xl font-black text-amber-600">{stats.totalQuests}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-sm text-slate-500 mb-1">{t('admin.totalXp')}</p>
            <p className="text-3xl font-black text-purple-600">{stats.totalXp}</p>
          </div>
        </div>
      )}

      {stats?.memberActivity?.length > 0 && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4">{t('admin.rolesChart')}</h3>
          <div className="h-48">
            <BarChartWrapper data={stats.memberActivity} dataKey="members" />
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
