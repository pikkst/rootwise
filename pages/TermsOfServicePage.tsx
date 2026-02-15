import React from 'react';
import SEOHead from '../components/SEOHead';

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-24">
      <SEOHead
        title="Terms of Service - Rootwise"
        description="Terms of Service for Rootwise by EventNexus OÜ."
        path="/terms-of-service"
      />

      <div className="bg-white border border-slate-200 rounded-3xl p-8 md:p-10 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last updated: February 15, 2026</p>

        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">1. Operator</h2>
            <p>Rootwise is operated by EventNexus OÜ (reg. no. 17431557), Põltsamaa, Estonia.</p>
            <p className="mt-2">Contact: villu@mail.eventnexus.eu</p>
            <p>Website: www.eventnexus.eu</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">2. Acceptance of Terms</h2>
            <p>By creating an account or using Rootwise, you agree to these Terms and applicable laws. If you do not agree, do not use the service.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">3. Accounts & Eligibility</h2>
            <p>You are responsible for account accuracy and account security. You must not impersonate others or use the platform for unlawful or abusive purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">4. Acceptable Use</h2>
            <p>You agree not to post harmful, illegal, infringing, or abusive content; attempt unauthorized access; or interfere with platform integrity, availability, or other users.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">5. User Content</h2>
            <p>You retain ownership of content you upload. By posting content, you grant Rootwise a limited license to host, display, and process that content for platform operation.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">6. Paid Features & Billing</h2>
            <p>Some functionality is available through paid plans. Billing, renewals, and cancellations are managed via the payment provider flow shown in the app.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">7. Suspension & Termination</h2>
            <p>We may suspend or terminate accounts that violate these Terms, harm users, or create security/legal risks.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">8. Disclaimer & Liability</h2>
            <p>The service is provided on an "as is" and "as available" basis. To the maximum extent permitted by law, EventNexus OÜ is not liable for indirect, incidental, or consequential damages.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">9. Changes to Terms</h2>
            <p>We may update these Terms from time to time. Updated versions are effective upon publication, with the updated date shown on this page.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-800 mb-2">10. Contact</h2>
            <p>Questions about these Terms can be sent to villu@mail.eventnexus.eu. Typical response time: within 24 hours.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;