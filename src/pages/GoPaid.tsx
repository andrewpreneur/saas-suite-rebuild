import GoLandingPage from "@/components/GoLandingPage";
import PageSEO from "@/components/PageSEO";

const GoPaid = () => (
  <>
    <PageSEO
      title="Get Started with SaaSSuite | HighLevel White-Label Toolkit"
      description="Kickstart your HighLevel SaaS with SaaSSuite — white-label branding, onboarding, and AI support in one place."
      path="/go-paid"
    />
    <GoLandingPage variant="hero" ctaMode="paid" />
  </>
);

export default GoPaid;