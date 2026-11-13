// Agency-owner Copilot alerts use the same Support handover contract as
// support-handover-alert / v2-native-ai-chat. Workspace Copilot does not call
// the human_handover tool, so the decision of when to alert lives here and
// does not depend on the model.

const CUSTOMER_SETUP =
  /\b(how (?:do|to|can)|what is|what's|set ?up|setup|enable|disable|configure|turn on)\b/i;
const ABOUT_THEIR_CUSTOMERS = /\b(clients?|customers?|end[- ]users?|sub-?accounts?)\b/i;
const ABOUT_THE_OWNER =
  /\b(i|we|i'm|i am)\b[\s\S]{0,40}\b(need|want|please|stuck|cancel|talk|speak|help me)\b|\b(need|want|please)\b[\s\S]{0,40}\b(i|we)\b/i;
const DECLINED_HUMAN =
  /\b(?:don'?t|do not)\s+(?:want|need)\s+(?:a\s+)?(?:human|person|agent|specialist)\b|\bno\s+human\b|\bnever\s*mind\b/i;

const HUMAN_ASK = [
  /\b(?:talk|speak|chat)\s+(?:to|with)\s+(?:a\s+|the\s+)?(?:real\s+)?(?:person|human|someone|somebody|specialist|agent|representative|rep|manager|support|team)\b/i,
  /\b(?:need|want|get)\s+(?:a\s+|the\s+)?(?:real\s+)?(?:person|human|specialist|live\s+agent|agent)\b/i,
  /\b(?:human|agent)\s+please\b/i,
  /\bhuman\s+help\b/i,
  /\blive\s+agent\b/i,
  /\breal\s+person\b/i,
  /\brequest\s+a\s+human\b/i,
  /\bget\s+(?:me\s+)?a\s+(?:human|person|specialist)\b/i,
  /\bconnect\s+me\s+(?:to|with)\b/i,
  /\b(?:transfer|escalate)\s+(?:me|this)\b/i,
  /\bcan\s+i\s+(?:talk|speak)\s+(?:to|with)\b/i,
  /\bi(?:'d| would)\s+like\s+to\s+(?:talk|speak)\s+(?:to|with)\b/i,
  /\bcancel(?:\s+my)?\s+(?:premium\s+)?support\b/i,
];

/** True when an agency owner is asking SaaSSuite for a person, not configuring client handover. */
export function copilotAsksForHuman(text: string): boolean {
  const raw = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw || DECLINED_HUMAN.test(raw)) return false;
  if (!HUMAN_ASK.some((pattern) => pattern.test(raw))) return false;
  const configuringClients =
    ABOUT_THEIR_CUSTOMERS.test(raw) &&
    (/\bhuman handover\b/i.test(raw) || CUSTOMER_SETUP.test(raw));
  if (configuringClients && !ABOUT_THE_OWNER.test(raw)) return false;
  // "I need a human handover for my customers" is the product, not an escalation.
  if (
    /\bhuman handover\b/i.test(raw) &&
    ABOUT_THEIR_CUSTOMERS.test(raw) &&
    !/\b(?:talk|speak)\s+(?:to|with)\b/i.test(raw)
  )
    return false;
  return true;
}

/** Workspace hands off with the text-us widget. The in-app tool uses the team-member line. */
export function copilotReplyHandsOff(content: string): boolean {
  const text = String(content || "");
  return /\[\[widget:human_help\]\]/.test(text) || /getting one of our team members/i.test(text);
}

export function copilotHandoverThreadId(email: string): string {
  return `copilot:${String(email || "")
    .trim()
    .toLowerCase()}`;
}

export type CopilotSupportAlertInput = {
  agencyId: string;
  email: string;
  name: string;
  agencyName?: string | null;
  plan?: string | null;
  lastMessage: string;
  reason: string;
  timestamp: string;
};

/** Base fields postSupportAlert merges under the support_alert / chat_handover envelope. */
export function buildCopilotSupportAlert(
  input: CopilotSupportAlertInput,
): Record<string, string | null> {
  const email = String(input.email || "")
    .trim()
    .toLowerCase();
  const name = String(input.name || "").trim() || email;
  const lastMessage =
    String(input.lastMessage || "")
      .trim()
      .slice(0, 2000) || "User requested human support";
  const reason =
    String(input.reason || "")
      .trim()
      .slice(0, 500) || "User requested human support";
  return {
    event: "human_handover",
    agency_id: String(input.agencyId || "").trim() || null,
    owner_email: email,
    user_name: name,
    user_email: email,
    account_email: email,
    account_name: String(input.agencyName || "").trim() || name,
    agency_name: String(input.agencyName || "").trim() || null,
    plan: String(input.plan || "").trim() || null,
    last_message: lastMessage,
    reason,
    fallback_reason: reason,
    source: "ai_copilot",
    chat_category: "AI Copilot",
    timestamp: input.timestamp,
  };
}
