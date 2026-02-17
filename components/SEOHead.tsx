import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  path?: string;
  type?: 'website' | 'article';
  imageUrl?: string;
  structuredData?: object | object[];
}

const DEFAULT_KEYWORDS =
  'activities with grandparents, things to do with parents, intergenerational activities, family bonding, connecting generations, combat loneliness elderly, lifelong learning, wisdom sharing, family quest app, cross-generational community, senior social platform';

const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'Rootwise — Activities With Parents & Grandparents | Intergenerational Platform',
  description = 'Rootwise connects parents, grandparents and grandchildren through shared Quests — structured activities that combat loneliness, transfer wisdom and build lasting family bonds.',
  keywords = DEFAULT_KEYWORDS,
  path = '/',
  type = 'website',
  imageUrl,
  structuredData,
}) => {
  const { i18n } = useTranslation();
  const siteUrl = 'https://rootwise.site';
  const currentLang = i18n.language || 'en';
  const langPrefix = currentLang === 'en' ? '' : `/${currentLang}`;
  const fullUrl = `${siteUrl}${langPrefix}${path}`;
  const ogImage = imageUrl || `${siteUrl}/og-image.png`;

  // Normalise structured data to array for multiple LD+JSON blocks
  const ldJsonItems: object[] = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];

  return (
    <Helmet>
      <html lang={currentLang} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content="Rootwise" />
      <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
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
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="Rootwise" />
      <meta property="og:locale" content={currentLang} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={title} />
      <meta property="fb:page_id" content="61588303257095" />
      <meta property="article:publisher" content="https://www.facebook.com/profile.php?id=61588303257095" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional */}
      <meta name="theme-color" content="#6366f1" />

      {/* Per-page structured data */}
      {ldJsonItems.map((item, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(item)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEOHead;

