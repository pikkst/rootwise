
import React, { useEffect, Component, ErrorInfo, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation, Outlet } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from './i18n';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
// Lazy-load route pages to split code by route
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const AuthPage = React.lazy(() => import('./pages/AuthPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const QuestsPage = React.lazy(() => import('./pages/QuestsPage'));
const QuestDiscoveryPage = React.lazy(() => import('./pages/QuestDiscoveryPage'));
const QuestDetailPage = React.lazy(() => import('./pages/QuestDetailPage'));
const CommunityPage = React.lazy(() => import('./pages/CommunityPage'));
const CommunityDetailPage = React.lazy(() => import('./pages/CommunityDetailPage'));
const AiNexusPage = React.lazy(() => import('./pages/AiNexusPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const PublicProfilePage = React.lazy(() => import('./pages/PublicProfilePage'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage'));
const MatchingPage = React.lazy(() => import('./pages/MatchingPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const PricingPage = React.lazy(() => import('./pages/PricingPage'));
const HowItWorksPage = React.lazy(() => import('./pages/HowItWorksPage'));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = React.lazy(() => import('./pages/TermsOfServicePage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const MessagesPage = React.lazy(() => import('./pages/MessagesPage'));
const CreateQuestPage = React.lazy(() => import('./pages/CreateQuestPage'));
import { trackEvent } from './services/analyticsService';

const LANG_CODES = new Set<string>(SUPPORTED_LANGUAGES.map(l => l.code));

// ─── Global Error Boundary ──────────────────────────────────────────────────
// Catches unhandled render errors anywhere in the tree and shows a recovery
// screen instead of a blank white page.
interface ErrorBoundaryState { hasError: boolean; message: string }
class AppErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    void _error;
    void _info;
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h1>
            <p className="text-slate-500 mb-6 text-sm">{this.state.message}</p>
            <button
              onClick={() => { this.setState({ hasError: false, message: '' }); window.location.href = '/'; }}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Back to home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Syncs the URL /:lang prefix with i18next language */
const LocaleLayout: React.FC = () => {
  const { lang } = useParams<{ lang: string }>();
  const { i18n } = useTranslation();

  useEffect(() => {
    if (lang && LANG_CODES.has(lang) && i18n.language !== lang) {
      i18n.changeLanguage(lang);
      localStorage.setItem('rootwise_language', lang);
      document.documentElement.lang = lang;
    }
  }, [lang, i18n]);

  return (
    <div className="min-h-screen bg-slate-50 transition-colors">
      <Navigation />
      <main>
        <Suspense fallback={<div className="py-12 text-center">Loading…</div>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
};

/** Redirects bare "/" to "/:detectedLang/" if the user's language isn't English */
const _RootRedirect: React.FC = () => {
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';
  if (lang !== 'en' && LANG_CODES.has(lang)) {
    return <Navigate to={`/${lang}/`} replace />;
  }
  return (
    <Suspense fallback={<div className="py-12 text-center">Loading…</div>}>
      <LandingPage />
    </Suspense>
  );
};

/** Wrapper that redirects unauthenticated users to /auth */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

/** The full set of page routes — used both bare and under /:lang */
const pageRoutes = (
  <>
    <Route path="auth" element={<AuthPage />} />
    <Route path="pricing" element={<PricingPage />} />
    <Route path="how-it-works" element={<HowItWorksPage />} />
    <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
    <Route path="terms-of-service" element={<TermsOfServicePage />} />
    <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    <Route path="quests" element={<QuestsPage />} />
    <Route path="quests/create" element={<ProtectedRoute><CreateQuestPage /></ProtectedRoute>} />
    <Route path="quests/:questId" element={<QuestDetailPage />} />
    <Route path="quest-discovery" element={<QuestDiscoveryPage />} />
    <Route path="community" element={<CommunityPage />} />
    <Route path="community/:communityId" element={<CommunityDetailPage />} />
    <Route path="ai-nexus" element={<ProtectedRoute><AiNexusPage /></ProtectedRoute>} />
    <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
    <Route path="users/:id" element={<PublicProfilePage />} />
    <Route path="analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
    <Route path="matching" element={<ProtectedRoute><MatchingPage /></ProtectedRoute>} />
    <Route path="admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
    <Route path="reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
    <Route path="messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
  </>
);

const translatedPageRoutes = (
  <>
    <Route index element={<_RootRedirect />} />
    {pageRoutes}
  </>
);

const AppRoutes: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    void trackEvent('page_view', {
      path: location.pathname,
    });

    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  }, [location.pathname, location.search]);

  return (
    <Routes>
      {/* Bare routes (English / default) */}
      <Route element={<LocaleLayout />}>
        {translatedPageRoutes}
      </Route>

      {/* /:lang prefixed routes — syncs URL lang with i18n */}
      <Route path="/:lang" element={<LocaleLayout />}>
        {pageRoutes}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AppErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <AppErrorBoundary>
                <AppRoutes />
              </AppErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </HelmetProvider>
    </AppErrorBoundary>
  );
};

export default App;
