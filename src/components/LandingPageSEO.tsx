import PageSEO from "./PageSEO";
import { HOME_FAQS } from "@/config/pageFaqs";
import { buildFaqJsonLd } from "@/lib/seoJsonLd";

const LandingPageSEO = () => {
  return (
    <PageSEO
      title="SaaSSuite — White-Label HighLevel Tools for Agencies"
      description="The all-in-one white-label toolkit for HighLevel (GoHighLevel) agencies. Onboarding, AI support, branding, retention, and more — built for SaaS-mode agency owners."
      path="/"
      jsonLd={[
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "SaaSSuite",
          url: "https://saassuite.ai",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://saassuite.ai/?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        },
        buildFaqJsonLd(HOME_FAQS)!,
      ]}
    />
  );
};

export default LandingPageSEO;
