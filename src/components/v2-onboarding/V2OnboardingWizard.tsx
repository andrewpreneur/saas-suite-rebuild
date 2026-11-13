import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Code2, Link2, Palette, Play, Users } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { pageEnter, riseItem, staggerParent } from "@/lib/motion";
import { useWizard } from "@/components/premium/21st/wizard-steps";
import { TextShimmer } from "@/components/premium/21st/text-shimmer";
import {
  OnboardingShell,
  StepHeading,
  StepRail,
  StepSlide,
} from "@/components/premium/onboarding/OnboardingShell";
import { SuccessMark } from "@/components/premium/onboarding/pieces";

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

// One decision per screen. Branding is three short screens that save together.
const STEPS = [
  { id: 0, key: "welcome", name: "Welcome" },
  { id: 1, key: "name", name: "Agency name" },
  { id: 2, key: "colors", name: "Colors" },
  { id: 3, key: "greeting", name: "Client welcome" },
  { id: 4, key: "menu", name: "Menu link" },
  { id: 5, key: "install", name: "Install" },
  { id: 6, key: "final", name: "Final touches" },
] as const;

const LAST_STEP = STEPS.length - 1;

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
  // Presentation only: inline "name is required" after a blocked Continue, and the video overlay.
  const [showErrors, setShowErrors] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const stepKey = STEPS[currentStep].key;
  const wizard = useWizard({ total: STEPS.length, index: currentStep });

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
    if (stepKey === "greeting") {
      // Save branding data (name, colors and welcome) as the branding screens end
      await saveBrandingData();
    }

    if (stepKey === "install") {
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

      // No success toast: moving to the next step is the confirmation, and a toast would cover the action bar on phones.
    } catch (error) {
      console.error("Error saving data:", error);
      toast.error("Could not save your branding. Try again.");
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
      toast.error("Could not save your install options. Try again.");
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
      toast.success("Setup updated");
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
      <OnboardingShell>
        <motion.div
          variants={pageEnter}
          initial="hidden"
          animate="show"
          role="status"
          className="flex flex-1 flex-col items-center justify-center pb-16 text-center"
        >
          <SuccessMark />
          <h1 className="mt-8 text-h2 text-foreground sm:text-h1">You are all set</h1>
          <p className="mt-3 max-w-md text-body-lg text-muted-foreground">
            Your SaaSSuite is configured. Copilot will help you finish the last details.
          </p>
          <TextShimmer className="mt-6 text-small">Opening Copilot</TextShimmer>
        </motion.div>
      </OnboardingShell>
    );
  }

  if (isLoading) {
    return (
      <OnboardingShell width="lg">
        <div className="space-y-6 pt-16" aria-busy="true" aria-label="Loading your setup">
          <div className="px-skeleton h-2 w-full" />
          <div className="px-skeleton h-10 w-2/3" />
          <div className="px-skeleton h-5 w-1/2" />
          <div className="px-skeleton h-56 w-full" />
        </div>
      </OnboardingShell>
    );
  }

  const renderStepContent = () => {
    switch (stepKey) {
      case "welcome":
        return (
          <div>
            <StepHeading
              title={isReonboard ? "Let's set things up again" : "Welcome to SaaSSuite"}
              subtitle="Setup takes about 10 minutes. Watch the 2 minute walkthrough first, or jump straight in."
            />
            <div className="px-surface overflow-hidden rounded-xl">
              <div className="group relative aspect-video bg-muted">
                <video
                  id="onboarding-walkthrough-video"
                  key="walkthrough-video"
                  controls={videoStarted}
                  preload="none"
                  className="h-full w-full object-cover"
                  poster="/lovable-uploads/onboardingthumbnail.png"
                >
                  <source
                    src="https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1252da3c3aed7c639fcc6b.mp4"
                    type="video/mp4"
                  />
                </video>
                {!videoStarted && (
                  <button
                    type="button"
                    id="video-play-overlay"
                    aria-label="Play the walkthrough video"
                    className="absolute inset-0 flex cursor-pointer items-end justify-start p-4 focus-visible:outline-none sm:p-6"
                    onClick={() => {
                      const video = document.getElementById(
                        "onboarding-walkthrough-video",
                      ) as HTMLVideoElement;
                      setVideoStarted(true);
                      video?.play();
                    }}
                  >
                    <span className="px-brand-fill inline-flex h-12 items-center gap-2 rounded-full pl-4 pr-5 text-body font-semibold transition-transform duration-200 ease-out group-hover:scale-[1.03] group-focus-within:ring-2 group-focus-within:ring-ring group-focus-within:ring-offset-2">
                      <Play className="size-4 fill-current" aria-hidden="true" />
                      Play walkthrough
                    </span>
                  </button>
                )}
              </div>
            </div>
            <motion.ul
              variants={staggerParent}
              initial="hidden"
              animate="show"
              className="mt-6 grid gap-3 sm:grid-cols-3"
            >
              {[
                { icon: Palette, title: "Brand it", body: "Your name, colors and welcome." },
                { icon: Link2, title: "Add a menu link", body: "One link inside HighLevel." },
                { icon: Code2, title: "Paste two lines", body: "One JS and one CSS line, once." },
              ].map(({ icon: Icon, title, body }) => (
                <motion.li
                  key={title}
                  variants={riseItem}
                  className="flex items-start gap-3 rounded-lg bg-card/70 p-3"
                >
                  <span className="px-icon-chip shrink-0" aria-hidden="true">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-small font-semibold text-foreground">{title}</span>
                    <span className="block text-small text-muted-foreground">{body}</span>
                  </span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        );
      case "name":
        return (
          <BrandingStep
            section="name"
            showErrors={showErrors}
            data={data}
            updateData={updateData}
            colorPresets={COLOR_PRESETS}
          />
        );
      case "colors":
        return (
          <BrandingStep
            section="colors"
            data={data}
            updateData={updateData}
            colorPresets={COLOR_PRESETS}
          />
        );
      case "greeting":
        return (
          <BrandingStep
            section="welcome"
            data={data}
            updateData={updateData}
            colorPresets={COLOR_PRESETS}
          />
        );
      case "menu":
        return <MenuLinksStep agencyId={agencyId} />;
      case "install":
        return (
          <InstallCodeStep data={data} updateData={updateData} agencyId={agencyId} plan={plan} />
        );
      case "final":
        if ((plan || "").toUpperCase() === "STARTER") {
          return <PricingUpgradeStep email={email || undefined} />;
        }
        return <FinalTouchesStep data={data} updateData={updateData} agencyId={agencyId} />;
      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (stepKey) {
      case "name":
        return data.agencyName.trim().length > 0;
      default:
        return true;
    }
  };

  // Continue stays enabled; if the name is missing we say so next to the field.
  const attemptNext = () => {
    if (isSaving) return;
    if (!canProceed()) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    void handleNext();
  };

  const nextLabel = isSaving
    ? "Saving"
    : stepKey === "welcome"
      ? "Start setup"
      : stepKey === "greeting"
        ? "Save and continue"
        : "Continue";

  return (
    <OnboardingShell
      width="lg"
      topRight={
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkipSetup}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip setup
        </Button>
      }
      rail={
        <StepRail
          index={currentStep}
          labels={STEPS.map((s) => s.name)}
          onStepClick={(i) => setCurrentStep(i)}
        />
      }
      footer={
        <>
          {currentStep > 0 ? (
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft />
              Back
            </Button>
          ) : null}
          {currentStep < LAST_STEP ? (
            <Button
              variant="accent"
              size="lg"
              onClick={attemptNext}
              className="ml-auto min-w-[9rem]"
            >
              {nextLabel}
              {!isSaving && <ArrowRight />}
            </Button>
          ) : (
            <Button
              variant="accent"
              size="lg"
              onClick={handleComplete}
              className="ml-auto min-w-[9rem]"
            >
              {isReonboard ? "Finish and open app" : "Finish setup"}
              <Check />
            </Button>
          )}
        </>
      }
    >
      <StepSlide stepKey={stepKey} direction={wizard.direction}>
        {renderStepContent()}
      </StepSlide>
    </OnboardingShell>
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

  const plans = [
    {
      id: "basic" as const,
      name: "Basic",
      price: "$27",
      tag: "Best for new agencies",
      users: "Up to 5 users",
      features: basicFeatures,
      featured: false,
    },
    {
      id: "advanced" as const,
      name: "Advanced",
      price: "$97",
      tag: "Best for growing agencies",
      users: "Unlimited users",
      features: advancedFeatures,
      featured: true,
    },
  ];

  return (
    <div>
      <StepHeading
        title="Want more room to grow?"
        subtitle="You are on Starter. Upgrade now for more users and tools, or finish setup and decide later."
      />

      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {plans.map((p) => (
          <motion.div
            key={p.id}
            variants={riseItem}
            className={cn(
              "px-surface flex h-full flex-col p-6",
              p.featured && "shadow-raised ring-2 ring-brand",
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-h4 text-foreground">{p.name}</h3>
              <Badge variant={p.featured ? "brand" : "neutral"}>{p.tag}</Badge>
            </div>
            <div className="mb-4 flex items-baseline gap-1">
              <span className="text-h1 text-foreground">{p.price}</span>
              <span className="text-body text-muted-foreground">/ month</span>
            </div>
            <p className="mb-4 inline-flex items-center gap-2 self-start rounded-full bg-brand-subtle px-3 py-1 text-small font-medium text-brand">
              <Users className="size-4" aria-hidden="true" /> {p.users}
            </p>
            <Button
              variant={p.featured ? "accent" : "outline"}
              className="mb-4 w-full"
              onClick={() => setSelectedProduct(p.id)}
            >
              Choose {p.name}
            </Button>
            <ul className="space-y-2">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                  <PlanFeatureLabel feature={f} className="text-small text-foreground" />
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </motion.div>

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
