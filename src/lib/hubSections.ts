import { type HubLandingPage } from "./hubLanding";

export const HUB_SECTION_FIELDS = {
  home: "home_page_enabled",
  education: "education_page_enabled",
  support: "support_page_enabled",
} as const;
export type HubSectionVisibility = Record<(typeof HUB_SECTION_FIELDS)[HubLandingPage], boolean>;
export const DEFAULT_HUB_SECTIONS: HubSectionVisibility = {
  home_page_enabled: true,
  education_page_enabled: true,
  support_page_enabled: true,
};

export function readHubSections(row?: Partial<HubSectionVisibility> | null): HubSectionVisibility {
  return {
    home_page_enabled: row?.home_page_enabled ?? true,
    education_page_enabled: row?.education_page_enabled ?? true,
    support_page_enabled: row?.support_page_enabled ?? true,
  };
}

export function visibleHubSections(visibility: HubSectionVisibility): HubLandingPage[] {
  return (["home", "education", "support"] as const).filter(page => visibility[HUB_SECTION_FIELDS[page]]);
}

export function visibleHubDefault(saved: string | null, visibility: HubSectionVisibility): HubLandingPage {
  const pages = visibleHubSections(visibility);
  return pages.find(page => page === saved) ?? pages[0] ?? "home";
}

export function hubSectionChange(visibility: HubSectionVisibility, saved: string | null, page: HubLandingPage, enabled: boolean) {
  const next = { ...visibility, [HUB_SECTION_FIELDS[page]]: enabled };
  if (!visibleHubSections(next).length) throw new Error("Keep at least one section visible");
  return { ...next, default_landing_page: visibleHubDefault(saved, next) };
}