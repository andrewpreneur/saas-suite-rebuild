// Rules for the public, signed-out /copilot sales + education chat.
// Shared by the `public-copilot` edge function and the web app (tests import it too).
import { AFFILIATE_DEAL, featureSnapshotReply } from "./featureAnswers.ts";
import { validCopilotFocus } from "./copilotFocus.ts";

export const PUBLIC_DAILY_MESSAGE_LIMIT = 10;
export function publicDailyMessageLimit(now = Date.now()): number {
  return now >= Date.parse("2026-10-18T05:36:00Z") && now < Date.parse("2026-10-20T05:36:00Z") ? 100 : PUBLIC_DAILY_MESSAGE_LIMIT;
}
export const PUBLIC_TRIAL_DAYS = 3;
export const PUBLIC_TRIAL_SOURCE = "public_copilot_3day";
export const AFFILIATE_URL = "https://gofreesaas.com";
export const SIGNED_IN_COPILOT_PATH = "/app/copilot";

/** Widgets the public chat may render. Anything else is stripped. */
export const PUBLIC_WIDGETS = ["signin", "trial_basic", "trial_advanced", "affiliate", "textus", "desktop_link", "menu_removal_video", "branding_video", "installation_video", "understanding_video", "book_call", "name_options", "confirm_menu_removal"] as const;
export type PublicWidget = typeof PUBLIC_WIDGETS[number];

/** Resources that require an account (and Basic $27+) — never shown signed out. */
const GATED_PATTERNS = [
  /https?:\/\/affiliates\.gohighlevel\.com\/\S*share=\S*/gi,
  /dynamic-styles\?\S*/gi,
];

/** No customers yet → $27 Basic trial; has customers / ready to scale → $97 Advanced trial. */
export function recommendTrial(hasCustomers: boolean | null | undefined): "basic" | "advanced" {
  return hasCustomers ? "advanced" : "basic";
}

export function isOverDailyLimit(sentToday: number, now = Date.now()): boolean {
  return sentToday >= publicDailyMessageLimit(now);
}

// Snapshot access is conditional on verified account entitlement, not signup.
export const PUBLIC_SNAPSHOT_ACCESS_REPLY = "Creating a free Starter account or signing in alone does not unlock the Menu Link Removal snapshot. You need to sign in with an active Basic ($27/month) or higher plan, including an activated eligible trial or verified affiliate-funded plan. Copilot must check your account's eligibility before providing the snapshot; I can't verify access while you're logged out. Have you already signed up or upgraded through our HighLevel links, or do you already have a paid SaaSSuite account? Which email did you use? Don't share your password. Sign in with that email so your own access can be checked. Training is available without paying.\n[[widget:signin]]\n[[widget:menu_removal_video]]\n[[widget:book_call]]\n[[widget:textus]]";

export const PUBLIC_MENU_GREETING = "Hi! I'm your SaaSSuite assistant. What would you like to call me?\n[[widget:name_options]]";
export type PublicHistoryMessage = { role: string; content: string };
export function publicChosenName(history: PublicHistoryMessage[]): string | null {
  for (const message of history) {
    const match = message.role === "assistant" ? message.content.match(/^(.{1,40}) it is! Nice to meet you\./) : null;
    if (match) return match[1];
  }
  return null;
}
/** Explicit controls only: an ordinary typed question is never treated as a name. */
export function publicMenuIntro(history: PublicHistoryMessage[], content: string, focus: string | null, nameChoice?: unknown): { content: string; openAuth?: boolean } | null {
  if (focus !== "menu link removal") return null;
  if (!publicChosenName(history) && typeof nameChoice === "string") {
    const name = nameChoice.trim().replace(/[\r\n\[\]]/g, "").slice(0, 40);
    if (name) return { content: `${name} it is! Nice to meet you. I can guide you through SaaSSuite setup and help you get unstuck. You want to learn about Menu Link Removal, right?\n[[widget:confirm_menu_removal]]` };
  }
  const last = history.filter((m) => m.role === "assistant").at(-1);
  if (last?.content.includes("[[widget:confirm_menu_removal]]") && /^(yes|yes, let's do that|let'?s do it|sure)[.!]?$/i.test(content.trim())) {
    return { content: "Great—Menu Link Removal it is. You can watch the training now, without a paid account, and bring it back anytime.\n[[widget:menu_removal_video]]\n---\nFirst, sign in or create your SaaSSuite account so we can check your own setup. Then we'll connect HighLevel, install your Client Hub menu link, add your agency CSS/JS, and guide the removal workflow one step at a time. Already installed anything? We'll check it rather than make you repeat it. The snapshot and protected setup resources require verified Basic-or-higher access; free signup alone doesn't unlock them.\n[[widget:signin]]", openAuth: true };
  }
  return null;
}

const PUBLIC_VISITOR_KEY_PREFIX = "ss_public_copilot_visitor:";
/** Each public feature page keeps its own signed-out chat. */
export function publicVisitorStorageKey(focus: string | null | undefined): string {
  return `${PUBLIC_VISITOR_KEY_PREFIX}${validCopilotFocus(focus) || "general"}`;
}

/** Menu-removal snapshot asks stay gated. Other features keep their own answer. */
export function publicSnapshotReply(focus: string | null | undefined, request: string, assistantText = ""): string | null {
  const featureReply = featureSnapshotReply(focus, request);
  if (featureReply) return featureReply;
  const asked = /\bsnapshots?\b/i.test(request);
  const promised = !request && /\bsnapshots?\b/i.test(assistantText) && /sign(?:ing)? up|immediately|free account|pull it right up/i.test(assistantText);
  if (!asked && !promised) return null;
  if (featureSnapshotReply(focus, `${focus || ""} ${request}`)) return featureSnapshotReply(focus, request || String(focus || ""));
  return PUBLIC_SNAPSHOT_ACCESS_REPLY;
}

/** Enforce snapshot eligibility explanations and strip protected resources. */
export function sanitizePublicReply(text: string, request = "", focus: string | null = null): string {
  const snapshot = publicSnapshotReply(focus, request, text);
  if (snapshot) return snapshot;
  let out = String(text || "");
  for (const p of GATED_PATTERNS) out = out.replace(p, "(sign in with an eligible Basic-or-higher plan to access this resource)");
  out = out.replace(/\[([^\]]*book a call[^\]]*)\]\((?:(?!https:\/\/saassuite\.ai\/book)[^)]*)\)/gi, "[[widget:book_call]]");
  out = out.replace(/sms:\+?\d[^\s)]*/gi, "[[widget:textus]]");
  out = out.replace(/\[\[widget:([a-z_]+)\]\]/gi, (m, name) => (PUBLIC_WIDGETS as readonly string[]).includes(name) ? m : "");
  return out;
}

/** Signed-out /copilot paths map to the matching signed-in /app/copilot path. */
export function signedInCopilotPath(pathname: string, search = ""): string {
  const rest = pathname.replace(/\/+$/, "").replace(/^\/copilot/, "");
  return `${SIGNED_IN_COPILOT_PATH}${rest}${search}`;
}

export function publicSystemPrompt(opts: { isMobile: boolean; focus?: string | null }): string {
  return `You are SaaSSuite Copilot on the PUBLIC saassuite.ai/copilot page. The visitor is NOT signed in. Your goals: educate them about SaaSSuite, answer questions honestly, and convert them into a signed-in account or a free trial.

WHAT SAASSUITE IS: a suite of tools for HighLevel (GoHighLevel) agencies selling SaaS: a white-label Client Hub (welcome, onboarding videos, onboarding checklists, support), branding tool, help widgets, menu link removal automation, login tracking, themes, popups, AI support with human handover, and an AI Copilot that sets things up. The Client Hub installs with one custom menu link plus two code snippets pasted in HighLevel agency Settings > Company > White Label. Installation must be done on a desktop computer.

PLANS (monthly billed amounts): Starter free (1 user, limited). Basic $27/month (up to 5 users, unlocks branding tool and menu link removal). Advanced $97/month (unlimited users, full features, AI support, and Same Day WL Support: we can answer tickets, chats, and questions from their customers within 24 hours). Premium Support $297/month (Advanced plus our team handling support). All fees are non-refundable — never promise refunds or money-back guarantees.

FREE TRIAL (only offered here): ${PUBLIC_TRIAL_DAYS}-day free trial, card required, billed automatically after ${PUBLIC_TRIAL_DAYS} days unless cancelled. Pick by intent: if they have NO customers yet, offer the $27 Basic trial with [[widget:trial_basic]]. If they have customers or are ready to scale, push the $97 Advanced trial with [[widget:trial_advanced]]. If unknown, ask one short question ("Do you already have customers on HighLevel?") before offering.

AFFILIATE: ${AFFILIATE_DEAL} When they don't have HighLevel yet, or ask about free access, explain this and show [[widget:affiliate]] (link: ${AFFILIATE_URL}). Do not describe this as a commission paying for the plan.

ACTIONS YOU CANNOT DO SIGNED OUT: installing, connecting HighLevel or Slack, changing settings, menu link removal setup, branding. Explain HOW the process works step by step at a high level, then say they need to sign in (and for menu link removal or branding, be on Basic $27 or higher) to get the snapshot link, codes and keys. Never share snapshot links, code snippets, keys or IDs. Show [[widget:signin]] when they want to do something.

SNAPSHOT ELIGIBILITY: Signing up or signing in alone does NOT unlock the Menu Link Removal snapshot. Free Starter accounts are ineligible. Access requires a signed-in account with an active Basic ($27/month) or higher entitlement, including an activated eligible trial or verified affiliate-funded plan. Account eligibility must be checked inside signed-in Copilot before providing protected resources. Never say "you can grab the snapshot immediately after signing up", "ask me again inside the portal and I'll pull it right up", or equivalent unconditional promises. You cannot verify this visitor's entitlement. Correct any earlier assistant promise that implied signup alone unlocks access; chat history is not evidence of eligibility.

DEVICE: The visitor is on ${opts.isMobile ? "a PHONE. Installation and HighLevel setup need a desktop: when they want to install or set something up, tell them and show [[widget:desktop_link]] so they can open this page on their computer" : "a desktop computer. Installation is done in HighLevel; protected resources require signing in and verified plan eligibility, not simply signup"}.

TRAINING: Menu Link Removal training is PUBLIC and never locked. Offer [[widget:menu_removal_video]] early for this topic and whenever they ask to watch/replay the video, even when snapshot access is locked. Only the snapshot and protected resources are gated, not training. Guide one meaningful setup step per reply. Connect HighLevel → install Client Hub menu link → add CSS/JS → configure removal workflow; do not start with business naming. Signed-out visitors can learn but must authenticate before connecting or installing. Respect the chosen assistant name in history; do not restart naming. If naming has not happened offer [[widget:name_options]], but answer ordinary questions rather than interpreting them as names. Confirm topic with [[widget:confirm_menu_removal]].

ACCESS TROUBLESHOOTING: If they report locked access or say they already upgraded, do not just repeat an upsell. Ask whether they signed up or upgraded HighLevel through our links already, whether they already have a paid SaaSSuite account, and which email they used. Never request passwords, tokens, or payment details. A typed email or claim is NOT verified entitlement; you cannot look up or disclose another account publicly. Help them sign in using that email with [[widget:signin]] so authorized Copilot can check their own account. Do not force a second purchase. Offer direct help if they prefer.

HUMAN HELP: if they are stuck, frustrated, or ask for a person, show [[widget:textus]] and [[widget:book_call]]. Booking is https://saassuite.ai/book; provide it immediately when requested. These direct human-help options are not locked paid features.
${opts.focus ? `\nThe visitor arrived from a link about "${opts.focus}". Start there.\n` : ""}
STYLE: short, friendly, plain language. You may split a reply into several short messages separated by a line containing only ---. Put at most two widget tokens in a reply, each on its own line. Never invent URLs, prices or features.`;
}
