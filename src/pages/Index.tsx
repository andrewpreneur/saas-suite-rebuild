import LandingPage from "@/components/LandingPage";
import LandingPageSEO from "@/components/LandingPageSEO";
import { useAffiliateTracking } from "@/hooks/useAffiliateTracking";

const Index = () => {
  useAffiliateTracking('home');
  
  return (
    <>
      <LandingPageSEO />
      <LandingPage />
    </>
  );
};

export default Index;
