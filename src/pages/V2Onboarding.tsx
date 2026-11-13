import { useSearchParams } from "react-router-dom";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import V2OnboardingWizard from "@/components/v2-onboarding/V2OnboardingWizard";

const V2Onboarding = () => {
  const [searchParams] = useSearchParams();
  useMetaPixel();
  const isReonboard = searchParams.get("mode") === "reonboard";

  return <V2OnboardingWizard isReonboard={isReonboard} />;
};

export default V2Onboarding;
