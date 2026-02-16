import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import PlanBadge from '../components/PlanBadge';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { redirectToCheckout, openBillingPortal } from '../services/stripeService';

const PricingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const planInfo = usePlan();
  const [billingLoading, setBillingLoading] = useState(false);

  const currentPlan = planInfo.plan;
  const isAuthenticated = !!user;

  const handleSelectPlan = (plan: 'pro' | 'org') => {
    if (!isAuthenticated) {
      navigate('/auth');
      return;
    }
    redirectToCheckout(plan);
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      await openBillingPortal();
    } catch {
      // Fallback — show inline message
    }
    setBillingLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 pt-24 pb-32">
      <SEOHead
        title={t('pricing.seoTitle')}
        description={t('pricing.seoDesc')}
        path="/pricing"
      />

      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
          {t('pricing.title')}
        </div>
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4">
          {t('pricing.headline')}
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          {t('pricing.subtitle')}
        </p>

        {/* Current plan indicator (logged-in users) */}
        {isAuthenticated && (
          <div className="mt-6 inline-flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-sm text-slate-500">{t('pricing.yourPlan')}</span>
            <PlanBadge plan={currentPlan} size="md" />
          </div>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
        {/* Free */}
        <div className={`p-8 bg-white rounded-3xl border-2 transition-all hover:shadow-xl ${currentPlan === 'free' ? 'border-slate-400' : 'border-slate-200'}`}>
          {currentPlan === 'free' && (
            <div className="text-center mb-3">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">{t('pricing.currentPlan')}</span>
            </div>
          )}
          <h3 className="text-lg font-bold text-slate-800 mb-2">{t('common.free')}</h3>
          <div className="mb-6">
            <span className="text-4xl font-black text-slate-900">{t('pricing.freePrice')}</span>
            <span className="text-slate-400 text-sm"> / {t('pricing.forever')}</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.freeFeature1')}</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.freeFeature2')}</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.freeFeature3')}</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.freeFeature4')}</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.freeFeature5')}</li>
          </ul>
          {currentPlan === 'free' ? (
            <button disabled className="w-full py-3 border-2 border-slate-200 text-slate-400 rounded-xl font-bold cursor-default">
              {t('pricing.currentPlan')}
            </button>
          ) : (
            <button onClick={() => navigate('/dashboard')} className="w-full py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:border-indigo-400 hover:text-indigo-600 transition-all">
              {t('pricing.goToDashboard')}
            </button>
          )}
        </div>

        {/* Pro */}
        <div className={`p-8 rounded-3xl border-2 relative transition-all hover:shadow-2xl transform md:-translate-y-2 ${
          currentPlan === 'pro' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-600 border-indigo-600 text-white'
        }`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-amber-900 rounded-full text-xs font-black uppercase">
            {currentPlan === 'pro' ? t('pricing.currentPlan') : t('pricing.mostPopular')}
          </div>
          <h3 className="text-lg font-bold mb-2">{t('common.pro')}</h3>
          <div className="mb-1">
            <span className="text-4xl font-black">{t('pricing.proPrice')}</span>
            <span className="text-indigo-200 text-sm"> / {t('pricing.month')}</span>
          </div>
          <p className="text-indigo-200 text-xs mb-6">{t('pricing.bestForPower')}</p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> {t('pricing.proFeature1')}</li>
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> {t('pricing.proFeature2')}</li>
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> {t('pricing.proFeature3')}</li>
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> {t('pricing.proFeature4')}</li>
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> {t('pricing.proFeature5')}</li>
          </ul>
          {currentPlan === 'pro' ? (
            <div className="space-y-2">
              <button disabled className="w-full py-3 bg-white/30 text-white rounded-xl font-bold cursor-default">
                {t('pricing.currentPlan')}
              </button>
              <button
                onClick={handleManageBilling}
                disabled={billingLoading}
                className="w-full py-2 text-sm text-indigo-200 font-medium hover:text-white transition-colors"
              >
                {billingLoading ? t('common.loading') : t('pricing.manageBilling')}
              </button>
            </div>
          ) : currentPlan === 'org' ? (
            <button disabled className="w-full py-3 bg-white/20 text-indigo-200 rounded-xl font-bold cursor-default">
              {t('pricing.includedInOrg')}
            </button>
          ) : (
            <button
              onClick={() => handleSelectPlan('pro')}
              className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all"
            >
              {t('pricing.startFreeTrial')}
            </button>
          )}
        </div>

        {/* Organization */}
        <div className={`p-8 bg-white rounded-3xl border-2 transition-all hover:shadow-xl ${currentPlan === 'org' ? 'border-amber-400' : 'border-slate-200'}`}>
          {currentPlan === 'org' && (
            <div className="text-center mb-3">
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">{t('pricing.currentPlan')}</span>
            </div>
          )}
          <h3 className="text-lg font-bold text-slate-800 mb-2">{t('common.org')}</h3>
          <div className="mb-6">
            <span className="text-4xl font-black text-slate-900">{t('pricing.orgPrice')}</span>
            <span className="text-slate-400 text-sm"> / {t('pricing.month')}</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.orgFeature1')}</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.orgFeature2')}</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.orgFeature3')}</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.orgFeature4')}</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> {t('pricing.orgFeature5')}</li>
          </ul>
          {currentPlan === 'org' ? (
            <div className="space-y-2">
              <button disabled className="w-full py-3 border-2 border-amber-400 text-amber-600 rounded-xl font-bold cursor-default">
                {t('pricing.currentPlan')}
              </button>
              <button
                onClick={handleManageBilling}
                disabled={billingLoading}
                className="w-full py-2 text-sm text-slate-500 font-medium hover:text-indigo-600 transition-colors"
              >
                {billingLoading ? t('common.loading') : t('pricing.manageBilling')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleSelectPlan('org')}
              className="w-full py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:border-amber-400 hover:text-amber-600 transition-all"
            >
              {t('pricing.upgradeToOrg')}
            </button>
          )}
        </div>
      </div>

      {/* Subscription Details (authenticated with active subscription) */}
      {isAuthenticated && planInfo.subscription && (
        <div className="max-w-2xl mx-auto mb-16">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <span>📋</span> {t('pricing.subscriptionDetails')}
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-500">{t('pricing.plan')}</span>
                <PlanBadge plan={planInfo.subscription.plan} size="md" />
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-500">{t('pricing.status')}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  planInfo.subscription.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  planInfo.subscription.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                  planInfo.subscription.status === 'cancelling' ? 'bg-amber-100 text-amber-700' :
                  planInfo.subscription.status === 'past_due' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {planInfo.subscription.status === 'active' ? t('pricing.statusActive') :
                   planInfo.subscription.status === 'trialing' ? t('pricing.statusTrial') :
                   planInfo.subscription.status === 'cancelling' ? t('pricing.statusCancelling') :
                   planInfo.subscription.status === 'past_due' ? t('pricing.statusPastDue') :
                   planInfo.subscription.status.charAt(0).toUpperCase() + planInfo.subscription.status.slice(1)}
                </span>
              </div>
              {planInfo.subscription.current_period_end && (
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-500">
                    {planInfo.subscription.status === 'cancelling' ? t('pricing.accessUntil') : t('pricing.renewsOn')}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {new Date(planInfo.subscription.current_period_end).toLocaleDateString(undefined, {
                      month: 'long', day: 'numeric', year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleManageBilling}
                disabled={billingLoading}
                className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-xl font-bold hover:border-indigo-400 hover:text-indigo-600 transition-all disabled:opacity-50"
              >
                {billingLoading ? t('common.loading') : `⚙️ ${t('pricing.manageSubscription')}`}
              </button>
            </div>

            {planInfo.subscription.status === 'cancelling' && (
              <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                <p className="text-sm text-amber-800">
                  {t('pricing.cancelWarning')}
                </p>
              </div>
            )}

            {planInfo.subscription.status === 'past_due' && (
              <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-200">
                <p className="text-sm text-red-800">
                  {t('pricing.pastDueWarning')}
                </p>
                <button
                  onClick={handleManageBilling}
                  className="mt-2 text-sm text-red-600 font-bold underline"
                >
                  {t('pricing.updatePaymentMethod')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature Comparison Table */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">{t('pricing.featureComparison')}</h2>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-3 sm:p-4 text-sm font-bold text-slate-600">{t('pricing.feature')}</th>
                <th className="text-center p-3 sm:p-4 text-sm font-bold text-slate-600">{t('common.free')}</th>
                <th className="text-center p-3 sm:p-4 text-sm font-bold text-indigo-600">{t('common.pro')}</th>
                <th className="text-center p-3 sm:p-4 text-sm font-bold text-amber-600">{t('common.org')}</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: t('pricing.compActiveQuests'), free: t('pricing.compUpTo3'), pro: t('common.unlimited'), org: t('common.unlimited') },
                { feature: t('pricing.compAiMentor'), free: t('pricing.comp5Day'), pro: t('common.unlimited'), org: t('common.unlimited') },
                { feature: t('pricing.compAiQuest'), free: t('pricing.comp1Day'), pro: t('common.unlimited'), org: t('common.unlimited') },
                { feature: t('pricing.compCommunity'), free: '✓', pro: '✓', org: '✓' },
                { feature: t('pricing.compXpLevels'), free: '✓', pro: '✓', org: '✓' },
                { feature: t('pricing.compAnalytics'), free: '—', pro: '✓', org: '✓' },
                { feature: t('pricing.compMatching'), free: '—', pro: '✓', org: '✓' },
                { feature: t('pricing.compTeam'), free: '—', pro: '—', org: t('pricing.compUpTo50') },
                { feature: t('pricing.compAdminDash'), free: '—', pro: '—', org: '✓' },
                { feature: t('pricing.compBranded'), free: '—', pro: '—', org: '✓' },
                { feature: t('pricing.compReports'), free: '—', pro: '—', org: '✓' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="p-3 sm:p-4 text-sm font-medium text-slate-700">{row.feature}</td>
                  <td className="p-3 sm:p-4 text-center text-sm text-slate-500">{row.free}</td>
                  <td className={`p-3 sm:p-4 text-center text-sm ${row.pro !== '—' ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>{row.pro}</td>
                  <td className={`p-3 sm:p-4 text-center text-sm ${row.org !== '—' ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{row.org}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto mt-16">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">{t('pricing.faqTitle')}</h2>
        <div className="space-y-4">
          {[
            { q: t('pricing.faq1Q'), a: t('pricing.faq1A') },
            { q: t('pricing.faq2Q'), a: t('pricing.faq2A') },
            { q: t('pricing.faq3Q'), a: t('pricing.faq3A') },
            { q: t('pricing.faq4Q'), a: t('pricing.faq4A') },
          ].map((faq, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6">
              <h4 className="font-bold text-slate-800 mb-2">{faq.q}</h4>
              <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
