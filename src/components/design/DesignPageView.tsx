import { FaviconControl } from "@/components/branding/FaviconControl";
import { SWITCHYARD_FIELDS, cleanSwitchyardColors } from "../../../supabase/functions/_shared/switchyardTheme";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { newUi } from "@/lib/uiVersion";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { SectionCard } from "@/components/premium/SectionCard";
import { ChoiceCard, StudioSteps, ToggleSection } from "@/components/premium/branding/studio";
import { DesignPreview } from "@/components/design/DesignPreview";
import LoginCustomizationPanel from "@/components/branding/LoginCustomizationPanel";
import ButtonCustomizationPanel from "@/components/branding/ButtonCustomizationPanel";
import MobileBrandingCard from "@/components/client-hub/MobileBrandingCard";
import TopNavWidgetCard from "@/components/client-hub/TopNavWidgetCard";
import ColorPicker from "@/components/ColorPicker";
import FontSelector from "@/components/FontSelector";
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
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, slideStep } from "@/lib/motion";
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
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  CircleCheck,
  Code2,
  Copy,
  HelpCircle,
  LayoutGrid,
  Loader2,
  Lock,
  LogIn,
  MessageCircle,
  MousePointerClick,
  Palette,
  PanelLeft,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Undo,
} from "lucide-react";

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

const TABS: { id: DesignTab; label: string; hint: string }[] = [
  { id: "style", label: "Style", hint: "Colors, sidebar" },
  { id: "layout", label: "Layout", hint: "Client Hub" },
  { id: "widgets", label: "Widgets", hint: "Popup, help" },
  { id: "advanced", label: "Advanced", hint: "Extras" },
];

const PANEL_ID = "design-step-panel";

/** Small picture of each sidebar style, drawn in the colors being edited. */
function StyleThumb({
  id,
  accent,
  sidebar,
}: {
  id: SidebarStyle;
  accent: string;
  sidebar: string;
}) {
  const rows = (
    <>
      <span className="h-1.5 w-full rounded-full bg-muted-foreground/25" />
      <span className="h-1.5 w-full rounded-full bg-muted-foreground/25" />
      <span className="h-1.5 w-full rounded-full" style={{ background: accent }} />
      <span className="h-1.5 w-full rounded-full bg-muted-foreground/25" />
    </>
  );
  const content = (
    <div className="flex flex-1 flex-col gap-1.5 p-2">
      <span className="h-2 w-10 rounded-full bg-muted-foreground/30" />
      <span className="flex-1 rounded-md bg-muted" />
    </div>
  );
  if (id === "v1") {
    return (
      <div className="flex h-28 p-3">
        <div className="flex flex-1 overflow-hidden rounded-md border border-border bg-card shadow-card">
          <div className="flex w-12 flex-col gap-1.5 p-2" style={{ background: sidebar || "hsl(var(--foreground))" }}>
            {rows}
          </div>
          {content}
        </div>
      </div>
    );
  }
  if (id === "v2") {
    return (
      <div className="flex h-28 p-3">
        <div className="flex flex-1 overflow-hidden rounded-md border border-border bg-card shadow-card">
          <div className="m-1.5 flex w-11 flex-col gap-1.5 rounded-md border border-border p-1.5">{rows}</div>
          {content}
        </div>
      </div>
    );
  }
  if (id === "v3") {
    return (
      <div className="flex h-28 p-3">
        <div className="flex flex-1 overflow-hidden rounded-md border border-border bg-card shadow-card">
          <div className="flex w-7 flex-col items-center gap-1.5 border-r border-border py-2">
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            <span className="size-2 rounded-full bg-muted-foreground/30" />
            <span className="size-2 rounded-full" style={{ background: accent }} />
            <span className="size-2 rounded-full bg-muted-foreground/30" />
          </div>
          {content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-28 p-3">
      <div className="flex flex-1 overflow-hidden rounded-md border border-border bg-card shadow-card">
        <div className="w-3 bg-foreground/80" />
        <div className="flex w-12 flex-col gap-1.5 bg-muted/70 p-2">{rows}</div>
        <div className="flex flex-1 flex-col">
          <div className="h-4 border-b border-border" />
          <div className="m-2 flex-1 rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}

function LayoutThumb({ id }: { id: number }) {
  if (id === 1) {
    return (
      <div className="grid h-24 grid-cols-3 gap-1.5 p-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-sm bg-brand/20" />
        ))}
      </div>
    );
  }
  if (id === 3) {
    return (
      <div className="grid h-24 grid-cols-5 gap-1.5 p-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <span className="flex-1 rounded-sm bg-brand/25" />
          <span className="flex-1 rounded-sm bg-card" />
          <span className="flex-1 rounded-sm bg-card" />
        </div>
        <div className="col-span-3 rounded-sm bg-card shadow-card" />
      </div>
    );
  }
  if (id === 4) {
    return (
      <div className="flex h-24 flex-col justify-center gap-1.5 bg-foreground p-4">
        <div className="h-2 w-10 rounded-full bg-brand" />
        <div className="h-1.5 w-full rounded-full bg-background/20" />
        <div className="h-1.5 w-4/5 rounded-full bg-background/20" />
      </div>
    );
  }
  if (id === 0) {
    return (
      <div className="flex h-24 flex-col justify-center gap-2 p-4">
        {[true, true, false].map((done, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className={cn("size-2.5 rounded-full", done ? "bg-success" : "bg-muted-foreground/30")} />
            <span className="h-1.5 flex-1 rounded-full bg-card" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-24 flex-col gap-1.5 p-3">
      <div className="h-8 rounded-sm bg-brand/20" />
      <div className="grid flex-1 grid-cols-2 gap-1.5">
        <div className="rounded-sm bg-card" />
        <div className="rounded-sm bg-card" />
      </div>
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
    <div data-testid={testId}>
      <SectionCard
        icon={<Lock />}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {title}
            <Badge variant="brand">Upgrade</Badge>
          </span>
        }
        description={detail}
      >
        <Button type="button" variant="accent" onClick={onUpgrade} data-testid={`${testId}-upgrade`}>
          Upgrade to {planName}
        </Button>
      </SectionCard>
    </div>
  );
}

/** Back and Next at the foot of each step. */
function StepNav({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">{start}</div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{end}</div>
    </div>
  );
}

function PresetMenu({
  presets,
  saving,
  onSavePreset,
  onLoadPreset,
  onDeletePreset,
}: {
  presets: BrandingPreset[];
  saving: boolean;
  onSavePreset: () => void;
  onLoadPreset: (preset: BrandingPreset) => void;
  onDeletePreset: (preset: BrandingPreset) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" data-testid="design-save-menu">
          <Bookmark aria-hidden />
          Presets
          <ChevronDown className="text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onSavePreset} className="gap-2 font-medium">
            <Plus className="size-4 text-brand" aria-hidden />
            Save as preset…
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-eyebrow">Saved presets</DropdownMenuLabel>
        <DropdownMenuGroup className="max-h-64 overflow-y-auto">
          {presets.length ? (
            presets.map((preset) => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => onLoadPreset(preset)}
                className="group/preset gap-2 py-1.5 pr-1"
              >
                <span className="min-w-0 flex-1 truncate">{preset.name}</span>
                <span className="text-xs font-medium text-muted-foreground group-data-[highlighted]/preset:text-brand">
                  Load
                </span>
                <button
                  type="button"
                  aria-label={`Delete preset ${preset.name}`}
                  title="Delete preset"
                  data-testid="design-preset-delete"
                  disabled={saving}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No presets yet. Save this setup to reuse it later.
            </p>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
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
  const [nudge, setNudge] = useState(0);
  const handleSave = () => {
    if (saveBlocked) {
      confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setNudge((count) => count + 1);
    }
    onSave();
  };
  // Steps slide in from the side you are travelling to.
  const tabIndex = TABS.findIndex((item) => item.id === tab);
  const lastTabIndex = useRef(tabIndex);
  const direction = tabIndex >= lastTabIndex.current ? 1 : -1;
  useEffect(() => {
    lastTabIndex.current = tabIndex;
  }, [tabIndex]);
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

  const steps = TABS.map((item) => ({
    id: item.id,
    label: item.label,
    hint: item.hint,
    done: tabChecked(item.id, tab, draft),
    locked: brandingLocked && (item.id === "style" || item.id === "advanced"),
  }));
  const busy = loading || saving;

  return (
    <div
      ref={pageRef}
      className="box-border flex min-w-0 flex-col gap-6"
      style={dirty ? { paddingBottom: reserve, minHeight } : undefined}
      data-testid="design-page"
    >
      <PageHeader
        title={newUi ? "Branding" : "Design"}
        subtitle="Make HighLevel look like your own product. Work through the four steps and watch the preview update."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={dirty ? "warning" : "success"}
              data-testid="design-dirty"
              className="max-w-full gap-1.5 whitespace-normal py-1"
            >
              {dirty ? (
                <span className="size-1.5 shrink-0 rounded-full bg-warning" aria-hidden />
              ) : (
                <Check className="size-3 shrink-0" aria-hidden />
              )}
              {status}
            </Badge>
            {brandingLocked ? null : (
              <PresetMenu
                presets={presets}
                saving={saving}
                onSavePreset={() => setPresetOpen(true)}
                onLoadPreset={onLoadPreset}
                onDeletePreset={onDeletePreset}
              />
            )}
          </div>
        }
      />

      {error ? <LoadNotice error={error} onRetry={onRetry} /> : null}

      {/* Columns follow the room this page really has, so an open Copilot panel stacks them. */}
      <div className="min-w-0 flex-1 [container-type:inline-size]">
      <div className="grid min-w-0 gap-6 [@container(min-width:880px)]:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="flex min-w-0 flex-col gap-4">
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
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-success/25 bg-success/10 px-4 py-2.5"
                data-testid="design-install"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                  <CircleCheck className="size-4 shrink-0 text-success" aria-hidden />
                  <span className="font-medium text-foreground">Theme Customizer installed</span>
                  <span className="hidden text-muted-foreground 2xl:inline">Detected in your HighLevel Custom JS</span>
                </div>
                <div className="flex items-center gap-4">
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="link" className="h-auto min-h-0 px-0 text-sm">
                      View script
                    </Button>
                  </CollapsibleTrigger>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto min-h-0 px-0 text-sm"
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
            <div data-testid="design-install">
              <SectionCard
                icon={<Code2 />}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    Install Theme Customizer
                    <Badge variant="secondary">Beta</Badge>
                    <span className="text-sm font-normal text-muted-foreground">Full release Nov 1</span>
                  </span>
                }
                description="Paste this script into HighLevel once. Your styles won't show in sub-accounts until it's installed."
                actions={
                  <div className="flex items-center gap-2">
                    <span className="px-eyebrow">Required</span>
                    <Badge variant="warning">Not detected</Badge>
                  </div>
                }
                bodyClassName="flex flex-col gap-3"
              >
                <ol className="grid gap-2 sm:grid-cols-3">
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
                    <li key={step} className="rounded-md border border-border bg-muted/40 p-3">
                      <span className="mb-2 inline-flex size-6 items-center justify-center rounded-full bg-brand-subtle text-xs font-semibold text-brand">
                        {step}
                      </span>
                      <p className="text-sm font-medium">{title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
                    </li>
                  ))}
                </ol>
                {scriptBlock(script, onCopyScript)}
                <Collapsible open={whyOpen} onOpenChange={setWhyOpen}>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                    <span>
                      Already installed an older version? Update your HighLevel Custom JS so themes
                      save per sub-account.
                    </span>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="link" className="h-auto min-h-0 px-0 text-foreground">
                        Why?
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="pt-2">
                    <InstallUpdateNote />
                  </CollapsibleContent>
                </Collapsible>
              </SectionCard>
            </div>
          )}

          {brandingLocked ? null : (
            <div data-testid="design-brand-colors">
              <SectionCard
                icon={<Palette />}
                title="Brand colors"
                description="Your highlight and sidebar background. They carry through every step."
              >
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
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={onUndo}
                  >
                    <Undo />
                    Undo color change
                  </Button>
                </div>
              </SectionCard>
            </div>
          )}

          <StudioSteps
            steps={steps}
            active={tab}
            onChange={(value) => {
              if (
                value === "style" ||
                value === "layout" ||
                value === "widgets" ||
                value === "advanced"
              )
                onTab(value);
            }}
            label="Branding steps"
            testIdPrefix="design-tab"
            panelId={PANEL_ID}
          />

          <motion.div
            key={tab}
            id={PANEL_ID}
            role="tabpanel"
            aria-labelledby={`design-tab-${tab}`}
            custom={direction}
            variants={slideStep}
            initial="enter"
            animate="center"
            className="flex min-w-0 flex-col gap-4"
          >
            {tab === "style" ? (
              brandingLocked ? (
                <PlanLock
                  testId="design-branding-lock"
                  title="Branding tool"
                  detail={`The branding tool is included with ${upgradePlanName}.`}
                  planName={upgradePlanName}
                  onUpgrade={onUpgrade}
                />
              ) : (
                <>
                  <SectionCard
                    icon={<PanelLeft />}
                    title="Sidebar style"
                    description="Choose a sidebar style for your sub-accounts."
                  >
                    <div
                      className="grid gap-3 sm:grid-cols-2"
                      role="radiogroup"
                      aria-label="Sidebar style"
                    >
                      {STYLES.map((style) => (
                        <ChoiceCard
                          key={style.id}
                          selected={draft.sidebarStyle === style.id}
                          disabled={busy}
                          onSelect={() => onPatch({ sidebarStyle: style.id })}
                          thumb={
                            <StyleThumb
                              id={style.id}
                              accent={draft.primaryColor}
                              sidebar={draft.sidebarBgColor}
                            />
                          }
                          title={style.name}
                          detail={style.detail}
                          badge={
                            savedStyle === style.id ? <Badge variant="success">Applied</Badge> : null
                          }
                        />
                      ))}
                    </div>
                    {draft.sidebarStyle === "switchyard" ? (
                      <section className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-muted/40 p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="switchyard-customizer">Theme Customizer in HighLevel</Label>
                          <Switch
                            id="switchyard-customizer"
                            checked={draft.customizerEnabled !== false}
                            onCheckedChange={(customizerEnabled) => onPatch({ customizerEnabled })}
                          />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {SWITCHYARD_FIELDS.map(([key, label]) => (
                            <ColorPicker
                              key={key}
                              label={label}
                              color={cleanSwitchyardColors(draft.switchyard)[key]}
                              onChange={(value) =>
                                onPatch({
                                  switchyard: { ...cleanSwitchyardColors(draft.switchyard), [key]: value },
                                })
                              }
                            />
                          ))}
                        </div>
                      </section>
                    ) : null}
                    <div className="mt-4">
                      <FaviconControl
                        value={draft.faviconUrl || ""}
                        onChange={(faviconUrl) => onPatch({ faviconUrl })}
                        disabled={busy}
                      />
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Agency name and logo are managed in Settings.{" "}
                      <Link
                        to="/app/settings"
                        className="font-medium text-brand underline-offset-4 hover:underline"
                      >
                        Edit in Settings
                      </Link>
                    </p>
                    <StepNav
                      start={
                        savedStyle !== null ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                data-testid="design-turn-off-branding"
                              >
                                Turn off branding
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This turns off sidebar branding for your sub-accounts. Login,
                                  buttons, and other customizations stay as they are.
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
                        ) : null
                      }
                      end={
                        <Button type="button" variant="outline" onClick={() => onTab("layout")}>
                          Next: Layout
                          <ArrowRight aria-hidden />
                        </Button>
                      }
                    />
                  </SectionCard>
                </>
              )
            ) : null}

            {tab === "layout" ? (
              <SectionCard
                icon={<LayoutGrid />}
                title="Client Hub layout"
                description="Pick how the Client Hub looks inside each sub-account."
              >
                <div
                  className="grid gap-3 sm:grid-cols-2"
                  role="radiogroup"
                  aria-label="Client Hub layout"
                >
                  {LAYOUTS.map((layout) => (
                    <ChoiceCard
                      key={layout.id}
                      selected={draft.layout === layout.id}
                      disabled={busy}
                      onSelect={() => onPatch({ layout: layout.id, layoutKnown: true })}
                      thumb={<LayoutThumb id={layout.id} />}
                      title={layout.name}
                      detail={layout.detail}
                      badge={savedLayout === layout.id ? <Badge variant="success">Current</Badge> : null}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={onOpenSimplified}
                  className="group mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-left transition-colors hover:border-brand/40 hover:bg-brand-subtle/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
                >
                  <span className="px-icon-chip shrink-0" aria-hidden>
                    <CircleCheck className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">
                      Simplified Onboarding
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Prefer a step-by-step checklist? It has its own page.
                    </span>
                  </span>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
                    aria-hidden
                  />
                </button>
                <StepNav
                  start={
                    <Button type="button" variant="ghost" onClick={() => onTab("style")}>
                      <ArrowLeft aria-hidden />
                      Style
                    </Button>
                  }
                  end={
                    <Button type="button" variant="outline" onClick={() => onTab("widgets")}>
                      Next: Widgets
                      <ArrowRight aria-hidden />
                    </Button>
                  }
                />
              </SectionCard>
            ) : null}

            {tab === "widgets" ? (
              <div data-testid="design-widgets">
                <SectionCard
                  icon={<MessageCircle />}
                  title="Popup & help widgets"
                  description="Launchers that open your Client Hub from inside HighLevel. They show in sub-accounts that have your installation code."
                  bodyClassName="flex flex-col gap-3"
                >
                  <ToggleSection
                    icon={<MessageCircle />}
                    title="Bottom right chat popup"
                    detail="Floating button in the bottom-right corner of HighLevel"
                    checked={draft.popupEnabled}
                    onCheckedChange={(value) => onPatch({ popupEnabled: value })}
                    switchLabel="Bottom right chat popup"
                    switchTestId="design-widget-popup"
                  />
                  <ToggleSection
                    icon={<HelpCircle />}
                    title="Top Navigation Help Widget"
                    detail="Help button in the HighLevel top navigation bar"
                    checked={draft.topNav.enabled}
                    onCheckedChange={(value) =>
                      onPatch({ topNav: { ...draft.topNav, enabled: value } })
                    }
                    switchLabel="Top navigation help widget"
                    switchTestId="design-widget-top-nav"
                  >
                    <TopNavWidgetCard
                      email={email}
                      colors={widgetColors}
                      hideToggle
                      controlled={{
                        state: draft.topNav,
                        onChange: (topNav) => onPatch({ topNav }),
                      }}
                    />
                  </ToggleSection>
                  <StepNav
                    start={
                      <Button type="button" variant="ghost" onClick={() => onTab("layout")}>
                        <ArrowLeft aria-hidden />
                        Layout
                      </Button>
                    }
                    end={
                      <Button type="button" variant="outline" onClick={() => onTab("advanced")}>
                        Next: Advanced
                        <ArrowRight aria-hidden />
                      </Button>
                    }
                  />
                </SectionCard>
              </div>
            ) : null}

            {tab === "advanced" ? (
              brandingLocked ? (
                <PlanLock
                  testId="design-branding-lock"
                  title="Branding tool"
                  detail={`Login, buttons, and mobile branding are part of the branding tool, included with ${upgradePlanName}.`}
                  planName={upgradePlanName}
                  onUpgrade={onUpgrade}
                />
              ) : (
                <SectionCard
                  icon={<SlidersHorizontal />}
                  title="Advanced"
                  description="Optional extras. Turn one on to see its settings."
                  bodyClassName="flex flex-col gap-3"
                >
                  <ToggleSection
                    icon={<LogIn />}
                    title="Login Page Customization"
                    detail="Custom background, logo and styled login form"
                    checked={draft.loginCustomEnabled}
                    onCheckedChange={(value) => onPatch({ loginCustomEnabled: value })}
                    switchLabel="Login page customization"
                  >
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
                  </ToggleSection>

                  <ToggleSection
                    icon={<MousePointerClick />}
                    title="Top Button Customization"
                    detail="Styled navigation buttons with gradient hover effects"
                    checked={draft.buttonCustomEnabled}
                    onCheckedChange={(value) => onPatch({ buttonCustomEnabled: value })}
                    switchLabel="Top button customization"
                  >
                    <ButtonCustomizationPanel
                      hideHeader
                      enabled
                      onToggle={(value) => onPatch({ buttonCustomEnabled: value })}
                      primaryColor={draft.primaryColor}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Custom top button gradient</p>
                        <p className="text-xs text-muted-foreground">
                          Override the gradient used for active and hover states.
                        </p>
                      </div>
                      <Switch
                        checked={draft.topGradientCustomEnabled}
                        onCheckedChange={(value) => onPatch({ topGradientCustomEnabled: value })}
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
                  </ToggleSection>

                  <ToggleSection
                    icon={<Smartphone />}
                    title="Mobile Branding"
                    badge={<Badge variant="secondary">Beta</Badge>}
                    detail="Full-screen branded menu, full-width pages, smoother scrolling and zoom controls on mobile"
                    checked={draft.mobileEnabled}
                    onCheckedChange={(value) => onPatch({ mobileEnabled: value })}
                    switchLabel="Mobile branding"
                  >
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
                  </ToggleSection>

                  <Collapsible open={sidebarDetails} onOpenChange={setSidebarDetails}>
                    <div className="rounded-lg border border-border bg-card">
                      <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4">
                        <span className="px-icon-chip hidden shrink-0 sm:inline-grid" aria-hidden>
                          <PanelLeft className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">Sidebar details</span>
                          <span className="block text-xs text-muted-foreground">
                            Font, icons, and motion
                          </span>
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                            sidebarDetails && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="flex flex-col gap-4 border-t border-border p-3 sm:p-4">
                        <div className="grid gap-4 sm:grid-cols-2">
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
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="branding-motion">Navigation animations</Label>
                          <Switch
                            id="branding-motion"
                            checked={draft.motion}
                            onCheckedChange={(motion) => onPatch({ motion })}
                          />
                        </div>
                        {draft.sidebarStyle === "v2" ? (
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
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
                  <StepNav
                    start={
                      <Button type="button" variant="ghost" onClick={() => onTab("widgets")}>
                        <ArrowLeft aria-hidden />
                        Widgets
                      </Button>
                    }
                  />
                </SectionCard>
              )
            ) : null}
          </motion.div>

          {dirty ? null : (
            <Button
              type="button"
              variant="ghost"
              className="self-start text-muted-foreground"
              onClick={onBack}
              data-testid="design-back"
            >
              <ArrowLeft aria-hidden />
              Back
            </Button>
          )}
        </div>

        <div className="min-w-0 [@container(min-width:880px)]:sticky [@container(min-width:880px)]:top-4 [@container(min-width:880px)]:self-start">
          <div className="px-surface p-4 sm:p-6">
            <DesignPreview
              draft={draft}
              surface={surface}
              device={device}
              onSurface={onSurface}
              onDevice={onDevice}
            />
          </div>
        </div>
      </div>
      </div>

      {dirty ? (
        <motion.div
          ref={barRef}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE_OUT }}
          className="pointer-events-none fixed left-0 right-0 z-40 px-3 pb-3 md:left-[var(--sidebar-width)] md:w-[calc(100%-var(--sidebar-width))] md:pr-24 lg:w-[calc(100%-var(--sidebar-width)-var(--copilot-dock-offset,0px))]"
          style={{ bottom: noticeOffset }}
          data-testid="design-save-bar"
        >
          <div className="pointer-events-auto mx-auto w-full max-w-[1400px] overflow-hidden rounded-xl border border-border bg-card shadow-dialog">
            {sidebarWarning ? (
                <motion.label
                  key={nudge}
                  ref={confirmRef}
                  id="design-sidebar-confirm"
                  initial={nudge ? { x: 0 } : false}
                  animate={nudge ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                  transition={{ duration: DURATION.page, ease: EASE_OUT }}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 border-b px-4 py-3 text-sm transition-colors",
                    sidebarModeConfirmed
                      ? "border-success/20 bg-success/10"
                      : "border-warning/25 bg-warning/10",
                  )}
                >
                  <Checkbox
                    checked={sidebarModeConfirmed}
                    onCheckedChange={(checked) => onConfirmSidebar(checked === true)}
                    aria-required="true"
                    className="mt-0.5"
                  />
                  <span className="min-w-0">
                    <span className="font-semibold">Required before saving. </span>
                    {sidebarWarning}
                  </span>
                </motion.label>
              ) : null}
            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
              {/* First on phones, where toasts sit over the bottom edge of the bar. */}
              <Button
                type="button"
                variant="ghost"
                className="-ml-2 self-start text-muted-foreground sm:order-2 sm:ml-0 sm:self-auto"
                onClick={onBack}
                data-testid="design-back"
              >
                <ArrowLeft aria-hidden />
                Back
              </Button>
              <div className="flex min-w-0 items-start gap-2.5 pr-14 sm:order-1 sm:flex-1 sm:items-center md:pr-0">
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-warning sm:mt-0"
                  aria-hidden
                />
                <p className="min-w-0 text-sm leading-5 text-foreground sm:truncate">
                  {bar}
                  {saveBlocked ? (
                    <span id="design-save-blocked" className="block font-semibold text-warning sm:inline">
                      <span className="hidden sm:inline"> </span>
                      Tick the box above to save.
                    </span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:order-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={onDiscard}
                  disabled={saving}
                  data-testid="design-discard"
                >
                  Discard
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  className="flex-1 sm:flex-none"
                  onClick={handleSave}
                  disabled={saving}
                  aria-describedby={saveBlocked ? "design-save-blocked" : undefined}
                  data-testid="design-save"
                >
                  {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
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
            {draft.sidebarStyle ? null : (
              <p className="text-xs text-muted-foreground">
                Choose a sidebar style first, then save it as a preset.
              </p>
            )}
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
      className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm"
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
    <div className="flex items-center gap-2 rounded-md bg-foreground py-1.5 pl-3 pr-1.5 text-background">
      <Code2 className="size-4 shrink-0 opacity-60" aria-hidden />
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
