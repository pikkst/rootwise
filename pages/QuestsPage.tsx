import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QuestCard from '../components/QuestCard';
import SEOHead from '../components/SEOHead';
import AiUsageBadge from '../components/AiUsageBadge';
import UpgradeModal from '../components/UpgradeModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useQuests } from '../hooks/useQuests';
import { useAiUsage } from '../hooks/useAiUsage';
import { RootwiseAIService } from '../services/geminiService';
import type { UserQuestContext } from '../services/geminiService';
import { supabase } from '../services/supabase';
import { PLAN_LIMITS, isPro, getEffectivePlan } from '../services/planService';
import { batchGetCachedTranslations, type QuestTranslation } from '../hooks/useQuestTranslation';
import { trackEvent } from '../services/analyticsService';

const CATEGORY_KEYS = ['All', 'Technology', 'Environment', 'Finance', 'Arts', 'Lifestyle', 'Education', 'History'];

const QuestsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { quests, loading, filter, setFilter, joinQuest, completeQuest, createQuest } = useQuests();
  const aiUsage = useAiUsage();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [completingQuestId, setCompletingQuestId] = useState<string | null>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('');
  const [translations, setTranslations] = useState<Record<string, QuestTranslation>>({});
  const aiService = useRef(new RootwiseAIService());

  const locale = i18n.language?.slice(0, 2) || 'en';

  // Batch-fetch cached translations whenever quests or locale change
  useEffect(() => {
    if (locale === 'en' || quests.length === 0) {
      setTranslations({});
      return;
    }
    const ids = quests.map((q) => q.id);
    batchGetCachedTranslations(ids, locale).then(setTranslations);
  }, [quests, locale]);

  const plan = profile?.plan || 'free';
  const hasPro = isPro(plan);
  const effectivePlan = getEffectivePlan(plan);

  const handleJoinQuest = async (id: string) => {
    if (!profile) {
      navigate('/auth');
      return;
    }
    const result = await joinQuest(id, profile.id);
    if (result.error) {
      showToast('error', result.error);
    } else {
      void trackEvent('quest_joined', {
        questId: id,
        source: 'quests_page',
      });
      showToast('success', t('quests.joinedToast'));
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
      showToast('success', t('quests.completedToast', { xp: '' }));
    }
    setCompletingQuestId(null);
  };

  /** Gather full user context for personalized AI quest generation */
  const buildUserContext = async (): Promise<UserQuestContext> => {
    const ctx: UserQuestContext = {
      age: profile?.age ?? null,
      role: profile?.role ?? 'Seeker',
      skills: profile?.skills ?? [],
      interests: profile?.interests ?? [],
      bio: profile?.bio ?? null,
      spokenLanguages: profile?.spoken_languages ?? [],
      level: profile?.level ?? 1,
      xp: profile?.xp ?? 0,
    };

    // Fetch user's primary location
    try {
      const { data: locData } = await supabase
        .from('profile_locations')
        .select('locations(country, county, city, locality)')
        .eq('profile_id', profile!.id)
        .eq('is_primary', true)
        .limit(1)
        .single();
      const loc = (locData as any)?.locations;
      if (loc) {
        ctx.location = [loc.locality, loc.city, loc.county, loc.country].filter(Boolean).join(', ');
      }
    } catch { /* no location set */ }

    // Fetch titles of user's existing quests (to avoid repeats)
    try {
      const { data: memberRows } = await supabase
        .from('quest_members')
        .select('quest_id')
        .eq('user_id', profile!.id)
        .limit(30);
      if (memberRows?.length) {
        const ids = memberRows.map((r: any) => r.quest_id);
        const { data: existingQuests } = await supabase
          .from('quests')
          .select('title')
          .in('id', ids);
        if (existingQuests?.length) {
          ctx.existingQuestTitles = existingQuests.map((q: any) => q.title);
        }
      }
    } catch { /* ok */ }

    return ctx;
  };

  const handleGenerateQuest = async () => {
    if (!profile) {
      navigate('/auth');
      return;
    }
    // Check rate limit for free users
    if (!hasPro && !aiUsage.canGenerateQuest) {
      void trackEvent('quest_gen_limit_reached', {
        source: 'quests_page',
        used: aiUsage.questGensUsed,
        limit: aiUsage.questGenLimit,
      });
      setUpgradeFeature(t('quests.aiQuestGeneration'));
      setShowUpgrade(true);
      return;
    }
    // Check quest slot limit for free users
    if (!hasPro) {
      const activeCount = quests.filter(q => q.participants.includes(profile.id) && q.status !== 'completed').length;
      const max = PLAN_LIMITS.free.maxActiveQuests;
      if (activeCount >= max) {
        void trackEvent('upgrade_modal_shown', {
          source: 'quests_page_active_limit',
          activeCount,
          limit: max,
          feature: 'active_quest_limit',
        });
        setUpgradeFeature(t('quests.upgradeUnlimited'));
        setShowUpgrade(true);
        return;
      }
    }
    setIsAiLoading(true);
    try {
      // Build personalized context from user profile
      const userContext = await buildUserContext();

      // Choose a dynamic topic based on user interests instead of hardcoded 'Creative Growth'
      const interests = profile.interests ?? [];
      const skills = profile.skills ?? [];
      const topicPool = [...interests, ...skills, 'Creative Growth', 'Personal Development', 'Community Connection'];
      const topic = topicPool[Math.floor(Math.random() * topicPool.length)];

      const data = await aiService.current.generateQuest(topic, profile.role, userContext);
      if (data?.error) {
        showToast('info', data.error);
        setIsAiLoading(false);
        return;
      }
      if (data) {
        // Generate quest image
        let imageUrl: string | null = null;
        try {
          const imageBase64 = await aiService.current.generateQuestImage(
            data.title,
            data.description,
            data.category
          );

          // If image generated, upload it to storage
          if (imageBase64) {
            const fileName = `quest-${Date.now()}.png`;
            const base64Data = imageBase64.replace('data:image/png;base64,', '');
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('profile-media')
              .upload(`quest-images/${profile.id}/${fileName}`, bytes, {
                contentType: 'image/png',
              });

            if (!uploadError && uploadData) {
              const { data: publicUrlData } = supabase.storage
                .from('profile-media')
                .getPublicUrl(uploadData.path);
              imageUrl = publicUrlData.publicUrl;
            }
          }
        }

        // Create quest with image if available
        await createQuest({
          title: data.title,
          description: data.description,
          category: data.category,
          reward_xp: 150,
          steps: data.steps,
          created_by: profile.id,
          quest_type: 'solo',
          is_virtual: true,
          image_url: imageUrl,
        });
        void trackEvent('quest_generated_ai', {
          source: 'quests_page',
          category: data.category,
        });
        showToast('success', t('quests.generatedToast'));
      }
    } catch {
      showToast('error', t('quests.generationFailed'));
    }
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
          <h2 className="text-3xl font-bold text-slate-800">{t('quests.title')}</h2>
          <p className="text-slate-500">{t('quests.subtitle')}</p>
          {profile && !isPro(profile.plan || 'free') && (() => {
            const activeCount = quests.filter(q => q.participants.includes(profile.id) && q.status !== 'completed').length;
            const max = PLAN_LIMITS.free.maxActiveQuests;
            return (
              <div>
                <p className="text-xs text-amber-600 mt-1 font-medium">
                  {t('quests.activeCount', { n: activeCount, max })} — <button onClick={() => { void trackEvent('upgrade_cta_clicked', { source: 'quests_inline_limit', feature: 'active_quest_limit' }); setUpgradeFeature(t('quests.upgradeUnlimited')); setShowUpgrade(true); }} className="underline">{t('quests.upgradeUnlimited')}</button>
                </p>
              </div>
            );
          })()}
          {hasPro && (
            <p className="text-xs text-emerald-600 mt-1 font-medium">
              {t('quests.unlimitedQuests')}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {!hasPro && (
            <div className="hidden md:block">
              <AiUsageBadge
                used={aiUsage.questGensUsed}
                limit={aiUsage.questGenLimit}
                label={t('quests.aiGensLeft', { n: aiUsage.questGenLimit - aiUsage.questGensUsed })}
                compact
              />
            </div>
          )}
          {profile && (
            <button
              onClick={() => navigate('/quests/create')}
              className="px-6 py-3 bg-white border-2 border-indigo-300 text-indigo-700 font-bold rounded-2xl hover:bg-indigo-50 hover:border-indigo-500 transition-all flex items-center gap-2"
            >
              ✏️ {t('quests.createOwn')}
            </button>
          )}
          <button
            onClick={handleGenerateQuest}
            disabled={isAiLoading}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isAiLoading ? <span className="animate-spin text-xl">✨</span> : <span>✨</span>}
            {t('quests.generateAi')}
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 mb-8 no-scrollbar">
        {CATEGORY_KEYS.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-6 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors border ${
              filter === cat
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
            }`}
          >
            {t(`quests.category${cat}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500">{t('quests.loading')}</p>
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
              translatedTitle={translations[q.id]?.title}
              translatedDescription={translations[q.id]?.description}
            />
          ))}
          {quests.length === 0 && (
            <div className="col-span-3 text-center py-20 text-slate-400">
              <p className="text-6xl mb-4">📜</p>
              <p className="font-bold text-xl">{t('quests.noQuests')}</p>
              <p>{t('quests.noQuestsHint')}</p>
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
            <h3 className="text-2xl font-black text-slate-800 text-center mb-4">{t('quests.completeConfirmTitle')}</h3>
            <p className="text-slate-500 text-center mb-10 leading-relaxed">
              {t('quests.completeConfirmDesc')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmCompletion}
                className="w-full py-4 bg-emerald-600 text-white font-black rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/30"
              >
                {t('quests.completeConfirmYes')}
              </button>
              <button
                onClick={() => setCompletingQuestId(null)}
                className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
              >
                {t('quests.completeConfirmNo')}
              </button>
            </div>
          </div>
        </div>
      )}

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature={upgradeFeature}
        requiredPlan="pro"
      />
    </div>
  );
};

export default QuestsPage;
