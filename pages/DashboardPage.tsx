import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import QuestCard from '../components/QuestCard';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useQuests } from '../hooks/useQuests';
import { useConnections } from '../hooks/useConnections';
import { profileToUser } from '../types';
import { supabase } from '../services/supabase';

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const { quests, completeQuest } = useQuests();
  const { connections, fetchConnections } = useConnections(profile?.id);
  const [xpHistory, setXpHistory] = useState<{ name: string; xp: number }[]>([]);

  const currentUser = profile ? profileToUser(profile) : null;

  useEffect(() => {
    if (profile?.id) fetchConnections();
  }, [profile?.id, fetchConnections]);

  // Fetch real XP history for chart
  useEffect(() => {
    if (!profile?.id) return;
    const fetchXpHistory = async () => {
      const { data } = await supabase
        .from('xp_history')
        .select('xp_gained, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: true })
        .limit(30);

      if (data && data.length > 0) {
        // Aggregate by date (not weekday name)
        const byDay: Record<string, number> = {};
        data.forEach((entry: { xp_gained: number; created_at: string }) => {
          const day = new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          byDay[day] = (byDay[day] || 0) + entry.xp_gained;
        });
        setXpHistory(Object.entries(byDay).map(([name, xp]) => ({ name, xp })));
      }
    };
    fetchXpHistory();
  }, [profile?.id]);

  const handleCompleteQuest = async (id: string) => {
    if (!profile) return;
    const result = await completeQuest(id, profile.id);
    if (result.error) {
      showToast('error', result.error);
    } else {
      showToast('success', 'Quest completed! XP awarded.');
      await refreshProfile();
    }
  };

  if (!currentUser) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-slate-500 font-medium">Loading your dashboard...</p>
      </div>
    </div>
  );

  const myQuests = quests.filter((q) => q.participants.includes(currentUser.id));
  const level = currentUser.level;
  const levelProgress = ((currentUser.xp % 500) / 500) * 100;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title="Dashboard - Rootwise" description="Track your learning journey, quests, and connections." path="/dashboard" />

      <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">
            Welcome back, {currentUser.name.split(' ')[0]}!
          </h2>
          <p className="text-slate-500">
            You have <span className="text-indigo-600 font-semibold">{currentUser.xp} XP</span> total.
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-2">
          <span className="text-indigo-600 font-bold">Level {level}</span>
          <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${levelProgress}%` }}></div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Growth Chart — only show if there's real data */}
          {xpHistory.length > 0 && (
            <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <span>📈</span> Growth Impact
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={xpHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
                    <YAxis hide />
                    <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Line
                      type="monotone"
                      dataKey="xp"
                      stroke="#6366f1"
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">My Current Quests</h3>
              <button onClick={() => navigate('/quests')} className="text-sm text-indigo-600 font-semibold hover:underline">
                Find New
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myQuests.slice(0, 4).map((q) => (
                <QuestCard key={q.id} quest={q} isParticipant onComplete={handleCompleteQuest} />
              ))}
              {myQuests.length === 0 && (
                <div className="col-span-2 p-10 bg-slate-100 rounded-3xl border border-dashed border-slate-300 text-center">
                  <p className="text-slate-500 mb-4">You haven't joined any quests yet!</p>
                  <button onClick={() => navigate('/quests')} className="text-indigo-600 font-bold hover:underline">
                    Explore Available Quests
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          {/* Quick Actions */}
          <section className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl">
            <h3 className="font-bold text-lg mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/quests')}
                className="w-full py-3 bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl text-sm hover:bg-white/30 transition-colors text-left px-4"
              >
                📜 Browse Quests
              </button>
              <button
                onClick={() => navigate('/ai-nexus')}
                className="w-full py-3 bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl text-sm hover:bg-white/30 transition-colors text-left px-4"
              >
                ✨ Ask AI Mentor
              </button>
              <button
                onClick={() => navigate('/community')}
                className="w-full py-3 bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl text-sm hover:bg-white/30 transition-colors text-left px-4"
              >
                🤝 Join a Community
              </button>
              <button
                onClick={() => navigate('/matching')}
                className="w-full py-3 bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl text-sm hover:bg-white/30 transition-colors text-left px-4"
              >
                🔗 Find Matches
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="w-full py-3 bg-white/20 backdrop-blur-sm text-white font-bold rounded-xl text-sm hover:bg-white/30 transition-colors text-left px-4"
              >
                📊 View Analytics
              </button>
            </div>
          </section>

          <section className="bg-white p-6 rounded-3xl border border-slate-200">
            <h3 className="font-bold mb-4">Upcoming Connections</h3>
            <div className="space-y-4">
              {connections.length > 0
                ? connections.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{c.partner?.name ?? 'Partner'}</p>
                        <p className="text-xs text-slate-500">
                          {c.scheduled_at ? new Date(c.scheduled_at).toLocaleString() : 'TBD'}
                        </p>
                        {c.topic && <p className="text-xs text-indigo-500 mt-1">{c.topic}</p>}
                      </div>
                    </div>
                  ))
                : (
                  <div className="text-center py-6">
                    <p className="text-slate-400 text-sm mb-2">No upcoming connections</p>
                    <p className="text-slate-300 text-xs">Connections are created when you partner with others on quests.</p>
                  </div>
                )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
