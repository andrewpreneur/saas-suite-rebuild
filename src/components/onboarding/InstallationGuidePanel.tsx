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
      toast.success("Copied to clipboard!");
    } catch (err) {
      toast.error("Failed to copy");
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
    if (isLoading || ghlConn.loading || !ghlConn.connected || ghlConn.error || ghlConn.agencyId !== agencyId) return;
    const current = resolveInstallationMenu(ghlConn.menus, menuLinkId, agencyId);
    if (current !== menuLinkId) setMenuLinkId(current);
  }, [isLoading, ghlConn.loading, ghlConn.connected, ghlConn.error, ghlConn.agencyId, ghlConn.menus, menuLinkId, agencyId]);

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

  return (
    <div className="space-y-6">
      <HowItWorksCard />
      {/* Step Navigation */}
      <div className="flex items-center gap-4">
        <Progress value={(shownStep / 3) * 100} className="flex-1" />
        <span className="text-sm font-medium">Step {shownStep} of 3</span>
      </div>

      {/* Step 1: Create Custom Menu Link */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
              1
            </div>
            <h3 className="text-lg font-semibold">Create Custom Menu Link</h3>
          </div>

          {!ghlConn.connected && (
            <>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
                <li>Go to Agency view → Settings → Custom Menu Link</li>
                <li>
                  Create a custom menu link pointing to:
                  <div className="mt-2 flex items-center gap-2 bg-muted p-3 rounded border">
                    <span className="text-xs truncate flex-1 font-mono">
                      {hubUrlFor(agencyId, "[AGENCY_ID]")}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(hubUrlFor(agencyId, "[AGENCY_ID]"))}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
                <li>Title the Menu Link "Onboarding"</li>
                <li>Click Save, then refresh the page</li>
              </ol>

              <div className="border rounded-lg overflow-hidden bg-muted/50">
                <img
                  src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/691378439bbd7d32b603fdc5.gif"
                  alt="How to find menu link ID"
                  className="w-full"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 font-medium">
                  💡 Important: After creating the menu link, save it and refresh before proceeding.
                </p>
              </div>
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
            <LoadNotice loading={ghlConn.loading} error={ghlConn.error} label="Refreshing your HighLevel menu links…" onRetry={() => void ghlConn.reload(true)} />
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
            <div className="space-y-2">
              <Label>Menu Link ID</Label>
              <Input
                value={menuLinkId}
                onChange={(e) => setMenuLinkId(e.target.value)}
                onBlur={() => {
                  if (menuLinkId.trim()) saveMenuConfig();
                }}
                placeholder="e.g., custom-menu-12345"
                className="font-mono"
              />
            </div>
          )}

          {userPlan === "ADVANCED" && (ghlConn.connected && agencyId
            ? <ConnectedPlanLinks agencyId={agencyId} />
            : <MultiPlanConnectionNotice />)}
          {userPlan === "BASIC" && ghlConn.connected && (
            <MenuLinkPicker menus={ghlConn.menus} value={menuLinkId2} agencyId={agencyId}
              onRefresh={() => ghlConn.reload(true)} startOnPick onSelect={setMenuLinkId2} />
          )}

          <Button
            onClick={() => {
              saveMenuConfig();
              setCurrentStep(3);
            }}
            disabled={!menuLinkId.trim()}
          >
            <Check className="w-4 h-4 mr-2" />
            Continue
          </Button>
          <p className="text-xs text-muted-foreground">
            Brand colors are set on Design. This install step only covers the menu link and the
            code.
          </p>
        </div>
      )}

      {/* Step 3: Configure Features / Custom Code */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
              2
            </div>
            <h3 className="text-lg font-semibold">
              {dynamicInstallation ? "Configure Features" : "Add Custom Code"}
            </h3>
          </div>

          {dynamicInstallation ? (
            /* Dynamic mode: just toggles + save */
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  <strong>🚀 Dynamic mode:</strong> Changes save automatically and sync to your GHL
                  installation.
                </p>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <Label>Replace GHL Default Launchpad</Label>
                  <p className="text-sm text-muted-foreground">
                    Hide the HighLevel LaunchPad feature
                  </p>
                </div>
                <Switch
                  checked={removeLaunchpad}
                  onCheckedChange={(v) => {
                    setRemoveLaunchpad(v);
                    saveMenuConfig({ remove_launchpad: v });
                  }}
                />
              </div>

              {isAdvancedPlan && (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                  <div>
                    <Label>Auto Navigate to Onboarding On Login</Label>
                    <p className="text-sm text-muted-foreground">
                      Direct users to onboarding upon login
                    </p>
                  </div>
                  <Switch
                    checked={autoNavigateOnLogin}
                    onCheckedChange={(v) => {
                      setAutoNavigateOnLogin(v);
                      saveMenuConfig({ auto_navigate_on_login: v });
                    }}
                  />
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() => {
                    saveMenuConfig();
                    setCurrentStep(4);
                  }}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Continue to Install URLs
                </Button>
              </div>
            </div>
          ) : (
            /* Legacy mode: sub-steps with code blocks */
            <>
              {/* Sub-step navigation */}
              <div className="flex items-center justify-center gap-2 pb-4 border-b">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <button
                      onClick={() => setCodeSubStep(step)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        codeSubStep === step
                          ? "bg-primary text-primary-foreground"
                          : codeSubStep > step
                            ? "bg-green-500 text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {codeSubStep > step ? <Check className="w-4 h-4" /> : step}
                    </button>
                    {step < 3 && (
                      <div
                        className={`w-12 h-0.5 mx-1 ${codeSubStep > step ? "bg-green-500" : "bg-muted"}`}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-8 text-xs text-muted-foreground mb-4">
                <span className={codeSubStep === 1 ? "font-medium text-foreground" : ""}>
                  Features
                </span>
                <span className={codeSubStep === 2 ? "font-medium text-foreground" : ""}>
                  Custom CSS
                </span>
                <span className={codeSubStep === 3 ? "font-medium text-foreground" : ""}>
                  Custom JS
                </span>
              </div>

              {/* Sub-step 1: Features */}
              {codeSubStep === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                    <div>
                      <Label>Replace GHL Default Launchpad</Label>
                      <p className="text-sm text-muted-foreground">
                        Hide the HighLevel LaunchPad feature
                      </p>
                    </div>
                    <Switch
                      checked={removeLaunchpad}
                      onCheckedChange={(v) => {
                        setRemoveLaunchpad(v);
                        saveMenuConfig({ remove_launchpad: v });
                      }}
                    />
                  </div>

                  {isAdvancedPlan && (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                      <div>
                        <Label>Auto Navigate to Onboarding On Login</Label>
                        <p className="text-sm text-muted-foreground">
                          Direct users to onboarding upon login
                        </p>
                      </div>
                      <Switch
                        checked={autoNavigateOnLogin}
                        onCheckedChange={(v) => {
                          setAutoNavigateOnLogin(v);
                          saveMenuConfig({ auto_navigate_on_login: v });
                        }}
                      />
                    </div>
                  )}

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setCurrentStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setCodeSubStep(2)}>Next: Custom CSS</Button>
                  </div>
                </div>
              )}

              {/* Sub-step 2: Custom CSS */}
              {codeSubStep === 2 && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">
                      <strong>Install at:</strong> Agency Level → Company → White Label → Custom CSS
                    </p>
                  </div>
                  <CodeBlock code={generateCssCode()} language="css" maxHeight="400px" />

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setCodeSubStep(1)}>
                      Back
                    </Button>
                    <Button onClick={() => setCodeSubStep(3)}>Next: Custom JS</Button>
                  </div>
                </div>
              )}

              {/* Sub-step 3: Custom JS */}
              {codeSubStep === 3 && (
                <div className="space-y-4">
                  {autoNavigateOnLogin ? (
                    <>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-sm text-amber-800">
                          <strong>Install at:</strong> Agency Level → Company → White Label → Custom
                          JS
                        </p>
                      </div>
                      <CodeBlock
                        code={generateCombinedJsCode()}
                        language="javascript"
                        maxHeight="400px"
                      />
                    </>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No JavaScript features are enabled. You can skip this step.</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setCodeSubStep(2)}>
                      Back
                    </Button>
                    <Button onClick={() => setCurrentStep(4)}>
                      <Check className="w-4 h-4 mr-2" />
                      Continue to Dynamic Install
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Step 4: Dynamic Install URLs */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
              3
            </div>
            <h3 className="text-lg font-semibold">Dynamic Install (Recommended)</h3>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <strong>🚀 One-time setup:</strong> Install these URLs once in GHL. Any changes you
              make in SaaSSuite will automatically reflect within 5 minutes — no need to update code
              again!
            </p>
          </div>

          {!configSaved && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                <strong>⚠️ Save your configuration first</strong> before installing the URLs below.
              </p>
            </div>
          )}

          {/* JS URL - Always show for all plans */}
          <div className="space-y-2">
            <Label className="font-medium">
              1. Custom JS — Install in GHL White Label → Custom JS
            </Label>
            <p className="text-xs text-muted-foreground">
              Add this script tag in your Custom JS field:
            </p>
            <div className="flex items-center gap-2 bg-muted p-3 rounded border">
              <code className="text-xs flex-1 break-all font-mono">{jsScriptSnippet}</code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(jsScriptSnippet)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-medium">
              2. Custom CSS — Install in GHL White Label → Custom CSS
            </Label>
            <p className="text-xs text-muted-foreground">
              Add this as the first line in your Custom CSS field:
            </p>
            <div className="flex items-center gap-2 bg-muted p-3 rounded border">
              <code className="text-xs flex-1 break-all font-mono">{cssImportSnippet}</code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(cssImportSnippet)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-muted/50 border rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Current Configuration:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                • Menu Link ID: <span className="font-mono">{menuLinkId || "Not set"}</span>
              </li>
              {supportsSecondLink && (
                <li>
                  • Second Menu Link ID:{" "}
                  <span className="font-mono">{menuLinkId2 || "Not set"}</span>
                </li>
              )}
              <li>• Hide LaunchPad: {removeLaunchpad ? "✅ Yes" : "❌ No"}</li>
              <li>• Auto-Navigate on Login: {autoNavigateOnLogin ? "✅ Yes" : "❌ No"}</li>
              <li>• Brand colors are set on the Design page.</li>
            </ul>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setCurrentStep(3)}>
              Back
            </Button>
            <Button
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
              <Check className="w-4 h-4 mr-2" />
              Complete Setup
            </Button>
          </div>
        </div>
      )}

      {/* Completion overlay: loading bar → animated green checkmark */}
      {completePhase !== "idle" && !completeDismissed && (
        <div className="relative border rounded-lg p-8 text-center space-y-4 bg-background">
          <button
            onClick={() => setCompleteDismissed(true)}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {completePhase === "loading" ? (
            <div className="space-y-4 py-4 animate-fade-in">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="font-medium">Loading your CSS and JS…</p>
              <div className="max-w-xs mx-auto">
                <Progress
                  value={100}
                  className="h-2 [&>div]:transition-all [&>div]:duration-[2400ms]"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2 animate-scale-in">
              <CheckCircle2 className="w-14 h-14 mx-auto text-green-500 animate-scale-in" />
              <p className="text-lg font-semibold text-green-700">Your menu link has been saved!</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Everything is set up. It may take <strong>5–10 minutes</strong> for the changes to
                update inside HighLevel — feel free to continue with your day.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InstallationGuidePanel;
