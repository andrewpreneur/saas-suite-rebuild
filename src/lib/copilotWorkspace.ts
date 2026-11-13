// Shared rules for the full-screen /copilot workspace: intro slides, the
// scripted first-time opening, and how assistant text maps to in-chat widgets.

export const NAME_OPTIONS = ["Frankie", "Jamie", "Copilot", "Other"] as const;
export const DEFAULT_ASSISTANT_NAME = "Copilot";
export const FIRST_TIME_ONBOARDING_PATH = "/app/copilot/first-time";

/** Each onboarding attempt resumes its own phase without altering older chats. */
export function onboardingPhaseKey(owner: string, threadId: string): string {
  return `ss_copilot_ft_phase_${owner}_${threadId}`;
}

export const INTRO_SLIDES = [
  { key: "journey", text: "**SaaSSuite** makes your SaaS journey easier for you… and **your customers**." },
  { key: "tools", text: "Use our **suite of tools**, including branding tools, help widgets, menu link removal, onboarding pages, login tracking, and more." },
  { key: "hub", text: "Your **Client Hub** hosts your customers’ welcome, onboarding, and support experience. Install it with **one menu link and two pieces of code**, pasted at the agency level in Settings > Company > White Label." },
  { key: "desktop", text: "Installation must happen **on desktop**, so make sure you have your computer handy." },
  { key: "plans", text: "**Anyone who signs up for or upgrades any HighLevel account through our link gets SaaSSuite ADVANCED free.** If you can't sign up or upgrade through us, explore plans in **Settings > Billing**." },
] as const;

export const FIRST_GREETING =
  "Hi! I'm Copilot, your new SaaS personal assistant. I can help with onboarding and support, and set up your account with you.";
export const NAME_QUESTION = `What would you like to call me? You can always change this later.\n[[choices: ${NAME_OPTIONS.join(" | ")}]]`;

export function introAfterName(name: string): string[] {
  return [
    `${name} it is! Nice to meet you.\n\nI can help configure your SaaSSuite account and guide you through the steps that need to happen in HighLevel. Let's connect your apps, starting with HighLevel.`,
    "[[widget:connect_apps]]",
  ];
}

export const GHL_INSTRUCTIONS =
  "We'll connect to GoHighLevel with an agency level integration token. In GoHighLevel, go to the agency view, Settings, then Private Integrations, and create a token with view locations, view users, view companies, and view + edit custom menu links. Paste it below and I'll store it securely, so I never see it in chat. I'll also need your Location ID, which is in Settings under Business Profile or in your window when logged into a sub account.\n[[widget:ghl_connect]]";

export const COMPOSER_MAX_LINES = 10;
export const PRIORITY_OPTIONS = ["Onboarding", "Education", "Support", "Other"] as const;
export const PRIORITY_QUESTION = `What’s your priority?\n[[choices: ${PRIORITY_OPTIONS.join(" | ")}]]`;

/** Custom answers must be collected locally, not submitted as an empty choice. */
export function requiresCustomAnswer(option: string): boolean {
  return /^(other\b|something else\b|no\b|i (?:have|want) (?:preferences|something else)|custom\b)/i.test(option.trim());
}

export function composerPlaceholder(name: string | null | undefined): string {
  return `Work with ${(name || "").trim() || DEFAULT_ASSISTANT_NAME}`;
}

export type Widget =
  | { kind: "choices"; options: string[] }
  | { kind: "multi"; options: string[] }
  | { kind: "widget"; name: string }
  | { kind: "screenshot"; key: string };

const TOKEN_RE = /\[\[\s*(choices|multi|widget|screenshot)\s*:\s*([^\]]+?)\s*\]\]/gi;

/** Splits assistant text into display text + interactive widgets. */
export function parseAssistant(content: string): { text: string; widgets: Widget[] } {
  const widgets: Widget[] = [];
  const text = String(content || "").replace(TOKEN_RE, (_m, kind: string, body: string) => {
    const k = kind.toLowerCase();
    if (k === "widget") widgets.push({ kind: "widget", name: body.trim().toLowerCase() });
    else if (k === "screenshot") widgets.push({ kind: "screenshot", key: body.trim() });
    else {
      const options = body.split("|").map((o) => o.trim()).filter(Boolean).slice(0, k === "choices" ? 4 : 30);
      if (options.length) widgets.push({ kind: k as "choices" | "multi", options });
    }
    return "";
  });
  return { text: text.replace(/\n{3,}/g, "\n\n").trim(), widgets };
}

/** A connect card already has Skip for now, so the same message should not offer it again. */
export function withoutDuplicateSkip(widgets: Widget[]): Widget[] {
  const hasSkipControl = widgets.some((widget) => widget.kind === "widget" && (widget.name === "ghl_connect" || widget.name === "connect_apps" || widget.name === "menu_link"));
  if (!hasSkipControl) return widgets;
  const next: Widget[] = [];
  for (const widget of widgets) {
    if (widget.kind !== "choices") { next.push(widget); continue; }
    const options = widget.options.filter((option) => !/^skip(?: for now| installation for now)?$/i.test(option.trim()));
    if (options.length) next.push({ ...widget, options });
  }
  return next;
}

/** The AI separates consecutive chat messages with a line containing only `---`. */
export function splitReply(content: string): string[] {
  return String(content || "")
    .split(/\n\s*---\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4);
}

/** How long the typing dots show before a message lands (feels considered, never slow). */
export function typingDelay(text: string): number {
  return Math.min(700, 200 + String(text || "").length * 2);
}

export function threadTitleFrom(text: string): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 45)}...` : t || "New chat";
}
