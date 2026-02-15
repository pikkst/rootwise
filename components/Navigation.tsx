
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../types';
import { isPro, isOrg, BETA_MODE } from '../services/planService';
import PlanBadge from './PlanBadge';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { path: '/quests', label: 'Quests', icon: '📜' },
  { path: '/community', label: 'Community', icon: '🤝' },
  { path: '/ai-nexus', label: 'Nexus AI', icon: '✨' },
];

const Navigation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Hide nav on landing and auth pages
  if (location.pathname === '/' || location.pathname === '/auth') return null;

  // Derived values from profile
  const plan = profile?.plan || 'free';
  const hasPro = isPro(plan);
  const hasOrg = isOrg(plan);
  const userName = profile?.name || 'User';
  const initials = profile ? getInitials(profile.name) : '??';
  const avatarUrl = profile?.avatar_url || '';

  // Pro/Org nav items for "More" menu
  const moreItems = [
    { path: '/analytics', label: 'Analytics', icon: '📊', requiresPro: true },
    { path: '/matching', label: 'Matching', icon: '🔗', requiresPro: true },
    { path: '/admin', label: 'Admin', icon: '👑', requiresOrg: true },
    { path: '/pricing', label: 'Pricing', icon: '💎', requiresPro: false, requiresOrg: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 px-6 md:top-0 md:bottom-auto md:border-b md:border-t-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div
          className="hidden md:flex items-center gap-2 font-bold text-indigo-600 text-xl cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <span>ROOTWISE</span>
        </div>
        <div className="flex items-center gap-2 md:gap-6 justify-center flex-1 md:flex-none md:w-auto">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-1 rounded-full transition-all ${
                location.pathname === item.path
                  ? 'text-indigo-600 bg-indigo-50 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="text-xl md:text-base">{item.icon}</span>
              <span className="text-[10px] md:text-sm">{item.label}</span>
            </button>
          ))}

          {/* More menu (desktop) — shows Pro/Org features */}
          <div className="hidden md:block relative" ref={moreRef}>
            <button
              onClick={() => setShowMore(!showMore)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full transition-all ${
                ['/analytics', '/matching', '/admin'].includes(location.pathname)
                  ? 'text-indigo-600 bg-indigo-50 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="text-base">⋯</span>
              <span className="text-sm">More</span>
            </button>
            {showMore && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50">
                {moreItems.map((item) => {
                  const locked = (item.requiresPro && !hasPro) || (item.requiresOrg && !hasOrg);
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        navigate(item.path);
                        setShowMore(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                        location.pathname === item.path
                          ? 'bg-indigo-50 text-indigo-600 font-bold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                      {locked && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded-full font-bold">
                          {item.requiresOrg ? 'ORG' : 'PRO'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mobile profile + more */}
          <button
            onClick={() => navigate('/profile')}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-full transition-all md:hidden ${
              location.pathname === '/profile'
                ? 'text-indigo-600 bg-indigo-50 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-xl">👤</span>
            <span className="text-[10px]">More</span>
          </button>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <PlanBadge plan={plan} isBeta={BETA_MODE} size="sm" />
          <button
            onClick={() => navigate('/profile')}
            className={`w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden border-2 transition-all ${
              location.pathname === '/profile'
                ? 'border-indigo-600 ring-2 ring-indigo-100'
                : 'border-transparent'
            }`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </button>
          {user && (
            <button
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium"
              title="Sign out"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
