import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../services/supabase';
import { RootwiseAIService } from '../services/geminiService';
import { isPro } from '../services/planService';
import { getInitials, Profile } from '../types';
import { formatDateTime } from '../utils/formatDate';
import { useLocalePath } from '../hooks/useLocalePath';

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read: boolean;
  sender_deleted: boolean;
  recipient_deleted: boolean;
  created_at: string;
};

type Thread = {
  userId: string;
  profile: Pick<Profile, 'id' | 'name' | 'avatar_url' | 'role' | 'preferred_language'>;
  lastMessageAt: string;
  lastMessageText: string;
  unreadCount: number;
};

const MessagesPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const lp = useLocalePath();
  const aiService = useRef(new RootwiseAIService());

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Pick<Profile, 'id' | 'name' | 'avatar_url' | 'role' | 'preferred_language'>>>({});
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [useAiMediator, setUseAiMediator] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [translatedIncomingById, setTranslatedIncomingById] = useState<Record<string, string>>({});
  const [translatingIncomingById, setTranslatingIncomingById] = useState<Record<string, boolean>>({});
  const incomingTranslationInFlight = useRef(new Set<string>());
  const canUseAiTranslate = isPro(profile?.plan || 'free');

  const queryUserId = useMemo(() => new URLSearchParams(location.search).get('user'), [location.search]);

  const visibleMessages = useMemo(() => {
    if (!profile?.id) return [];
    return messages.filter((m) => {
      if (m.sender_id === profile.id) return !m.sender_deleted;
      if (m.recipient_id === profile.id) return !m.recipient_deleted;
      return false;
    });
  }, [messages, profile?.id]);

  const threads = useMemo<Thread[]>(() => {
    if (!profile?.id) return [];

    const map: Record<string, Thread> = {};

    visibleMessages.forEach((m) => {
      const otherId = m.sender_id === profile.id ? m.recipient_id : m.sender_id;
      const otherProfile = profilesById[otherId];
      if (!otherProfile) return;

      if (!map[otherId]) {
        map[otherId] = {
          userId: otherId,
          profile: otherProfile,
          lastMessageAt: m.created_at,
          lastMessageText: m.body,
          unreadCount: m.recipient_id === profile.id && !m.read ? 1 : 0,
        };
        return;
      }

      if (new Date(m.created_at).getTime() > new Date(map[otherId].lastMessageAt).getTime()) {
        map[otherId].lastMessageAt = m.created_at;
        map[otherId].lastMessageText = m.body;
      }

      if (m.recipient_id === profile.id && !m.read) {
        map[otherId].unreadCount += 1;
      }
    });

    return Object.values(map).sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [profile?.id, profilesById, visibleMessages]);

  const activeThreadMessages = useMemo(() => {
    if (!profile?.id || !activeUserId) return [];
    return visibleMessages
      .filter((m) => {
        const fromActive = m.sender_id === activeUserId && m.recipient_id === profile.id;
        const toActive = m.sender_id === profile.id && m.recipient_id === activeUserId;
        return fromActive || toActive;
      })
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [activeUserId, profile?.id, visibleMessages]);

  const activeProfile = activeUserId ? profilesById[activeUserId] : null;

  const fetchMessages = async () => {
    if (!profile?.id) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('direct_messages')
      .select('id, sender_id, recipient_id, body, read, sender_deleted, recipient_deleted, created_at')
      .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
      .order('created_at', { ascending: true })
      .limit(500);

    if (error) {
      showToast('error', error.message);
      setLoading(false);
      return;
    }

    const rows = (data as DirectMessage[] | null) ?? [];
    setMessages(rows);

    const counterpartIds = Array.from(new Set(rows.flatMap((m) => [m.sender_id, m.recipient_id]).filter((id) => id !== profile.id)));
    if (counterpartIds.length > 0) {
      const { data: people } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, role, preferred_language')
        .in('id', counterpartIds);

      const map: Record<string, Pick<Profile, 'id' | 'name' | 'avatar_url' | 'role' | 'preferred_language'>> = {};
      (people as Pick<Profile, 'id' | 'name' | 'avatar_url' | 'role' | 'preferred_language'>[] | null)?.forEach((p) => {
        map[p.id] = p;
      });
      setProfilesById(map);
    } else {
      setProfilesById({});
    }

    setLoading(false);
  };

  const markThreadRead = async (otherUserId: string) => {
    if (!profile?.id) return;

    await supabase
      .from('direct_messages')
      .update({ read: true })
      .eq('sender_id', otherUserId)
      .eq('recipient_id', profile.id)
      .eq('read', false);

    setMessages((prev) => prev.map((m) => (
      m.sender_id === otherUserId && m.recipient_id === profile.id ? { ...m, read: true } : m
    )));
  };

  const openThread = async (otherUserId: string) => {
    setActiveUserId(otherUserId);
    await markThreadRead(otherUserId);
    navigate(lp(`/messages?user=${otherUserId}`), { replace: true });
  };

  const sendMessage = async () => {
    if (!profile?.id || !activeUserId) return;
    const rawDraft = draft.trim();
    if (!rawDraft) return;
    let body = rawDraft;

    setSending(true);

    if (useAiMediator) {
      if (!canUseAiTranslate) {
        showToast('info', t('messages.aiLockedFriendly', { defaultValue: 'AI auto-translate is available on Pro, Org, and Admin plans to keep API costs balanced.' }));
        navigate(lp('/pricing'));
        setSending(false);
        return;
      }
      setAiWorking(true);
      const mediated = await aiService.current.generateMediatedMessage({
        senderName: profile.name || t('common.user'),
        senderLanguage: profile.preferred_language,
        recipientName: activeProfile?.name || t('common.user'),
        recipientLanguage: activeProfile?.preferred_language,
        draft: rawDraft,
        recentConversation: activeThreadMessages.map((m) => ({
          from: m.sender_id === profile.id ? 'me' : 'them',
          text: m.body,
        })),
      });
      if (mediated.error) {
        showToast('error', mediated.error);
      }
      body = mediated.text?.trim() || rawDraft;
      setAiWorking(false);
    }

    const { data, error } = await supabase
      .from('direct_messages')
      .insert({
        sender_id: profile.id,
        recipient_id: activeUserId,
        body,
      })
      .select('id, sender_id, recipient_id, body, read, sender_deleted, recipient_deleted, created_at')
      .single();

    if (error) {
      showToast('error', error.message);
      setSending(false);
      return;
    }

    const inserted = data as DirectMessage;
    setMessages((prev) => [...prev, inserted]);
    setDraft('');

    const senderName = profile.name || t('common.user');
    await supabase.from('notifications').insert({
      user_id: activeUserId,
      type: 'direct_message',
      title: t('messages.notificationTitle', { defaultValue: 'Uus sõnum' }),
      body: t('messages.notificationBody', { defaultValue: '{{name}} saatis sulle sõnumi', name: senderName }),
      link: `/messages?user=${profile.id}`,
      read: false,
    });

    setSending(false);
  };

  const handleAiDraft = async () => {
    if (!profile?.id || !activeUserId) return;
    if (!canUseAiTranslate) {
      showToast('info', t('messages.aiLockedFriendly', { defaultValue: 'AI auto-translate is available on Pro, Org, and Admin plans to keep API costs balanced.' }));
      navigate(lp('/pricing'));
      return;
    }
    const rawDraft = draft.trim();
    if (!rawDraft) return;

    setAiWorking(true);
    const mediated = await aiService.current.generateMediatedMessage({
      senderName: profile.name || t('common.user'),
      senderLanguage: profile.preferred_language,
      recipientName: activeProfile?.name || t('common.user'),
      recipientLanguage: activeProfile?.preferred_language,
      draft: rawDraft,
      recentConversation: activeThreadMessages.map((m) => ({
        from: m.sender_id === profile.id ? 'me' : 'them',
        text: m.body,
      })),
    });
    setAiWorking(false);

    if (mediated.error) {
      showToast('error', mediated.error);
      return;
    }

    if (mediated.text?.trim()) {
      setDraft(mediated.text.trim());
    }
  };

  const deleteMessage = async (msg: DirectMessage) => {
    if (!profile?.id) return;

    const isSender = msg.sender_id === profile.id;
    const field = isSender ? 'sender_deleted' : 'recipient_deleted';

    const { error } = await supabase
      .from('direct_messages')
      .update({ [field]: true })
      .eq('id', msg.id);

    if (error) {
      showToast('error', error.message);
      return;
    }

    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, [field]: true } : m)));
  };

  useEffect(() => {
    if (!profile?.id) return;
    void fetchMessages();

    const channel = supabase
      .channel(`direct-messages-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `recipient_id=eq.${profile.id}`,
        },
        (payload) => {
          const incoming = payload.new as DirectMessage;
          setMessages((prev) => [...prev, incoming]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!queryUserId) return;
    if (!profilesById[queryUserId]) return;
    void openThread(queryUserId);
  }, [queryUserId, profilesById]);

  useEffect(() => {
    if (!useAiMediator || !canUseAiTranslate || !profile?.id || !activeUserId || !activeProfile) return;

    const incomingToTranslate = activeThreadMessages
      .filter((m) => m.sender_id === activeUserId)
      .filter((m) => !translatedIncomingById[m.id])
      .filter((m) => !incomingTranslationInFlight.current.has(m.id))
      .slice(-12);

    if (incomingToTranslate.length === 0) return;

    const translateIncoming = async () => {
      for (const message of incomingToTranslate) {
        incomingTranslationInFlight.current.add(message.id);
        setTranslatingIncomingById((prev) => ({ ...prev, [message.id]: true }));

        const mediated = await aiService.current.generateMediatedMessage({
          senderName: activeProfile.name || t('common.user'),
          senderLanguage: activeProfile.preferred_language,
          recipientName: profile.name || t('common.user'),
          recipientLanguage: profile.preferred_language,
          draft: message.body,
          recentConversation: activeThreadMessages.map((m) => ({
            from: m.sender_id === profile.id ? 'them' : 'me',
            text: m.body,
          })),
        });

        setTranslatedIncomingById((prev) => ({
          ...prev,
          [message.id]: mediated.text?.trim() || message.body,
        }));

        if (mediated.error) {
          showToast('error', mediated.error);
        }

        incomingTranslationInFlight.current.delete(message.id);
        setTranslatingIncomingById((prev) => {
          const next = { ...prev };
          delete next[message.id];
          return next;
        });
      }
    };

    void translateIncoming();
  }, [
    useAiMediator,
    profile?.id,
    profile?.name,
    profile?.preferred_language,
    activeUserId,
    activeProfile,
    activeThreadMessages,
    translatedIncomingById,
    showToast,
    t,
    canUseAiTranslate,
  ]);

  useEffect(() => {
    if (canUseAiTranslate) return;
    if (useAiMediator) setUseAiMediator(false);
  }, [canUseAiTranslate, useAiMediator]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-28 md:pb-20">
      <SEOHead
        title={t('messages.title', { defaultValue: 'Sõnumid - Rootwise' })}
        description={t('messages.seoDesc', { defaultValue: 'Saada ja halda privaatseid sõnumeid.' })}
        path="/messages"
      />

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[70vh] grid grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside className="border-r border-slate-100">
          <div className="p-4 border-b border-slate-100">
            <h1 className="font-bold text-slate-800">{t('messages.inbox', { defaultValue: 'Postkast' })}</h1>
          </div>

          <div className="divide-y divide-slate-100 max-h-[70vh] overflow-y-auto">
            {loading && (
              <div className="p-4 text-sm text-slate-400">{t('common.loading')}</div>
            )}
            {!loading && threads.length === 0 && (
              <div className="p-4 text-sm text-slate-400">{t('messages.empty', { defaultValue: 'Sõnumeid veel pole.' })}</div>
            )}
            {threads.map((thread) => (
              <button
                key={thread.userId}
                onClick={() => void openThread(thread.userId)}
                className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${activeUserId === thread.userId ? 'bg-indigo-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center overflow-hidden">
                    {thread.profile.avatar_url ? (
                      <img src={thread.profile.avatar_url} alt={thread.profile.name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(thread.profile.name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-slate-800 truncate">{thread.profile.name}</p>
                      {thread.unreadCount > 0 && (
                        <span className="text-[10px] font-bold bg-indigo-600 text-white rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">{thread.lastMessageText}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex flex-col min-h-[70vh]">
          {activeProfile ? (
            <>
              <div className="p-4 border-b border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold flex items-center justify-center overflow-hidden">
                  {activeProfile.avatar_url ? (
                    <img src={activeProfile.avatar_url} alt={activeProfile.name} className="w-full h-full object-cover" />
                  ) : (
                    getInitials(activeProfile.name)
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{activeProfile.name}</p>
                  <p className="text-xs text-slate-400">{activeProfile.role}</p>
                </div>
              </div>

              <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[52vh]">
                {activeThreadMessages.length === 0 && (
                  <p className="text-sm text-slate-400">{t('messages.noConversation', { defaultValue: 'Vestlus puudub. Saada esimene sõnum.' })}</p>
                )}
                {activeThreadMessages.map((m) => {
                  const mine = m.sender_id === profile?.id;
                  const translatedIncoming = !mine ? translatedIncomingById[m.id] : null;
                  const isTranslatingIncoming = !mine && !!translatingIncomingById[m.id];
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        {!mine && useAiMediator && isTranslatingIncoming && (
                          <p className="whitespace-pre-wrap mt-2 pt-2 border-t border-slate-200 text-slate-400 text-xs">
                            {t('messages.aiTranslating', { defaultValue: 'AI translating…' })}
                          </p>
                        )}
                        {!mine && useAiMediator && translatedIncoming && translatedIncoming !== m.body && (
                          <p className="whitespace-pre-wrap mt-2 pt-2 border-t border-slate-200 text-slate-600 text-xs">
                            {t('messages.aiTranslationPrefix', { defaultValue: 'AI translation:' })} {translatedIncoming}
                          </p>
                        )}
                        <div className={`text-[10px] mt-1 flex items-center justify-between gap-2 ${mine ? 'text-indigo-100' : 'text-slate-400'}`}>
                          <span>{formatDateTime(m.created_at)}</span>
                          <button
                            onClick={() => void deleteMessage(m)}
                            className={`${mine ? 'text-indigo-100 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 border-t border-slate-100 flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={2}
                    placeholder={t('messages.placeholder', { defaultValue: 'Kirjuta sõnum...' })}
                    className="w-full resize-none border border-slate-200 rounded-2xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={useAiMediator}
                        onChange={(e) => {
                          if (!canUseAiTranslate) {
                            showToast('info', t('messages.aiLockedFriendly', { defaultValue: 'AI auto-translate is available on Pro, Org, and Admin plans to keep API costs balanced.' }));
                            navigate(lp('/pricing'));
                            return;
                          }
                          setUseAiMediator(e.target.checked);
                        }}
                        disabled={sending || aiWorking}
                      />
                      {t('messages.aiMediator', { defaultValue: 'AI mediator (translate + culture-aware)' })}
                      <span className="px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 font-bold text-[10px]">
                        {t('messages.aiTierFlag', { defaultValue: 'PRO+' })}
                      </span>
                    </label>
                    <button
                      onClick={() => void handleAiDraft()}
                      disabled={sending || aiWorking || !draft.trim()}
                      className="px-3 py-1.5 rounded-xl bg-violet-50 text-violet-700 font-bold text-xs disabled:opacity-50"
                    >
                      {aiWorking
                        ? t('common.processing')
                        : t('messages.aiDraft', { defaultValue: 'AI draft' })}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => void sendMessage()}
                  disabled={sending || aiWorking || !draft.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-50"
                >
                  {sending
                    ? t('common.sending')
                    : useAiMediator
                      ? t('messages.sendWithAi', { defaultValue: 'Send via AI' })
                      : t('common.send')}
                </button>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-sm p-6">
              {t('messages.selectThread', { defaultValue: 'Vali vasakult vestlus või ava profiililt “Saada sõnum”.' })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MessagesPage;
