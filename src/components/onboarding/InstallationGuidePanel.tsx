import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Copy,
  Check,
  Info,
  Upload,
  Palette,
  BookOpen,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import CodeBlock from "@/components/CodeBlock";
import { installSnippets } from "@/lib/installSnippets";
import {
  extractColorsFromImage,
  isValidHexColor,
  normalizeHexColor,
} from "@/utils/colorExtraction";
import { useHubUrls } from "@/lib/hubUrl";
import HowItWorksCard from "./HowItWorksCard";
import { ArrowLeft, ArrowRight, TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";
import { pageEnter } from "@/lib/motion";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { TextShimmer } from "@/components/premium/21st/text-shimmer";
import { StepRail } from "@/components/premium/onboarding/OnboardingShell";
import { CopyField, SettingRow, SuccessMark } from "@/components/premium/onboarding/pieces";
import MenuLinkPicker from "@/components/highlevel/MenuLinkPicker";
import CreateMenuLinkWidget from "@/components/highlevel/CreateMenuLinkWidget";
import { useGhl } from "@/components/highlevel/useGhl";
import { AssignWebhookGuide } from "@/components/highlevel/AssignSubAccountPanel";
import { resolveInstallationMenu } from "@/lib/installationMenu";
import ConnectedPlanLinks from "@/components/highlevel/ConnectedPlanLinks";
import MultiPlanConnectionNotice from "@/components/highlevel/MultiPlanConnectionNotice";

interface InstallationGuidePanelProps {
  standalone?: boolean;
}

const InstallationGuidePanel = ({ standalone = false }: InstallationGuidePanelProps) => {
  const { email, plan } = useUser();
  const userPlan = plan || "ADVANCED";
  const isAdvancedPlan = true; // All plans now get JS install + auto-redirect
  const supportsSecondLink = userPlan === "BASIC" || userPlan === "ADVANCED";
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const hubUrlFor = useHubUrls([agencyId]);
  const [colors, setColors] = useState({
    primary: "#3b82f6",
    secondary: "#10b981",
    tertiary: "#f59e0b",
  });
  const [tempColors, setTempColors] = useState({
    primary: "",
    secondary: "",
    tertiary: "",
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [menuLinkId, setMenuLinkId] = useState("");
  const [menuLinkId2, setMenuLinkId2] = useState("");
  const [removeLaunchpad, setRemoveLaunchpad] = useState(true);
  const [autoNavigateOnLogin, setAutoNavigateOnLogin] = useState(isAdvancedPlan);
  const [codeSubStep, setCodeSubStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [dynamicInstallation, setDynamicInstallation] = useState(true);
  const [completePhase, setCompletePhase] = useState<"idle" | "loading" | "done">("idle");
  const [completeDismissed, setCompleteDismissed] = useState(false);
  const ghlConn = useGhl(agencyId, { menus: true });

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
        const { data: userData } = await supabase
          .from("saas_suite_users")
          .select("agency_id, primary_color, secondary_color, tertiary_color, dynamic_installation")
          .ilike("email", email.trim().toLowerCase())
          .maybeSingle();

        if (userData) {
          setAgencyId(userData.agency_id);
          setDynamicInstallation(true); // The one-line CSS + JS install is the only current version.
          const loadedColors = {
            primary: userData.primary_color || "#3b82f6",
            secondary: userData.secondary_color || "#10b981",
            tertiary: userData.tertiary_color || "#f59e0b",
          };
          setColors(loadedColors);
          setTempColors(loadedColors);

          // Load menu config if exists
          if (userData.agency_id) {
            const { data: menuData } = await supabase
              .from("agency_menu_config")
              .select("*")
              .eq("agency_id", userData.agency_id)
              .maybeSingle();

            if (menuData) {
              setMenuLinkId(menuData.menu_link_id || "");
              setMenuLinkId2((menuData as any).menu_link_id_2 || "");
              setRemoveLaunchpad(menuData.remove_launchpad ?? true);
              setAutoNavigateOnLogin(menuData.auto_navigate_on_login ?? isAdvancedPlan);
              setConfigSaved(true);
            }
          }
        }
        if (alive) setLoadError(null);
      } catch (error) {
        console.error("Error loading data:", error);
        if (alive) setLoadError(loadErrorText(error, "Couldn't load the installation guide."));
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch (err) {
      toast.error("Could not copy. Select the text and copy it by hand.");
      return false;
    }
  };

  const handleColorInputChange = (color: "primary" | "secondary" | "tertiary", value: string) => {
    setTempColors((prev) => ({ ...prev, [color]: value }));
    if (isValidHexColor(value)) {
      setColors((prev) => ({ ...prev, [color]: normalizeHexColor(value) }));
    }
  };

  const handleColorPickerChange = (color: "primary" | "secondary" | "tertiary", value: string) => {
    setTempColors((prev) => ({ ...prev, [color]: value }));
    setColors((prev) => ({ ...prev, [color]: value }));
  };

  const handleImageUpload = async (file: File) => {
    try {
      const extractedColors = await extractColorsFromImage(file);
      const colorObj = {
        primary: extractedColors[0] || "#3b82f6",
        secondary: extractedColors[1] || "#10b981",
        tertiary: extractedColors[2] || "#f59e0b",
      };
      setColors(colorObj);
      setTempColors(colorObj);
      toast.success("Colors extracted from image!");
    } catch (error) {
      toast.error("Failed to extract colors from image");
    }
  };

  const saveColors = async (silent = false) => {
    if (!email) return;
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc("update_user_colors_and_complete", {
        user_email: email,
        primary_color: colors.primary,
        secondary_color: colors.secondary,
        tertiary_color: colors.tertiary,
      });

      if (error) throw error;
      if (!silent) toast.success("Colors saved!");
    } catch (error) {
      console.error("Error saving colors:", error);
      toast.error("Failed to save colors");
    } finally {
      setIsSaving(false);
    }
  };

  // Save brand colors automatically as they're picked, typed or extracted.
  const colorsLoadedRef = useRef(false);
  useEffect(() => {
    if (isLoading || !email) return;
    if (!colorsLoadedRef.current) {
      colorsLoadedRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      saveColors(true);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors.primary, colors.secondary, colors.tertiary]);

  // Auto-saves on every toggle, field change/paste and step change — no manual save button.
  const saveMenuConfig = async (overrides: Record<string, unknown> = {}, silent = false) => {
    if (!agencyId) {
      if (!silent) toast.error("No agency ID found");
      return;
    }
    setIsSavingConfig(true);
    try {
      const configData = {
        agency_id: agencyId,
        menu_link_id: menuLinkId.trim() || null,
        menu_link_id_2: supportsSecondLink ? menuLinkId2.trim() || null : null,
        remove_launchpad: removeLaunchpad,
        auto_navigate_on_login: autoNavigateOnLogin,
        ...overrides,
      };

      const { error } = await supabase
        .from("agency_menu_config")
        .upsert(configData as any, { onConflict: "agency_id" });

      if (error) throw error;
      setConfigSaved(true);
    } catch (error) {
      console.error("Error saving menu config:", error);
      toast.error("Couldn't save your installation settings");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Save the menu link IDs immediately as they're typed or pasted.
  const menuIdsLoadedRef = useRef(false);
  useEffect(() => {
    if (isLoading || !agencyId) return;
    if (!menuIdsLoadedRef.current) {
      menuIdsLoadedRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      saveMenuConfig({}, true);
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuLinkId, menuLinkId2]);

  useEffect(() => {
    if (
      isLoading ||
      ghlConn.loading ||
      !ghlConn.connected ||
      ghlConn.error ||
      ghlConn.agencyId !== agencyId
    )
      return;
    const current = resolveInstallationMenu(ghlConn.menus, menuLinkId, agencyId);
    if (current !== menuLinkId) setMenuLinkId(current);
  }, [
    isLoading,
    ghlConn.loading,
    ghlConn.connected,
    ghlConn.error,
    ghlConn.agencyId,
    ghlConn.menus,
    menuLinkId,
    agencyId,
  ]);

  const { css: cssImportSnippet, js: jsScriptSnippet } = installSnippets(agencyId);

  const hexToRgba = (hex: string, alpha: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
    }
    return `rgba(245,197,66,${alpha})`;
  };

  // Generate auto-navigate JS code
  const generateAutoNavigateCode = () => {
    const menuId = menuLinkId || "INPUT-MENU-LINK-ID";

    return `<script>
(function() {
  const desiredPath = 'custom-menu-link/${menuId}'; // your custom menu link ID
  const REDIRECT_KEY = 'ghl_initial_redirect_done';

  function maybeRedirect() {
    // Skip if we've already redirected during this session
    if (sessionStorage.getItem(REDIRECT_KEY) === 'true') return;

    const url = new URL(window.location.href);
    const match = url.pathname.match(/\\/location\\/([^/]+)\\/(dashboard|launchpad)/i);
    if (match && !url.pathname.includes(desiredPath)) {
      const locationId = match[1];
      const newUrl = \\\`\\\${url.origin}/v2/location/\\\${locationId}/\\\${desiredPath}\\\`;
      sessionStorage.setItem(REDIRECT_KEY, 'true');
      window.location.replace(newUrl);
    }
  }

  document.addEventListener('DOMContentLoaded', maybeRedirect);
  const observer = new MutationObserver(maybeRedirect);
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(maybeRedirect, 2000);
})();
</script>`;
  };

  // Generate combined JS code based on toggles
  const generateCombinedJsCode = () => {
    if (autoNavigateOnLogin) {
      return generateAutoNavigateCode();
    }
    return "// No JavaScript features enabled";
  };

  const generateCssCode = () => {
    const launchpadCode = removeLaunchpad
      ? `#sb_launchpad {\n  display: none !important;\n}\n\n`
      : "";
    const reorderCode = `/*ONBOARDING TOOL REORDER*/\n#sidebar-v2 .hl_nav-header > nav {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n}\n\n#sidebar-v2 .hl_nav-header > nav > a[meta="${menuLinkId || "INPUT-MENU-LINK-ID"}"] {\n  order: -1;\n}`;
    const secondReorderCode =
      supportsSecondLink && menuLinkId2.trim()
        ? `\n\n/*ONBOARDING TOOL REORDER (SECOND MENU LINK)*/\n#sidebar-v2 .hl_nav-header > nav > a[meta="${menuLinkId2.trim()}"] {\n  order: -1;\n}`
        : "";

    return launchpadCode + reorderCode + secondReorderCode;
  };

  if (loadError || isLoading) {
    return (
      <LoadNotice
        loading={isLoading}
        error={loadError}
        label="Loading installation guide…"
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  const shownStep = currentStep <= 1 ? 1 : currentStep === 3 ? 2 : 3;

  const stepTitle = (text: string, hint?: string) => (
    <div>
      <h3 className="text-h4 text-foreground">{text}</h3>
      {hint ? <p className="mt-1 text-small text-muted-foreground">{hint}</p> : null}
    </div>
  );

  const installAt = (where: string) => (
    <p className="rounded-md bg-muted px-3 py-2 text-small text-muted-foreground">
      Paste this in <strong className="font-semibold text-foreground">{where}</strong>
    </p>
  );

  const featureToggles = (
    <div className="space-y-3">
      <SettingRow
        htmlFor="guide-remove-launchpad"
        title="Hide the HighLevel Launchpad"
        description="Clients land on your hub, not the default setup page."
        control={
          <Switch
            id="guide-remove-launchpad"
            checked={removeLaunchpad}
            onCheckedChange={(v) => {
              setRemoveLaunchpad(v);
              saveMenuConfig({ remove_launchpad: v });
            }}
          />
        }
      />
      {isAdvancedPlan && (
        <SettingRow
          htmlFor="guide-auto-navigate"
          title="Open onboarding on login"
          description="Send clients straight to your hub each time they log in."
          control={
            <Switch
              id="guide-auto-navigate"
              checked={autoNavigateOnLogin}
              onCheckedChange={(v) => {
                setAutoNavigateOnLogin(v);
                saveMenuConfig({ auto_navigate_on_login: v });
              }}
            />
          }
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <HowItWorksCard />
      {/* Step Navigation */}
      <StepRail
        index={shownStep - 1}
        labels={["Menu link", "Options", "Paste the code"]}
        onStepClick={(i) => setCurrentStep(i === 0 ? 1 : 3)}
      />

      {/* Step 1: Create Custom Menu Link */}
      {currentStep === 1 && (
        <motion.div
          key="s1"
          variants={pageEnter}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {stepTitle(
            "Create your custom menu link",
            "This is the link clients click inside HighLevel to open your hub.",
          )}

          {!ghlConn.connected && (
            <>
              <ol className="list-decimal space-y-2 pl-5 text-body text-muted-foreground">
                <li>In HighLevel, go to Agency view → Settings → Custom Menu Link</li>
                <li>
                  Create a custom menu link that points to:
                  <CopyField
                    className="mt-2"
                    value={hubUrlFor(agencyId, "[AGENCY_ID]")}
                    label="Copy your hub link"
                    onCopy={() => copyToClipboard(hubUrlFor(agencyId, "[AGENCY_ID]"))}
                  />
                </li>
                <li>Name the menu link "Onboarding"</li>
                <li>Save, then refresh the page</li>
              </ol>

              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                <img
                  src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/691378439bbd7d32b603fdc5.gif"
                  alt="How to find menu link ID"
                  className="w-full"
                  loading="lazy"
                />
              </div>

              <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-small text-foreground">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                After you create the menu link, save it and refresh HighLevel before you continue.
              </p>
            </>
          )}

          <AssignWebhookGuide
            agencyId={agencyId}
            title="Using a custom onboarding plan alongside hidden menu links? Use this"
          />

          {ghlConn.connected && (
            <CreateMenuLinkWidget
              agencyId={agencyId}
              defaultUrl={agencyId ? hubUrlFor(agencyId, "") : ""}
              onCreated={(id) => {
                setMenuLinkId(id);
                void ghlConn.reload(true);
              }}
            />
          )}

          {ghlConn.loading || ghlConn.error ? (
            <LoadNotice
              loading={ghlConn.loading}
              error={ghlConn.error}
              label="Refreshing your HighLevel menu links…"
              onRetry={() => void ghlConn.reload(true)}
            />
          ) : ghlConn.connected ? (
            <MenuLinkPicker
              menus={ghlConn.menus}
              value={menuLinkId}
              agencyId={agencyId}
              onRefresh={() => ghlConn.reload(true)}
              startOnPick
              onSelect={(id) => setMenuLinkId(id)}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="guide-menu-link-id">Menu link ID</Label>
              <Input
                id="guide-menu-link-id"
                value={menuLinkId}
                onChange={(e) => setMenuLinkId(e.target.value)}
                onBlur={() => {
                  if (menuLinkId.trim()) saveMenuConfig();
                }}
                placeholder="e.g. custom-menu-12345"
                className="font-mono"
              />
              <p className="text-small text-muted-foreground">
                Open the menu link in HighLevel. The ID is the last part of the address.
              </p>
            </div>
          )}

          {userPlan === "ADVANCED" &&
            (ghlConn.connected && agencyId ? (
              <ConnectedPlanLinks agencyId={agencyId} />
            ) : (
              <MultiPlanConnectionNotice />
            ))}
          {userPlan === "BASIC" && ghlConn.connected && (
            <MenuLinkPicker
              menus={ghlConn.menus}
              value={menuLinkId2}
              agencyId={agencyId}
              onRefresh={() => ghlConn.reload(true)}
              startOnPick
              onSelect={setMenuLinkId2}
            />
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-small text-muted-foreground">
              {menuLinkId.trim()
                ? "Brand colors are set on Design. This guide only covers the menu link and the code."
                : "Add your menu link ID to continue."}
            </p>
            <Button
              variant="accent"
              onClick={() => {
                saveMenuConfig();
                setCurrentStep(3);
              }}
              disabled={!menuLinkId.trim()}
            >
              Continue
              <ArrowRight />
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Configure Features / Custom Code */}
      {currentStep === 3 && (
        <motion.div
          key="s3"
          variants={pageEnter}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {stepTitle(
            dynamicInstallation ? "Choose your options" : "Add custom code",
            dynamicInstallation ? "Changes save on their own and sync to HighLevel." : undefined,
          )}

          {dynamicInstallation ? (
            /* Dynamic mode: just toggles + save */
            <div className="space-y-6">
              {featureToggles}

              <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
                <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft />
                  Back
                </Button>
                <Button
                  variant="accent"
                  onClick={() => {
                    saveMenuConfig();
                    setCurrentStep(4);
                  }}
                >
                  Continue to the code
                  <ArrowRight />
                </Button>
              </div>
            </div>
          ) : (
            /* Legacy mode: sub-steps with code blocks */
            <>
              <AnimatedTabs
                variant="segment"
                activeTab={String(codeSubStep)}
                onChange={(id) => setCodeSubStep(Number(id))}
                tabs={[
                  { id: "1", label: "1. Options" },
                  { id: "2", label: "2. Custom CSS" },
                  { id: "3", label: "3. Custom JS" },
                ]}
                className="max-w-full [&_button]:whitespace-nowrap"
              />

              {/* Sub-step 1: Features */}
              {codeSubStep === 1 && (
                <div className="space-y-4">
                  {featureToggles}
                  <div className="flex flex-wrap justify-between gap-3">
                    <Button variant="ghost" onClick={() => setCurrentStep(1)}>
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button variant="outline" onClick={() => setCodeSubStep(2)}>
                      Next: Custom CSS
                      <ArrowRight />
                    </Button>
                  </div>
                </div>
              )}

              {/* Sub-step 2: Custom CSS */}
              {codeSubStep === 2 && (
                <div className="space-y-4">
                  {installAt("Agency level → Company → White Label → Custom CSS")}
                  <CodeBlock code={generateCssCode()} language="css" maxHeight="400px" />

                  <div className="flex flex-wrap justify-between gap-3">
                    <Button variant="ghost" onClick={() => setCodeSubStep(1)}>
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button variant="outline" onClick={() => setCodeSubStep(3)}>
                      Next: Custom JS
                      <ArrowRight />
                    </Button>
                  </div>
                </div>
              )}

              {/* Sub-step 3: Custom JS */}
              {codeSubStep === 3 && (
                <div className="space-y-4">
                  {autoNavigateOnLogin ? (
                    <>
                      {installAt("Agency level → Company → White Label → Custom JS")}
                      <CodeBlock
                        code={generateCombinedJsCode()}
                        language="javascript"
                        maxHeight="400px"
                      />
                    </>
                  ) : (
                    <p className="rounded-lg bg-muted p-6 text-center text-body text-muted-foreground">
                      Nothing to paste here. You can skip this part.
                    </p>
                  )}

                  <div className="flex flex-wrap justify-between gap-3">
                    <Button variant="ghost" onClick={() => setCodeSubStep(2)}>
                      <ArrowLeft />
                      Back
                    </Button>
                    <Button variant="accent" onClick={() => setCurrentStep(4)}>
                      Continue to the one-time install
                      <ArrowRight />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* Step 4: Dynamic Install URLs */}
      {currentStep === 4 && (
        <motion.div
          key="s4"
          variants={pageEnter}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          {stepTitle(
            "Paste two lines into HighLevel",
            "You do this once. After that, every change you make in SaaSSuite shows up in HighLevel within 5 minutes.",
          )}

          {!configSaved && (
            <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-small text-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <span>
                <strong className="font-semibold">Save your options first.</strong> Go back one
                step, then return here.
              </span>
            </p>
          )}

          {/* JS URL - Always show for all plans */}
          <div className="space-y-2">
            <p className="text-body font-semibold text-foreground">1. Custom JS</p>
            {installAt("White Label → Custom JS")}
            <CopyField
              wrap
              value={jsScriptSnippet}
              label="Copy Custom JS"
              onCopy={() => copyToClipboard(jsScriptSnippet)}
            />
          </div>

          <div className="space-y-2">
            <p className="text-body font-semibold text-foreground">2. Custom CSS</p>
            {installAt("White Label → Custom CSS, as the first line")}
            <CopyField
              wrap
              value={cssImportSnippet}
              label="Copy Custom CSS"
              onCopy={() => copyToClipboard(cssImportSnippet)}
            />
          </div>

          <div className="rounded-lg bg-muted p-4">
            <p className="px-eyebrow mb-2">Your current setup</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
              <dt className="text-muted-foreground">Menu link ID</dt>
              <dd className="truncate font-mono text-foreground">{menuLinkId || "Not set"}</dd>
              {supportsSecondLink && (
                <>
                  <dt className="text-muted-foreground">Second menu link ID</dt>
                  <dd className="truncate font-mono text-foreground">{menuLinkId2 || "Not set"}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Hide Launchpad</dt>
              <dd className="text-foreground">{removeLaunchpad ? "On" : "Off"}</dd>
              <dt className="text-muted-foreground">Open onboarding on login</dt>
              <dd className="text-foreground">{autoNavigateOnLogin ? "On" : "Off"}</dd>
              <dt className="text-muted-foreground">Brand colors</dt>
              <dd className="text-foreground">Set on the Design page</dd>
            </dl>
          </div>

          <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-4">
            <Button variant="ghost" onClick={() => setCurrentStep(3)}>
              <ArrowLeft />
              Back
            </Button>
            <Button
              variant="accent"
              onClick={async () => {
                setCompletePhase("loading");
                setCompleteDismissed(false);
                // Final save of everything, then show the loading bar briefly.
                await saveMenuConfig({}, true);
                if (email) {
                  await supabase.rpc("record_install_confirmed", { user_email: email });
                }
                setTimeout(() => setCompletePhase("done"), 2500);
              }}
            >
              <Check />
              Finish install
            </Button>
          </div>
        </motion.div>
      )}

      {/* Completion: shimmer while saving, then a one-shot tick */}
      {completePhase !== "idle" && !completeDismissed && (
        <motion.div
          variants={pageEnter}
          initial="hidden"
          animate="show"
          role="status"
          className="px-surface px-brand-wash relative p-8 text-center"
        >
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCompleteDismissed(true)}
            aria-label="Close"
            className="absolute right-3 top-3"
          >
            <X />
          </Button>

          {completePhase === "loading" ? (
            <div className="space-y-4 py-4">
              <Loader2 className="mx-auto size-8 animate-spin text-brand" />
              <TextShimmer className="text-body font-medium">
                Saving your install settings
              </TextShimmer>
              <div className="mx-auto max-w-xs">
                <Progress
                  value={100}
                  className="h-2 [&>div]:transition-all [&>div]:duration-[2400ms]"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-2">
              <SuccessMark size={48} className="bg-card bg-none" />
              <p className="text-h4 text-foreground">Your install is saved</p>
              <p className="mx-auto max-w-md text-small text-muted-foreground">
                Everything is set up. HighLevel can take{" "}
                <strong className="text-foreground">5 to 10 minutes</strong> to show the changes, so
                carry on with your day.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default InstallationGuidePanel;
