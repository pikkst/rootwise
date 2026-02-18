import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import SEOHead from '../components/SEOHead';
import LanguageSelector from '../components/LanguageSelector';
import { trackEvent } from '../services/analyticsService';
import { useLocalePath } from '../hooks/useLocalePath';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const lp = useLocalePath();

  const mapAuthError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes('invalid login credentials')) return t('auth.invalidCredentials');
    if (lower.includes('too many requests') || lower.includes('over_email_send_rate_limit') || lower.includes('rate limit')) {
      return t('auth.rateLimited');
    }
    if (lower.includes('invalid email') || lower.includes('email address is invalid')) {
      return t('auth.validationEmail');
    }
    return message;
  };

  const cooldownSeconds = cooldownUntil && cooldownUntil > nowTs
    ? Math.ceil((cooldownUntil - nowTs) / 1000)
    : 0;
  const isCooldownActive = cooldownSeconds > 0;

  useEffect(() => {
    if (!isCooldownActive) return;
    const timer = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isCooldownActive]);

  // Redirect to dashboard once user state is confirmed after login
  useEffect(() => {
    if (user) {
      navigate(lp('/dashboard'), { replace: true });
    }
  }, [user, navigate, lp]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (isCooldownActive) {
      setError(t('auth.cooldown', { seconds: cooldownSeconds }));
      return;
    }

    setLoading(true);

    void trackEvent('auth_submitted', {
      mode: isLogin ? 'sign_in' : 'sign_up',
    });

    try {
      if (!EMAIL_REGEX.test(email.trim())) {
        setError(t('auth.validationEmail'));
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          const safeError = mapAuthError(error);
          void trackEvent('auth_failed', {
            mode: 'sign_in',
            reason: safeError,
          });
          setError(safeError);

          const lower = error.toLowerCase();
          if (lower.includes('too many requests') || lower.includes('over_email_send_rate_limit') || lower.includes('rate limit')) {
            setCooldownUntil(Date.now() + 60_000);
            setFailedAttempts(0);
          } else if (lower.includes('invalid login credentials')) {
            const nextAttempts = failedAttempts + 1;
            setFailedAttempts(nextAttempts);
            if (nextAttempts >= 3) {
              setCooldownUntil(Date.now() + 30_000);
              setFailedAttempts(0);
            }
          }
        } else {
          void trackEvent('auth_success', {
            mode: 'sign_in',
          });
          setFailedAttempts(0);
          setCooldownUntil(null);
        }
        // Don't navigate here — the useEffect above will handle it
        // once onAuthStateChange sets the user
      } else {
        if (!name.trim()) {
          void trackEvent('auth_failed', {
            mode: 'sign_up',
            reason: 'missing_name',
          });
          setError(t('auth.validationName'));
          setLoading(false);
          return;
        }
        const { error } = await signUp(email.trim(), password, name);
        if (error) {
          const safeError = mapAuthError(error);
          void trackEvent('auth_failed', {
            mode: 'sign_up',
            reason: safeError,
          });
          setError(safeError);
        } else {
          void trackEvent('auth_success', {
            mode: 'sign_up',
          });
          setSuccess(t('auth.successCreated'));
          setIsLogin(true);
          setFailedAttempts(0);
          setCooldownUntil(null);
        }
      }
    } catch (err: unknown) {
      console.error('Auth error:', err);
      void trackEvent('auth_failed', {
        mode: isLogin ? 'sign_in' : 'sign_up',
        reason: err instanceof Error ? err.message : 'unknown_error',
      });
      setError(err instanceof Error ? err.message : t('common.error'));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6 relative">
      <SEOHead
        title={isLogin ? t('auth.seoSignIn') : t('auth.seoSignUp')}
        description={isLogin ? t('auth.seoSignInDesc') : t('auth.seoSignUpDesc')}
        path="/auth"
      />

      <div className="absolute top-5 right-6 z-10">
        <LanguageSelector compact />
      </div>

      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 cursor-pointer"
            onClick={() => navigate(lp('/'))}
          >
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg">
              R
            </div>
            <span className="text-2xl font-black text-indigo-600">{t('common.brand')}</span>
          </div>
          <p className="text-slate-500 mt-3">
            {isLogin ? t('auth.welcomeBack') : t('auth.startAdventure')}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8">
          {/* Tabs */}
          <div className="flex bg-slate-100 rounded-2xl p-1 mb-8">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                isLogin
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('auth.tabSignIn')}
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setError(null); setSuccess(null); }}
              className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                !isLogin
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('auth.tabCreateAccount')}
            </button>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-sm">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600">{t('auth.labelName')}</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('auth.placeholderName')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">{t('auth.labelEmail')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.placeholderEmail')}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600">{t('auth.labelPassword')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading || isCooldownActive}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {t('common.processing')}
                </span>
              ) : isCooldownActive ? (
                t('auth.cooldown', { seconds: cooldownSeconds })
              ) : isLogin ? (
                t('auth.btnSignIn')
              ) : (
                t('auth.btnCreateAccount')
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6">
          {t('auth.legalAgree')}{' '}
          <a href={lp('/terms-of-service')} className="underline">{t('footer.termsOfService')}</a>{' '}
          {t('auth.legalAnd')}{' '}
          <a href={lp('/privacy-policy')} className="underline">{t('footer.privacyPolicy')}</a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
