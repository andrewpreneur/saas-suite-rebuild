import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronDown, CircleAlert, RefreshCw } from "lucide-react";
import { OnboardingData } from "../V2OnboardingWizard";
import CodeBlock from "@/components/CodeBlock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MenuLinkPicker from "@/components/highlevel/MenuLinkPicker";
import { useGhl } from "@/components/highlevel/useGhl";
import { installSnippets } from "@/lib/installSnippets";
import { popIn } from "@/lib/motion";
import { cn } from "@/lib/utils";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { StepHeading, StepSlide } from "@/components/premium/onboarding/OnboardingShell";
import { CopyField, SettingRow } from "@/components/premium/onboarding/pieces";

interface InstallCodeStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  agencyId: string | null;
  plan: string | null;
}

/** A quiet "show me how" disclosure. */
const Disclosure = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-[2.75rem] items-center gap-1.5 rounded-sm text-small font-semibold text-brand hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {label}
        <ChevronDown
          className={cn("size-4 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div key="body" variants={popIn} initial="hidden" animate="show" exit="exit">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const WhiteLabelDirections = () => (
  <Disclosure label="Where do I find Custom JS and Custom CSS in HighLevel?">
    <ol className="mt-1 list-decimal space-y-1 rounded-lg bg-muted p-4 pl-9 text-small text-muted-foreground">
      <li>Log in to HighLevel</li>
      <li>
        Go to the <strong className="text-foreground">Agency View</strong> (not a sub-account)
      </li>
      <li>
        Click <strong className="text-foreground">Settings</strong>
      </li>
      <li>
        Click <strong className="text-foreground">Company</strong>
      </li>
      <li>
        Click <strong className="text-foreground">White Label</strong>
      </li>
      <li>
        Scroll down to <strong className="text-foreground">Custom JS</strong> and{" "}
        <strong className="text-foreground">Custom CSS</strong>
      </li>
      <li>Paste each line into its box</li>
    </ol>
  </Disclosure>
);

const MenuIdHelp = () => (
  <Disclosure label="Show me where to find the menu link ID">
    <div className="mt-1 overflow-hidden rounded-lg border border-border bg-muted">
      <img
        src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/691378439bbd7d32b603fdc5.gif"
        alt="Finding the custom menu link ID in the HighLevel address bar"
        className="w-full"
        loading="lazy"
      />
    </div>
  </Disclosure>
);

const InstallCodeStep = ({ data, updateData, agencyId, plan }: InstallCodeStepProps) => {
  const isAdvanced = true; // All plans now get JS install + auto-redirect
  const [codeSubStep, setCodeSubStepRaw] = useState(1);
  // Presentation only: remember which way we moved so the slide matches.
  const subDirection = useRef(1);
  const setCodeSubStep = (step: number) => {
    subDirection.current = step >= codeSubStep ? 1 : -1;
    setCodeSubStepRaw(step);
  };
  const [pickTouched, setPickTouched] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [dynamicInstallation, setDynamicInstallation] = useState(true);
  const ghlConn = useGhl(agencyId, { menus: true });

  useEffect(() => {
    const loadDynamicSetting = async () => {
      if (!agencyId) return;
      const { data: userData } = await supabase
        .from("saas_suite_users")
        .select("dynamic_installation")
        .or(
          `agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`,
        )
        .maybeSingle();
      if (userData) {
        setDynamicInstallation(true); // The one-line CSS + JS install is the only current version.
      }
    };
    loadDynamicSetting();
  }, [agencyId]);

  // Auto-saves on field blur, toggle and step change — no manual push button.
  const pushMenuConfigToGHL = async (overrides: Partial<typeof data> = {}) => {
    const d = { ...data, ...overrides };
    if (!agencyId) {
      toast.error("No agency ID found");
      return;
    }
    setIsPushing(true);
    try {
      const { error } = await supabase.from("agency_menu_config").upsert(
        {
          agency_id: agencyId,
          menu_link_id: d.menuLinkId?.trim() || null,
          remove_launchpad: d.removeLaunchpad,
          auto_navigate_on_login: d.autoNavigateOnLogin,
        },
        { onConflict: "agency_id" },
      );
      if (error) throw error;
    } catch (error) {
      console.error("Error pushing config:", error);
      toast.error("Couldn't save your installation settings");
    } finally {
      setIsPushing(false);
    }
  };

  const generateAutoNavigateCode = () => {
    const menuId = data.menuLinkId || "INPUT-MENU-LINK-ID";

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
      const newUrl = \`\${url.origin}/v2/location/\${locationId}/\${desiredPath}\`;
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

  const generateCssCode = () => {
    const launchpadCode = data.removeLaunchpad
      ? `#sb_launchpad {\n  display: none !important;\n}\n\n`
      : "";
    const reorderCode = `/*ONBOARDING TOOL REORDER*/\n#sidebar-v2 .hl_nav-header > nav {\n  display: flex;\n  flex-direction: column;\n  align-items: stretch;\n}\n\n#sidebar-v2 .hl_nav-header > nav > a[meta="${data.menuLinkId || "INPUT-MENU-LINK-ID"}"] {\n  order: -1;\n}`;

    return launchpadCode + reorderCode;
  };

  const generateCombinedJsCode = () => {
    if (data.autoNavigateOnLogin) {
      return generateAutoNavigateCode();
    }
    return "// No JavaScript features enabled";
  };

  const { css: cssImportSnippet, js: jsScriptSnippet } = installSnippets(agencyId);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
      return false;
    }
  };

  const savingNote = (
    <p
      className="flex h-5 items-center gap-1.5 text-caption text-muted-foreground"
      aria-live="polite"
    >
      {isPushing ? (
        <>
          <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
          Saving
        </>
      ) : (
        "Changes save as you go."
      )}
    </p>
  );

  const menuIdField = (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="menuLinkId">Menu link ID</Label>
      <Input
        id="menuLinkId"
        value={data.menuLinkId}
        onChange={(e) => updateData({ menuLinkId: e.target.value })}
        onBlur={() => pushMenuConfigToGHL()}
        placeholder="e.g. custom-menu-12345"
        className="font-mono"
      />
      <p className="text-small text-muted-foreground">
        Open the menu link you just made in HighLevel. The ID is the last part of the address.
      </p>
      <MenuIdHelp />
    </div>
  );

  const toggles = (
    <div className="space-y-3">
      <SettingRow
        htmlFor="removeLaunchpad"
        title="Hide the HighLevel Launchpad"
        description="Clients land on your hub, not the default setup page."
        control={
          <Switch
            id="removeLaunchpad"
            checked={data.removeLaunchpad}
            onCheckedChange={(v) => {
              updateData({ removeLaunchpad: v });
              pushMenuConfigToGHL({ removeLaunchpad: v });
            }}
          />
        }
      />
      {isAdvanced && (
        <SettingRow
          htmlFor="autoNavigate"
          title="Open onboarding on login"
          description="Send clients straight to your hub each time they log in."
          control={
            <Switch
              id="autoNavigate"
              checked={data.autoNavigateOnLogin}
              onCheckedChange={(v) => {
                updateData({ autoNavigateOnLogin: v });
                pushMenuConfigToGHL({ autoNavigateOnLogin: v });
              }}
            />
          }
        />
      )}
    </div>
  );

  const installAt = (where: string) => (
    <p className="rounded-md bg-muted px-3 py-2 text-small text-muted-foreground">
      Paste this in <strong className="font-semibold text-foreground">{where}</strong>
    </p>
  );

  if (dynamicInstallation) {
    const needsPick = ghlConn.connected && !data.menuLinkId;
    return (
      <div>
        <StepHeading
          title="Install SaaSSuite in HighLevel"
          subtitle="Two short parts. You paste the code once, and every change you make here updates in HighLevel within 5 minutes."
        />

        <AnimatedTabs
          variant="segment"
          activeTab={String(codeSubStep)}
          onChange={(id) => setCodeSubStep(Number(id))}
          tabs={[
            { id: "1", label: "1. Choose options" },
            { id: "2", label: "2. Paste the code" },
          ]}
          className="mb-6 max-w-full [&_button]:whitespace-nowrap"
        />

        <StepSlide stepKey={codeSubStep} direction={subDirection.current}>
          {codeSubStep === 1 && (
            <div className="space-y-6">
              {ghlConn.connected ? (
                <div>
                  <MenuLinkPicker
                    menus={ghlConn.menus}
                    value={data.menuLinkId}
                    agencyId={agencyId}
                    onRefresh={() => ghlConn.reload(true)}
                    onSelect={(id) => {
                      updateData({ menuLinkId: id });
                      pushMenuConfigToGHL({ menuLinkId: id });
                    }}
                  />
                  {needsPick && pickTouched ? (
                    <p
                      className="mt-2 flex items-center gap-1.5 text-small font-medium text-destructive"
                      role="alert"
                    >
                      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                      Pick your menu link above to continue.
                    </p>
                  ) : null}
                </div>
              ) : (
                menuIdField
              )}

              {toggles}

              <div className="flex flex-wrap items-center justify-between gap-3">
                {savingNote}
                <Button
                  variant="outline"
                  onClick={() => {
                    if (needsPick) {
                      setPickTouched(true);
                      return;
                    }
                    setCodeSubStep(2);
                  }}
                >
                  Next: paste the code
                  <ArrowRight />
                </Button>
              </div>
            </div>
          )}

          {codeSubStep === 2 && (
            <div className="space-y-6">
              <div className="px-surface space-y-2 p-4 sm:p-6">
                <p className="text-body font-semibold text-foreground">1. Custom JS</p>
                {installAt("White Label → Custom JS")}
                <CopyField
                  wrap
                  value={jsScriptSnippet}
                  label="Copy Custom JS"
                  onCopy={() => copyToClipboard(jsScriptSnippet)}
                />
              </div>

              <div className="px-surface space-y-2 p-4 sm:p-6">
                <p className="text-body font-semibold text-foreground">2. Custom CSS</p>
                {installAt("White Label → Custom CSS, as the first line")}
                <CopyField
                  wrap
                  value={cssImportSnippet}
                  label="Copy Custom CSS"
                  onCopy={() => copyToClipboard(cssImportSnippet)}
                />
              </div>

              <WhiteLabelDirections />

              <Button variant="ghost" onClick={() => setCodeSubStep(1)}>
                <ArrowLeft />
                Back to options
              </Button>
            </div>
          )}
        </StepSlide>
      </div>
    );
  }

  // Legacy mode (dynamic_installation = false)
  return (
    <div>
      <StepHeading
        title="Add your code"
        subtitle="Choose your options, then paste the CSS and JavaScript into HighLevel."
      />

      <AnimatedTabs
        variant="segment"
        activeTab={String(codeSubStep)}
        onChange={(id) => setCodeSubStep(Number(id))}
        tabs={[
          { id: "1", label: "1. Options" },
          { id: "2", label: "2. Custom CSS" },
          { id: "3", label: "3. Custom JS" },
        ]}
        className="mb-6 max-w-full [&_button]:whitespace-nowrap"
      />

      <StepSlide stepKey={codeSubStep} direction={subDirection.current}>
        {codeSubStep === 1 && (
          <div className="space-y-6">
            {menuIdField}
            {toggles}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {savingNote}
              <Button
                variant="outline"
                onClick={() => {
                  pushMenuConfigToGHL();
                  setCodeSubStep(2);
                }}
              >
                Next: Custom CSS
                <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {codeSubStep === 2 && (
          <div className="space-y-4">
            {installAt("Agency level → Company → White Label → Custom CSS")}
            <CodeBlock code={generateCssCode()} language="css" maxHeight="400px" />
            <div className="flex flex-wrap justify-between gap-3">
              <Button variant="ghost" onClick={() => setCodeSubStep(1)}>
                <ArrowLeft />
                Back to options
              </Button>
              <Button variant="outline" onClick={() => setCodeSubStep(3)}>
                Next: Custom JS
                <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {codeSubStep === 3 && (
          <div className="space-y-4">
            {data.autoNavigateOnLogin ? (
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
                Nothing to paste here. Turn on "Open onboarding on login" in Options if you want it.
              </p>
            )}
            <Button variant="ghost" onClick={() => setCodeSubStep(2)}>
              <ArrowLeft />
              Back to Custom CSS
            </Button>
          </div>
        )}
      </StepSlide>
    </div>
  );
};

export default InstallCodeStep;
