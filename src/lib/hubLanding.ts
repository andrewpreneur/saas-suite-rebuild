// Shared Client Hub landing rules. YSO (yoursoftwareonboarding.com) and this
// editor both read `v2_home_settings.default_landing_page` through
// `get_v2_home_settings`. A bare hub URL uses the saved page. A link that
// already names a page still opens that page.

export const HUB_LANDING_PAGES = ["home", "education", "support"] as const;
export type HubLandingPage = (typeof HUB_LANDING_PAGES)[number];

/** Historical landing tab when the column is null. */
export const DEFAULT_HUB_LANDING_PAGE: HubLandingPage = "home";

export interface HubChatConfig {
  ai_chat_enabled: boolean;
  human_chat_enabled: boolean;
}

export interface HubSupportVisibility {
  /**
   * `get_agency_info.support_ticketing_enabled`. Null and undefined match the
   * hub's `?? true` (ticketing is on until the account turns it off).
   */
  supportTicketingEnabled: boolean | null | undefined;
  /** `get_agency_chat_config` row. Null when that lookup has not returned one. */
  chatConfig?: HubChatConfig | null;
  /** Used only when chat config is missing: home settings AI chat. */
  aiChatEnabled?: boolean;
  aiChatType?: string | null;
}

/**
 * Same rule as the hub tab bar: ticketing, or AI/human chat from
 * `get_agency_chat_config`, or (when that row is missing) native AI chat.
 */
export function isHubSupportTabEnabled(input: HubSupportVisibility): boolean {
  if ((input.supportTicketingEnabled ?? true) === true) return true;
  if (input.chatConfig) {
    return input.chatConfig.ai_chat_enabled || input.chatConfig.human_chat_enabled;
  }
  return input.aiChatEnabled === true && input.aiChatType === "NATIVE";
}

/** Pages the main hub nav actually shows, in the order the hub renders them. */
export function availableHubLandingPages(supportEnabled: boolean): HubLandingPage[] {
  return supportEnabled ? ["education", "home", "support"] : ["home", "education"];
}

/**
 * Tokens the hub already accepts as "open this page" (`Ud` in the YSO bundle):
 * education, home, docs, support, support-chat, support-ticket, ticket.
 * `docs` is popup-only and is not a stored landing value.
 */
export function parseHubDeepLink(raw: string | null | undefined): HubLandingPage | "docs" | null {
  if (typeof raw !== "string") return null;
  const token = raw.trim().toLowerCase();
  if (token === "support-ticket" || token === "ticket" || token === "support-chat" || token === "support") {
    return "support";
  }
  if (token === "education" || token === "home") return token;
  if (token === "docs") return "docs";
  return null;
}

/** Path section on `/v2|v3|v4/:agencyId/:section`. Anything else is not a deep link. */
export function parseHubSection(section: string | null | undefined): "education" | "support-chat" | "support-ticket" | null {
  if (section === "education" || section === "support-chat" || section === "support-ticket") return section;
  return null;
}

/** Editor query: `?hubTab=` wins, then `?support=1`. */
export function editorHubDeepLink(search: { get(name: string): string | null }): string | null {
  const tab = search.get("hubTab");
  if (tab === "home" || tab === "education" || tab === "support") return tab;
  if (search.get("support") === "1") return "support";
  return null;
}

export function resolveHubLandingPage(input: {
  saved: string | null | undefined;
  supportEnabled: boolean;
  /** Path section, `?tab=`, popup message, or editor `?hubTab=` / `?support=1`. */
  deepLink?: string | null;
}): HubLandingPage | "docs" {
  const deep = parseHubDeepLink(input.deepLink);
  if (deep) return deep;
  const saved = typeof input.saved === "string" ? input.saved.trim().toLowerCase() : "";
  if (saved === "education" || saved === "home") return saved;
  if (saved === "support") return input.supportEnabled ? "support" : DEFAULT_HUB_LANDING_PAGE;
  return DEFAULT_HUB_LANDING_PAGE;
}
