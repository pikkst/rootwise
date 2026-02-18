import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';

const HowItWorksPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const flowSteps = [
    {
      icon: '👋',
      title: t('howWorks.step1Title'),
      desc: t('howWorks.step1Desc'),
      example: t('howWorks.step1Example'),
    },
    {
      icon: '🎯',
      title: t('howWorks.step2Title'),
      desc: t('howWorks.step2Desc'),
      example: t('howWorks.step2Example'),
    },
    {
      icon: '🧑‍🤝‍🧑',
      title: t('howWorks.step3Title'),
      desc: t('howWorks.step3Desc'),
      example: t('howWorks.step3Example'),
    },
    {
      icon: '🏆',
      title: t('howWorks.step4Title'),
      desc: t('howWorks.step4Desc'),
      example: t('howWorks.step4Example'),
    },
    {
      icon: '🔁',
      title: t('howWorks.step5Title'),
      desc: t('howWorks.step5Desc'),
      example: t('howWorks.step5Example'),
    },
  ];

  const featureCards = [
    {
      icon: '🪪',
      title: t('howWorks.featureProfileTitle'),
      benefit: t('howWorks.featureProfileBenefit'),
      usage: t('howWorks.featureProfileUsage'),
    },
    {
      icon: '📜',
      title: t('howWorks.featureQuestsTitle'),
      benefit: t('howWorks.featureQuestsBenefit'),
      usage: t('howWorks.featureQuestsUsage'),
    },
    {
      icon: '💬',
      title: t('howWorks.featureQuestRoomTitle'),
      benefit: t('howWorks.featureQuestRoomBenefit'),
      usage: t('howWorks.featureQuestRoomUsage'),
    },
    {
      icon: '📹',
      title: t('howWorks.featureVideoTitle'),
      benefit: t('howWorks.featureVideoBenefit'),
      usage: t('howWorks.featureVideoUsage'),
    },
    {
      icon: '🤝',
      title: t('howWorks.featureCommunityTitle'),
      benefit: t('howWorks.featureCommunityBenefit'),
      usage: t('howWorks.featureCommunityUsage'),
    },
    {
      icon: '✨',
      title: t('howWorks.featureAiTitle'),
      benefit: t('howWorks.featureAiBenefit'),
      usage: t('howWorks.featureAiUsage'),
    },
    {
      icon: '🔗',
      title: t('howWorks.featureMatchingTitle'),
      benefit: t('howWorks.featureMatchingBenefit'),
      usage: t('howWorks.featureMatchingUsage'),
    },
    {
      icon: '📊',
      title: t('howWorks.featureAnalyticsTitle'),
      benefit: t('howWorks.featureAnalyticsBenefit'),
      usage: t('howWorks.featureAnalyticsUsage'),
    },
    {
      icon: '👑',
      title: t('howWorks.featureOrganizerTitle'),
      benefit: t('howWorks.featureOrganizerBenefit'),
      usage: t('howWorks.featureOrganizerUsage'),
    },
    {
      icon: '🔔',
      title: t('howWorks.featureNotificationsTitle'),
      benefit: t('howWorks.featureNotificationsBenefit'),
      usage: t('howWorks.featureNotificationsUsage'),
    },
    {
      icon: '🌍',
      title: t('howWorks.featureAiTranslateTitle', { defaultValue: 'AI Auto-Sync Translate (Inbox)' }),
      benefit: t('howWorks.featureAiTranslateBenefit', { defaultValue: 'Lets people from different languages and cultures communicate naturally without losing context.' }),
      usage: t('howWorks.featureAiTranslateUsage', { defaultValue: 'Turn on AI Mediator in messages to translate incoming text and send culture-aware replies. Available on Pro, Org, and Admin plans.' }),
    },
  ];

  const examples = [
    {
      title: t('howWorks.exampleFamilyTitle'),
      text: t('howWorks.exampleFamilyText'),
      emoji: '👨‍👩‍👧',
    },
    {
      title: t('howWorks.exampleSchoolTitle'),
      text: t('howWorks.exampleSchoolText'),
      emoji: '🏫',
    },
    {
      title: t('howWorks.exampleCareHomeTitle'),
      text: t('howWorks.exampleCareHomeText'),
      emoji: '🏡',
    },
    {
      title: t('howWorks.exampleTranslate1Title', { defaultValue: 'Estonian ↔ Spanish mentoring chat' }),
      text: t('howWorks.exampleTranslate1Text', { defaultValue: 'A learner writes in Spanish, mentor reads in Estonian, and AI Mediator keeps tone friendly and clear for both sides.' }),
      emoji: '🇪🇪🇪🇸',
    },
    {
      title: t('howWorks.exampleTranslate2Title', { defaultValue: 'Cross-culture first contact' }),
      text: t('howWorks.exampleTranslate2Text', { defaultValue: 'AI helps shape the first message respectfully, so new contacts feel safe and understood from the start.' }),
      emoji: '🤝',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <SEOHead
        title={t('howWorks.seoTitle')}
        description={t('howWorks.seoDesc')}
        path="/how-it-works"
      />

      <section className="pt-28 pb-16 px-6 bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-500 text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider mb-5">
            {t('howWorks.tag')}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black mb-5">{t('howWorks.title')}</h1>
          <p className="text-indigo-100 text-lg max-w-3xl mx-auto leading-relaxed">{t('howWorks.subtitle')}</p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-3">{t('howWorks.journeyTitle')}</h2>
            <p className="text-slate-500 text-lg">{t('howWorks.journeySubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {flowSteps.map((step, index) => (
              <div key={step.title} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-3xl">{step.icon}</span>
                  <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-sm font-black flex items-center justify-center">{index + 1}</span>
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-3">{step.desc}</p>
                <p className="text-xs text-indigo-600 font-semibold">{step.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-3">{t('howWorks.featuresTitle')}</h2>
            <p className="text-slate-500 text-lg">{t('howWorks.featuresSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {featureCards.map((card) => (
              <article key={card.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 hover:border-indigo-300 hover:bg-white transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">{card.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mb-2"><span className="font-semibold text-slate-700">{t('howWorks.benefitLabel')} </span>{card.benefit}</p>
                    <p className="text-sm text-slate-600 leading-relaxed"><span className="font-semibold text-slate-700">{t('howWorks.useLabel')} </span>{card.usage}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            {t('howWorks.aiTierNote', {
              defaultValue:
                'Friendly note: AI Nexus contact starter remains available on Free plans, while AI auto-sync translate in inbox is available on Pro, Org, and Admin plans to keep API costs sustainable.',
            })}
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mb-3">{t('howWorks.examplesTitle')}</h2>
            <p className="text-slate-500 text-lg">{t('howWorks.examplesSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examples.map((example) => (
              <div key={example.title} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <div className="text-4xl mb-3">{example.emoji}</div>
                <h3 className="font-bold text-slate-800 mb-2">{example.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{example.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto bg-slate-900 rounded-3xl p-8 sm:p-12 text-center text-white shadow-2xl">
          <h2 className="text-2xl sm:text-4xl font-black mb-4">{t('howWorks.ctaTitle')}</h2>
          <p className="text-slate-300 mb-8 text-lg">{t('howWorks.ctaSubtitle')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/auth')}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-lg transition-all"
            >
              {t('howWorks.ctaPrimary')}
            </button>
            <button
              onClick={() => navigate('/quests')}
              className="px-8 py-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl font-bold text-lg transition-all"
            >
              {t('howWorks.ctaSecondary')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorksPage;
