import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabase';
import { useToast } from '../context/ToastContext';
import { trackEvent } from '../services/analyticsService';

interface QuestVideoCallProps {
  questId: string;
  questTitle: string;
  questSteps: string[];
  userName: string;
  userAvatar?: string;
  rewardXP: number;
  isHost?: boolean;
  userPlan?: string;
  onClose: () => void;
}

/** Render simple markdown (bold, italic) inline */
const renderMarkdown = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  // Match **bold** and *italic*
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={key++} className="font-bold">{match[1]}</strong>);
    } else if (match[2]) {
      parts.push(<em key={key++} className="italic">{match[2]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
};

// Jitsi external API loaded dynamically
declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const QuestVideoCall: React.FC<QuestVideoCallProps> = ({
  questId,
  questTitle,
  questSteps,
  userName,
  userAvatar,
  rewardXP,
  isModerator = false,
  userPlan = 'free',
  onClose,
}) => {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const startTimeRef = useRef(Date.now());
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasJoinedRef = useRef(false);
  const warned60Ref = useRef(false);
  const warned10Ref = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [duration, setDuration] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [showPanel, setShowPanel] = useState(true);
  const [mobileView, setMobileView] = useState<'video' | 'steps'>('video');
  const [cameraWarning, setCameraWarning] = useState<'none' | 'no-camera' | 'no-mic' | 'no-devices'>('none');
  const [showSummary, setShowSummary] = useState(false);
  const [finalDuration, setFinalDuration] = useState(0);
  const [freeTimeLeft, setFreeTimeLeft] = useState<number | null>(null);
  const [showTimesUp, setShowTimesUp] = useState(false);
  const freeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Free users get 5 minutes, Pro/Org/Admin get unlimited
  const isPro = userPlan === 'pro' || userPlan === 'org' || userPlan === 'admin';
  const FREE_CALL_LIMIT = 5 * 60; // 5 minutes in seconds

   // JaaS (Jitsi as a Service) app ID — used for all users (guests or authenticated)
   const JAAS_APP_ID = 'vpaas-magic-cookie-cd11b47983b2480881514268912c6028';

   // Unique room suffix per quest
   const roomSuffix = `Rootwise_${questId.replace(/-/g, '').slice(0, 16)}`;

   // Room name includes app ID prefix for JaaS (same for all participants)
   const roomName = `${JAAS_APP_ID}/${roomSuffix}`;
   const jitsiDomain = '8x8.vc';
   const scriptUrl = 'https://8x8.vc/external_api.js';

  // Load Jitsi Meet External API and initialize
  useEffect(() => {
    let mounted = true;

    const loadScript = (): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (window.JitsiMeetExternalAPI) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(t('videoCall.serviceError')));
        document.head.appendChild(script);
      });
    };

    const initJitsi = async () => {
      try {
        // Detect available media devices before starting
        let hasCamera = false;
        let hasMic = false;
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          hasCamera = devices.some((d) => d.kind === 'videoinput');
          hasMic = devices.some((d) => d.kind === 'audioinput');
        } catch {
          // enumerateDevices not supported — assume both present, Jitsi will handle
          hasCamera = true;
          hasMic = true;
        }

        if (!hasCamera && !hasMic) {
          if (mounted) setCameraWarning('no-devices');
        } else if (!hasCamera) {
          if (mounted) setCameraWarning('no-camera');
        } else if (!hasMic) {
          if (mounted) setCameraWarning('no-mic');
        }

        await loadScript();
        if (!mounted || !containerRef.current) return;

         // Fetch JaaS JWT only for the host (moderator); guests join without token
         let jwt: string | undefined;
         if (isHost) {
           try {
             const { data, error: fnError } = await supabase.functions.invoke('jaas-token', {
               body: {
                 roomName: roomSuffix,
                 userName,
                 userAvatar: userAvatar || '',
                 isModerator: true, // request moderator rights
               },
             });
             if (!fnError) jwt = data?.token;
           } catch {
             // JWT fetch error — continue without auth
           }
         }

        if (!mounted || !containerRef.current) return;

        const api = new window.JitsiMeetExternalAPI(jitsiDomain, {
          roomName,
          ...(jwt ? { jwt } : {}),
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
           configOverrides: {
             subject: questTitle,
             enableLobby: true,
             prejoinPageEnabled: false,
             startWithAudioMuted: !hasMic,
             startWithVideoMuted: !hasCamera,
             disableDeepLinking: true,
             enableClosePage: false,
             disableInviteFunctions: true,
             enableCalendarIntegration: false,
             enableNoisyMicDetection: true,
             enableNoAudioDetection: true,
             disableThirdPartyRequests: true,
             notifications: [],
             hideConferenceSubject: true,
             hideConferenceTimer: true,
             hideParticipantsStats: true,
             remoteVideoMenu: { disableKick: true, disableGrantModerator: true },
           },
          interfaceConfigOverrides: {
            TOOLBAR_BUTTONS: [
              'microphone',
              'camera',
              'desktop',
              'fullscreen',
              'hangup',
              'chat',
              'tileview',
              'raisehand',
              'participants-pane',
              'settings',
            ],
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            SHOW_POWERED_BY: false,
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
            TOOLBAR_ALWAYS_VISIBLE: true,
            SHOW_CHROME_EXTENSION_BANNER: false,
            DEFAULT_BACKGROUND: '#0f172a',
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
          },
          userInfo: {
            displayName: userName,
          },
        });

        apiRef.current = api;

        api.addEventListener('videoConferenceJoined', () => {
          if (!mounted) return;
          hasJoinedRef.current = true;
          setLoading(false);
          startTimeRef.current = Date.now();
          if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);

          // Start 5-minute countdown for free users
          if (!isPro) {
            setFreeTimeLeft(FREE_CALL_LIMIT);
            warned60Ref.current = false;
            warned10Ref.current = false;
            freeTimerRef.current = setInterval(() => {
              if (!mounted) return;
              const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
              const remaining = Math.max(0, FREE_CALL_LIMIT - elapsed);
              setFreeTimeLeft(remaining);

              // Toast warning: 1 minute left
              if (remaining <= 60 && !warned60Ref.current) {
                warned60Ref.current = true;
                showToast('info', t('videoCall.toast60s'));
              }
              // Toast warning: 10 seconds left
              if (remaining <= 10 && !warned10Ref.current) {
                warned10Ref.current = true;
                showToast('error', t('videoCall.toast10s'));
              }

              if (remaining <= 0) {
                if (freeTimerRef.current) clearInterval(freeTimerRef.current);
                // Track for hot-lead detection — user hit the paywall
                void trackEvent('video_limit_reached', {
                  questId,
                  questTitle,
                });
                // Dispose Jitsi, then show Time's Up modal (not raw summary)
                if (apiRef.current) {
                  apiRef.current.dispose();
                  apiRef.current = null;
                }
                setFinalDuration(FREE_CALL_LIMIT);
                setShowTimesUp(true);
              }
            }, 1000);
          }
        });

        // Fallback: if videoConferenceJoined never fires (e.g. Jitsi shows its own
        // lobby or permission dialog inside the iframe), hide our overlay after 8s
        // so the user can interact with the Jitsi iframe directly.
        fallbackTimerRef.current = setTimeout(() => {
          if (mounted) {
            setLoading(false);
          }
        }, 8000);

        api.addEventListener('participantJoined', () => {
          if (mounted) setParticipantCount((p) => p + 1);
        });

        api.addEventListener('participantLeft', () => {
          if (mounted) setParticipantCount((p) => Math.max(1, p - 1));
        });

        // Only show summary if user actually joined a conference.
        // Jitsi fires videoConferenceLeft during lobby/moderator auth transitions
        // (e.g. clicking "I am the host") — we must ignore those.
        api.addEventListener('videoConferenceLeft', () => {
          if (!mounted) return;
          if (hasJoinedRef.current) {
            setFinalDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            setShowSummary(true);
          }
          // If not joined yet, it's a lobby transition — ignore it
        });

        api.addEventListener('readyToClose', () => {
          if (!mounted) return;
          if (hasJoinedRef.current) {
            setFinalDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
            setShowSummary(true);
          } else {
            // User closed Jitsi before joining — just close the overlay
            onClose();
          }
        });

        // Set avatar
        if (userAvatar) {
          api.executeCommand('avatarUrl', userAvatar);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || t('videoCall.startError'));
          setLoading(false);
        }
      }
    };

    initJitsi();

    return () => {
      mounted = false;
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (freeTimerRef.current) clearInterval(freeTimerRef.current);
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, []);

  // Duration timer
  useEffect(() => {
    if (loading || error) return;
    const iv = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [loading, error]);

  // Format seconds to mm:ss or h:mm:ss
  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const toggleStep = (idx: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-900/95 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center shadow-2xl">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">{t('videoCall.unavailableTitle')}</h2>
          <p className="text-slate-500 text-sm mb-6 leading-relaxed">{error}</p>
          <p className="text-xs text-slate-400 mb-6">
            {t('videoCall.unavailableDesc')}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition text-base"
          >
            {t('goBack')}
          </button>
        </div>
      </div>
    );
  }

  const stepsProgress = questSteps.length > 0 ? Math.round((checkedSteps.size / questSteps.length) * 100) : 0;

  // Handle leave: dispose Jitsi and show summary
  const handleLeave = () => {
    setFinalDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    if (apiRef.current) {
      apiRef.current.dispose();
      apiRef.current = null;
    }
    setShowSummary(true);
  };

  // Time's Up modal — shown when free 5-min limit expires
  if (showTimesUp) {
    return (
      <div className="fixed inset-0 z-[60] bg-gradient-to-b from-slate-900 to-indigo-950 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 sm:p-10 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-indigo-400/10 rounded-full blur-3xl -translate-y-28 translate-x-28" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl translate-y-20 -translate-x-20" />

          <div className="relative z-10">
            <div className="text-6xl mb-3">🚀</div>

            <h2 className="text-2xl font-black text-slate-800 mb-2">
              {t('videoCall.timesUpTitle')}
            </h2>
            <p className="text-indigo-600 font-semibold text-sm mb-4">
              {t('videoCall.timesUpSubtitle', { quest: questTitle })}
            </p>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed">
              {t('videoCall.timesUpDesc')}
            </p>

            {/* Primary CTA — psychologically strongest moment to convert */}
            <a
              href="/pricing"
              onClick={() => void trackEvent('upgrade_cta_clicked', { source: 'times_up_modal', questId })}
              className="block w-full px-6 py-4 mb-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-2xl hover:opacity-90 transition text-base shadow-xl shadow-indigo-500/30"
            >
              ⭐ {t('videoCall.timesUpCta')}
            </a>

            <button
              onClick={() => { setShowTimesUp(false); setShowSummary(true); }}
              className="w-full px-6 py-3 text-slate-500 font-medium rounded-2xl border border-slate-200 hover:bg-slate-50 transition text-sm"
            >
              {t('videoCall.timesUpViewSummary')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Post-call summary screen
  if (showSummary) {
    return (
      <div className="fixed inset-0 z-[60] bg-slate-900/95 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 sm:p-10 max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl -translate-y-20 translate-x-20" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl translate-y-16 -translate-x-16" />

          <div className="relative z-10">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-slate-800 mb-2">
              {t('videoCall.summaryTitle')}
            </h2>
            <p className="text-slate-500 text-sm mb-8">
              {t('videoCall.summaryDesc', { quest: questTitle })}
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-2xl font-black text-indigo-600">
                  {formatDuration(finalDuration)}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  {t('videoCall.summaryDuration')}
                </p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-2xl font-black text-emerald-600">
                  {checkedSteps.size}/{questSteps.length}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  {t('videoCall.summarySteps')}
                </p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4">
                <p className="text-2xl font-black text-amber-500">
                  {rewardXP}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  XP
                </p>
              </div>
            </div>

            {checkedSteps.size === questSteps.length && questSteps.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-6">
                <p className="text-emerald-700 font-bold text-sm">
                  ✅ {t('videoCall.summaryAllComplete')}
                </p>
              </div>
            )}

            {!isPro && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 mb-6">
                <p className="text-indigo-700 font-bold text-sm mb-1">
                  ⭐ {t('videoCall.freeCallEnded')}
                </p>
                <p className="text-indigo-600 text-xs mb-3">{t('videoCall.upgradeForUnlimited')}</p>
                <a
                  href="/pricing"
                  className="inline-block px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition"
                >
                  {t('videoCall.upgradePro')}
                </a>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full px-6 py-4 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition text-base shadow-xl shadow-indigo-600/20"
            >
              {t('videoCall.summaryClose')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900 flex flex-col">
      {/* ─── Top Bar ─── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-5 py-2.5 bg-slate-800 text-white border-b border-slate-700">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-sm font-semibold truncate max-w-[180px] sm:max-w-none">
            📹 {questTitle}
          </span>
          {!loading && (
            <>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                {formatDuration(duration)}
              </span>
              <span className="text-xs text-slate-400 hidden sm:inline">
                · {participantCount} 👤
              </span>
              <span className="text-xs font-bold text-amber-400 hidden sm:inline">
                · ⭐ {rewardXP} XP
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Desktop panel toggle */}
          {questSteps.length > 0 && (
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 rounded-lg transition hidden sm:flex items-center gap-1"
            >
              📋 {showPanel ? t('videoCall.hideSteps') : t('videoCall.showSteps')}
            </button>
          )}
          <button
            onClick={handleLeave}
            className="px-3 sm:px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-500 rounded-lg transition"
          >
            ✕ {t('videoCall.leave')}
          </button>
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
        {/* Video container */}
        <div
          className={`flex-1 relative min-h-0 ${
            mobileView === 'steps' ? 'hidden sm:block' : ''
          }`}
        >
          {/* Camera / Mic warning banner */}
          {cameraWarning !== 'none' && !loading && (
            <div className="absolute top-0 left-0 right-0 z-20 px-3 py-2.5 bg-amber-500/95 text-white text-sm flex items-center justify-between gap-2 shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">
                  {cameraWarning === 'no-camera' ? '📷' : cameraWarning === 'no-mic' ? '🎤' : '⚠️'}
                </span>
                <span className="font-medium leading-snug">
                  {cameraWarning === 'no-camera' && t('videoCall.noCameraNotice')}
                  {cameraWarning === 'no-mic' && t('videoCall.noMicNotice')}
                  {cameraWarning === 'no-devices' && t('videoCall.noDevicesNotice')}
                </span>
              </div>
              <button
                onClick={() => setCameraWarning('none')}
                className="flex-shrink-0 px-2 py-1 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                ✕
              </button>
            </div>
          )}

          {/* Free user time limit banner */}
          {!isPro && freeTimeLeft !== null && !loading && (
            <div className={`absolute ${cameraWarning !== 'none' ? 'top-12' : 'top-0'} left-0 right-0 z-20 px-3 py-2.5 ${
              freeTimeLeft <= 60
                ? 'bg-red-600/95 animate-pulse'
                : freeTimeLeft <= 120
                ? 'bg-amber-600/95'
                : 'bg-indigo-600/90'
            } text-white text-sm flex items-center justify-between gap-2 shadow-lg backdrop-blur-sm`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">⏱️</span>
                <span className="font-medium leading-snug">
                  {freeTimeLeft <= 0
                    ? t('videoCall.freeTimeUp')
                    : t('videoCall.freeTimeRemaining', { time: formatDuration(freeTimeLeft) })}
                </span>
              </div>
              <a
                href="/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-3 py-1 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                ⭐ {t('videoCall.upgradePro')}
              </a>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 z-10 backdrop-blur-sm">
              <div className="text-center px-6">
                <div className="w-14 h-14 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-5" />
                <p className="text-white text-lg font-semibold mb-1">{t('videoCall.connecting')}</p>
                <p className="text-slate-400 text-sm">{t('videoCall.settingUp')}</p>
                <p className="text-slate-500 text-xs mt-4 max-w-xs mx-auto leading-relaxed">
                  {cameraWarning === 'no-camera'
                    ? t('videoCall.connectingNoCamera')
                    : cameraWarning === 'no-devices'
                    ? t('videoCall.connectingNoDevices')
                    : t('videoCall.cameraTip')}
                </p>
                <button
                  onClick={() => { setLoading(false); startTimeRef.current = Date.now(); }}
                  className="mt-6 px-4 py-2 text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 rounded-lg transition"
                >
                  {t('videoCall.skipLoading')}
                </button>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* ─── Quest Steps Panel (desktop sidebar / mobile full view) ─── */}
        {questSteps.length > 0 && (showPanel || mobileView === 'steps') && (
          <div
            className={`bg-white border-t sm:border-t-0 sm:border-l border-slate-200 overflow-y-auto ${
              mobileView === 'steps'
                ? 'flex-1 sm:flex-none sm:w-80'
                : 'hidden sm:block sm:w-80'
            }`}
          >
            <div className="p-4 sm:p-5">
              {/* Panel header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  📋 {t('videoCall.questSteps')}
                </h3>
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                  {checkedSteps.size}/{questSteps.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                {t('videoCall.stepsHint')} {t('videoCall.personalTracker')}
              </p>

              {/* Steps list */}
              <ol className="space-y-2.5">
                {questSteps.map((step, idx) => (
                  <li key={idx}>
                    <button
                      onClick={() => toggleStep(idx)}
                      className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl transition-all ${
                        checkedSteps.has(idx)
                          ? 'bg-emerald-50 border-2 border-emerald-300'
                          : 'bg-slate-50 border-2 border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/40'
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 transition-colors ${
                          checkedSteps.has(idx)
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {checkedSteps.has(idx) ? '✓' : idx + 1}
                      </span>
                      <span
                        className={`text-sm leading-snug ${
                          checkedSteps.has(idx)
                            ? 'text-emerald-700 line-through'
                            : 'text-slate-700'
                        }`}
                      >
                        {renderMarkdown(step)}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>

              {/* Progress bar */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-500 font-medium">{t('videoCall.progress')}</span>
                  <span className="font-bold text-slate-700">{stepsProgress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${stepsProgress}%` }}
                  />
                </div>
              </div>

              {/* Completion celebration */}
              {checkedSteps.size === questSteps.length && questSteps.length > 0 && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <p className="text-emerald-700 font-bold text-sm">🎉 {t('videoCall.allComplete')}</p>
                  <p className="text-emerald-600 text-xs mt-1">{t('videoCall.greatTeamwork')}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Mobile bottom bar: toggle between video & steps ─── */}
      {questSteps.length > 0 && (
        <div className="sm:hidden bg-white border-t border-slate-200 px-4 py-2.5 flex-shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setMobileView('video')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition ${
                mobileView === 'video'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              📹 {t('videoCall.tabVideo')}
            </button>
            <button
              onClick={() => setMobileView('steps')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-xl transition ${
                mobileView === 'steps'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              📋 {t('videoCall.tabSteps')} ({checkedSteps.size}/{questSteps.length})
            </button>
          </div>
        </div>
      )}

      {/* ─── Mobile duration/participant info bar ─── */}
      {!loading && (
        <div className="sm:hidden bg-slate-800 text-white px-4 py-1.5 text-center text-xs text-slate-400 flex-shrink-0">
          {formatDuration(duration)} · {participantCount} {participantCount !== 1 ? t('videoCall.participants') : t('videoCall.participant')}
        </div>
      )}
    </div>
  );
};

export default QuestVideoCall;
