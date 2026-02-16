import React from 'react';
import { useTranslation } from 'react-i18next';
import SEOHead from '../components/SEOHead';

const PrivacyPolicyPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-24">
      <SEOHead
        title={`${t('footer.privacyPolicy')} - Rootwise`}
        description={`${t('footer.privacyPolicy')} for Rootwise by EventNexus OÜ.`}
        path="/privacy-policy"
      />

      <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-10 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900 mb-2">{t('footer.privacyPolicy')}</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: February 15, 2026</p>

        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">1. Data Controller</h2>
            <p>EventNexus OÜ (reg. no. 17431557), Põltsamaa, Estonia, operates Rootwise and is the data controller for personal data processed through this platform.</p>
            <p className="mt-2">Contact: villu@mail.eventnexus.eu</p>
            <p>Website: www.eventnexus.eu</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">2. What We Collect</h2>
            <p>We may process account details (name, email), profile information (age range, interests, skills, avatar), platform activity (quests, messages, community interactions), and technical data needed for security and service reliability.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">3. Why We Process Data</h2>
            <p>We process personal data to provide the service, maintain account access, enable social and community features, improve product quality, prevent abuse, and meet legal obligations.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">4. Legal Basis</h2>
            <p>Processing is based on contract performance (providing the platform), legitimate interest (security, product improvement), consent where required, and compliance with applicable law.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">5. Sharing & Processors</h2>
            <p>We use trusted service providers (such as hosting, analytics, and payment infrastructure) that process data on our behalf under appropriate safeguards. We do not sell personal data.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">6. Data Retention</h2>
            <p>We keep data only as long as needed for service delivery, legal compliance, dispute resolution, and legitimate business needs. Retention periods may differ by data type.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">7. Your Rights</h2>
            <p>You may request access, correction, deletion, restriction, or portability of personal data, and object to certain processing where applicable. You may also lodge a complaint with your local supervisory authority.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">8. Security</h2>
            <p>We apply technical and organizational measures to protect data. No online system is 100% secure, but we continuously improve safeguards and incident response processes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">9. Contact</h2>
            <p>For privacy requests and questions, email villu@mail.eventnexus.eu. Typical response time: within 24 hours.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;