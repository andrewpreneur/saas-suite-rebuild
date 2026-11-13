import { buildSwitchyardCSS, cleanSwitchyardColors, SWITCHYARD_DEFAULTS } from "../../supabase/functions/_shared/switchyardTheme";
import { faviconMarker, readFavicon } from "../../supabase/functions/_shared/brandingFavicon";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { DesignPageView } from "@/components/design/DesignPageView";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ArrowRight, RefreshCw, Undo, Sparkles, Check, X, CheckCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import LoginCustomizationPanel, { BACKGROUND_COLORS } from "./branding/LoginCustomizationPanel";
import ButtonCustomizationPanel, { darkenColor } from "./branding/ButtonCustomizationPanel";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useSessionTracker } from "@/contexts/SessionTrackerContext";
import ColorPicker from "./ColorPicker";
import MobileBrandingCard from "./client-hub/MobileBrandingCard";
import { splitBrandingCSS, updateBrandingPart, type BrandingPart } from "@/lib/brandingSections";
import { brandingThemeMarker, readBrandingTheme } from "@/lib/brandingTheme";
import { installSnippets, THEME_INSTALL_UPDATE_NOTE } from "@/lib/installSnippets";
import { sidebarModeFromHex, sidebarModeWarning, type SidebarMode } from "@/lib/sidebarMode";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FontSelector from "./FontSelector";
import {
  archiveSidebar,
  readBrandingPresets,
  removePreset,
  upsertPreset,
  type BrandingPreset,
} from "@/lib/brandingPresets";
import { notifyHubThemeChanged } from "@/lib/hubUrl";
import { THEME_NAMES } from "@/components/client-hub/ThemePickerCard";
import { platformMockEnabled } from "@/lib/platformMock";
import {
  designBrandingUnlocked,
  designThemeUnlocked,
  filterDesignWrites,
  minimumBrandingPlanName,
  visibleDesignLabels,
} from "@/lib/designAccess";
import {
  styleOnlyPendingLabels,
  designSavePlan,
  dirtyLabels,
  emptyDesignSnapshot,
  previewForTab,
  resolveThemeInstallStatus,
  sidebarStyleOf,
  styleFlags,
  topNavFromRow,
  type DesignSnapshot,
  type DesignTab,
  type PreviewDevice,
  type PreviewSurface,
} from "@/lib/designPageModel";
import type { BrandingVersion } from "@/lib/brandingTheme";
import {
  assertBrandingSaved,
  minimalistSidebarCSS,
  MINIMALIST_SIDEBAR_DEFAULT,
} from "@/lib/brandingSave";
import brandingV1Preview from "@/assets/branding-v1-preview.png";
import brandingV2Preview from "@/assets/branding-v2-preview.png";

interface BrandingToolProps {
  onReset: () => void;
}

// Utility: Convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

// Utility: Convert RGB to hex
const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const hex = Math.round(Math.max(0, Math.min(255, x))).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

// Utility: Calculate relative luminance for theme detection
const getRelativeLuminance = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;

  const { r, g, b } = rgb;
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Utility: Blend two colors (primary % + secondary %)
const blendColors = (color1: string, color2: string, ratio: number): string => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  if (!rgb1 || !rgb2) return color1;

  return rgbToHex(
    rgb1.r * ratio + rgb2.r * (1 - ratio),
    rgb1.g * ratio + rgb2.g * (1 - ratio),
    rgb1.b * ratio + rgb2.b * (1 - ratio),
  );
};

// Utility: Add alpha to hex color, return rgba string
const hexToRgba = (hex: string, alpha: number): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

const BrandingTool = ({ onReset }: BrandingToolProps) => {
  const { email, plan: accountPlan, brandingToolAccess } = useUser();
  const purchasedBranding = brandingToolAccess === true;
  const brandingLocked = !designBrandingUnlocked(accountPlan, false, purchasedBranding);
  const themeLocked = !designThemeUnlocked(accountPlan, false, purchasedBranding);
  const { trackEvent } = useSessionTracker();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  // Uses the app's own checkout so access is granted automatically.
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isV2Mode, setIsV2Mode] = useState<boolean | null>(null);
  const [themeBuilderMode, setThemeBuilderMode] = useState(false);
  const [switchyardMode, setSwitchyardMode] = useState(false);
  const [switchyardColors, setSwitchyardColors] = useState({ ...SWITCHYARD_DEFAULTS });
  const [customizerEnabled, setCustomizerEnabled] = useState(true);
  const [faviconUrl, setFaviconUrl] = useState("");
  const [themeMotion, setThemeMotion] = useState(true);
  const [themeIcons, setThemeIcons] = useState("lucide");
  const [presetName, setPresetName] = useState("");
  const [presets, setPresets] = useState<BrandingPreset[]>([]);
  const [appliedVersion, setAppliedVersion] = useState<BrandingVersion | null>(null);
  const [appliedSidebarMode, setAppliedSidebarMode] = useState<SidebarMode | null>(null);
  const [sidebarModeConfirmed, setSidebarModeConfirmed] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#16a34a");
  const [sidebarBgColor, setSidebarBgColor] = useState("#ffffff");
  const [tertiaryColor, setTertiaryColor] = useState("");
  const [sidebarEdited, setSidebarEdited] = useState(false);
  const [isLoadingBranding, setIsLoadingBranding] = useState(true);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingAttempt, setBrandingAttempt] = useState(0);
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [generatedCSS, setGeneratedCSS] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [userPlan, setUserPlan] = useState<"BASIC" | "ADVANCED">("ADVANCED");
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [detectedTheme, setDetectedTheme] = useState<"light" | "dark" | null>(null);
  const [isPushingToGHL, setIsPushingToGHL] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(2);
  const [layoutKnown, setLayoutKnown] = useState(false);
  const [popupEnabled, setPopupEnabled] = useState(false);
  const [mobileEnabled, setMobileEnabled] = useState(false);
  const [mobileMenuColor, setMobileMenuColor] = useState("#3b82f6");
  const [mobileZoomEnabled, setMobileZoomEnabled] = useState(true);
  const [topNav, setTopNav] = useState(emptyDesignSnapshot().topNav);
  const [installed, setInstalled] = useState(false);
  const [saved, setSaved] = useState<DesignSnapshot | null>(null);
  const [tab, setTab] = useState<DesignTab>("style");
  const defaultedTab = useRef(false);
  const [surface, setSurface] = useState<PreviewSurface>("sidebar");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [savingAll, setSavingAll] = useState(false);
  const hydrate = useRef(true);

  // Dynamic installation state
  const [dynamicInstallation, setDynamicInstallation] = useState(false);
  const [isApplied, setIsApplied] = useState(false);
  const [hasChangedSinceApply, setHasChangedSinceApply] = useState(false);
  const [appliedColors, setAppliedColors] = useState<{
    primary: string;
    secondary: string;
    font: string;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [appliedParts, setAppliedParts] = useState({
    sidebar: false,
    login: false,
    buttons: false,
  });

  // Add-on customization state
  const [loginCustomEnabled, setLoginCustomEnabled] = useState(false);
  const [loginBackground, setLoginBackground] = useState<string | null>(null);
  const [loginLogoUrl, setLoginLogoUrl] = useState("");
  const [buttonCustomEnabled, setButtonCustomEnabled] = useState(false);

  // V2 button gradient customization
  const [gradientCustomEnabled, setGradientCustomEnabled] = useState(false);
  const [gradientStart, setGradientStart] = useState<string>("#16a34a");
  const [gradientEnd, setGradientEnd] = useState<string>("#0b3d1f");

  // Top button gradient customization (independent of sidebar/active gradient)
  const [topGradientCustomEnabled, setTopGradientCustomEnabled] = useState(false);
  const [topGradientStart, setTopGradientStart] = useState<string>("#3d54ff");
  const [topGradientEnd, setTopGradientEnd] = useState<string>("#2233a3");

  // Store previous colors for undo functionality
  const [previousPrimaryColor, setPreviousPrimaryColor] = useState("#16a34a");
  const [previousSidebarBgColor, setPreviousSidebarBgColor] = useState("#ffffff");

  // Load user colors on component mount
  useEffect(() => {
    loadUserColors();
  }, [email, brandingAttempt]);

  const chosenSidebarMode = sidebarModeFromHex(sidebarBgColor);
  useEffect(() => {
    setSidebarModeConfirmed(false);
  }, [chosenSidebarMode, appliedSidebarMode]);

  // Auto-sync gradient defaults to current colors when custom gradient is OFF
  useEffect(() => {
    if (!gradientCustomEnabled) {
      setGradientStart(primaryColor);
      setGradientEnd(blendColors(primaryColor, sidebarBgColor, 0.55));
    }
  }, [primaryColor, sidebarBgColor, gradientCustomEnabled]);

  // Auto-sync top button gradient defaults from primaryColor + sidebarBgColor when OFF
  useEffect(() => {
    if (!topGradientCustomEnabled) {
      const pRgb = hexToRgb(primaryColor);
      const sRgb = hexToRgb(sidebarBgColor);
      if (pRgb) setTopGradientStart(rgbToHex(pRgb.r, pRgb.g, pRgb.b));
      if (sRgb) setTopGradientEnd(rgbToHex(sRgb.r, sRgb.g, sRgb.b));
    }
  }, [primaryColor, sidebarBgColor, topGradientCustomEnabled]);

  // Save colors to Supabase
  const saveUserColors = async (primary: string, secondary?: string) => {
    if (!email) return;

    try {
      const updateData: any = {
        primary_color: primary,
      };

      if (secondary !== undefined) {
        updateData.secondary_color = secondary;
      }

      const { data, error } = await supabase
        .from("saas_suite_users")
        .update(updateData)
        .ilike("email", email.trim().toLowerCase())
        .select("email");

      if (error) {
        console.error("Error saving colors:", error);
        toast.error(error.message || "Failed to save colors");
      } else if (!data || data.length === 0) {
        // No row came back: the sign-in session no longer matches this account.
        console.error("Error saving colors: no matching row updated for", email);
        toast.error("We couldn't save that. Please log out and log back in, then try again.");
      }
    } catch (error: any) {
      console.error("Error saving colors:", error);
      toast.error(error?.message || "Failed to save colors");
    }
  };

  // Load colors from Supabase
  const loadUserColors = async () => {
    if (!email) {
      setIsLoadingBranding(false);
      setBrandingError(null);
      return;
    }
    setIsLoadingBranding(true);
    setBrandingError(null);
    setSidebarEdited(false);
    const stop = armLoadDeadline(() => {
      setIsLoadingBranding(false);
      setBrandingError(LOAD_TIMEOUT_MESSAGE);
    });

    try {
      const { data, error } = await supabase
        .from("saas_suite_users")
        .select(
          "primary_color, secondary_color, tertiary_color, plan, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, dynamic_installation, generated_css, branding_presets, kb_logo_url, popup_enabled, mobile_branding_enabled, mobile_menu_color, mobile_zoom_enabled, install_confirmed_at, top_nav_widget_enabled, top_nav_widget_label, top_nav_widget_color_mode, top_nav_widget_custom_color, top_nav_widget_icon_color_mode, top_nav_widget_icon_custom_color, top_nav_widget_tile_color_mode, top_nav_widget_tile_custom_color",
        )
        .ilike("email", email.trim().toLowerCase())
        .maybeSingle();

      if (error) {
        console.error("Error loading colors:", error);
        return;
      }

      if (data) {
        // Load user's plan and agency_id (any tier column may hold the slug)
        const plan = ((data as any).plan as "BASIC" | "ADVANCED") || "ADVANCED";
        setUserPlan(plan);
        const resolvedAgencyId: string | null =
          (data as any).agency_id ||
          (data as any).agency_id_basic ||
          (data as any).agency_id_advanced ||
          (data as any).agency_id_elite ||
          null;

        setAgencyId(resolvedAgencyId);
        // Shared agency logo is the default login logo
        if ((data as any).kb_logo_url) setLoginLogoUrl((data as any).kb_logo_url);
        setDynamicInstallation((data as any).dynamic_installation ?? false);

        // Check if branding is currently applied and detect version
        setPresets(readBrandingPresets(data.branding_presets));
        const currentCSS = (data as any).generated_css;
        setFaviconUrl(readFavicon(currentCSS || ""));
        if (currentCSS) {
          const parts = splitBrandingCSS(currentCSS);
          setAppliedParts({
            sidebar: !!parts.sidebar,
            login: !!parts.login,
            buttons: !!parts.buttons,
          });
          setIsApplied(!!parts.sidebar);
          // Detect which version is applied from the CSS content
          if (!parts.sidebar) {
            setIsV2Mode(null);
          } else if (currentCSS.includes("Branding V2 Stylesheet")) {
            setIsV2Mode(true);
          } else {
            setIsV2Mode(false);
          }
          const theme = readBrandingTheme(parts.sidebar);
          setAppliedVersion(
            parts.sidebar
              ? theme?.version || (parts.sidebar.includes("Branding V2 Stylesheet") ? "v2" : "v1")
              : null,
          );
          if (theme) {
            setSwitchyardMode(theme.version === "switchyard");
            setSwitchyardColors(cleanSwitchyardColors(theme.switchyard));
            setCustomizerEnabled(theme.customizerEnabled !== false);
            setThemeBuilderMode(theme.version === "v3");
            setIsV2Mode(theme.version === "v3" ? null : theme.version === "v2");
            setThemeMotion(theme.motion);
            setThemeIcons(theme.iconPack);
            setSelectedFont(theme.font);
            setPrimaryColor(theme.accent);
            setSidebarBgColor(theme.sidebarBg);
          }
          setAppliedSidebarMode(
            parts.sidebar
              ? sidebarModeFromHex(theme?.sidebarBg || (data as any).secondary_color || "#ffffff")
              : null,
          );
          setSidebarModeConfirmed(false);
          // Detect add-ons from existing CSS
          if (currentCSS.includes("Login Page Customization")) {
            setLoginCustomEnabled(true);
            // Try to extract logo URL
            const logoMatch = currentCSS.match(
              /\.hl_login--body .card .card-body::before\s*\{[^}]*background-image:\s*url\('([^']+)'\)/,
            );
            if (logoMatch) setLoginLogoUrl(logoMatch[1]);
            // Try to extract background color name
            const bgMatch = currentCSS.match(/Login Background: (\w+)/);
            if (bgMatch) setLoginBackground(bgMatch[1]);
          }
          if (currentCSS.includes("Top Button Customization")) {
            setButtonCustomEnabled(true);
          }
          // Detect V2 gradient customization marker
          const gMatch = currentCSS.match(
            /(?<!top-)gradient-custom:\s*(#[0-9a-fA-F]{3,8})\s*->\s*(#[0-9a-fA-F]{3,8})/,
          );
          if (gMatch) {
            setGradientCustomEnabled(true);
            setGradientStart(gMatch[1]);
            setGradientEnd(gMatch[2]);
          }
          // Detect Top Button gradient customization marker
          const tgMatch = currentCSS.match(
            /top-gradient-custom:\s*(#[0-9a-fA-F]{3,8})\s*->\s*(#[0-9a-fA-F]{3,8})/,
          );
          if (tgMatch) {
            setTopGradientCustomEnabled(true);
            setTopGradientStart(tgMatch[1]);
            setTopGradientEnd(tgMatch[2]);
          }
        } else {
          // No branding applied — leave isV2Mode as null (no selection)
          setIsV2Mode(null);
          setAppliedSidebarMode(null);
          setSidebarModeConfirmed(false);
        }

        if ((data as any).primary_color && !readBrandingTheme(currentCSS || "")) {
          setPrimaryColor((data as any).primary_color);
          setPreviousPrimaryColor((data as any).primary_color);
          setAppliedColors((prev) => ({
            primary: (data as any).primary_color,
            secondary: prev?.secondary || "#ffffff",
            font: prev?.font || "Inter",
          }));
        }
        if ((data as any).secondary_color && !readBrandingTheme(currentCSS || "")) {
          setSidebarBgColor((data as any).secondary_color);
          setPreviousSidebarBgColor((data as any).secondary_color);
          setAppliedColors((prev) => ({
            primary: prev?.primary || "#16a34a",
            secondary: (data as any).secondary_color,
            font: prev?.font || "Inter",
          }));
        }
        setTertiaryColor((data as any).tertiary_color || "");
        const layoutQuery = resolvedAgencyId
          ? supabase
              .from("agency_ui_versions")
              .select("ui_version")
              .eq("agency_id", resolvedAgencyId)
              .maybeSingle()
          : Promise.resolve({ data: null as { ui_version?: number } | null, error: null });
        const [layoutResult, hubResult, optionsResult] = await Promise.all([
          layoutQuery,
          supabase.rpc("is_hub_installed", { user_email: email.trim().toLowerCase() }),
          supabase
            .from("saas_suite_users")
            .select("top_nav_widget_options")
            .ilike("email", email.trim().toLowerCase())
            .maybeSingle(),
        ]);
        const uiVersion = (layoutResult.data as { ui_version?: number } | null)?.ui_version;
        setLayoutKnown(Boolean(uiVersion));
        setLayoutVersion(typeof uiVersion === "number" ? uiVersion : 2);
        setPopupEnabled(Boolean((data as any).popup_enabled));
        setMobileEnabled(Boolean((data as any).mobile_branding_enabled));
        setMobileMenuColor((data as any).mobile_menu_color || "#3b82f6");
        setMobileZoomEnabled((data as any).mobile_zoom_enabled !== false);
        let preview: string | null = null;
        if (platformMockEnabled) {
          try {
            preview = sessionStorage.getItem("ss_mock_install");
          } catch {
            preview = null;
          }
        }
        setInstalled(
          resolveThemeInstallStatus({
            hubInstalled: Boolean(hubResult.data),
            installConfirmedAt: (data as any).install_confirmed_at ?? null,
            preview,
          }),
        );
        setTopNav(
          topNavFromRow({
            ...(data as any),
            top_nav_widget_options: optionsResult.error ? null : optionsResult.data?.top_nav_widget_options,
          }),
        );
      }
      setBrandingError(null);
    } catch (error) {
      console.error("Error loading colors:", error);
      setBrandingError(loadErrorText(error, "Couldn't load branding."));
    } finally {
      stop();
      setIsLoadingBranding(false);
    }
  };

  // Handle primary color change
  const handlePrimaryColorChange = (color: string) => {
    if (switchyardMode) setSwitchyardColors(previous => ({ ...previous, accent: cleanSwitchyardColors({ accent: color }).accent }));
    setPreviousPrimaryColor(primaryColor);
    setPrimaryColor(color);
    if (isApplied) setHasChangedSinceApply(true);
  };

  // Handle sidebar background color change
  const handleSidebarBgColorChange = (color: string) => {
    if (switchyardMode) setSwitchyardColors(previous => ({ ...previous, sidebarBg: cleanSwitchyardColors({ sidebarBg: color }).sidebarBg }));
    setSidebarEdited(true);
    setPreviousSidebarBgColor(sidebarBgColor);
    setSidebarBgColor(color);
    if (isApplied) setHasChangedSinceApply(true);
  };

  // Handle undo functionality
  const handleUndo = () => {
    setPrimaryColor(previousPrimaryColor);
    setSidebarBgColor(previousSidebarBgColor);
    if (isApplied) setHasChangedSinceApply(true);
    toast.success("Colors reverted to previous selection");
  };

  // Handle font change (track changes)
  const handleFontChange = (font: string) => {
    setSelectedFont(font);
    if (isApplied) setHasChangedSinceApply(true);
  };

  // Generate login customization CSS
  const generateLoginCSS = (bgImageUrl: string): string => {
    const primaryRgb = hexToRgb(primaryColor);
    const secondaryRgb = hexToRgb(sidebarBgColor);

    let css = `\n/* === Login Page Customization === */\n`;
    if (loginBackground) {
      css += `/* Login Background: ${loginBackground} */\n`;
    }

    css += `section.hl_login {\n`;
    if (bgImageUrl) {
      css += `  background-image: url('${bgImageUrl}');\n`;
      css += `  background-position: center;\n`;
      css += `  background-repeat: no-repeat;\n`;
      css += `  background-size: cover;\n`;
    }
    css += `  height: 100vh;\n}\n\n`;

    css += `.hl_login--header {\n  display: none;\n}\n\n`;
    css += `.hl_login--header img {\n  visibility: hidden !important;\n}\n\n`;
    css += `.hl_login--body {\n  position: relative;\n  top: 50%;\n  left: 50%;\n  transform: translate(-50%, -50%);\n}\n\n`;

    css += `.hl_login button:not([aria-label="Show password"]) {\n`;
    css += `  background: ${primaryColor};\n`;
    css += `  color: white;\n}\n\n`;

    css += `.hl_login a:not(.btn) {\n  color: ${primaryColor} !important;\n}\n\n`;

    if (loginLogoUrl) {
      css += `.hl_login--body .card .card-body::before {\n`;
      css += `  content: '';\n`;
      css += `  display: block;\n`;
      css += `  height: 80px;\n`;
      css += `  background-image: url('${loginLogoUrl}');\n`;
      css += `  background-size: contain;\n`;
      css += `  background-repeat: no-repeat;\n`;
      css += `  background-position: center;\n`;
      css += `  margin-bottom: 30px;\n}\n\n`;
    }

    return css;
  };

  // Generate button customization CSS
  const generateButtonCSS = (): string => {
    const primaryRgb = hexToRgb(primaryColor);
    const secondaryRgb = hexToRgb(sidebarBgColor);

    const startHex = topGradientCustomEnabled ? topGradientStart : primaryColor;
    const endHex = topGradientCustomEnabled ? topGradientEnd : sidebarBgColor;
    const sRgb = hexToRgb(startHex) || {
      r: primaryRgb?.r ?? 61,
      g: primaryRgb?.g ?? 84,
      b: primaryRgb?.b ?? 255,
    };
    const eRgb = hexToRgb(endHex) || {
      r: secondaryRgb?.r ?? 34,
      g: secondaryRgb?.g ?? 51,
      b: secondaryRgb?.b ?? 163,
    };
    const marker = topGradientCustomEnabled
      ? `\n/* top-gradient-custom: ${startHex} -> ${endHex} */\n`
      : "";

    return `\n/* === Top Button Customization === */${marker}
.topmenu-navitem {
  padding: 8px 12px !important;
  box-shadow: rgba(100, 100, 111, 0.2) 0px 7px 29px 0px;
  border: none;
  border-radius: 4px;
}

.topmenu-navitem.active,
.topmenu-navitem:hover,
.topmenu-navitem a:hover {
  background: linear-gradient(270deg, rgb(${sRgb.r}, ${sRgb.g}, ${sRgb.b}) 0%, rgb(${eRgb.r}, ${eRgb.g}, ${eRgb.b}) 100%);
  color: white !important;
}\n`;
  };

  const savePart = async (part: BrandingPart, content: string) => {
    if (!email || !agencyId) {
      toast.error("Please complete onboarding first.");
      return;
    }
    setIsPushingToGHL(true);
    try {
      const { data: current, error: readError } = await supabase
        .from("saas_suite_users")
        .select("generated_css, branding_presets")
        .ilike("email", email.trim().toLowerCase())
        .single();
      if (readError) throw readError;
      const oldCSS = current.generated_css || "";
      const previousPresets = readBrandingPresets(current.branding_presets);
      const nextPresets =
        part === "sidebar"
          ? archiveSidebar(
              previousPresets,
              oldCSS,
              content,
              crypto.randomUUID(),
              `Previous setup — ${new Date().toLocaleString()}`,
            )
          : previousPresets;
      const theme = readBrandingTheme(content);
      const css = updateBrandingPart(oldCSS, part, content);
      const { data: saved, error } = await supabase
        .from("saas_suite_users")
        .update({
          generated_css: css || null,
          branding_presets: nextPresets,
          ...(part === "sidebar" && theme
            ? { primary_color: theme.accent, secondary_color: theme.sidebarBg }
            : {}),
        } as any)
        .ilike("email", email.trim().toLowerCase())
        .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, generated_css")
        .single();
      if (error || !saved) throw error || new Error("Could not save your customization.");
      assertBrandingSaved(css || null, saved.generated_css);
      const { data: verified, error: verifyError } = await supabase
        .from("saas_suite_users")
        .select("generated_css")
        .ilike("email", email.trim().toLowerCase())
        .single();
      if (verifyError) throw verifyError;
      assertBrandingSaved(css || null, verified?.generated_css);
      const parts = splitBrandingCSS(css);
      setAppliedParts({ sidebar: !!parts.sidebar, login: !!parts.login, buttons: !!parts.buttons });
      setIsApplied(!!parts.sidebar);
      if (part === "sidebar") {
        setAppliedVersion(
          content
            ? theme?.version || (content.includes("Branding V2 Stylesheet") ? "v2" : "v1")
            : null,
        );
        setAppliedSidebarMode(content ? sidebarModeFromHex(theme?.sidebarBg || sidebarBgColor) : null);
        setSidebarModeConfirmed(false);
      }
      setGeneratedCSS(css);
      setPresets(nextPresets);
      if (part === "sidebar") setHasChangedSinceApply(false);
      const ids = [
        ...new Set(
          [
            saved.agency_id,
            saved.agency_id_basic,
            saved.agency_id_advanced,
            saved.agency_id_elite,
          ].filter(Boolean),
        ),
      ];
      const refreshed = await Promise.allSettled(
        ids.flatMap((id) =>
          ["css", "js"].map(async (type) => {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-styles?agency_id=${encodeURIComponent(String(id))}&type=${type}&force=1`,
              { cache: "no-store" },
            );
            if (!response.ok) throw new Error("Delivery refresh failed");
          }),
        ),
      );
      if (refreshed.some((result) => result.status === "rejected"))
        toast.warning(
          "Customization saved, but delivery refresh failed. Try applying again before refreshing HighLevel.",
        );
      else
        toast.success(
          content
            ? "Customization applied — refresh HighLevel."
            : "Customization removed — other parts are unchanged.",
        );
      if (refreshed.some((result) => result.status === "rejected") && part === "sidebar")
        setHasChangedSinceApply(true);
      return true;
    } catch (error: any) {
      toast.error(error?.message || "Could not save customization.");
      return false;
    } finally {
      setIsPushingToGHL(false);
    }
  };

  const applyBranding = async () => {
    if (isV2Mode === null && !themeBuilderMode && !switchyardMode) return;
    await savePart("sidebar", buildSelectedSidebar());
  };
  const themeBuilderScript = agencyId ? installSnippets(agencyId).js : "";
  const sidebarWarning = switchyardMode ? null : sidebarModeWarning(chosenSidebarMode, appliedSidebarMode);
  const copyThemeBuilderScript = async () => {
    if (!themeBuilderScript) return;
    try {
      await navigator.clipboard.writeText(themeBuilderScript);
      toast.success("Theme Customizer script copied");
    } catch {
      toast.error("Couldn't copy. Select the script instead.");
    }
  };
  const buildSelectedSidebar = () => {
    const options = {
      version: switchyardMode ? ("switchyard" as const) : themeBuilderMode ? ("v3" as const) : isV2Mode ? ("v2" as const) : ("v1" as const),
      motion: themeMotion,
      iconPack: themeIcons,
      font: selectedFont,
      sidebarBg: sidebarBgColor,
      accent: primaryColor,
      ...(switchyardMode ? { sidebarBg: switchyardColors.sidebarBg, accent: switchyardColors.accent, switchyard: switchyardColors, customizerEnabled } : {}),
    };
    if (switchyardMode) return `${brandingThemeMarker(options)}\n${buildSwitchyardCSS(switchyardColors)}`;
    return themeBuilderMode
      ? minimalistSidebarCSS(options)
      : `${brandingThemeMarker(options)}\n${isV2Mode ? generateV2CSSString() : generateAdvancedCSSString()}`;
  };
  const savePreset = async (name?: string) => {
    const label = (name ?? presetName).trim();
    if (!email || !label || (isV2Mode === null && !themeBuilderMode && !switchyardMode)) return;
    setIsPushingToGHL(true);
    try {
      const { data: row, error: readError } = await supabase
        .from("saas_suite_users")
        .select("generated_css, branding_presets")
        .ilike("email", email.trim().toLowerCase())
        .single();
      if (readError) throw readError;
      const existing = readBrandingPresets(row.branding_presets);
      // Same name replaces the existing preset, so repeat saves never pile up copies.
      const newPreset = {
        id: crypto.randomUUID(),
        name: label,
        css: updateBrandingPart(row.generated_css || "", "sidebar", buildSelectedSidebar()),
      };
      const replaced = existing.some(
        (preset) => preset.name.trim().toLowerCase() === label.toLowerCase(),
      );
      const next = upsertPreset(existing, newPreset);
      const { data, error } = await supabase
        .from("saas_suite_users")
        .update({ branding_presets: next })
        .ilike("email", email.trim().toLowerCase())
        .select("email")
        .single();
      if (error || !data) throw error || new Error("Could not save preset");
      const { data: verified, error: verifyError } = await supabase
        .from("saas_suite_users")
        .select("branding_presets")
        .ilike("email", email.trim().toLowerCase())
        .single();
      if (verifyError) throw verifyError;
      const savedPreset = readBrandingPresets(verified?.branding_presets).find(
        (preset) => preset.id === newPreset.id,
      );
      if (!savedPreset || savedPreset.css !== newPreset.css)
        throw new Error("Preset wasn't saved correctly. Please try again.");
      setPresets(next);
      setPresetName("");
      toast.success(
        replaced
          ? `Preset "${label}" updated — live branding unchanged.`
          : "Preset saved — live branding unchanged.",
      );
    } catch (error: any) {
      toast.error(error?.message || "Could not save preset");
    } finally {
      setIsPushingToGHL(false);
    }
  };
  const deletePreset = async (preset: BrandingPreset) => {
    if (!email) return;
    setIsPushingToGHL(true);
    try {
      const { data: row, error: readError } = await supabase
        .from("saas_suite_users")
        .select("branding_presets")
        .ilike("email", email.trim().toLowerCase())
        .single();
      if (readError) throw readError;
      const next = removePreset(readBrandingPresets(row.branding_presets), preset.id);
      const { data, error } = await supabase
        .from("saas_suite_users")
        .update({ branding_presets: next })
        .ilike("email", email.trim().toLowerCase())
        .select("email")
        .single();
      if (error || !data) throw error || new Error("Could not delete preset");
      setPresets(next);
      toast.success(`Preset "${preset.name}" deleted — live branding unchanged.`);
    } catch (error: any) {
      toast.error(error?.message || "Could not delete preset");
    } finally {
      setIsPushingToGHL(false);
    }
  };
  const restorePreset = async (preset: { css: string }) => {
    const succeeded = await savePart("sidebar", splitBrandingCSS(preset.css).sidebar);
    if (!succeeded) return;
    const theme = readBrandingTheme(preset.css);
    if (theme) {
      setSwitchyardMode(theme.version === "switchyard");
            setSwitchyardColors(cleanSwitchyardColors(theme.switchyard));
            setCustomizerEnabled(theme.customizerEnabled !== false);
            setThemeBuilderMode(theme.version === "v3");
      setIsV2Mode(theme.version === "v3" ? null : theme.version === "v2");
      setThemeMotion(theme.motion);
      setThemeIcons(theme.iconPack);
      setSelectedFont(theme.font);
      setPrimaryColor(theme.accent);
      setSidebarBgColor(theme.sidebarBg);
    } else {
      setSwitchyardMode(false);
      setThemeBuilderMode(false);
      setIsV2Mode(preset.css.includes("Branding V2 Stylesheet"));
    }
    const gradient = preset.css.match(
      /(?<!top-)gradient-custom:\s*(#[0-9a-fA-F]{3,8})\s*->\s*(#[0-9a-fA-F]{3,8})/,
    );
    setGradientCustomEnabled(!!gradient);
    if (gradient) {
      setGradientStart(gradient[1]);
      setGradientEnd(gradient[2]);
    }
  };
  const loadPresetDraft = (preset: { css: string }) => {
    const theme = readBrandingTheme(preset.css);
    if (theme) {
      setSwitchyardMode(theme.version === "switchyard");
            setSwitchyardColors(cleanSwitchyardColors(theme.switchyard));
            setCustomizerEnabled(theme.customizerEnabled !== false);
            setThemeBuilderMode(theme.version === "v3");
      setIsV2Mode(theme.version === "v3" ? null : theme.version === "v2");
      setThemeMotion(theme.motion);
      setThemeIcons(theme.iconPack);
      setSelectedFont(theme.font);
      setPrimaryColor(theme.accent);
      setSidebarBgColor(theme.sidebarBg);
    } else {
      setSwitchyardMode(false);
      setThemeBuilderMode(false);
      setIsV2Mode(preset.css.includes("Branding V2 Stylesheet"));
    }
    const gradient = preset.css.match(
      /(?<!top-)gradient-custom:\s*(#[0-9a-fA-F]{3,8})\s*->\s*(#[0-9a-fA-F]{3,8})/,
    );
    setGradientCustomEnabled(!!gradient);
    if (gradient) {
      setGradientStart(gradient[1]);
      setGradientEnd(gradient[2]);
    }
    setHasChangedSinceApply(true);
    toast.success("Preset loaded. Save changes to apply it.");
  };
  const removeBranding = async () => {
    setIsRemoving(true);
    const removed = await savePart("sidebar", "");
    setIsRemoving(false);
    if (!removed) return;
    // savePart already cleared the sidebar CSS. Drop the draft mode too, or
    // snapshot.sidebarStyle stays v1/v2/v3 and the next Save writes it back.
    setSwitchyardMode(false);
    const flags = styleFlags(null);
    setThemeBuilderMode(flags.themeBuilderMode);
    setIsV2Mode(flags.isV2Mode);
    setHasChangedSinceApply(false);
    setSidebarModeConfirmed(false);
    setSaved((prev) => (prev ? { ...prev, sidebarStyle: null } : prev));
  };
  const applyLogin = () => {
    const bg = BACKGROUND_COLORS.find((c) => c.value === loginBackground);
    void savePart("login", generateLoginCSS(bg?.url || ""));
  };

  // Helper: generate CSS string without setting state (for apply flow)
  const generateSimpleCSSString = (): string => {
    const templateCSS = isDarkMode ? getDarkModeTemplate() : getLightModeTemplate();
    return templateCSS.replace(
      /--color-sidebar-active: #HEXCODEHERE;/g,
      `--color-sidebar-active: ${primaryColor};`,
    );
  };

  const generateAdvancedCSSString = (): string => {
    let css =
      getRelativeLuminance(sidebarBgColor) < 0.55 ? getDarkModeTemplate() : getLightModeTemplate();
    css = css.replace(
      /--color-sidebar-active: #HEXCODEHERE;/g,
      `--color-sidebar-active: ${primaryColor};`,
    );
    css = css.replace(/--color-sidebar-bg: #ffffff;/g, `--color-sidebar-bg: ${sidebarBgColor};`);
    css = css.replace(/--color-sidebar-bg: #000a1c;/g, `--color-sidebar-bg: ${sidebarBgColor};`);
    const fontFamily = getFontFamilyString(selectedFont);
    css = css.replace(
      /--font-selection: Verdana, sans-serif;/g,
      `--font-selection: ${fontFamily};`,
    );
    return css;
  };

  const generateV2CSSString = (): string => {
    const luminance = getRelativeLuminance(sidebarBgColor);
    const isDark = luminance < 0.55;
    const themePrimaryMix = blendColors(primaryColor, sidebarBgColor, 0.55);
    const primaryBorderSoft = hexToRgba(primaryColor, 0.55);
    const textOnActive = isDark ? "#ffffff" : "#111111";
    const textMuted = isDark ? "#c7c2d1" : "#6b7280";
    const fontFamily = getFontFamilyString(selectedFont);
    const gStart = gradientCustomEnabled ? gradientStart : primaryColor;
    const gEnd = gradientCustomEnabled ? gradientEnd : themePrimaryMix;
    const gradientMarker = gradientCustomEnabled
      ? `\n/* gradient-custom: ${gStart} -> ${gEnd} */\n`
      : "";

    return `/*==============================
  Branding V2 Stylesheet
  Theme: ${isDark ? "Dark" : "Light"} (auto-detected)
  Font: ${selectedFont}
==============================*/${gradientMarker}

:root {
  --theme-primary: ${primaryColor};
  --theme-secondary: ${sidebarBgColor};
  --theme-primary-mix: ${themePrimaryMix};
  --theme-font: ${fontFamily};
  --active-color: linear-gradient(
    270deg,
    ${gStart} 0%,
    ${gEnd} 100%
  );
  --sidebar-bg: ${sidebarBgColor};
  --primary-border: ${primaryColor};
  --primary-border-soft: ${primaryBorderSoft};
  --text-muted: ${textMuted};
  --text-on-active: ${textOnActive};
}

/* Font Application */
#location-dashboard,
#sidebar-v2,
#companySettingsPage,
.hl_header,
#location-dashboard .hl-card .hl-card-header .hl-text-md-medium {
  font-family: var(--theme-font) !important;
}

.v2-open { background: white !important; }

.hl_header { width: -webkit-fill-available !important; }

#sidebar-v2 {
  height: -webkit-fill-available;
  width: fit-content !important;
  margin: 10px;
  border-radius: 15px;
  border: 3px solid var(--primary-border);
}

#sidebar-v2 .h-screen { height: -webkit-fill-available; }

#sidebar-v2 .default-bg-color,
#sidebar-v2.default-bg-color { background: var(--sidebar-bg) !important; }

.agency-logo { height: auto !important; max-height: 40px !important; max-width: 100% !important; object-fit: contain !important; }

#location-switcher-sidbar-v2 {
  margin: 0px 10px 16px 10px !important;
  background-color: var(--sidebar-bg) !important;
  border: 2px solid var(--primary-border-soft);
}

.sidebar-v2-location #location-switcher-sidbar-v2 + div {
  margin: 0 10px;
  padding: 0 !important;
}

#globalSearchOpener {
  margin-right: 5px;
  width: 100% !important;
  background-color: var(--sidebar-bg) !important;
  border: 2px solid var(--primary-border-soft) !important;
}

[aria-label='search icon'], .search-placeholder { color: var(--text-muted) !important; }

#globalSearchOpener .search-shortcut {
  background: var(--sidebar-bg) !important;
  color: var(--text-muted) !important;
  border: 1px solid var(--text-muted);
}

#quickActions {
  width: 35px;
  background-color: var(--sidebar-bg) !important;
  border: 2px solid var(--primary-border-soft) !important;
}

#sidebar-v2 .hl_nav-header,
#sidebar-v2 .hl_nav-header-without-footer {
  margin: 0 10px !important;
  width: -webkit-fill-available;
}

#sidebar-v2 .hl_nav-header nav a { padding: 10px 10px !important; }

#sidebar-v2 nav a.active,
#sidebar-v2 nav a.exact-path-active-class,
#sidebar-v2 nav a:hover { background: var(--active-color) !important; }

#sidebar-v2 nav a.active img,
#sidebar-v2 nav a.exact-path-active-class img,
#sidebar-v2 nav a:hover img { filter: unset !important; }

.sidebar-v2-agency #sidebar-v2 nav a.active span,
.sidebar-v2-agency #sidebar-v2 nav a.exact-path-active-class span,
.sidebar-v2-agency #sidebar-v2 nav a:hover span,
.sidebar-v2-location #sidebar-v2 nav a.active span,
.sidebar-v2-location #sidebar-v2 nav a.exact-path-active-class span,
.sidebar-v2-location #sidebar-v2 nav a:hover span { color: var(--text-on-active) !important; }

#sidebar-v2 .hl_nav-settings nav {
  margin: 0 10px;
  width: -webkit-fill-available !important;
}

#sb_settings {
  padding: 10px !important;
  background: var(--sidebar-bg);
  opacity: 1 !important;
}

#backButtonv2 {
  background: var(--sidebar-bg) !important;
}

#sidebar-v2 .hl_collapse-button {
  color: #000000 !important;
  background: white !important;
}

#sidebar-v2.hl_fixed-width { height: 98vh; }

.hl_wrapper:not(.new-smartlist-ui),
.hl_wrapper--inner,
.hl_wrapper-container:not(.contacts-list-view-container) {
  width: -webkit-fill-available !important;
}

.contacts-list-view-container { padding-right: 30px !important; }`;
  };

  const generateSimpleCSS = () => {
    // Generate CSS based on simple mode selections
    const templateCSS = isDarkMode ? getDarkModeTemplate() : getLightModeTemplate();

    // Replace the placeholder with the selected brand color
    const css = templateCSS.replace(
      /--color-sidebar-active: #HEXCODEHERE;/g,
      `--color-sidebar-active: ${primaryColor};`,
    );

    setGeneratedCSS(css);
    setHasGenerated(true);
    toast.success("CSS Successfully Generated!");
  };

  const generateAdvancedCSS = () => {
    // Use dark mode or light mode template based on isDarkMode toggle
    let css = isDarkMode ? getDarkModeTemplate() : getLightModeTemplate();

    // Replace brand color (sidebar active)
    css = css.replace(
      /--color-sidebar-active: #HEXCODEHERE;/g,
      `--color-sidebar-active: ${primaryColor};`,
    );

    // Replace sidebar background color
    css = css.replace(/--color-sidebar-bg: #ffffff;/g, `--color-sidebar-bg: ${sidebarBgColor};`);
    css = css.replace(/--color-sidebar-bg: #000a1c;/g, `--color-sidebar-bg: ${sidebarBgColor};`);

    // Replace font selection
    const fontFamily = getFontFamilyString(selectedFont);
    css = css.replace(
      /--font-selection: Verdana, sans-serif;/g,
      `--font-selection: ${fontFamily};`,
    );

    setGeneratedCSS(css);
    setHasGenerated(true);
    toast.success("CSS Successfully Generated!");
  };

  // Helper function to get font family string based on selected font
  const getFontFamilyString = (fontName: string): string => {
    const selectedFontObj = fonts.find((font) => font.name === fontName);
    return selectedFontObj
      ? selectedFontObj.family
      : `"${fontName.replace(/[^a-zA-Z0-9 -]/g, "")}", sans-serif`;
  };

  // Font definitions (moved from FontSelector for quick access)
  const fonts = [
    { name: "Inter", family: "Inter, sans-serif", type: "sans-serif" },
    { name: "Roboto", family: "Roboto, sans-serif", type: "sans-serif" },
    { name: "Poppins", family: "Poppins, sans-serif", type: "sans-serif" },
    { name: "Montserrat", family: "Montserrat, sans-serif", type: "sans-serif" },
    { name: "Open Sans", family: "Open Sans, sans-serif", type: "sans-serif" },
    { name: "Verdana", family: "Verdana, sans-serif", type: "sans-serif" },
    { name: "Oswald", family: "Oswald, sans-serif", type: "display" },
    { name: "Playfair Display", family: "Playfair Display, serif", type: "serif" },
    { name: "Merriweather", family: "Merriweather, serif", type: "serif" },
  ];

  const handleGenerate = () => {
    if (isV2Mode) {
      generateV2CSS();
    } else if (mode === "simple") {
      generateSimpleCSS();
    } else {
      generateAdvancedCSS();
    }
  };

  // Push branding to GHL via dynamic-styles edge function
  const pushToGHL = async () => {
    if (!email || !agencyId) {
      toast.error("No agency found. Please complete onboarding first.");
      return;
    }
    if (!generatedCSS) {
      toast.error("Please generate your CSS first before pushing to GHL.");
      return;
    }
    setIsPushingToGHL(true);
    try {
      // Save colors AND the full generated CSS to saas_suite_users
      const { error: colorError } = await supabase
        .from("saas_suite_users")
        .update({
          primary_color: primaryColor,
          secondary_color: sidebarBgColor,
          generated_css: generatedCSS,
        } as any)
        .ilike("email", email.trim().toLowerCase());
      if (colorError) throw colorError;

      toast.success("Branding pushed to GHL! Changes will reflect within 5 minutes.");
    } catch (error) {
      console.error("Error pushing to GHL:", error);
      toast.error("Failed to push branding to GHL");
    } finally {
      setIsPushingToGHL(false);
    }
  };

  // V2 Branding: Generate CSS with the new stylesheet template
  const generateV2CSS = () => {
    // Detect theme based on secondary color luminance
    const luminance = getRelativeLuminance(sidebarBgColor);
    const isDark = luminance < 0.55;
    setDetectedTheme(isDark ? "dark" : "light");

    // Compute derived colors in JS for browser compatibility
    const themePrimaryMix = blendColors(primaryColor, sidebarBgColor, 0.55);
    const primaryBorderSoft = hexToRgba(primaryColor, 0.55);
    const textOnActive = isDark ? "#ffffff" : "#111111";
    const textMuted = isDark ? "#c7c2d1" : "#6b7280";

    // Get font family string
    const fontFamily = getFontFamilyString(selectedFont);
    const gStart = gradientCustomEnabled ? gradientStart : primaryColor;
    const gEnd = gradientCustomEnabled ? gradientEnd : themePrimaryMix;
    const gradientMarker = gradientCustomEnabled
      ? `\n/* gradient-custom: ${gStart} -> ${gEnd} */\n`
      : "";

    const css = `/*==============================
  Branding V2 Stylesheet
  Theme: ${isDark ? "Dark" : "Light"} (auto-detected)
  Font: ${selectedFont}
==============================*/${gradientMarker}

:root {
  --theme-primary: ${primaryColor};
  --theme-secondary: ${sidebarBgColor};
  --theme-primary-mix: ${themePrimaryMix};
  --theme-font: ${fontFamily};
  --active-color: linear-gradient(
    270deg,
    ${gStart} 0%,
    ${gEnd} 100%
  );
  --sidebar-bg: ${sidebarBgColor};
  --primary-border: ${primaryColor};
  --primary-border-soft: ${primaryBorderSoft};
  --text-muted: ${textMuted};
  --text-on-active: ${textOnActive};
}

/* Font Application */
#location-dashboard,
#sidebar-v2,
#companySettingsPage,
.hl_header,
#location-dashboard .hl-card .hl-card-header .hl-text-md-medium {
  font-family: var(--theme-font) !important;
}

.v2-open { background: white !important; }

.hl_header { width: -webkit-fill-available !important; }

#sidebar-v2 {
  height: -webkit-fill-available;
  width: fit-content !important;
  margin: 10px;
  border-radius: 15px;
  border: 3px solid var(--primary-border);
}

#sidebar-v2 .h-screen { height: -webkit-fill-available; }

#sidebar-v2 .default-bg-color,
#sidebar-v2.default-bg-color { background: var(--sidebar-bg) !important; }

.agency-logo { height: auto !important; max-height: 40px !important; max-width: 100% !important; object-fit: contain !important; }

#location-switcher-sidbar-v2 {
  margin: 0px 10px 16px 10px !important;
  background-color: var(--sidebar-bg) !important;
  border: 2px solid var(--primary-border-soft);
}

.sidebar-v2-location #location-switcher-sidbar-v2 + div {
  margin: 0 10px;
  padding: 0 !important;
}

#globalSearchOpener {
  margin-right: 5px;
  width: 100% !important;
  background-color: var(--sidebar-bg) !important;
  border: 2px solid var(--primary-border-soft) !important;
}

[aria-label='search icon'], .search-placeholder { color: var(--text-muted) !important; }

#globalSearchOpener .search-shortcut {
  background: var(--sidebar-bg) !important;
  color: var(--text-muted) !important;
  border: 1px solid var(--text-muted);
}

#quickActions {
  width: 35px;
  background-color: var(--sidebar-bg) !important;
  border: 2px solid var(--primary-border-soft) !important;
}

#sidebar-v2 .hl_nav-header,
#sidebar-v2 .hl_nav-header-without-footer {
  margin: 0 10px !important;
  width: -webkit-fill-available;
}

#sidebar-v2 .hl_nav-header nav a { padding: 10px 10px !important; }

#sidebar-v2 nav a.active,
#sidebar-v2 nav a.exact-path-active-class,
#sidebar-v2 nav a:hover { background: var(--active-color) !important; }

#sidebar-v2 nav a.active img,
#sidebar-v2 nav a.exact-path-active-class img,
#sidebar-v2 nav a:hover img { filter: unset !important; }

.sidebar-v2-agency #sidebar-v2 nav a.active span,
.sidebar-v2-agency #sidebar-v2 nav a.exact-path-active-class span,
.sidebar-v2-agency #sidebar-v2 nav a:hover span,
.sidebar-v2-location #sidebar-v2 nav a.active span,
.sidebar-v2-location #sidebar-v2 nav a.exact-path-active-class span,
.sidebar-v2-location #sidebar-v2 nav a:hover span { color: var(--text-on-active) !important; }

#sidebar-v2 .hl_nav-settings nav {
  margin: 0 10px;
  width: -webkit-fill-available !important;
}

#sb_settings {
  padding: 10px !important;
  background: var(--sidebar-bg);
  opacity: 1 !important;
}

#backButtonv2 {
  background: var(--sidebar-bg) !important;
}

#sidebar-v2 .hl_collapse-button {
  color: #000000 !important;
  background: white !important;
}

#sidebar-v2.hl_fixed-width { height: 98vh; }

.hl_wrapper:not(.new-smartlist-ui),
.hl_wrapper--inner,
.hl-wrapper-container:not(.contacts-list-view-container) {
  width: -webkit-fill-available !important;
}

.contacts-list-view-container { padding-right: 30px !important; }`;

    setGeneratedCSS(css);
    setHasGenerated(true);
    toast.success(`V2 CSS Generated! Theme detected: ${isDark ? "Dark" : "Light"}`);
  };

  // Helper functions to get the CSS templates
  const getDarkModeTemplate = (): string => {
    return `/*==============================
  Dark Mode Stylesheet
==============================*/

/* 1) Root variables */
:root {
  --font-selection: Verdana, sans-serif;
  --color-white: #FFFFFF;
  --color-black: #000000;
  --color-sidebar-bg: #000a1c;
  --color-sidebar-text: #FFFFFF;
  --color-sidebar-active: #HEXCODEHERE;
  --color-card-bg: #fefefe;
  --radius: 20px;
  --font-size-heading: 15px;
  --font-size-SidenavItems: 15px;
  --font-size-searchText: 15px;
  --font-size-locationSwitcherFont: 13px;
  --font-size-11px: 11px;
}

/* 2) Global typography */
#location-dashboard,
#sidebar-v2,
#companySettingsPage,
.hl_header,
#location-dashboard .hl-card .hl-card-header .hl-text-md-medium {
  font-family: var(--font-selection) !important;
}

/* 3) Main content stays white */
html,
body {
  background-color: var(--color-white) !important;
}
#location-dashboard,
#location-dashboard .hl-wrapper-container,
.companySettingsPage,
.hl-wrapper-container,
.page-wrapper,
.app-content {
  background-color: var(--color-white) !important;
  background: var(--color-white) !important;
}

/* 4) Sidebar background */
#sidebar-v2 {
  background-color: var(--color-sidebar-bg) !important;
}

/* 5) Sidebar nav container */
#sidebar-v2 .hl_nav-header,
#sidebar-v2 .hl_nav-settings,
#sidebar-v2 .hl_nav-header-without-footer {
  background: transparent !important;
}

/* 6) Sidebar links (default & hover/active) */
#sidebar-v2 .hl_nav-header nav a,
#sidebar-v2 .hl_nav-settings nav a,
#sidebar-v2 .hl_nav-header-without-footer nav a {
  padding: 12px 16px !important;
  margin-top: 5px !important;
  background: transparent !important;
  opacity: 0.7 !important;
  color: var(--color-sidebar-text) !important;
}
#sidebar-v2 .hl_nav-header nav a:hover,
#sidebar-v2 .hl_nav-settings nav a:hover,
#sidebar-v2 .hl_nav-header-without-footer nav a:hover,
#sidebar-v2 .hl_nav-header nav a.active,
#sidebar-v2 .hl_nav-settings nav a.active,
#sidebar-v2 .hl_nav-header-without-footer nav a.active {
  background-color: var(--color-sidebar-active) !important;
  color: var(--color-white) !important;
}

/* 7) Nav titles & icons */
.nav-title,
#sidebar-v2 .hl_nav-header nav a .nav-title,
#sidebar-v2 .hl_nav-settings nav a .nav-title,
#sidebar-v2 .hl_nav-header-without-footer nav a .nav-title,
#sidebar-v2 .hl_nav-header nav a .nav-fa-icon,
#sidebar-v2 .hl_nav-settings nav a .nav-fa-icon,
#sidebar-v2 .hl_nav-header-without-footer nav a .nav-fa-icon,
.fas,
.fa,
.nav-fa-icon {
  color: var(--color-sidebar-text) !important;
}
#sidebar-v2 .hl_nav-header nav a.active .nav-title,
#sidebar-v2 .hl_nav-header nav a.active .nav-fa-icon,
#sidebar-v2 .hl_nav-settings nav a.active .nav-title,
#sidebar-v2 .hl_nav-settings nav a.active .nav-fa-icon,
#sidebar-v2 .hl_nav-header-without-footer nav a.active .nav-title,
#sidebar-v2 .hl_nav-header-without-footer nav a.active .nav-fa-icon {
  color: var(--color-white) !important;
}

/* 8) SVG icon overrides */
#sidebar-v2 .hl_nav-header nav a svg path,
#sidebar-v2 .hl_nav-settings nav a svg path,
#sidebar-v2 .hl_nav-header-without-footer nav a svg path {
  stroke: var(--color-sidebar-text) !important;
  fill: var(--color-sidebar-text) !important;
}
#sidebar-v2 .hl_nav-header nav a.active svg path,
#sidebar-v2 .hl_nav-settings nav a.active svg path,
#sidebar-v2 .hl_nav-header-without-footer nav a.active svg path,
#sidebar-v2 .hl_nav-header nav a:hover svg path,
#sidebar-v2 .hl_nav-settings nav a:hover svg path,
#sidebar-v2 .hl_nav-header-without-footer nav a:hover svg path {
  stroke: var(--color-white) !important;
  fill: var(--color-white) !important;
}

/* 9) Image icon overrides (PNGs, etc.) */
#sidebar-v2 .hl_nav-header nav a img,
#sidebar-v2 .hl_nav-settings nav a img,
#sidebar-v2 .hl_nav-header-without-footer nav a img {
  filter: brightness(0) invert(1) !important;
}

/* 10) Card backgrounds & shadows */
#location-dashboard .hl-card {
  background: var(--color-card-bg) !important;
  border-radius: var(--radius) !important;
  box-shadow: rgba(255, 255, 255, 0.1) 0px 10px 20px !important;
}

/* 11) Misc icon & caret overrides */
.lg\\:justify-between .switcher-caret-holder .fa-angle-down,
.lg\\:justify-between .switcher-caret-holder .fa-angle-up,
.transition-slowest .flex-col > .overflow-hidden:hover,
.lg\\:justify-between div .hl_location_icon {
  color: var(--color-white) !important;
  filter: none !important;
}

/* Image */
.transition-slowest .flex-col .overflow-hidden .agency-logo-container img{
  max-height: 40px !important;
  max-width: 100% !important;
  object-fit: contain !important;
  transform: none !important;
}

#sidebar-v2 .hl_nav-header nav a,
#sidebar-v2 .hl_nav-settings nav a,
#sidebar-v2 .hl_nav-header-without-footer nav a {
  opacity: 1 !important;
}

/* =========================================================
   Dark Mode — Additions to match Light behavior (no recolor)
   Append this block after your current Dark Mode CSS
   ========================================================= */

/* --- 0) Variable aliases & missing vars (keep dark palette) --- */
:root {
  /* alias light-only vars to your dark ones so rules won't break */
  --gradient-main: var(--color-white); /* or your actual dark gradient if any */
  ----bg-rgb-staticBackground: var(--color-white);

  /* name mismatches from light */
  --font-size-searchText_size: var(--font-size-searchText);
  --font-size-locationSwitcherFort: var(--font-size-locationSwitcherFont);

  /* optional: parity with light var names used elsewhere */
  --color-sidebar_text: var(--color-sidebar-text);
  --color-card: var(--color-black);
  --color-card_header: var(--color-white);
}

/* --- 1) Dashboard wrapper parity (spacing/grad background hook) --- */
#location-dashboard {
  padding-top: 2.5rem !important;
  /* keep dark bg white per your dark theme choice, but preserve hooks */
  background: var(----bg-rgb-staticBackground) !important;
  background: var(--gradient-main) !important;
}
#location-dashboard .hl-wrapper-container.location-dashboard-wrapper {
  background-color: transparent !important;
}

/* --- 2) Sidebar utility blocks & search opener parity --- */
#location-switcher-sidbar-v2 {
  background-color: var(--color-sidebar-active) !important;
  margin-bottom: 4px !important;
}
#globalSearchOpener {
  background-color: var(--color-sidebar-active) !important;
  border: 0 !important;
}
#globalSearchOpener span {
  color: var(--color-white) !important;
  font-size: var(--font-size-searchText_size) !important;
}
#quickActions {
  background-color: transparent !important;
  border: 0 !important;
}
.hl_nav-header {
  margin-top: 10px !important;
}

/* --- 3) Link padding parity (already present, but ensure exact match) --- */
#sidebar-v2 .hl_nav-header nav a,
#sidebar-v2 .hl_nav-settings nav a,
#sidebar-v2 .hl_nav-header-without-footer nav a {
  padding: 12px 16px !important;
  margin-top: 5px !important;
}

/* --- 4) Hover/active animation + heavier shadow to match light behavior --- */
#sidebar-v2 .hl_nav-header nav a:hover,
#sidebar-v2 .hl_nav-header nav a.active,
#sidebar-v2 .hl_nav-settings nav a:hover,
#sidebar-v2 .hl_nav-settings nav a.active,
#sidebar-v2 .hl_nav-header-without-footer nav a:hover,
#sidebar-v2 .hl_nav-header-without-footer nav a.active {
  /* keep your dark colors but bring over the interaction feel */
  box-shadow: rgba(0, 0, 0, 0.16) 0px 3px 6px,
              rgba(0, 0, 0, 0.23) 0px 3px 6px !important;
  transform: rotateY(20deg) rotateX(10deg) !important;
}

/* --- 5) Nav titles sizing/weight parity (respect dark colors) --- */
#sidebar-v2 .hl_nav-header nav a .nav-fa-icon,
#sidebar-v2 .hl_nav-header nav a .nav-title,
#sidebar-v2 .hl_nav-settings nav a .nav-fa-icon,
#sidebar-v2 .hl_nav-settings nav a .nav-title,
#sidebar-v2 .hl_nav-header-without-footer nav a .nav-fa-icon,
#sidebar-v2 .hl_nav-header-without-footer nav a .nav-title {
  font-size: var(--font-size-SidenavItems) !important;
  font-weight: 400 !important;
}

/* Active/hover titles should flip to white (already in your dark set, reinforce) */
#sidebar-v2 .hl_nav-header nav a.active .nav-title,
#sidebar-v2 .hl_nav-header nav a:hover .nav-title,
#sidebar-v2 .hl_nav-settings nav a.active .nav-title,
#sidebar-v2 .hl_nav-settings nav a:hover .nav-title,
#sidebar-v2 .hl_nav-header-without-footer nav a.active .nav-title,
#sidebar-v2 .hl_nav-header-without-footer nav a:hover .nav-title {
  color: var(--color-white) !important;
}

/* --- 6) Divider & Back button parity --- */
#sidebar-v2 .hl_nav-header nav a.divider {
  display: none !important;
}
#sidebar-v2 #backButtonv2 {
  background-color: transparent !important;
  color: var(--color-sidebar-text) !important;
}
#sidebar-v2 .hl_nav-header-without-footer nav a.divider {
  background-color: transparent !important;
  box-shadow: none !important;
  transform: none !important;
  cursor: default !important;
}
#sidebar-v2 .hl_nav-header-without-footer nav a.divider span {
  background-color: transparent !important;
  color: var(--color-white) !important;
  font-size: var(--font-size-11px) !important;
  font-weight: 400 !important;
  letter-spacing: 1px !important;
}

/* --- 7) Location switcher text & caret parity --- */
#sidebar-v2 #location-switcher-sidbar-v2 .hl_switcher-loc-name,
#sidebar-v2 #location-switcher-sidbar-v2 .hl_switcher-loc-city {
  color: var(--color-white) !important;
  font-size: var(--font-size-locationSwitcherFort) !important; /* alias above */
}
#sidebar-v2 .hl_location_icon.scale-2 {
  display: none !important;
}
#sidebar-v2 #location-switcher-sidbar-v2 .switcher-caret-holder {
  font-size: 12px !important;
  color: var(--color-white) !important;
}

/* Font icons & hover text (kept white in dark) */
.lg\\:justify-between .switcher-caret-holder .fa-angle-down,
.lg\\:justify-between .switcher-caret-holder .fa-angle-up {
  color: #ffffff !important;
}
.transition-slowest .flex-col > .overflow-hidden:hover {
  color: #ffffff !important;
}
/* Location icon tint parity (keep dark friendly) */
.lg\\:justify-between div .hl_location_icon {
  filter: invert(0.09) !important;
}

/* --- 8) Per-meta icon parity (map light's explicit rules to dark's palette) --- */
/* Default is already handled by your global SVG rules.
   These explicit selectors preserve the light file's specificity for edge cases. */
#sidebar-v2 .hl_nav-header nav a[meta="dashboard"]    svg path,
#sidebar-v2 .hl_nav-header nav a[meta="conversations"] svg path,
#sidebar-v2 .hl_nav-header nav a[meta="calendars"]     svg path,
#sidebar-v2 .hl_nav-header nav a[meta="contacts"]      svg path,
#sidebar-v2 .hl_nav-header nav a[meta="opportunities"] svg path,
#sidebar-v2 .hl_nav-header nav a[meta="payments"]      svg path,
#sidebar-v2 .hl_nav-header nav a[meta="email-marketing"] svg path,
#sidebar-v2 .hl_nav-header nav a[meta="automation"]    svg path,
#sidebar-v2 .hl_nav-header nav a[meta="sites"]         svg path,
#sidebar-v2 .hl_nav-header nav a[meta="memberships"]   svg path,
#sidebar-v2 .hl_nav-header nav a[meta="reputation"]    svg path,
#sidebar-v2 .hl_nav-header nav a[meta="reporting"]     svg path,
#sidebar-v2 .hl_nav-header nav a[meta="app-marketplace"] svg path,
#sidebar-v2 .hl_nav-header nav a[meta="location-mobile-app"] svg path,
#sidebar-v2 .hl_nav-settings nav a[meta="settings"]    svg path {
  /* default idle color in dark */
  stroke: var(--color-sidebar-text) !important;
  fill:   var(--color-sidebar-text) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta]        .active svg path,
#sidebar-v2 .hl_nav-header nav a[meta]:hover  svg path,
#sidebar-v2 .hl_nav-settings  nav a[meta].active svg path,
#sidebar-v2 .hl_nav-settings  nav a[meta]:hover  svg path {
  stroke: var(--color-white) !important;
  fill:   var(--color-white) !important;
}

/* --- 9) Cards: keep dark bg but add the stronger drop shadow parity --- */
#location-dashboard .hl-card {
  /* retain your dark mode background and radius from existing rules */
  box-shadow:
    rgba(0, 0, 0, 0.19) 0px 10px 20px,
    rgba(0, 0, 0, 0.23) 0px 6px 6px !important;
}

/* --- 10) Agency logo scale parity (already present; ensure same selector) --- */
.transition-slowest .flex-col .overflow-hidden .agency-logo-container img {
  max-height: 40px !important;
  max-width: 100% !important;
  object-fit: contain !important;
  transform: none !important;
}`;
  };

  const getLightModeTemplate = (): string => {
    return `/*==============================
  Light Mode Stylesheet
==============================*/

/* Root variables */
:root {
    --font-selection: Verdana, sans-serif;
    --color-white: #ffffff;
    --color-black: #000a1c;
    --color-card: #000;
    --color-sidebar_text: #030403;
    --color-sidebar-active: #HEXCODEHERE;
    --color-sidebar-bg: #ffffff;
    --color-card_header: #fffff;
    --color-a1a5a7: #b4a798;
    --color-e0e6f1: #d0c8be;
    --color-e6ebf8: #e6e1d8;
    ----bg-rgb-staticBackground: rgb(52, 152, 219);
    --bg-rgb-255-249-203: undefined;
    --bg-rgb-255-214-224: undefined;
    --bg-rgb-233-243-251: undefined;
    --bg-rgb-117-206-233: undefined;
    --radius: 20px;
    --font-size-heading: 15px;
    --font-size-SidenavItems: 15px;
    --font-size-searchText_size: 15px;
    --font-size-locationSwitcherFort: 13px;
    --font-size-11px: 11px;
}

/* Apply Verdana */
#location-dashboard,
#sidebar-v2,
#companySettingsPage,
.hl_header,
#location-dashboard .hl-card .hl-card-header .hl-text-md-medium {
    font-family: var(--font-selection) !important;
}

/* Full CSS from original file */
#location-dashboard {
    padding-top: 2.5rem !important;
    background: var(----bg-rgb-staticBackground) !important;
    background: var(--gradient-main) !important;
}
#location-dashboard .hl-wrapper-container.location-dashboard-wrapper {
    background-color: transparent !important;
}
#sidebar-v2 {
  /* drop the old vars entirely */
  background: var(--color-sidebar-bg) !important;
}
#location-switcher-sidbar-v2 {
    background-color: var(--color-sidebar-active) !important;
    margin-bottom: 4px !important;
}
#globalSearchOpener {
    background-color: var(--color-sidebar-active) !important;
    border: 0px !important;
}
#globalSearchOpener span {
    color: var(--color-white) !important;
    font-size: var(--font-size-searchText_size) !important;
}
#quickActions {
    background-color: transparent !important;
    border: 0px !important;
}
.hl_nav-header {
    margin-top: 10px !important;
}
#sidebar-v2 .hl_nav-header nav a,
#sidebar-v2 .hl_nav-settings nav a,
#sidebar-v2 .hl_nav-header-without-footer nav a {
    padding: 12px 16px !important;
    margin-top: 5px !important;
}
#sidebar-v2 .hl_nav-header nav a.active,
#sidebar-v2 .hl_nav-header nav a:hover,
#sidebar-v2 .hl_nav-settings nav a.active,
#sidebar-v2 .hl_nav-settings nav a:hover,
#sidebar-v2 .hl_nav-header-without-footer nav a.active,
#sidebar-v2 .hl_nav-header-without-footer nav a:hover {
    background: var(--color-sidebar-active) !important;
    box-shadow: rgba(0, 0, 0, 0.16) 0px 3px 6px, rgba(0, 0, 0, 0.23) 0px 3px 6px;
    transform: rotateY(20deg) rotateX(10deg) !important;
}
#companySettingsPage {
    font-family: var(--font-selection) !important;
}
#location-dashboard .hl-card {
    background: transparent !important;
    border-radius: var(--radius) !important;
    height: 100% !important;
    box-shadow: rgba(0, 0, 0, 0.19) 0px 10px 20px, rgba(0, 0, 0, 0.23) 0px 6px 6px !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="dashboard"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="dashboard"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="dashboard"]:hover svg path {
    stroke: var(--color-white) !important;
}

/* Font Icon */
.lg\\:justify-between .switcher-caret-holder .fa-angle-down{
 color:#ffffff;
}

/* Font Icon */
.lg\\:justify-between .switcher-caret-holder .fa-angle-up{
 color:#ffffff;
}

/* Overflow hidden (hover) */
.transition-slowest .flex-col > .overflow-hidden:hover{
 color:#ffffff;
}

/* Location icon */
.lg\\:justify-between div .hl_location_icon{
 filter: invert(0.09) !important;
}

#sidebar-v2 .hl_nav-header nav a,
#sidebar-v2 .hl_nav-settings nav a,
#sidebar-v2 .hl_nav-header-without-footer nav a {
    padding: 12px 16px !important;
    margin-top: 5px !important;
}
#sidebar-v2 .hl_nav-header nav a .nav-fa-icon,
#sidebar-v2 .hl_nav-header nav a .nav-title,
#sidebar-v2 .hl_nav-settings nav a .nav-fa-icon,
#sidebar-v2 .hl_nav-settings nav a .nav-title,
#sidebar-v2 .hl_nav-header-without-footer nav a .nav-fa-icon,
#sidebar-v2 .hl_nav-header-without-footer nav a .nav-title {
    color: var(--color-black) !important;
    font-size: var(--font-size-SidenavItems) !important;
    font-weight: 400 !important;
}
#sidebar-v2 .hl_nav-header nav a.active,
#sidebar-v2 .hl_nav-header nav a:hover,
#sidebar-v2 .hl_nav-settings nav a.active,
#sidebar-v2 .hl_nav-settings nav a:hover,
#sidebar-v2 .hl_nav-header-without-footer nav a.active,
#sidebar-v2 .hl_nav-header-without-footer nav a:hover {
    background: var(--color-sidebar-active) !important;
    box-shadow: rgba(0, 0, 0, 0.16) 0px 3px 6px,
        rgba(0, 0, 0, 0.23) 0px 3px 6px;
    transform: rotateY(20deg) rotateX(10deg) !important;
}
#sidebar-v2 .hl_nav-header nav a.active .nav-title,
#sidebar-v2 .hl_nav-header nav a:hover .nav-title,
#sidebar-v2 .hl_nav-settings nav a.active .nav-title,
#sidebar-v2 .hl_nav-settings nav a:hover .nav-title,
#sidebar-v2 .hl_nav-header-without-footer nav a.active .nav-title,
#sidebar-v2 .hl_nav-header-without-footer nav a:hover .nav-title {
    color: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a.divider {
    display: none !important;
}
#sidebar-v2 #backButtonv2 {
    background-color: transparent !important;
    color: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header-without-footer nav a.divider {
    background-color: transparent !important;
    box-shadow: none !important;
    transform: none !important;
    cursor: default !important;
}
#sidebar-v2 .hl_nav-header-without-footer nav a.divider span {
    background-color: transparent !important;
    color: var(--color-white) !important;
    font-size: var(--font-size-11px) !important;
    font-weight: 400 !important;
    letter-spacing: 1px !important;
}
#sidebar-v2 #location-switcher-sidbar-v2 .hl_switcher-loc-name,
#sidebar-v2 #location-switcher-sidbar-v2 .hl_switcher-loc-city {
    color: var(--color-white) !important;
    font-size: var(--font-size-locationSwitcherFort) !important;
}
#sidebar-v2 .hl_location_icon.scale-2 {
    display: none !important;
}
#sidebar-v2 #location-switcher-sidbar-v2 .switcher-caret-holder {
    font-size: 12px !important;
    color: var(--color-white) !important;
}

/* Dashboard icon */
#sidebar-v2 .hl_nav-header nav a[meta="dashboard"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="dashboard"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="dashboard"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Conversations Icon */
#sidebar-v2 .hl_nav-header nav a[meta="conversations"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="conversations"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="conversations"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Calendars Icon */
#sidebar-v2 .hl_nav-header nav a[meta="calendars"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="calendars"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="calendars"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Contacts Icon */
#sidebar-v2 .hl_nav-header nav a[meta="contacts"] svg path {
    stroke: var(--color-black) !important;
    fill: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="contacts"].active svg path {
    stroke: var(--color-white) !important;
    fill: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="contacts"]:hover svg path {
    stroke: var(--color-white) !important;
    fill: var(--color-white) !important;
}
/* Opportunities Icon */
#sidebar-v2 .hl_nav-header nav a[meta="opportunities"] svg path {
    fill: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="opportunities"].active svg path {
    fill: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="opportunities"]:hover svg path {
    fill: var(--color-white) !important;
}
/* Payments Icon */
#sidebar-v2 .hl_nav-header nav a[meta="payments"] svg path {
    fill: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="payments"].active svg path {
    fill: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="payments"]:hover svg path {
    fill: var(--color-white) !important;
}
/* Marketing Icon */
#sidebar-v2 .hl_nav-header nav a[meta="email-marketing"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="email-marketing"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="email-marketing"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Automation Icon */
#sidebar-v2 .hl_nav-header nav a[meta="automation"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="automation"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="automation"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Sites Icon */
#sidebar-v2 .hl_nav-header nav a[meta="sites"] svg path {
    fill: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="sites"].active svg path {
    fill: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="sites"]:hover svg path {
    fill: var(--color-white) !important;
}
/* Memberships Icon */
#sidebar-v2 .hl_nav-header nav a[meta="memberships"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="memberships"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="memberships"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Reputation Icon */
#sidebar-v2 .hl_nav-header nav a[meta="reputation"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="reputation"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="reputation"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Reporting Icon */
#sidebar-v2 .hl_nav-header nav a[meta="reporting"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="reporting"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="reporting"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* App Marketplace Icon */
#sidebar-v2 .hl_nav-header nav a[meta="app-marketplace"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="app-marketplace"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="app-marketplace"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Mobile App Icon */
#sidebar-v2 .hl_nav-header nav a[meta="location-mobile-app"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="location-mobile-app"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-header nav a[meta="location-mobile-app"]:hover svg path {
    stroke: var(--color-white) !important;
}
/* Settings Icon */
#sidebar-v2 .hl_nav-settings nav a[meta="settings"] svg path {
    stroke: var(--color-black) !important;
}
#sidebar-v2 .hl_nav-settings nav a[meta="settings"].active svg path {
    stroke: var(--color-white) !important;
}
#sidebar-v2 .hl_nav-settings nav a[meta="settings"]:hover svg path {
    stroke: var(--color-white) !important;
}

:root {
  --customLogoURL: url("");
  --logoHeight: 40px;
  --logoWidth: 80px;
}

.transition-slowest .flex-col .overflow-hidden .agency-logo-container img {
  max-height: 40px !important;
  max-width: 100% !important;
  object-fit: contain !important;
  transform: none !important;
}`;
  };


  const snapshot = useMemo<DesignSnapshot>(
    () => ({
      sidebarStyle: switchyardMode ? "switchyard" : sidebarStyleOf(themeBuilderMode, isV2Mode),
      switchyard: switchyardColors,
      customizerEnabled,
      faviconUrl,
      primaryColor,
      sidebarBgColor,
      font: selectedFont,
      iconPack: themeIcons,
      motion: themeMotion,
      gradientCustomEnabled,
      gradientStart,
      gradientEnd,
      topGradientCustomEnabled,
      topGradientStart,
      topGradientEnd,
      loginCustomEnabled,
      loginBackground,
      loginLogoUrl,
      buttonCustomEnabled,
      layout: layoutVersion,
      layoutKnown,
      popupEnabled,
      mobileEnabled,
      mobileMenuColor,
      mobileZoomEnabled,
      topNav,
    }),
    [
      themeBuilderMode,
      switchyardMode, switchyardColors, customizerEnabled, faviconUrl,
      isV2Mode,
      primaryColor,
      sidebarBgColor,
      selectedFont,
      themeIcons,
      themeMotion,
      gradientCustomEnabled,
      gradientStart,
      gradientEnd,
      topGradientCustomEnabled,
      topGradientStart,
      topGradientEnd,
      loginCustomEnabled,
      loginBackground,
      loginLogoUrl,
      buttonCustomEnabled,
      layoutVersion,
      layoutKnown,
      popupEnabled,
      mobileEnabled,
      mobileMenuColor,
      mobileZoomEnabled,
      topNav,
    ],
  );

  useEffect(() => {
    if (isLoadingBranding) {
      hydrate.current = true;
      return;
    }
    if (!hydrate.current) return;
    hydrate.current = false;
    setSaved(snapshot);
  }, [isLoadingBranding, snapshot]);

  const labels = saved
    ? visibleDesignLabels(dirtyLabels(saved, snapshot), accountPlan, false, purchasedBranding)
    : [];
  const writes = saved
    ? filterDesignWrites(designSavePlan(saved, snapshot), accountPlan, false, purchasedBranding)
    : [];
  const saveBlocked = writes.some((write) => write.kind === "sidebar") && !!sidebarWarning && !sidebarModeConfirmed;

  useEffect(() => {
    if (defaultedTab.current || accountPlan == null) return;
    defaultedTab.current = true;
    if (brandingLocked) setTab("widgets");
  }, [accountPlan, brandingLocked]);

  const onTab = (next: DesignTab) => {
    setTab(next);
    const preview = previewForTab(next);
    setSurface(preview.surface);
    if (preview.device) setDevice(preview.device);
  };

  const onPatch = (patch: Partial<DesignSnapshot>) => {
    if (patch.sidebarStyle) {
      const version = patch.sidebarStyle;
      if (version === "v3" && !themeBuilderMode && appliedVersion !== "v3" && !sidebarEdited) {
        setSidebarBgColor(MINIMALIST_SIDEBAR_DEFAULT);
      }
      setSwitchyardMode(version === "switchyard");
      setThemeBuilderMode(version === "v3");
      setIsV2Mode(version === "v3" ? null : version === "v2");
      setHasChangedSinceApply(isApplied);
    }
    if (patch.switchyard !== undefined) setSwitchyardColors(cleanSwitchyardColors(patch.switchyard));
    if (patch.customizerEnabled !== undefined) setCustomizerEnabled(patch.customizerEnabled);
    if (patch.faviconUrl !== undefined) setFaviconUrl(patch.faviconUrl);
    if (patch.primaryColor !== undefined) handlePrimaryColorChange(patch.primaryColor);
    if (patch.sidebarBgColor !== undefined) handleSidebarBgColorChange(patch.sidebarBgColor);
    if (patch.font !== undefined) handleFontChange(patch.font);
    if (patch.iconPack !== undefined) {
      setThemeIcons(patch.iconPack);
      setHasChangedSinceApply(true);
    }
    if (patch.motion !== undefined) {
      setThemeMotion(patch.motion);
      setHasChangedSinceApply(true);
    }
    if (patch.gradientCustomEnabled !== undefined) {
      setGradientCustomEnabled(patch.gradientCustomEnabled);
      setHasChangedSinceApply(isApplied);
    }
    if (patch.gradientStart !== undefined) {
      setGradientStart(patch.gradientStart);
      setHasChangedSinceApply(isApplied);
    }
    if (patch.gradientEnd !== undefined) {
      setGradientEnd(patch.gradientEnd);
      setHasChangedSinceApply(isApplied);
    }
    if (patch.topGradientCustomEnabled !== undefined) {
      setTopGradientCustomEnabled(patch.topGradientCustomEnabled);
      setHasChangedSinceApply(isApplied);
    }
    if (patch.topGradientStart !== undefined) {
      setTopGradientStart(patch.topGradientStart);
      setHasChangedSinceApply(isApplied);
    }
    if (patch.topGradientEnd !== undefined) {
      setTopGradientEnd(patch.topGradientEnd);
      setHasChangedSinceApply(isApplied);
    }
    if (patch.loginCustomEnabled !== undefined) setLoginCustomEnabled(patch.loginCustomEnabled);
    if (patch.loginBackground !== undefined) setLoginBackground(patch.loginBackground);
    if (patch.loginLogoUrl !== undefined) setLoginLogoUrl(patch.loginLogoUrl);
    if (patch.buttonCustomEnabled !== undefined) setButtonCustomEnabled(patch.buttonCustomEnabled);
    if (patch.layout !== undefined) setLayoutVersion(patch.layout);
    if (patch.layoutKnown !== undefined) setLayoutKnown(patch.layoutKnown);
    if (patch.popupEnabled !== undefined) setPopupEnabled(patch.popupEnabled);
    if (patch.mobileEnabled !== undefined) setMobileEnabled(patch.mobileEnabled);
    if (patch.mobileMenuColor !== undefined) setMobileMenuColor(patch.mobileMenuColor);
    if (patch.mobileZoomEnabled !== undefined) setMobileZoomEnabled(patch.mobileZoomEnabled);
    if (patch.topNav !== undefined) setTopNav(patch.topNav);
  };

  const discard = () => {
    if (!saved) return;
    setSwitchyardMode(saved.sidebarStyle === "switchyard");
    setSwitchyardColors(cleanSwitchyardColors(saved.switchyard));
    setCustomizerEnabled(saved.customizerEnabled !== false);
    setFaviconUrl(saved.faviconUrl || "");
    const flags = styleFlags(saved.sidebarStyle);
    setThemeBuilderMode(flags.themeBuilderMode);
    setIsV2Mode(flags.isV2Mode);
    setThemeMotion(saved.motion);
    setThemeIcons(saved.iconPack);
    setPrimaryColor(saved.primaryColor);
    setSidebarBgColor(saved.sidebarBgColor);
    setSelectedFont(saved.font);
    setGradientCustomEnabled(saved.gradientCustomEnabled);
    setGradientStart(saved.gradientStart);
    setGradientEnd(saved.gradientEnd);
    setTopGradientCustomEnabled(saved.topGradientCustomEnabled);
    setTopGradientStart(saved.topGradientStart);
    setTopGradientEnd(saved.topGradientEnd);
    setLoginCustomEnabled(saved.loginCustomEnabled);
    setLoginBackground(saved.loginBackground);
    setLoginLogoUrl(saved.loginLogoUrl);
    setButtonCustomEnabled(saved.buttonCustomEnabled);
    setLayoutVersion(saved.layout);
    setLayoutKnown(saved.layoutKnown);
    setPopupEnabled(saved.popupEnabled);
    setMobileEnabled(saved.mobileEnabled);
    setMobileMenuColor(saved.mobileMenuColor);
    setMobileZoomEnabled(saved.mobileZoomEnabled);
    setTopNav(saved.topNav);
    setSidebarEdited(false);
    setHasChangedSinceApply(false);
    setSidebarModeConfirmed(false);
  };

  const refreshDelivery = async (types: Array<"css" | "js">) => {
    if (!email) return;
    const { data } = await supabase
      .from("saas_suite_users")
      .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
      .ilike("email", email.trim().toLowerCase());
    const row = data?.[0];
    if (!row) return;
    const ids = [
      ...new Set(
        [row.agency_id, row.agency_id_basic, row.agency_id_advanced, row.agency_id_elite].filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        ),
      ),
    ];
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-styles`;
    await Promise.all(
      ids.flatMap((id) =>
        types.map((type) =>
          fetch(`${base}?agency_id=${encodeURIComponent(id)}&type=${type}&force=1`, {
            cache: "no-store",
          }).catch(() => {}),
        ),
      ),
    );
  };

  const saveAll = async () => {
    if (!saved || !labels.length) return;
    const plan = filterDesignWrites(designSavePlan(saved, snapshot), accountPlan, false, purchasedBranding);
    if (plan.some((write) => write.kind === "sidebar") && sidebarWarning && !sidebarModeConfirmed) {
      toast.error("Confirm the sidebar mode note before saving.");
      return;
    }
    setSavingAll(true);
    try {
      for (const write of plan) {
        if (write.kind === "sidebar") {
          const ok = await savePart("sidebar", buildSelectedSidebar());
          if (!ok) return;
        } else if (write.kind === "colors") {
          if (!email) {
            toast.error("Please complete onboarding first.");
            return;
          }
          const { data: colorRow, error } = await supabase
            .from("saas_suite_users")
            .update({ primary_color: primaryColor, secondary_color: sidebarBgColor } as never)
            .ilike("email", email.trim().toLowerCase())
            .select("email")
            .single();
          if (error || !colorRow) {
            toast.error("Could not save your colors. Please try again.");
            return;
          }
          toast.success("Colors saved");
        } else if (write.kind === "favicon") {
          const ok = await savePart("favicon", faviconMarker(faviconUrl));
          if (!ok) return;
        } else if (write.kind === "login") {
          const bg = BACKGROUND_COLORS.find((color) => color.value === loginBackground);
          const ok = await savePart("login", write.clear ? "" : generateLoginCSS(bg?.url || ""));
          if (!ok) return;
        } else if (write.kind === "buttons") {
          const ok = await savePart("buttons", write.clear ? "" : generateButtonCSS());
          if (!ok) return;
        } else if (write.kind === "layout") {
          if (!agencyId) {
            toast.error("Please complete onboarding first.");
            return;
          }
          const { error } = await supabase.from("agency_ui_versions").upsert(
            { agency_id: agencyId, ui_version: write.value, updated_at: new Date().toISOString() },
            { onConflict: "agency_id" },
          );
          if (error) {
            toast.error("Couldn't save the layout. Please try again.");
            return;
          }
          notifyHubThemeChanged(agencyId, write.value);
          toast.success(`Layout set to ${THEME_NAMES[write.value] || "the selected layout"}`);
        } else if (write.kind === "popup") {
          if (!email) return;
          const { error } = await supabase
            .from("saas_suite_users")
            .update({ popup_enabled: write.value } as never)
            .ilike("email", email.trim().toLowerCase());
          if (error) {
            toast.error("Could not save popup settings");
            return;
          }
          toast.success(write.value ? "Popup turned on" : "Popup turned off");
        } else if (write.kind === "mobile") {
          if (!email) return;
          const { error } = await supabase
            .from("saas_suite_users")
            .update({
              mobile_branding_enabled: write.value.enabled,
              mobile_menu_color: write.value.menuColor,
              mobile_zoom_enabled: write.value.zoomEnabled,
            } as never)
            .ilike("email", email.trim().toLowerCase());
          if (error) {
            toast.error("Could not update mobile branding");
            return;
          }
          await refreshDelivery(["css", "js"]);
          toast.success(
            write.value.enabled
              ? "Mobile branding applied — refresh HighLevel on your phone"
              : "Mobile branding removed",
          );
        } else if (write.kind === "topNav") {
          if (!email) return;
          const { error } = await supabase
            .from("saas_suite_users")
            .update(write.patch as never)
            .ilike("email", email.trim().toLowerCase());
          if (error) {
            toast.error("Could not save the help widget");
            return;
          }
          await refreshDelivery(["js"]);
          toast.success("Help widget saved");
        }
      }
      // Font, icon style and animations live inside the sidebar stylesheet.
      // With no sidebar style they were not written, so keep them listed as unsaved.
      const pending = styleOnlyPendingLabels(saved, snapshot);
      if (pending.length) {
        setSaved({
          ...snapshot,
          font: saved.font,
          iconPack: saved.iconPack,
          motion: saved.motion,
        });
        toast.info(`Choose a sidebar style on the Style tab to save: ${pending.join(", ")}.`);
      } else {
        setSaved(snapshot);
      }
      setHasChangedSinceApply(false);
    } catch (error: any) {
      // Without this, a thrown error (for example a browser tab icon link that
      // is not https) stopped the save with no message at all.
      toast.error(error?.message || "Could not save your changes. Please try again.");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <>
      <DesignPageView
        loading={isLoadingBranding}
        error={brandingError}
        onRetry={() => setBrandingAttempt((attempt) => attempt + 1)}
        installed={installed}
        script={themeBuilderScript}
        onCopyScript={() => void copyThemeBuilderScript()}
        tab={tab}
        onTab={onTab}
        draft={snapshot}
        savedStyle={saved?.sidebarStyle ?? null}
        savedLayout={saved?.layoutKnown ? saved.layout : null}
        labels={labels}
        presets={presets}
        saving={isPushingToGHL || savingAll}
        saveBlocked={saveBlocked}
        sidebarWarning={sidebarWarning}
        sidebarModeConfirmed={sidebarModeConfirmed}
        onConfirmSidebar={setSidebarModeConfirmed}
        surface={surface}
        device={device}
        onSurface={setSurface}
        onDevice={setDevice}
        onPatch={onPatch}
        onDiscard={discard}
        onUndo={handleUndo}
        onSave={() => void saveAll()}
        onSavePreset={(name) => void savePreset(name)}
        onLoadPreset={(preset) => loadPresetDraft(preset)}
        onDeletePreset={(preset) => void deletePreset(preset)}
        onRemoveBranding={() => void removeBranding()}
        onOpenSimplified={() => navigate("/app/simple-onboarding")}
        onBack={onReset}
        email={email}
        widgetColors={{ primary: primaryColor, secondary: sidebarBgColor, tertiary: tertiaryColor }}
        brandingLocked={brandingLocked}
        themeLocked={themeLocked}
        upgradePlanName={minimumBrandingPlanName()}
        onUpgrade={() => setCheckoutOpen(true)}
      />
      <StripeEmbeddedCheckout plan="basic" open={checkoutOpen} onOpenChange={setCheckoutOpen} />
      <Dialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Upgrade Today</DialogTitle>
            <DialogDescription className="text-center">
              Advanced Mode is available on our premium plan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button
              onClick={() => {
                setShowUpgradePrompt(false);
                setCheckoutOpen(true);
              }}
              className="w-full"
            >
              Upgrade Now
            </Button>
            <Button onClick={() => setShowUpgradePrompt(false)} variant="outline" className="w-full">
              Maybe Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BrandingTool;
