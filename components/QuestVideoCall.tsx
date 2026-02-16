import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface QuestVideoCallProps {
  questId: string;
  questTitle: string;
  questSteps: string[];
  userName: string;
  userAvatar?: string;
  onClose: () => void;
}

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
  onClose,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const startTimeRef = useRef(Date.now());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(1);
  const [duration, setDuration] = useState(0);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [showPanel, setShowPanel] = useState(true);
  const [mobileView, setMobileView] = useState<'video' | 'steps'>('video');

  // Deterministic room name from quest ID
  const roomName = `Rootwise_${questId.replace(/-/g, '').slice(0, 16)}`;

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
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(t('videoCall.serviceError')));
        document.head.appendChild(script);
      });
    };

    const initJitsi = async () => {
      try {
        await loadScript();
        if (!mounted || !containerRef.current) return;

        const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
          roomName,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverrides: {
            subject: questTitle,
            prejoinPageEnabled: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableDeepLinking: true,
            enableClosePage: false,
            disableInviteFunctions: true,
            enableCalendarIntegration: false,
            enableNoisyMicDetection: true,
            enableNoAudioDetection: true,
            disableThirdPartyRequests: true,
            notifications: [],
            hideConferenceSubject: false,
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
          setLoading(false);
          startTimeRef.current = Date.now();
        });

        api.addEventListener('participantJoined', () => {
          if (mounted) setParticipantCount((p) => p + 1);
        });

        api.addEventListener('participantLeft', () => {
          if (mounted) setParticipantCount((p) => Math.max(1, p - 1));
        });

        api.addEventListener('videoConferenceLeft', () => {
          if (mounted) onClose();
        });

        api.addEventListener('readyToClose', () => {
          if (mounted) onClose();
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
            onClick={onClose}
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
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
              <div className="text-center px-6">
                <div className="w-14 h-14 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-5" />
                <p className="text-white text-lg font-semibold mb-1">{t('videoCall.connecting')}</p>
                <p className="text-slate-400 text-sm">{t('videoCall.settingUp')}</p>
                <p className="text-slate-500 text-xs mt-4 max-w-xs mx-auto leading-relaxed">
                  {t('videoCall.cameraTip')}
                </p>
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
                        {step}
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
