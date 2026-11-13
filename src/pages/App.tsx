import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useMetaPixel } from "@/hooks/useMetaPixel";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { navigateWithParams } from "@/utils/preserveParams";
import { rememberNextPath, clearNextPath } from "@/utils/deepLink";
import { LEARNING_HUB_PATH } from "@/lib/onboardingArrival";
import { shouldAutoStart } from "@/lib/tourSchedule";
import { pathForAppTool, resolveAppTool } from "@/lib/appRoutes";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import TrialExpiredOverlay from "@/components/TrialExpiredOverlay";
import PaymentGraceBanner from "@/components/PaymentGraceBanner";
import FreeTrialBanner from "@/components/FreeTrialBanner";
import darkBanner from "@/assets/saassuite-dark-banner.png.asset.json";
import { motion, MotionConfig } from "framer-motion";
import { pageEnter } from "@/lib/motion";
import { AppTopBar } from "@/components/premium/AppTopBar";
import appBackground from "@/assets/app-background.png.asset.json";
import { newUi } from "@/lib/uiVersion";
import CancelNoticeBanner from "@/components/CancelNoticeBanner";
import PastDueBanner from "@/components/PastDueBanner";
import OfferCountdownWidget from "@/components/bump/OfferCountdownWidget";
import OnboardingReminderDialog from "@/components/OnboardingReminderDialog";
import { AppSidebar } from "@/components/AppSidebar";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { ActiveAccountNotice } from "@/components/ActiveAccountNotice";
import { LoginAsUser } from "@/components/LoginAsUser";
import InstallChecklistButton from "@/components/onboarding/InstallChecklistButton";
import OnboardingTool from "@/components/OnboardingTool";
import ActivityDashboard from "@/components/ActivityDashboard";
import SaaSHealth from "@/components/SaaSHealth";
import Dashboard from "@/components/Dashboard";
import StartHere from "@/components/start-here/StartHere";
import StreamlineTool from "@/components/StreamlineTool";
import BrandingTool from "@/components/BrandingTool";
import MarketingTool from "@/components/MarketingTool";
import WalkthroughTool from "@/components/WalkthroughTool";
import EmailWarmupRequest from "@/components/EmailWarmupRequest";
import { FreeLeadsRequest } from "@/components/FreeLeadsRequest";
import AffiliateDashboard from "@/components/AffiliateDashboard";
import SupportFeatures from "@/components/SupportFeatures";
import SupportDashboard from "@/components/SupportDashboard";
import ClientHub from "@/components/ClientHub";
import InitialQuestionsGuard from "@/components/InitialQuestionsGuard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { MobileDesktopOverlay } from "@/components/MobileDesktopOverlay";
import { KitReturnLink } from "@/components/dashboard/KitReturnLink";
import { CoPilotIntroTooltip } from "@/components/chat-copilot/CoPilotIntroTooltip";
import { useCoPilot } from "@/contexts/CoPilotContext";
import ChallengeTool from "@/components/challenge/ChallengeTool";
import { UserLimitBanner } from "@/components/UserLimitBanner";
import { ClientsManager } from "@/components/ClientsManager";
import SimpleOnboardingManager from "@/components/SimpleOnboardingManager";
import WorkflowsManager from "@/components/WorkflowsManager";
import KnowledgeBase from "@/components/KnowledgeBase";
import Snapshots from "@/components/Snapshots";
import CommunityHub, { resolveCommunityDeepLink } from "@/components/community/CommunityHub";
import CommunityGatePreview from "@/components/community/CommunityGatePreview";
import OnboardingCallsManager from "@/components/OnboardingCallsManager";
import AgencySupportManager from "@/components/AgencySupportManager";
import AgentsPage from "@/components/agents/AgentsPage";
import ToolAccessGate from "@/components/ToolAccessGate";
import {
  GraduationCap,
  Zap,
  Palette,
  Megaphone,
  BarChart3,
  Play,
  Mail,
  Gift,
  Headphones,
  Activity,
  LayoutDashboard,
  MessageSquare,
  LayoutGrid,
  CheckCircle2,
} from "lucide-react";
interface Feature {
  id: string;
  name: string;
  tabId: string;
  description: string;
  recommended: boolean;
}
const highlevelFeatures: Feature[] = [
  {
    id: "1",
    name: "LaunchPad",
    tabId: "#sb_launchpad",
    description: "Main dashboard overview",
    recommended: false,
  },
  {
    id: "2",
    name: "Memberships",
    tabId: "#sb_memberships",
    description: "Membership site management",
    recommended: true,
  },
  {
    id: "3",
    name: "Automation",
    tabId: "#sb_automation",
    description: "Workflow automation tools",
    recommended: false,
  },
  {
    id: "4",
    name: "Sites & Funnels",
    tabId: "#sb_sites",
    description: "Website and funnel builder",
    recommended: false,
  },
  {
    id: "5",
    name: "Media",
    tabId: "#sb_app-media",
    description: "File and media management",
    recommended: true,
  },
  {
    id: "6",
    name: "Reputation",
    tabId: "#sb_reputation",
    description: "Review management system",
    recommended: true,
  },
  {
    id: "7",
    name: "Reporting",
    tabId: "#sb_reporting",
    description: "Analytics and reports",
    recommended: false,
  },
  {
    id: "8",
    name: "Marketplace",
    tabId: "#sb_app-marketplace",
    description: "App marketplace integration",
    recommended: true,
  },
  {
    id: "9",
    name: "Mobile App",
    tabId: "#sb_location-mobile-app",
    description: "Mobile app management",
    recommended: true,
  },
  {
    id: "10",
    name: "Email Marketing",
    tabId: "#sb_email-marketing",
    description: "Email campaign tools",
    recommended: false,
  },
  {
    id: "11",
    name: "Payments",
    tabId: "#sb_payments",
    description: "Payment processing",
    recommended: false,
  },
  {
    id: "12",
    name: "Opportunities",
    tabId: "#sb_opportunities",
    description: "Sales pipeline management",
    recommended: false,
  },
  {
    id: "13",
    name: "Contacts",
    tabId: "#sb_contacts",
    description: "Contact management",
    recommended: false,
  },
  {
    id: "14",
    name: "Calendars",
    tabId: "#sb_calendars",
    description: "Appointment scheduling",
    recommended: false,
  },
  {
    id: "15",
    name: "Conversations",
    tabId: "#sb_conversations",
    description: "Communication hub",
    recommended: false,
  },
  {
    id: "16",
    name: "Dashboard",
    tabId: "#sb_dashboard",
    description: "Main analytics dashboard",
    recommended: false,
  },
  {
    id: "17",
    name: "AI Agents",
    tabId: "#sb_AI Agents",
    description: "AI-powered automation agents",
    recommended: true,
  },
  {
    id: "18",
    name: "Ask AI",
    tabId: "#sb_ask-ai",
    description: "HighLevel AI assistant",
    recommended: false,
  },
];
type ToolType =
  | "start-here"
  | "learning"
  | "streamline"
  | "branding"
  | "onboarding"
  | "marketing"
  | "activity-dashboard"
  | "saas-health"
  | "walkthrough"
  | "email-warmup"
  | "free-leads"
  | "support-features"
  | "support"
  | "client-hub"
  | "settings"
  | "affiliate-dashboard"
  | "clients"
  | "simple-onboarding"
  | "workflows"
  | "knowledge-base"
  | "dashboard"
  | "challenge"
  | "snapshots"
  | "community"
  | "onboarding-calls"
  | "agency-support"
  | "agents";

const VALID_TOOLS: ToolType[] = [
  "start-here",
  "learning",
  "streamline",
  "branding",
  "onboarding",
  "marketing",
  "activity-dashboard",
  "saas-health",
  "walkthrough",
  "email-warmup",
  "free-leads",
  "support-features",
  "support",
  "client-hub",
  "settings",
  "affiliate-dashboard",
  "clients",
  "simple-onboarding",
  "workflows",
  "knowledge-base",
  "dashboard",
  "challenge",
  "snapshots",
  "community",
  "onboarding-calls",
  "agency-support",
  "agents",
];

const TOOL_ALIASES: Record<string, string> = {
  "start-here": "learning",
  design: "branding",
  layouts: "branding",
  themes: "branding",
  "client-support": "support",
  resources: "learning",
  "affiliate-dashboard": "dashboard",
};

// Old tool slugs that have been merged into the unified Dashboard
const DASHBOARD_REDIRECTS = new Set(["activity-dashboard", "saas-health", "clients"]);

// URL segments that map to the Settings panel + a specific tab inside it
type SettingsTab = "profile" | "admins" | "billing" | "domain" | "slack" | "highlevel" | "external";

const SETTINGS_TAB_ROUTES: Record<string, SettingsTab> = {
  settings: "profile",
  profile: "profile",
  admins: "admins",
  billing: "billing",
  domain: "domain",
  "custom-domain": "domain",
  slack: "slack",
  external: "external",
  highlevel: "highlevel",
};

const AppPage = () => {
  const [searchParams] = useSearchParams();
  const params = useParams<{ tool?: string; subTab?: string }>();
  const copilot = useCoPilot();

  // Design system v0.1: the signed-in app uses Inter. Marketing and hub pages
  // keep their own type, so the class is only on <body> while this shell is mounted.
  useEffect(() => {
    if (!newUi) return;
    document.body.classList.add("ds-app");
  }, []);
  const isConfirmed = searchParams.get("confirmed") === "true";
  // Dashboard, Affiliate and One Feature Kit share a tool id; the view makes each its own page.
  const dashboardViewKey = searchParams.get("view") ?? "";
  const purchasedEmail = searchParams.get("email")?.trim().toLowerCase() || null;
  useMetaPixel();

  // ?confirmed=true fallback purchase. Fires the browser pixel AND the
  // server-side Conversions API with one shared event_id so Meta dedupes.
  useEffect(() => {
    if (!isConfirmed) return;
    const planParam = searchParams.get("plan");
    const value = planParam === "enhanced" ? 297 : planParam === "basic" ? 27 : 97;
    // Prefer the Stripe session id so this dedupes against the server Purchase
    // (order_<session id>). Falls back to the email when the id isn't in the URL.
    const sid = searchParams.get("session_id") || searchParams.get("sessionId") || null;
    import("@/utils/metaCapi")
      .then(({ trackConversion }) =>
        trackConversion("Purchase", {
          email: purchasedEmail,
          value,
          // Never a shared constant: a fixed fallback would make Meta dedupe two
          // different customers' purchases into one event and undercount orders.
          eventId: `order_${
            sid ??
            (purchasedEmail
              ? purchasedEmail.replace(/[^a-z0-9]/g, "_")
              : `confirmed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
          }`,
        }),
      )
      .catch(() => {});
  }, [isConfirmed, purchasedEmail, searchParams]);

  // Derive selected tool + settings tab from the URL
  const urlTool = params.tool?.toLowerCase();
  const settingsTabFromUrl =
    urlTool && SETTINGS_TAB_ROUTES[urlTool] ? SETTINGS_TAB_ROUTES[urlTool] : undefined;
  const subTabFromUrl = params.subTab?.toLowerCase();
  const settingsTab: SettingsTab =
    settingsTabFromUrl ??
    (urlTool === "settings" && subTabFromUrl && SETTINGS_TAB_ROUTES[subTabFromUrl]
      ? SETTINGS_TAB_ROUTES[subTabFromUrl]
      : "profile");

  const resolvedTool = resolveAppTool(urlTool, subTabFromUrl);
  const selectedTool: ToolType = settingsTabFromUrl
    ? "settings"
    : resolvedTool && (VALID_TOOLS as string[]).includes(resolvedTool)
      ? (resolvedTool as ToolType)
      : "dashboard";

  // Community deep links: /app/community/snapshots, /prompts, /skills, /courses…
  const communityDeepLink =
    selectedTool === "community" ? resolveCommunityDeepLink(subTabFromUrl) : undefined;

  // Post-onboarding CoPilot flow state
  const [showCoPilotIntro, setShowCoPilotIntro] = useState(false);
  const [showExitTooltip, setShowExitTooltip] = useState(false);
  const [copilotExchangeCount, setCopilotExchangeCount] = useState(0);
  const [isPostOnboarding, setIsPostOnboarding] = useState(false);
  const [walkthroughReady, setWalkthroughReady] = useState(false);
  const classicModeButtonRef = useRef<HTMLButtonElement>(null);
  const {
    email,
    userId,
    approval,
    plan,
    isApproved,
    isLoading,
    clearUser,
    initialQuestionsCompleted,
  } = useUser();
  const navigate = useNavigate();

  // Navigate helper that maps a tool id to its URL
  const setSelectedTool = useCallback(
    (tool: ToolType) => {
      navigate(pathForAppTool(tool));
    },
    [navigate],
  );

  // If user lands on bare /app, redirect to default tool
  useEffect(() => {
    const hasAuthCallback =
      searchParams.has("code") ||
      window.location.hash.includes("access_token=") ||
      window.location.hash.includes("refresh_token=");

    // Wait while an OAuth callback is still being consumed, but once the session
    // exists (email set) go to the default tool even if the callback hash is
    // still sitting in the address bar — otherwise sign-in parks on bare /app.
    const alias = params.tool ? TOOL_ALIASES[params.tool.toLowerCase()] : undefined;
    if (alias) {
      const dest =
        params.tool?.toLowerCase() === "affiliate-dashboard"
          ? "/app/dashboard?view=affiliate"
          : pathForAppTool(alias);
      navigate(dest, { replace: true });
      return;
    }

    const onCopilotPath = window.location.pathname.startsWith("/app/copilot");
    if (!params.tool && !onCopilotPath && (!hasAuthCallback || email)) {
      // Wait until the account row is in, so a new account is not flashed
      // through the dashboard before the Learning Hub.
      if (email && isLoading) return;
      // Honour ?tab=<tool> (post-onboarding hand-offs) and keep the query string
      // so flags like hubLive/celebrate survive the redirect.
      const tabParam = searchParams.get("tab")?.toLowerCase();
      const fallback = initialQuestionsCompleted === false ? "learning" : "dashboard";
      const target =
        tabParam && (VALID_TOOLS as string[]).includes(tabParam) ? tabParam : fallback;
      navigate(`${pathForAppTool(target)}${window.location.search}`, { replace: true });
    }
    if (params.tool && DASHBOARD_REDIRECTS.has(params.tool.toLowerCase())) {
      navigate("/app/dashboard", { replace: true });
    }
  }, [params.tool, navigate, searchParams, email, isLoading, initialQuestionsCompleted]);

  useEffect(() => {
    if (!isConfirmed) return;

    let cancelled = false;

    const resolveConfirmedRedirect = async () => {
      // Every purchase lands here; keep the Payment Successful screen visible
      // for a moment before continuing into the app or to password creation.
      const shownAt = Date.now();
      const waitMinimum = async () => {
        const remaining = 2000 - (Date.now() - shownAt);
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      };
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;

        if (cancelled) return;

        if (sessionEmail && (!purchasedEmail || sessionEmail === purchasedEmail)) {
          // Buyers who never answered the intro questions go through the same
          // flow as new signups: questions -> portal-live popup -> walkthrough.
          const { data: acct } = await supabase
            .from("saas_suite_users")
            .select("initial_questions_completed")
            .ilike("email", sessionEmail)
            .maybeSingle();
          await waitMinimum();
          if (cancelled) return;
          const dest = acct && !acct.initial_questions_completed ? LEARNING_HUB_PATH : "/app";
          window.location.replace(navigateWithParams(dest));
          return;
        }

        if (attempt < 9) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      const signupParams = new URLSearchParams({ paid: "true" });
      if (purchasedEmail) signupParams.set("email", purchasedEmail);
      const signupPath = `/signup?${signupParams.toString()}`;

      await waitMinimum();
      if (!cancelled) {
        window.location.replace(navigateWithParams(signupPath));
      }
    };

    void resolveConfirmedRedirect();

    return () => {
      cancelled = true;
    };
  }, [isConfirmed, purchasedEmail]);
  // "Edit Clients" from a limit warning: land on the dashboard, then highlight
  // the client list once it has rendered so people can edit or remove someone.
  const goToClientEditing = useCallback(() => {
    setSelectedTool("dashboard");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("highlight-client-list"));
    }, 400);
  }, [setSelectedTool]);

  const resetTool = () => {
    setSelectedTool("client-hub");
  };
  const handleNavigateToTool = (tool: string) => {
    if (VALID_TOOLS.includes(tool as ToolType)) {
      setSelectedTool(tool as ToolType);
    }
  };

  useEffect(() => {
    const handleTipbotSelectTool = (event: Event) => {
      const detail = (event as CustomEvent<{ tool?: string }>).detail;
      if (detail?.tool && VALID_TOOLS.includes(detail.tool as ToolType)) {
        setSelectedTool(detail.tool as ToolType);
      }
    };

    window.addEventListener("tipbot-select-tool", handleTipbotSelectTool);
    return () => window.removeEventListener("tipbot-select-tool", handleTipbotSelectTool);
  }, []);

  // Logged-out community deep links stay in the app behind a signup gate
  // instead of being bounced straight to the signup form.
  const showCommunityGate = !isLoading && !email && !isConfirmed && selectedTool === "community";

  useEffect(() => {
    if (!isLoading && !email && !isConfirmed && selectedTool !== "community") {
      // Not logged in (and not just completing a purchase). Remember the exact
      // in-app destination so signup/login can drop them right back here.
      const target = `${window.location.pathname}${window.location.search}`;
      rememberNextPath(target);
      const next = `next=${encodeURIComponent(target)}`;
      const path = navigateWithParams("/login");
      navigate(`${path}${path.includes("?") ? "&" : "?"}${next}`, { replace: true });
    }
  }, [email, isLoading, navigate, isConfirmed, selectedTool]);

  // Part 1 of the walkthrough (navigation) opens on its own each login until
  // finished — resuming where they left off, max 3 dismissals a week.
  const { actualEmail: tourActual } = useUser();
  const hubLiveOnArrival = useRef(
    new URLSearchParams(window.location.search).get("hubLive") === "1",
  );
  useEffect(() => {
    const who = (tourActual || email || "").toLowerCase();
    if (!who || isLoading || isConfirmed || hubLiveOnArrival.current) return;
    if (!shouldAutoStart("nav", who)) return;
    const t = setTimeout(() => {
      if (shouldAutoStart("nav", who)) {
        window.dispatchEvent(
          new CustomEvent("start-walkthrough", { detail: { kind: "nav", resume: true } }),
        );
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [tourActual, email, isLoading, isConfirmed]);

  // Landed successfully on the destination — the pending redirect is spent.
  useEffect(() => {
    if (email) clearNextPath();
  }, [email]);

  // Handle URL params for tool selection — post-onboarding opens CoPilot
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tab = searchParams.get("tab");
    if (tab === "walkthrough") {
      setSelectedTool("walkthrough");
      const openCopilot = searchParams.get("openCopilot");
      if (openCopilot === "true") {
        // Post-onboarding: open AI CoPilot directly (as modal shell)
        copilot.open({ mode: "modal", prompt: "Let's set up my login and welcome sections" });
        setShowCoPilotIntro(true);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [email, copilot]);

  // When user has completed at least 1 exchange in CoPilot post-onboarding, show exit tooltip
  const handleExchangeCountChange = useCallback(
    (count: number) => {
      setCopilotExchangeCount(count);
      if (isPostOnboarding && count >= 1 && !showExitTooltip && !walkthroughReady) {
        setShowExitTooltip(true);
      }
    },
    [isPostOnboarding, showExitTooltip, walkthroughReady],
  );

  // When user exits CoPilot after the post-onboarding flow, start walkthrough
  const handleExitCoPilotToClassic = useCallback(() => {
    copilot.close();
    setShowExitTooltip(false);
    if (isPostOnboarding) {
      setWalkthroughReady(true);
      setIsPostOnboarding(false);
      setSelectedTool("client-hub");
      // Dispatch event to start the interactive walkthrough
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("start-walkthrough"));
      }, 500);
    }
  }, [isPostOnboarding, copilot]);
  if (isConfirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm animate-fade-in">
          <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-foreground">Payment Successful!</h1>
          <p className="text-muted-foreground">Setting up your account...</p>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-6"></div>
        </div>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (showCommunityGate) {
    return <CommunityGatePreview slug={subTabFromUrl} />;
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Opening your account…</p>
        </div>
      </div>
    );
  }

  // For users marked as "NO", let the TrialExpiredOverlay handle it
  // Don't show ApprovalRequired during account creation - just show loading or main app

  return (
    <InitialQuestionsGuard>
      <MotionConfig reducedMotion="user">
      <SidebarProvider>
        {/* New UI: plain canvas (#F5F5F5) with white cards. Old UI keeps its background image. */}
        <div
          className="px-canvas min-h-screen flex flex-col w-full"
          style={
            newUi
              ? undefined
              : {
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.6), rgba(255,255,255,0.6)), url(${appBackground.url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                  backgroundAttachment: "fixed",
                }
          }
        >
          {/* Impersonation Banner - shows when admin is viewing as another user */}
          <ImpersonationBanner />
          <ActiveAccountNotice />

          {/* Payment failed / canceled banner (must live inside the column layout,
            otherwise it becomes a full-height flex item beside the app). */}
          <PastDueBanner />
          <PaymentGraceBanner />
          <CancelNoticeBanner />

          {/* User Limit Banner */}
          <UserLimitBanner onEditClients={goToClientEditing} />

          <div className="flex flex-1 w-full">
            {/* Desktop Sidebar */}
            <AppSidebar
              selectedTool={selectedTool}
              onSelectTool={(tool) => setSelectedTool(tool)}
            />

            {/* Main Content Area */}
            <div className={`min-w-0 flex-1 flex flex-col overflow-hidden lg:pr-[var(--copilot-dock-offset,0px)]`}>
              {/* Mobile Header */}
              <div className="px-glass md:hidden border-b border-border/70 sticky top-0 z-40">
                <div className="flex items-center justify-between p-4">
                  <SidebarTrigger className="md:hidden" />
                  {newUi ? (
                    <img src={darkBanner.url} alt="SaaSSuite" className="h-7 w-auto" />
                  ) : (
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-gradient-primary rounded-md flex items-center justify-center shadow-glow">
                        <img
                          src="/lovable-uploads/bc897420-443a-4f49-aa8d-683ff40b5652.png"
                          alt="SaaSSuite Logo"
                          className="w-4 h-4"
                        />
                      </div>
                      <p className="text-lg font-bold text-foreground">SaaSSuite</p>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <AccountSwitcher />
                  </div>
                </div>
              </div>

              {/* Top bar: where you are, jump-to menu, account controls */}
              <AppTopBar
                tool={selectedTool}
                actions={
                  <>
                    <InstallChecklistButton />
                    <LoginAsUser />
                    <AccountSwitcher />
                  </>
                }
              />

              {/* Main Content */}
              <main className="flex-1 overflow-auto px-0 md:px-6 relative">
                <div className="mobile-flush mobile-type w-full max-w-[1400px] mx-auto px-3 md:px-8 py-3 md:py-5 pb-6">
                  {/* Classic tool content (CoPilot now renders via the persistent shell) */}
                  <>
                    {/* Hero Section */}

                    {/* Selected Tool Component */}
                    <motion.div
                      key={`${selectedTool}-${dashboardViewKey}`}
                      variants={pageEnter}
                      initial="hidden"
                      animate="show"
                      className="relative min-h-[600px]"
                    >
                      <KitReturnLink className="mb-3" />
                      <ToolAccessGate tool={selectedTool}>
                        {selectedTool === "start-here" || selectedTool === "learning" ? (
                          <StartHere />
                        ) : selectedTool === "streamline" ? (
                          <>
                            <MobileDesktopOverlay title="Menu Link Removal">
                              <StreamlineTool
                                highlevelFeatures={highlevelFeatures}
                                onReset={resetTool}
                              />
                            </MobileDesktopOverlay>
                          </>
                        ) : selectedTool === "branding" ? (
                          <BrandingTool onReset={resetTool} />
                        ) : selectedTool === "marketing" ? (
                          <>
                            <MarketingTool onReset={resetTool} />
                          </>
                        ) : selectedTool === "simple-onboarding" ? (
                          <SimpleOnboardingManager />
                        ) : selectedTool === "workflows" ? (
                          <WorkflowsManager />
                        ) : selectedTool === "dashboard" ? (
                          <Dashboard />
                        ) : selectedTool === "challenge" ? (
                          <ChallengeTool />
                        ) : selectedTool === "support" ? (
                          <SupportDashboard />
                        ) : selectedTool === "activity-dashboard" ? (
                          <>
                            <ActivityDashboard />
                          </>
                        ) : selectedTool === "saas-health" ? (
                          <SaaSHealth />
                        ) : selectedTool === "support-features" ? (
                          <SupportFeatures />
                        ) : selectedTool === "client-hub" ? (
                          <ClientHub />
                        ) : selectedTool === "clients" ? (
                          <ClientsManager />
                        ) : selectedTool === "knowledge-base" ? (
                          <KnowledgeBase />
                        ) : selectedTool === "walkthrough" ? (
                          <WalkthroughTool
                            onNavigateToTool={handleNavigateToTool}
                            onOpenCoPilot={() => {
                              copilot.open({ mode: "modal" });
                              setShowCoPilotIntro(true);
                            }}
                          />
                        ) : selectedTool === "email-warmup" ? (
                          <EmailWarmupRequest />
                        ) : selectedTool === "free-leads" ? (
                          <FreeLeadsRequest />
                        ) : selectedTool === "affiliate-dashboard" ? (
                          <AffiliateDashboard />
                        ) : selectedTool === "snapshots" ? (
                          <Snapshots />
                        ) : selectedTool === "community" ? (
                          <CommunityHub
                            initialTab={communityDeepLink?.tab ?? "feed"}
                            initialAcademySection={communityDeepLink?.section}
                          />
                        ) : selectedTool === "onboarding-calls" ? (
                          <OnboardingCallsManager />
                        ) : selectedTool === "agency-support" ? (
                          <AgencySupportManager />
                        ) : selectedTool === "agents" ? (
                          <AgentsPage />
                        ) : selectedTool === "settings" ? (
                          <SettingsPanel
                            onBack={() => setSelectedTool("client-hub")}
                            initialTab={settingsTab}
                            onTabChange={(tab) =>
                              navigate(
                                `/app/${tab === "profile" ? "settings" : tab === "domain" ? "custom-domain" : tab === "slack" ? "slack" : tab}`,
                                { replace: true },
                              )
                            }
                          />
                        ) : (
                          <>
                            <MobileDesktopOverlay title="Onboarding Tool">
                              <OnboardingTool />
                            </MobileDesktopOverlay>
                          </>
                        )}
                      </ToolAccessGate>
                    </motion.div>
                  </>
                </div>
              </main>
            </div>
          </div>
        </div>

        {/* Trial Expired Overlay */}
        <TrialExpiredOverlay />
        <FreeTrialBanner />

        {/* 24-hour bump discount countdown (bottom-left) */}
        <OfferCountdownWidget />

        {/* Reminder for users who skipped onboarding (desktop only) */}
        <OnboardingReminderDialog />

        {/* CoPilot Intro Tooltip */}
        <CoPilotIntroTooltip
          show={showCoPilotIntro}
          onDismiss={() => setShowCoPilotIntro(false)}
          variant="intro"
        />

        {/* CoPilot Exit Tooltip */}
        <CoPilotIntroTooltip
          show={showExitTooltip}
          onDismiss={() => {
            setShowExitTooltip(false);
          }}
          variant="exit"
          targetRef={classicModeButtonRef}
        />
      </SidebarProvider>
      </MotionConfig>
    </InitialQuestionsGuard>
  );
};
export default AppPage;
