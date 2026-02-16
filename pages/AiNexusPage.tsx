import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import AiUsageBadge from '../components/AiUsageBadge';
import UpgradeModal from '../components/UpgradeModal';
import { useAuth } from '../context/AuthContext';
import { useChatMessages } from '../hooks/useChatMessages';
import { useAiUsage } from '../hooks/useAiUsage';
import { RootwiseAIService } from '../services/geminiService';
import { isPro } from '../services/planService';

const AiNexusPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { messages, addMessage, fetchMessages } = useChatMessages(profile?.id);
  const aiUsage = useAiUsage();
  const [inputMessage, setInputMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const aiService = useRef(new RootwiseAIService());
  const chatEndRef = useRef<HTMLDivElement>(null);

  const plan = profile?.plan || 'free';
  const hasPro = isPro(plan);

  useEffect(() => {
    if (profile?.id) fetchMessages();
  }, [profile?.id, fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !profile) return;

    // Check if user can send (free plan rate limit)
    if (!hasPro && !aiUsage.canChat) {
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

    const response = await aiService.current.getAiMentorResponse(history);
    await addMessage('ai', response || t('ai.fallback'));

    setIsAiLoading(false);
    // Refresh usage counters after sending
    aiUsage.refresh();
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
              onClick={() => setShowUpgrade(true)}
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
              <button onClick={() => setShowUpgrade(true)} className="text-xs text-indigo-600 font-bold hover:underline">
                {t('ai.upgradeToProBtn')}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-4">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
          <div ref={chatEndRef} />
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
