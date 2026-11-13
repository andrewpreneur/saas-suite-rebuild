import { buildSwitchyardCSS, cleanSwitchyardColors } from "../../../supabase/functions/_shared/switchyardTheme";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

function HubBody({ layout }: { layout: number }) {
  if (layout === 1) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-10 rounded-md bg-primary/15" />
        ))}
      </div>
    );
  }
  if (layout === 3) {
    return (
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2 h-28 rounded-md bg-primary/20" />
        <div className="col-span-3 flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-7 rounded-md bg-muted" />
          ))}
        </div>
      </div>
    );
  }
  if (layout === 4) {
    return (
      <div className="flex flex-col gap-2 rounded-md bg-foreground p-3">
        <div className="h-3 w-16 rounded-full bg-primary" />
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-2 rounded-full bg-background/30" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="h-16 rounded-md bg-primary/15" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-6 rounded-md bg-muted" />
      ))}
    </div>
  );
}

function LoginBody({ draft }: { draft: DesignSnapshot }) {
  const background = BACKGROUND_COLORS.find((color) => color.value === draft.loginBackground);
  return (
    <div
      className="flex h-full items-center justify-center p-4"
      style={{ background: background?.hex || "hsl(var(--muted))" }}
    >
      <div className="w-full max-w-[220px] rounded-xl bg-background p-4 shadow-md">
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
        "flex h-full shrink-0 flex-col gap-1 p-2",
        compact ? "w-14" : "w-[132px]",
        framed && "m-2 h-[calc(100%-1rem)] rounded-lg border",
      )}
      style={{ background: bg, color }}
    >
      <div
        className="mb-1 rounded-md px-1 py-1 text-center text-[9px] font-semibold"
        style={{ background: draft.primaryColor, color: ink(draft.primaryColor) }}
      >
        {compact ? "•" : "YOUR LOGO"}
      </div>
      {NAV.slice(0, compact ? 6 : 11).map((item, index) => (
        <div
          key={item}
          className={cn(
            "truncate rounded-md px-1.5 py-1 text-[10px]",
            index === 5 && "font-medium",
          )}
          style={
            index === 5
              ? { background: draft.primaryColor, color: ink(draft.primaryColor) }
              : undefined
          }
        >
          {compact ? item.slice(0, 1) : item}
        </div>
      ))}
    </div>
  );
}

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
  const stage =
    draft.sidebarStyle === "switchyard" && surface === "sidebar" ? <SwitchyardPreview draft={draft} /> : surface === "login" ? (
      <LoginBody draft={draft} />
    ) : (
      <div className="relative flex h-full min-h-[420px]">
        {surface === "sidebar" || device === "desktop" ? (
          <SidebarChrome draft={draft} compact={draft.sidebarStyle === "v3"} />
        ) : null}
        <div className="relative min-w-0 flex-1 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Client Hub</p>
            {showHelp ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                ? Help
              </span>
            ) : null}
          </div>
          <HubBody layout={draft.layout} />
          {showPopup ? (
            <span
              className="absolute bottom-3 right-3 size-8 rounded-full shadow"
              style={{ background: draft.primaryColor }}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-3" data-testid="design-preview">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          value={surface}
          onValueChange={(value) => {
            if (value === "sidebar" || value === "hub" || value === "login") onSurface(value);
          }}
          variant="outline"
          size="sm"
          className="justify-start"
          aria-label="Preview screen"
        >
          <ToggleGroupItem value="sidebar" aria-label="Sidebar">
            Sidebar
          </ToggleGroupItem>
          <ToggleGroupItem value="hub" aria-label="Client Hub">
            Client Hub
          </ToggleGroupItem>
          <ToggleGroupItem value="login" aria-label="Login page">
            Login page
          </ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={device}
          onValueChange={(value) => {
            if (value === "desktop" || value === "mobile") onDevice(value);
          }}
          variant="outline"
          size="sm"
          aria-label="Preview device"
        >
          <ToggleGroupItem value="desktop" aria-label="Desktop">
            Desktop
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label="Mobile">
            Mobile
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="overflow-hidden rounded-xl border bg-muted/30">
        {device === "mobile" ? (
          <div className="flex justify-center bg-[radial-gradient(circle,hsl(var(--border))_1px,transparent_1px)] bg-[length:12px_12px] px-4 py-6">
            <div className="w-[230px] max-w-full rounded-[1.6rem] border-4 border-foreground bg-background shadow-sm">
              <div
                className="flex items-center justify-between rounded-t-[1.2rem] px-3 py-2 text-[10px] font-semibold"
                style={{
                  background: draft.mobileEnabled ? draft.mobileMenuColor : "hsl(var(--muted))",
                  color: draft.mobileEnabled
                    ? ink(draft.mobileMenuColor)
                    : "hsl(var(--foreground))",
                }}
              >
                <span>YOUR LOGO</span>
                <span aria-hidden>≡</span>
              </div>
              <div className="relative h-[340px] overflow-hidden">
                {draft.sidebarStyle === "switchyard" && surface === "sidebar" ? <SwitchyardPreview draft={draft} /> : surface === "login" ? (
                  <LoginBody draft={draft} />
                ) : (
                  <div className="p-3">
                    <p className="mb-2 text-xs font-medium">Client Hub</p>
                    <HubBody layout={draft.layout} />
                    {showPopup ? (
                      <span
                        className="absolute bottom-3 right-3 size-7 rounded-full"
                        style={{ background: draft.primaryColor }}
                      />
                    ) : null}
                  </div>
                )}
              </div>
              {draft.mobileZoomEnabled ? (
                <div className="flex items-center justify-center gap-3 border-t py-2 text-[10px] text-muted-foreground">
                  <span>−</span>
                  <span>100%</span>
                  <span>+</span>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="min-h-[420px] bg-background">{stage}</div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Live preview of your unsaved changes. Sub-accounts see them after you save and the script is
        installed.
      </p>
    </div>
  );
}
