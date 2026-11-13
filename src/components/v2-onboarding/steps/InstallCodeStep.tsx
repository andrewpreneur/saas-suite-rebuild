import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, Copy, Info, X } from "lucide-react";
import { OnboardingData } from "../V2OnboardingWizard";
import CodeBlock from "@/components/CodeBlock";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MenuLinkPicker from "@/components/highlevel/MenuLinkPicker";
import { useGhl } from "@/components/highlevel/useGhl";
import { installSnippets } from "@/lib/installSnippets";

interface InstallCodeStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  agencyId: string | null;
  plan: string | null;
}

const WhiteLabelDirections = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
      >
        <Info className="w-4 h-4" />
        Where do I find Custom JS & Custom CSS in HighLevel?
      </button>
      {open && (
        <div className="mt-2 relative bg-muted border border-border rounded-lg p-4 pr-8 text-sm text-foreground space-y-1">
          <button onClick={() => setOpen(false)} className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <p className="font-medium mb-2">Follow these steps:</p>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Login to HighLevel</li>
            <li>Go to the <strong className="text-foreground">Agency View</strong> (not a Sub-Account)</li>
            <li>Click <strong className="text-foreground">Settings</strong></li>
            <li>Click <strong className="text-foreground">Company</strong></li>
            <li>Click <strong className="text-foreground">White Label</strong></li>
            <li>Scroll down to <strong className="text-foreground">Custom JS</strong> & <strong className="text-foreground">Custom CSS</strong></li>
            <li>Paste each line into the corresponding box</li>
          </ol>
        </div>
      )}
    </div>
  );
};

const InstallCodeStep = ({ data, updateData, agencyId, plan }: InstallCodeStepProps) => {
  const isAdvanced = true; // All plans now get JS install + auto-redirect
  const [codeSubStep, setCodeSubStep] = useState(1);
  const [isPushing, setIsPushing] = useState(false);
  const [dynamicInstallation, setDynamicInstallation] = useState(true);
  const ghlConn = useGhl(agencyId, { menus: true });

  useEffect(() => {
    const loadDynamicSetting = async () => {
      if (!agencyId) return;
      const { data: userData } = await supabase
        .from('saas_suite_users')
        .select('dynamic_installation')
        .or(`agency_id.eq.${agencyId},agency_id_basic.eq.${agencyId},agency_id_advanced.eq.${agencyId},agency_id_elite.eq.${agencyId}`)
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
      const { error } = await supabase
        .from('agency_menu_config')
        .upsert({
          agency_id: agencyId,
          menu_link_id: d.menuLinkId?.trim() || null,
          remove_launchpad: d.removeLaunchpad,
          auto_navigate_on_login: d.autoNavigateOnLogin,
        }, { onConflict: 'agency_id' });
      if (error) throw error;
    } catch (error) {
      console.error('Error pushing config:', error);
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
      toast.success("Copied to clipboard!");
    } catch { toast.error("Failed to copy"); }
  };

  if (dynamicInstallation) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Configure & Install</h2>
          <p className="text-muted-foreground mt-2">
            Configure your features, then install the dynamic URLs in GHL once.
          </p>
        </div>

        {/* Sub-step navigation */}
        <div className="flex items-center justify-center gap-2 pb-4 border-b border-border">
          {[1, 2].map((step) => (
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
              {step < 2 && (
                <div className={`w-12 h-0.5 mx-1 ${codeSubStep > step ? 'bg-green-500' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 text-xs text-muted-foreground mb-4">
          <span className={codeSubStep === 1 ? "font-medium text-foreground" : ""}>Configure</span>
          <span className={codeSubStep === 2 ? "font-medium text-foreground" : ""}>Install URLs</span>
        </div>

        {/* Step 1: Configure features */}
        {codeSubStep === 1 && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>🚀 Dynamic mode:</strong> Configure your features below and push to GHL. Changes auto-sync within 5 minutes.
              </p>
            </div>

            {/* Tutorial GIF */}
            <div className="border rounded-lg overflow-hidden bg-muted/50">
              <img
                src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/691378439bbd7d32b603fdc5.gif"
                alt="How to add custom menu link"
                className="w-full"
              />
              <div className="p-3 text-center">
                <p className="text-sm text-muted-foreground">How to find your Custom Menu Link ID</p>
              </div>
            </div>

            {ghlConn.connected ? (
              <MenuLinkPicker
                menus={ghlConn.menus}
                value={data.menuLinkId}
                agencyId={agencyId}
                onRefresh={() => ghlConn.reload(true)}
                onSelect={(id) => { updateData({ menuLinkId: id }); pushMenuConfigToGHL({ menuLinkId: id }); }}
              />
            ) : (
            <div className="space-y-2">
              <Label>Menu Link ID</Label>
              <p className="text-sm text-muted-foreground">After creating your custom menu link, copy the ID from the URL.</p>
              <Input
                value={data.menuLinkId}
                onChange={(e) => updateData({ menuLinkId: e.target.value })}
                onBlur={() => pushMenuConfigToGHL()}
                placeholder="e.g., custom-menu-12345"
                className="font-mono"
              />
            </div>
            )}

            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div>
                <Label>Replace GHL Default Launchpad</Label>
                <p className="text-sm text-muted-foreground">Hide the HighLevel LaunchPad feature</p>
              </div>
              <Switch checked={data.removeLaunchpad} onCheckedChange={(v) => { updateData({ removeLaunchpad: v }); pushMenuConfigToGHL({ removeLaunchpad: v }); }} />
            </div>

            {isAdvanced && (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div>
                  <Label>Auto Navigate to Onboarding On Login</Label>
                  <p className="text-sm text-muted-foreground">Direct users to onboarding upon login</p>
                </div>
                <Switch checked={data.autoNavigateOnLogin} onCheckedChange={(v) => { updateData({ autoNavigateOnLogin: v }); pushMenuConfigToGHL({ autoNavigateOnLogin: v }); }} />
              </div>
            )}

            <Button onClick={() => setCodeSubStep(2)} className="w-full" size="lg" disabled={ghlConn.connected && !data.menuLinkId}>
              Next: Install URLs
            </Button>
          </div>
        )}

        {/* Step 2: Dynamic URLs */}
        {codeSubStep === 2 && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200">
                <strong>🚀 One-time setup:</strong> Install these URLs once in GHL. Any changes you make in SaaSSuite will automatically reflect within 5 minutes.
              </p>
            </div>

            <WhiteLabelDirections />

            <div className="space-y-2">
              <Label className="font-medium">1. Custom JS — Install in GHL White Label → Custom JS</Label>
              <p className="text-xs text-muted-foreground">Add this script tag in your Custom JS field:</p>
              <div className="flex items-center gap-2 bg-muted p-3 rounded border">
                <code className="text-xs flex-1 break-all font-mono">{jsScriptSnippet}</code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(jsScriptSnippet)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-medium">2. Custom CSS — Install in GHL White Label → Custom CSS</Label>
              <p className="text-xs text-muted-foreground">Add this as the first line in your Custom CSS field:</p>
              <div className="flex items-center gap-2 bg-muted p-3 rounded border">
                <code className="text-xs flex-1 break-all font-mono">{cssImportSnippet}</code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(cssImportSnippet)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setCodeSubStep(1)}>Back</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Legacy mode (dynamic_installation = false)
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Add Your Code</h2>
        <p className="text-muted-foreground mt-2">
          Configure and install custom code to enhance your HighLevel experience.
        </p>
      </div>

      {/* Sub-step navigation */}
      <div className="flex items-center justify-center gap-2 pb-4 border-b border-border">
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
              <div className={`w-12 h-0.5 mx-1 ${codeSubStep > step ? "bg-green-500" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-8 text-xs text-muted-foreground mb-4">
        <span className={codeSubStep === 1 ? "font-medium text-foreground" : ""}>Features</span>
        <span className={codeSubStep === 2 ? "font-medium text-foreground" : ""}>Custom CSS</span>
        <span className={codeSubStep === 3 ? "font-medium text-foreground" : ""}>Custom JS</span>
      </div>

      {codeSubStep === 1 && (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden bg-muted/50">
            <img src="https://storage.googleapis.com/msgsndr/T69cI1milcirIORef4Ib/media/691378439bbd7d32b603fdc5.gif" alt="How to add custom menu link" className="w-full" />
            <div className="p-3 text-center">
              <p className="text-sm text-muted-foreground">How to find your Custom Menu Link ID</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Menu Link ID</Label>
            <p className="text-sm text-muted-foreground">After creating your custom menu link, copy the ID from the URL.</p>
            <Input value={data.menuLinkId} onChange={(e) => updateData({ menuLinkId: e.target.value })} onBlur={() => pushMenuConfigToGHL()} placeholder="e.g., custom-menu-12345" className="font-mono" />
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <Label>Replace GHL Default Launchpad</Label>
              <p className="text-sm text-muted-foreground">Hide the HighLevel LaunchPad feature</p>
            </div>
            <Switch checked={data.removeLaunchpad} onCheckedChange={(v) => { updateData({ removeLaunchpad: v }); pushMenuConfigToGHL({ removeLaunchpad: v }); }} />
          </div>
          {isAdvanced && (
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div>
                <Label>Auto Navigate to Onboarding On Login</Label>
                <p className="text-sm text-muted-foreground">Direct users to onboarding upon login</p>
              </div>
              <Switch checked={data.autoNavigateOnLogin} onCheckedChange={(v) => { updateData({ autoNavigateOnLogin: v }); pushMenuConfigToGHL({ autoNavigateOnLogin: v }); }} />
            </div>
          )}
          <Button onClick={() => { pushMenuConfigToGHL(); setCodeSubStep(2); }} className="w-full">Next: Custom CSS</Button>
        </div>
      )}

      {codeSubStep === 2 && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Install at:</strong> Agency Level → Company → White Label → Custom CSS
            </p>
          </div>
          <CodeBlock code={generateCssCode()} language="css" maxHeight="400px" />
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setCodeSubStep(1)}>Back</Button>
            <Button onClick={() => setCodeSubStep(3)} className="flex-1">Next: Custom JS</Button>
          </div>
        </div>
      )}

      {codeSubStep === 3 && (
        <div className="space-y-4">
          {data.autoNavigateOnLogin ? (
            <>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Install at:</strong> Agency Level → Company → White Label → Custom JS
                </p>
              </div>
              <CodeBlock code={generateCombinedJsCode()} language="javascript" maxHeight="400px" />
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No JavaScript features are enabled. You can skip this step.</p>
            </div>
          )}
          <div className="flex gap-4">
            <Button variant="outline" onClick={() => setCodeSubStep(2)}>Back</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstallCodeStep;
