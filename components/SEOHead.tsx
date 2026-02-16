import React from 'react';
import { Helmet } from 'react-helmet-async';

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
  const siteUrl = 'https://rootwise.site';
  const fullUrl = `${siteUrl}${path}`;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="Rootwise" />
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
