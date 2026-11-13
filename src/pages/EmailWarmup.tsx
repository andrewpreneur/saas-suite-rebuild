import EmailWarmupSalesPage from "@/components/EmailWarmupSalesPage";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";
import PageSEO from "@/components/PageSEO";
import { EMAIL_WARMUP_FAQS } from "@/config/pageFaqs";
import { buildFaqJsonLd, buildBreadcrumbJsonLd, buildServiceJsonLd } from "@/lib/seoJsonLd";

const EmailWarmup = () => {
  useAffiliateTracking('email-warmup');
  return (
    <>
      <PageSEO
        title="Email Warmup for HighLevel Agencies | SaaSSuite"
        description="Done-for-you email warmup for HighLevel agencies. We build your sender reputation across LC Email, Mailgun, and custom SMTP so your emails land in the inbox."
        path="/email-warmup"
        jsonLd={[
          buildServiceJsonLd({
            name: "Done-For-You Email Warmup for HighLevel",
            description:
              "One-time email warmup service that builds sender reputation for HighLevel agencies using LC Email, Mailgun, or custom SMTP.",
            path: "/email-warmup",
            price: "199",
          }),
          buildBreadcrumbJsonLd([{ name: "Email Warmup", path: "/email-warmup" }])!,
          buildFaqJsonLd(EMAIL_WARMUP_FAQS)!,
        ]}
      />
      <EmailWarmupSalesPage />
    </>
  );
};

export default EmailWarmup;
