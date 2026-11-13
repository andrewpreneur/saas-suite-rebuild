import MenuAutomationPanel from "@/components/highlevel/MenuAutomationPanel";
import SubAccountPicker from "@/components/highlevel/SubAccountPicker";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, ArrowRight, RefreshCw, Brain, MousePointer, ChevronLeft, Check, Trash2, Copy, Pause, Play, Pencil, CheckCircle, X, AlertTriangle, ExternalLink, Zap, Webhook, ChevronDown, ChevronRight, FolderOpen, Folder, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { SectionCard } from "@/components/premium/SectionCard";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { toast } from "sonner";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import CodeBlock from "./CodeBlock";
import { MenuRemovalVideoDialog } from "@/components/copilot-workspace/MenuRemovalVideo";
import { useNavigate } from "react-router-dom";
import { SETTINGS_NAV_LINKS } from "@/components/highlevel/settingsNavLinks";
import { SitesTopNavOptions } from "@/components/highlevel/SitesTopNavOptions";
import { isSitesTopNavPreset, SITES_TOP_NAV_ITEMS } from "@/lib/sitesTopNav";

interface Feature {
  id: string;
  name: string;
  tabId: string;
  description: string;
  recommended: boolean;
}

interface MenuLinkRule {
  id: string;
  agency_id: string;
  sub_account_id: string | null;
  hidden_links: string[];
  is_active: boolean;
  created_at: string;
  preset_name: string | null;
}

interface StreamlineToolProps {
  highlevelFeatures: Feature[];
  onReset: () => void;
}

const StreamlineTool = ({
  highlevelFeatures,
  onReset
}: StreamlineToolProps) => {
  const { email } = useUser();
  const navigate = useNavigate();
  const [trainingVideoOpen, setTrainingVideoOpen] = useState(false);
  const [dynamicInstallation, setDynamicInstallation] = useState(true);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Dynamic mode state
  const [selectedLinks, setSelectedLinks] = useState<string[]>([]);
  const [isSubAccountSpecific, setIsSubAccountSpecific] = useState(false);
  const [subAccountId, setSubAccountId] = useState("");
  const [subAccountIds, setSubAccountIds] = useState<string[]>([]);
  const [rules, setRules] = useState<MenuLinkRule[]>([]);
  const [savedSubAccounts, setSavedSubAccounts] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [editingRule, setEditingRule] = useState<MenuLinkRule | null>(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyTarget, setCopyTarget] = useState<MenuLinkRule | null>(null);
  const [copyMode, setCopyMode] = useState<"all" | "specific">("all");
  const [copySubAccountId, setCopySubAccountId] = useState("");
  const [presetName, setPresetName] = useState("");
  const [navTab, setNavTab] = useState<"main" | "settings">("main");
  const [automationPreset, setAutomationPreset] = useState("");
  const [openPresets, setOpenPresets] = useState<Set<string>>(new Set());

  // Legacy mode state
  const [workflowType, setWorkflowType] = useState<"ai" | "manual" | null>(null);
  const [businessDescription, setBusinessDescription] = useState("");
  const [suggestions, setSuggestions] = useState<Feature[]>([]);
  const [includedFeatures, setIncludedFeatures] = useState<string[]>([]);
  const [removedFeatures, setRemovedFeatures] = useState<string[]>([]);
  const [generatedCSS, setGeneratedCSS] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [legacyIsSubAccountSpecific, setLegacyIsSubAccountSpecific] = useState(false);
  const [legacySubAccountId, setLegacySubAccountId] = useState("");

  // Load user settings
  useEffect(() => {
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setIsLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    const loadSettings = async () => {
      if (!email) {
        stop();
        setIsLoading(false);
        setLoadError(null);
        return;
      }
      try {
        const { data } = await supabase
          .from('saas_suite_users')
          .select('dynamic_installation, agency_id')
          .ilike('email', email)
          .maybeSingle();
        if (data) {
          setDynamicInstallation(true); // Always the current dynamic install.
          setAgencyId((data as any).agency_id || null);
        }
        if (alive) setLoadError(null);
      } catch (e) {
        console.error('Error loading settings:', e);
        if (alive) setLoadError(loadErrorText(e, "Couldn't load menu link removal."));
      } finally {
        stop();
        if (alive) setIsLoading(false);
      }
    };
    loadSettings();
    return () => {
      alive = false;
      stop();
    };
  }, [email, loadAttempt]);

  // Load rules when dynamic mode
  useEffect(() => {
    if (dynamicInstallation && agencyId) {
      loadRules();
    }
  }, [dynamicInstallation, agencyId]);

  const loadRules = async () => {
    if (!agencyId) return;
    try {
      const { data, error } = await supabase
        .from('menu_link_rules')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const typed = (data || []).map((r: any) => ({
        ...r,
        hidden_links: Array.isArray(r.hidden_links) ? r.hidden_links : [],
        preset_name: r.preset_name || null,
      })) as MenuLinkRule[];
      setRules(typed);
      // Extract unique sub account IDs
      const ids = typed
        .map(r => r.sub_account_id)
        .filter((id): id is string => !!id);
      setSavedSubAccounts([...new Set(ids)]);
    } catch (e) {
      console.error('Error loading rules:', e);
    }
  };

  const getFeatureName = (tabId: string) => {
    const f = highlevelFeatures.find(f => f.tabId === tabId);
    if (f) return f.name;
    const sf = SETTINGS_NAV_LINKS.find(f => f.tabId === tabId);
    if (sf) return `Settings: ${sf.name}`;
    const site = SITES_TOP_NAV_ITEMS.find(item => item.id === tabId);
    return site ? site.label : tabId;
  };

  const toggleLink = (tabId: string) => {
    setSelectedLinks(prev =>
      prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]
    );
  };

  const applyRules = async () => {
    if (selectedLinks.length === 0) {
      toast.error("Please select at least one menu link to remove");
      return;
    }
    if (!presetName.trim()) {
      toast.error("Please enter a preset name");
      return;
    }
    if (isSubAccountSpecific && !editingRule && subAccountIds.length === 0 && !subAccountId.trim()) {
      toast.error("Please pick at least one sub-account");
      return;
    }
    if (isSubAccountSpecific && editingRule && !subAccountId.trim()) {
      toast.error("Please enter a Sub Account ID");
      return;
    }
    if (!agencyId) {
      toast.error("No agency found. Please complete onboarding first.");
      return;
    }
    setIsApplying(true);
    try {
      const subId = isSubAccountSpecific ? subAccountId.trim() : null;

      if (editingRule) {
        // Update existing rule
        const { error } = await supabase
          .from('menu_link_rules')
          .update({
            hidden_links: selectedLinks as any,
            sub_account_id: subId,
            preset_name: presetName.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingRule.id);
        if (error) throw error;
        toast.success("Menu link rule updated! Changes reflect in GHL within 5 minutes.");
        setEditingRule(null);
      } else if (isSubAccountSpecific && subAccountIds.length > 0) {
        // Insert one rule per picked sub-account
        const rows = subAccountIds.map((id) => ({
          agency_id: agencyId,
          sub_account_id: id,
          hidden_links: selectedLinks as any,
          preset_name: presetName.trim() || null,
        }));
        const { error } = await supabase.from('menu_link_rules').insert(rows);
        if (error) throw error;
        toast.success(`Applied to ${rows.length} sub-account${rows.length > 1 ? 's' : ''}! Changes reflect in GHL within 5 minutes.`);
      } else {
        // Insert new rule
        const { error } = await supabase
          .from('menu_link_rules')
          .insert({
            agency_id: agencyId,
            sub_account_id: subId,
            hidden_links: selectedLinks as any,
            preset_name: presetName.trim() || null,
          });
        if (error) throw error;
        toast.success("Menu link rule applied! Changes reflect in GHL within 5 minutes.");
      }

      setSelectedLinks([]);
      setSubAccountId("");
      setSubAccountIds([]);
      setPresetName("");
      setIsSubAccountSpecific(false);
      await loadRules();
    } catch (e) {
      console.error('Error applying rule:', e);
      toast.error("Failed to apply menu link rule");
    } finally {
      setIsApplying(false);
    }
  };

  const deleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('menu_link_rules')
        .delete()
        .eq('id', ruleId);
      if (error) throw error;
      toast.success("Rule deleted. Changes reflect in GHL within 5 minutes.");
      await loadRules();
    } catch (e) {
      console.error('Error deleting rule:', e);
      toast.error("Failed to delete rule");
    }
  };

  // Rebuild the live CSS/JS right away so paused/resumed rules apply instantly.
  const refreshLiveStyles = async () => {
    if (!agencyId) return;
    const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-styles?agency_id=${encodeURIComponent(agencyId)}&force=1`;
    await Promise.all(["css", "js"].map((t) => fetch(`${base}&type=${t}`, { cache: "no-store" }).catch(() => {})));
  };

  const toggleRuleActive = async (rule: MenuLinkRule) => {
    try {
      const { error } = await supabase
        .from('menu_link_rules')
        .update({ is_active: !rule.is_active, updated_at: new Date().toISOString() })
        .eq('id', rule.id);
      if (error) throw error;
      toast.success(rule.is_active ? "Rule paused" : "Rule resumed");
      await refreshLiveStyles();
      await loadRules();
    } catch (e) {
      console.error('Error toggling rule:', e);
      toast.error("Failed to toggle rule");
    }
  };

  const startEdit = (rule: MenuLinkRule) => {
    setEditingRule(rule);
    setSelectedLinks([...rule.hidden_links]);
    setPresetName(rule.preset_name || "");
    if (rule.sub_account_id) {
      setIsSubAccountSpecific(true);
      setSubAccountId(rule.sub_account_id);
      setSubAccountIds([rule.sub_account_id]);
    } else {
      setIsSubAccountSpecific(false);
      setSubAccountId("");
      setSubAccountIds([]);
    }
  };

  const cancelEdit = () => {
    setEditingRule(null);
    setSelectedLinks([]);
    setPresetName("");
    setIsSubAccountSpecific(false);
    setSubAccountId("");
    setSubAccountIds([]);
  };

  const menuRules = rules.filter((rule) => !isSitesTopNavPreset(rule.preset_name));

  const groupRulesByPreset = (rules: MenuLinkRule[]): Record<string, MenuLinkRule[]> => {
    const groups: Record<string, MenuLinkRule[]> = {};
    rules.forEach(rule => {
      if (isSitesTopNavPreset(rule.preset_name)) return;
      const key = rule.preset_name?.trim() || '__other__';
      if (!groups[key]) groups[key] = [];
      groups[key].push(rule);
    });
    return groups;
  };

  const togglePresetActive = async (presetKey: string, presetRules: MenuLinkRule[]) => {
    const allActive = presetRules.every(r => r.is_active);
    const newState = !allActive;
    try {
      for (const rule of presetRules) {
        await supabase
          .from('menu_link_rules')
          .update({ is_active: newState, updated_at: new Date().toISOString() })
          .eq('id', rule.id);
      }
      toast.success(newState ? "Preset resumed" : "Preset paused");
      await refreshLiveStyles();
      await loadRules();
    } catch (e) {
      console.error('Error toggling preset:', e);
      toast.error("Failed to toggle preset");
    }
  };

  const deletePreset = async (presetRules: MenuLinkRule[]) => {
    try {
      for (const rule of presetRules) {
        await supabase.from('menu_link_rules').delete().eq('id', rule.id);
      }
      toast.success(`Deleted ${presetRules.length} rule${presetRules.length > 1 ? 's' : ''}`);
      await loadRules();
    } catch (e) {
      console.error('Error deleting preset:', e);
      toast.error("Failed to delete preset");
    }
  };

  const handleCopy = async () => {
    if (!copyTarget || !agencyId) return;
    try {
      if (copyMode === "all") {
        // Remove sub_account_id to apply to all
        const { error } = await supabase
          .from('menu_link_rules')
          .insert({
            agency_id: agencyId,
            sub_account_id: null,
            hidden_links: copyTarget.hidden_links as any,
          });
        if (error) throw error;
        toast.success("Rule copied to all sub accounts!");
      } else {
        if (!copySubAccountId.trim()) {
          toast.error("Please enter a Sub Account ID");
          return;
        }
        const { error } = await supabase
          .from('menu_link_rules')
          .insert({
            agency_id: agencyId,
            sub_account_id: copySubAccountId.trim(),
            hidden_links: copyTarget.hidden_links as any,
          });
        if (error) throw error;
        toast.success("Rule copied to sub account!");
      }
      setShowCopyDialog(false);
      setCopyTarget(null);
      setCopySubAccountId("");
      await loadRules();
    } catch (e) {
      console.error('Error copying rule:', e);
      toast.error("Failed to copy rule");
    }
  };

  // ===== LEGACY MODE FUNCTIONS =====
  const analyzeBusinessAndSuggest = () => {
    if (!businessDescription.trim()) {
      toast.error("Please describe your business first");
      return;
    }
    const words = businessDescription.toLowerCase().trim().split(/\s+/);
    const meaningfulWords = words.filter(word => word.length > 2);
    if (meaningfulWords.length < 2 || businessDescription.length < 10) {
      toast.error("Please provide a more detailed description of your business");
      return;
    }
    setIsAnalyzing(true);
    setTimeout(() => {
      const businessLower = businessDescription.toLowerCase();
      const suggestedFeatures = highlevelFeatures.map(feature => {
        let recommended = false;
        if (businessLower.includes("calendar") || businessLower.includes("scheduling") || businessLower.includes("appointment")) {
          recommended = ["#sb_calendars"].includes(feature.tabId);
        } else if (businessLower.includes("crm") || businessLower.includes("customer relationship")) {
          recommended = ["#sb_contacts", "#sb_conversations", "#sb_opportunities"].includes(feature.tabId);
        } else if (businessLower.includes("ecommerce") || businessLower.includes("online store") || businessLower.includes("shop")) {
          recommended = ["#sb_sites", "#sb_payments", "#sb_contacts", "#sb_email-marketing"].includes(feature.tabId);
        } else if (businessLower.includes("email marketing") || businessLower.includes("newsletter")) {
          recommended = ["#sb_email-marketing", "#sb_contacts", "#sb_automation"].includes(feature.tabId);
        } else if (businessLower.includes("review") || businessLower.includes("reputation")) {
          recommended = ["#sb_reputation", "#sb_contacts"].includes(feature.tabId);
        } else if (businessLower.includes("membership") || businessLower.includes("course") || businessLower.includes("community")) {
          recommended = ["#sb_memberships", "#sb_sites", "#sb_payments"].includes(feature.tabId);
        } else if (businessLower.includes("landing page") || businessLower.includes("funnel")) {
          recommended = ["#sb_sites", "#sb_contacts"].includes(feature.tabId);
        } else if (businessLower.includes("analytics") || businessLower.includes("reporting") || businessLower.includes("dashboard")) {
          recommended = ["#sb_reporting", "#sb_dashboard"].includes(feature.tabId);
        } else if (businessLower.includes("chat") || businessLower.includes("messaging") || businessLower.includes("communication")) {
          recommended = ["#sb_conversations", "#sb_contacts"].includes(feature.tabId);
        } else if (businessLower.includes("lead generation") || businessLower.includes("lead gen")) {
          recommended = ["#sb_contacts", "#sb_sites", "#sb_automation", "#sb_email-marketing"].includes(feature.tabId);
        } else if (businessLower.includes("mobile app") || businessLower.includes("app management")) {
          recommended = ["#sb_location-mobile-app", "#sb_contacts"].includes(feature.tabId);
        } else if (businessLower.includes("payment") || businessLower.includes("billing")) {
          recommended = ["#sb_payments", "#sb_contacts"].includes(feature.tabId);
        } else if (businessLower.includes("coaching") || businessLower.includes("consultant")) {
          recommended = !["#sb_memberships", "#sb_app-media", "#sb_reputation", "#sb_app-marketplace", "#sb_location-mobile-app"].includes(feature.tabId);
        } else if (businessLower.includes("agency") || businessLower.includes("marketing")) {
          recommended = !["#sb_memberships", "#sb_app-marketplace", "#sb_location-mobile-app"].includes(feature.tabId);
        } else if (businessLower.includes("restaurant") || businessLower.includes("local")) {
          recommended = !["#sb_memberships", "#sb_app-media", "#sb_app-marketplace", "#sb_location-mobile-app"].includes(feature.tabId);
        } else {
          recommended = !["#sb_memberships", "#sb_app-media", "#sb_reputation", "#sb_app-marketplace", "#sb_location-mobile-app"].includes(feature.tabId);
        }
        return { ...feature, recommended };
      });
      setSuggestions(suggestedFeatures);
      setIncludedFeatures(suggestedFeatures.filter(f => f.recommended).map(f => f.tabId));
      setCurrentStep(2);
      setIsAnalyzing(false);
    }, 2000);
  };

  const toggleFeature = (tabId: string) => {
    setIncludedFeatures(prev => prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]);
  };
  const toggleRemoveFeature = (tabId: string) => {
    setRemovedFeatures(prev => prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]);
  };

  const legacyGenerateCSS = () => {
    if (legacyIsSubAccountSpecific && !legacySubAccountId.trim()) {
      toast.error("Please enter a Sub Account ID");
      return;
    }
    const subAccountPrefix = legacyIsSubAccountSpecific ? `.${legacySubAccountId.trim()} ` : '';
    if (workflowType === "ai") {
      if (includedFeatures.length === 0) {
        toast.error("Please select at least one feature to include");
        return;
      }
      const featuresToHide = highlevelFeatures.filter(f => !includedFeatures.includes(f.tabId));
      const css = featuresToHide.map(feature => `${subAccountPrefix}${feature.tabId} {\n  display: none !important;\n}`).join('\n\n');
      setGeneratedCSS(css);
      toast.success(`CSS generated to hide ${featuresToHide.length} features`);
    } else {
      if (removedFeatures.length === 0) {
        toast.error("Please select at least one feature to remove");
        return;
      }
      const css = removedFeatures.map(tabId => `${subAccountPrefix}${tabId} {\n  display: none !important;\n}`).join('\n\n');
      setGeneratedCSS(css);
      toast.success(`CSS generated to hide ${removedFeatures.length} features`);
    }
    setCurrentStep(3);
  };

  const resetLegacy = () => {
    setWorkflowType(null);
    setBusinessDescription("");
    setSuggestions([]);
    setIncludedFeatures([]);
    setRemovedFeatures([]);
    setGeneratedCSS("");
    setCurrentStep(0);
    setLegacyIsSubAccountSpecific(false);
    setLegacySubAccountId("");
  };

  if (loadError || isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Menu link removal"
          subtitle="Hide the HighLevel menu links your clients don't need, for every sub-account or only the ones you pick."
        />
        <LoadNotice
          loading={isLoading}
          error={loadError}
          label="Loading menu link removal…"
          onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
        />
      </div>
    );
  }

  // ===== DYNAMIC MODE =====
  if (dynamicInstallation) {
    const groups = [
      { id: "main" as const, label: "Main navigation", links: highlevelFeatures },
      { id: "settings" as const, label: "Settings navigation", links: SETTINGS_NAV_LINKS },
    ].map((group) => ({
      ...group,
      count: group.links.filter((link) => selectedLinks.includes(link.tabId)).length,
    }));
    const activeGroup = groups.find((group) => group.id === navTab) ?? groups[0];
    const presetGroups = groupRulesByPreset(menuRules);
    const presetCount = Object.keys(presetGroups).length;
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Menu link removal"
          subtitle="Hide the HighLevel menu links your clients don't need, for every sub-account or only the ones you pick."
          actions={
            <>
              <Button variant="outline" className="gap-2" onClick={() => setTrainingVideoOpen(true)} aria-label="Play menu link removal walkthrough video">
                <Play className="h-4 w-4" />
                Watch walkthrough
              </Button>
              <MenuRemovalVideoDialog open={trainingVideoOpen} onOpenChange={setTrainingVideoOpen} />
              <SitesTopNavOptions agencyId={agencyId} />
            </>
          }
        />
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          {/* Left side: links to hide */}
          <SectionCard
            icon={editingRule ? <Pencil /> : <EyeOff />}
            title={
              editingRule
                ? `Editing rule ${editingRule.sub_account_id ? `(${editingRule.sub_account_id})` : "(all sub-accounts)"}`
                : "Choose links to hide"
            }
            description="Switch a link on to hide it. Hiding a link does not change HighLevel permissions."
            className="min-w-0"
            bodyClassName="flex flex-col gap-6"
          >
            <div data-tip-target="menu-manual-links" className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AnimatedTabs
                  variant="segment"
                  activeTab={navTab}
                  onChange={(id) => setNavTab(id === "settings" ? "settings" : "main")}
                  tabs={groups.map((group) => ({
                    id: group.id,
                    label: group.count ? `${group.label} (${group.count})` : group.label,
                  }))}
                  className="max-w-full [&_button]:whitespace-nowrap [&_button]:px-3 [&_button]:py-1.5"
                />
                <p className="text-xs text-muted-foreground" aria-live="polite">
                  {activeGroup.count} of {activeGroup.links.length} hidden
                </p>
              </div>
              <motion.ul
                key={activeGroup.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: DURATION.slow, ease: EASE_OUT }}
                aria-label={activeGroup.label}
                className="grid gap-x-4 sm:grid-cols-2"
              >
                {activeGroup.links.map((feature, index) => {
                  const hidden = selectedLinks.includes(feature.tabId);
                  const switchId = `menu-link-${activeGroup.id}-${index}`;
                  return (
                    <li key={feature.id} className="border-b border-border/70">
                      <label
                        htmlFor={switchId}
                        className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/60"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={`truncate text-sm font-medium ${hidden ? "text-muted-foreground line-through decoration-muted-foreground/50" : "text-foreground"}`}
                          >
                            {feature.name}
                          </span>
                          {hidden ? <Badge variant="brand" className="shrink-0">Hidden</Badge> : null}
                        </span>
                        <Switch
                          id={switchId}
                          checked={hidden}
                          onCheckedChange={() => toggleLink(feature.tabId)}
                          aria-label={`Hide ${feature.name}`}
                        />
                      </label>
                    </li>
                  );
                })}
              </motion.ul>
            </div>

            {selectedLinks.includes('#sb_AI Agents') && (
              <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning/10 p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">AI Agents must also be turned off in HighLevel</p>
                  <p className="mt-1 text-muted-foreground">
                    Hiding the menu link won't fully disable AI Agents. Also turn them off in{' '}
                    <a
                      href="https://app.gohighlevel.com/settings/ai-employees"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
                    >
                      GHL AI Employee Settings <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>
              </div>
            )}

            {/* Preset Name */}
            <div data-tip-target="menu-manual-preset" className="flex flex-col gap-2">
              <Label htmlFor="menu-preset-name">Preset name</Label>
              <Input
                id="menu-preset-name"
                placeholder="e.g., Basic Plan, Pro Plan"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Groups your rules and lets automations apply them by name.
              </p>
            </div>

            {/* Sub Account */}
            <div data-tip-target="menu-manual-scope" className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor="dynamic-sub-account" className="text-sm font-medium">
                    Only for specific sub-accounts
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">Off means every sub-account.</p>
                </div>
                <Switch
                  id="dynamic-sub-account"
                  checked={isSubAccountSpecific}
                  onCheckedChange={setIsSubAccountSpecific}
                />
              </div>
              {isSubAccountSpecific && (
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">
                    {editingRule ? "Sub-account ID" : "Sub-accounts (pick one or more)"}
                  </Label>
                  {editingRule ? (
                    <SubAccountPicker agencyId={agencyId} value={subAccountId} onChange={setSubAccountId} savedIds={savedSubAccounts} />
                  ) : (
                    <SubAccountPicker
                      agencyId={agencyId}
                      value={subAccountId}
                      onChange={setSubAccountId}
                      savedIds={savedSubAccounts}
                      values={subAccountIds}
                      onToggle={(id) => setSubAccountIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Apply / Cancel buttons */}
            <div data-tip-target="menu-manual-apply" className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">
                {selectedLinks.length === 0
                  ? "No links selected yet."
                  : `${selectedLinks.length} link${selectedLinks.length === 1 ? "" : "s"} will be hidden.`}
              </p>
              <div className="flex items-center gap-2">
                {editingRule && (
                  <Button variant="outline" onClick={cancelEdit}>
                    <X className="h-4 w-4" />Cancel
                  </Button>
                )}
                <Button variant="accent" onClick={applyRules} disabled={isApplying}>
                  {isApplying ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" />Saving…</>
                  ) : editingRule ? (
                    <><Check className="h-4 w-4" />Update rule</>
                  ) : (
                    <><EyeOff className="h-4 w-4" />{selectedLinks.length ? `Hide ${selectedLinks.length} link${selectedLinks.length === 1 ? "" : "s"}` : "Hide links"}</>
                  )}
                </Button>
              </div>
            </div>
          </SectionCard>

          {/* Right side: Rules organized by Preset Folders */}
          <div data-tip-target="menu-manual-rules" className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <SectionCard
              icon={<CheckCircle />}
              title="Active rules"
              description={
                menuRules.length === 0
                  ? "Nothing is hidden yet."
                  : `${menuRules.length} rule${menuRules.length > 1 ? 's' : ''} across ${presetCount} preset${presetCount > 1 ? 's' : ''}`
              }
            >
              {menuRules.length === 0 ? (
                <EmptyState
                  icon={<EmptyStateIllustration><EyeOff className="size-6 text-brand" aria-hidden /></EmptyStateIllustration>}
                  title="No rules yet"
                  description="Pick the links to hide, name the preset, then save. Your rules show up here."
                  className="py-8"
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {Object.entries(presetGroups)
                    .sort(([a], [b]) => {
                      if (a === '__other__') return 1;
                      if (b === '__other__') return -1;
                      return a.localeCompare(b);
                    })
                    .map(([presetKey, presetRules]) => {
                      const isOpen = openPresets.has(presetKey);
                      const displayName = presetKey === '__other__' ? 'Other' : presetKey;
                      const activeCount = presetRules.filter(r => r.is_active).length;
                      const allActive = presetRules.every(r => r.is_active);
                      const allPaused = presetRules.every(r => !r.is_active);

                      return (
                        <div key={presetKey} className="overflow-hidden rounded-lg border border-border">
                          {/* Folder Header */}
                          <div
                            className="flex cursor-pointer items-center justify-between gap-2 bg-muted/40 p-3 transition-colors hover:bg-muted/70"
                            onClick={() => {
                              setOpenPresets(prev => {
                                const next = new Set(prev);
                                if (next.has(presetKey)) next.delete(presetKey);
                                else next.add(presetKey);
                                return next;
                              });
                            }}
                          >
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                              {isOpen ? (
                                <FolderOpen className="h-4 w-4 shrink-0 text-brand" />
                              ) : (
                                <Folder className="h-4 w-4 shrink-0 text-brand" />
                              )}
                              <span className="truncate text-sm font-semibold">{displayName}</span>
                              <Badge variant="secondary" className="text-xs">
                                {presetRules.length} rule{presetRules.length > 1 ? 's' : ''}
                              </Badge>
                              {allPaused && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">Paused</Badge>
                              )}
                              {!allActive && !allPaused && (
                                <Badge variant="outline" className="text-xs">{activeCount} active</Badge>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
                              {presetKey !== '__other__' && <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Set up automation for ${displayName}`} title="Set up automation" onClick={() => { setAutomationPreset(presetKey); document.querySelector('[data-tip-target="menu-automation-removal"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}><Webhook className="h-4 w-4" /></Button>}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => togglePresetActive(presetKey, presetRules)}
                                title={allActive ? "Pause All" : "Resume All"}
                                aria-label={allActive ? `Pause all rules in ${displayName}` : `Resume all rules in ${displayName}`}
                              >
                                {allActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => deletePreset(presetRules)}
                                title="Delete All Rules in Preset"
                                aria-label={`Delete all rules in ${displayName}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Folder Content */}
                          {isOpen && (
                            <div className="divide-y divide-border">
                              {presetRules
                                .sort((a, b) => {
                                  if (!a.sub_account_id && b.sub_account_id) return -1;
                                  if (a.sub_account_id && !b.sub_account_id) return 1;
                                  return (a.sub_account_id || '').localeCompare(b.sub_account_id || '');
                                })
                                .map(rule => (
                                  <div key={rule.id} className={`flex flex-col gap-2 p-3 ${!rule.is_active ? 'opacity-50' : ''}`}>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="min-w-0 truncate text-xs font-medium text-muted-foreground">
                                        {rule.sub_account_id || <Badge variant="secondary" className="text-xs">All sub-accounts</Badge>}
                                      </span>
                                      <div className="flex shrink-0 items-center gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleRuleActive(rule)} title={rule.is_active ? "Pause" : "Resume"} aria-label={rule.is_active ? "Pause rule" : "Resume rule"}>
                                          {rule.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(rule)} title="Edit" aria-label="Edit rule">
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setCopyTarget(rule); setShowCopyDialog(true); }} title="Copy" aria-label="Copy rule">
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteRule(rule.id)} title="Delete" aria-label="Delete rule">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {rule.hidden_links.map(link => (
                                        <Badge key={link} variant="outline" className="text-xs font-medium">
                                          {getFeatureName(link)}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </SectionCard>
          </div>
        </div>

        <section className="flex flex-col gap-6 border-t border-border pt-8">
          <div className="flex items-start gap-3">
            <span className="px-icon-chip shrink-0" aria-hidden="true"><Zap className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="text-h4 text-foreground">Auto-remove menu links</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Apply a preset automatically when a sub-account is created or changes plan.</p>
            </div>
          </div>
          <div data-tip-target="menu-automation-connection" className="px-surface flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
            <div className="min-w-0 space-y-1"><h3 className="text-sm font-semibold">Before you start: HighLevel connection</h3><p className="text-sm text-muted-foreground">Connect in Settings → HighLevel. Include custom-menu-link.write permission for onboarding-link assignment.</p></div>
            <Button variant="outline" onClick={() => navigate('/app/highlevel')}><ExternalLink className="h-4 w-4" />HighLevel Settings</Button>
          </div>
          <MenuAutomationPanel agencyId={agencyId} presetName={automationPreset} presets={Object.keys(presetGroups).filter((k) => k !== '__other__')} />
        </section>

        <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Copy Menu Link Rule</DialogTitle>
              <DialogDescription>
                Choose where to copy this rule
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={copyMode === "all" ? "default" : "outline"}
                  onClick={() => setCopyMode("all")}
                  className="h-auto py-3"
                >
                  Copy to All Sub Accounts
                </Button>
                <Button
                  variant={copyMode === "specific" ? "default" : "outline"}
                  onClick={() => setCopyMode("specific")}
                  className="h-auto py-3"
                >
                  Copy to Specific Sub Account
                </Button>
              </div>
              {copyMode === "specific" && (
                <div className="space-y-2">
                  <Label>Sub Account ID</Label>
                  {savedSubAccounts.length > 0 ? (
                    <div className="flex gap-2">
                      <Select value={copySubAccountId} onValueChange={setCopySubAccountId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select saved ID" />
                        </SelectTrigger>
                        <SelectContent>
                          {savedSubAccounts.map(id => (
                            <SelectItem key={id} value={id}>{id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Or enter new ID"
                        value={copySubAccountId}
                        onChange={e => setCopySubAccountId(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  ) : (
                    <Input
                      placeholder="e.g., jTajsdfsdf982"
                      value={copySubAccountId}
                      onChange={e => setCopySubAccountId(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCopyDialog(false)}>Cancel</Button>
              <Button onClick={handleCopy}>Copy Rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


      </div>
    );
  }

  // ===== LEGACY MODE =====
  return (
    <div className="space-y-8">
      <PageHeader
        title="Menu link removal"
        subtitle="Hide the HighLevel menu links your clients don't need, for every sub-account or only the ones you pick."
        actions={<SitesTopNavOptions agencyId={agencyId} />}
      />
      {currentStep === 0 && (
        <Card className="mb-8 border border-border shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <CardTitle>Choose Your Workflow</CardTitle>
              </div>
            </div>
            <CardDescription>Select how you'd like to customize your HighLevel platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <Button onClick={() => { setWorkflowType("ai"); setCurrentStep(1); }} variant="outline" className="h-auto p-4 sm:p-6 flex flex-col items-center space-y-2 sm:space-y-3 hover:border-success/50 hover:bg-success/10" size="lg">
                <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-success" />
                <div className="text-center">
                  <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2 whitespace-normal leading-tight">Let AI Determine What Menu Links to Keep</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-normal leading-tight">Describe your business and AI will suggest which features to keep</p>
                </div>
              </Button>
              <Button onClick={() => { setWorkflowType("manual"); setCurrentStep(2); }} variant="outline" className="h-auto p-4 sm:p-6 flex flex-col items-center space-y-2 sm:space-y-3 hover:border-destructive/50 hover:bg-destructive/10" size="lg">
                <MousePointer className="w-6 h-6 sm:w-8 sm:h-8 text-destructive" />
                <div className="text-center">
                  <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-2 whitespace-normal leading-tight">Pick Menu Links to Remove Manually</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-normal leading-tight">Manually select which features you want to hide</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {workflowType === "ai" && currentStep === 1 && (
        <Card className="mb-8 border-2 border-success/30 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-success text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <CardTitle>Describe Your SAAS</CardTitle>
              </div>
              <Button onClick={resetLegacy} variant="ghost" size="sm"><ChevronLeft className="w-4 h-4" /><span>Back</span></Button>
            </div>
            <CardDescription>Tell us about your software so we can recommend which HighLevel features to include</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              placeholder="e.g., I run a calendar scheduling app for small businesses..."
              value={businessDescription}
              onChange={e => setBusinessDescription(e.target.value)}
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <Button onClick={analyzeBusinessAndSuggest} disabled={!businessDescription.trim() || isAnalyzing} className="flex-1" size="lg">
                {isAnalyzing ? <><Sparkles className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <>Analyze & Get Suggestions<ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
              <Button onClick={resetLegacy} variant="outline" size="lg">Back</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 2 && (
        <Card className="mb-8 border border-border shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 ${workflowType === "ai" ? "bg-success" : "bg-destructive"} text-white rounded-full flex items-center justify-center text-sm font-bold`}>
                  {workflowType === "ai" ? "3" : "2"}
                </div>
                <CardTitle>{workflowType === "ai" ? "Select Features to Keep" : "Select Features to Remove"}</CardTitle>
              </div>
              <Button onClick={workflowType === "ai" ? () => setCurrentStep(1) : resetLegacy} variant="ghost" size="sm"><ChevronLeft className="w-4 h-4" /><span>Back</span></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {(workflowType === "ai" ? suggestions : highlevelFeatures).map(feature => (
                <div
                  key={feature.id}
                  onClick={() => workflowType === "ai" ? toggleFeature(feature.tabId) : toggleRemoveFeature(feature.tabId)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 ${
                    workflowType === "ai"
                      ? includedFeatures.includes(feature.tabId) ? 'border-success bg-success/10 shadow-card' : 'border-border bg-card hover:border-success/50'
                      : removedFeatures.includes(feature.tabId) ? 'border-destructive bg-destructive/10 shadow-card' : 'border-border bg-card hover:border-destructive/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold">{feature.name}</h4>
                    {workflowType === "ai" && feature.recommended && <Badge variant="secondary" className="text-xs bg-success/10 text-success">AI Suggested</Badge>}
                    {workflowType === "manual" && removedFeatures.includes(feature.tabId) && <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive">Will Remove</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{feature.description}</p>
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{feature.tabId}</code>
                </div>
              ))}
            </div>
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center space-x-3 py-[15px]">
                <Switch id="legacy-sub-account-toggle" checked={legacyIsSubAccountSpecific} onCheckedChange={setLegacyIsSubAccountSpecific} />
                <Label htmlFor="legacy-sub-account-toggle" className="text-sm font-medium">Disable for specific sub accounts only</Label>
              </div>
              {legacyIsSubAccountSpecific && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Paste Sub Account ID <span className="text-destructive">*</span></Label>
                  <Input placeholder="e.g., jTajsdfsdf982" value={legacySubAccountId} onChange={e => setLegacySubAccountId(e.target.value)} className="max-w-md" />
                </div>
              )}
            </div>
            <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-4 mt-4">
              <Button onClick={legacyGenerateCSS} disabled={(workflowType === "ai" ? includedFeatures.length === 0 : removedFeatures.length === 0) || (legacyIsSubAccountSpecific && !legacySubAccountId.trim())} size="lg">
                {workflowType === "ai" ? `Generate CSS Code (${includedFeatures.length} features to keep)` : `Generate CSS Code (${removedFeatures.length} features to remove)`}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button onClick={workflowType === "ai" ? () => setCurrentStep(1) : resetLegacy} variant="outline" size="lg">
                <RefreshCw className="w-4 h-4 mr-2" />{workflowType === "ai" ? "Regenerate" : "Back"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 3 && generatedCSS && (
        <Card className="border border-border shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-8 h-8 ${workflowType === "ai" ? "bg-success" : "bg-destructive"} text-white rounded-full flex items-center justify-center text-sm font-bold`}>
                  {workflowType === "ai" ? "4" : "3"}
                </div>
                <CardTitle>Your Custom CSS Code</CardTitle>
              </div>
              <Button onClick={() => setCurrentStep(2)} variant="ghost" size="sm"><ChevronLeft className="w-4 h-4" /><span>Back</span></Button>
            </div>
            <CardDescription>Copy this CSS code and paste it into your HighLevel agency settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock code={generatedCSS} language="css" />
            <div className="flex space-x-4">
              <Button onClick={resetLegacy} variant="outline" size="lg"><RefreshCw className="w-4 h-4 mr-2" />Reset & Create Another</Button>
            </div>
            <div className="bg-muted border border-border rounded-lg p-4">
              <h4 className="font-semibold text-foreground mb-2">How to Apply This CSS:</h4>
              <ol className="text-sm text-muted-foreground space-y-1">
                <li>1. Log into your HighLevel agency account</li>
                <li>2. Go to Settings → Company → White Label → Custom CSS</li>
                <li>3. Paste the generated CSS code above</li>
                <li>4. Save the changes</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StreamlineTool;
