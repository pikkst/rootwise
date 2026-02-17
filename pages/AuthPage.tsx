import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import SEOHead from '../components/SEOHead';
import { trackEvent } from '../services/analyticsService';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Redirect to dashboard once user state is confirmed after login
  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    void trackEvent('auth_submitted', {
      mode: isLogin ? 'sign_in' : 'sign_up',
    });

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          void trackEvent('auth_failed', {
            mode: 'sign_in',
            reason: error,
          });
          setError(error);
        } else {
          void trackEvent('auth_success', {
            mode: 'sign_in',
          });
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
        const { error } = await signUp(email, password, name);
        if (error) {
          void trackEvent('auth_failed', {
            mode: 'sign_up',
            reason: error,
          });
          setError(error);
        } else {
          void trackEvent('auth_success', {
            mode: 'sign_up',
          });
          setSuccess(t('auth.successCreated'));
          setIsLogin(true);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-6">
      <SEOHead
        title={isLogin ? t('auth.seoSignIn') : t('auth.seoSignUp')}
        description={isLogin ? t('auth.seoSignInDesc') : t('auth.seoSignUpDesc')}
        path="/auth"
      />

      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/')}
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
              disabled={loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  {t('common.processing')}
                </span>
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
          <a href="/terms" className="underline">{t('footer.termsOfService')}</a>{' '}
          {t('auth.legalAnd')}{' '}
          <a href="/privacy" className="underline">{t('footer.privacyPolicy')}</a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
