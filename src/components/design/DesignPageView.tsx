import { FaviconControl } from "@/components/branding/FaviconControl";
import { SWITCHYARD_FIELDS, cleanSwitchyardColors } from "../../../supabase/functions/_shared/switchyardTheme";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { newUi } from "@/lib/uiVersion";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { DesignPreview } from "@/components/design/DesignPreview";
import LoginCustomizationPanel from "@/components/branding/LoginCustomizationPanel";
import ButtonCustomizationPanel from "@/components/branding/ButtonCustomizationPanel";
import MobileBrandingCard from "@/components/client-hub/MobileBrandingCard";
import TopNavWidgetCard from "@/components/client-hub/TopNavWidgetCard";
import ColorPicker from "@/components/ColorPicker";
import FontSelector from "@/components/FontSelector";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  tabChecked,
  unsavedChangeBar,
  unsavedChangeText,
  type DesignSnapshot,
  type DesignTab,
  type PreviewDevice,
  type PreviewSurface,
  type SidebarStyle,
} from "@/lib/designPageModel";
import type { BrandingPreset } from "@/lib/brandingPresets";
import { THEME_INSTALL_UPDATE_NOTE } from "@/lib/installSnippets";
import { minimumBrandingPlanName } from "@/lib/designAccess";
import { Check, ChevronDown, Copy, Loader2, Lock, Trash2, Undo } from "lucide-react";

const STYLES: { id: SidebarStyle; name: string; detail: string }[] = [
  { id: "v1", name: "Classic", detail: "Full sidebar styling" },
  { id: "v2", name: "Simple", detail: "Framed, two-color" },
  { id: "v3", name: "Minimalist", detail: "Lighter, icon-first" },
  { id: "switchyard", name: "2026 New UI (Switchyard)", detail: "New HighLevel navigation" },
];

const LAYOUTS: { id: number; name: string; detail: string }[] = [
  { id: 1, name: "The Video Library", detail: "Grid of training videos" },
  { id: 2, name: "The Client Hub", detail: "Hub with quick links" },
  { id: 3, name: "The Split View", detail: "Video list beside player" },
  { id: 4, name: "Neo", detail: "Bold dark layout" },
];

const TABS: { id: DesignTab; label: string; step: number }[] = [
  { id: "style", label: "Style", step: 1 },
  { id: "layout", label: "Layout", step: 2 },
  { id: "widgets", label: "Widgets", step: 3 },
  { id: "advanced", label: "Advanced", step: 4 },
];

function StyleThumb({ id }: { id: SidebarStyle }) {
  if (id === "v1") {
    return (
      <div className="flex h-24 overflow-hidden bg-muted">
        <div className="w-10 bg-foreground" />
        <div className="m-2 flex-1 rounded-md bg-primary/15" />
      </div>
    );
  }
  if (id === "v2") {
    return (
      <div className="flex h-24 items-center justify-center bg-muted">
        <div className="flex h-16 w-[80%] overflow-hidden rounded-md border bg-background">
          <div className="w-6 bg-muted-foreground/20" />
          <div className="m-1.5 flex-1 rounded-sm bg-primary/10" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-24 items-center gap-2 bg-muted px-3">
      <div className="flex h-16 w-8 flex-col gap-1 rounded-md border bg-background p-1">
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="size-2 rounded-full bg-muted-foreground/40" />
        <span className="size-2 rounded-full bg-primary" />
      </div>
      <div className="h-10 flex-1 rounded-md bg-background" />
    </div>
  );
}

function LayoutThumb({ id }: { id: number }) {
  if (id === 1) {
    return (
      <div className="grid h-20 grid-cols-3 gap-1 bg-muted p-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-sm bg-primary/20" />
        ))}
      </div>
    );
  }
  if (id === 3) {
    return (
      <div className="grid h-20 grid-cols-5 gap-1 bg-muted p-2">
        <div className="col-span-2 rounded-sm bg-primary/25" />
        <div className="col-span-3 rounded-sm bg-background" />
      </div>
    );
  }
  if (id === 4) {
    return (
      <div className="flex h-20 flex-col justify-center gap-1 bg-foreground p-3">
        <div className="h-2 w-10 rounded-full bg-primary" />
        <div className="h-1.5 w-full rounded-full bg-background/20" />
        <div className="h-1.5 w-4/5 rounded-full bg-background/20" />
      </div>
    );
  }
  return (
    <div className="flex h-20 flex-col gap-1 bg-muted p-2">
      <div className="h-6 rounded-sm bg-primary/20" />
      <div className="h-2 rounded-sm bg-background" />
      <div className="h-2 rounded-sm bg-background" />
    </div>
  );
}

function PlanLock({
  title,
  detail,
  planName,
  onUpgrade,
  testId,
}: {
  title: string;
  detail: string;
  planName: string;
  onUpgrade?: () => void;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Lock className="size-4" aria-hidden />
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge variant="secondary">Upgrade</Badge>
        </div>
        <CardDescription>{detail}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" onClick={onUpgrade} data-testid={`${testId}-upgrade`}>
          Upgrade to {planName}
        </Button>
      </CardContent>
    </Card>
  );
}

function SaveMenu({
  presets,
  saving,
  dirty,
  blocked,
  onSave,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  menuLabel,
  allowPresets = true,
}: {
  presets: BrandingPreset[];
  saving: boolean;
  dirty: boolean;
  blocked: boolean;
  onSave: () => void;
  onSavePreset: () => void;
  onLoadPreset: (preset: BrandingPreset) => void;
  onDeletePreset: (preset: BrandingPreset) => void;
  menuLabel: string;
  allowPresets?: boolean;
}) {
  return (
    <ButtonGroup>
      <Button
        type="button"
        variant="accent"
        disabled={!dirty || saving}
        aria-describedby={blocked ? "design-save-blocked" : undefined}
        onClick={onSave}
        data-testid="design-save"
      >
        {saving ? <Loader2 data-icon="inline-start" /> : null}
        Save changes
      </Button>
      {allowPresets ? <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="accent"
            size="icon"
            className={newUi ? "border-l border-white/35" : undefined}
            aria-label={menuLabel}
            data-testid="design-save-menu"
          >
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={onSavePreset}>Save as preset…</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Saved presets</DropdownMenuLabel>
          <DropdownMenuGroup>
            {presets.length ? (
              presets.map((preset) => (
                <DropdownMenuItem key={preset.id} onClick={() => onLoadPreset(preset)}>
                  <span className="min-w-0 flex-1 truncate">{preset.name}</span>
                  <span className="text-xs text-muted-foreground">Load</span>
                  <button
                    type="button"
                    aria-label={`Delete preset ${preset.name}`}
                    title="Delete preset"
                    data-testid="design-preset-delete"
                    disabled={saving}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (window.confirm(`Delete the preset "${preset.name}"? Your live branding is not changed.`))
                        onDeletePreset(preset);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>No saved presets yet</DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu> : null}
    </ButtonGroup>
  );
}

export function DesignPageView({
  loading,
  error,
  onRetry,
  installed,
  script,
  onCopyScript,
  tab,
  onTab,
  draft,
  savedStyle,
  savedLayout,
  labels,
  presets,
  saving,
  saveBlocked,
  sidebarWarning,
  sidebarModeConfirmed,
  onConfirmSidebar,
  surface,
  device,
  onSurface,
  onDevice,
  onPatch,
  onDiscard,
  onUndo,
  onSave,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
  onRemoveBranding,
  onOpenSimplified,
  onBack,
  email,
  widgetColors,
  brandingLocked = false,
  themeLocked = false,
  upgradePlanName = minimumBrandingPlanName(),
  onUpgrade,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  installed: boolean;
  script: string;
  onCopyScript: () => void;
  tab: DesignTab;
  onTab: (tab: DesignTab) => void;
  draft: DesignSnapshot;
  savedStyle: SidebarStyle | null;
  savedLayout: number | null;
  labels: string[];
  presets: BrandingPreset[];
  saving: boolean;
  saveBlocked: boolean;
  sidebarWarning: string | null;
  sidebarModeConfirmed: boolean;
  onConfirmSidebar: (checked: boolean) => void;
  surface: PreviewSurface;
  device: PreviewDevice;
  onSurface: (surface: PreviewSurface) => void;
  onDevice: (device: PreviewDevice) => void;
  onPatch: (patch: Partial<DesignSnapshot>) => void;
  onDiscard: () => void;
  onUndo: () => void;
  onSave: () => void;
  onSavePreset: (name: string) => void;
  onLoadPreset: (preset: BrandingPreset) => void;
  onDeletePreset: (preset: BrandingPreset) => void;
  onRemoveBranding: () => void;
  onOpenSimplified: () => void;
  onBack: () => void;
  email: string | null | undefined;
  widgetColors: { primary: string; secondary: string; tertiary: string };
  brandingLocked?: boolean;
  themeLocked?: boolean;
  upgradePlanName?: string;
  onUpgrade?: () => void;
}) {
  const [presetOpen, setPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [sidebarDetails, setSidebarDetails] = useState(false);
  const dirty = labels.length > 0;
  const status = unsavedChangeText(labels);
  const bar = unsavedChangeBar(labels);
  const confirmRef = useRef<HTMLLabelElement>(null);
  // A blocked Save used to be a greyed-out button with no reason shown.
  // Now it stays clickable, jumps to the required checkbox, and the parent explains why.
  const handleSave = () => {
    if (saveBlocked) confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    onSave();
  };
  const pageRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(96);
  const [noticeOffset, setNoticeOffset] = useState(0);
  const [minHeight, setMinHeight] = useState<number | undefined>();
  const reserve = dirty ? barHeight + noticeOffset : 0;

  useEffect(() => {
    if (!dirty) {
      setBarHeight(0);
      return;
    }
    const node = barRef.current;
    if (!node) return;
    const measure = () => setBarHeight(Math.ceil(node.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [dirty, bar]);

  useEffect(() => {
    if (!dirty) {
      setNoticeOffset(0);
      return;
    }
    const measure = () => {
      const notice = document.querySelector<HTMLElement>('[aria-label="Cookie notice"]');
      if (!notice) {
        setNoticeOffset(0);
        return;
      }
      const box = notice.getBoundingClientRect();
      const onBottom = box.bottom > window.innerHeight - 96 && box.top < window.innerHeight;
      setNoticeOffset(onBottom ? Math.ceil(window.innerHeight - box.top) + 8 : 0);
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const timer = window.setTimeout(measure, 900);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.clearTimeout(timer);
    };
  }, [dirty]);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!page || !dirty) {
      setMinHeight(undefined);
      return;
    }
    const parent = scrollParent(page);
    const parentTop = parent.getBoundingClientRect().top;
    const pageTop = page.getBoundingClientRect().top - parentTop + parent.scrollTop;
    const visible = parent.clientHeight || window.innerHeight;
    if (visible < 100) return;
    setMinHeight(Math.max(visible - pageTop, 0));
  }, [dirty, reserve]);

  const saveMenu = (
    <SaveMenu
      presets={presets}
      saving={saving}
      dirty={dirty}
      blocked={saveBlocked}
      onSave={handleSave}
      onSavePreset={() => setPresetOpen(true)}
      onLoadPreset={onLoadPreset}
      onDeletePreset={onDeletePreset}
      menuLabel="Save options"
      allowPresets={!brandingLocked}
    />
  );

  return (
    <div
      ref={pageRef}
      className="box-border flex min-w-0 flex-col gap-4"
      style={dirty ? { paddingBottom: reserve, minHeight } : undefined}
      data-testid="design-page"
    >
      <PageHeader
        title={newUi ? "Branding" : "Design"}
        subtitle="Brand colors, Client Hub layouts, widgets, and advanced branding for your sub-accounts."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              data-testid="design-dirty"
              className={cn(
                "max-w-full gap-1.5 whitespace-normal",
                dirty
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  : "border-success/40 bg-success/10 text-success",
              )}
            >
              {dirty ? (
                <span className="size-1.5 rounded-full bg-amber-600" aria-hidden />
              ) : (
                <Check className="size-3" aria-hidden />
              )}
              {status}
            </Badge>
            <Button
              type="button"
              variant="outline"
              disabled={!dirty || saving}
              onClick={onDiscard}
              data-testid="design-discard"
            >
              Discard
            </Button>
            {saveMenu}
          </div>
        }
      />

      {error ? <LoadNotice error={error} onRetry={onRetry} /> : null}

      <div className="grid min-w-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {brandingLocked ? null : (
            <Card data-testid="design-brand-colors">
              <CardHeader>
                <CardTitle>Brand colors</CardTitle>
                <CardDescription>
                  Primary highlight and sidebar background. They update the preview and save with the
                  rest of this page.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorPicker
                    label="Highlight color"
                    color={draft.primaryColor}
                    onChange={(primaryColor) => onPatch({ primaryColor })}
                  />
                  <ColorPicker
                    label="Sidebar background"
                    color={draft.sidebarBgColor}
                    onChange={(sidebarBgColor) => onPatch({ sidebarBgColor })}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={onUndo}>
                    <Undo />
                    Undo color change
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {themeLocked ? (
            <PlanLock
              testId="design-theme-lock"
              title="Theme Customizer"
              detail={`The Theme Customizer is included with ${upgradePlanName}.`}
              planName={upgradePlanName}
              onUpgrade={onUpgrade}
            />
          ) : installed ? (
            <Collapsible open={scriptOpen} onOpenChange={setScriptOpen}>
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2"
                data-testid="design-install"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                  <Badge className="bg-success text-success-foreground">Installed</Badge>
                  <span className="font-medium">Theme Customizer installed</span>
                  <span className="text-muted-foreground">
                    Detected in your HighLevel Custom JS
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="link" className="h-auto px-0">
                      View script
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto px-0"
                    onClick={() => setWhyOpen((open) => !open)}
                  >
                    Why?
                  </Button>
                </div>
              </div>
              <CollapsibleContent className="pt-2">
                {scriptBlock(script, onCopyScript)}
              </CollapsibleContent>
              {whyOpen ? (
                <div className="pt-2">
                  <InstallUpdateNote />
                </div>
              ) : null}
            </Collapsible>
          ) : (
            <Card data-testid="design-install">
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Required
                  </p>
                  <Badge
                    variant="outline"
                    className="border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200"
                  >
                    Not detected
                  </Badge>
                </div>
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                  Install Theme Customizer
                  <Badge variant="secondary">Beta</Badge>
                  <span className="text-sm font-normal text-muted-foreground">
                    Full release Nov 1
                  </span>
                </CardTitle>
                <CardDescription>
                  Paste this script into HighLevel once. Your styles won't show in sub-accounts
                  until it's installed.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    [
                      "1",
                      "Open Custom JS",
                      "HighLevel › Settings › Company › White Label › Custom JS",
                    ],
                    [
                      "2",
                      "Paste the script",
                      "Replace any older SaaS Suite script, keep your other Custom JS",
                    ],
                    [
                      "3",
                      "Save & refresh",
                      "Refresh HighLevel. This badge turns green when we detect it.",
                    ],
                  ].map(([step, title, body]) => (
                    <div key={step} className="rounded-lg border bg-card p-3">
                      <span className="mb-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                        {step}
                      </span>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
                    </div>
                  ))}
                </div>
                {scriptBlock(script, onCopyScript)}
                <Alert className="border-amber-500/40 bg-amber-500/10">
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-amber-950 dark:text-amber-100">
                    <span>
                      Already installed an older version? Update your HighLevel Custom JS so themes
                      save per sub-account.
                    </span>
                    <Collapsible open={whyOpen} onOpenChange={setWhyOpen}>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto px-0 text-amber-950 dark:text-amber-100"
                        >
                          Why?
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="basis-full pt-2">
                        <InstallUpdateNote />
                      </CollapsibleContent>
                    </Collapsible>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          )}

          {sidebarWarning ? (
            <label
              ref={confirmRef}
              id="design-sidebar-confirm"
              className="flex scroll-mt-24 items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              <Checkbox
                checked={sidebarModeConfirmed}
                onCheckedChange={(checked) => onConfirmSidebar(checked === true)}
                aria-required="true"
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Required before saving. </span>
                {sidebarWarning}
              </span>
            </label>
          ) : null}

          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (
                value === "style" ||
                value === "layout" ||
                value === "widgets" ||
                value === "advanced"
              )
                onTab(value);
            }}
          >
            <TabsList className="flex h-auto w-full items-center justify-start gap-x-4 gap-y-2 bg-transparent p-0 max-xl:!grid max-xl:!grid-cols-2 max-xl:!overflow-visible xl:!flex-wrap">
              {TABS.map((item) => {
                const checked = tabChecked(item.id, tab, draft);
                const active = tab === item.id;
                const sectionLocked =
                  brandingLocked && (item.id === "style" || item.id === "advanced");
                return (
                  <div key={item.id} className="inline-flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-bold leading-none",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                      aria-hidden
                    >
                      {item.step}
                    </span>
                    <TabsTrigger
                      value={item.id}
                      data-testid={`design-tab-${item.id}`}
                      aria-label={`${item.step} ${item.label}`}
                      className="gap-2 rounded-full px-3 font-bold data-[state=active]:bg-background"
                    >
                      {sectionLocked ? (
                        <Lock className="size-3.5" aria-hidden />
                      ) : checked ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : null}
                      {item.label}
                    </TabsTrigger>
                  </div>
                );
              })}
            </TabsList>

            <TabsContent value="style" className="mt-3">
              {brandingLocked ? (
                <PlanLock
                  testId="design-branding-lock"
                  title="Branding tool"
                  detail={`The branding tool is included with ${upgradePlanName}.`}
                  planName={upgradePlanName}
                  onUpgrade={onUpgrade}
                />
              ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Sidebar style</CardTitle>
                  <CardDescription>Choose a sidebar style for your sub-accounts.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div
                    className="grid gap-3 sm:grid-cols-2"
                    role="radiogroup"
                    aria-label="Sidebar style"
                  >
                    {STYLES.map((style) => {
                      const selected = draft.sidebarStyle === style.id;
                      return (
                        <Button
                          variant="ghost"
                          key={style.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={loading || saving}
                          onClick={() => onPatch({ sidebarStyle: style.id })}
                          className={cn(
                            "h-auto flex-col items-stretch whitespace-normal overflow-hidden rounded-lg border bg-card p-0 text-left",
                            selected ? "border-primary ring-2 ring-primary/20" : "border-border",
                          )}
                        >
                          <div className="relative">
                            <StyleThumb id={style.id} />
                            <span
                              className={cn(
                                "absolute right-2 top-2 size-4 rounded-full border-2",
                                selected
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/40 bg-background",
                              )}
                            />
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-semibold">{style.name}</p>
                            <p className="text-xs text-muted-foreground">{style.detail}</p>
                            {savedStyle === style.id ? (
                              <Badge className="mt-2">Applied</Badge>
                            ) : null}
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                  {draft.sidebarStyle === "switchyard" && <section className="space-y-4 border-t pt-4">
                    <div className="flex items-center justify-between gap-3"><Label htmlFor="switchyard-customizer">Theme Customizer in HighLevel</Label><Switch id="switchyard-customizer" checked={draft.customizerEnabled !== false} onCheckedChange={customizerEnabled => onPatch({ customizerEnabled })} /></div>
                    <div className="grid gap-4 sm:grid-cols-2">{SWITCHYARD_FIELDS.map(([key,label]) => <ColorPicker key={key} label={label} color={cleanSwitchyardColors(draft.switchyard)[key]} onChange={value => onPatch({ switchyard: { ...cleanSwitchyardColors(draft.switchyard), [key]: value } })} />)}</div>
                  </section>}
                  <FaviconControl value={draft.faviconUrl || ""} onChange={faviconUrl => onPatch({ faviconUrl })} disabled={loading || saving} />
                  <p className="text-sm text-muted-foreground">
                    Agency name and logo are managed in Settings.{" "}
                    <Link
                      to="/app/settings"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Edit in Settings →
                    </Link>
                  </p>
                </CardContent>
                <CardFooter className="flex-wrap gap-2">
                  {savedStyle !== null ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={loading || saving}
                          data-testid="design-turn-off-branding"
                        >
                          Turn off branding
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This turns off sidebar branding for your sub-accounts. Login, buttons,
                            and other customizations stay as they are.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={saving}
                            onClick={onRemoveBranding}
                            data-testid="design-turn-off-branding-confirm"
                          >
                            Turn off branding
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => onTab("layout")}
                  >
                    Next: Layout →
                  </Button>
                </CardFooter>
              </Card>
              )}
            </TabsContent>

            <TabsContent value="layout" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle>Client Hub layout</CardTitle>
                  <CardDescription>
                    Pick how the Client Hub looks inside each sub-account. Simplified Onboarding is
                    one of the options.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
                    role="radiogroup"
                    aria-label="Client Hub layout"
                  >
                    {LAYOUTS.map((layout) => {
                      const selected = draft.layout === layout.id;
                      return (
                        <button
                          key={layout.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={loading || saving}
                          onClick={() => onPatch({ layout: layout.id, layoutKnown: true })}
                          className={cn(
                            "overflow-hidden rounded-xl border bg-card text-left",
                            selected ? "border-primary ring-2 ring-primary/20" : "border-border",
                          )}
                        >
                          <div className="relative">
                            <LayoutThumb id={layout.id} />
                            <span
                              className={cn(
                                "absolute right-2 top-2 size-4 rounded-full border-2",
                                selected
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/40 bg-background",
                              )}
                            />
                          </div>
                          <div className="p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">{layout.name}</p>
                              {savedLayout === layout.id ? (
                                <Badge variant="secondary">Current</Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground">{layout.detail}</p>
                          </div>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={onOpenSimplified}
                      className="overflow-hidden rounded-xl border border-border bg-card text-left"
                    >
                      <div className="flex h-20 flex-col justify-center gap-1 bg-muted p-3">
                        <span className="size-2 rounded-full bg-success" />
                        <span className="h-1.5 w-3/4 rounded-full bg-background" />
                        <span className="h-1.5 w-1/2 rounded-full bg-background" />
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold">Simplified Onboarding</p>
                        <p className="text-xs text-muted-foreground">Step-by-step checklist</p>
                      </div>
                    </button>
                  </div>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onTab("style")}>
                    ← Style
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onTab("widgets")}>
                    Next: Widgets →
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="widgets" className="mt-3">
              <Card data-testid="design-widgets">
                <CardHeader>
                  <CardTitle>Popup & help widgets</CardTitle>
                  <CardDescription>
                    A chat-style launcher that opens your Client Hub. It shows up in sub-accounts
                    that have your installation code.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Bottom right chat popup</p>
                      <p className="text-xs text-muted-foreground">
                        Floating button in the bottom-right corner of HighLevel
                      </p>
                    </div>
                    <Switch
                      checked={draft.popupEnabled}
                      onCheckedChange={(value) => onPatch({ popupEnabled: value })}
                      aria-label="Bottom right chat popup"
                      data-testid="design-widget-popup"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Top Navigation Help Widget</p>
                      <p className="text-xs text-muted-foreground">
                        Help button in the HighLevel top navigation bar
                      </p>
                    </div>
                    <Switch
                      checked={draft.topNav.enabled}
                      onCheckedChange={(value) =>
                        onPatch({ topNav: { ...draft.topNav, enabled: value } })
                      }
                      aria-label="Top navigation help widget"
                      data-testid="design-widget-top-nav"
                    />
                  </div>
                  {draft.topNav.enabled ? (
                    <TopNavWidgetCard
                      email={email}
                      colors={widgetColors}
                      hideToggle
                      controlled={{
                        state: draft.topNav,
                        onChange: (topNav) => onPatch({ topNav }),
                      }}
                    />
                  ) : null}
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => onTab("layout")}>
                    ← Layout
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onTab("advanced")}>
                    Next: Advanced →
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="mt-3">
              {brandingLocked ? (
                <PlanLock
                  testId="design-branding-lock"
                  title="Branding tool"
                  detail={`Login, buttons, and mobile branding are part of the branding tool, included with ${upgradePlanName}.`}
                  planName={upgradePlanName}
                  onUpgrade={onUpgrade}
                />
              ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Advanced</CardTitle>
                  <CardDescription>
                    Optional extras. Turn one on to see its settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <section className="rounded-lg border">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Login Page Customization</p>
                        <p className="text-xs text-muted-foreground">
                          Custom background, logo and styled login form
                        </p>
                      </div>
                      <Switch
                        checked={draft.loginCustomEnabled}
                        onCheckedChange={(value) => onPatch({ loginCustomEnabled: value })}
                        aria-label="Login page customization"
                      />
                    </div>
                    {draft.loginCustomEnabled ? (
                      <div className="flex flex-col gap-4 border-t p-3">
                        <LoginCustomizationPanel
                          hideHeader
                          enabled
                          onToggle={(value) => onPatch({ loginCustomEnabled: value })}
                          selectedBackground={draft.loginBackground}
                          onBackgroundChange={(loginBackground) => onPatch({ loginBackground })}
                          logoUrl={draft.loginLogoUrl}
                          onLogoUrlChange={(loginLogoUrl) => onPatch({ loginLogoUrl })}
                        />
                        <ColorPicker
                          label="Login & Top Button Color"
                          color={draft.primaryColor}
                          onChange={(primaryColor) => onPatch({ primaryColor })}
                        />
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-lg border">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Top Button Customization</p>
                        <p className="text-xs text-muted-foreground">
                          Styled navigation buttons with gradient hover effects
                        </p>
                      </div>
                      <Switch
                        checked={draft.buttonCustomEnabled}
                        onCheckedChange={(value) => onPatch({ buttonCustomEnabled: value })}
                        aria-label="Top button customization"
                      />
                    </div>
                    {draft.buttonCustomEnabled ? (
                      <div className="flex flex-col gap-4 border-t p-3">
                        <ButtonCustomizationPanel
                          hideHeader
                          enabled
                          onToggle={(value) => onPatch({ buttonCustomEnabled: value })}
                          primaryColor={draft.primaryColor}
                        />
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Custom top button gradient</p>
                            <p className="text-xs text-muted-foreground">
                              Override the gradient used for active and hover states.
                            </p>
                          </div>
                          <Switch
                            checked={draft.topGradientCustomEnabled}
                            onCheckedChange={(value) =>
                              onPatch({ topGradientCustomEnabled: value })
                            }
                            aria-label="Custom top button gradient"
                          />
                        </div>
                        {draft.topGradientCustomEnabled ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <ColorPicker
                              label="Top Gradient Start"
                              color={draft.topGradientStart}
                              onChange={(topGradientStart) => onPatch({ topGradientStart })}
                            />
                            <ColorPicker
                              label="Top Gradient End"
                              color={draft.topGradientEnd}
                              onChange={(topGradientEnd) => onPatch({ topGradientEnd })}
                            />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-lg border">
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">Mobile Branding</p>
                          <Badge variant="secondary">Beta</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Full-screen branded menu, full-width pages, smoother scrolling and zoom
                          controls on mobile
                        </p>
                      </div>
                      <Switch
                        checked={draft.mobileEnabled}
                        onCheckedChange={(value) => onPatch({ mobileEnabled: value })}
                        aria-label="Mobile branding"
                      />
                    </div>
                    {draft.mobileEnabled ? (
                      <div className="border-t p-3">
                        <MobileBrandingCard
                          email={email}
                          colors={widgetColors}
                          hideChrome
                          controlled={{
                            enabled: draft.mobileEnabled,
                            menuColor: draft.mobileMenuColor,
                            zoomEnabled: draft.mobileZoomEnabled,
                            onChange: (next) =>
                              onPatch({
                                mobileEnabled: next.enabled,
                                mobileMenuColor: next.menuColor,
                                mobileZoomEnabled: next.zoomEnabled,
                              }),
                          }}
                        />
                      </div>
                    ) : null}
                  </section>

                  <Collapsible open={sidebarDetails} onOpenChange={setSidebarDetails}>
                    <div className="rounded-lg border">
                      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-3 text-left">
                        <div>
                          <p className="text-sm font-medium">Sidebar details</p>
                          <p className="text-xs text-muted-foreground">Font, icons, and motion</p>
                        </div>
                        <ChevronDown
                          className={cn(
                            "size-4 text-muted-foreground",
                            sidebarDetails && "rotate-180",
                          )}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="flex flex-col gap-4 border-t p-3">
                        <FontSelector
                          selectedFont={draft.font}
                          onSelectFont={(font) => onPatch({ font })}
                        />
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="branding-icons">Icon style</Label>
                          <Select
                            value={draft.iconPack}
                            onValueChange={(iconPack) => onPatch({ iconPack })}
                          >
                            <SelectTrigger id="branding-icons">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                ["default", "Original HighLevel"],
                                ["lucide", "Lucide"],
                                ["phosphor", "Phosphor"],
                                ["tabler", "Tabler"],
                                ["phosphor-duotone", "Phosphor duotone"],
                              ].map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            id="branding-motion"
                            checked={draft.motion}
                            onCheckedChange={(motion) => onPatch({ motion })}
                          />
                          <Label htmlFor="branding-motion">Navigation animations</Label>
                        </div>
                        {draft.sidebarStyle === "v2" ? (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">Simple sidebar gradient</p>
                                <p className="text-xs text-muted-foreground">
                                  Override the gradient used for active sidebar buttons.
                                </p>
                              </div>
                              <Switch
                                checked={draft.gradientCustomEnabled}
                                onCheckedChange={(gradientCustomEnabled) =>
                                  onPatch({ gradientCustomEnabled })
                                }
                                aria-label="Simple sidebar gradient"
                              />
                            </div>
                            {draft.gradientCustomEnabled ? (
                              <div className="grid gap-4 sm:grid-cols-2">
                                <ColorPicker
                                  label="Gradient Start"
                                  color={draft.gradientStart}
                                  onChange={(gradientStart) => onPatch({ gradientStart })}
                                />
                                <ColorPicker
                                  label="Gradient End"
                                  color={draft.gradientEnd}
                                  onChange={(gradientEnd) => onPatch({ gradientEnd })}
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                </CardContent>
                <CardFooter className="justify-end">
                  <Button type="button" variant="outline" onClick={() => onTab("widgets")}>
                    ← Widgets
                  </Button>
                </CardFooter>
              </Card>
              )}
            </TabsContent>
          </Tabs>

          {dirty ? null : (
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={onBack}
              data-testid="design-back"
            >
              Back
            </Button>
          )}
        </div>

        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardContent className="pt-6">
              <DesignPreview
                draft={draft}
                surface={surface}
                device={device}
                onSurface={onSurface}
                onDevice={onDevice}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {dirty ? (
        <div
          ref={barRef}
          className="pointer-events-none fixed left-0 right-0 z-40 flex flex-col items-start gap-2 px-3 pb-3 md:pr-24 md:left-[var(--sidebar-width)] md:w-[calc(100%-var(--sidebar-width))] lg:w-[calc(100%-var(--sidebar-width)-var(--copilot-dock-offset,0px))]"
          style={{ bottom: noticeOffset }}
          data-testid="design-save-bar"
        >
          <Button
            type="button"
            variant="outline"
            className="pointer-events-auto bg-background shadow-sm"
            onClick={onBack}
            data-testid="design-back"
          >
            Back
          </Button>
          <div className="pointer-events-auto mx-auto flex w-full max-w-[1400px] flex-col gap-2 rounded-xl bg-foreground px-3 py-2.5 text-background sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
            <p className="min-w-0 text-sm leading-5 sm:truncate">
              {bar}
              {saveBlocked ? (
                <span id="design-save-blocked" className="font-semibold">
                  {" "}
                  — tick the “Required before saving” box at the top first.
                </span>
              ) : null}
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-background/30 bg-transparent text-background hover:bg-background/10"
                onClick={onDiscard}
                disabled={saving}
              >
                Discard
              </Button>
              <Button
                type="button"
                className="bg-background text-foreground hover:bg-background/90"
                onClick={handleSave}
                disabled={saving}
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={presetOpen} onOpenChange={setPresetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as preset</DialogTitle>
            <DialogDescription>
              Saves this sidebar setup. Live branding stays as it is until you save changes.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="preset-name">Preset name</Label>
            <Input
              id="preset-name"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="Name this preset"
            />
          </div>
          <DialogFooter>
            <Button variant="accent"
              type="button"
              disabled={!presetName.trim() || saving || !draft.sidebarStyle}
              onClick={() => {
                onSavePreset(presetName.trim());
                setPresetName("");
                setPresetOpen(false);
              }}
            >
              Save preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InstallUpdateNote() {
  return (
    <div
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
      role="status"
    >
      <p className="font-medium">Update your HighLevel Custom JS</p>
      <p className="mt-1 text-muted-foreground">
        {THEME_INSTALL_UPDATE_NOTE} Leave your Custom CSS line as it is.
      </p>
      <p className="mt-2 text-muted-foreground">
        Until this tag is saved in HighLevel, Customize theme shows “Update your install script in
        SaaSSuite &gt; Design” to whoever can edit.
      </p>
    </div>
  );
}

function scrollParent(node: HTMLElement): HTMLElement {
  let parent = node.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY)) return parent;
    parent = parent.parentElement;
  }
  return document.documentElement;
}

function scriptBlock(script: string, onCopy: () => void) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-background">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">
        {script || "Your agency id is still loading."}
      </code>
      <Button type="button" size="sm" variant="secondary" disabled={!script} onClick={onCopy}>
        <Copy data-icon="inline-start" />
        Copy script
      </Button>
    </div>
  );
}
