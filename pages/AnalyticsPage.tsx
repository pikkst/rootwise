import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useQuests } from '../hooks/useQuests';
import { isPro } from '../services/planService';
import { redirectToCheckout } from '../services/stripeService';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { formatChartDate } from '../utils/formatDate';

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#4f46e5'];

const AnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { quests } = useQuests();
  const { showToast } = useToast();
  const [xpHistory, setXpHistory] = useState<{ name: string; xp: number }[]>([]);
  const [aiUsage, setAiUsage] = useState<{ messages: number; quests: number }>({ messages: 0, quests: 0 });

  const plan = profile?.plan || 'free';
  const hasPro = isPro(plan);

  useEffect(() => {
    if (!profile?.id) return;

    // Fetch XP history (last 30 days)
    const fetchXp = async () => {
      const { data } = await supabase
        .from('xp_history')
        .select('xp_gained, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(90);

      if (data && data.length > 0) {
        const byDay: Record<string, number> = {};
        data.forEach((entry: { xp_gained: number; created_at: string }) => {
          const day = formatChartDate(new Date(entry.created_at));
          byDay[day] = (byDay[day] || 0) + entry.xp_gained;
        });
        setXpHistory(Object.entries(byDay).map(([name, xp]) => ({ name, xp })));
      }
    };

    // Fetch AI usage
    const fetchAiUsage = async () => {
      const { data } = await supabase
        .from('ai_usage')
        .select('message_count, quest_gen_count')
        .eq('user_id', profile.id);

      if (data) {
        const totals = data.reduce(
          (acc, row) => ({
            messages: acc.messages + (row.message_count || 0),
            quests: acc.quests + (row.quest_gen_count || 0),
          }),
          { messages: 0, quests: 0 }
        );
        setAiUsage(totals);
      }
    };

    fetchXp();
    fetchAiUsage();
  }, [profile?.id]);

  if (!profile) return null;

  // Compute analytics data
  const myQuests = quests.filter((q) => q.participants.includes(profile.id));
  const completedQuests = myQuests.filter((q) => q.status === 'completed');
  const activeQuests = myQuests.filter((q) => q.status !== 'completed');
  const completionRate = myQuests.length > 0
    ? Math.round((completedQuests.length / myQuests.length) * 100)
    : 0;

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  myQuests.forEach((q) => {
    categoryMap[q.category] = (categoryMap[q.category] || 0) + 1;
  });
  const categoryData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  // Skills coverage
  const skillData = (profile.skills || []).map((skill) => {
    const related = myQuests.filter((q) =>
      q.title.toLowerCase().includes(skill.toLowerCase()) ||
      q.description.toLowerCase().includes(skill.toLowerCase()) ||
      q.category.toLowerCase().includes(skill.toLowerCase())
    ).length;
    return { skill, quests: related };
  });

  // XP summary
  const totalXp = profile.xp || 0;
  const avgXpPerQuest = completedQuests.length > 0
    ? Math.round(totalXp / completedQuests.length)
    : 0;

  // Upgrade wall for free users
  if (!hasPro) {
    return (
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-32">
        <SEOHead title="Analytics - Rootwise" description="Advanced analytics for your learning journey." path="/analytics" />
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6">📊</div>
          <h2 className="text-3xl font-black text-slate-800 mb-4">{t('analytics.title')}</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-2">
            {t('analytics.upgradeDescription')}
          </p>
          <p className="text-slate-400 text-sm mb-8">{t('analytics.upgradeHint')}</p>
          <button
            onClick={() => redirectToCheckout('pro', 'analytics_page', (msg) => showToast('error', msg))}
            className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/30"
          >
            {t('analytics.upgradeCta')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title="Analytics - Rootwise" description="Advanced analytics for your learning journey." path="/analytics" />

      <div className="mb-10">
        <h2 className="text-3xl font-bold text-slate-800">{t('analytics.title')}</h2>
        <p className="text-slate-500">{t('analytics.subtitle')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">{t('analytics.totalXp')}</p>
          <p className="text-2xl sm:text-3xl font-black text-indigo-600">{totalXp}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">{t('analytics.completionRate')}</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">{completionRate}%</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">{t('analytics.activeQuests')}</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-600">{activeQuests.length}</p>
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 mb-1">{t('analytics.avgXpPerQuest')}</p>
          <p className="text-2xl sm:text-3xl font-black text-purple-600">{avgXpPerQuest}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* XP Growth Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>📈</span> {t('analytics.xpOverTime')}
          </h3>
          {xpHistory.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={xpHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="xp" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-16">{t('analytics.noXpData')}</p>
          )}
        </div>

        {/* Quest Category Breakdown */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🎯</span> {t('analytics.questActivity')}
          </h3>
          {categoryData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-16">{t('analytics.noCategoryData')}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Skill Coverage */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>🧠</span> {t('analytics.skillsBreakdown')}
          </h3>
          {skillData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={skillData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="skill" axisLine={false} tickLine={false} tick={{ fill: '#334155', fontSize: 12 }} width={100} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="quests" fill="#8b5cf6" radius={[0, 8, 8, 0]} name={t('analytics.relatedQuests')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-16">{t('analytics.noSkillData')}</p>
          )}
        </div>

        {/* AI Usage Stats */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span>✨</span> {t('analytics.aiUsage')}
          </h3>
          <div className="space-y-6 pt-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">{t('analytics.aiMentorMessages')}</span>
                <span className="text-sm font-bold text-indigo-600">{aiUsage.messages} {t('analytics.total')}</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, aiUsage.messages * 2)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">{t('analytics.aiQuestGenerations')}</span>
                <span className="text-sm font-bold text-purple-600">{aiUsage.quests} {t('analytics.total')}</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                  style={{ width: `${Math.min(100, aiUsage.quests * 10)}%` }}
                />
              </div>
            </div>
            <div className="pt-4 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                <span className="font-bold text-slate-700">{t('analytics.unlimited')}</span> — {t('analytics.unlimitedDescription')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
