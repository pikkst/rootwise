import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLocalePath } from '../hooks/useLocalePath';
import { useNotifications } from '../hooks/useNotifications';

const NotificationBell: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const lp = useLocalePath();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeIcon = (type: string): string => {
    switch (type) {
      case 'proof_approved': return '✅';
      case 'proof_rejected': return '🔄';
      case 'proof_submitted': return '📝';
      case 'quest_completed': return '🏆';
      default: return '🔔';
    }
  };

  const timeAgo = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('notifications.justNow');
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
        aria-label={t('notifications.bell')}
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 max-h-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-slide-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h4 className="font-bold text-sm text-slate-800">{t('notifications.title')}</h4>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="overflow-y-auto max-h-80 divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                {t('notifications.empty')}
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    markAsRead(n.id);
                    if (n.link) {
                      navigate(lp(n.link));
                    }
                    setOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition flex gap-3 items-start ${
                    !n.read ? 'bg-indigo-50/50' : ''
                  }`}
                >
                  <span className="text-lg mt-0.5">{typeIcon(n.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.read ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.read && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
