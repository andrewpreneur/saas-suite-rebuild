import BrandingToolSalesPage from "@/components/BrandingToolSalesPage";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";
import PageSEO from "@/components/PageSEO";
import { BRANDING_TOOL_FAQS } from "@/config/pageFaqs";
import { buildFaqJsonLd, buildBreadcrumbJsonLd, buildServiceJsonLd } from "@/lib/seoJsonLd";

const BrandingTool = () => {
  useAffiliateTracking('branding-tool');
  return (
    <>
      <PageSEO
        title="HighLevel White-Label Branding Tool | SaaSSuite"
        description="Fully white-label your HighLevel SaaS — custom colors, logos, fonts, login page, and buttons. Ship a polished, on-brand platform in minutes."
        path="/branding-tool"
        jsonLd={[
          buildServiceJsonLd({
            name: "HighLevel White-Label Branding Tool",
            description:
              "Generate custom CSS, colors, fonts, and login-page branding so HighLevel looks like your own software.",
            path: "/branding-tool",
          }),
          buildBreadcrumbJsonLd([{ name: "Branding Tool", path: "/branding-tool" }])!,
          buildFaqJsonLd(BRANDING_TOOL_FAQS)!,
        ]}
      />
      <BrandingToolSalesPage />
    </>
  );
};

export default BrandingTool;
