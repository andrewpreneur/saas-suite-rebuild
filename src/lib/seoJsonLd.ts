/**
 * Generic JSON-LD builders for marketing pages.
 * Only ever pass content that is actually visible on the page.
 */
export const SITE_URL = "https://saassuite.ai";

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqJsonLd(items: FaqItem[]) {
  if (!items?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  if (!items?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      ...items.map((i, idx) => ({
        "@type": "ListItem",
        position: idx + 2,
        name: i.name,
        item: `${SITE_URL}${i.path}`,
      })),
    ],
  };
}

export function buildServiceJsonLd(opts: {
  name: string;
  description: string;
  path: string;
  price?: string;
  priceCurrency?: string;
  unitText?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    url: `${SITE_URL}${opts.path}`,
    provider: { "@type": "Organization", name: "SaaSSuite", url: SITE_URL },
    areaServed: "Worldwide",
    ...(opts.price
      ? {
          offers: {
            "@type": "Offer",
            price: opts.price,
            priceCurrency: opts.priceCurrency || "USD",
            url: `${SITE_URL}${opts.path}`,
            ...(opts.unitText ? { eligibleQuantity: { "@type": "QuantitativeValue", unitText: opts.unitText } } : {}),
          },
        }
      : {}),
  };
}
