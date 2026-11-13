// GoHighLevel Sites top-navigation items that Menu Link Removal can hide.
// Stored on the same menu_link_rules.hidden_links array as sidebar selectors,
// on one global row (sub_account_id null, preset_name SITES_TOP_NAV_PRESET).
// An absent row, or an empty array, hides nothing.

export const SITES_TOP_NAV_PRESET = "__sites_top_nav__";

export const SITES_TOP_NAV_ITEMS: { id: string; label: string }[] = [
  { id: "#tb_funnels", label: "Funnels" },
  { id: "#tb_websites", label: "Websites" },
  { id: "#tb_stores", label: "Stores" },
  { id: "#tb_webinars", label: "Webinars" },
  { id: "#tb_analytics", label: "Analytics" },
  { id: "#tb_blogs", label: "Blogs" },
  { id: "#tb_wordpress-v2", label: "WordPress" },
  { id: "#tb_clientportal", label: "Client Portal" },
  { id: "#tb_form-builder", label: "Forms" },
  { id: "#tb_survey-builder", label: "Surveys" },
  { id: "#tb_quiz-builder", label: "Quizzes" },
  { id: "#tb_chat-widget", label: "Chat Widget" },
  { id: "#tb_qr-codes", label: "QR Codes" },
  { id: "#tb_sites-domain-settings", label: "Domains/settings icon" },
];

const SITES_TOP_NAV_IDS = new Set(SITES_TOP_NAV_ITEMS.map((item) => item.id));

export function isSitesTopNavPreset(name: string | null | undefined): boolean {
  return (name ?? "").trim() === SITES_TOP_NAV_PRESET;
}

export function isSitesTopNavSelector(id: string): boolean {
  return SITES_TOP_NAV_IDS.has(id);
}

/** Catalog order, duplicates and unknown ids dropped. */
export function sitesTopNavHiddenLinks(selected: readonly string[]): string[] {
  const chosen = new Set(selected);
  return SITES_TOP_NAV_ITEMS.filter((item) => chosen.has(item.id)).map((item) => item.id);
}

/** Selectors to store when these items stay visible and every other Sites item is hidden. */
export function sitesTopNavHiddenExcept(visibleIds: readonly string[]): string[] {
  const keep = new Set(visibleIds);
  return SITES_TOP_NAV_ITEMS.filter((item) => !keep.has(item.id)).map((item) => item.id);
}

/**
 * CSS for menu-link removal. Same shape the dynamic-styles global path has
 * always emitted: one `display: none !important` rule per stored selector.
 * No selectors → no rule.
 */
export function menuLinkRemovalCss(linkIds: unknown): string {
  if (!Array.isArray(linkIds) || linkIds.length === 0) return "";
  let css = "";
  for (const linkId of linkIds) {
    if (typeof linkId !== "string" || linkId.length === 0) continue;
    css += `${linkId} {\n  display: none !important;\n}\n\n`;
  }
  return css;
}

/**
 * Selector allowlist for per-sub-account injection. Sidebar ids stay on the
 * historical #sb_ rules; Sites top-nav ids are the exact catalog entries.
 */
export function safeMenuLinkSelector(value: string): string | null {
  const trimmed = String(value ?? "").trim();
  if (isSitesTopNavSelector(trimmed)) return trimmed;
  const match = /^#(sb_[A-Za-z0-9 _.\\\-]{1,80})$/.exec(trimmed);
  if (!match) return null;
  const id = match[1].replace(/\\\./g, ".");
  if (!/^[A-Za-z0-9 _.\-]+$/.test(id)) return null;
  return /^[A-Za-z0-9_\-]+$/.test(id) ? `#${id}` : `[id="${id}"]`;
}
