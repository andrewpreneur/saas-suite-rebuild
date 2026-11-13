import { buildSwitchyardCSS, cleanSwitchyardColors } from "../../../supabase/functions/_shared/switchyardTheme";
import { Monitor, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { BrowserFrame, PhoneFrame } from "@/components/premium/branding/DeviceFrame";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type {
  DesignSnapshot,
  PreviewDevice,
  PreviewSurface,
  SidebarStyle,
} from "@/lib/designPageModel";
import { BACKGROUND_COLORS } from "@/components/branding/LoginCustomizationPanel";

const NAV = [
  "Launchpad",
  "Dashboard",
  "Conversations",
  "Calendars",
  "Contacts",
  "Opportunities",
  "Payments",
  "Marketing",
  "Automation",
  "Sites",
  "Reporting",
];

function ink(hex: string): string {
  const raw = hex.replace("#", "");
  if (raw.length < 6) return "#111111";
  const channels = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16));
  const luminance = (0.299 * channels[0] + 0.587 * channels[1] + 0.114 * channels[2]) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

/** A tint of the customer's own color, so the mock-up reacts to every change. */
function tint(hex: string, percent: number): string {
  return `color-mix(in srgb, ${hex || "currentColor"} ${percent}%, transparent)`;
}

function HubBody({ layout, accent }: { layout: number; accent: string }) {
  if (layout === 1) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <div className="grid h-11 place-items-center rounded-md" style={{ background: tint(accent, 16) }}>
              <span
                className="size-0 border-y-4 border-l-[7px] border-y-transparent"
                style={{ borderLeftColor: accent }}
              />
            </div>
            <div className="h-1.5 w-4/5 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    );
  }
  if (layout === 3) {
    return (
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2 flex flex-col gap-1.5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-7 rounded-md bg-muted"
              style={index === 0 ? { background: tint(accent, 18) } : undefined}
            />
          ))}
        </div>
        <div className="col-span-3 grid h-[136px] place-items-center rounded-md bg-muted">
          <span className="grid size-8 place-items-center rounded-full" style={{ background: accent }}>
            <span className="ml-0.5 size-0 border-y-4 border-l-[7px] border-y-transparent border-l-white" />
          </span>
        </div>
      </div>
    );
  }
  if (layout === 4) {
    return (
      <div className="flex flex-col gap-2.5 rounded-md bg-foreground p-4">
        <div className="h-3 w-20 rounded-full" style={{ background: accent }} />
        <div className="h-2 w-full rounded-full bg-background/25" />
        <div className="h-2 w-4/5 rounded-full bg-background/25" />
        <div className="mt-2 grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-10 rounded-md bg-background/15" />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-16 flex-col justify-center gap-1.5 rounded-md px-3" style={{ background: tint(accent, 14) }}>
        <div className="h-2 w-24 rounded-full" style={{ background: accent }} />
        <div className="h-1.5 w-36 max-w-full rounded-full bg-foreground/15" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex h-9 items-center gap-2 rounded-md border border-border px-2">
            <span className="size-3 shrink-0 rounded-sm" style={{ background: tint(accent, 40) }} />
            <span className="h-1.5 flex-1 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginBody({ draft }: { draft: DesignSnapshot }) {
  const background = BACKGROUND_COLORS.find((color) => color.value === draft.loginBackground);
  return (
    <div
      className="flex h-full min-h-[inherit] items-center justify-center p-4"
      style={{ background: background?.hex || "hsl(var(--muted))" }}
    >
      <div className="w-full max-w-[220px] rounded-lg bg-card p-4 shadow-raised">
        <div className="mx-auto mb-3 h-8 w-24 rounded-md border border-dashed border-border text-center text-[10px] leading-8 text-muted-foreground">
          {draft.loginLogoUrl ? "Logo" : "YOUR LOGO"}
        </div>
        <p className="mb-3 text-center text-xs font-medium">Sign in to your account</p>
        <div className="mb-2 h-7 rounded-md border bg-muted/40" />
        <div className="mb-3 h-7 rounded-md border bg-muted/40" />
        <div
          className="rounded-md py-1.5 text-center text-xs font-medium"
          style={{ background: draft.primaryColor, color: ink(draft.primaryColor) }}
        >
          Sign in
        </div>
      </div>
    </div>
  );
}

function SwitchyardPreview({ draft }: { draft: DesignSnapshot }) {
  const colors = cleanSwitchyardColors(draft.switchyard);
  // Sandboxed iframe keeps customer branding away from the SaaSSuite interface.
  const markup = `<style>body{margin:0;font:13px system-ui}#switchyard-primary-navigation{display:flex;min-height:420px}.switchyard-account-rail{width:36px}.switchyard-sidebar{padding:12px;flex:1}.switchyard-nav-item{display:flex;gap:8px;padding:12px;text-decoration:none}.switchyard-topbar{padding:12px}</style><style>${buildSwitchyardCSS(colors)}</style><div id="switchyard-primary-navigation"><div class="switchyard-account-rail"></div><div class="switchyard-sidebar"><header class="switchyard-workspace-label">Your workspace</header>${["Dashboard","Conversations","Calendars","Contacts","Settings"].map((name,i)=>`<a class="switchyard-nav-item ${i===0?'is-active':''}" href="#"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" /></svg><span class="switchyard-nav-label">${name}</span></a>`).join("")}<div class="switchyard-accounts-directory-search"><input class="switchyard-directory-search-input" placeholder="Search accounts" /></div></div></div><div class="switchyard-topbar"><button class="hr-button">Dashboard</button></div>`;
  return <iframe title="Switchyard navigation preview" className="h-[480px] w-full border-0" sandbox="" srcDoc={markup} />;
}

function SidebarChrome({ draft, compact }: { draft: DesignSnapshot; compact?: boolean }) {
  const style: SidebarStyle | null = draft.sidebarStyle;
  const bg = draft.sidebarBgColor || (style === "v1" ? "#111827" : "#ffffff");
  const color = ink(bg);
  const framed = style === "v2";
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-0.5 p-2",
        compact ? "w-12 items-center" : "w-[136px]",
        framed ? "m-2 rounded-lg border border-border shadow-card" : "border-r border-border",
      )}
      style={{ background: bg, color }}
    >
      <div
        className={cn(
          "mb-2 grid h-7 place-items-center rounded-md text-[9px] font-bold tracking-wide",
          compact ? "w-7" : "w-full",
        )}
        style={{ background: draft.primaryColor, color: ink(draft.primaryColor) }}
      >
        {compact ? "Y" : "YOUR LOGO"}
      </div>
      {NAV.slice(0, compact ? 8 : 11).map((item, index) => {
        const active = index === 5;
        return (
          <div
            key={item}
            className={cn(
              "flex items-center gap-1.5 rounded-md text-[10px] leading-none",
              compact ? "size-7 justify-center" : "px-2 py-1.5",
              active && "font-semibold",
            )}
            style={active ? { background: draft.primaryColor, color: ink(draft.primaryColor) } : undefined}
          >
            <span
              className="size-2 shrink-0 rounded-[3px] bg-current"
              style={{ opacity: active ? 0.9 : 0.35 }}
              aria-hidden
            />
            {compact ? null : <span className="truncate">{item}</span>}
          </div>
        );
      })}
    </div>
  );
}

const SURFACES: { id: PreviewSurface; label: string }[] = [
  { id: "sidebar", label: "Sidebar" },
  { id: "hub", label: "Client Hub" },
  { id: "login", label: "Login" },
];

export function DesignPreview({
  draft,
  surface,
  device,
  onSurface,
  onDevice,
}: {
  draft: DesignSnapshot;
  surface: PreviewSurface;
  device: PreviewDevice;
  onSurface: (surface: PreviewSurface) => void;
  onDevice: (device: PreviewDevice) => void;
}) {
  const showPopup = draft.popupEnabled;
  const showHelp = draft.topNav.enabled;
  const accent = draft.primaryColor;
  const switchyard = draft.sidebarStyle === "switchyard" && surface === "sidebar";
  const address = surface === "login" ? "app.youragency.com/login" : "app.youragency.com";

  const popup = showPopup ? (
    <span
      className="absolute bottom-3 right-3 grid size-9 place-items-center rounded-full shadow-raised"
      style={{ background: accent }}
      aria-hidden
    >
      <span className="h-2.5 w-3.5 rounded-sm" style={{ background: ink(accent), opacity: 0.9 }} />
    </span>
  ) : null;

  const hub = (
    <div className="relative min-w-0 flex-1 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">Client Hub</p>
        {showHelp ? (
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            ? Help
          </span>
        ) : null}
      </div>
      <HubBody layout={draft.layout} accent={accent} />
      {popup}
    </div>
  );

  const desktopStage = switchyard ? (
    <SwitchyardPreview draft={draft} />
  ) : surface === "login" ? (
    <div className="min-h-[400px]">
      <LoginBody draft={draft} />
    </div>
  ) : (
    <div className="relative flex min-h-[400px]">
      <SidebarChrome draft={draft} compact={draft.sidebarStyle === "v3"} />
      {hub}
    </div>
  );

  return (
    <div className="flex flex-col gap-4" data-testid="design-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/50" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Live preview</h2>
        </div>
        <AnimatedTabs
          variant="pill"
          activeTab={device}
          onChange={(value) => {
            if (value === "desktop" || value === "mobile") onDevice(value);
          }}
          tabs={[
            { id: "desktop", label: "Desktop", icon: <Monitor className="size-4" aria-hidden /> },
            { id: "mobile", label: "Mobile", icon: <Smartphone className="size-4" aria-hidden /> },
          ]}
          className="[&_button]:px-3 [&_button]:py-1.5 [&_button]:text-xs"
        />
      </div>
      <AnimatedTabs
        variant="segment"
        activeTab={surface}
        onChange={(value) => {
          if (value === "sidebar" || value === "hub" || value === "login") onSurface(value);
        }}
        tabs={SURFACES}
        className="!flex w-full [&_button]:px-2 [&_button]:py-1.5"
      />
      <div className="px-brand-wash overflow-hidden rounded-lg border border-border/60 p-3 sm:p-5">
        <motion.div
          key={`${device}-${surface}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: EASE_OUT }}
        >
          {device === "mobile" ? (
            <div className="flex justify-center py-2">
              <PhoneFrame>
                <div
                  className="flex items-center justify-between px-4 pb-2 pt-8 text-[10px] font-semibold"
                  style={{
                    background: draft.mobileEnabled ? draft.mobileMenuColor : "hsl(var(--muted))",
                    color: draft.mobileEnabled ? ink(draft.mobileMenuColor) : "hsl(var(--foreground))",
                  }}
                >
                  <span>YOUR LOGO</span>
                  <span aria-hidden>≡</span>
                </div>
                <div className="relative h-[340px] overflow-hidden">
                  {switchyard ? (
                    <SwitchyardPreview draft={draft} />
                  ) : surface === "login" ? (
                    <div className="h-full min-h-[340px]">
                      <LoginBody draft={draft} />
                    </div>
                  ) : (
                    <div className="p-3">
                      <p className="mb-3 text-xs font-semibold">Client Hub</p>
                      <HubBody layout={draft.layout} accent={accent} />
                      {popup}
                    </div>
                  )}
                </div>
                {draft.mobileZoomEnabled ? (
                  <div className="flex items-center justify-center gap-3 border-t border-border pb-5 pt-2 text-[10px] text-muted-foreground">
                    <span>−</span>
                    <span>100%</span>
                    <span>+</span>
                  </div>
                ) : (
                  <div className="h-5" />
                )}
              </PhoneFrame>
            </div>
          ) : (
            <BrowserFrame address={address}>{desktopStage}</BrowserFrame>
          )}
        </motion.div>
      </div>
      <p className="text-xs text-muted-foreground">
        Shows your unsaved changes. Sub-accounts see them after you save and the script is installed.
      </p>
    </div>
  );
}
