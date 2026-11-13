import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BrandingStep from "./steps/BrandingStep";
import MenuLinksStep from "./steps/MenuLinksStep";
import InstallCodeStep from "./steps/InstallCodeStep";
import FinalTouchesStep from "./steps/FinalTouchesStep";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import PlanFeatureLabel from "@/components/pricing/PlanFeatureLabel";
import { SAME_DAY_WL_SUPPORT } from "@/constants/pricingPlans";
import { toAgencySlug } from "@/utils/agencySlug";
import { navigateWithParams } from "@/utils/preserveParams";
import { readNextPath } from "@/utils/deepLink";

export interface OnboardingData {
  // Step 1: Feature selection
  features: {
    education: boolean;
    welcomeSection: boolean;
    loginTracking: boolean;
    onboardingChecklist: boolean;
    helpfulLinks: boolean;
    support: boolean;
    branding: boolean;
  };
  // Step 2: Branding
  agencyName: string;
  primaryColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  welcomeHeadline: string;
  welcomeSubheadline: string;
  welcomeVideoUrl: string;
  welcomeVideoIsEmbed: boolean;
  // Step 3: Menu Links (read-only URLs)
  menuLinkId: string;
  // Step 4: Installation
  removeLaunchpad: boolean;
  autoNavigateOnLogin: boolean;
}

const randomAgencyId = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`)
    .replace(/[^a-f0-9]/gi, "")
    .slice(0, 32)
    .toLowerCase();

const STEPS = [
  { id: 0, name: "Walkthrough" },
  { id: 1, name: "Brand Your SaaS Suite" },
  { id: 2, name: "Add Your Menu Links" },
  { id: 3, name: "Add Your Code" },
  { id: 4, name: "Final Touches" },
];

const LAST_STEP = 4;

const COLOR_PRESETS = [
  { name: "Midnight", primary: "#000000", secondary: "#1a1a2e", tertiary: "#16213e" },
  { name: "Ocean", primary: "#1e40af", secondary: "#1e3a8a", tertiary: "#1e293b" },
  { name: "Sunset", primary: "#f97316", secondary: "#ea580c", tertiary: "#c2410c" },
  { name: "Ember", primary: "#dc2626", secondary: "#b91c1c", tertiary: "#991b1b" },
  { name: "Honey", primary: "#eab308", secondary: "#ca8a04", tertiary: "#a16207" },
  { name: "Mint", primary: "#22c55e", secondary: "#16a34a", tertiary: "#15803d" },
  { name: "Lime", primary: "#84cc16", secondary: "#65a30d", tertiary: "#4d7c0f" },
  { name: "Forest", primary: "#10b981", secondary: "#059669", tertiary: "#047857" },
  { name: "Sky", primary: "#38bdf8", secondary: "#0ea5e9", tertiary: "#0284c7" },
  { name: "Azure", primary: "#3b82f6", secondary: "#2563eb", tertiary: "#1d4ed8" },
  { name: "Rose", primary: "#f43f5e", secondary: "#e11d48", tertiary: "#be123c" },
  { name: "Coral", primary: "#fb7185", secondary: "#f43f5e", tertiary: "#e11d48" },
  { name: "Lavender", primary: "#c084fc", secondary: "#a855f7", tertiary: "#9333ea" },
  { name: "Gradient", primary: "#8b5cf6", secondary: "#a78bfa", tertiary: "#c4b5fd" },
];

interface V2OnboardingWizardProps {
  isReonboard?: boolean;
}

const V2OnboardingWizard = ({ isReonboard = false }: V2OnboardingWizardProps) => {
  const navigate = useNavigate();
  const { email, plan } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);

  const [data, setData] = useState<OnboardingData>({
    features: {
      education: true,
      welcomeSection: true,
      loginTracking: true,
      onboardingChecklist: true,
      helpfulLinks: false,
      support: true,
      branding: false,
    },
    agencyName: "",
    primaryColor: "#000000",
    secondaryColor: "#1a1a2e",
    tertiaryColor: "#16213e",
    welcomeHeadline: "Welcome to your custom software solution",
    welcomeSubheadline: "Get started with the tools and resources below.",
    welcomeVideoUrl: "",
    welcomeVideoIsEmbed: false,
    menuLinkId: "",
    removeLaunchpad: true,
    autoNavigateOnLogin: true,
  });

  // Load existing user data
  useEffect(() => {
    const loadData = async () => {
      if (!email) return;

      try {
        const { data: userData } = await supabase
          .from("saas_suite_users")
          .select("agency_id, agency_name, primary_color, secondary_color, tertiary_color")
          .ilike("email", email)
          .maybeSingle();

        if (userData) {
          // Never leave setup without a real agency id: build one from the
          // agency name, or fall back to a random id, and save it right away.
          let id = (userData.agency_id || "").trim();
          if (!id) {
            id = toAgencySlug(userData.agency_name || "") || randomAgencyId();
            await supabase.from("saas_suite_users").update({ agency_id: id }).ilike("email", email);
          }
          userData.agency_id = id;
          setAgencyId(id);
          setData((prev) => ({
            ...prev,
            agencyName: userData.agency_name || "",
            primaryColor: userData.primary_color || "#000000",
            secondaryColor: userData.secondary_color || "#1a1a2e",
            tertiaryColor: userData.tertiary_color || "#16213e",
          }));

          // Load existing v2_home_settings to preserve customizations
          if (userData.agency_id) {
            const { data: homeSettings } = await supabase
              .from("v2_home_settings")
              .select(
                "welcome_enabled, welcome_headline, welcome_subheadline, welcome_video_enabled, welcome_video_url, welcome_video_is_embed",
              )
              .eq("agency_id", userData.agency_id)
              .maybeSingle();

            if (homeSettings) {
              setData((prev) => ({
                ...prev,
                welcomeHeadline: homeSettings.welcome_headline || prev.welcomeHeadline,
                welcomeSubheadline: homeSettings.welcome_subheadline || prev.welcomeSubheadline,
                welcomeVideoUrl: homeSettings.welcome_video_url || "",
                welcomeVideoIsEmbed: homeSettings.welcome_video_is_embed || false,
              }));
            }
          }
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [email]);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      // Save branding data
      await saveBrandingData();
    }

    if (currentStep === 3) {
      // Auto-push menu config to GHL when leaving the install code step
      await saveMenuConfig();
    }

    if (currentStep < LAST_STEP) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipSetup = async () => {
    // Remember the skip locally first so the guard never bounces them back,
    // even if the save below is slow or fails.
    try {
      sessionStorage.setItem("onboarding_skipped_session", "1");
    } catch {
      /* private mode */
    }
    try {
      if (email) {
        const normalized = email.trim().toLowerCase();
        await Promise.allSettled([
          supabase.rpc("mark_initial_questions_completed", { user_email: normalized }),
          supabase
            .from("saas_suite_users")
            .update({ onboarding_completed: true, onboarding_skipped: true })
            .ilike("email", normalized),
        ]);
      }
    } catch (err) {
      console.error("Skip setup error:", err);
    }
    window.location.href = "/app/learning";
  };

  const saveBrandingData = async () => {
    if (!email || !data.agencyName.trim()) return;

    setIsSaving(true);
    try {
      const newAgencyId = toAgencySlug(data.agencyName) || agencyId || randomAgencyId();

      // Update user with branding data
      const { error } = await supabase
        .from("saas_suite_users")
        .update({
          agency_name: data.agencyName.trim(),
          agency_id: newAgencyId,
          primary_color: data.primaryColor,
          secondary_color: data.secondaryColor,
          tertiary_color: data.tertiaryColor,
        })
        .ilike("email", email);

      if (error) throw error;

      setAgencyId(newAgencyId);

      // If welcome section is enabled, save welcome settings
      if (data.features.welcomeSection && newAgencyId) {
        await supabase.from("v2_home_settings").upsert(
          {
            agency_id: newAgencyId,
            welcome_enabled: true,
            welcome_headline: data.welcomeHeadline,
            welcome_subheadline: data.welcomeSubheadline,
            welcome_video_enabled: !!data.welcomeVideoUrl,
            welcome_video_url: data.welcomeVideoUrl || null,
            welcome_video_is_embed: data.welcomeVideoIsEmbed,
          },
          { onConflict: "agency_id" },
        );
      }

      toast.success("Settings saved!");
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const saveMenuConfig = async () => {
    if (!agencyId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.from("agency_menu_config").upsert(
        {
          agency_id: agencyId,
          menu_link_id: data.menuLinkId || null,
          remove_launchpad: data.removeLaunchpad,
          auto_navigate_on_login: data.autoNavigateOnLogin,
        },
        { onConflict: "agency_id" },
      );
      if (error) throw error;
    } catch (err) {
      console.error("Error auto-saving menu config:", err);
      toast.error("Failed to save menu config");
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!isReonboard) {
      // Mark initial questions as completed only on first-time onboarding
      if (email) {
        await supabase.rpc("mark_initial_questions_completed", {
          user_email: email,
        });
        // They finished — clear the skipped flag / reminder
        await supabase
          .from("saas_suite_users")
          .update({ onboarding_skipped: false, onboarding_reminder_dismissed: true })
          .ilike("email", email);
      }
    }

    if (isReonboard) {
      toast.success("Re-onboarding complete!");
      window.location.href = "/app";
    } else {
      setShowCongrats(true);
      setTimeout(() => {
        const next = readNextPath();
        window.location.href = navigateWithParams(
          /^\/(app\/)?copilot/.test(next || "") ? next : "/app/copilot/first-time",
        );
      }, 3000);
    }
  };

  if (showCongrats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">You're all set! 🎉</h2>
          <p className="text-muted-foreground max-w-md">
            Your SaaS Suite is configured. Let's connect you with your AI CoPilot to finish up.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Welcome to SaaS Suite</h2>
              <p className="text-muted-foreground">
                Watch this quick walkthrough to see what's possible.
              </p>
            </div>
            <div className="relative w-full rounded-lg overflow-hidden shadow-elevated bg-muted/20">
              <div className="aspect-video relative group">
                <video
                  id="onboarding-walkthrough-video"
                  key="walkthrough-video"
                  controls
                  preload="metadata"
                  className="w-full h-full object-cover"
                  poster="/lovable-uploads/onboardingthumbnail.png"
                >
                  <source
                    src="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1252da3c3aed7c639fcc6b.mp4"
                    type="video/mp4"
                  />
                </video>
                {/* Play overlay */}
                <div
                  id="video-play-overlay"
                  className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => {
                    const video = document.getElementById(
                      "onboarding-walkthrough-video",
                    ) as HTMLVideoElement;
                    const overlay = document.getElementById("video-play-overlay");
                    if (video && overlay) {
                      overlay.style.display = "none";
                      video.play();
                    }
                  }}
                >
                  <div className="w-[57.6px] h-[57.6px] rounded-full bg-purple-600 flex items-center justify-center shadow-lg transition-transform hover:scale-105">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="white"
                      className="w-7 h-7 ml-1"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={handleNext}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              Next: Brand Your SaaS Suite
            </Button>
            <div className="bg-muted/30 border border-border rounded-lg p-5 space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                SaaSSuite Onboarding Basics:
              </h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span className="text-muted-foreground">Configure your SaaSSuite features</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span className="text-muted-foreground">Install your custom menu links</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                  <span className="text-muted-foreground">
                    Install one JS, and one CSS script in HighLevel
                  </span>
                </li>
              </ul>
              <p className="text-sm text-purple-400 font-medium pt-1">
                Customize, manage, and grow your SaaS all from your SaaSSuite app, right here.
              </p>
            </div>
          </div>
        );
      case 1:
        return <BrandingStep data={data} updateData={updateData} colorPresets={COLOR_PRESETS} />;
      case 2:
        return <MenuLinksStep agencyId={agencyId} />;
      case 3:
        return (
          <InstallCodeStep data={data} updateData={updateData} agencyId={agencyId} plan={plan} />
        );
      case 4:
        if ((plan || "").toUpperCase() === "STARTER") {
          return <PricingUpgradeStep email={email || undefined} />;
        }
        return <FinalTouchesStep data={data} updateData={updateData} agencyId={agencyId} />;
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.agencyName.trim().length > 0;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Layout */}
      <div className="hidden md:flex min-h-screen">
        {/* Left Sidebar - Steps */}
        <div className="w-80 border-r border-border bg-card p-8 flex flex-col">
          <div className="space-y-2 flex-1">
            {STEPS.map((step) => {
              const isComplete = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-3 py-3 px-4 rounded-lg transition-colors",
                    isCurrent && "bg-muted",
                    !isCurrent && !isComplete && "opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                      isComplete && "bg-primary text-primary-foreground",
                      isCurrent && "bg-primary text-primary-foreground",
                      !isCurrent && !isComplete && "bg-muted-foreground/20 text-muted-foreground",
                    )}
                  >
                    {isComplete ? <Check className="w-4 h-4" /> : step.id}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      (isCurrent || isComplete) && "text-foreground",
                      !isCurrent && !isComplete && "text-muted-foreground",
                    )}
                  >
                    {step.name}
                  </span>
                </div>
              );
            })}
          </div>

          <Button
            variant="ghost"
            onClick={handleSkipSetup}
            className="mt-auto text-muted-foreground"
          >
            Skip Setup
          </Button>
        </div>

        {/* Right Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-8 lg:p-12">
            {renderStepContent()}
            {/* Navigation Buttons */}
            {currentStep > 0 && (
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>

                {currentStep < LAST_STEP ? (
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed() || isSaving}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    {isSaving
                      ? "Saving..."
                      : currentStep === 1
                        ? "Begin Platform Setup"
                        : "Continue"}
                  </Button>
                ) : (
                  <Button
                    onClick={handleComplete}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    Continue to App
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex flex-col min-h-screen">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-48">
          <div className="max-w-lg mx-auto">{renderStepContent()}</div>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
          {/* Step indicators */}
          <div className="flex justify-center gap-2 mb-3">
            {STEPS.map((step) => {
              const isComplete = currentStep > step.id;
              const isCurrent = currentStep === step.id;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isComplete && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary text-primary-foreground",
                    !isCurrent && !isComplete && "bg-muted text-muted-foreground",
                  )}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : step.id}
                </div>
              );
            })}
          </div>

          {/* Buttons */}
          {currentStep > 0 && (
            <div className="flex items-center gap-3 mb-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                Back
              </Button>

              {currentStep < LAST_STEP ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceed() || isSaving}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isSaving ? "Saving..." : currentStep === 1 ? "Begin Platform Setup" : "Continue"}
                </Button>
              ) : (
                <Button
                  onClick={handleComplete}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Continue to App
                </Button>
              )}
            </div>
          )}

          <Button
            variant="ghost"
            onClick={handleSkipSetup}
            className="w-full text-muted-foreground"
          >
            Skip Setup
          </Button>
        </div>
      </div>
    </div>
  );
};

export default V2OnboardingWizard;

// Inline pricing upgrade step shown only for STARTER plan as the final onboarding step
const PricingUpgradeStep = ({ email }: { email?: string }) => {
  const [selectedProduct, setSelectedProduct] = useState<"basic" | "advanced" | null>(null);

  const basicFeatures = [
    "Everything in Starter, plus…",
    "White Label Branding Tool",
    "Toggle On/Off Videos",
    "AI Offer & Ads Tool",
    "Up to 5 users",
  ];
  const advancedFeatures = [
    "Everything in Basic, plus…",
    "3 Custom SaaS Plan Onboarding Experiences",
    "SaaS Health Dashboard",
    "Login Tracking",
    "Onboarding Tracking",
    "Voice AI Onboarding",
    "Unlimited 24/7 Human & AI Chat Support",
    SAME_DAY_WL_SUPPORT,
    "Unlimited Users",
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-foreground">Choose your plan</h2>
        <p className="text-muted-foreground">
          Unlock more users and advanced tools to grow your SaaS.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic */}
        <div className="relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="inline-block bg-white text-gray-700 text-xs font-semibold px-3 py-1 rounded-full border border-gray-200 shadow-sm">
              Best for New Agencies
            </span>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200 flex flex-col shadow-sm h-full">
            <h3 className="text-xl font-semibold text-gray-900 mb-1">Basic</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold text-gray-900">$27</span>
              <span className="text-gray-500">/ month</span>
            </div>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1 mb-4 self-start">
              <Users className="w-4 h-4" /> Up to 5 users
            </div>
            <Button
              className="w-full bg-[#8125D3] hover:bg-[#6f1fb5] text-white rounded-xl mb-4"
              onClick={() => setSelectedProduct("basic")}
            >
              Subscribe
            </Button>
            <div className="space-y-2">
              {basicFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#8125D3] mt-0.5 flex-shrink-0" />
                  <PlanFeatureLabel feature={f} className="text-gray-700 text-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Advanced */}
        <div className="relative md:scale-[1.03]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
            <span className="inline-block bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full border border-purple-700 shadow-sm">
              Best for Growing Agencies
            </span>
          </div>
          <div className="bg-white rounded-2xl p-6 border-2 border-purple-500 flex flex-col shadow-md h-full">
            <h3 className="text-xl font-semibold text-gray-900 mb-1">Advanced</h3>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-4xl font-bold text-gray-900">$97</span>
              <span className="text-gray-500">/ month</span>
            </div>
            <div className="inline-flex items-center gap-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-3 py-1 mb-4 self-start">
              <Users className="w-4 h-4" /> Unlimited users
            </div>
            <Button
              className="w-full bg-[#8125D3] hover:bg-[#6f1fb5] text-white rounded-xl mb-4"
              onClick={() => setSelectedProduct("advanced")}
            >
              Subscribe
            </Button>
            <div className="space-y-2">
              {advancedFeatures.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#8125D3] mt-0.5 flex-shrink-0" />
                  <PlanFeatureLabel feature={f} className="text-gray-700 text-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <StripeEmbeddedCheckout
        plan={selectedProduct || "basic"}
        open={!!selectedProduct}
        onOpenChange={(open) => {
          if (!open) setSelectedProduct(null);
        }}
        email={email}
        onComplete={async () => {
          if (email) {
            try {
              await supabase.rpc("mark_initial_questions_completed", {
                user_email: email,
              });
            } catch (e) {
              console.error("Failed to mark initial questions completed after upgrade:", e);
            }
          }
        }}
      />
    </div>
  );
};
