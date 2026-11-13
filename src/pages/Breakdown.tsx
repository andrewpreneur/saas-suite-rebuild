import GoLandingPage from "@/components/GoLandingPage";
import PageSEO from "@/components/PageSEO";

const Breakdown = () => (
  <>
    <PageSEO
      title="SaaSSuite Breakdown — See Every HighLevel Tool Inside"
      description="A full breakdown of what SaaSSuite includes for HighLevel agencies: onboarding, AI support, branding, retention, and more."
      path="/breakdown"
    />
    <GoLandingPage variant="breakdown" ctaMode="dual" showBreakdownSection />
  </>
);

export default Breakdown;