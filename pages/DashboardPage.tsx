import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import QuestCard from '../components/QuestCard';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useQuests } from '../hooks/useQuests';
import { useConnections } from '../hooks/useConnections';
import { profileToUser } from '../types';

const dummyGrowthData = [
  { name: 'Mon', xp: 400 },
  { name: 'Tue', xp: 700 },
  { name: 'Wed', xp: 600 },
  { name: 'Thu', xp: 1200 },
  { name: 'Fri', xp: 1800 },
  { name: 'Sat', xp: 2100 },
  { name: 'Sun', xp: 2400 },
];

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { quests, completeQuest } = useQuests();
  const { connections, fetchConnections } = useConnections(profile?.id);

  const currentUser = profile ? profileToUser(profile) : null;

  useEffect(() => {
    if (profile?.id) fetchConnections();
  }, [profile?.id, fetchConnections]);

  const handleCompleteQuest = async (id: string) => {
    if (profile) await completeQuest(id, profile.id);
  };

  if (!currentUser) return null;

  const myQuests = quests.filter((q) => q.participants.includes(currentUser.id));
  const level = Math.floor(currentUser.xp / 500) + 1;
  const levelProgress = ((currentUser.xp % 500) / 500) * 100;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead title="Dashboard - Rootwise" description="Track your learning journey, quests, and connections." path="/dashboard" />

      <header className="mb-10 flex justify-between items-end">
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
            <div className="h-full bg-indigo-600" style={{ width: `${levelProgress}%` }}></div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span>📈</span> Growth Impact
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dummyGrowthData}>
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

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">My Current Quests</h3>
              <button onClick={() => navigate('/quests')} className="text-sm text-indigo-600 font-semibold hover:underline">
                Find New
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myQuests.slice(0, 2).map((q) => (
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
          <section className="bg-indigo-600 p-6 rounded-3xl text-white shadow-xl">
            <h3 className="font-bold text-lg mb-2">Mentor Highlight</h3>
            <div className="flex items-center gap-4 mb-4">
              <img src="https://picsum.photos/seed/sage/100/100" className="w-12 h-12 rounded-full border-2 border-indigo-400" alt="Sage" />
              <div>
                <p className="font-bold">Evelyn, 72</p>
                <p className="text-xs text-indigo-100 italic">"Mastering the art of patience and pastry."</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/ai-nexus')}
              className="w-full py-3 bg-white text-indigo-600 font-bold rounded-xl text-sm hover:bg-indigo-50 transition-colors"
            >
              Ask about Baking
            </button>
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
                      </div>
                      <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-indigo-600 border border-slate-100 shadow-sm">
                        🎥
                      </div>
                    </div>
                  ))
                : [
                    { name: 'Sarah M.', time: 'Today, 4:00 PM', topic: 'Digital Photo Ops' },
                    { name: 'Arthur K.', time: 'Tomorrow, 10:00 AM', topic: 'Woodworking Intro' },
                  ].map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                      <div>
                        <p className="text-sm font-bold text-slate-800">{c.name}</p>
                        <p className="text-xs text-slate-500">{c.time}</p>
                      </div>
                      <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-indigo-600 border border-slate-100 shadow-sm">
                        🎥
                      </div>
                    </div>
                  ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
