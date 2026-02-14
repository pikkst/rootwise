import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEOHead';
import PlanBadge from '../components/PlanBadge';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { redirectToCheckout, openBillingPortal } from '../services/stripeService';

const PricingPage: React.FC = () => {
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
        title="Pricing - Rootwise"
        description="Simple, transparent pricing for Rootwise. Start free, upgrade when ready."
        path="/pricing"
      />

      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
          Pricing
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-slate-500 text-lg max-w-xl mx-auto">
          Start free, upgrade when you're ready. Currently in beta — all Pro features are free!
        </p>

        {/* Current plan indicator (logged-in users) */}
        {isAuthenticated && (
          <div className="mt-6 inline-flex items-center gap-3 bg-white px-5 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-sm text-slate-500">Your plan:</span>
            <PlanBadge plan={currentPlan} isBeta={planInfo.isBeta} size="md" />
            {planInfo.isBeta && currentPlan === 'free' && (
              <span className="text-xs text-emerald-600 font-medium">Pro features active (beta)</span>
            )}
          </div>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
        {/* Free */}
        <div className={`p-8 bg-white rounded-3xl border-2 transition-all hover:shadow-xl ${currentPlan === 'free' ? 'border-slate-400' : 'border-slate-200'}`}>
          {currentPlan === 'free' && (
            <div className="text-center mb-3">
              <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold">Current Plan</span>
            </div>
          )}
          <h3 className="text-lg font-bold text-slate-800 mb-2">Free</h3>
          <div className="mb-6">
            <span className="text-4xl font-black text-slate-900">$0</span>
            <span className="text-slate-400 text-sm"> / forever</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> 3 active quests</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Community access</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> AI mentor (5 msgs/day)</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Basic profile & XP</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Quest generation (1/day)</li>
          </ul>
          {currentPlan === 'free' ? (
            <button disabled className="w-full py-3 border-2 border-slate-200 text-slate-400 rounded-xl font-bold cursor-default">
              Current Plan
            </button>
          ) : (
            <button onClick={() => navigate('/dashboard')} className="w-full py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:border-indigo-400 hover:text-indigo-600 transition-all">
              Go to Dashboard
            </button>
          )}
        </div>

        {/* Pro */}
        <div className={`p-8 rounded-3xl border-2 relative transition-all hover:shadow-2xl transform md:-translate-y-2 ${
          currentPlan === 'pro' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-indigo-600 border-indigo-600 text-white'
        }`}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-amber-900 rounded-full text-xs font-black uppercase">
            {currentPlan === 'pro' ? 'Current Plan' : 'Most Popular'}
          </div>
          <h3 className="text-lg font-bold mb-2">Pro</h3>
          <div className="mb-1">
            <span className="text-4xl font-black">$9.99</span>
            <span className="text-indigo-200 text-sm"> / month</span>
          </div>
          <p className="text-indigo-200 text-xs mb-6">Free during beta!</p>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> Unlimited quests</li>
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> Unlimited AI mentor</li>
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> AI quest generation</li>
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> Advanced analytics</li>
            <li className="flex items-start gap-2 text-sm"><span className="text-amber-300 mt-0.5">✓</span> Priority matching</li>
          </ul>
          {currentPlan === 'pro' ? (
            <div className="space-y-2">
              <button disabled className="w-full py-3 bg-white/30 text-white rounded-xl font-bold cursor-default">
                Current Plan
              </button>
              <button
                onClick={handleManageBilling}
                disabled={billingLoading}
                className="w-full py-2 text-sm text-indigo-200 font-medium hover:text-white transition-colors"
              >
                {billingLoading ? 'Loading...' : 'Manage Billing →'}
              </button>
            </div>
          ) : currentPlan === 'org' ? (
            <button disabled className="w-full py-3 bg-white/20 text-indigo-200 rounded-xl font-bold cursor-default">
              Included in Org
            </button>
          ) : (
            <button
              onClick={() => handleSelectPlan('pro')}
              className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-all"
            >
              Start Free Trial
            </button>
          )}
        </div>

        {/* Organization */}
        <div className={`p-8 bg-white rounded-3xl border-2 transition-all hover:shadow-xl ${currentPlan === 'org' ? 'border-amber-400' : 'border-slate-200'}`}>
          {currentPlan === 'org' && (
            <div className="text-center mb-3">
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Current Plan</span>
            </div>
          )}
          <h3 className="text-lg font-bold text-slate-800 mb-2">Organization</h3>
          <div className="mb-6">
            <span className="text-4xl font-black text-slate-900">$49</span>
            <span className="text-slate-400 text-sm"> / month</span>
          </div>
          <ul className="space-y-3 mb-8">
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Everything in Pro</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Up to 50 members</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Admin dashboard</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Branded communities</li>
            <li className="flex items-start gap-2 text-sm text-slate-600"><span className="text-emerald-500 mt-0.5">✓</span> Reporting & analytics</li>
          </ul>
          {currentPlan === 'org' ? (
            <div className="space-y-2">
              <button disabled className="w-full py-3 border-2 border-amber-400 text-amber-600 rounded-xl font-bold cursor-default">
                Current Plan
              </button>
              <button
                onClick={handleManageBilling}
                disabled={billingLoading}
                className="w-full py-2 text-sm text-slate-500 font-medium hover:text-indigo-600 transition-colors"
              >
                {billingLoading ? 'Loading...' : 'Manage Billing →'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => handleSelectPlan('org')}
              className="w-full py-3 border-2 border-slate-200 text-slate-700 rounded-xl font-bold hover:border-amber-400 hover:text-amber-600 transition-all"
            >
              Contact Us
            </button>
          )}
        </div>
      </div>

      {/* Subscription Details (authenticated with active subscription) */}
      {isAuthenticated && planInfo.subscription && (
        <div className="max-w-2xl mx-auto mb-16">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8">
            <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
              <span>📋</span> Subscription Details
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-500">Plan</span>
                <PlanBadge plan={planInfo.subscription.plan} size="md" />
              </div>
              <div className="flex justify-between items-center py-3 border-b border-slate-100">
                <span className="text-sm text-slate-500">Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  planInfo.subscription.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
                  planInfo.subscription.status === 'trialing' ? 'bg-blue-100 text-blue-700' :
                  planInfo.subscription.status === 'cancelling' ? 'bg-amber-100 text-amber-700' :
                  planInfo.subscription.status === 'past_due' ? 'bg-red-100 text-red-700' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  {planInfo.subscription.status === 'active' ? 'Active' :
                   planInfo.subscription.status === 'trialing' ? 'Trial' :
                   planInfo.subscription.status === 'cancelling' ? 'Cancelling' :
                   planInfo.subscription.status === 'past_due' ? 'Past Due' :
                   planInfo.subscription.status.charAt(0).toUpperCase() + planInfo.subscription.status.slice(1)}
                </span>
              </div>
              {planInfo.subscription.current_period_end && (
                <div className="flex justify-between items-center py-3 border-b border-slate-100">
                  <span className="text-sm text-slate-500">
                    {planInfo.subscription.status === 'cancelling' ? 'Access until' : 'Renews on'}
                  </span>
                  <span className="text-sm font-medium text-slate-700">
                    {new Date(planInfo.subscription.current_period_end).toLocaleDateString('en-US', {
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
                {billingLoading ? 'Loading...' : '⚙️ Manage Subscription'}
              </button>
            </div>

            {planInfo.subscription.status === 'cancelling' && (
              <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-200">
                <p className="text-sm text-amber-800">
                  Your subscription is set to cancel at the end of the current billing period.
                  You can reactivate it from the billing portal.
                </p>
              </div>
            )}

            {planInfo.subscription.status === 'past_due' && (
              <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-200">
                <p className="text-sm text-red-800">
                  Your payment is past due. Please update your payment method to continue using Pro features.
                </p>
                <button
                  onClick={handleManageBilling}
                  className="mt-2 text-sm text-red-600 font-bold underline"
                >
                  Update payment method
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature Comparison Table */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">Feature Comparison</h2>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left p-4 text-sm font-bold text-slate-600">Feature</th>
                <th className="text-center p-4 text-sm font-bold text-slate-600">Free</th>
                <th className="text-center p-4 text-sm font-bold text-indigo-600">Pro</th>
                <th className="text-center p-4 text-sm font-bold text-amber-600">Organization</th>
              </tr>
            </thead>
            <tbody>
              {[
                { feature: 'Active Quests', free: '3', pro: 'Unlimited', org: 'Unlimited' },
                { feature: 'AI Mentor Messages', free: '5/day', pro: 'Unlimited', org: 'Unlimited' },
                { feature: 'AI Quest Generation', free: '1/day', pro: 'Unlimited', org: 'Unlimited' },
                { feature: 'Community Access', free: '✓', pro: '✓', org: '✓' },
                { feature: 'XP & Level System', free: '✓', pro: '✓', org: '✓' },
                { feature: 'Advanced Analytics', free: '—', pro: '✓', org: '✓' },
                { feature: 'Priority Matching', free: '—', pro: '✓', org: '✓' },
                { feature: 'Team Members', free: '—', pro: '—', org: 'Up to 50' },
                { feature: 'Admin Dashboard', free: '—', pro: '—', org: '✓' },
                { feature: 'Branded Communities', free: '—', pro: '—', org: '✓' },
                { feature: 'Reporting & Export', free: '—', pro: '—', org: '✓' },
              ].map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="p-4 text-sm font-medium text-slate-700">{row.feature}</td>
                  <td className="p-4 text-center text-sm text-slate-500">{row.free}</td>
                  <td className={`p-4 text-center text-sm ${row.pro === '✓' || row.pro === 'Unlimited' ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>{row.pro}</td>
                  <td className={`p-4 text-center text-sm ${row.org === '✓' || row.org === 'Unlimited' || row.org === 'Up to 50' ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{row.org}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto mt-16">
        <h2 className="text-2xl font-bold text-slate-800 text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Is it really free during beta?',
              a: 'Yes! During the beta period, all Pro features are available to every user at no cost. When we officially launch pricing, we\'ll give you plenty of notice.',
            },
            {
              q: 'Can I cancel anytime?',
              a: 'Absolutely. You can cancel your subscription at any time from the billing portal. You\'ll keep access until the end of your current billing period.',
            },
            {
              q: 'What happens to my data if I downgrade?',
              a: 'Your data is never deleted. If you downgrade from Pro to Free, you\'ll still have access to your quests and chat history, but some features (like analytics and unlimited quests) will be limited.',
            },
            {
              q: 'How does the Organization plan work?',
              a: 'The Organization plan lets you manage a team of up to 50 members, create branded communities, and access admin-level reporting and analytics. Perfect for schools, clubs, and community organizations.',
            },
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
