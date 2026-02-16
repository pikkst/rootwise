import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

interface SEOHeadProps {
  title?: string;
  description?: string;
  path?: string;
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'Rootwise - Intergenerational Wisdom Hub',
  description = 'Connect generations through collaborative Quests, shared wisdom, and AI-powered tools. Combat loneliness and foster lifelong learning.',
  path = '/',
}) => {
  const { i18n } = useTranslation();
  const siteUrl = 'https://rootwise.site';
  const currentLang = i18n.language || 'en';
  // Build locale-prefixed canonical URL
  const langPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
  const fullUrl = `${siteUrl}${langPrefix}${path}`;

  return (
    <Helmet>
      <html lang={currentLang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />

      {/* hreflang tags for all supported languages */}
      {SUPPORTED_LANGUAGES.map(lang => {
        const prefix = lang.code === 'en' ? '' : `/${lang.code}`;
        return (
          <link
            key={lang.code}
            rel="alternate"
            hrefLang={lang.code}
            href={`${siteUrl}${prefix}${path}`}
          />
        );
      })}
      <link rel="alternate" hrefLang="x-default" href={`${siteUrl}${path}`} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="Rootwise" />
      <meta property="og:locale" content={currentLang} />
      <meta property="og:image" content={`${siteUrl}/og-image.png`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Rootwise - Intergenerational Wisdom Hub" />
      <meta property="fb:page_id" content="61588303257095" />
      <meta property="article:publisher" content="https://www.facebook.com/profile.php?id=61588303257095" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="theme-color" content="#6366f1" />
    </Helmet>
  );
};

export default SEOHead;
