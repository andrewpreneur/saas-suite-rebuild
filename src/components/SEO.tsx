import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  image?: string;
  favicon?: string;
  type?: string;
}

const SEO = ({ title, description, image, favicon, type = 'website' }: SEOProps) => {
  useEffect(() => {
    // Set title
    document.title = title;

    // Set favicon if provided
    if (favicon) {
      let faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = favicon;
    }

    // Meta tags to update
    const metaTags = [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:type', content: type },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ];

    // Add image meta tags if provided
    if (image) {
      const imageUrl = image.startsWith('http') ? image : `${window.location.origin}${image}`;
      metaTags.push(
        { property: 'og:image', content: imageUrl },
        { name: 'twitter:image', content: imageUrl },
        { property: 'og:url', content: window.location.href }
      );
    }

    // Update or create meta tags
    metaTags.forEach(({ name, property, content }) => {
      const attribute = name ? 'name' : 'property';
      const value = name || property;
      let meta = document.querySelector(`meta[${attribute}="${value}"]`) as HTMLMetaElement;
      
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, value!);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    });

    // Cleanup function to reset to defaults on unmount
    return () => {
      document.title = "SaaSSuite - HighLevel White Label Tool";
    };
  }, [title, description, image, favicon, type]);

  return null;
};

export default SEO;
