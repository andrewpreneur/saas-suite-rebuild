/**
 * Sidebar groups a signed-in account sees.
 * Home is unlabeled. Client Hub, Resources and More Tools are the labeled sections.
 * More Tools lists finished tools that used to be reachable only through the
 * sidebar search box. Each keeps its own plan lock and access flag in AppSidebar.
 */
export const SIDEBAR_HOME_TOOL_IDS = ["dashboard", "challenge"] as const;

export const SIDEBAR_SECTIONS: { id: string; label: string; toolIds: string[] }[] = [
  {
    id: "build",
    label: "Client Hub",
    toolIds: ["branding", "client-hub", "workflows", "streamline", "support"],
  },
  {
    id: "grow",
    label: "Resources",
    toolIds: ["learning", "community", "help", "agents"],
  },
  {
    id: "more",
    label: "More Tools",
    toolIds: [
      "simple-onboarding",
      "knowledge-base",
      "onboarding-calls",
      "agency-support",
      "email-warmup",
      "free-leads",
    ],
  },
];

export type SidebarLinkCount = { id: string; label: string; count: number };

/**
 * Link counts for a typical owner: v2 navigation on, marketing hidden, and
 * bonus tools kept out of these groups. Locked plan items still show.
 * Agents is excluded from the Resources count so the placement decision
 * stays the count from before this link was added.
 */
export function typicalSidebarLinkCounts(): SidebarLinkCount[] {
  return [
    { id: "home", label: "Home", count: SIDEBAR_HOME_TOOL_IDS.length },
    ...SIDEBAR_SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
      count: section.toolIds.filter((id) => id !== "agents").length,
    })),
  ];
}

/** Labeled section with the fewest links for a typical owner, before Agents. */
export function fewestLabeledSidebarSection(): SidebarLinkCount {
  const labeled = typicalSidebarLinkCounts().filter((section) => section.id !== "home");
  return labeled.reduce((smallest, section) =>
    section.count < smallest.count ? section : smallest,
  );
}

/**
 * New-UI sidebar: one link per job, grouped by what the owner is trying to do.
 * Nothing here opens a tool the account could not already open; plan locks,
 * access flags and team permissions are still applied in AppSidebar.
 */
export const NEW_UI_SIDEBAR_SECTIONS: {
  id: string;
  label: string;
  toolIds: string[];
  /** Walkthrough anchor kept from the old layout, when the tour points at this group. */
  tipTarget?: string;
}[] = [
  {
    id: "hub",
    label: "Client Hub",
    toolIds: ["client-hub", "simple-onboarding", "knowledge-base", "workflows"],
    tipTarget: "sidebar-section-client-hub",
  },
  { id: "brand", label: "Branding", toolIds: ["branding", "streamline"] },
  { id: "support", label: "Support", toolIds: ["support", "onboarding-calls", "agency-support"] },
  { id: "growth", label: "Grow", toolIds: ["affiliate-dashboard", "one-feature-kit", "email-warmup", "free-leads"] },
  {
    id: "learn",
    label: "Learn",
    toolIds: ["learning", "community", "agents", "help"],
    tipTarget: "sidebar-section-resources",
  },
  { id: "account", label: "Account", toolIds: ["settings"] },
];

/** Names shown in the new UI. Page titles use the same words so the sidebar and the page agree. */
export const NEW_UI_TOOL_NAMES: Record<string, string> = {
  "client-hub": "Hub Pages",
  branding: "Branding",
  streamline: "Menu Link Removal",
  "affiliate-dashboard": "Affiliate",
  "one-feature-kit": "One Feature Kit",
  settings: "Settings",
};

/** Default label for every tool id. The sidebar, top bar and command menu all read this. */
export const TOOL_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  challenge: "Challenge",
  "client-hub": "Hub Pages",
  "simple-onboarding": "Simplified Onboarding",
  "knowledge-base": "Knowledge Base",
  workflows: "Workflows",
  branding: "Branding",
  streamline: "Menu Link Removal",
  support: "Client Support",
  "onboarding-calls": "Onboarding Calls",
  "agency-support": "Agency Support",
  "affiliate-dashboard": "Affiliate",
  "one-feature-kit": "One Feature Kit",
  "email-warmup": "Email Warmup",
  "free-leads": "My Free Leads",
  learning: "Learning Hub",
  "start-here": "Learning Hub",
  community: "Community",
  agents: "Agents",
  help: "Help",
  settings: "Settings",
  walkthrough: "Walkthrough",
  copilot: "Copilot",
};

/** Sidebar group a tool belongs to, for the top bar's "Group / Page" trail. */
export function sectionLabelForTool(toolId: string): string | null {
  if ((SIDEBAR_HOME_TOOL_IDS as readonly string[]).includes(toolId)) return null;
  const id = toolId === "start-here" ? "learning" : toolId;
  return NEW_UI_SIDEBAR_SECTIONS.find((section) => section.toolIds.includes(id))?.label ?? null;
}
