import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import LanguageSelector from '../components/LanguageSelector';
import { trackEvent } from '../services/analyticsService';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [ctaVariant, setCtaVariant] = useState<'start' | 'create'>('create');

  useEffect(() => {
    const stored = sessionStorage.getItem('cta_variant') as 'start' | 'create' | null;
    if (stored) {
      setCtaVariant(stored);
      return;
    }
    const next = Math.random() < 0.5 ? 'start' : 'create';
    sessionStorage.setItem('cta_variant', next);
    setCtaVariant(next);
  }, []);

  const primaryCtaText = ctaVariant === 'start' ? t('landing.heroRegister') : t('landing.heroCreateAccount');

  return (
    <div className="min-h-screen bg-white">
      <SEOHead
        title={t('landing.seoTitle')}
        description={t('landing.seoDescription')}
        path="/"
        keywords="activities with grandparents, things to do with parents, intergenerational activities, family bonding platform, connecting generations, grandparent grandchild activities, combat loneliness elderly, senior social platform, lifelong learning, wisdom sharing, family quest app"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": t('landing.seoTitle'),
            "description": t('landing.seoDescription'),
            "url": "https://rootwise.site/",
            "mainEntity": {
              "@type": "Organization",
              "name": "Rootwise",
              "url": "https://rootwise.site"
            }
          }
        ]}
      />

      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between h-16">
          <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-black">R</div>
            {t('common.brand')}
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#how-it-works" className="hover:text-indigo-600 transition-colors">{t('landing.navHowItWorks')}</a>
            <a href="#features" className="hover:text-indigo-600 transition-colors">{t('landing.navFeatures')}</a>
            <a href="#proof" className="hover:text-indigo-600 transition-colors">{t('landing.navCommunity')}</a>
            <button
              onClick={() => {
                void trackEvent('landing_cta_clicked', { source: 'nav_browse_quests', variant: ctaVariant });
                navigate('/quests');
              }}
              className="hover:text-indigo-600 transition-colors"
            >
              {t('landing.navBrowseQuests')}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSelector compact />
            <button
              onClick={() => {
                void trackEvent('landing_cta_clicked', { source: 'nav_sign_in', variant: ctaVariant });
                navigate('/auth');
              }}
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {t('common.signIn')}
            </button>
            <button
              onClick={() => {
                void trackEvent('landing_cta_clicked', { source: 'nav_get_started', variant: ctaVariant });
                navigate('/auth');
              }}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
            >
              {t('landing.navGetStarted')}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-24 landing-hero-bg text-white">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-10 right-16 w-56 h-56 bg-rose-400/20 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-amber-300/10 rounded-full blur-3xl"></div>
        
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest mb-6">
                {t('landing.heroBadge')}
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-black mb-6 leading-[1.1] tracking-tight font-display">
                {t('landing.heroTitle')} <br/> <span className="text-amber-300">{t('landing.heroTitleHighlight')}</span>
              </h1>
              <p className="text-lg md:text-xl mb-8 text-indigo-100 max-w-xl font-medium leading-relaxed">
                {t('landing.heroDescription')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => {
                    void trackEvent('landing_cta_clicked', { source: 'hero_primary', variant: ctaVariant });
                    navigate('/auth');
                  }}
                  className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black text-lg hover:scale-105 transition-all shadow-2xl hover:shadow-indigo-500/40"
                >
                  {primaryCtaText}
                </button>
                <button 
                  onClick={() => {
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white rounded-2xl font-bold text-lg hover:bg-white/20 transition-all"
                >
                  {t('landing.heroSeeHow')}
                </button>
              </div>
              <div className="mt-8 flex items-center gap-x-4 gap-y-1 flex-wrap text-sm text-indigo-200">
                <span className="flex items-center gap-1">✓ {t('common.noCreditCard')}</span>
                <span className="flex items-center gap-1">✓ {t('common.startInMinutes')}</span>
                <span className="flex items-center gap-1">✓ {t('common.coreFree')}</span>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div className="relative hidden lg:block">
              <div className="absolute inset-0 bg-white/5 rounded-3xl rotate-2 scale-105"></div>
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-white/20">
                <img 
                  src="/images/hero-together.jpeg" 
                  alt={t('landing.heroImageAlt')}
                  className="w-full h-auto object-cover rounded-3xl"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-6">
                  <p className="text-white/90 text-sm font-medium">{t('landing.heroImageCaption')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section id="proof" className="py-10 bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-center">
          <div>
            <div className="text-2xl font-black text-slate-800">{t('landing.proofCommunities')}</div>
            <div className="text-xs text-slate-500 font-medium">{t('landing.proofCommunitiesLabel')}</div>
          </div>
          <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
          <div>
            <div className="text-2xl font-black text-slate-800">{t('landing.proofAi')}</div>
            <div className="text-xs text-slate-500 font-medium">{t('landing.proofAiLabel')}</div>
          </div>
          <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
          <div>
            <div className="text-2xl font-black text-slate-800">{t('landing.proofGamified')}</div>
            <div className="text-xs text-slate-500 font-medium">{t('landing.proofGamifiedLabel')}</div>
          </div>
          <div className="w-px h-8 bg-slate-200 hidden sm:block"></div>
          <div>
            <div className="text-2xl font-black text-slate-800">{t('landing.proofFree')}</div>
            <div className="text-xs text-slate-500 font-medium">{t('landing.proofFreeLabel')}</div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">{t('landing.howItWorksTag')}</div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 font-display">{t('landing.howItWorksTitle')}</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">{t('landing.howItWorksSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-3xl bg-white border border-slate-200 hover:shadow-xl transition-all group">
              <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 group-hover:scale-110 transition-transform">1</div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{t('landing.step1Title')}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{t('landing.step1Desc')}</p>
            </div>
            <div className="text-center p-8 rounded-3xl bg-white border border-slate-200 hover:shadow-xl transition-all group">
              <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 group-hover:scale-110 transition-transform">2</div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{t('landing.step2Title')}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{t('landing.step2Desc')}</p>
            </div>
            <div className="text-center p-8 rounded-3xl bg-white border border-slate-200 hover:shadow-xl transition-all group">
              <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black mx-auto mb-6 group-hover:scale-110 transition-transform">3</div>
              <h3 className="text-xl font-bold mb-3 text-slate-800">{t('landing.step3Title')}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{t('landing.step3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem & Solution Section */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">{t('landing.whyTag')}</div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 font-display">{t('landing.whyTitle')}</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">{t('landing.whySubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">📉</div>
              <h4 className="font-bold text-xl text-slate-800 mb-3">{t('landing.problem1Title')}</h4>
              <p className="text-slate-500 text-sm leading-relaxed">{t('landing.problem1Desc')}</p>
            </div>
            <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🏛️</div>
              <h4 className="font-bold text-xl text-slate-800 mb-3">{t('landing.problem2Title')}</h4>
              <p className="text-slate-500 text-sm leading-relaxed">{t('landing.problem2Desc')}</p>
            </div>
            <div className="p-8 bg-white rounded-3xl shadow-sm border border-slate-100 hover:shadow-xl transition-all group">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform">🛠️</div>
              <h4 className="font-bold text-xl text-slate-800 mb-3">{t('landing.problem3Title')}</h4>
              <p className="text-slate-500 text-sm leading-relaxed">{t('landing.problem3Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Features Showcase */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">{t('landing.platformTag')}</div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 font-display">{t('landing.platformTitle')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-indigo-400 hover:shadow-lg transition-all">
              <div className="text-3xl mb-4">📜</div>
              <h5 className="font-bold text-lg mb-2">{t('landing.feature1Title')}</h5>
              <p className="text-slate-500 text-sm">{t('landing.feature1Desc')}</p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-amber-400 hover:shadow-lg transition-all">
              <div className="text-3xl mb-4">✨</div>
              <h5 className="font-bold text-lg mb-2">{t('landing.feature2Title')}</h5>
              <p className="text-slate-500 text-sm">{t('landing.feature2Desc')}</p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-pink-400 hover:shadow-lg transition-all">
              <div className="text-3xl mb-4">🤝</div>
              <h5 className="font-bold text-lg mb-2">{t('landing.feature3Title')}</h5>
              <p className="text-slate-500 text-sm">{t('landing.feature3Desc')}</p>
            </div>
            <div className="p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-400 hover:shadow-lg transition-all">
              <div className="text-3xl mb-4">🏆</div>
              <h5 className="font-bold text-lg mb-2">{t('landing.feature4Title')}</h5>
              <p className="text-slate-500 text-sm">{t('landing.feature4Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Conversion Section */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-block px-4 py-1.5 bg-white text-slate-700 rounded-full text-xs font-bold uppercase tracking-widest mb-4 border border-slate-200">{t('landing.conversionTag')}</div>
              <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 font-display">{t('landing.conversionTitle')}</h2>
              <p className="text-slate-500 text-lg mb-8">{t('landing.conversionDesc')}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    void trackEvent('landing_cta_clicked', { source: 'conversion_primary', variant: ctaVariant });
                    navigate('/auth');
                  }}
                  className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg"
                >
                  {ctaVariant === 'start' ? t('landing.conversionRegister') : t('landing.conversionCreateAccount')}
                </button>
                <button
                  onClick={() => {
                    void trackEvent('landing_cta_clicked', { source: 'conversion_browse', variant: ctaVariant });
                    navigate('/quests');
                  }}
                  className="px-8 py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-lg hover:border-indigo-400 hover:text-indigo-600 transition-all"
                >
                  {t('landing.conversionBrowse')}
                </button>
              </div>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">✓ {t('landing.conversionCheck1')}</span>
                <span className="flex items-center gap-1">✓ {t('landing.conversionCheck2')}</span>
                <span className="flex items-center gap-1">✓ {t('landing.conversionCheck3')}</span>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-200">
                <img 
                  src="/images/reading-wisdom.jpeg" 
                  alt={t('landing.conversionReadingAlt')}
                  className="w-full h-auto object-cover rounded-3xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-2xl mb-2">🧭</div>
                  <p className="text-sm font-bold text-slate-700">{t('landing.conversionCard1')}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-2xl mb-2">🧑‍🤝‍🧑</div>
                  <p className="text-sm font-bold text-slate-700">{t('landing.conversionCard2')}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-2xl mb-2">🧠</div>
                  <p className="text-sm font-bold text-slate-700">{t('landing.conversionCard3')}</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
                  <div className="text-2xl mb-2">🏅</div>
                  <p className="text-sm font-bold text-slate-700">{t('landing.conversionCard4')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">{t('landing.faqTag')}</div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 font-display">{t('landing.faqTitle')}</h2>
            <p className="text-slate-500 text-lg">{t('landing.faqSubtitle')}</p>
          </div>
          <div className="space-y-4">
            <details className="group bg-white border border-slate-200 rounded-2xl p-6">
              <summary className="cursor-pointer font-bold text-slate-800 flex items-center justify-between">
                {t('landing.faq1Q')}
                <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-slate-500 text-sm leading-relaxed">{t('landing.faq1A')}</p>
            </details>
            <details className="group bg-white border border-slate-200 rounded-2xl p-6">
              <summary className="cursor-pointer font-bold text-slate-800 flex items-center justify-between">
                {t('landing.faq2Q')}
                <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-slate-500 text-sm leading-relaxed">{t('landing.faq2A')}</p>
            </details>
            <details className="group bg-white border border-slate-200 rounded-2xl p-6">
              <summary className="cursor-pointer font-bold text-slate-800 flex items-center justify-between">
                {t('landing.faq3Q')}
                <span className="text-slate-400 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-slate-500 text-sm leading-relaxed">{t('landing.faq3A')}</p>
            </details>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto bg-slate-900 rounded-3xl sm:rounded-[40px] p-6 sm:p-12 md:p-16 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/30 blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-600/30 blur-[100px]"></div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-black mb-6 relative z-10 font-display">{t('landing.finalCtaTitle')}</h2>
          <p className="text-lg text-slate-400 mb-10 relative z-10 max-w-xl mx-auto">{t('landing.finalCtaDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
            <button 
              onClick={() => {
                void trackEvent('landing_cta_clicked', { source: 'final_cta_primary', variant: ctaVariant });
                navigate('/auth');
              }}
              className="px-6 sm:px-10 py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-lg sm:text-xl transition-all hover:scale-105 shadow-xl"
            >
              {ctaVariant === 'start' ? t('landing.conversionRegister') : t('landing.conversionCreateAccount')}
            </button>
            <button 
              onClick={() => {
                void trackEvent('landing_cta_clicked', { source: 'final_cta_browse', variant: ctaVariant });
                navigate('/quests');
              }}
              className="px-6 sm:px-10 py-4 sm:py-5 bg-white/10 border border-white/20 hover:bg-white/20 rounded-2xl font-bold text-lg sm:text-xl transition-all"
            >
              {t('landing.finalCtaBrowse')}
            </button>
          </div>
        </div>
      </section>
      
    </div>
  );
};

export default LandingPage;
