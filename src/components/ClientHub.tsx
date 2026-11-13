import { newUi } from "@/lib/uiVersion";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import AssignSubAccountPanel from "@/components/highlevel/AssignSubAccountPanel";
import { useGhl } from "@/components/highlevel/useGhl";
import MultiPlanConnectionNotice from "@/components/highlevel/MultiPlanConnectionNotice";
import { multiPlanAllowed } from "../../supabase/functions/_shared/connectedPlans";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import HubLiveModal from "@/components/onboarding/HubLiveModal";
import InstallTaskBanner from "@/components/onboarding/InstallTaskBanner";
import { useTipsBot } from "@/components/tips-bot";
import { shouldAutoStart, readTour } from "@/lib/tourSchedule";
import ThemePickerCard from "@/components/client-hub/ThemePickerCard";
import { HubSectionToggle, HubDefaultPageSelect } from "@/components/client-hub/HubSectionSettings";
import { DEFAULT_HUB_SECTIONS, readHubSections, visibleHubSections, visibleHubDefault, hubSectionChange } from "@/lib/hubSections";
import TopNavWidgetCard from "@/components/client-hub/TopNavWidgetCard";
import MobileBrandingCard from "@/components/client-hub/MobileBrandingCard";
import { getDeviceType } from "@/utils/device";

import { processTrainingDocContent } from "@/utils/compileTrainingDocContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  GraduationCap,
  Home,
  Headphones,
  Copy,
  Palette,
  Video,
  Settings,
  BookOpen,
  HelpCircle,
  CheckSquare,
  Bot,
  Ticket,
  AlertCircle,
  CheckCircle2,
  Clock,
  Save,
  Sparkles,
  X,
  Plus,
  Trash2,
  Link,
  Image,
  MessageSquare,
  Megaphone,
  Play,
  Check,
  LogIn,
  User,
  Mail,
  Pencil,
  ListChecks,
  Webhook,
  Calendar,
  RefreshCw,
  Info,
  Users,
  MessageCircle,
} from "lucide-react";
import SyncPlansDialog from "@/components/SyncPlansDialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import CustomVideosPanel from "@/components/onboarding/CustomVideosPanel";
import AdvancedModePanel from "@/components/onboarding/AdvancedModePanel";
import InstallationGuidePanel from "@/components/onboarding/InstallationGuidePanel";
import ColorPicker from "@/components/ColorPicker";
import OnboardingChecklistPanel from "@/components/onboarding/OnboardingChecklistPanel";
import ChatInterventionPanel from "@/components/client-hub/ChatInterventionPanel";
import V3EducationView from "@/components/client-hub/V3EducationView";
import V3HomeView from "@/components/client-hub/V3HomeView";
import V3SupportView from "@/components/client-hub/V3SupportView";
import ChatModeSettings from "@/components/support/ChatModeSettings";
import { TicketListPreview } from "@/components/support/TicketListPreview";
import { PreviewHeaderHost } from "@/components/client-hub/PreviewHeaderSlot";
import {
  DEFAULT_AI_PROMPT_PERSONALITY,
  DEFAULT_AI_PROMPT_GOALS,
  DEFAULT_AI_PROMPT_INSTRUCTIONS,
} from "@/constants/aiPromptDefaults";
import { useHubUrls } from "@/lib/hubUrl";
import {
  availableHubLandingPages,
  editorHubDeepLink,
  isHubSupportTabEnabled,
  resolveHubLandingPage,
  type HubLandingPage,
} from "@/lib/hubLanding";
import {
  HomeSettings,
  DEFAULT_HOME_SETTINGS,
  DEFAULT_TAB_NAMES,
  DEFAULT_CHECKLIST_TITLE,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_AI_SETTINGS,
  getV2HomeSettingsDefaults,
} from "@/constants/homeSettingsDefaults";

interface SupportTicket {
  id: string;
  ticket_number: number;
  agency_id: string;
  customer_name: string;
  customer_email: string;
  issue_category: string;
  request_text: string;
  status: string;
  created_at: string;
  admin_response?: string | null;
  responded_at?: string | null;
}

type ActivePanel =
  | "custom-videos"
  | "advanced-mode"
  | "installation-guide"
  | "home-customize"
  | "view-tickets"
  | "edit-colors"
  | "learn-more"
  | "ai-customize"
  | "support-customize"
  | "chat-intervention"
  | null;
type SelectedPlan = "plan1" | "plan2" | "plan3";

interface AgencyVersions {
  basic_id: string | null;
  advanced_id: string | null;
  elite_id: string | null;
}

const ClientHub = () => {
  const { email, plan } = useUser();
  const userPlan = plan || "ADVANCED";
  const isStarterPlan = userPlan === "STARTER";
  const isBasicPlan = userPlan === "BASIC";
  const isAdvancedPlan = userPlan === "ADVANCED";
  const brandedPaymentLink = "https://link.saassuite.ai/payment-link/6931fbc4d8c1a8dff7043087";

  // Agency data
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [useAgencyNameUrl, setUseAgencyNameUrl] = useState(false);
  const [agencyVersions, setAgencyVersions] = useState<AgencyVersions>({
    basic_id: null,
    advanced_id: null,
    elite_id: null,
  });
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan>("plan1");
  const planConnection = useGhl(agencyId);
  const selectPlan = (value: SelectedPlan) => {
    if (multiPlanAllowed(value, isAdvancedPlan, planConnection.connected)) setSelectedPlan(value);
  };
  useEffect(() => {
    if (!planConnection.loading && !planConnection.connected && selectedPlan !== "plan1") setSelectedPlan("plan1");
  }, [planConnection.loading, planConnection.connected, selectedPlan]);
  const [colors, setColors] = useState({
    primary: "#3b82f6",
    secondary: "#10b981",
    tertiary: "#f59e0b",
  });
  const [editColorsFocusField, setEditColorsFocusField] = useState<
    "primary" | "secondary" | "tertiary"
  >("primary");
  const [editColorsInitial, setEditColorsInitial] = useState<{
    primary: string;
    secondary: string;
    tertiary: string;
  } | null>(null);

  // Daily checklist
  const [checklistItems, setChecklistItems] = useState(DEFAULT_CHECKLIST_ITEMS);

  // Home settings - using centralized defaults
  const [homeSettings, setHomeSettings] = useState<HomeSettings>(DEFAULT_HOME_SETTINGS);

  // Toggles
  const [customAiHelpEnabled, setCustomAiHelpEnabled] = useState(false);
  const [showChatWidget, setShowChatWidget] = useState(true);
  const [ticketingEnabled, setTicketingEnabled] = useState(false);
  const [generalAiSupportEnabled, setGeneralAiSupportEnabled] = useState(false);
  const [popupEnabled, setPopupEnabled] = useState(false);

  // Webhook URL
  const [webhookUrl, setWebhookUrl] = useState("");
  const [tempWebhookUrl, setTempWebhookUrl] = useState("");
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [dailyChecklistEnabled, setDailyChecklistEnabled] = useState(true);

  // Login settings
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [loginWith, setLoginWith] = useState<"EMAIL" | "NAME" | "BOTH">("EMAIL");
  const [loginWelcomeHeadline, setLoginWelcomeHeadline] = useState("Welcome to Your Client Hub");
  const [loginWelcomeSubheadline, setLoginWelcomeSubheadline] = useState(
    "Enter your details to access your dashboard",
  );

  // Tab names
  const [tabNames, setTabNames] = useState({
    education: "Education",
    home: "Home",
    support: "Support",
  });
  const [defaultLandingPage, setDefaultLandingPage] = useState<string | null>(null);
  const [sectionVisibility, setSectionVisibility] = useState(DEFAULT_HUB_SECTIONS);
  const [humanChatEnabled, setHumanChatEnabled] = useState(true);
  const [planSettingsReady, setPlanSettingsReady] = useState(false);
  const landingAppliedKey = useRef<string | null>(null);
  const [editingTab, setEditingTab] = useState<"education" | "home" | "support" | null>(null);
  const [editingTabValue, setEditingTabValue] = useState("");

  // Checklist title
  const [checklistTitle, setChecklistTitle] = useState("Daily Checklist");
  const [editingChecklistTitle, setEditingChecklistTitle] = useState(false);
  const [editingChecklistTitleValue, setEditingChecklistTitleValue] = useState("");

  // Tickets
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketResponse, setTicketResponse] = useState("");
  const [isSendingTicketResponse, setIsSendingTicketResponse] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [hubSearchParams] = useSearchParams();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [installConfirmed, setInstallConfirmed] = useState(true);
  const [showHubLive, setShowHubLive] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("hubLive") === "1";
  });
  const [hubLiveUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("hubUrl");
  });

  // Part 2 of the walkthrough (Client Hub features) starts once they're here,
  // unless the navigation tour is still running or due first.
  const { startWalkthrough, isWalkthroughMode } = useTipsBot();
  const { actualEmail: tourUser } = useUser();
  useEffect(() => {
    const who = (tourUser || email || "").toLowerCase();
    if (!who || isWalkthroughMode || showHubLive) return;
    if (shouldAutoStart("nav", who)) return;
    if (!shouldAutoStart("hub", who)) return;
    const t = setTimeout(() => startWalkthrough("hub", readTour("hub", who).step), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourUser, email, isWalkthroughMode, showHubLive]);

  // Install status drives the glowing highlight on the Installation Guide button
  useEffect(() => {
    if (!email) return;
    (async () => {
      const { checkInstallStatus } = await import("@/lib/installStatus");
      setInstallConfirmed(await checkInstallStatus(email));
    })();
  }, [email]);

  // The install banner asks the (desktop-only) guide to open
  useEffect(() => {
    const handler = () => setActivePanel("installation-guide");
    window.addEventListener("open-installation-guide", handler);
    return () => window.removeEventListener("open-installation-guide", handler);
  }, []);

  const [selectedHomeTab, setSelectedHomeTab] = useState("welcome");

  // Everyone is on V3 permanently — the V2 editor can no longer be selected.
  const [uiVersion, setUiVersionRaw] = useState<"v2" | "v3">("v3");
  const setUiVersion = (_v: "v2" | "v3") => setUiVersionRaw("v3");
  const [showV2Ui, setShowV2Ui] = useState(false);
  const [v3LivePreviewTab, setV3LivePreviewTab] = useState<
    "education" | "home" | "support" | "popup" | "theme" | "assign"
  >(() => {
    if (typeof window === "undefined") return "home";
    return new URLSearchParams(window.location.search).get("support") === "1" ? "support" : "home";
  });
  useEffect(() => {
    if (hubSearchParams.get("panel") === "installation-guide") setActivePanel("installation-guide");
    const link = editorHubDeepLink(hubSearchParams);
    if (!link) return;
    const page = resolveHubLandingPage({ saved: null, supportEnabled: true, deepLink: link });
    if (page === "home" || page === "education" || page === "support") setV3LivePreviewTab(page);
  }, [hubSearchParams]);
  const hubUrlFor = useHubUrls([
    agencyId,
    agencyVersions.basic_id,
    agencyVersions.advanced_id,
    agencyVersions.elite_id,
  ]);
  const [v3LoginDialogOpen, setV3LoginDialogOpen] = useState(false);

  // Branded AI Support state
  const [hasBrandedSupport, setHasBrandedSupport] = useState(false);
  const [showBrandedUpgradePopup, setShowBrandedUpgradePopup] = useState(false);

  // Sync Plans Dialog state
  const [showSyncPlansDialog, setShowSyncPlansDialog] = useState(false);

  // AI Chat Customization state
  const [aiChatType, setAiChatType] = useState<"GHL" | "NATIVE">("NATIVE");
  const [promptPersonality, setPromptPersonality] = useState("");
  const [promptGoals, setPromptGoals] = useState("");
  const [promptAdditionalInstructions, setPromptAdditionalInstructions] = useState("");

  // Support Tab Customization state
  const [supportHeadline, setSupportHeadline] = useState("How can we help?");
  const [supportSubheadline, setSupportSubheadline] = useState(
    "Get instant answers or connect with our team",
  );
  const [supportButton1Text, setSupportButton1Text] = useState("");
  const [supportButton1Url, setSupportButton1Url] = useState("");
  const [supportButton1Color, setSupportButton1Color] = useState("#3b82f6");
  const [supportButton1OpenAsPopup, setSupportButton1OpenAsPopup] = useState(false);
  const [supportButton2Text, setSupportButton2Text] = useState("");
  const [supportButton2Url, setSupportButton2Url] = useState("");
  const [supportButton2Color, setSupportButton2Color] = useState("#3b82f6");
  const [supportButton2OpenAsPopup, setSupportButton2OpenAsPopup] = useState(false);
  const [supportButton3Text, setSupportButton3Text] = useState("");
  const [supportButton3Url, setSupportButton3Url] = useState("");
  const [supportButton3Color, setSupportButton3Color] = useState("#3b82f6");
  const [supportButton3OpenAsPopup, setSupportButton3OpenAsPopup] = useState(false);
  const [aiChatName, setAiChatName] = useState("AI Support Assistant");
  const [aiChatIconUrl, setAiChatIconUrl] = useState("");
  const [selectedSupportTab, setSelectedSupportTab] = useState("text");
  const [promptTrainingDoc, setPromptTrainingDoc] = useState("");

  // Listen for tipbot navigation events
  useEffect(() => {
    const handleTipbotNavigate = (
      event: CustomEvent<{
        openPanel?: string;
        selectTab?: string;
        v3LiveTab?: "home" | "education" | "support";
        uiVersion?: "v2" | "v3";
      }>,
    ) => {
      const { openPanel, selectTab, v3LiveTab, uiVersion: nextV } = event.detail;
      if (nextV === "v3" || nextV === "v2") {
        setUiVersion(nextV);
      }
      if (v3LiveTab) {
        setV3LivePreviewTab(v3LiveTab);
      }
      if (openPanel) {
        setActivePanel(openPanel as ActivePanel);
      }
      if (selectTab) {
        setSelectedHomeTab(selectTab);
      }
    };

    window.addEventListener("tipbot-navigate", handleTipbotNavigate as EventListener);
    return () => {
      window.removeEventListener("tipbot-navigate", handleTipbotNavigate as EventListener);
    };
  }, []);

  // Expose current UI version for the walkthrough so it can pick the right tip set
  useEffect(() => {
    (window as any).__clientHubUiVersion = uiVersion;
  }, [uiVersion]);

  useEffect(() => {
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setIsLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    const loadData = async () => {
      if (!email) {
        stop();
        setIsLoading(false);
        setLoadError(null);
        return;
      }

      try {
        // Fetch user data
        const { data: userData, error: userError } = await supabase
          .from("saas_suite_users")
          .select(
            "agency_id, agency_name, use_agency_name_url, primary_color, secondary_color, tertiary_color, custom_ai_general_help_enabled, show_chat_widget, support_ticketing_enabled, human_chat_enabled, branded_ai_support, login_enabled, login_with, login_welcome_headline, login_welcome_subheadline, support_webhook_url, show_v2_ui, popup_enabled",
          )
          .ilike("email", email)
          .maybeSingle();

        if (userError) {
          console.error("Error loading user data:", userError);
        } else if (userData) {
          setAgencyId(userData.agency_id);
          setAgencyName(userData.agency_name);
          setUseAgencyNameUrl(userData.use_agency_name_url || false);
          setColors({
            primary: userData.primary_color || "#3b82f6",
            secondary: userData.secondary_color || "#10b981",
            tertiary: userData.tertiary_color || "#f59e0b",
          });
          setCustomAiHelpEnabled((userData as any).custom_ai_general_help_enabled || false);
          setShowChatWidget(userData.show_chat_widget || false);
          setTicketingEnabled(userData.support_ticketing_enabled || false);
          setHumanChatEnabled((userData as { human_chat_enabled?: boolean | null }).human_chat_enabled ?? true);
          setPopupEnabled((userData as any).popup_enabled || false);
          setHasBrandedSupport(userData.branded_ai_support || false);
          const v2Allowed = (userData as any).show_v2_ui ?? false;
          setShowV2Ui(false);
          if (!v2Allowed) setUiVersion("v3");
          setLoginEnabled(userData.login_enabled ?? true);
          setLoginWith((userData.login_with as "EMAIL" | "NAME" | "BOTH") || "EMAIL");
          setLoginWelcomeHeadline(userData.login_welcome_headline || "Welcome to Your Client Hub");
          setLoginWelcomeSubheadline(
            userData.login_welcome_subheadline || "Enter your details to access your dashboard",
          );
          setWebhookUrl((userData as any).support_webhook_url ?? "");
          setTempWebhookUrl((userData as any).support_webhook_url ?? "");

          // Fetch checklist items if agency_id exists
          if (userData.agency_id) {
            const { data: checklistData } = await supabase
              .from("agency_daily_checklist")
              .select("item_1, item_2, item_3")
              .eq("agency_id", userData.agency_id)
              .maybeSingle();

            if (checklistData) {
              setChecklistItems({
                item_1: checklistData.item_1 || "Complete your daily outreach",
                item_2: checklistData.item_2 || "Follow up with pending leads",
                item_3: checklistData.item_3 || "Review your pipeline progress",
              });
            }

            // Fetch home settings
            const { data: homeData } = await supabase.rpc("get_v2_home_settings", {
              p_agency_id: userData.agency_id,
            });

            if (homeData && homeData.length > 0) {
              const settings = homeData[0];
              setHomeSettings({
                welcome_enabled: settings.welcome_enabled ?? true,
                welcome_headline:
                  settings.welcome_headline || "Welcome to your custom software solution",
                welcome_subheadline:
                  settings.welcome_subheadline || "Get started with the tools and resources below.",
                welcome_video_enabled: settings.welcome_video_enabled ?? false,
                welcome_video_url: settings.welcome_video_url || null,
                welcome_video_is_embed: (settings as any).welcome_video_is_embed ?? false,
                welcome_video_thumbnail_url: (settings as any).welcome_video_thumbnail_url ?? null,
                welcome_video_source: ((settings as any).welcome_video_source as any) || "url",
                welcome_video_library_category_id:
                  (settings as any).welcome_video_library_category_id ?? null,
                welcome_video_library_module_id:
                  (settings as any).welcome_video_library_module_id ?? null,
                welcome_video_custom_video_id:
                  (settings as any).welcome_video_custom_video_id ?? null,
                announcements_enabled: settings.announcements_enabled ?? false,
                announcements_headline: settings.announcements_headline,
                announcements_paragraph: settings.announcements_paragraph,
                announcements_image_url: settings.announcements_image_url,
                custom_links_enabled: settings.custom_links_enabled ?? false,
                custom_link_1_text: settings.custom_link_1_text,
                custom_link_1_url: settings.custom_link_1_url,
                custom_link_1_color: settings.custom_link_1_color || "#3b82f6",
                custom_link_1_open_as_popup: (settings as any).custom_link_1_open_as_popup ?? false,
                custom_link_2_text: settings.custom_link_2_text,
                custom_link_2_url: settings.custom_link_2_url,
                custom_link_2_color: settings.custom_link_2_color || "#3b82f6",
                custom_link_2_open_as_popup: (settings as any).custom_link_2_open_as_popup ?? false,
                custom_link_3_text: settings.custom_link_3_text,
                custom_link_3_url: settings.custom_link_3_url,
                custom_link_3_color: settings.custom_link_3_color || "#3b82f6",
                custom_link_3_open_as_popup: (settings as any).custom_link_3_open_as_popup ?? false,
                next_steps_enabled: (settings as any).next_steps_enabled ?? true,
                next_steps_priority:
                  ((settings as any).next_steps_priority as HomeSettings["next_steps_priority"]) ||
                  "onboarding_videos",
                next_steps_custom_text: (settings as any).next_steps_custom_text ?? null,
                next_steps_custom_url: (settings as any).next_steps_custom_url ?? null,
                next_steps_custom_url_label: (settings as any).next_steps_custom_url_label ?? null,
              });
              // Load tab names
              setTabNames({
                education: (settings as any).tab_name_education || "Education",
                home: (settings as any).tab_name_home || "Home",
                support: (settings as any).tab_name_support || "Support",
              });
              // Load checklist title
              setChecklistTitle((settings as any).checklist_title || "Daily Checklist");
              // Load general AI support setting (default to false)
              setGeneralAiSupportEnabled(settings.ai_chat_enabled ?? false);
              // Load daily checklist enabled setting (default to false)
              setDailyChecklistEnabled((settings as any).daily_checklist_enabled ?? false);
              // Load AI chat customization settings
              setAiChatType((settings.ai_chat_type as "GHL" | "NATIVE") || "NATIVE");
              setPromptPersonality(settings.prompt_personality || "");
              setPromptGoals(settings.prompt_goals || "");
              setPromptAdditionalInstructions(settings.prompt_additional_instructions || "");
              setPromptTrainingDoc(settings.prompt_training_doc || "");
              // Load support settings
              setSupportHeadline((settings as any).support_headline || "How can we help?");
              setSupportSubheadline(
                (settings as any).support_subheadline ||
                  "Get instant answers or connect with our team",
              );
              setSupportButton1Text((settings as any).support_button_1_text || "");
              setSupportButton1Url((settings as any).support_button_1_url || "");
              setSupportButton1Color((settings as any).support_button_1_color || "#3b82f6");
              setSupportButton1OpenAsPopup(
                (settings as any).support_button_1_open_as_popup ?? false,
              );
              setSupportButton2Text((settings as any).support_button_2_text || "");
              setSupportButton2Url((settings as any).support_button_2_url || "");
              setSupportButton2Color((settings as any).support_button_2_color || "#3b82f6");
              setSupportButton2OpenAsPopup(
                (settings as any).support_button_2_open_as_popup ?? false,
              );
              setSupportButton3Text((settings as any).support_button_3_text || "");
              setSupportButton3Url((settings as any).support_button_3_url || "");
              setSupportButton3Color((settings as any).support_button_3_color || "#3b82f6");
              setSupportButton3OpenAsPopup(
                (settings as any).support_button_3_open_as_popup ?? false,
              );
              setAiChatName((settings as any).ai_chat_name || "AI Support Assistant");
              setAiChatIconUrl((settings as any).ai_chat_icon_url || "");
            }
          }
        }

        // Fetch agency versions
        const { data: versions } = await supabase.rpc("get_user_agency_versions", {
          user_email: email,
        });

        if (versions && versions.length > 0) {
          setAgencyVersions({
            basic_id: versions[0].basic_id || userData.agency_id || null,
            advanced_id: versions[0].advanced_id,
            elite_id: versions[0].elite_id,
          });
        } else if (userData.agency_id) {
          // Fallback: use agency_id as Plan 1 if no versions exist yet
          setAgencyVersions((prev) => ({
            ...prev,
            basic_id: userData.agency_id,
          }));
        }

        // Fetch tickets
        const { data: ticketsData } = await supabase.rpc("get_agency_tickets", {
          user_email: email,
        });

        if (ticketsData) {
          setTickets(ticketsData);
        }
        if (alive) setLoadError(null);
      } catch (error) {
        console.error("Error loading data:", error);
        if (alive) setLoadError(loadErrorText(error, "Couldn't load Client Hub."));
      } finally {
        stop();
        if (alive) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      alive = false;
      stop();
    };
  }, [email, loadAttempt]);

  // Load plan-specific settings when selected plan changes
  useEffect(() => {
    const loadPlanSettings = async () => {
      const planAgencyId = getSelectedPlanAgencyId();
      setPlanSettingsReady(false);
      if (!planAgencyId) {
        // Reset to defaults if no plan URL exists
        setHomeSettings(DEFAULT_HOME_SETTINGS);
        setTabNames(DEFAULT_TAB_NAMES);
        setDefaultLandingPage(null);
        setSectionVisibility(DEFAULT_HUB_SECTIONS);
        setChecklistTitle(DEFAULT_CHECKLIST_TITLE);
        setChecklistItems(DEFAULT_CHECKLIST_ITEMS);
        setGeneralAiSupportEnabled(false);
        setDailyChecklistEnabled(true);
        setPlanSettingsReady(true);
        return;
      }

      try {
        // Fetch home settings for selected plan
        const { data: homeData } = await supabase.rpc("get_v2_home_settings", {
          p_agency_id: planAgencyId,
        });

        if (homeData && homeData.length > 0) {
          const settings = homeData[0];
          setSectionVisibility(readHubSections(settings));
          setHomeSettings({
            welcome_enabled: settings.welcome_enabled ?? DEFAULT_HOME_SETTINGS.welcome_enabled,
            welcome_headline: settings.welcome_headline || DEFAULT_HOME_SETTINGS.welcome_headline,
            welcome_subheadline:
              settings.welcome_subheadline || DEFAULT_HOME_SETTINGS.welcome_subheadline,
            welcome_video_enabled:
              settings.welcome_video_enabled ?? DEFAULT_HOME_SETTINGS.welcome_video_enabled,
            welcome_video_url:
              settings.welcome_video_url || DEFAULT_HOME_SETTINGS.welcome_video_url,
            welcome_video_is_embed:
              (settings as any).welcome_video_is_embed ??
              DEFAULT_HOME_SETTINGS.welcome_video_is_embed,
            welcome_video_thumbnail_url:
              (settings as any).welcome_video_thumbnail_url ??
              DEFAULT_HOME_SETTINGS.welcome_video_thumbnail_url,
            welcome_video_source: ((settings as any).welcome_video_source as any) || "url",
            welcome_video_library_category_id:
              (settings as any).welcome_video_library_category_id ?? null,
            welcome_video_library_module_id:
              (settings as any).welcome_video_library_module_id ?? null,
            welcome_video_custom_video_id: (settings as any).welcome_video_custom_video_id ?? null,
            announcements_enabled:
              settings.announcements_enabled ?? DEFAULT_HOME_SETTINGS.announcements_enabled,
            announcements_headline: settings.announcements_headline,
            announcements_paragraph: settings.announcements_paragraph,
            announcements_image_url: settings.announcements_image_url,
            custom_links_enabled:
              settings.custom_links_enabled ?? DEFAULT_HOME_SETTINGS.custom_links_enabled,
            custom_link_1_text: settings.custom_link_1_text,
            custom_link_1_url: settings.custom_link_1_url,
            custom_link_1_color:
              settings.custom_link_1_color || DEFAULT_HOME_SETTINGS.custom_link_1_color,
            custom_link_1_open_as_popup:
              (settings as any).custom_link_1_open_as_popup ??
              DEFAULT_HOME_SETTINGS.custom_link_1_open_as_popup,
            custom_link_2_text: settings.custom_link_2_text,
            custom_link_2_url: settings.custom_link_2_url,
            custom_link_2_color:
              settings.custom_link_2_color || DEFAULT_HOME_SETTINGS.custom_link_2_color,
            custom_link_2_open_as_popup:
              (settings as any).custom_link_2_open_as_popup ??
              DEFAULT_HOME_SETTINGS.custom_link_2_open_as_popup,
            custom_link_3_text: settings.custom_link_3_text,
            custom_link_3_url: settings.custom_link_3_url,
            custom_link_3_color:
              settings.custom_link_3_color || DEFAULT_HOME_SETTINGS.custom_link_3_color,
            custom_link_3_open_as_popup:
              (settings as any).custom_link_3_open_as_popup ??
              DEFAULT_HOME_SETTINGS.custom_link_3_open_as_popup,
            next_steps_enabled:
              (settings as any).next_steps_enabled ?? DEFAULT_HOME_SETTINGS.next_steps_enabled,
            next_steps_priority:
              ((settings as any).next_steps_priority as HomeSettings["next_steps_priority"]) ||
              DEFAULT_HOME_SETTINGS.next_steps_priority,
            next_steps_custom_text:
              (settings as any).next_steps_custom_text ??
              DEFAULT_HOME_SETTINGS.next_steps_custom_text,
            next_steps_custom_url:
              (settings as any).next_steps_custom_url ??
              DEFAULT_HOME_SETTINGS.next_steps_custom_url,
            next_steps_custom_url_label:
              (settings as any).next_steps_custom_url_label ??
              DEFAULT_HOME_SETTINGS.next_steps_custom_url_label,
          });
          setTabNames({
            education: (settings as any).tab_name_education || DEFAULT_TAB_NAMES.education,
            home: (settings as any).tab_name_home || DEFAULT_TAB_NAMES.home,
            support: (settings as any).tab_name_support || DEFAULT_TAB_NAMES.support,
          });
          setDefaultLandingPage(
            typeof (settings as { default_landing_page?: string | null }).default_landing_page === "string"
              ? (settings as { default_landing_page: string }).default_landing_page
              : null,
          );
          setChecklistTitle((settings as any).checklist_title || DEFAULT_CHECKLIST_TITLE);
          setGeneralAiSupportEnabled(settings.ai_chat_enabled ?? false);
          setDailyChecklistEnabled((settings as any).daily_checklist_enabled ?? false);
          // Load AI chat customization settings
          setAiChatType(
            (settings.ai_chat_type as "GHL" | "NATIVE") || DEFAULT_AI_SETTINGS.ai_chat_type,
          );
          setPromptPersonality(
            settings.prompt_personality || DEFAULT_AI_SETTINGS.prompt_personality,
          );
          setPromptGoals(settings.prompt_goals || DEFAULT_AI_SETTINGS.prompt_goals);
          setPromptAdditionalInstructions(
            settings.prompt_additional_instructions ||
              DEFAULT_AI_SETTINGS.prompt_additional_instructions,
          );
          setPromptTrainingDoc(
            settings.prompt_training_doc || DEFAULT_AI_SETTINGS.prompt_training_doc,
          );
          // Load support settings
          setSupportHeadline((settings as any).support_headline || "How can we help?");
          setSupportSubheadline(
            (settings as any).support_subheadline || "Get instant answers or connect with our team",
          );
          setSupportButton1Text((settings as any).support_button_1_text || "");
          setSupportButton1Url((settings as any).support_button_1_url || "");
          setSupportButton1Color((settings as any).support_button_1_color || "#3b82f6");
          setSupportButton1OpenAsPopup((settings as any).support_button_1_open_as_popup ?? false);
          setSupportButton2Text((settings as any).support_button_2_text || "");
          setSupportButton2Url((settings as any).support_button_2_url || "");
          setSupportButton2Color((settings as any).support_button_2_color || "#3b82f6");
          setSupportButton2OpenAsPopup((settings as any).support_button_2_open_as_popup ?? false);
          setSupportButton3Text((settings as any).support_button_3_text || "");
          setSupportButton3Url((settings as any).support_button_3_url || "");
          setSupportButton3Color((settings as any).support_button_3_color || "#3b82f6");
          setSupportButton3OpenAsPopup((settings as any).support_button_3_open_as_popup ?? false);
          setAiChatName((settings as any).ai_chat_name || "AI Support Assistant");
          setAiChatIconUrl((settings as any).ai_chat_icon_url || "");
        } else {
          // Reset to defaults for plans without settings yet
          setHomeSettings(DEFAULT_HOME_SETTINGS);
          setTabNames(DEFAULT_TAB_NAMES);
          setDefaultLandingPage(null);
          setSectionVisibility(DEFAULT_HUB_SECTIONS);
          setChecklistTitle(DEFAULT_CHECKLIST_TITLE);
          setGeneralAiSupportEnabled(false);
          setDailyChecklistEnabled(true);
          // Reset AI settings
          setAiChatType(DEFAULT_AI_SETTINGS.ai_chat_type);
          setPromptPersonality(DEFAULT_AI_SETTINGS.prompt_personality);
          setPromptGoals(DEFAULT_AI_SETTINGS.prompt_goals);
          setPromptAdditionalInstructions(DEFAULT_AI_SETTINGS.prompt_additional_instructions);
          setPromptTrainingDoc(DEFAULT_AI_SETTINGS.prompt_training_doc);
          // Reset support settings
          setSupportHeadline("How can we help?");
          setSupportSubheadline("Get instant answers or connect with our team");
          setSupportButton1Text("");
          setSupportButton1Url("");
          setSupportButton1Color("#3b82f6");
          setSupportButton2Text("");
          setSupportButton2Url("");
          setSupportButton2Color("#3b82f6");
          setSupportButton3Text("");
          setSupportButton3Url("");
          setSupportButton3Color("#3b82f6");
          setAiChatName("AI Support Assistant");
          setAiChatIconUrl("");
        }

        // Fetch checklist items for selected plan
        const { data: checklistData } = await supabase
          .from("agency_daily_checklist")
          .select("item_1, item_2, item_3")
          .eq("agency_id", planAgencyId)
          .maybeSingle();

        if (checklistData) {
          setChecklistItems({
            item_1: checklistData.item_1 || DEFAULT_CHECKLIST_ITEMS.item_1,
            item_2: checklistData.item_2 || DEFAULT_CHECKLIST_ITEMS.item_2,
            item_3: checklistData.item_3 || DEFAULT_CHECKLIST_ITEMS.item_3,
          });
        } else {
          setChecklistItems(DEFAULT_CHECKLIST_ITEMS);
        }
      } catch (error) {
        console.error("Error loading plan settings:", error);
      } finally {
        setPlanSettingsReady(true);
      }
    };

    loadPlanSettings();
  }, [selectedPlan, agencyVersions]);

  const getCurrentUrl = () => {
    // Always use the properly formatted agency_id, not raw agency_name
    const id = agencyId;
    return hubUrlFor(id);
  };

  const getSelectedPlanUrl = (): string => {
    // Use the actual agency_id values from agencyVersions which are already properly formatted slugs
    const getId = () => {
      if (selectedPlan === "plan1") return agencyVersions.basic_id;
      if (selectedPlan === "plan2") return agencyVersions.advanced_id;
      return agencyVersions.elite_id;
    };

    const id = getId();
    return hubUrlFor(id);
  };

  const getSelectedPlanAgencyId = (): string | null => {
    if (selectedPlan === "plan1") return agencyVersions.basic_id;
    if (selectedPlan === "plan2") return agencyVersions.advanced_id;
    return agencyVersions.elite_id;
  };

  const hasSelectedPlanUrl = (): boolean => {
    return !!getSelectedPlanAgencyId();
  };

  const supportTabVisible = isHubSupportTabEnabled({
    supportTicketingEnabled: ticketingEnabled,
    chatConfig: {
      ai_chat_enabled: generalAiSupportEnabled,
      human_chat_enabled: humanChatEnabled,
    },
  });
  const resolvedLandingPage = visibleHubDefault(defaultLandingPage, sectionVisibility);
  const landingChoices = visibleHubSections(sectionVisibility);

  useEffect(() => {
    if (!planSettingsReady) return;
    if (editorHubDeepLink(hubSearchParams)) return;
    const planId = getSelectedPlanAgencyId() ?? "";
    const key = `${planId}|${defaultLandingPage ?? ""}|${JSON.stringify(sectionVisibility)}`;
    if (landingAppliedKey.current === key) return;
    landingAppliedKey.current = key;
    if (resolvedLandingPage === "home" || resolvedLandingPage === "education" || resolvedLandingPage === "support") {
      setV3LivePreviewTab(resolvedLandingPage);
    }
  }, [planSettingsReady, defaultLandingPage, sectionVisibility, hubSearchParams, resolvedLandingPage, selectedPlan, agencyVersions]);

  // Plan URLs are created automatically — never ask the user to "create" one.
  const autoCreatingRef = useRef(false);
  useEffect(() => {
    if (!email || isLoading || autoCreatingRef.current) return;
    const missing: Array<"basic" | "advanced" | "elite"> = [];
    if (!agencyVersions.basic_id) missing.push("basic");
    if (isAdvancedPlan && !agencyVersions.advanced_id) missing.push("advanced");
    if (isAdvancedPlan && !agencyVersions.elite_id) missing.push("elite");
    if (!missing.length) return;
    autoCreatingRef.current = true;
    (async () => {
      for (const v of missing) {
        const { data, error } = await supabase.rpc("create_agency_version_safe", {
          user_email: email,
          version_type: v,
        });
        if (!error && data) setAgencyVersions((prev) => ({ ...prev, [`${v}_id`]: data as string }));
      }
    })();
  }, [email, isLoading, isAdvancedPlan, agencyVersions]);

  // "Customize URL": the agency name drives every plan URL (DB trigger renames them).
  const [customizeUrlOpen, setCustomizeUrlOpen] = useState(false);
  const [customizeName, setCustomizeName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const openCustomizeUrl = () => {
    setCustomizeName(agencyName || "");
    setCustomizeUrlOpen(true);
  };
  const saveCustomizeUrl = async () => {
    const name = customizeName.trim();
    if (!email || !name) return;
    setSavingName(true);
    try {
      const { error } = await (supabase as any).rpc("update_account_profile", {
        p_email: email,
        p_full_name: null,
        p_phone: null,
        p_agency_name: name,
      });
      if (error) {
        if ((error as any).code === "23505")
          throw new Error("That agency name is already taken — try a slightly different one.");
        throw error;
      }
      const { data: versions } = await supabase.rpc("get_user_agency_versions", {
        user_email: email,
      });
      if (versions?.[0]) {
        setAgencyId(versions[0].base_id);
        setAgencyVersions({
          basic_id: versions[0].basic_id || versions[0].base_id,
          advanced_id: versions[0].advanced_id,
          elite_id: versions[0].elite_id,
        });
      }
      setAgencyName(name);
      setCustomizeUrlOpen(false);
      toast.success("Your Client Hub URLs were updated");
    } catch (e: any) {
      toast.error(e?.message || "Failed to update agency name");
    } finally {
      setSavingName(false);
    }
  };

  const createAgencyVersion = async (version: "basic" | "advanced" | "elite") => {
    if (!email) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase.rpc("create_agency_version_safe", {
        user_email: email,
        version_type: version,
      });

      if (error) throw error;

      setAgencyVersions((prev) => ({
        ...prev,
        [`${version}_id`]: data,
      }));

      toast.success(
        `${version === "basic" ? "Plan 1" : version === "advanced" ? "Plan 2" : "Plan 3"} URL created!`,
      );
    } catch (error) {
      console.error("Error creating version:", error);
      toast.error("Failed to create version");
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  // Helper to ensure v2_home_settings row exists before updating
  // Uses centralized defaults to prevent stale data when new columns are added
  const saveDefaultLandingPage = async (page: HubLandingPage) => {
    if (!visibleHubSections(sectionVisibility).includes(page)) return;
    const planAgencyId = getSelectedPlanAgencyId();
    if (!planAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }
    setIsSaving(true);
    try {
      await ensureHomeSettingsRow(planAgencyId);
      const { error } = await supabase
        .from("v2_home_settings")
        .update({ default_landing_page: page })
        .eq("agency_id", planAgencyId);
      if (error) throw error;
      setDefaultLandingPage(page);
      setV3LivePreviewTab(page);
      toast.success("Default landing page saved");
    } catch (error) {
      console.error("Error saving default landing page:", error);
      toast.error("Couldn't save the default landing page");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSectionVisibility = async (page: HubLandingPage, enabled: boolean) => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!planAgencyId || isSaving || !planSettingsReady) return;
    setIsSaving(true);
    try {
      const update = hubSectionChange(sectionVisibility, defaultLandingPage, page, enabled);
      await ensureHomeSettingsRow(planAgencyId);
      const { error } = await supabase.from("v2_home_settings").update(update).eq("agency_id", planAgencyId);
      if (error) throw error;
      setSectionVisibility(readHubSections(update));
      setDefaultLandingPage(update.default_landing_page);
      setV3LivePreviewTab(update.default_landing_page);
      toast.success("Client Hub sections saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save Client Hub sections");
    } finally {
      setIsSaving(false);
    }
  };

  const ensureHomeSettingsRow = async (planAgencyId: string) => {
    const { data: existing, error: readError } = await supabase
      .from("v2_home_settings")
      .select("id")
      .eq("agency_id", planAgencyId)
      .maybeSingle();
    if (readError) throw readError;

    if (!existing) {
      // Create row with all defaults from centralized constant
      const { error } = await supabase
        .from("v2_home_settings")
        .insert(getV2HomeSettingsDefaults(planAgencyId) as any);
      if (error) throw error;
    }
  };

  const saveChecklistItems = async () => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!email || !planAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("agency_daily_checklist").upsert(
        {
          agency_id: planAgencyId,
          item_1: checklistItems.item_1,
          item_2: checklistItems.item_2,
          item_3: checklistItems.item_3,
        },
        { onConflict: "agency_id" },
      );

      if (error) throw error;
      toast.success(
        `Daily checklist saved for ${selectedPlan === "plan1" ? "Plan 1" : selectedPlan === "plan2" ? "Plan 2" : "Plan 3"}!`,
      );
    } catch (error) {
      console.error("Error saving checklist:", error);
      toast.error("Failed to save checklist");
    } finally {
      setIsSaving(false);
    }
  };

  const saveHomeSettings = async () => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!email || !planAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }

    setIsSaving(true);
    try {
      // Ensure row exists first
      await ensureHomeSettingsRow(planAgencyId);

      // Then update just the home settings fields
      const { error } = await supabase
        .from("v2_home_settings")
        .update({
          welcome_enabled: homeSettings.welcome_enabled,
          welcome_headline: homeSettings.welcome_headline,
          welcome_subheadline: homeSettings.welcome_subheadline,
          welcome_video_enabled: homeSettings.welcome_video_enabled,
          welcome_video_url: homeSettings.welcome_video_url,
          welcome_video_is_embed: homeSettings.welcome_video_is_embed,
          welcome_video_thumbnail_url: homeSettings.welcome_video_thumbnail_url,
          welcome_video_source: homeSettings.welcome_video_source || "url",
          welcome_video_library_category_id:
            homeSettings.welcome_video_source === "library"
              ? homeSettings.welcome_video_library_category_id
              : null,
          welcome_video_library_module_id:
            homeSettings.welcome_video_source === "library"
              ? homeSettings.welcome_video_library_module_id
              : null,
          welcome_video_custom_video_id:
            homeSettings.welcome_video_source === "custom"
              ? homeSettings.welcome_video_custom_video_id
              : null,
          announcements_enabled: homeSettings.announcements_enabled,
          announcements_headline: homeSettings.announcements_headline,
          announcements_paragraph: homeSettings.announcements_paragraph,
          announcements_image_url: homeSettings.announcements_image_url,
          custom_links_enabled: homeSettings.custom_links_enabled,
          custom_link_1_text: homeSettings.custom_link_1_text,
          custom_link_1_url: homeSettings.custom_link_1_url,
          custom_link_1_color: homeSettings.custom_link_1_color,
          custom_link_1_open_as_popup: homeSettings.custom_link_1_open_as_popup,
          custom_link_2_text: homeSettings.custom_link_2_text,
          custom_link_2_url: homeSettings.custom_link_2_url,
          custom_link_2_color: homeSettings.custom_link_2_color,
          custom_link_2_open_as_popup: homeSettings.custom_link_2_open_as_popup,
          custom_link_3_text: homeSettings.custom_link_3_text,
          custom_link_3_url: homeSettings.custom_link_3_url,
          custom_link_3_color: homeSettings.custom_link_3_color,
          custom_link_3_open_as_popup: homeSettings.custom_link_3_open_as_popup,
          next_steps_enabled: homeSettings.next_steps_enabled,
          next_steps_priority: homeSettings.next_steps_priority,
          next_steps_custom_text: homeSettings.next_steps_custom_text,
          next_steps_custom_url: homeSettings.next_steps_custom_url,
          next_steps_custom_url_label: homeSettings.next_steps_custom_url_label,
        } as any)
        .eq("agency_id", planAgencyId);

      if (error) throw error;
      toast.success(
        `Home settings saved for ${selectedPlan === "plan1" ? "Plan 1" : selectedPlan === "plan2" ? "Plan 2" : "Plan 3"}!`,
      );
    } catch (error) {
      console.error("Error saving home settings:", error);
      toast.error("Failed to save home settings");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCustomAiHelp = async (enabled: boolean) => {
    if (!email) return;

    try {
      const { error } = await supabase
        .from("saas_suite_users")
        .update({ custom_ai_general_help_enabled: enabled } as any)
        .ilike("email", email);

      if (error) throw error;
      setCustomAiHelpEnabled(enabled);
      toast.success(enabled ? "Custom AI Help enabled" : "Custom AI Help disabled");
    } catch (error) {
      console.error("Error toggling AI help:", error);
      toast.error("Failed to update setting");
    }
  };

  const toggleChatWidget = async (enabled: boolean) => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!email || !planAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }

    try {
      // Ensure row exists first
      await ensureHomeSettingsRow(planAgencyId);

      // Update ai_chat_enabled in v2_home_settings for the selected plan
      const { error } = await supabase
        .from("v2_home_settings")
        .update({ ai_chat_enabled: enabled })
        .eq("agency_id", planAgencyId);

      if (error) throw error;
      setGeneralAiSupportEnabled(enabled);
      toast.success(enabled ? "AI Chat Support enabled" : "AI Chat Support disabled");
    } catch (error) {
      console.error("Error toggling AI chat support:", error);
      toast.error("Failed to update setting");
    }
  };

  const toggleTicketing = async (enabled: boolean) => {
    if (!email) return;

    try {
      const { error } = await supabase
        .from("saas_suite_users")
        .update({ support_ticketing_enabled: enabled })
        .ilike("email", email);

      if (error) throw error;
      setTicketingEnabled(enabled);
      toast.success(enabled ? "Support ticketing enabled" : "Support ticketing disabled");
    } catch (error) {
      console.error("Error toggling ticketing:", error);
      toast.error("Failed to update setting");
    }
  };

  const togglePopup = async (enabled: boolean) => {
    if (!email) return;
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase
        .from("saas_suite_users")
        .update({ popup_enabled: enabled } as any)
        .ilike("email", normalizedEmail)
        .select(
          "email, popup_enabled, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite",
        );
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("No row updated — check RLS / impersonation");
        return;
      }
      setPopupEnabled(enabled);
      toast.success(enabled ? "Popup enabled" : "Popup disabled");

      // Bust the dynamic-styles cache so the popup launcher JS is regenerated
      // immediately for every agency_id variant this user owns. Without this,
      // the cached JS still injects the launcher (or fails to inject it) for
      // up to 5 minutes after the toggle.
      try {
        const row: any = data[0] || {};
        const ids = [
          row.agency_id,
          row.agency_id_basic,
          row.agency_id_advanced,
          row.agency_id_elite,
        ].filter((v: any) => typeof v === "string" && v.length > 0);
        const base = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/dynamic-styles`;
        await Promise.all(
          Array.from(new Set(ids)).flatMap((id) => [
            fetch(`${base}?agency_id=${encodeURIComponent(id)}&type=js&force=1`, {
              cache: "no-store",
            }),
            fetch(`${base}?agency_id=${encodeURIComponent(id)}&type=css&force=1`, {
              cache: "no-store",
            }),
          ]),
        );
      } catch (e) {
        console.warn("Cache bust failed (non-fatal):", e);
      }
    } catch (error) {
      console.error("Error toggling popup:", error);
      toast.error("Failed to update setting");
    }
  };

  const saveWebhookUrl = async () => {
    if (!email) return;

    setIsSavingWebhook(true);
    try {
      const { error } = await supabase
        .from("saas_suite_users")
        .update({ support_webhook_url: tempWebhookUrl } as any)
        .ilike("email", email);

      if (error) {
        console.error("Error saving webhook URL:", error);
        toast.error("Failed to save webhook URL");
        return;
      }

      setWebhookUrl(tempWebhookUrl);
      toast.success("Webhook URL saved!");
    } catch (error) {
      console.error("Error saving webhook URL:", error);
      toast.error("Failed to save webhook URL");
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast.error("Please save a webhook URL first");
      return;
    }

    setIsTestingWebhook(true);
    try {
      const sampleTicket = {
        id: "test-" + Date.now(),
        ticket_number: 0,
        agency_id: agencyId || "test-agency",
        customer_name: "Test Customer",
        customer_email: "test@example.com",
        issue_category: "Test Category",
        request_text:
          "This is a test webhook payload to verify your endpoint is working correctly.",
        status: "open",
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.functions.invoke("notify-support-webhook", {
        body: {
          event_type: "test_webhook",
          ticket: sampleTicket,
        },
      });

      if (error) {
        console.error("Error testing webhook:", error);
        toast.error("Failed to send test webhook");
        return;
      }

      toast.success("Test webhook sent! Check your endpoint for the payload.");
    } catch (error) {
      console.error("Error testing webhook:", error);
      toast.error("Failed to send test webhook");
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const toggleGeneralAiSupport = async (enabled: boolean) => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!email || !planAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }

    try {
      // Ensure row exists first
      await ensureHomeSettingsRow(planAgencyId);

      // Then update just the specific field
      const { error } = await supabase
        .from("v2_home_settings")
        .update({ ai_chat_enabled: enabled })
        .eq("agency_id", planAgencyId);

      if (error) throw error;
      setGeneralAiSupportEnabled(enabled);
      toast.success(enabled ? "General AI Support enabled" : "General AI Support disabled");
    } catch (error) {
      console.error("Error toggling general AI support:", error);
      toast.error("Failed to update setting");
    }
  };

  const toggleDailyChecklist = async (enabled: boolean) => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!email || !planAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }

    try {
      // Ensure row exists first
      await ensureHomeSettingsRow(planAgencyId);

      // Then update just the specific field
      const { error } = await supabase
        .from("v2_home_settings")
        .update({ daily_checklist_enabled: enabled } as any)
        .eq("agency_id", planAgencyId);

      if (error) throw error;
      setDailyChecklistEnabled(enabled);
      toast.success(enabled ? "Daily checklist enabled" : "Daily checklist disabled");
    } catch (error) {
      console.error("Error toggling daily checklist:", error);
      toast.error("Failed to update setting");
    }
  };

  const saveAiChatSettings = async () => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!email || !planAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }

    setIsSaving(true);
    try {
      // Ensure row exists first
      await ensureHomeSettingsRow(planAgencyId);

      // Save AI settings without forcing ai_chat_enabled state
      // Allow users to configure settings even if AI chat is currently disabled
      const { error } = await supabase
        .from("v2_home_settings")
        .update({
          ai_chat_type: aiChatType,
          prompt_personality: promptPersonality || null,
          prompt_goals: promptGoals || null,
          prompt_additional_instructions: promptAdditionalInstructions || null,
          prompt_training_doc: promptTrainingDoc || null,
        } as any)
        .eq("agency_id", planAgencyId);

      if (error) throw error;

      // Process training doc for RAG if Native AI is selected
      // Includes video transcriptions + any additional training doc URL content
      if (aiChatType === "NATIVE") {
        const tier =
          selectedPlan === "plan1" ? "basic" : selectedPlan === "plan2" ? "advanced" : "elite";
        processTrainingDocContent(planAgencyId, tier, promptTrainingDoc || undefined);
      }

      toast.success("AI Chat settings saved!");
      setActivePanel(null);
    } catch (error) {
      console.error("Error saving AI chat settings:", error);
      toast.error("Failed to save AI chat settings");
    } finally {
      setIsSaving(false);
    }
  };

  const saveSupportSettings = async () => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!email || !planAgencyId) {
      toast.error("Please create this plan's URL first");
      return;
    }

    setIsSaving(true);
    try {
      // Ensure row exists first
      await ensureHomeSettingsRow(planAgencyId);

      // Update all support-related fields
      // Note: ai_chat_enabled is controlled exclusively by the toggle (toggleChatWidget)
      // and must NOT be overwritten here, otherwise saving support settings would
      // silently disable AI chat for GHL users.
      const { error } = await supabase
        .from("v2_home_settings")
        .update({
          support_headline: supportHeadline || null,
          support_subheadline: supportSubheadline || null,
          support_button_1_text: supportButton1Text || null,
          support_button_1_url: supportButton1Url || null,
          support_button_1_color: supportButton1Color || "#3b82f6",
          support_button_1_open_as_popup: supportButton1OpenAsPopup,
          support_button_2_text: supportButton2Text || null,
          support_button_2_url: supportButton2Url || null,
          support_button_2_color: supportButton2Color || "#3b82f6",
          support_button_2_open_as_popup: supportButton2OpenAsPopup,
          support_button_3_text: supportButton3Text || null,
          support_button_3_url: supportButton3Url || null,
          support_button_3_color: supportButton3Color || "#3b82f6",
          support_button_3_open_as_popup: supportButton3OpenAsPopup,
          ai_chat_name: aiChatName || "AI Support Assistant",
          ai_chat_icon_url: aiChatIconUrl || null,
          ai_chat_type: aiChatType,
          prompt_personality: promptPersonality || null,
          prompt_goals: promptGoals || null,
          prompt_additional_instructions: promptAdditionalInstructions || null,
          prompt_training_doc: promptTrainingDoc || null,
        } as any)
        .eq("agency_id", planAgencyId);

      if (error) throw error;

      // Process training doc for RAG if Native AI is selected
      // Includes video transcriptions + any additional training doc URL content
      if (aiChatType === "NATIVE") {
        const tier =
          selectedPlan === "plan1" ? "basic" : selectedPlan === "plan2" ? "advanced" : "elite";
        processTrainingDocContent(planAgencyId, tier, promptTrainingDoc || undefined);
      }

      toast.success("Support settings saved!");
      setActivePanel(null);
    } catch (error) {
      console.error("Error saving support settings:", error);
      toast.error("Failed to save support settings");
    } finally {
      setIsSaving(false);
    }
  };

  const saveLoginSettings = async () => {
    if (!email) {
      toast.error("Missing user information");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("saas_suite_users")
        .update({
          login_enabled: loginEnabled,
          login_with: loginWith,
          login_welcome_headline: loginWelcomeHeadline,
          login_welcome_subheadline: loginWelcomeSubheadline,
        })
        .ilike("email", email);

      if (error) throw error;
      toast.success("Login settings saved!");
    } catch (error) {
      console.error("Error saving login settings:", error);
      toast.error("Failed to save login settings");
    } finally {
      setIsSaving(false);
    }
  };

  const saveBrandColors = async () => {
    if (!email) {
      toast.error("Missing user information");
      return;
    }

    setIsSaving(true);
    try {
      const { data: updated, error } = await supabase
        .from("saas_suite_users")
        .update({
          primary_color: colors.primary,
          secondary_color: colors.secondary,
          tertiary_color: colors.tertiary,
        })
        .ilike("email", email)
        .select("email");

      if (error) throw error;
      if (!updated || updated.length === 0) {
        toast.error(
          "Couldn't save colors — your account record wasn't found. Refresh and try again.",
        );
        return;
      }
      toast.success("Brand colors saved!");
      setActivePanel(null);
    } catch (error) {
      console.error("Error saving colors:", error);
      toast.error("Failed to save colors");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus })
        .eq("id", ticketId);

      if (error) throw error;

      setTickets((prev) =>
        prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket)),
      );
      toast.success(`Ticket status updated`);
    } catch (error) {
      console.error("Error updating ticket:", error);
      toast.error("Failed to update ticket status");
    }
  };

  const handleTicketResponseSent = (ticketId: string, responseText: string) => {
    setTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              status: "responded",
              admin_response: responseText,
              responded_at: new Date().toISOString(),
            }
          : ticket,
      ),
    );
  };

  const handleSendTicketResponse = async () => {
    if (!selectedTicket || !ticketResponse.trim()) return;
    setIsSendingTicketResponse(true);
    try {
      const { error } = await supabase.functions.invoke("respond-to-ticket", {
        body: { ticket_id: selectedTicket.id, response_text: ticketResponse.trim() },
      });
      if (error) throw error;
      toast.success("Response sent — customer will receive an email shortly.");
      handleTicketResponseSent(selectedTicket.id, ticketResponse.trim());
      setSelectedTicket(null);
      setTicketResponse("");
    } catch (error: any) {
      console.error("Error sending ticket response:", error);
      toast.error(error?.message || "Failed to send response");
    } finally {
      setIsSendingTicketResponse(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "open":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Open
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="flex items-center gap-1 bg-green-600 text-white">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="flex items-center gap-1 bg-amber-500">
            <Clock className="w-3 h-3" /> In Progress
          </Badge>
        );
      case "responded":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Mail className="w-3 h-3" /> Responded
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Ref for auto-scrolling to customization panel
  const customizationPanelRef = useRef<HTMLDivElement>(null);

  const togglePanel = (panel: ActivePanel) => {
    const isOpening = activePanel !== panel;
    setActivePanel((prev) => (prev === panel ? null : panel));

    // Auto-scroll to customization section when opening a panel
    if (isOpening && panel !== null) {
      setTimeout(() => {
        customizationPanelRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  };

  const startEditingTab = (tab: "education" | "home" | "support") => {
    setEditingTab(tab);
    setEditingTabValue(tabNames[tab]);
  };

  const saveTabName = async () => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!editingTab || !planAgencyId || !editingTabValue.trim()) {
      if (!planAgencyId) toast.error("Please create this plan's URL first");
      return;
    }

    setIsSaving(true);
    try {
      // Ensure row exists first
      await ensureHomeSettingsRow(planAgencyId);

      const updateData: Record<string, string> = {};
      updateData[`tab_name_${editingTab}`] = editingTabValue.trim();

      // Then update just the specific field
      const { error } = await supabase
        .from("v2_home_settings")
        .update(updateData as any)
        .eq("agency_id", planAgencyId);

      if (error) throw error;

      setTabNames((prev) => ({
        ...prev,
        [editingTab]: editingTabValue.trim(),
      }));
      setEditingTab(null);
      setEditingTabValue("");
      toast.success("Tab name saved!");
    } catch (error) {
      console.error("Error saving tab name:", error);
      toast.error("Failed to save tab name");
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditingTab = () => {
    setEditingTab(null);
    setEditingTabValue("");
  };

  const startEditingChecklistTitle = () => {
    setEditingChecklistTitle(true);
    setEditingChecklistTitleValue(checklistTitle);
  };

  const saveChecklistTitle = async () => {
    const planAgencyId = getSelectedPlanAgencyId();
    if (!planAgencyId || !editingChecklistTitleValue.trim()) {
      if (!planAgencyId) toast.error("Please create this plan's URL first");
      return;
    }

    setIsSaving(true);
    try {
      // Ensure row exists first
      await ensureHomeSettingsRow(planAgencyId);

      // Then update just the specific field
      const { error } = await supabase
        .from("v2_home_settings")
        .update({ checklist_title: editingChecklistTitleValue.trim() } as any)
        .eq("agency_id", planAgencyId);

      if (error) throw error;

      setChecklistTitle(editingChecklistTitleValue.trim());
      setEditingChecklistTitle(false);
      setEditingChecklistTitleValue("");
      toast.success("Checklist title saved!");
    } catch (error) {
      console.error("Error saving checklist title:", error);
      toast.error("Failed to save checklist title");
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEditingChecklistTitle = () => {
    setEditingChecklistTitle(false);
    setEditingChecklistTitleValue("");
  };

  if (loadError) {
    return <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />;
  }

  if (isLoading) {
    return <LoadNotice loading label="Loading Client Hub…" />;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Post-signup: their live hub URL, before we ask them to install anything */}
        <HubLiveModal open={showHubLive} onOpenChange={setShowHubLive} hubUrl={hubLiveUrl} />

        {/* Second step: the interactive walkthrough offer */}

        {/* Persistent install task (mobile gets the emailed guide) */}
        <InstallTaskBanner />
        {!planConnection.connected && <MultiPlanConnectionNotice />}

        {/* V2 / V3 Toggle */}
        {showV2Ui && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">UI:</span>
            <div className="inline-flex rounded-md border bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setUiVersion("v2")}
                className={`px-3 py-1 text-xs font-medium rounded ${uiVersion === "v2" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                V2
              </button>
              <button
                type="button"
                onClick={() => setUiVersion("v3")}
                className={`px-3 py-1 text-xs font-medium rounded ${uiVersion === "v3" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              >
                V3{" "}
                <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">
                  Beta
                </Badge>
              </button>
            </div>
          </div>
        )}

        {uiVersion === "v3" && (
          <>
            <V3EducationView
              selectedPlan={selectedPlan}
              setSelectedPlan={selectPlan}
              agencyVersions={agencyVersions}
              isAdvancedPlan={isAdvancedPlan}
              selectedPlanAgencyId={getSelectedPlanAgencyId()}
              primaryAgencyId={agencyId}
              selectedPlanUrl={getSelectedPlanUrl()}
              hasSelectedPlanUrl={hasSelectedPlanUrl()}
              copyToClipboard={copyToClipboard}
              colors={colors}
              tabName={tabNames.education}
              homeTabName={tabNames.home}
              supportTabName={tabNames.support}
              landingPage={
                resolvedLandingPage === "education" || resolvedLandingPage === "support"
                  ? resolvedLandingPage
                  : "home"
              }
              landingOptions={landingChoices.map((id) => ({
                id,
                label: id === "education" ? tabNames.education : id === "home" ? tabNames.home : tabNames.support,
              }))}
              onLandingPageChange={saveDefaultLandingPage}
              landingDeepLink={(() => {
                const link = editorHubDeepLink(hubSearchParams);
                if (!link) return null;
                const page = resolveHubLandingPage({ saved: null, supportEnabled: true, deepLink: link });
                return page === "docs" ? null : page;
              })()}
              landingDisabled={!hasSelectedPlanUrl() || isSaving}
              onEditTabName={(tab) => startEditingTab(tab)}
              onSaveTabName={async (tab, value) => {
                const planAgencyId = getSelectedPlanAgencyId();
                if (!planAgencyId) {
                  toast.error("Please create this plan's URL first");
                  return;
                }
                setIsSaving(true);
                try {
                  await ensureHomeSettingsRow(planAgencyId);
                  const updateData: Record<string, string> = {};
                  updateData[`tab_name_${tab}`] = value;
                  const { error } = await supabase
                    .from("v2_home_settings")
                    .update(updateData as any)
                    .eq("agency_id", planAgencyId);
                  if (error) throw error;
                  setTabNames((prev) => ({ ...prev, [tab]: value }));
                  toast.success("Tab name saved!");
                } catch (e) {
                  console.error(e);
                  toast.error("Failed to save tab name");
                } finally {
                  setIsSaving(false);
                }
              }}
              onOpenCustomVideos={() => setActivePanel("custom-videos")}
              onOpenInstallationGuide={() => setActivePanel("installation-guide")}
              onOpenEditColors={(field) => {
                setEditColorsFocusField(field ?? "primary");
                setEditColorsInitial({ ...colors });
                setActivePanel("edit-colors");
              }}
              livePreviewTab={v3LivePreviewTab}
              setLivePreviewTab={setV3LivePreviewTab}
              onSyncPlans={() => { if (isAdvancedPlan && planConnection.connected) setShowSyncPlansDialog(true); }}
              onLearnMore={() => togglePanel("learn-more")}
              onCreatePlanUrl={(version) => createAgencyVersion(version)}
              onCustomizeUrl={openCustomizeUrl}
              isSaving={isSaving}
            />

            {v3LivePreviewTab === "home" && (
              <V3HomeView
                selectedPlanAgencyId={getSelectedPlanAgencyId()}
                homeSettings={homeSettings}
                setHomeSettings={setHomeSettings}
                saveHomeSettings={saveHomeSettings}
                isSaving={isSaving}
                onOpenLoginDialog={() => setV3LoginDialogOpen(true)}
                onSwitchToEducation={() => setV3LivePreviewTab("education")}
                dailyChecklistEnabled={dailyChecklistEnabled}
                toggleDailyChecklist={toggleDailyChecklist}
                dailyChecklistTitle={checklistTitle}
                setDailyChecklistTitle={setChecklistTitle}
                saveDailyChecklistTitle={async (v: string) => {
                  const planAgencyId = getSelectedPlanAgencyId();
                  if (!planAgencyId || !v.trim()) return;
                  try {
                    await ensureHomeSettingsRow(planAgencyId);
                    const { error } = await supabase
                      .from("v2_home_settings")
                      .update({ checklist_title: v.trim() } as any)
                      .eq("agency_id", planAgencyId);
                    if (error) throw error;
                  } catch (e) {
                    console.error(e);
                    toast.error("Failed to save checklist title");
                  }
                }}
                dailyChecklistItems={checklistItems}
                setDailyChecklistItems={setChecklistItems}
                saveDailyChecklistItems={saveChecklistItems}
              />
            )}

            {v3LivePreviewTab === "support" && (
              <V3SupportView
                supportHeadline={supportHeadline}
                setSupportHeadline={setSupportHeadline}
                supportSubheadline={supportSubheadline}
                setSupportSubheadline={setSupportSubheadline}
                supportButton1Text={supportButton1Text}
                setSupportButton1Text={setSupportButton1Text}
                supportButton1Url={supportButton1Url}
                setSupportButton1Url={setSupportButton1Url}
                supportButton1Color={supportButton1Color}
                setSupportButton1Color={setSupportButton1Color}
                supportButton1OpenAsPopup={supportButton1OpenAsPopup}
                setSupportButton1OpenAsPopup={setSupportButton1OpenAsPopup}
                supportButton2Text={supportButton2Text}
                setSupportButton2Text={setSupportButton2Text}
                supportButton2Url={supportButton2Url}
                setSupportButton2Url={setSupportButton2Url}
                supportButton2Color={supportButton2Color}
                setSupportButton2Color={setSupportButton2Color}
                supportButton2OpenAsPopup={supportButton2OpenAsPopup}
                setSupportButton2OpenAsPopup={setSupportButton2OpenAsPopup}
                supportButton3Text={supportButton3Text}
                setSupportButton3Text={setSupportButton3Text}
                supportButton3Url={supportButton3Url}
                setSupportButton3Url={setSupportButton3Url}
                supportButton3Color={supportButton3Color}
                setSupportButton3Color={setSupportButton3Color}
                supportButton3OpenAsPopup={supportButton3OpenAsPopup}
                setSupportButton3OpenAsPopup={setSupportButton3OpenAsPopup}
                aiChatName={aiChatName}
                setAiChatName={setAiChatName}
                aiChatIconUrl={aiChatIconUrl}
                setAiChatIconUrl={setAiChatIconUrl}
                promptPersonality={promptPersonality}
                setPromptPersonality={setPromptPersonality}
                promptGoals={promptGoals}
                setPromptGoals={setPromptGoals}
                promptAdditionalInstructions={promptAdditionalInstructions}
                setPromptAdditionalInstructions={setPromptAdditionalInstructions}
                promptTrainingDoc={promptTrainingDoc}
                setPromptTrainingDoc={setPromptTrainingDoc}
                saveSupportSettings={saveSupportSettings}
                isSaving={isSaving}
                ticketingEnabled={ticketingEnabled}
                toggleTicketing={toggleTicketing}
                tickets={tickets}
                handleStatusChange={handleStatusChange}
                onTicketResponseSent={handleTicketResponseSent}
                webhookUrl={webhookUrl}
                tempWebhookUrl={tempWebhookUrl}
                setTempWebhookUrl={setTempWebhookUrl}
                saveWebhookUrl={saveWebhookUrl}
                isSavingWebhook={isSavingWebhook}
                hasBrandedSupport={hasBrandedSupport}
                agencyVersions={agencyVersions}
                selectedPlanAgencyId={getSelectedPlanAgencyId()}
                tier={
                  selectedPlan === "plan1"
                    ? "basic"
                    : selectedPlan === "plan2"
                      ? "advanced"
                      : "elite"
                }
                aiChatEnabled={generalAiSupportEnabled}
                toggleAiChat={toggleChatWidget}
                testWebhook={testWebhook}
                isTestingWebhook={isTestingWebhook}
                isAdvancedPlan={isAdvancedPlan}
                hasAiSupportAccess={!isStarterPlan}
                chatModeSettings={<ChatModeSettings />}
              />
            )}

            {v3LivePreviewTab === "popup" && (
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap border-b shadow-sm pb-3 -mx-6 px-6">
                    <PreviewHeaderHost />
                    <Badge variant="outline" className="text-[10px]">
                      New
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    A floating chat-style launcher you can embed in any GHL sub-account. Opens your
                    branded Client Hub in a popup window.
                  </p>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Bottom right chat popup</span>
                    </div>
                    <Switch checked={popupEnabled} onCheckedChange={togglePopup} />
                  </div>

                  {popupEnabled && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-green-700">
                        The popup launcher will now appear automatically inside any sub-account that
                        has your installation code.
                      </p>
                    </div>
                  )}
                  <TopNavWidgetCard email={email} colors={colors} />
                  <MobileBrandingCard email={email} colors={colors} />
                </CardContent>
              </Card>
            )}

            {v3LivePreviewTab === "theme" && (
              <ThemePickerCard agencyId={getSelectedPlanAgencyId()} />
            )}

            {v3LivePreviewTab === "assign" && (
              <AssignSubAccountPanel agencyId={getSelectedPlanAgencyId()} />
            )}

            {(v3LivePreviewTab === "home" || v3LivePreviewTab === "education" || v3LivePreviewTab === "support") && (
              <HubSectionToggle
                page={v3LivePreviewTab}
                visibility={sectionVisibility}
                names={tabNames}
                disabled={!hasSelectedPlanUrl() || isSaving || !planSettingsReady}
                onVisibilityChange={saveSectionVisibility}
              />
            )}

            {/* V3 dialogs reuse the same panels */}
            <Dialog
              open={activePanel === "custom-videos"}
              onOpenChange={(o) => !o && setActivePanel(null)}
            >
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Custom Videos</DialogTitle>
                  <DialogDescription>Add and manage custom training videos.</DialogDescription>
                </DialogHeader>
                <CustomVideosPanel
                  agencyVersions={agencyVersions}
                  selectedPlanAgencyId={getSelectedPlanAgencyId()}
                />
              </DialogContent>
            </Dialog>

            <Dialog
              open={activePanel === "installation-guide"}
              onOpenChange={(o) => !o && setActivePanel(null)}
            >
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Installation Guide</DialogTitle>
                </DialogHeader>
                <InstallationGuidePanel />
              </DialogContent>
            </Dialog>

            <Dialog
              open={activePanel === "edit-colors"}
              onOpenChange={(o) => {
                if (!o) {
                  setActivePanel(null);
                  setEditColorsInitial(null);
                }
              }}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Brand Colors</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <ColorPicker
                    label="Primary"
                    color={colors.primary}
                    autoFocus={editColorsFocusField === "primary"}
                    onChange={(c) => setColors((prev) => ({ ...prev, primary: c }))}
                  />
                  <ColorPicker
                    label="Secondary"
                    color={colors.secondary}
                    autoFocus={editColorsFocusField === "secondary"}
                    onChange={(c) => setColors((prev) => ({ ...prev, secondary: c }))}
                  />
                  <ColorPicker
                    label="Tertiary"
                    color={colors.tertiary}
                    autoFocus={editColorsFocusField === "tertiary"}
                    onChange={(c) => setColors((prev) => ({ ...prev, tertiary: c }))}
                  />
                  <Button variant="accent"
                    className="w-full"
                    disabled={
                      !editColorsInitial ||
                      (editColorsInitial.primary === colors.primary &&
                        editColorsInitial.secondary === colors.secondary &&
                        editColorsInitial.tertiary === colors.tertiary)
                    }
                    onClick={async () => {
                      if (email) {
                        await supabase
                          .from("saas_suite_users")
                          .update({
                            primary_color: colors.primary,
                            secondary_color: colors.secondary,
                            tertiary_color: colors.tertiary,
                          })
                          .ilike("email", email);
                        toast.success("Brand colors updated");
                      }
                      setActivePanel(null);
                      setEditColorsInitial(null);
                    }}
                  >
                    Save
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* V3 Customize Login Dialog */}
            <Dialog open={v3LoginDialogOpen} onOpenChange={setV3LoginDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <LogIn className="w-5 h-5 text-primary" />
                    Customize Login
                  </DialogTitle>
                  <DialogDescription>
                    Configure how clients sign in to your hub. Settings apply across all plans.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <HubDefaultPageSelect
                    visibility={sectionVisibility}
                    names={tabNames}
                    landingPage={resolvedLandingPage}
                    disabled={!hasSelectedPlanUrl() || isSaving || !planSettingsReady}
                    onLandingPageChange={saveDefaultLandingPage}
                  />
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Login settings apply to <strong>all plans</strong> and are shared across your
                      entire account.
                    </p>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <LogIn className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Enable Login</span>
                      {(isStarterPlan || isBasicPlan) && (
                        <span className="text-xs text-muted-foreground">
                          (Required on your plan)
                        </span>
                      )}
                    </div>
                    <Switch
                      checked={isStarterPlan || isBasicPlan ? true : loginEnabled}
                      onCheckedChange={isStarterPlan || isBasicPlan ? undefined : setLoginEnabled}
                      disabled={isStarterPlan || isBasicPlan}
                    />
                  </div>
                  {loginEnabled && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-sm">Login Method</Label>
                        <div className="flex gap-2">
                          <Button
                            variant={loginWith === "EMAIL" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setLoginWith("EMAIL")}
                          >
                            <Mail className="w-4 h-4 mr-2" /> Email
                          </Button>
                          <Button
                            variant={loginWith === "NAME" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setLoginWith("NAME")}
                          >
                            <User className="w-4 h-4 mr-2" /> Name
                          </Button>
                          <Button
                            variant={loginWith === "BOTH" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setLoginWith("BOTH")}
                          >
                            <Users className="w-4 h-4 mr-2" /> Both
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Welcome Headline</Label>
                        <Input
                          value={loginWelcomeHeadline}
                          onChange={(e) => setLoginWelcomeHeadline(e.target.value)}
                          placeholder="Welcome to Your Client Hub"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Welcome Subheadline</Label>
                        <Textarea
                          value={loginWelcomeSubheadline}
                          onChange={(e) => setLoginWelcomeSubheadline(e.target.value)}
                          placeholder="Enter your details to access your dashboard"
                          className="text-sm resize-none"
                          rows={2}
                        />
                      </div>
                    </>
                  )}
                  <Button
                    onClick={async () => {
                      await saveLoginSettings();
                      setV3LoginDialogOpen(false);
                    }}
                    disabled={isSaving}
                    className="w-full"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Login Settings"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}

        {uiVersion === "v2" && (
          <>
            {/* Header with Plan URL Selector */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-6 h-6 text-primary" />
                  <PageHeader
                    title={newUi ? "Hub Pages" : "Edit Pages"}
                    subtitle="Edit what your clients see inside HighLevel. Each plan has its own settings."
                  />
                  <Badge
                    variant="secondary"
                    className="text-purple-600 bg-purple-100 hidden sm:inline-flex"
                  >
                    Beta
                  </Badge>
                </div>
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { if (isAdvancedPlan && planConnection.connected) setShowSyncPlansDialog(true); }}
                    disabled={!isAdvancedPlan || !planConnection.connected}
                    className="text-xs sm:text-sm"
                  >
                    <RefreshCw className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Sync Plans</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => togglePanel("learn-more")}
                    className="text-xs sm:text-sm"
                  >
                    <Play className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Learn more</span>
                  </Button>
                </div>
              </div>

              {/* Plan URL Dropdown */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link className="w-4 h-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Client Hub URL:</Label>
                </div>
                <Select
                  value={selectedPlan}
                  onValueChange={(v) => selectPlan(v as SelectedPlan)}
                >
                  <SelectTrigger
                    className="w-full sm:w-[140px] bg-background"
                    data-tip-target="client-hub-plan-selector"
                  >
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plan1">Plan 1</SelectItem>
                    <SelectItem value="plan2" disabled={!isAdvancedPlan || !planConnection.connected}>
                      Plan 2 {!isAdvancedPlan ? "(Upgrade to Advanced)" : ""}
                    </SelectItem>
                    <SelectItem value="plan3" disabled={!isAdvancedPlan || !planConnection.connected}>
                      Plan 3 {!isAdvancedPlan ? "(Upgrade to Advanced)" : ""}
                    </SelectItem>
                  </SelectContent>
                </Select>

                {hasSelectedPlanUrl() ? (
                  <div
                    className="flex items-center gap-2 flex-1 min-w-0"
                    data-tip-target="client-hub-plan-url"
                  >
                    <Input
                      value={getSelectedPlanUrl()}
                      readOnly
                      className="min-w-0 flex-1 bg-background font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(getSelectedPlanUrl())}
                      className="flex-shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground flex-1">Setting up your URL…</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("tipbot-select-tool", { detail: { tool: "settings" } }),
                    )
                  }
                  className="flex-shrink-0"
                >
                  Agency name
                </Button>
              </div>

              {/* Multi-plan Info Box */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  <strong>Using multiple plans?</strong> Create multiple custom menu links, and then
                  attach them to your SaaS plans in the SaaS configurator.
                </p>
              </div>
            </div>

            {/* Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_0.7fr] gap-6">
              {/* EDUCATION Column */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-blue-500" />
                    {editingTab === "education" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingTabValue}
                          onChange={(e) => setEditingTabValue(e.target.value)}
                          className="h-7 text-sm w-24"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTabName();
                            if (e.key === "Escape") cancelEditingTab();
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={saveTabName}
                          disabled={isSaving}
                          aria-label="Confirm"
                        >
                          <Check className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={cancelEditingTab}
                          aria-label="Close"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-base">{tabNames.education}</CardTitle>
                        <Button
                          size="icon"
                          aria-label="Edit"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => startEditingTab("education")}
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("tipbot-select-tool", { detail: { tool: "branding" } }),
                      )
                    }
                  >
                    Brand colors are on Design
                  </Button>

                  {/* Custom Videos */}
                  <Button
                    variant={activePanel === "custom-videos" ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => togglePanel("custom-videos")}
                    data-tip-target="client-hub-custom-videos"
                  >
                    <Video className="w-4 h-4 mr-2" />
                    Manage Custom Videos
                  </Button>

                  {/* Toggle On/Off Videos */}
                  <div className="relative">
                    <Button
                      variant={activePanel === "advanced-mode" ? "default" : "outline"}
                      size="sm"
                      className={`w-full justify-start ${isStarterPlan ? "opacity-50 cursor-not-allowed" : ""}`}
                      onClick={() => !isStarterPlan && togglePanel("advanced-mode")}
                      data-tip-target="client-hub-advanced-mode"
                      disabled={isStarterPlan}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Toggle On/Off Videos
                      {isStarterPlan && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-xs text-amber-600 border-amber-300"
                        >
                          Upgrade to Basic
                        </Badge>
                      )}
                    </Button>
                  </div>

                  {/* Installation Guide — glows on desktop until the install is confirmed */}
                  <Button
                    variant={activePanel === "installation-guide" ? "default" : "outline"}
                    size="sm"
                    data-install-guide-target="true"
                    data-tip-target="client-hub-install-guide"
                    className={`w-full justify-start ${!installConfirmed && getDeviceType() === "desktop" ? "animate-install-glow border-amber-400 text-amber-700 dark:text-amber-400" : ""}`}
                    onClick={() => togglePanel("installation-guide")}
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    Installation Guide
                    {!installConfirmed && getDeviceType() === "desktop" && (
                      <Badge
                        variant="outline"
                        className="ml-auto text-xs border-amber-400 text-amber-700"
                      >
                        Still needed
                      </Badge>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* HOME Column */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-5 h-5 text-green-500" />
                    {editingTab === "home" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingTabValue}
                          onChange={(e) => setEditingTabValue(e.target.value)}
                          className="h-7 text-sm w-24"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTabName();
                            if (e.key === "Escape") cancelEditingTab();
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={saveTabName}
                          disabled={isSaving}
                          aria-label="Confirm"
                        >
                          <Check className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={cancelEditingTab}
                          aria-label="Close"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-base">{tabNames.home}</CardTitle>
                        <Button
                          size="icon"
                          aria-label="Edit"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => startEditingTab("home")}
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                    <Badge variant="outline" className="ml-auto text-xs">
                      {selectedPlan === "plan1"
                        ? "Plan 1"
                        : selectedPlan === "plan2"
                          ? "Plan 2"
                          : "Plan 3"}
                    </Badge>
                  </div>
                  {!hasSelectedPlanUrl() && (
                    <p className="text-xs text-amber-600 mt-1">
                      Create this plan's URL first to customize settings
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    The Home tab is where all users land upon logging in. By customizing below, you
                    can add videos, onboarding checklists, helpful links, and more.
                  </p>
                  {/* Customize Home Page Button */}
                  <Button
                    variant={activePanel === "home-customize" ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => togglePanel("home-customize")}
                    data-tip-target="client-hub-customize-home"
                  >
                    <Home className="w-4 h-4 mr-2" />
                    Customize Home Page
                  </Button>
                </CardContent>
              </Card>

              {/* SUPPORT Column */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Headphones className="w-5 h-5 text-purple-500" />
                    {editingTab === "support" ? (
                      <div className="flex items-center gap-1">
                        <Input
                          value={editingTabValue}
                          onChange={(e) => setEditingTabValue(e.target.value)}
                          className="h-7 text-sm w-24"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveTabName();
                            if (e.key === "Escape") cancelEditingTab();
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={saveTabName}
                          disabled={isSaving}
                          aria-label="Confirm"
                        >
                          <Check className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={cancelEditingTab}
                          aria-label="Close"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <CardTitle className="text-base">{tabNames.support}</CardTitle>
                        <Button
                          size="icon"
                          aria-label="Edit"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => startEditingTab("support")}
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Support Ticketing Toggle */}
                  <div
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-tip-target="client-hub-support-ticketing"
                  >
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Support Ticketing</span>
                    </div>
                    <Switch checked={ticketingEnabled} onCheckedChange={toggleTicketing} />
                  </div>

                  {/* Inbound Webhook URL */}
                  {ticketingEnabled && (
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <Webhook className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Inbound Webhook URL</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>
                              Enter a webhook URL to receive notifications when tickets are created
                              or status changes. Useful for automations in GoHighLevel or Zapier.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="url"
                          placeholder="https://hooks.example.com/webhook..."
                          value={tempWebhookUrl}
                          onChange={(e) => setTempWebhookUrl(e.target.value)}
                          className="flex-1 text-sm"
                        />
                        <Button
                          onClick={saveWebhookUrl}
                          disabled={isSavingWebhook || tempWebhookUrl === webhookUrl}
                          size="sm"
                        >
                          {isSavingWebhook ? "Saving..." : "Save"}
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={testWebhook}
                              disabled={isTestingWebhook || !webhookUrl}
                              size="sm"
                              variant="outline"
                            >
                              <Play className="w-4 h-4 mr-1" />
                              {isTestingWebhook ? "Testing..." : "Test"}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Send a test payload to verify your webhook</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {webhookUrl && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          Webhook configured - notifications will be sent for ticket events
                        </p>
                      )}
                    </div>
                  )}

                  <div data-tip-target="client-hub-ai-support" className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <Label className="font-medium">AI Chat Support</Label>
                        <p className="text-xs text-muted-foreground">
                          Turn the AI chat widget on or off for your clients.
                        </p>
                      </div>
                      <Switch
                        checked={generalAiSupportEnabled}
                        onCheckedChange={toggleChatWidget}
                      />
                    </div>

                    <ChatModeSettings />
                  </div>

                  {/* Customize Support Tab Button */}
                  <Button
                    variant={activePanel === "support-customize" ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => togglePanel("support-customize")}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Customize Support Tab
                  </Button>

                  {/* Upgrade to Branded AI Support */}
                  {/* Custom AI Support - greyed out for Starter/Basic */}
                  {!hasBrandedSupport && (
                    <div className="relative">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`w-full bg-gradient-to-r from-primary to-purple-500 text-white border-0 hover:opacity-90 ${!isAdvancedPlan ? "opacity-50 cursor-not-allowed" : ""}`}
                        onClick={() => isAdvancedPlan && setShowBrandedUpgradePopup(true)}
                        data-tip-target="client-hub-branded-ai"
                        disabled={!isAdvancedPlan}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {!isAdvancedPlan ? "Upgrade to Advanced" : "Upgrade to Branded AI Support"}
                      </Button>
                    </div>
                  )}
                  {hasBrandedSupport && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-xs text-green-600 font-medium">
                        Branded AI Support Active
                      </span>
                    </div>
                  )}

                  {/* AI Chat Conversations Button */}
                  <Button
                    variant={activePanel === "chat-intervention" ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => togglePanel("chat-intervention")}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    AI Chat Conversations
                    <Badge variant="secondary" className="ml-auto text-xs">
                      Native AI
                    </Badge>
                  </Button>

                  {/* View Tickets Button */}
                  <Button
                    variant={activePanel === "view-tickets" ? "default" : "outline"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => togglePanel("view-tickets")}
                  >
                    <Ticket className="w-4 h-4 mr-2" />
                    View Tickets ({tickets.length})
                  </Button>

                  {/* Quick ticket count */}
                  <div className="text-xs text-muted-foreground text-center">
                    {tickets.filter((t) => t.status === "open").length} open tickets
                  </div>
                </CardContent>
              </Card>

              {/* POPUP Column */}
              <Card className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-pink-500" />
                    <CardTitle className="text-base">Popup</CardTitle>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      New
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    A floating chat-style launcher you can embed in any GHL sub-account. Opens your
                    branded Client Hub in a popup window.
                  </p>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Bottom right chat popup</span>
                    </div>
                    <Switch checked={popupEnabled} onCheckedChange={togglePopup} />
                  </div>

                  {popupEnabled && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-green-700">
                        The popup launcher will now appear automatically inside any sub-account that
                        has your installation code.
                      </p>
                    </div>
                  )}
                  <TopNavWidgetCard email={email} colors={colors} />
                  <MobileBrandingCard email={email} colors={colors} />
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Active Panel Area (Deadspace) */}
        <div ref={customizationPanelRef}>
          {uiVersion === "v2" && activePanel && (
            <Card className="border-border animate-in fade-in-50 duration-200">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  {activePanel === "custom-videos" && <Video className="w-5 h-5 text-blue-500" />}
                  {activePanel === "advanced-mode" && (
                    <Settings
                      className="w-5 h-5 text-amber-500"
                      data-tip-target="client-hub-toggle-videos-title"
                    />
                  )}
                  {activePanel === "installation-guide" && (
                    <BookOpen className="w-5 h-5 text-indigo-500" />
                  )}
                  {activePanel === "home-customize" && <Home className="w-5 h-5 text-green-500" />}
                  {activePanel === "view-tickets" && <Ticket className="w-5 h-5 text-purple-500" />}
                  {activePanel === "edit-colors" && <Palette className="w-5 h-5 text-pink-500" />}
                  {activePanel === "ai-customize" && <Bot className="w-5 h-5 text-cyan-500" />}
                  {activePanel === "support-customize" && (
                    <Headphones className="w-5 h-5 text-purple-500" />
                  )}
                  {activePanel === "chat-intervention" && (
                    <MessageSquare className="w-5 h-5 text-green-500" />
                  )}
                  <CardTitle className="text-base flex items-center gap-2">
                    {activePanel === "custom-videos" && "Manage Custom Videos"}
                    {activePanel === "advanced-mode" &&
                      `Video Selection for ${selectedPlan === "plan1" ? "Plan 1" : selectedPlan === "plan2" ? "Plan 2" : "Plan 3"}`}
                    {activePanel === "installation-guide" && "Installation Guide"}
                    {activePanel === "home-customize" && "Customize Home Page"}
                    {activePanel === "view-tickets" && "Support Tickets"}
                    {activePanel === "edit-colors" && "Edit Brand Colors"}
                    {activePanel === "ai-customize" && (
                      <>
                        Customize AI Support Agent
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-500/10 text-amber-600 border-amber-300"
                        >
                          Beta
                        </Badge>
                      </>
                    )}
                    {activePanel === "support-customize" && (
                      <>
                        Customize Support Tab
                        <Badge variant="outline" className="text-xs">
                          {selectedPlan === "plan1"
                            ? "Plan 1"
                            : selectedPlan === "plan2"
                              ? "Plan 2"
                              : "Plan 3"}
                        </Badge>
                      </>
                    )}
                    {activePanel === "chat-intervention" && (
                      <>
                        AI Chat Conversations
                        <Badge
                          variant="outline"
                          className="text-xs bg-green-500/10 text-green-600 border-green-300"
                        >
                          Native AI
                        </Badge>
                      </>
                    )}
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {/* Custom Videos Panel */}
                {activePanel === "custom-videos" && (
                  <CustomVideosPanel
                    selectedPlanAgencyId={getSelectedPlanAgencyId()}
                    agencyVersions={agencyVersions}
                  />
                )}

                {/* Advanced Mode Panel */}
                {activePanel === "advanced-mode" && (
                  <AdvancedModePanel selectedPlan={selectedPlan} agencyVersions={agencyVersions} />
                )}

                {/* Installation Guide Panel */}
                {activePanel === "installation-guide" && <InstallationGuidePanel />}

                {/* Edit Colors Panel */}
                {activePanel === "edit-colors" && (
                  <div className="space-y-6">
                    <p className="text-sm text-muted-foreground">
                      Customize your brand colors for the client hub. These colors will be used
                      throughout your client's onboarding experience.
                    </p>
                    <div className="space-y-4">
                      <ColorPicker
                        label="Primary Color"
                        color={colors.primary}
                        onChange={(color) => setColors((prev) => ({ ...prev, primary: color }))}
                      />
                      <ColorPicker
                        label="Secondary Color"
                        color={colors.secondary}
                        onChange={(color) => setColors((prev) => ({ ...prev, secondary: color }))}
                      />
                      <ColorPicker
                        label="Tertiary Color"
                        color={colors.tertiary}
                        onChange={(color) => setColors((prev) => ({ ...prev, tertiary: color }))}
                      />
                    </div>
                    <Button className="w-full" onClick={saveBrandColors} disabled={isSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? "Saving..." : "Save Brand Colors"}
                    </Button>
                  </div>
                )}

                {/* AI Customize Panel */}
                {activePanel === "ai-customize" && (
                  <div className="space-y-6">
                    {/* Info Banner */}
                    <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                      <div className="flex items-start gap-3">
                        <Bot className="w-5 h-5 text-cyan-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-cyan-700">
                            Configure Your AI Support Agent
                          </p>
                          <p className="text-xs text-cyan-600 mt-1">
                            Customize how your AI chat support bot behaves for your clients. Choose
                            between GHL's native chat or configure a custom AI assistant with your
                            own personality and training.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Native AI Configuration Fields */}
                    {aiChatType === "NATIVE" && (
                      <div className="space-y-4 pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setPromptPersonality(DEFAULT_AI_PROMPT_PERSONALITY);
                            setPromptGoals(DEFAULT_AI_PROMPT_GOALS);
                            setPromptAdditionalInstructions(DEFAULT_AI_PROMPT_INSTRUCTIONS);
                            toast.success("Default prompts imported!");
                          }}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Import Default Prompts
                        </Button>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Bot Personality</Label>
                          <Textarea
                            value={promptPersonality}
                            onChange={(e) => setPromptPersonality(e.target.value)}
                            placeholder="e.g., Friendly, professional, and helpful. Always responds with empathy and clarity..."
                            className="text-sm resize-none"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground">
                            Describe how your AI assistant should communicate with customers
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Support Goals</Label>
                          <Textarea
                            value={promptGoals}
                            onChange={(e) => setPromptGoals(e.target.value)}
                            placeholder="e.g., Help users navigate the platform, answer billing questions, and escalate complex issues..."
                            className="text-sm resize-none"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground">
                            Define what your support bot should help customers accomplish
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Additional Instructions</Label>
                          <Textarea
                            value={promptAdditionalInstructions}
                            onChange={(e) => setPromptAdditionalInstructions(e.target.value)}
                            placeholder="e.g., Never share internal pricing, always verify customer identity before making changes..."
                            className="text-sm resize-none"
                            rows={3}
                          />
                          <p className="text-xs text-muted-foreground">
                            Add any specific rules or guidelines for your AI assistant
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Training Document URL</Label>
                          <Input
                            value={promptTrainingDoc}
                            onChange={(e) => setPromptTrainingDoc(e.target.value)}
                            placeholder="https://docs.example.com/support-guide"
                            className="text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Link to a document with additional training material for your AI
                          </p>
                        </div>

                        {/* Onboarding Doc URL */}
                        {getSelectedPlanAgencyId() && (
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Onboarding Doc URL</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={`${window.location.origin}/${getSelectedPlanAgencyId()}/training-doc/${selectedPlan === "plan1" ? "basic" : selectedPlan === "plan2" ? "advanced" : "elite"}`}
                                readOnly
                                className="text-sm bg-muted/50"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                aria-label="Copy"
                                onClick={() => {
                                  const url = `${window.location.origin}/${getSelectedPlanAgencyId()}/training-doc/${selectedPlan === "plan1" ? "basic" : selectedPlan === "plan2" ? "advanced" : "elite"}`;
                                  navigator.clipboard.writeText(url);
                                  toast.success("Onboarding doc URL copied!");
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Public page with video transcriptions based on your enabled videos for
                              this plan
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Save Button */}
                    <Button className="w-full" onClick={saveAiChatSettings} disabled={isSaving}>
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? "Saving..." : "Save AI Settings"}
                    </Button>
                  </div>
                )}

                {/* Support Customize Panel */}
                {activePanel === "support-customize" && (
                  <div className="space-y-6">
                    <Tabs
                      value={selectedSupportTab}
                      onValueChange={setSelectedSupportTab}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="text" className="flex items-center gap-1 text-xs px-2">
                          <MessageSquare className="w-3 h-3" />
                          Text
                        </TabsTrigger>
                        <TabsTrigger value="links" className="flex items-center gap-1 text-xs px-2">
                          <Link className="w-3 h-3" />
                          Links
                        </TabsTrigger>
                        <TabsTrigger
                          value="ai-chat"
                          className="flex items-center gap-1 text-xs px-2"
                        >
                          <Bot className="w-3 h-3" />
                          AI Chat
                        </TabsTrigger>
                      </TabsList>

                      {/* Text Tab */}
                      <TabsContent value="text" className="space-y-4 mt-4">
                        <div className="space-y-2">
                          <Label className="text-sm">Headline</Label>
                          <Input
                            value={supportHeadline}
                            onChange={(e) => setSupportHeadline(e.target.value)}
                            placeholder="How can we help?"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Subheadline</Label>
                          <Textarea
                            value={supportSubheadline}
                            onChange={(e) => setSupportSubheadline(e.target.value)}
                            placeholder="Get instant answers or connect with our team"
                            className="text-sm resize-none"
                            rows={2}
                          />
                        </div>
                      </TabsContent>

                      {/* Links Tab */}
                      <TabsContent value="links" className="space-y-4 mt-4">
                        <p className="text-xs text-muted-foreground">
                          Add up to 3 custom buttons to your support page. Leave text empty to hide
                          a button.
                        </p>

                        {/* Button 1 */}
                        <div className="p-3 rounded-lg border space-y-2">
                          <Label className="text-sm font-medium">Button 1</Label>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={supportButton1Text}
                              onChange={(e) => setSupportButton1Text(e.target.value)}
                              placeholder="Button text"
                              className="text-sm"
                            />
                            <Input
                              value={supportButton1Url}
                              onChange={(e) => setSupportButton1Url(e.target.value)}
                              placeholder="https://..."
                              className="text-sm"
                            />
                            <Input
                              type="color"
                              value={supportButton1Color}
                              onChange={(e) => setSupportButton1Color(e.target.value)}
                              className="h-9 w-full cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Button 2 */}
                        <div className="p-3 rounded-lg border space-y-2">
                          <Label className="text-sm font-medium">Button 2</Label>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={supportButton2Text}
                              onChange={(e) => setSupportButton2Text(e.target.value)}
                              placeholder="Button text"
                              className="text-sm"
                            />
                            <Input
                              value={supportButton2Url}
                              onChange={(e) => setSupportButton2Url(e.target.value)}
                              placeholder="https://..."
                              className="text-sm"
                            />
                            <Input
                              type="color"
                              value={supportButton2Color}
                              onChange={(e) => setSupportButton2Color(e.target.value)}
                              className="h-9 w-full cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Button 3 */}
                        <div className="p-3 rounded-lg border space-y-2">
                          <Label className="text-sm font-medium">Button 3</Label>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={supportButton3Text}
                              onChange={(e) => setSupportButton3Text(e.target.value)}
                              placeholder="Button text"
                              className="text-sm"
                            />
                            <Input
                              value={supportButton3Url}
                              onChange={(e) => setSupportButton3Url(e.target.value)}
                              placeholder="https://..."
                              className="text-sm"
                            />
                            <Input
                              type="color"
                              value={supportButton3Color}
                              onChange={(e) => setSupportButton3Color(e.target.value)}
                              className="h-9 w-full cursor-pointer"
                            />
                          </div>
                        </div>
                      </TabsContent>

                      {/* AI Chat Tab */}
                      <TabsContent value="ai-chat" className="space-y-4 mt-4">
                        {/* AI Chat Branding */}
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Chat Bot Name</Label>
                            <Input
                              value={aiChatName}
                              onChange={(e) => setAiChatName(e.target.value)}
                              placeholder="AI Support Assistant"
                              className="text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              Display name shown to users in the chat widget
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Chat Bot Icon URL</Label>
                            <Input
                              value={aiChatIconUrl}
                              onChange={(e) => setAiChatIconUrl(e.target.value)}
                              placeholder="https://example.com/icon.png"
                              className="text-sm"
                            />
                            <p className="text-xs text-muted-foreground">
                              Custom profile icon for your chat bot (leave empty for default
                              sparkles icon)
                            </p>
                          </div>
                        </div>

                        {/* Native AI Configuration Fields */}
                        {aiChatType === "NATIVE" && (
                          <div className="space-y-4 pt-4 border-t border-border">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setPromptPersonality(DEFAULT_AI_PROMPT_PERSONALITY);
                                setPromptGoals(DEFAULT_AI_PROMPT_GOALS);
                                setPromptAdditionalInstructions(DEFAULT_AI_PROMPT_INSTRUCTIONS);
                                toast.success("Default prompts imported!");
                              }}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Import Default Prompts
                            </Button>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Bot Personality</Label>
                              <Textarea
                                value={promptPersonality}
                                onChange={(e) => setPromptPersonality(e.target.value)}
                                placeholder="e.g., Friendly, professional, and helpful. Always responds with empathy and clarity..."
                                className="text-sm resize-none"
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                Describe how your AI assistant should communicate with customers
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Support Goals</Label>
                              <Textarea
                                value={promptGoals}
                                onChange={(e) => setPromptGoals(e.target.value)}
                                placeholder="e.g., Help users navigate the platform, answer billing questions, and escalate complex issues..."
                                className="text-sm resize-none"
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                Define what your support bot should help customers accomplish
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Additional Instructions</Label>
                              <Textarea
                                value={promptAdditionalInstructions}
                                onChange={(e) => setPromptAdditionalInstructions(e.target.value)}
                                placeholder="e.g., Never share internal pricing, always verify customer identity before making changes..."
                                className="text-sm resize-none"
                                rows={3}
                              />
                              <p className="text-xs text-muted-foreground">
                                Add any specific rules or guidelines for your AI assistant
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Training Document URL</Label>
                              <Input
                                value={promptTrainingDoc}
                                onChange={(e) => setPromptTrainingDoc(e.target.value)}
                                placeholder="https://docs.example.com/support-guide"
                                className="text-sm"
                              />
                              <p className="text-xs text-muted-foreground">
                                Link to a document with additional training material for your AI
                              </p>
                            </div>

                            {/* Onboarding Doc URL */}
                            {getSelectedPlanAgencyId() && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Onboarding Doc URL</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={`${window.location.origin}/${getSelectedPlanAgencyId()}/training-doc/${selectedPlan === "plan1" ? "basic" : selectedPlan === "plan2" ? "advanced" : "elite"}`}
                                    readOnly
                                    className="text-sm bg-muted/50"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Copy"
                                    onClick={() => {
                                      const url = `${window.location.origin}/${getSelectedPlanAgencyId()}/training-doc/${selectedPlan === "plan1" ? "basic" : selectedPlan === "plan2" ? "advanced" : "elite"}`;
                                      navigator.clipboard.writeText(url);
                                      toast.success("Onboarding doc URL copied!");
                                    }}
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Public page with video transcriptions based on your enabled videos
                                  for this plan
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                      <Button onClick={saveSupportSettings} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? "Saving..." : "Save Support Settings"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Home Customize Panel */}
                {activePanel === "home-customize" && (
                  <div className="space-y-6">
                    <Tabs
                      value={selectedHomeTab}
                      onValueChange={setSelectedHomeTab}
                      className="w-full"
                      id="home-customize-tabs"
                    >
                      <TabsList className="flex w-full justify-start overflow-x-auto md:grid md:grid-cols-6 [&>button]:shrink-0">
                        <TabsTrigger
                          value="welcome"
                          className="flex items-center gap-1 text-xs px-2"
                          data-tip-target="home-customize-tab-welcome"
                        >
                          <MessageSquare className="w-3 h-3" />
                          Welcome
                        </TabsTrigger>
                        <TabsTrigger
                          value="login"
                          className="flex items-center gap-1 text-xs px-2"
                          data-tip-target="home-customize-tab-login"
                        >
                          <LogIn className="w-3 h-3" />
                          Login
                        </TabsTrigger>
                        <TabsTrigger
                          value="daily"
                          className="flex items-center gap-1 text-xs px-2"
                          data-tip-target="home-customize-tab-daily"
                        >
                          <Calendar className="w-3 h-3" />
                          Daily
                        </TabsTrigger>
                        <TabsTrigger
                          value="checklist"
                          className="flex items-center gap-1 text-xs px-2"
                          data-tip-target="home-customize-tab-checklist"
                        >
                          <CheckSquare className="w-3 h-3" />
                          Onboarding
                        </TabsTrigger>
                        <TabsTrigger
                          value="announcements"
                          className="flex items-center gap-1 text-xs px-2"
                          data-tip-target="home-customize-tab-announcements"
                        >
                          <Megaphone className="w-3 h-3" />
                          Announce
                        </TabsTrigger>
                        <TabsTrigger
                          value="links"
                          className="flex items-center gap-1 text-xs px-2"
                          data-tip-target="home-customize-tab-links"
                        >
                          <Link className="w-3 h-3" />
                          Links
                        </TabsTrigger>
                      </TabsList>

                      {/* Welcome Tab */}
                      <TabsContent value="welcome" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm font-medium">Enable Welcome Section</span>
                          <Switch
                            checked={homeSettings.welcome_enabled}
                            onCheckedChange={(checked) =>
                              setHomeSettings((prev) => ({ ...prev, welcome_enabled: checked }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Headline</Label>
                          <Input
                            value={homeSettings.welcome_headline}
                            onChange={(e) =>
                              setHomeSettings((prev) => ({
                                ...prev,
                                welcome_headline: e.target.value,
                              }))
                            }
                            placeholder="Welcome to your custom software solution"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Subheadline</Label>
                          <Textarea
                            value={homeSettings.welcome_subheadline}
                            onChange={(e) =>
                              setHomeSettings((prev) => ({
                                ...prev,
                                welcome_subheadline: e.target.value,
                              }))
                            }
                            placeholder="Get started with the tools and resources below."
                            className="text-sm resize-none"
                            rows={2}
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm flex items-center gap-2">
                              <Video className="w-4 h-4" />
                              Welcome Video
                            </Label>
                            <Switch
                              checked={homeSettings.welcome_video_enabled}
                              onCheckedChange={(checked) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  welcome_video_enabled: checked,
                                }))
                              }
                            />
                          </div>
                          {homeSettings.welcome_video_enabled && (
                            <div className="space-y-3">
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={
                                    !homeSettings.welcome_video_is_embed ? "default" : "outline"
                                  }
                                  size="sm"
                                  className="flex-1"
                                  onClick={() =>
                                    setHomeSettings((prev) => ({
                                      ...prev,
                                      welcome_video_is_embed: false,
                                    }))
                                  }
                                >
                                  URL
                                </Button>
                                <Button
                                  type="button"
                                  variant={
                                    homeSettings.welcome_video_is_embed ? "default" : "outline"
                                  }
                                  size="sm"
                                  className="flex-1"
                                  onClick={() =>
                                    setHomeSettings((prev) => ({
                                      ...prev,
                                      welcome_video_is_embed: true,
                                    }))
                                  }
                                >
                                  Embed Code
                                </Button>
                              </div>
                              {!homeSettings.welcome_video_is_embed ? (
                                <div className="space-y-2">
                                  <Input
                                    value={homeSettings.welcome_video_url || ""}
                                    onChange={(e) =>
                                      setHomeSettings((prev) => ({
                                        ...prev,
                                        welcome_video_url: e.target.value || null,
                                      }))
                                    }
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    className="text-sm"
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Add a YouTube or Vimeo URL to display a welcome video
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <Textarea
                                    value={homeSettings.welcome_video_url || ""}
                                    onChange={(e) =>
                                      setHomeSettings((prev) => ({
                                        ...prev,
                                        welcome_video_url: e.target.value || null,
                                      }))
                                    }
                                    placeholder='<iframe src="..."></iframe>'
                                    className="text-sm font-mono"
                                    rows={4}
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Paste your embed code (e.g., iframe from YouTube, Vimeo, Loom,
                                    etc.)
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      {/* Login Tab */}
                      <TabsContent value="login" className="space-y-4 mt-4">
                        {/* Notice that login settings apply to all plans */}
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-700">
                            Login settings apply to <strong>all plans</strong> and are shared across
                            your entire account.
                          </p>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <LogIn className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Enable Login</span>
                            {(isStarterPlan || isBasicPlan) && (
                              <span className="text-xs text-muted-foreground">
                                (Required on your plan)
                              </span>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>
                                  {isStarterPlan || isBasicPlan
                                    ? "Login is required on Starter and Basic plans to accurately track user limits."
                                    : 'When disabled, users will be automatically assigned as "Guest User #X" without needing to log in.'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Switch
                            checked={isStarterPlan || isBasicPlan ? true : loginEnabled}
                            onCheckedChange={
                              isStarterPlan || isBasicPlan ? undefined : setLoginEnabled
                            }
                            disabled={isStarterPlan || isBasicPlan}
                          />
                        </div>

                        {loginEnabled && (
                          <>
                            <div className="space-y-2">
                              <Label className="text-sm">Login Method</Label>
                              <div className="flex gap-2">
                                <Button
                                  variant={loginWith === "EMAIL" ? "default" : "outline"}
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => setLoginWith("EMAIL")}
                                >
                                  <Mail className="w-4 h-4 mr-2" />
                                  Email
                                </Button>
                                <Button
                                  variant={loginWith === "NAME" ? "default" : "outline"}
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => setLoginWith("NAME")}
                                >
                                  <User className="w-4 h-4 mr-2" />
                                  Name
                                </Button>
                                <Button
                                  variant={loginWith === "BOTH" ? "default" : "outline"}
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => setLoginWith("BOTH")}
                                >
                                  <Users className="w-4 h-4 mr-2" />
                                  Both
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {loginWith === "EMAIL"
                                  ? "Users will log in with their email address"
                                  : loginWith === "NAME"
                                    ? "Users will log in with their name (no email required)"
                                    : "Users will log in with both their name and email address"}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm">Welcome Headline</Label>
                              <Input
                                value={loginWelcomeHeadline}
                                onChange={(e) => setLoginWelcomeHeadline(e.target.value)}
                                placeholder="Welcome to Your Client Hub"
                                className="text-sm"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label className="text-sm">Welcome Subheadline</Label>
                              <Textarea
                                value={loginWelcomeSubheadline}
                                onChange={(e) => setLoginWelcomeSubheadline(e.target.value)}
                                placeholder="Enter your details to access your dashboard"
                                className="text-sm resize-none"
                                rows={2}
                              />
                            </div>
                          </>
                        )}

                        <Button onClick={saveLoginSettings} disabled={isSaving} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          {isSaving ? "Saving..." : "Save Login Settings"}
                        </Button>
                      </TabsContent>

                      {/* Daily Checklist Tab */}
                      <TabsContent value="daily" className="space-y-4 mt-4">
                        {/* Plan-specific indicator */}
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-blue-700">
                            Daily checklist settings are <strong>plan-specific</strong>. You're
                            editing settings for the currently selected plan.
                          </p>
                        </div>

                        {/* Daily Checklist Toggle */}
                        <div
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          data-tip-target="client-hub-daily-checklist"
                        >
                          <div className="flex items-center gap-2">
                            <ListChecks className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Enable Daily Checklist</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>
                                  Display a daily checklist on the home tab to help clients stay on
                                  track with their daily tasks.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <Switch
                            checked={dailyChecklistEnabled}
                            onCheckedChange={toggleDailyChecklist}
                          />
                        </div>

                        {/* Editable Checklist Title */}
                        <div className="space-y-2">
                          <Label className="text-sm">Checklist Title</Label>
                          <div className="flex items-center gap-2">
                            {editingChecklistTitle ? (
                              <>
                                <Input
                                  value={editingChecklistTitleValue}
                                  onChange={(e) => setEditingChecklistTitleValue(e.target.value)}
                                  className="h-9 text-sm flex-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveChecklistTitle();
                                    if (e.key === "Escape") cancelEditingChecklistTitle();
                                  }}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={saveChecklistTitle}
                                  disabled={isSaving}
                                  aria-label="Confirm"
                                >
                                  <Check className="w-4 h-4 text-green-600" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={cancelEditingChecklistTitle}
                                  aria-label="Close"
                                >
                                  <X className="w-4 h-4 text-red-600" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Input
                                  value={checklistTitle}
                                  readOnly
                                  className="h-9 text-sm flex-1 bg-muted/50"
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8"
                                  onClick={startEditingChecklistTitle}
                                  aria-label="Edit"
                                >
                                  <Pencil className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Daily Checklist Items */}
                        <div className="space-y-3">
                          <Label className="text-sm">Daily Checklist Items</Label>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">1.</span>
                              <Input
                                value={checklistItems.item_1}
                                onChange={(e) =>
                                  setChecklistItems((prev) => ({ ...prev, item_1: e.target.value }))
                                }
                                placeholder="First daily task"
                                className="text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">2.</span>
                              <Input
                                value={checklistItems.item_2}
                                onChange={(e) =>
                                  setChecklistItems((prev) => ({ ...prev, item_2: e.target.value }))
                                }
                                placeholder="Second daily task"
                                className="text-sm"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">3.</span>
                              <Input
                                value={checklistItems.item_3}
                                onChange={(e) =>
                                  setChecklistItems((prev) => ({ ...prev, item_3: e.target.value }))
                                }
                                placeholder="Third daily task"
                                className="text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        <Button className="w-full" onClick={saveChecklistItems} disabled={isSaving}>
                          <Save className="w-4 h-4 mr-2" />
                          {isSaving ? "Saving..." : "Save Daily Checklist"}
                        </Button>
                      </TabsContent>

                      {/* Onboarding Checklist Tab */}
                      <TabsContent value="checklist" className="space-y-4 mt-4">
                        <OnboardingChecklistPanel
                          selectedPlanAgencyId={getSelectedPlanAgencyId()}
                        />
                      </TabsContent>

                      {/* Announcements Tab */}
                      <TabsContent value="announcements" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm font-medium">Enable Announcements Section</span>
                          <Switch
                            checked={homeSettings.announcements_enabled}
                            onCheckedChange={(checked) =>
                              setHomeSettings((prev) => ({
                                ...prev,
                                announcements_enabled: checked,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Headline</Label>
                          <Input
                            value={homeSettings.announcements_headline || ""}
                            onChange={(e) =>
                              setHomeSettings((prev) => ({
                                ...prev,
                                announcements_headline: e.target.value,
                              }))
                            }
                            placeholder="What's new"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Paragraph</Label>
                          <Textarea
                            value={homeSettings.announcements_paragraph || ""}
                            onChange={(e) =>
                              setHomeSettings((prev) => ({
                                ...prev,
                                announcements_paragraph: e.target.value,
                              }))
                            }
                            placeholder="Share updates with your clients..."
                            className="text-sm resize-none"
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Image URL (optional)</Label>
                          <Input
                            value={homeSettings.announcements_image_url || ""}
                            onChange={(e) =>
                              setHomeSettings((prev) => ({
                                ...prev,
                                announcements_image_url: e.target.value,
                              }))
                            }
                            placeholder="https://..."
                            className="text-sm"
                          />
                        </div>
                      </TabsContent>

                      {/* Custom Links Tab */}
                      <TabsContent value="links" className="space-y-4 mt-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="text-sm font-medium">Enable Custom Links Section</span>
                          <Switch
                            checked={homeSettings.custom_links_enabled}
                            onCheckedChange={(checked) =>
                              setHomeSettings((prev) => ({
                                ...prev,
                                custom_links_enabled: checked,
                              }))
                            }
                          />
                        </div>

                        {/* Link 1 */}
                        <div className="p-3 rounded-lg border space-y-2">
                          <Label className="text-sm font-medium">Link 1</Label>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={homeSettings.custom_link_1_text || ""}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_1_text: e.target.value,
                                }))
                              }
                              placeholder="Link text"
                              className="text-sm"
                            />
                            <Input
                              value={homeSettings.custom_link_1_url || ""}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_1_url: e.target.value,
                                }))
                              }
                              placeholder="https://..."
                              className="text-sm"
                            />
                            <Input
                              type="color"
                              value={homeSettings.custom_link_1_color || "#3b82f6"}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_1_color: e.target.value,
                                }))
                              }
                              className="h-9 w-full cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Link 2 */}
                        <div className="p-3 rounded-lg border space-y-2">
                          <Label className="text-sm font-medium">Link 2</Label>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={homeSettings.custom_link_2_text || ""}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_2_text: e.target.value,
                                }))
                              }
                              placeholder="Link text"
                              className="text-sm"
                            />
                            <Input
                              value={homeSettings.custom_link_2_url || ""}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_2_url: e.target.value,
                                }))
                              }
                              placeholder="https://..."
                              className="text-sm"
                            />
                            <Input
                              type="color"
                              value={homeSettings.custom_link_2_color || "#3b82f6"}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_2_color: e.target.value,
                                }))
                              }
                              className="h-9 w-full cursor-pointer"
                            />
                          </div>
                        </div>

                        {/* Link 3 */}
                        <div className="p-3 rounded-lg border space-y-2">
                          <Label className="text-sm font-medium">Link 3</Label>
                          <div className="grid gap-2 md:grid-cols-3">
                            <Input
                              value={homeSettings.custom_link_3_text || ""}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_3_text: e.target.value,
                                }))
                              }
                              placeholder="Link text"
                              className="text-sm"
                            />
                            <Input
                              value={homeSettings.custom_link_3_url || ""}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_3_url: e.target.value,
                                }))
                              }
                              placeholder="https://..."
                              className="text-sm"
                            />
                            <Input
                              type="color"
                              value={homeSettings.custom_link_3_color || "#3b82f6"}
                              onChange={(e) =>
                                setHomeSettings((prev) => ({
                                  ...prev,
                                  custom_link_3_color: e.target.value,
                                }))
                              }
                              className="h-9 w-full cursor-pointer"
                            />
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                      <Button onClick={saveHomeSettings} disabled={isSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? "Saving..." : "Save Home Settings"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* View Tickets Panel */}
                {activePanel === "view-tickets" && (
                  <div className="space-y-4">
                    {tickets.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No support tickets yet</p>
                        <p className="text-sm">Tickets from your clients will appear here</p>
                      </div>
                    ) : (
                      <div className="rounded-md border overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[80px]">Ticket #</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead className="max-w-[200px]">Request</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Date</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tickets.map((ticket) => (
                              <TableRow
                                key={ticket.id}
                                className="cursor-pointer hover:bg-muted/40"
                                onClick={() => {
                                  setSelectedTicket(ticket);
                                  setTicketResponse("");
                                }}
                              >
                                <TableCell className="font-mono text-sm">
                                  #{ticket.ticket_number}
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="font-medium text-sm">{ticket.customer_name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {ticket.customer_email}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{ticket.issue_category}</TableCell>
                                <TableCell className="max-w-[200px] min-w-0">
                                  <TicketListPreview ticket={ticket} />
                                  {ticket.admin_response ? (
                                    <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">
                                        Support Response
                                        {ticket.responded_at
                                          ? ` · ${formatDate(ticket.responded_at)}`
                                          : ""}
                                      </p>
                                      <p className="text-xs whitespace-pre-wrap">
                                        {ticket.admin_response}
                                      </p>
                                    </div>
                                  ) : null}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Select
                                    value={ticket.status}
                                    onValueChange={(value) => handleStatusChange(ticket.id, value)}
                                  >
                                    <SelectTrigger className="w-[130px] h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="open">Open</SelectItem>
                                      <SelectItem value="in_progress">In Progress</SelectItem>
                                      <SelectItem value="responded">Responded</SelectItem>
                                      <SelectItem value="completed">Completed</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {formatDate(ticket.created_at)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat Intervention Panel */}
                {activePanel === "chat-intervention" && (
                  <ChatInterventionPanel agencyVersions={agencyVersions} />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Client Hub Walkthrough Video */}
        <Dialog
          open={activePanel === "learn-more"}
          onOpenChange={(o) => !o && setActivePanel(null)}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-500" />
                Learn About Client Hub
              </DialogTitle>
              <DialogDescription>
                Watch this walkthrough to learn how to use the Client Hub features effectively
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg overflow-hidden shadow-md border border-border">
              <video
                controls
                autoPlay
                className="w-full"
                poster="/lovable-uploads/onboardingthumbnail.png"
              >
                <source
                  src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/695855e3f0b9cf84b516a851.mp4"
                  type="video/mp4"
                />
                Your browser does not support the video tag.
              </video>
            </div>
          </DialogContent>
        </Dialog>

        {/* Branded AI Support Upgrade Popup */}
        <Dialog open={showBrandedUpgradePopup} onOpenChange={setShowBrandedUpgradePopup}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <Badge className="bg-gradient-to-r from-primary to-purple-500 text-white border-0">
                  Premium
                </Badge>
              </div>
              <DialogTitle className="text-xl">Branded AI Support Agent</DialogTitle>
              <DialogDescription>
                Fully customized AI chat support with your branding
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    Custom brand colors and styling
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    15-minute setup/implementation call included
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    Custom prompting for your business
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Human handover capability</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">
                    Custom actions (SMS, email, internal notifications)
                  </span>
                </li>
              </ul>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold text-foreground">$99</span>
                  <span className="text-sm text-muted-foreground">/month per customer</span>
                </div>
                <Button
                  className="w-full bg-gradient-to-r from-primary to-purple-500 hover:opacity-90 text-white"
                  onClick={() => window.open(brandedPaymentLink, "_blank")}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Upgrade to Branded Agent
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={!!selectedTicket}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedTicket(null);
              setTicketResponse("");
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Ticket className="w-4 h-4" />
                    Ticket #{selectedTicket.ticket_number} — {selectedTicket.issue_category}
                  </DialogTitle>
                  <DialogDescription>
                    From <span className="font-medium">{selectedTicket.customer_name}</span> (
                    {selectedTicket.customer_email})
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                    {selectedTicket.request_text}
                  </div>
                  {selectedTicket.admin_response && (
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="text-xs font-medium text-primary mb-1">
                        Previous response
                        {selectedTicket.responded_at
                          ? ` · ${formatDate(selectedTicket.responded_at)}`
                          : ""}
                      </div>
                      <div className="whitespace-pre-wrap">{selectedTicket.admin_response}</div>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Your response</Label>
                    <Textarea
                      value={ticketResponse}
                      onChange={(e) => setTicketResponse(e.target.value)}
                      placeholder="Write the key points of your response. Our AI will turn this into a friendly email."
                      rows={6}
                    />
                  </div>
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground">
                    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span>
                      Our AI will email{" "}
                      <span className="font-medium">{selectedTicket.customer_email}</span> with
                      their ticket update. The ticket will be marked as responded.
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedTicket(null);
                      setTicketResponse("");
                    }}
                    disabled={isSendingTicketResponse}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendTicketResponse}
                    disabled={isSendingTicketResponse || !ticketResponse.trim()}
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    {isSendingTicketResponse ? "Sending…" : "Send response"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Sync Plans Dialog */}
        <Dialog open={customizeUrlOpen} onOpenChange={setCustomizeUrlOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Customize your Client Hub URL</DialogTitle>
              <DialogDescription>
                Your URLs are built from your agency name. Plan 1 uses the name, Plan 2 and Plan 3
                add -2 and -3. You can also change this in Settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="customize-agency-name">Agency name</Label>
              <Input
                id="customize-agency-name"
                value={customizeName}
                onChange={(e) => setCustomizeName(e.target.value)}
                placeholder="e.g. Launch 360"
              />
              <p className="text-xs text-muted-foreground">
                Heads up: if you already pasted a menu link or code into HighLevel, copy it again
                after changing this.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCustomizeUrlOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveCustomizeUrl} disabled={savingName || !customizeName.trim()}>
                {savingName ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <SyncPlansDialog
          open={showSyncPlansDialog}
          onOpenChange={setShowSyncPlansDialog}
          agencyVersions={agencyVersions}
          onSyncComplete={() => {
            // Force reload of current plan's settings by toggling selectedPlan
            // This triggers the useEffect that loads plan-specific settings
            const currentPlan = selectedPlan;
            setSelectedPlan("plan1");
            setTimeout(() => setSelectedPlan(currentPlan), 50);
          }}
        />
      </div>
    </TooltipProvider>
  );
};

export default ClientHub;
