// Help & Support menu stored on saas_suite_users.top_nav_widget_options.
// Null or invalid JSON keeps the three built-in options, in the built-in order.

export const TOP_NAV_WIDGET_ICONS = [
  "book",
  "chat",
  "ticket",
  "help",
  "video",
  "phone",
  "mail",
  "link",
  "calendar",
  "star",
] as const;

export type TopNavWidgetIcon = (typeof TOP_NAV_WIDGET_ICONS)[number];
export type TopNavWidgetOpenMode = "tab" | "embed";
export type TopNavWidgetShowOn = "both" | "sub-accounts" | "agency";
export const POPUP_EMBED_TABS = ["education", "support-chat", "support-ticket", "docs"] as const;
export type TopNavWidgetEmbedTab = (typeof POPUP_EMBED_TABS)[number];

export type TopNavWidgetOption = {
  id: "help-library" | "live-support" | "open-ticket";
  label: string;
  /** Second line under the option label. */
  description: string;
  icon: TopNavWidgetIcon;
  visible: boolean;
  openMode: TopNavWidgetOpenMode;
  /** Hub path (/education) or an http(s) URL. New tab opens this. */
  target: string;
  /** Popup tab used when open mode is embed. */
  embedTab: TopNavWidgetEmbedTab;
};

export const EMBED_TAB_BY_ID: Record<TopNavWidgetOption["id"], TopNavWidgetEmbedTab> = {
  "help-library": "education",
  "live-support": "support-chat",
  "open-ticket": "support-ticket",
};

export const EMBED_TAB_LABELS: Record<TopNavWidgetEmbedTab, string> = {
  education: "Education",
  "support-chat": "Support chat",
  "support-ticket": "ticket form",
  docs: "Docs",
};

export const DEFAULT_CARD_TITLE = "How can we help?";
export const DEFAULT_CARD_SUBTITLE = "We're here to help";

export type TopNavWidgetConfig = {
  title: string;
  subtitle: string;
  showOn: TopNavWidgetShowOn;
  options: TopNavWidgetOption[];
};

export const TOP_NAV_WIDGET_ICON_LABELS: Record<TopNavWidgetIcon, string> = {
  book: "Book",
  chat: "Chat",
  ticket: "Ticket",
  help: "Help",
  video: "Video",
  phone: "Phone",
  mail: "Mail",
  link: "Link",
  calendar: "Calendar",
  star: "Star",
};

export const DEFAULT_TOP_NAV_WIDGET_OPTIONS: TopNavWidgetOption[] = [
  {
    id: "help-library",
    label: "Help Library",
    description: "Guides and how-to videos",
    icon: "book",
    visible: true,
    openMode: "tab",
    target: "/education",
    embedTab: "education",
  },
  {
    id: "live-support",
    label: "Live Support",
    description: "Chat with our team now",
    icon: "chat",
    visible: true,
    openMode: "tab",
    target: "/support-chat",
    embedTab: "support-chat",
  },
  {
    id: "open-ticket",
    label: "Open a Ticket",
    description: "Send details, we'll follow up",
    icon: "ticket",
    visible: true,
    openMode: "tab",
    target: "/support-ticket",
    embedTab: "support-ticket",
  },
];

const ICON_SET = new Set<string>(TOP_NAV_WIDGET_ICONS);
const EMBED_TAB_SET = new Set<string>(POPUP_EMBED_TABS);

function targetSegment(target: string): string {
  const raw = target.trim();
  if (!raw) return "";
  try {
    const path = /^https?:\/\//i.test(raw) ? new URL(raw).pathname : raw;
    const parts = path.split("?")[0].split("#")[0].split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  } catch {
    return "";
  }
}

function resolveEmbedTab(
  id: TopNavWidgetOption["id"],
  target: string,
  saved: unknown,
): TopNavWidgetEmbedTab {
  const fromTarget = targetSegment(target);
  if (EMBED_TAB_SET.has(fromTarget)) return fromTarget as TopNavWidgetEmbedTab;
  if (typeof saved === "string" && EMBED_TAB_SET.has(saved)) return saved as TopNavWidgetEmbedTab;
  return EMBED_TAB_BY_ID[id];
}

function copyDefaults(): TopNavWidgetOption[] {
  return DEFAULT_TOP_NAV_WIDGET_OPTIONS.map((option) => ({ ...option }));
}

export function stripControlChars(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) continue;
    out += value[i];
  }
  return out;
}

function cleanText(value: unknown, fallback: string, max: number): string {
  const text = stripControlChars(String(value ?? ""))
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, max);
  return text || fallback;
}

/** A hub path or an http(s) URL. Rejects javascript:, data:, and protocol-relative URLs. */
export function isSafeTarget(value: string): boolean {
  const raw = value.trim();
  if (!raw || raw.length > 300) return false;
  if (/[\s<>"'`\\]/.test(raw)) return false;
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("..")) return true;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function targetError(value: string): string | null {
  if (!value.trim()) return "Add a path or URL";
  if (isSafeTarget(value.trim())) return null;
  return "Use a path like /education or an http(s) URL";
}

function sanitizeOne(base: TopNavWidgetOption, raw: unknown): TopNavWidgetOption {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const icon =
    typeof row.icon === "string" && ICON_SET.has(row.icon)
      ? (row.icon as TopNavWidgetIcon)
      : base.icon;
  const openMode: TopNavWidgetOpenMode =
    row.openMode === "embed" ? "embed" : row.openMode === "tab" ? "tab" : base.openMode;
  const targetRaw = typeof row.target === "string" ? row.target.trim() : "";
  const subtitle = row.subtitle ?? row.description;
  return {
    id: base.id,
    label: cleanText(row.label, base.label, 40),
    description: cleanText(subtitle, base.description, 80),
    icon,
    visible: typeof row.visible === "boolean" ? row.visible : base.visible,
    openMode,
    target: isSafeTarget(targetRaw) ? targetRaw.slice(0, 300) : base.target,
    embedTab: resolveEmbedTab(
      base.id,
      isSafeTarget(targetRaw) ? targetRaw : base.target,
      row.embedTab,
    ),
  };
}

function optionList(input: unknown): unknown[] | null {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== "object") return null;
  const row = input as { options?: unknown; items?: unknown };
  if (Array.isArray(row.options)) return row.options;
  if (Array.isArray(row.items)) return row.items;
  return null;
}

/** Keep the three known options. Saved order wins; omitted options are appended at their defaults. */
export function sanitizeTopNavWidgetOptions(input: unknown): TopNavWidgetOption[] {
  const list = optionList(input);
  if (!list) return copyDefaults();
  const defaults = new Map(DEFAULT_TOP_NAV_WIDGET_OPTIONS.map((option) => [option.id, option]));
  const seen = new Set<string>();
  const ordered: TopNavWidgetOption[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const id = String((raw as { id?: unknown }).id ?? "");
    const base = defaults.get(id as TopNavWidgetOption["id"]);
    if (!base || seen.has(id)) continue;
    seen.add(id);
    ordered.push(sanitizeOne(base, raw));
  }
  for (const base of DEFAULT_TOP_NAV_WIDGET_OPTIONS) {
    if (!seen.has(base.id)) ordered.push({ ...base });
  }
  return ordered;
}

export function sanitizeTopNavWidgetConfig(input: unknown): TopNavWidgetConfig {
  const row =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const showRaw = typeof row.showOn === "string" ? row.showOn : "both";
  const showOn: TopNavWidgetShowOn =
    showRaw === "sub-accounts" || showRaw === "agency" || showRaw === "both" ? showRaw : "both";
  return {
    title: cleanText(row.title, DEFAULT_CARD_TITLE, 60),
    subtitle: cleanText(row.subtitle, DEFAULT_CARD_SUBTITLE, 80),
    showOn,
    options: sanitizeTopNavWidgetOptions(input),
  };
}

function svg(body: string, stroke: string): string {
  return (
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' +
    stroke +
    '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    body +
    "</svg>"
  );
}

const ICON_PATHS: Record<TopNavWidgetIcon, string> = {
  book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
  chat: '<path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12z"/>',
  ticket:
    '<path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5z"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9"/><path d="M12 17.2h.01"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10.5 21 8v8l-5-2.5z"/>',
  phone:
    '<path d="M7 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L17 13l4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1-.1l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  star: '<path d="m12 3 2.7 5.5L21 9.2l-4.5 4.4L17.5 21 12 18.2 6.5 21l1-7.4L3 9.2l6.3-.7z"/>',
};

export function topNavWidgetIconSvg(icon: string, stroke: string): string {
  const ink = /^#[0-9a-f]{3,8}$/i.test(stroke) ? stroke : "#8a6a14";
  const name = ICON_SET.has(icon) ? (icon as TopNavWidgetIcon) : "book";
  return svg(ICON_PATHS[name], ink);
}

export function topNavWidgetIconMap(stroke: string): Record<TopNavWidgetIcon, string> {
  const map = {} as Record<TopNavWidgetIcon, string>;
  for (const icon of TOP_NAV_WIDGET_ICONS) map[icon] = topNavWidgetIconSvg(icon, stroke);
  return map;
}
