import GoLandingPage from "@/components/GoLandingPage";
import PageSEO from "@/components/PageSEO";

const BreakdownPaid = () => (
  <>
    <PageSEO
      title="SaaSSuite Full Breakdown | Every HighLevel Tool Included"
      description="See exactly what's included in SaaSSuite — the complete white-label toolkit for HighLevel SaaS agencies."
      path="/breakdown-paid"
    />
    <GoLandingPage variant="breakdown" ctaMode="paid" showBreakdownSection />
  </>
);

export default BreakdownPaid;