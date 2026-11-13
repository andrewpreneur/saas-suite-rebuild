import { Helmet } from "react-helmet-async";
import { useStripStaticSeo } from "@/hooks/useStripStaticSeo";

const DEFAULT_SITE = "https://saassuite.ai";
export const DEFAULT_SOCIAL_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/8LmhTgRQpIdlh6b3Mug3nk8TeU52/social-images/social-1763142613566-saassuitebusinesscard.png";

/** Social crawlers keep a root-relative og:image on the page host. Always publish an absolute URL. */
export function socialImageUrl(image: string, site = DEFAULT_SITE) {
  if (/^https?:\/\//i.test(image)) return image;
  if (image.startsWith("//")) return `https:${image}`;
  const origin = site.replace(/\/+$/, "");
  if (image.startsWith("/")) return `${origin}${image}`;
  return image;
}

interface PageSEOProps {
  title: string;
  description: string;
  path: string; // e.g. "/webinar" — used for canonical + og:url
  /** Origin for canonical and social URLs. Defaults to https://saassuite.ai. */
  site?: string;
  image?: string;
  /** Social title when it should differ from the browser title. */
  ogTitle?: string;
  /** Social description when it should differ from the meta description. */
  ogDescription?: string;
  /** Optional keywords. Omit when the page has none. */
  keywords?: string;
  type?: string; // og:type — default "website"
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

/**
 * Per-page metadata via react-helmet-async.
 * NOTE: Helmet mutates <head> client-side after hydration. JS-executing
 * crawlers (Googlebot) see these tags; non-JS social-preview crawlers
 * only see the static index.html fallback tags.
 */
const PageSEO = ({
  title,
  description,
  path,
  site = DEFAULT_SITE,
  image = DEFAULT_SOCIAL_IMAGE,
  ogTitle,
  ogDescription,
  keywords,
  type = "website",
  jsonLd,
  noindex = false,
}: PageSEOProps) => {
  const url = `${site}${path}`;
  const socialTitle = ogTitle || title;
  const socialDescription = ogDescription || description;
  const socialImage = socialImageUrl(image, site);

  useStripStaticSeo(title, description, url, socialImage, type);

  const jsonLdArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords ? <meta name="keywords" content={keywords} /> : null}
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={socialTitle} />
      <meta property="og:description" content={socialDescription} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={socialImage} />
      <meta property="og:site_name" content="SaaSSuite" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={socialTitle} />
      <meta name="twitter:description" content={socialDescription} />
      <meta name="twitter:image" content={socialImage} />

      {jsonLdArray.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
};

export default PageSEO;