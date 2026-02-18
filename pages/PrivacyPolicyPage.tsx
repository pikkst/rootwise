import React from 'react';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';
import { LegalLocale, PRIVACY_CONTENT } from '../utils/legalContent';

const PrivacyPolicyPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage?.slice(0, 2) || 'en') as LegalLocale;
  const content = PRIVACY_CONTENT[locale] ?? PRIVACY_CONTENT.en;

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-24">
      <SEOHead
        title={`${t('footer.privacyPolicy')} - Rootwise`}
        description={`${t('footer.privacyPolicy')} for Rootwise by EventNexus OÜ.`}
        path="/privacy-policy"
      />

      <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-10 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900 mb-2">{t('footer.privacyPolicy')}</h1>
        <p className="text-sm text-slate-500 mb-8">{content.updated}</p>

        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
          {content.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-bold text-slate-800 mb-2">{section.title}</h2>
              {section.paragraphs.map((paragraph, index) => (
                <p key={`${section.title}-${index}`} className={index > 0 ? 'mt-2' : ''}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;