import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HUB_SECTION_FIELDS, visibleHubSections, type HubSectionVisibility } from "@/lib/hubSections";
import type { HubLandingPage } from "@/lib/hubLanding";

interface ToggleProps {
  page: HubLandingPage;
  visibility: HubSectionVisibility;
  names: Record<HubLandingPage, string>;
  disabled: boolean;
  onVisibilityChange: (page: HubLandingPage, enabled: boolean) => void;
}

/** Shown at the bottom of the Home, Education and Support pages. */
export function HubSectionToggle({ page, visibility, names, disabled, onVisibilityChange }: ToggleProps) {
  const pages = visibleHubSections(visibility);
  const isLast = pages.length === 1 && pages[0] === page;
  const shown = visibility[HUB_SECTION_FIELDS[page]];
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={`hub-section-${page}`} className="cursor-pointer text-sm font-medium">Show {names[page]} to customers</Label>
        <p className="text-sm text-muted-foreground">
          {isLast ? "At least one page must stay visible." : shown ? "Turn off to hide this page entirely." : "This page is hidden from customers."}
        </p>
      </div>
      <Switch id={`hub-section-${page}`} checked={shown} disabled={disabled || isLast}
        onCheckedChange={enabled => onVisibilityChange(page, enabled)} />
    </div>
  );
}

interface DefaultProps {
  visibility: HubSectionVisibility;
  names: Record<HubLandingPage, string>;
  landingPage: HubLandingPage;
  disabled: boolean;
  onLandingPageChange: (page: HubLandingPage) => void;
}

/** Default landing page choice, shown in Customize Login. */
export function HubDefaultPageSelect({ visibility, names, landingPage, disabled, onLandingPageChange }: DefaultProps) {
  const pages = visibleHubSections(visibility);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <Label htmlFor="hub-default-landing" className="text-sm">Default page after login</Label>
      <Select value={landingPage} onValueChange={p => onLandingPageChange(p as HubLandingPage)} disabled={disabled}>
        <SelectTrigger id="hub-default-landing" className="w-full sm:w-48"><SelectValue /></SelectTrigger>
        <SelectContent>{pages.map(p => <SelectItem key={p} value={p}>{names[p]}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
