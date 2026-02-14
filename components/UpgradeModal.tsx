import React from 'react';
import { useNavigate } from 'react-router-dom';
import { redirectToCheckout } from '../services/stripeService';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  requiredPlan?: 'pro' | 'org';
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, feature, requiredPlan = 'pro' }) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const isPro = requiredPlan === 'pro';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Decorative blur */}
        <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl -translate-y-20 translate-x-20 ${isPro ? 'bg-indigo-500/20' : 'bg-amber-500/20'}`} />

        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 ${isPro ? 'bg-indigo-100' : 'bg-amber-100'}`}>
          {isPro ? '⚡' : '👑'}
        </div>

        <h3 className="text-2xl font-black text-slate-800 text-center mb-2">
          Upgrade to {isPro ? 'Pro' : 'Organization'}
        </h3>

        <p className="text-slate-500 text-center mb-6 text-sm leading-relaxed">
          <strong>{feature}</strong> requires the {isPro ? 'Pro' : 'Organization'} plan.
          {isPro ? ' Unlock unlimited quests, AI, analytics, and priority matching.' : ' Get admin tools, branded communities, and team reporting.'}
        </p>

        {/* Feature list */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6">
          {isPro ? (
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> Unlimited quests</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> Unlimited AI mentor</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> AI quest generation</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> Advanced analytics</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> Priority matching</li>
            </ul>
          ) : (
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> Everything in Pro</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> Up to 50 members</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> Admin dashboard</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> Branded communities</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> Reporting & analytics</li>
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => redirectToCheckout(requiredPlan)}
            className={`w-full py-4 font-bold rounded-2xl transition-all shadow-lg ${
              isPro
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30'
                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/30'
            }`}
          >
            {isPro ? 'Upgrade to Pro — $9.99/mo' : 'Upgrade to Organization — $49/mo'}
          </button>

          <button
            onClick={() => { onClose(); navigate('/pricing'); }}
            className="w-full py-3 text-sm text-indigo-600 font-semibold hover:underline"
          >
            Compare all plans
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm"
          >
            Maybe later
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Free during beta! No credit card required.
        </p>
      </div>
    </div>
  );
};

export default UpgradeModal;
