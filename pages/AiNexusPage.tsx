import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import AiUsageBadge from '../components/AiUsageBadge';
import UpgradeModal from '../components/UpgradeModal';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useChatMessages } from '../hooks/useChatMessages';
import { useAiUsage } from '../hooks/useAiUsage';
import { RootwiseAIService } from '../services/geminiService';
import type { ChatUserProfile } from '../services/geminiService';
import type { AiMatchSuggestion } from '../services/geminiService';
import { supabase } from '../services/supabase';
import { formatTime } from '../utils/formatDate';
import { isPro } from '../services/planService';
import { trackEvent } from '../services/analyticsService';

const AiNexusPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { messages, addMessage, fetchMessages } = useChatMessages(profile?.id);
  const aiUsage = useAiUsage();
  const [inputMessage, setInputMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [matchSuggestions, setMatchSuggestions] = useState<AiMatchSuggestion[]>([]);
  const [pendingIntroUserId, setPendingIntroUserId] = useState<string | null>(null);
  const aiService = useRef(new RootwiseAIService());
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const isChatAtBottomRef = useRef(true);
  const chatBottomThreshold = 80;

  const plan = profile?.plan || 'free';
  const hasPro = isPro(plan);

  // Build user profile context for AI mentor (cached, refreshed on profile change)
  const userProfileRef = useRef<ChatUserProfile | null>(null);
  const buildUserProfile = useCallback(async () => {
    if (!profile) return;
    const ctx: ChatUserProfile = {
      name: profile.name,
      age: profile.age,
      role: profile.role,
      skills: profile.skills ?? [],
      interests: profile.interests ?? [],
      bio: profile.bio,
      spokenLanguages: profile.spoken_languages ?? [],
      level: profile.level ?? 1,
      xp: profile.xp ?? 0,
      plan: profile.plan,
      memberSince: profile.created_at ? new Date(profile.created_at).toISOString().slice(0, 10) : undefined,
    };

    // Fetch primary location
    try {
      const { data: locData } = await supabase
        .from('profile_locations')
        .select('locations(country, county, city, locality)')
        .eq('profile_id', profile.id)
        .eq('is_primary', true)
        .limit(1)
        .single();
      const loc = (locData as any)?.locations;
      if (loc) ctx.location = [loc.locality, loc.city, loc.county, loc.country].filter(Boolean).join(', ');
    } catch { /* no location */ }

    // Fetch completed quest count
    try {
      const { count } = await supabase
        .from('quest_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('xp_awarded', true);
      ctx.completedQuestCount = count ?? 0;
    } catch { /* ok */ }

    // Fetch community memberships
    try {
      const { data: memberships } = await supabase
        .from('community_members')
        .select('community_id, communities(name)')
        .eq('user_id', profile.id)
        .limit(10);
      if (memberships?.length) {
        ctx.communityNames = memberships.map((m: any) => m.communities?.name).filter(Boolean);
      }
    } catch { /* ok */ }

    userProfileRef.current = ctx;
  }, [profile]);

  useEffect(() => {
    buildUserProfile();
  }, [buildUserProfile]);

  useEffect(() => {
    if (profile?.id) fetchMessages();
  }, [profile?.id, fetchMessages]);

  const updateChatBottomState = useCallback(() => {
    if (!chatScrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    isChatAtBottomRef.current = distanceFromBottom <= chatBottomThreshold;
  }, [chatBottomThreshold]);

  useEffect(() => {
    if (!chatScrollRef.current || !isChatAtBottomRef.current) return;
    chatScrollRef.current.scrollTo({
      top: chatScrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isAiLoading]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !profile) return;

    // Check if user can send (free plan rate limit)
    if (!hasPro && !aiUsage.canChat) {
      void trackEvent('ai_limit_reached', {
        source: 'ai_nexus_send',
        used: aiUsage.messagesUsed,
        limit: aiUsage.messageLimit,
      });
      setShowUpgrade(true);
      return;
    }

    await addMessage('user', inputMessage);
    const msgText = inputMessage;
    setInputMessage('');
    setIsAiLoading(true);

    const history = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));
    history.push({ role: 'user', parts: [{ text: msgText }] });

    const response = await aiService.current.getAiMentorResponse(history, userProfileRef.current || undefined);
    await addMessage('ai', response?.text || t('ai.fallback'));
    setMatchSuggestions(response?.matches ?? []);

    setIsAiLoading(false);
    // Refresh usage counters after sending
    aiUsage.refresh();
  };

  const handleAiStartIntro = async (match: AiMatchSuggestion) => {
    if (!match?.id) return;
    setPendingIntroUserId(match.id);

    void trackEvent('ai_intro_requested', {
      targetUserId: match.id,
      source: 'ai_nexus_match_card',
    });

    const summary = inputMessage.trim() || t('ai.suggestion1');
    const result = await aiService.current.requestAiIntroduction(match.id, summary);

    if (!result.ok) {
      showToast('error', result.error || t('common.error'));
      setPendingIntroUserId(null);
      return;
    }

    if (result.introPreview) {
      await addMessage('ai', result.introPreview);
    }

    showToast('success', t('common.success'));
    setPendingIntroUserId(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-32 min-h-screen flex flex-col">
      <SEOHead
        title={`${t('ai.title')} - Rootwise`}
        description={t('ai.subtitle')}
        path="/ai-nexus"
      />

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
          ✨
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{t('ai.title')}</h2>
          <p className="text-sm text-slate-500">{t('ai.subtitle')}</p>
        </div>
        {/* AI Usage indicator for free users */}
        {!hasPro && (
          <div className="hidden md:flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <AiUsageBadge
              used={aiUsage.messagesUsed}
              limit={aiUsage.messageLimit}
              label={t('ai.msgsLeft')}
              compact
            />
            <button
              onClick={() => {
                void trackEvent('upgrade_cta_clicked', {
                  source: 'ai_nexus_header_unlimited',
                  feature: 'ai_unlimited',
                });
                setShowUpgrade(true);
              }}
              className="text-xs text-indigo-600 font-bold hover:underline whitespace-nowrap"
            >
              {t('ai.goUnlimited')}
            </button>
          </div>
        )}
        {hasPro && (
          <div className="hidden md:flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full">
            <span className="text-xs text-indigo-600 font-bold">{t('ai.unlimited')}</span>
          </div>
        )}
      </div>

      {/* Usage bar for free users (mobile + desktop) */}
      {!hasPro && (
        <div className="mb-4 p-3 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <AiUsageBadge
            used={aiUsage.messagesUsed}
            limit={aiUsage.messageLimit}
            label={t('ai.messagesTitle')}
          />
          {!aiUsage.canChat && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-red-500 font-medium">{t('ai.dailyLimit')}</span>
              <button
                onClick={() => {
                  void trackEvent('upgrade_cta_clicked', {
                    source: 'ai_nexus_limit_row',
                    feature: 'ai_daily_limit',
                  });
                  setShowUpgrade(true);
                }}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                {t('ai.upgradeToProBtn')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-4">
        <div
          ref={chatScrollRef}
          onScroll={updateChatBottomState}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
                👋
              </div>
              <h4 className="font-bold text-slate-800 mb-2 text-xl">{t('ai.emptyTitle')}</h4>
              <p className="text-slate-500 max-w-sm mx-auto">
                {t('ai.emptySubtitle')}
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto">
                <button
                  onClick={() => setInputMessage(t('ai.suggestion1'))}
                  className="p-4 bg-slate-50 rounded-2xl text-sm hover:bg-indigo-50 transition-colors border border-slate-100 text-left"
                >
                  🌱 {t('ai.suggestion1')}
                </button>
                <button
                  onClick={() => setInputMessage(t('ai.suggestion2'))}
                  className="p-4 bg-slate-50 rounded-2xl text-sm hover:bg-indigo-50 transition-colors border border-slate-100 text-left"
                >
                  💻 {t('ai.suggestion2')}
                </button>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-100 text-slate-800 rounded-tl-none'
                }`}
              >
                <p className="text-sm leading-relaxed">{m.text}</p>
                <p
                  className={`text-[10px] mt-2 opacity-60 ${m.sender === 'user' ? 'text-right' : 'text-left'}`}
                >
                  {formatTime(m.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {isAiLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-.5s]"></div>
              </div>
            </div>
          )}

          {matchSuggestions.length > 0 && (
            <div className="mt-2 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Suggested people to connect with</p>
              {matchSuggestions.map((match) => (
                <div key={match.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-800">{match.name}</p>
                      <p className="text-xs text-slate-500">
                        {match.role || 'Member'} • {match.ageRange}{match.generalLocation ? ` • ${match.generalLocation}` : ''}
                      </p>
                      {match.skills && match.skills.length > 0 && (
                        <p className="text-xs text-slate-600 mt-1">Skills: {match.skills.slice(0, 4).join(', ')}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => navigate(match.profileUrl)}
                        className="px-3 py-2 text-xs rounded-xl border border-slate-300 text-slate-700 hover:bg-white"
                      >
                        View profile
                      </button>
                      <button
                        onClick={() => handleAiStartIntro(match)}
                        disabled={pendingIntroUserId === match.id}
                        className="px-3 py-2 text-xs rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {pendingIntroUserId === match.id ? 'Starting…' : 'AI start contact'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={t('ai.inputPlaceholder')}
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
            <button
              onClick={handleSendMessage}
              disabled={isAiLoading}
              className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature={t('ai.title')}
        requiredPlan="pro"
      />
    </div>
  );
};

export default AiNexusPage;
