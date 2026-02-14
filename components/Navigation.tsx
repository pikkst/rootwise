
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getInitials } from '../types';

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

  // Hide nav on landing and auth pages
  if (location.pathname === '/' || location.pathname === '/auth') return null;

  const avatarUrl = profile?.avatar_url || '';
  const userName = profile?.name || user?.email || '';
  const initials = getInitials(userName);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-200 py-3 px-6 md:top-0 md:bottom-auto md:border-b md:border-t-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div
          className="hidden md:flex items-center gap-2 font-bold text-indigo-600 text-xl cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <span>ROOTWISE</span>
        </div>
        <div className="flex items-center gap-2 md:gap-8 justify-center flex-1 md:flex-none md:w-auto">
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
          {/* Mobile profile button */}
          <button
            onClick={() => navigate('/profile')}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-full transition-all md:hidden ${
              location.pathname === '/profile'
                ? 'text-indigo-600 bg-indigo-50 font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="text-xl">👤</span>
            <span className="text-[10px]">Profile</span>
          </button>
        </div>
        <div className="hidden md:flex items-center gap-3">
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
