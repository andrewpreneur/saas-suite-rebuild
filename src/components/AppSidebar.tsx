import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { SPRING_SNAPPY } from "@/lib/motion";
import { MessageCircle } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { newUi } from "@/lib/uiVersion";
import { AccountPanel, type SettingsDestination } from "@/components/platform/AccountPanel";
import { OwnerHelp } from "@/components/platform/OwnerHelp";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSupportUnread } from "@/hooks/useSupportUnread";
import { useViewerIdentity } from "@/hooks/useViewerIdentity";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  GraduationCap,
  Zap,
  Palette,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Mail,
  Check,
  Gift,
  Headphones,
  Activity,
  LayoutDashboard,
  Route,
  Lock,
  Users,
  ListVideo,
  Search,
  ChevronsUpDown,
  BookOpen,
  LayoutGrid,
  PhoneCall,
  HeartHandshake,
  LifeBuoy,
  Trophy,
  Rocket,
  Bot,
  Settings as SettingsIcon,
  HandCoins,
  Package,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { TOOL_AREA, useTeamAccess } from "@/hooks/useTeamAccess";
import { useChallengeCountdown } from "@/hooks/useChallengeCountdown";
import { useLanguage } from "@/contexts/LanguageContext";
import TrialCountdown from "./TrialCountdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import UpgradeDialog from "./UpgradeDialog";
import {
  NEW_UI_SIDEBAR_SECTIONS,
  NEW_UI_TOOL_NAMES,
  SIDEBAR_HOME_TOOL_IDS,
  SIDEBAR_SECTIONS,
} from "@/lib/sidebarNav";
import darkBanner from "@/assets/saassuite-dark-banner.png.asset.json";
import darkIcon from "@/assets/saassuite-dark-icon.png.asset.json";

const tools = [
  { id: "dashboard", name: "Dashboard", icon: BarChart3 },
  { id: "challenge", name: "Challenge", icon: Trophy },
  { id: "branding", name: "Design", icon: Palette },
  { id: "client-hub", name: "Edit Pages", icon: LayoutDashboard },
  { id: "workflows", name: "Workflows", icon: Route },
  { id: "streamline", name: "Menu link removal", icon: Zap },
  { id: "support", name: "Client Support", icon: LifeBuoy },
  { id: "learning", name: "Learning Hub", icon: Rocket },
  { id: "community", name: "Community", icon: Users },
  { id: "help", name: "Help", icon: MessageCircle },
  { id: "knowledge-base", name: "Knowledge Base", icon: BookOpen },
  { id: "simple-onboarding", name: "Simplified Onboarding", icon: ListVideo },
  { id: "support-features", name: "Support Features", icon: Headphones },
  { id: "marketing", name: "AI Marketing", icon: Megaphone },
  { id: "email-warmup", name: "Email Warmup", icon: Mail },
  { id: "free-leads", name: "My Free Leads", icon: Gift },
  { id: "onboarding-calls", name: "Onboarding Calls", icon: PhoneCall },
  { id: "agency-support", name: "Agency Support", icon: HeartHandshake },
  { id: "agents", name: "Agents", icon: Bot },
  // New UI only (filtered out of the old sidebar below).
  { id: "affiliate-dashboard", name: "Affiliate", icon: HandCoins },
  { id: "one-feature-kit", name: "One Feature Kit", icon: Package },
  { id: "settings", name: "Settings", icon: SettingsIcon },
];
const NEW_UI_ONLY_TOOL_IDS = new Set(["affiliate-dashboard", "one-feature-kit", "settings"]);

// Same groups on desktop and in the mobile drawer.
const SECTION_ICONS: Record<string, typeof BarChart3> = {
  build: LayoutGrid,
  grow: BookOpen,
  more: LayoutGrid,
  hub: LayoutGrid,
  brand: Palette,
  support: LifeBuoy,
  growth: Rocket,
  learn: GraduationCap,
};
const NAV_SECTIONS: {
  id: string;
  label: string;
  icon: typeof BarChart3;
  toolIds: string[];
  tipTarget?: string;
}[] = (newUi ? NEW_UI_SIDEBAR_SECTIONS : SIDEBAR_SECTIONS).map((section) => ({
  ...section,
  icon: SECTION_ICONS[section.id] ?? BookOpen,
}));

// Plan-based access map: which plans can see which tools
const planToolAccess: Record<string, string[]> = {
  // Design is open on Starter. The branding tool and Theme Customizer lock
  // inside the page; the sidebar item itself is not an upgrade wall.
  STARTER: ["branding", "client-hub", "dashboard", "challenge", "knowledge-base", "support", "community"],
  BASIC: [
    "client-hub",
    "dashboard",
    "challenge",
    "knowledge-base",
    "support",
    "community",
    "simple-onboarding",
    "streamline",
    "branding",
    "marketing",
  ],
  ADVANCED: [
    "client-hub",
    "dashboard",
    "challenge",
    "knowledge-base",
    "support",
    "community",
    "simple-onboarding",
    "workflows",
    "streamline",
    "branding",
    "marketing",
    "agency-support",
  ],
};

type ToolType =
  | "start-here"
  | "learning"
  | "help"
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

interface AppSidebarProps {
  selectedTool: ToolType;
  onSelectTool: (tool: Exclude<ToolType, "help">) => void;
}

export function AppSidebar({ selectedTool, onSelectTool }: AppSidebarProps) {
  const { state, toggleSidebar, setOpenMobile } = useSidebar();
  const {
    clearUser,
    emailWarmupAccess,
    freeLeadsAccess,
    hideBonuses,
    email,
    plan,
    approval,
    isAffiliate,
    snapshotAccess,
  } = useUser();
  const { t } = useLanguage();
  const collapsed = state === "collapsed";
  const challengeCountdown = useChallengeCountdown();
  const teamAccess = useTeamAccess();
  const [v2NavigationEnabled, setV2NavigationEnabled] = useState(true);
  // Row the pointer or keyboard focus is on; drives the sliding hover highlight.
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const viewer = useViewerIdentity(fullName);
  const [onboardingCallAccess, setOnboardingCallAccess] = useState(false);
  const [search, setSearch] = useState("");
  const [communityAvatar, setCommunityAvatar] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();
  const supportUnread = useSupportUnread();

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("support@saassuite.ai");
      setEmailCopied(true);
      toast.success("Copied support@saassuite.ai to clipboard");
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      toast.error("Could not copy email.");
    }
  };

  // Fetch v2 navigation enabled status + full name
  const fetchUserSettings = async () => {
    if (!email) return;

    const { data } = await supabase
      .from("saas_suite_users")
      .select("v2_navigation_enabled, full_name, onboarding_call_access")
      .ilike("email", email)
      .maybeSingle();

    if (data) {
      setV2NavigationEnabled((data as any).v2_navigation_enabled ?? true);
      setFullName((data as any).full_name ?? null);
      setOnboardingCallAccess(Boolean((data as any).onboarding_call_access));
    }
  };

  useEffect(() => {
    fetchUserSettings();

    const handleSettingsChanged = () => {
      fetchUserSettings();
    };

    window.addEventListener("user-settings-changed", handleSettingsChanged);
    return () => {
      window.removeEventListener("user-settings-changed", handleSettingsChanged);
    };
  }, [email]);

  // Profile picture uploaded in the Community shows in the sidebar too.
  useEffect(() => {
    let active = true;
    const loadAvatar = async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("community_profiles")
        .select("avatar_url")
        .eq("id", uid)
        .maybeSingle();
      if (active) setCommunityAvatar((data as any)?.avatar_url ?? null);
    };
    void loadAvatar();
    const onAvatarChanged = () => void loadAvatar();
    window.addEventListener("community-avatar-changed", onAvatarChanged);
    return () => {
      active = false;
      window.removeEventListener("community-avatar-changed", onAvatarChanged);
    };
  }, [email]);

  const location = useLocation();
  const dashboardView = new URLSearchParams(location.search).get("view");
  // Copilot is its own surface with no sidebar row, so nothing is lit while it is open.
  const onCopilotPage = location.pathname.startsWith("/app/copilot");
  const isActive = (toolId: string) => {
    if (onCopilotPage) return false;
    // New UI: Affiliate is its own link, so Dashboard is not also lit while it is open.
    if (newUi && toolId === "affiliate-dashboard")
      return selectedTool === "dashboard" && dashboardView === "affiliate";
    if (newUi && toolId === "one-feature-kit")
      return selectedTool === "dashboard" && dashboardView === "kit";
    if (newUi && toolId === "dashboard")
      return selectedTool === "dashboard" && dashboardView !== "affiliate" && dashboardView !== "kit";
    return selectedTool === toolId;
  };

  // Map tool IDs to translated names
  const toolNameMap: Record<string, string> = {
    onboarding: t.sidebar_onboardingTool,
    "client-hub": "Edit Pages",
    dashboard: "Dashboard",
    learning: "Learning Hub",
    help: "Help",
    support: "Client Support",
    "support-features": t.sidebar_supportFeatures,
    streamline: "Menu link removal",
    branding: "Design",
    marketing: t.sidebar_aiMarketing,
    "email-warmup": t.sidebar_emailWarmup,
    "free-leads": t.sidebar_myFreeLeads,
    "affiliate-dashboard": "Affiliate Dashboard",
    "simple-onboarding": "Simplified Onboarding",
    workflows: "Workflows",
    "onboarding-calls": "Onboarding Calls",
    "agency-support": "Agency Support",
    challenge: "Challenge",
    agents: "Agents",
    ...(newUi ? NEW_UI_TOOL_NAMES : {}),
  };

  // Determine allowed tools based on plan
  const userPlan = plan || "ADVANCED";
  const allowedToolIds = planToolAccess[userPlan] || planToolAccess["ADVANCED"];

  // Filter tools based on access permissions, plan, and v2 navigation
  const availableTools = tools.filter((tool) => {
    if (!newUi && NEW_UI_ONLY_TOOL_IDS.has(tool.id)) return false;
    // Team-admin permissions set by the account owner
    if (!teamAccess.isOwner) {
      if (tool.id === "support" || tool.id === "support-features") {
        if (
          teamAccess.level("support_chats") === "none" &&
          teamAccess.level("support_tickets") === "none"
        )
          return false;
      } else if (TOOL_AREA[tool.id] && teamAccess.level(TOOL_AREA[tool.id]) === "none") {
        return false;
      }
    }
    // Bonus tools
    if (tool.id === "email-warmup") {
      return emailWarmupAccess && !hideBonuses;
    }
    if (tool.id === "free-leads") {
      return freeLeadsAccess && !hideBonuses;
    }
    // Affiliate dashboard: open to every plan (Starter included). Users who
    // aren't affiliates yet see the in-app application form instead.
    if (tool.id === "affiliate-dashboard") {
      return true;
    }
    // Onboarding Calls: only show when the user has access turned on
    if (tool.id === "onboarding-calls") {
      // Basic and Advanced plans get access by default; Starter requires the purchased upgrade flag
      return onboardingCallAccess || plan === "BASIC" || plan === "ADVANCED";
    }
    // Hide support features when v2 navigation is enabled
    if (tool.id === "support-features") {
      return !v2NavigationEnabled;
    }
    // AI Marketing (AI Offer Builder + AI Email Builder) is hidden on all
    // accounts for now — the features stay in the codebase so they can be
    // re-enabled on request.
    if (tool.id === "marketing") {
      return false;
    }
    return true;
  });

  // Tools the current plan can't open yet stay visible but are clearly marked,
  // so nobody clicks a silent dead button wondering if the app is broken.
  const lockedToolIds = useMemo(
    () =>
      new Set(
        availableTools
          .filter((tool) => Object.values(planToolAccess).some((ids) => ids.includes(tool.id)))
          .filter((tool) => !allowedToolIds.includes(tool.id))
          .map((tool) => tool.id),
      ),
    [availableTools, allowedToolIds],
  );

  const searching = search.trim().length > 0;
  const filteredBySearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return availableTools;
    return availableTools.filter((t) => (toolNameMap[t.id] || t.name).toLowerCase().includes(q));
  }, [search, availableTools]);

  const dashboardTool = availableTools.find((t) => t.id === "dashboard");
  const challengeTool = availableTools.find((t) => t.id === "challenge");

  // Build the five-section mega menu from whatever the account actually has access to.
  const sections = useMemo(() => {
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.toolIds
        .map((id) => availableTools.find((t) => t.id === id))
        .filter(Boolean) as typeof tools,
    })).filter((section) => section.items.length > 0);
  }, [availableTools]);

  const activeSectionId = sections.find((section) => section.items.some((item) => isActive(item.id)))?.id ?? null;
  const [openSection, setOpenSection] = useState<string | null>(activeSectionId);
  // Moving to a page in another group opens that group and closes the last one.
  useEffect(() => {
    if (activeSectionId) setOpenSection(activeSectionId);
  }, [activeSectionId]);

  const initials = (viewer.displayName || viewer.displayEmail || "?")
    .split(/[ @.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  const renderItem = (tool: (typeof tools)[number], index?: number, total?: number) => {
    const Icon = tool.icon;
    const active = isActive(tool.id);
    const staggered = index !== undefined;
    const locked = lockedToolIds.has(tool.id);
    return (
      <SidebarMenuItem
        key={tool.id}
        className={staggered ? "sidebar-stagger-item" : undefined}
        style={
          staggered
            ? ({
                // Delays live in CSS vars so the closed-state rule can apply its
                // own reversed delay without an inline style overriding it.
                ["--enter-delay" as any]: `${index! * 55}ms`,
                ["--exit-delay" as any]: `${((total ?? 1) - 1 - index!) * 45}ms`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <SidebarMenuButton
          isActive={active}
          aria-current={active ? "page" : undefined}
          onMouseEnter={() => setHoveredTool(tool.id)}
          onMouseLeave={() => setHoveredTool((current) => (current === tool.id ? null : current))}
          onFocus={() => setHoveredTool(tool.id)}
          onBlur={() => setHoveredTool((current) => (current === tool.id ? null : current))}
          onClick={() => {
            if (locked) {
              setUpgradeOpen(true);
              return;
            }
            if (tool.id === "help") {
              setHelpOpen(true);
              return;
            }
            if (tool.id === "one-feature-kit") {
              navigate("/app/dashboard?view=kit");
              setOpenMobile(false);
              return;
            }
            onSelectTool(tool.id as Exclude<ToolType, "help">);
            setOpenMobile(false);
          }}
          data-tip-target={`sidebar-${tool.id}`}
          aria-label={
            tool.id === "challenge" ? `Challenge, ${challengeCountdown.label}` : undefined
          }
          tooltip={
            collapsed
              ? tool.id === "challenge"
                ? {
                    children: (
                      <span className="block text-left">
                        <span className="block">Challenge</span>
                        <span className="block text-xs font-semibold tabular-nums">
                          {challengeCountdown.label}
                        </span>
                      </span>
                    ),
                  }
                : `${toolNameMap[tool.id] || tool.name}${locked ? " — upgrade to unlock" : ""}`
              : undefined
          }
          className={`
            group sidebar-nav-item relative isolate rounded-lg !bg-transparent
            ${
              tool.id === "challenge"
                ? "h-auto min-h-9 overflow-visible py-1.5 group-data-[collapsible=icon]:!h-8 group-data-[collapsible=icon]:!min-h-0 group-data-[collapsible=icon]:!py-2"
                : newUi
                  ? "h-11 md:h-9"
                  : "h-9"
            }
            ${collapsed ? "px-0 justify-center" : "px-3"}
            ${
              !newUi
                ? active
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : locked
                    ? "text-sidebar-foreground/50 hover:text-sidebar-foreground/70"
                    : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
                : active
                  ? "font-semibold text-[#3E27AE]"
                  : locked
                    ? "text-gray-500 hover:text-gray-700"
                    : "text-gray-700 hover:text-foreground"
            }
          `}
        >
          {/* Sliding highlights (idea from 21st.dev "Animated Sidebar"): one shared pill
              follows the pointer, another marks the current page. */}
          {hoveredTool === tool.id && !active ? (
            <motion.span
              layoutId="sidebar-hover-pill"
              aria-hidden="true"
              transition={SPRING_SNAPPY}
              className="absolute inset-0 -z-10 rounded-lg bg-[#17124008]"
            />
          ) : null}
          {active ? (
            <motion.span
              layoutId="sidebar-active-pill"
              aria-hidden="true"
              transition={SPRING_SNAPPY}
              className="absolute inset-0 -z-10 rounded-lg bg-brand-subtle shadow-[inset_0_0_0_1px_rgba(96,67,239,0.16)]"
            />
          ) : null}
          <motion.span
            aria-hidden="true"
            className="flex shrink-0"
            animate={
              hoveredTool === tool.id
                ? { rotate: [0, -10, 8, 0], scale: [1, 1.12, 1.12, 1] }
                : { rotate: 0, scale: 1 }
            }
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <Icon className={`!size-5 ${active ? "text-[#3E27AE]" : "text-gray-500"}`} />
          </motion.span>
          {!collapsed && tool.id === "challenge" && (
            <span className="ml-3 flex min-w-0 flex-1 flex-col items-start !overflow-visible !whitespace-normal leading-tight">
              <span className="w-full truncate text-sm">Challenge</span>
              <span
                data-challenge-countdown=""
                className={`text-[10px] font-semibold tabular-nums ${
                  challengeCountdown.ended
                    ? newUi
                      ? "text-gray-500"
                      : "text-sidebar-foreground/50"
                    : newUi
                      ? "text-brand"
                      : "text-sidebar-primary"
                }`}
              >
                {challengeCountdown.label}
              </span>
            </span>
          )}
          {!collapsed && tool.id !== "challenge" && (
            <span className="ml-3 text-sm truncate">{toolNameMap[tool.id] || tool.name}</span>
          )}
          {collapsed && tool.id === "challenge" && (
            <span
              data-challenge-countdown-badge=""
              className={`pointer-events-none absolute bottom-0 left-1/2 z-10 -translate-x-1/2 rounded-sm px-0.5 text-[8px] font-bold leading-none ${
                challengeCountdown.ended
                  ? "bg-sidebar-accent text-sidebar-foreground/70"
                  : "bg-sidebar-primary text-sidebar-primary-foreground"
              }`}
            >
              {challengeCountdown.short}
            </span>
          )}
          {!collapsed && tool.id === "support" && supportUnread > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {supportUnread > 9 ? "9+" : supportUnread}
            </span>
          )}
          {!collapsed && locked && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Upgrade
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      className="animate-slide-in-left border-r border-sidebar-border bg-sidebar-background"
      collapsible="icon"
    >
      <SidebarHeader className={collapsed ? "p-2 items-center gap-2" : "p-3 gap-3"}>
        <div
          className={`flex items-center justify-between w-full ${collapsed ? "flex-col gap-2" : ""}`}
        >
          {/* Design system v0.1: banner logo when open, square icon when collapsed. */}
          {!newUi ? (
            <div className="w-9 h-9 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <img
                src="/lovable-uploads/bc897420-443a-4f49-aa8d-683ff40b5652.png"
                alt="SaaSSuite Logo"
                className="w-5 h-5"
              />
            </div>
          ) : collapsed ? (
            <img src={darkIcon.url} alt="SaaSSuite" className="size-8 flex-shrink-0 rounded-md" />
          ) : (
            <img src={darkBanner.url} alt="SaaSSuite" className="h-7 w-auto flex-shrink-0" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 flex-shrink-0"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
        {/* The sidebar search box is gone: every tool now has a link, and Cmd+K in the top bar jumps anywhere. */}
        {!collapsed && <TrialCountdown />}
      </SidebarHeader>

      <SidebarContent className={collapsed ? "px-1.5" : "px-2"}>
        {/* Searching flattens the tree so results are one glance away. */}
        {searching ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {filteredBySearch.length > 0 ? (
                  filteredBySearch.map((t) => renderItem(t))
                ) : (
                  <p className="px-3 py-2 text-xs text-sidebar-foreground/50">No matches</p>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          <>
            {(dashboardTool || challengeTool) && (
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-0.5">
                    {SIDEBAR_HOME_TOOL_IDS.map((id) => {
                      const tool = availableTools.find((item) => item.id === id);
                      return tool ? renderItem(tool) : null;
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* One group open at a time: the sidebar shows where you are, not everything at once. */}
            <SidebarGroup className="py-0">
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {sections.map((section) => {
                    const SectionIcon = section.icon;
                    const holdsActive = section.items.some((item) => isActive(item.id));
                    const open = !collapsed && openSection === section.id;
                    const tip =
                      section.tipTarget ??
                      (section.id === "build"
                        ? "sidebar-section-client-hub"
                        : section.id === "grow"
                          ? "sidebar-section-resources"
                          : `sidebar-section-${section.id}`);
                    return (
                      <li key={section.id} className="list-none">
                        <button
                          type="button"
                          data-tip-target={tip}
                          data-testid={`sidebar-group-${section.id}`}
                          aria-expanded={open}
                          aria-label={collapsed ? section.label : undefined}
                          title={collapsed ? section.label : undefined}
                          onClick={() => {
                            if (collapsed) {
                              const first = section.items[0];
                              if (first) onSelectTool(first.id as Exclude<ToolType, "help">);
                              return;
                            }
                            setOpenSection((current) => (current === section.id ? null : section.id));
                          }}
                          className={`group/sec flex h-10 w-full items-center gap-3 rounded-lg text-sm font-medium transition-colors duration-150 hover:bg-[#17124008] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${collapsed ? "justify-center px-0" : "px-3"} ${holdsActive ? "text-foreground" : "text-sidebar-foreground/80"}`}
                        >
                          <SectionIcon
                            className={`size-[18px] shrink-0 ${holdsActive ? "text-primary" : "text-sidebar-foreground/60"}`}
                            aria-hidden="true"
                          />
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate text-left">{section.label}</span>
                              {section.id === "support" && supportUnread > 0 && !open ? (
                                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
                                  {supportUnread}
                                </span>
                              ) : null}
                              <ChevronRight
                                className={`size-4 shrink-0 text-sidebar-foreground/40 transition-transform duration-200 ease-out ${open ? "rotate-90" : ""}`}
                                aria-hidden="true"
                              />
                            </>
                          )}
                        </button>
                        <div
                          className="grid transition-[grid-template-rows] duration-200 ease-out"
                          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
                          // Closed groups stay out of the tab order and away from screen readers.
                          {...(open ? {} : { inert: "" as unknown as boolean })}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <ul className="ml-[21px] space-y-0.5 border-l border-sidebar-border py-1 pl-2">
                              {section.items.map((item) => renderItem(item))}
                            </ul>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className={collapsed ? "p-1.5 space-y-1" : "p-2 space-y-1"}>
        <div className="border-t border-sidebar-border mt-1 pt-2">
          <button
            type="button"
            data-tip-target="sidebar-profile"
            onClick={() => setAccountOpen(true)}
            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[#17124008] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${collapsed ? "justify-center px-0" : ""}`}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              {communityAvatar ? (
                <AvatarImage src={communityAvatar} alt={viewer.displayName || "Profile"} />
              ) : null}
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-sidebar-foreground">
                      {viewer.displayName || (viewer.displayEmail || "").split("@")[0]}
                    </p>
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] leading-none">
                      {userPlan === "STARTER" ? "Starter" : userPlan === "BASIC" ? "Basic" : "Adv"}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-sidebar-foreground/50">{viewer.displayEmail}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-sidebar-foreground/40" />
              </>
            )}
          </button>
        </div>
      </SidebarFooter>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
      <AccountPanel
        open={accountOpen}
        onOpenChange={setAccountOpen}
        name={viewer.displayName || (viewer.displayEmail || "").split("@")[0]}
        email={viewer.displayEmail}
        plan={userPlan === "STARTER" ? "Starter" : userPlan === "BASIC" ? "Basic" : "Advanced"}
        onLogout={() => void clearUser()}
        onOpen={(destination: SettingsDestination) => {
          if (destination === "help") {
            setHelpOpen(true);
            return;
          }
          const path =
            destination === "profile"
              ? "/app/settings"
              : destination === "domain"
                ? "/app/custom-domain"
                : `/app/${destination}`;
          navigate(path);
        }}
      />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="flex h-[min(720px,85vh)] max-w-2xl flex-col gap-3">
          <DialogHeader>
            <DialogTitle>Help</DialogTitle>
            <DialogDescription>
              Ask the SaaSSuite assistant, or request a person on the team.
            </DialogDescription>
          </DialogHeader>
          <OwnerHelp onBook={() => navigate("/success")} />
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
