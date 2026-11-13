/**
 * Text that a GoHighLevel workflow drops into an HTML email.
 * Strip tags and control characters, cap the plain text, then HTML-escape.
 * Names use this before the POST. URLs do not: escaping a query string breaks the link.
 */

export const GHL_NAME_MAX = 80;
export const GHL_FREE_TEXT_MAX = 80;
export const GHL_MESSAGE_MAX = 4000;
export const GHL_URL_MAX = 2000;

const TAGS = /<[^>]*>/g;
const CONTROLS = /[\u0000-\u001F\u007F]/g;
const CONTROLS_KEEP_NEWLINES = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function ghlEscapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function asString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

/** Tags and control characters removed. Newlines stay only when the field is a message body. */
export function ghlStripText(value: unknown, keepNewlines = false): string {
  const raw = asString(value).replace(TAGS, "");
  const stripped = keepNewlines ? raw.replace(CONTROLS_KEEP_NEWLINES, "") : raw.replace(CONTROLS, " ");
  const collapsed = keepNewlines
    ? stripped.replace(/[^\S\n]+/g, " ").replace(/[ ]*\n[ ]*/g, "\n").trim()
    : stripped.replace(/\s+/g, " ").trim();
  return collapsed;
}

/** Strip, cap the plain text, then escape. An empty value stays empty. */
export function ghlFreeText(value: unknown, max = GHL_FREE_TEXT_MAX): string {
  const plain = ghlStripText(value, false).slice(0, max).trim();
  return ghlEscapeHtml(plain);
}

/** Message body: tags and controls other than newlines are removed, then escaped. */
export function ghlMessageText(value: unknown, max = GHL_MESSAGE_MAX): string {
  return ghlStripText(value, true).slice(0, max).trim();
}

/** missing_<field> when empty, invalid_<field> when it is not an https URL. */
export function ghlUrlFieldProblem(field: string, value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return `missing_${field}`;
  if (!ghlHttpsUrl(value)) return `invalid_${field}`;
  return null;
}

/** https URL, or null. Empty, http, and unparseable values are null. The string is not HTML-escaped. */
export function ghlHttpsUrl(value: unknown, max = GHL_URL_MAX): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  return trimmed;
}

/** The mailbox name, first letter capitalized. Empty when there is no local part. */
export function ghlEmailLocalName(email: unknown): string {
  if (typeof email !== "string") return "";
  const at = email.indexOf("@");
  if (at <= 0) return "";
  const local = ghlStripText(email.slice(0, at), false).replace(/\s+/g, "");
  if (!local) return "";
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function firstWord(value: string): string {
  return value.split(" ").filter(Boolean)[0] ?? "";
}

/**
 * Greeting name for a GoHighLevel email.
 * Stored first name, then the full name, then the mailbox name, then "there".
 * The first word is the greeting so a full name stored in the first-name column
 * still greets with that given name. Every returned field is escaped and capped.
 */
export function ghlGreetingName(input: {
  firstName?: unknown;
  lastName?: unknown;
  fullName?: unknown;
  email?: unknown;
}): { first_name: string; last_name: string; full_name: string } {
  const storedFirst = ghlStripText(input.firstName, false);
  const storedLast = ghlStripText(input.lastName, false);
  const storedFull = ghlStripText(input.fullName, false);
  const combined = storedFull || [storedFirst, storedLast].filter(Boolean).join(" ");
  const parts = combined.split(" ").filter(Boolean);
  let first = storedFirst ? firstWord(storedFirst) : "";
  let last = storedLast;
  if (!first && parts.length > 0) first = parts[0] ?? "";
  if (!last && parts.length > 1) last = parts.slice(1).join(" ");
  if (!first) first = ghlEmailLocalName(input.email);
  if (!first) first = "there";
  const full = combined || [first, last].filter(Boolean).join(" ");
  return {
    first_name: ghlEscapeHtml(first.slice(0, GHL_NAME_MAX).trim()) || "there",
    last_name: ghlEscapeHtml(last.slice(0, GHL_NAME_MAX).trim()),
    full_name: ghlEscapeHtml(full.slice(0, GHL_NAME_MAX).trim()) || "there",
  };
}
