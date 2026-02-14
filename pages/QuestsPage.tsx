import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QuestCard from '../components/QuestCard';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useQuests } from '../hooks/useQuests';
import { RootwiseAIService } from '../services/geminiService';
import { PLAN_LIMITS, isPro } from '../services/planService';

const CATEGORIES = ['All', 'Technology', 'Environment', 'Finance', 'Arts', 'Lifestyle', 'Education', 'History'];

const QuestsPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { quests, loading, filter, setFilter, joinQuest, completeQuest, createQuest } = useQuests();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [completingQuestId, setCompletingQuestId] = useState<string | null>(null);
  const aiService = useRef(new RootwiseAIService());

  const handleJoinQuest = async (id: string) => {
    if (!profile) {
      navigate('/auth');
      return;
    }
    const result = await joinQuest(id, profile.id);
    if (result.error) {
      showToast('error', result.error);
    } else {
      showToast('success', 'Joined quest successfully!');
    }
  };

  const handleCompleteQuest = (id: string) => {
    setCompletingQuestId(id);
  };

  const confirmCompletion = async () => {
    if (!completingQuestId || !profile) return;
    const result = await completeQuest(completingQuestId, profile.id);
    if (result.error) {
      showToast('error', result.error);
    } else {
      showToast('success', 'Quest completed! XP awarded.');
    }
    setCompletingQuestId(null);
  };

  const handleGenerateQuest = async () => {
    if (!profile) {
      navigate('/auth');
      return;
    }
    setIsAiLoading(true);
    try {
      const data = await aiService.current.generateQuest('Creative Growth', profile.role);
      if (data?.error) {
        showToast('info', data.error);
        setIsAiLoading(false);
        return;
      }
      if (data) {
        await createQuest({
          title: data.title,
          description: data.description,
          category: data.category,
          rewardXP: 150,
          steps: data.steps,
          createdBy: profile.id,
        });
        showToast('success', `Quest "${data.title}" created!`);
      }
    } catch (err) {
      console.error('Quest generation error:', err);
      showToast('error', 'Failed to generate quest. Please try again.');
    }
    setIsAiLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead
        title="Explore Quests - Rootwise"
        description="Find intergenerational quests that match your skills. Learn from every generation, teach what you know."
        path="/quests"
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Explore Quests</h2>
          <p className="text-slate-500">Find a mission that matches your skills or curiosity.</p>
          {profile && !isPro(profile.plan || 'free') && (() => {
            const activeCount = quests.filter(q => q.participants.includes(profile.id) && q.status === 'active').length;
            const max = PLAN_LIMITS.free.maxActiveQuests;
            return (
              <p className="text-xs text-amber-600 mt-1 font-medium">
                Active quests: {activeCount}/{max} (Free plan) — <button onClick={() => navigate('/profile')} className="underline">Upgrade for unlimited</button>
              </p>
            );
          })()}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleGenerateQuest}
            disabled={isAiLoading}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isAiLoading ? <span className="animate-spin text-xl">✨</span> : <span>✨</span>}
            Generate AI Quest
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 mb-8 no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-6 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors border ${
              filter === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">Loading quests...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {quests.map((q) => (
            <QuestCard
              key={q.id}
              quest={q}
              isParticipant={!!profile && q.participants.includes(profile.id)}
              onJoin={handleJoinQuest}
              onComplete={handleCompleteQuest}
            />
          ))}
          {quests.length === 0 && (
            <div className="col-span-3 text-center py-20 text-slate-400">
              <p className="text-6xl mb-4">📜</p>
              <p className="font-bold text-xl">No quests found</p>
              <p>Try a different category or generate one with AI!</p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      {completingQuestId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -translate-y-16 translate-x-16"></div>
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6">
              🎖️
            </div>
            <h3 className="text-2xl font-black text-slate-800 text-center mb-4">Mission Accomplished?</h3>
            <p className="text-slate-500 text-center mb-10 leading-relaxed">
              Confirm that you've shared wisdom and completed this Quest.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmCompletion}
                className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30"
              >
                Yes, Mission Complete! 🎉
              </button>
              <button
                onClick={() => setCompletingQuestId(null)}
                className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                Not yet, keep working
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestsPage;
