import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { redirectToCheckout } from '../services/stripeService';
import { useToast } from '../context/ToastContext';
import { trackEvent } from '../services/analyticsService';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: string;
  requiredPlan?: 'pro' | 'org';
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({ isOpen, onClose, feature, requiredPlan = 'pro' }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { showToast } = useToast();

  React.useEffect(() => {
    if (!isOpen) return;
    void trackEvent('upgrade_modal_shown', {
      feature,
      requiredPlan,
      source: 'upgrade_modal',
    });
  }, [isOpen, feature, requiredPlan]);

  if (!isOpen) return null;

  const isPro = requiredPlan === 'pro';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-[32px] p-6 sm:p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
        {/* Decorative blur */}
        <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl -translate-y-20 translate-x-20 ${isPro ? 'bg-indigo-500/20' : 'bg-amber-500/20'}`} />

        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-5 ${isPro ? 'bg-indigo-100' : 'bg-amber-100'}`}>
          {isPro ? '⚡' : '👑'}
        </div>

        <h3 className="text-2xl font-black text-slate-800 text-center mb-2">
          {isPro ? t('upgradeModal.titlePro') : t('upgradeModal.titleOrg')}
        </h3>

        <p className="text-slate-500 text-center mb-6 text-sm leading-relaxed">
          <strong>{feature}</strong> {t('upgradeModal.requiresPlan', { plan: isPro ? t('common.pro') : t('common.org') })}{' '}
          {isPro ? t('upgradeModal.descPro') : t('upgradeModal.descOrg')}
        </p>

        {/* Feature list */}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6">
          {isPro ? (
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> {t('plans.proF1')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> {t('plans.proF2')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> {t('plans.proF3')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> {t('plans.proF4')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> {t('plans.proF5')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-indigo-500">✓</span> {t('plans.proF6')}</li>
            </ul>
          ) : (
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> {t('plans.orgF1')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> {t('plans.orgF2')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> {t('plans.orgF3')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> {t('plans.orgF4')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> {t('plans.orgF5')}</li>
              <li className="flex items-center gap-2 text-sm"><span className="text-amber-500">✓</span> {t('plans.orgF6')}</li>
            </ul>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={() => {
              void trackEvent('upgrade_cta_clicked', {
                feature,
                requiredPlan,
                source: 'upgrade_modal_primary',
              });
              redirectToCheckout(requiredPlan, 'upgrade_modal', (msg) => showToast('error', msg));
            }}
            className={`w-full py-4 font-bold rounded-2xl transition-all shadow-lg ${
              isPro
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30'
                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-500/30'
            }`}
          >
            {isPro ? t('upgradeModal.upgradePro') : t('upgradeModal.upgradeOrg')}
          </button>

          <button
            onClick={() => {
              void trackEvent('upgrade_cta_clicked', {
                feature,
                requiredPlan,
                source: 'upgrade_modal_compare',
              });
              onClose();
              navigate('/pricing');
            }}
            className="w-full py-3 text-sm text-indigo-600 font-semibold hover:underline"
          >
            {t('upgradeModal.compareAll')}
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm"
          >
            {t('upgradeModal.maybeLater')}
          </button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          {t('upgradeModal.footer')}
        </p>
      </div>
    </div>
  );
};

export default UpgradeModal;
