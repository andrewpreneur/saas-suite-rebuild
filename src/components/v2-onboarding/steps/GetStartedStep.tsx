import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  GraduationCap, 
  Home, 
  UserCheck, 
  ClipboardList, 
  Link2, 
  Headphones, 
  Palette 
} from "lucide-react";
import { OnboardingData } from "../V2OnboardingWizard";

interface GetStartedStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  plan: string | null;
}

type PlanTier = "STARTER" | "BASIC" | "ADVANCED";

const PLAN_LEVELS: Record<PlanTier, number> = {
  STARTER: 0,
  BASIC: 1,
  ADVANCED: 2,
};

const FEATURES = [
  {
    id: "education" as const,
    name: "Education",
    icon: GraduationCap,
    description: "Your custom video series to educate your customers on GHL. Utilize our white label videos, with no mentions of any branding, that are simple and easy to follow, and you can toggle on/off different videos for different SaaS plans, or upload your own custom videos.",
    requiredPlan: "STARTER" as PlanTier,
  },
  {
    id: "welcomeSection" as const,
    name: "Welcome Section",
    icon: Home,
    description: "Welcome your users with custom text and videos.",
    requiredPlan: "STARTER" as PlanTier,
  },
  {
    id: "onboardingChecklist" as const,
    name: "Onboarding Checklist",
    icon: ClipboardList,
    description: "Guide users through necessary onboarding activities custom made by you, or direct them to our videos.",
    requiredPlan: "STARTER" as PlanTier,
  },
  {
    id: "helpfulLinks" as const,
    name: "Helpful Links",
    icon: Link2,
    description: "Calendars, communities, upsells, anything you want to share with external links can be done through your SaaS Suite.",
    requiredPlan: "STARTER" as PlanTier,
  },
  {
    id: "branding" as const,
    name: "Branding",
    icon: Palette,
    description: "Haven't customized your white label? We've got you covered.",
    requiredPlan: "BASIC" as PlanTier,
  },
  {
    id: "loginTracking" as const,
    name: "Login Tracking",
    icon: UserCheck,
    description: "Record when users login to your platform to reduce churn and stay on top of customers.",
    requiredPlan: "ADVANCED" as PlanTier,
  },
  {
    id: "support" as const,
    name: "Support",
    icon: Headphones,
    description: "Give users access to support ticketing so your clients can submit and track support requests.",
    requiredPlan: "STARTER" as PlanTier,
  },
];

const GetStartedStep = ({ data, updateData, plan }: GetStartedStepProps) => {
  const userPlan = (plan as PlanTier) || "STARTER";
  const userLevel = PLAN_LEVELS[userPlan] ?? 0;

  const availableFeatures = FEATURES.filter(
    (f) => PLAN_LEVELS[f.requiredPlan] <= userLevel
  );

  const toggleFeature = (featureId: keyof OnboardingData["features"]) => {
    updateData({
      features: {
        ...data.features,
        [featureId]: !data.features[featureId],
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Get Started</h2>
        <p className="text-muted-foreground mt-2">
          Select the features you want to utilize in your SaaS Suite. You can always change these later.
        </p>
      </div>

      <div className="space-y-3">
        {availableFeatures.map((feature) => {
          const Icon = feature.icon;
          const isSelected = data.features[feature.id];

          return (
            <Card
              key={feature.id}
              className={`cursor-pointer transition-all border-2 ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              onClick={() => toggleFeature(feature.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Checkbox
                    id={feature.id}
                    checked={isSelected}
                    onCheckedChange={() => toggleFeature(feature.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                      <Label
                        htmlFor={feature.id}
                        className="text-base font-semibold cursor-pointer"
                      >
                        {feature.name}
                      </Label>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default GetStartedStep;
