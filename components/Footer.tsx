import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';

const Footer: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <footer className="py-10 md:py-16 border-t border-slate-100 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          <div>
            <div className="flex items-center gap-2 font-bold text-indigo-600 text-xl mb-4">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-sm font-black">R</div>
              {t('common.brand')}
            </div>
            <p className="text-slate-500 text-sm leading-relaxed">{t('footer.tagline')}</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-4">{t('footer.platform')}</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button onClick={() => navigate('/quests')} className="hover:text-indigo-600 transition-colors">{t('footer.browseQuests')}</button></li>
              <li><button onClick={() => navigate('/community')} className="hover:text-indigo-600 transition-colors">{t('footer.communities')}</button></li>
              <li><button onClick={() => navigate('/ai-nexus')} className="hover:text-indigo-600 transition-colors">{t('footer.aiMentor')}</button></li>
              <li><button onClick={() => navigate('/pricing')} className="hover:text-indigo-600 transition-colors">{t('footer.pricing')}</button></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-4">{t('footer.company')}</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button onClick={() => navigate('/how-it-works')} className="hover:text-indigo-600 transition-colors">{t('footer.howItWorks')}</button></li>
              <li><button onClick={() => navigate('/auth')} className="hover:text-indigo-600 transition-colors">{t('footer.createAccount')}</button></li>
              <li><a href="mailto:villu@mail.eventnexus.eu" className="hover:text-indigo-600 transition-colors">{t('footer.contact')}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-800 mb-4">{t('footer.legal')}</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><button onClick={() => navigate('/privacy-policy')} className="hover:text-indigo-600 transition-colors">{t('footer.privacyPolicy')}</button></li>
              <li><button onClick={() => navigate('/terms-of-service')} className="hover:text-indigo-600 transition-colors">{t('footer.termsOfService')}</button></li>
            </ul>

            <h4 className="font-bold text-slate-800 mt-6 mb-3">{t('footer.followUs')}</h4>
            <a
              href="https://www.facebook.com/profile.php?id=61588303257095"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-[#1877F2] transition-colors"
            >
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
              </svg>
              {t('footer.facebookAlt')}
            </a>
          </div>
        </div>
        <div className="pt-8 border-t border-slate-100 flex flex-col gap-2 text-slate-500 text-sm">
          <p>{t('footer.copyright')}</p>
          <p>{t('footer.legalEntity')}</p>
          <LanguageSelector footer />
          <p>
            <a href="mailto:villu@mail.eventnexus.eu" className="hover:text-indigo-600 transition-colors">villu@mail.eventnexus.eu</a>
          </p>
          <p>{t('footer.responseTime')}</p>
          <p>
            <a href="https://www.eventnexus.eu" target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 transition-colors">www.eventnexus.eu</a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;