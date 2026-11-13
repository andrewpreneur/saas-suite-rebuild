// Per-feature Copilot answers. Video URLs are the ones already shipped in the app.
// Login tracking, the Client Hub, community, and support have no training video here.
import { MENU_REMOVAL_VIDEO_URL } from "./menuRemovalGuide.ts";

export const BRANDING_VIDEO_URL = "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6acefdaeed5644a05f0a93e9.mp4";
export const INSTALLATION_VIDEO_URL = "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6acefeeeed5644a05f0ac262.mp4";
export const UNDERSTANDING_VIDEO_URL = "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1251673c3aed7c639fbc38.mp4";

/** Features whose pages were receiving the Menu Link Removal snapshot script. */
export const FEATURES_WITHOUT_TRAINING_VIDEO = ["login tracking", "client hub", "community", "support"] as const;

export const AFFILIATE_DEAL = "Anyone who signs up for or upgrades any HighLevel account through our link gets SaaSSuite ADVANCED free.";

export type FeatureKey = "menu-removal" | "branding" | "installation" | "login-tracking" | "client-hub" | "community" | "support" | "understanding";

const FOCUS_FEATURE: Record<string, FeatureKey> = {
  menulinkremoval: "menu-removal",
  "menu link removal": "menu-removal",
  brandingtool: "branding",
  "the branding tool": "branding",
  branding: "branding",
  logintracking: "login-tracking",
  "login tracking": "login-tracking",
  installation: "installation",
  clienthub: "client-hub",
  "the client hub": "client-hub",
  "client hub": "client-hub",
  community: "community",
  "the community": "community",
  support: "support",
  understanding: "understanding",
  "how saassuite works": "understanding",
};

export function detectFeature(focus: string | null | undefined, text = ""): FeatureKey | null {
  const keyed = FOCUS_FEATURE[String(focus || "").trim().toLowerCase()];
  if (keyed) return keyed;
  const blob = `${focus || ""} ${text}`;
  if (/\bbranding\b/i.test(blob)) return "branding";
  if (/\blogin tracking\b/i.test(blob)) return "login-tracking";
  if (/\bclient hub\b/i.test(blob)) return "client-hub";
  if (/\binstall/i.test(blob)) return "installation";
  if (/\bcommunity\b/i.test(blob)) return "community";
  if (/\bsupport\b/i.test(blob)) return "support";
  if (/\b(how saassuite works|understanding)\b/i.test(blob)) return "understanding";
  if (/\bmenu link removal\b/i.test(blob)) return "menu-removal";
  return null;
}

export function featureVideoUrl(feature: FeatureKey): string | null {
  switch (feature) {
    case "menu-removal": return MENU_REMOVAL_VIDEO_URL;
    case "branding": return BRANDING_VIDEO_URL;
    case "installation": return INSTALLATION_VIDEO_URL;
    case "understanding": return UNDERSTANDING_VIDEO_URL;
    default: return null;
  }
}

export function featureVideoWidget(feature: FeatureKey): string | null {
  switch (feature) {
    case "menu-removal": return "menu_removal_video";
    case "branding": return "branding_video";
    case "installation": return "installation_video";
    case "understanding": return "understanding_video";
    default: return null;
  }
}

function withVideo(feature: FeatureKey, text: string): string {
  const widget = featureVideoWidget(feature);
  const url = featureVideoUrl(feature);
  if (!widget || !url) return `${text}\nThere isn't a separate training video for this one.`;
  return `${text}\n[[widget:${widget}]]\n${url}`;
}

export function featureExplanation(feature: FeatureKey): string {
  switch (feature) {
    case "branding":
      return withVideo(feature, "The branding tool restyles HighLevel for your agency: sidebar colors, dark mode, fonts, login page, top buttons, and the mobile menu. Classic, V2, and the theme customizer are the three looks. Changes apply across the agency, including the Client Hub, after you refresh.");
    case "installation":
      return withVideo(feature, "Installation puts SaaSSuite inside HighLevel. You need one custom menu link plus the agency CSS and JavaScript, pasted in Agency Settings > Company > White Label, on a desktop. Connecting HighLevel lets SaaSSuite install the menu link for you. You can still paste the link, CSS, and JavaScript yourself.");
    case "login-tracking":
      return "Login tracking shows which Client Hub users sign in and when, so you can see who is actually using the account. With auto-navigate on, a customer's first HighLevel login opens your Client Hub. There isn't a separate login-tracking training video.";
    case "client-hub":
      return "The Client Hub is the page your customers see for welcome, onboarding videos, checklists, and support. It is installed with one menu link and the two agency code snippets. There isn't a separate Client Hub training video. The installation video walks through putting the hub into HighLevel.";
    case "community":
      return "The community is the in-app space for prompts, snapshots, courses, and questions from other agency owners. There isn't a community training video.";
    case "support":
      return "Support is where your customers ask for help, and where you decide between AI replies and a person. There isn't a separate support training video in Copilot.";
    case "understanding":
      return withVideo(feature, `SaaSSuite is a set of tools for agencies selling HighLevel as SaaS: a white-label Client Hub, branding, menu link removal, login tracking, and support. ${AFFILIATE_DEAL}`);
    case "menu-removal":
      return withVideo(feature, "Menu Link Removal hides HighLevel links you do not want customers to see, either by hand for one sub-account or automatically from a purchase. The training video is free to watch. The snapshot itself is checked against the signed-in plan.");
    default:
      return "";
  }
}

/** Snapshot asks on a feature page get that feature's answer, not the menu-removal script. */
export function featureSnapshotReply(focus: string | null | undefined, request: string): string | null {
  if (!/\bsnapshots?\b/i.test(request)) return null;
  const feature = detectFeature(focus, request);
  if (!feature || feature === "menu-removal") return null;
  return featureExplanation(feature);
}

const CONNECT_RELEVANT = /\b(install(?:ation)?|menu\s*link|connect|high\s*level|gohighlevel|\bghl\b|white\s*label|\bcss\b|javascript|private integration|snapshot|sub-?accounts?|location id)\b/i;

export function connectIsRelevant(userText: string, focus: string | null | undefined = null): boolean {
  if (CONNECT_RELEVANT.test(userText)) return true;
  const feature = detectFeature(focus, "");
  return (feature === "installation" || feature === "menu-removal") && /\b(set up|setup|how do i|walk me through)\b/i.test(userText);
}

/** Drop connection widgets when the question was about something else. */
export function stripUnsolicitedHighLevelConnect(reply: string, userText: string, opts?: { connected?: boolean; focus?: string | null }): string {
  if (opts?.connected || connectIsRelevant(userText, opts?.focus)) return reply;
  return String(reply || "")
    .replace(/\[\[widget:ghl_connect\]\]/gi, "")
    .replace(/\[\[widget:connect_apps\]\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isSimpleCopilotTurn(text: string): boolean {
  const value = String(text || "").trim();
  if (!value || value.length > 280) return false;
  if (/\b(enable|disable|turn (?:it )?on|turn (?:it )?off|toggle|install|connect|change|update|save|delete|upgrade|buy)\b/i.test(value)) return false;
  return /^(what|how|why|explain|tell me|show me|where|can i|does|do i|is there)\b/i.test(value);
}

export function workspaceTurnPlan(userText: string, focusLabel: string | null, topicsFor: (text: string) => string[]) {
  const simple = isSimpleCopilotTurn(userText);
  const topics = topicsFor(`${userText} ${simple ? "" : focusLabel || ""}`.trim());
  return { simple, topics: simple ? topics.slice(0, 1) : topics, historyLimit: simple ? 6 : 12, includeTools: !simple };
}
