import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '../i18n';

interface Props {
  compact?: boolean;   // navbar mode — smaller trigger
  footer?: boolean;    // footer mode — upward dropdown
  upward?: boolean;    // force upward dropdown on desktop
}

const LanguageSelector: React.FC<Props> = ({ compact = false, footer = false, upward = false }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const LANG_CODES = new Set(SUPPORTED_LANGUAGES.map(l => l.code));
  const openUpward = footer || upward;

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language) 
    || SUPPORTED_LANGUAGES.find(l => i18n.language.startsWith(l.code))
    || SUPPORTED_LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onResize = () => setIsMobile(window.innerWidth < 640);
    onResize();

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const changeLanguage = (code: LanguageCode) => {
    i18n.changeLanguage(code);
    localStorage.setItem('rootwise_language', code);
    document.documentElement.lang = code;
    setOpen(false);

    // Update URL to reflect new language
    const pathSegments = location.pathname.split('/');
    // Strip existing lang prefix if present
    if (pathSegments[1] && LANG_CODES.has(pathSegments[1])) {
      pathSegments.splice(1, 1);
    }
    const barePath = pathSegments.join('/') || '/';
    const newPath = code === 'en' ? barePath : `/${code}${barePath === '/' ? '' : barePath}`;
    navigate(newPath + location.search + location.hash, { replace: true });
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button — globe icon */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-xl transition-all ${
          compact 
            ? 'px-2 py-1.5 text-sm hover:bg-slate-100' 
            : 'px-3 py-2 text-sm border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 bg-white'
        }`}
        aria-label="Select language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="text-base" role="img" aria-hidden="true">🌐</span>
        <span className={compact ? 'hidden sm:inline font-medium text-xs' : 'font-medium'}>
          {currentLang.name}
        </span>
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Language panel */}
      {open && (
        <>
          {isMobile && createPortal(
            <>
              <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setOpen(false)} />
              <div
                role="listbox"
                aria-label="Languages"
                className="fixed bottom-0 left-0 right-0 z-50 bg-white border border-slate-200 shadow-2xl overflow-hidden rounded-t-3xl p-4 pb-8"
              >
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 rounded-full bg-slate-300" />
                </div>
                <p className="text-center text-sm font-semibold text-slate-500 mb-3">
                  🌐 Choose language
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {SUPPORTED_LANGUAGES.map(lang => {
                    const isActive = currentLang.code === lang.code;
                    return (
                      <button
                        key={lang.code}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => changeLanguage(lang.code)}
                        className={`
                          flex items-center gap-2 px-3 py-3 rounded-xl text-left transition-all
                          ${isActive
                            ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200 font-bold'
                            : 'text-slate-700 hover:bg-slate-50 active:bg-indigo-50'
                          }
                        `}
                      >
                        <span className="text-xl" role="img" aria-hidden="true">{lang.flag}</span>
                        <span className="text-sm font-medium truncate">{lang.name}</span>
                        {isActive && (
                          <span className="ml-auto text-indigo-500 text-sm">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>,
            document.body
          )}

          {!isMobile && (
            <div
              role="listbox"
              aria-label="Languages"
              className={`
                z-50 bg-white border border-slate-200 shadow-2xl overflow-hidden
                absolute rounded-2xl p-2 w-[340px]
                ${openUpward
                  ? 'bottom-full mb-2 top-auto left-auto right-0'
                  : 'top-full mt-2 bottom-auto left-auto right-0'
                }
              `}
            >
              <div className="grid grid-cols-3 gap-1">
                {SUPPORTED_LANGUAGES.map(lang => {
                  const isActive = currentLang.code === lang.code;
                  return (
                    <button
                      key={lang.code}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => changeLanguage(lang.code)}
                      className={`
                        flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all
                        ${isActive
                          ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200 font-bold'
                          : 'text-slate-700 hover:bg-slate-50 active:bg-indigo-50'
                        }
                      `}
                    >
                      <span className="text-lg" role="img" aria-hidden="true">{lang.flag}</span>
                      <span className="text-xs font-medium truncate">{lang.name}</span>
                      {isActive && (
                        <span className="ml-auto text-indigo-500 text-sm">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LanguageSelector;
