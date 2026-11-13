/** Identifiers must never silently coerce message objects. */
export function scalarText(value: unknown, max = 500): string | null {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim().slice(0, max) || null
    : null;
}

/** Email-only matching attaches to the customer's latest ticket in one of these statuses. */
export const EMAIL_MATCH_STATUSES = ["open", "responded", "in_progress", "resolved", "closed"] as const;

const TEXT_FIELDS = ["text", "plain", "plain_text", "textPlain", "body", "content", "message", "reply", "customer_reply", "html"] as const;
const PAYLOAD_FIELDS = ["customer_reply", "reply", "message", "body", "text", "plain", "html"] as const;
const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";

const TICKET_PATTERNS: RegExp[] = [
  /\[#\s*(\d{1,10})\]/,
  /\bticket\s*#\s*(\d{1,10})\b/i,
  /\bticket\s+(?:number|no\.?)\s*(?:is|:|#|-)?\s*#?\s*(\d{1,10})\b/i,
  /\bticket\s+#?\s*(\d{1,10})\b/i,
];

const OUTLOOK_BLOCK = /^From:\s+\S[^\n]*\n(?:[^\n]*\n){0,6}?Sent:\s+\S[^\n]*\n(?:[^\n]*\n){0,6}?(?:To|Cc):\s+\S/im;
const MOBILE_SIGNATURE = /\n+(?:Sent from my (?:iPhone|iPad|Android|Samsung|Galaxy|Mobile)|Get Outlook for (?:iOS|Android))\s*$/i;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function fromCode(code: number): string {
  return Number.isFinite(code) && code > 0 && code < 65536 ? String.fromCharCode(code) : "";
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => fromCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => fromCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => NAMED_ENTITIES[String(name).toLowerCase()] ?? all);
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(value);
}

/** Turn an HTML email into text. Quoted regions are dropped unless dropQuoted is false. */
export function stripHtml(value: string, options?: { dropQuoted?: boolean }): string {
  const dropQuoted = options?.dropQuoted !== false;
  let html = value
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
  if (dropQuoted) {
    html = html
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "")
      .replace(/<div[^>]*\bclass=["'][^"']*gmail_quote[^"']*["'][^>]*>[\s\S]*$/i, "")
      .replace(/<div[^>]*\bid=["']appendonsend["'][^>]*>[\s\S]*$/i, "");
  }
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(withBreaks).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isQuoteHeaderLine(line: string): boolean {
  if (/^-{3,}\s*Original Message\s*-{3,}\s*$/i.test(line)) return true;
  if (/^-{5,}\s*Forwarded message\s*-{5,}\s*$/i.test(line)) return true;
  if (/^Begin forwarded message:\s*$/i.test(line)) return true;
  if (/^_{15,}\s*$/.test(line)) return true;
  if (!/^On .+wrote:\s*$/i.test(line)) return false;
  return new RegExp(`@|\\d{4}|\\d{1,2}:\\d{2}|\\b(?:${MONTHS})\\b`, "i").test(line);
}

/** Drop quoted history and a trailing signature when the delimiter is unambiguous. */
export function stripQuotedReply(value: string): string {
  const text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let cut = text.length;
  const outlook = OUTLOOK_BLOCK.exec(text);
  if (outlook && outlook.index < cut) cut = outlook.index;
  let offset = 0;
  for (const line of text.split("\n")) {
    if (offset < cut && isQuoteHeaderLine(line)) cut = offset;
    offset += line.length + 1;
  }
  const lines = text.slice(0, cut).split("\n").filter((line) => !/^\s*>/.test(line));
  const sigAt = lines.findIndex((line, index) =>
    index > 0 && lines.slice(0, index).some((prior) => prior.trim()) && /^--\s*$/.test(line),
  );
  const kept = (sigAt === -1 ? lines : lines.slice(0, sigAt)).join("\n");
  return kept.replace(MOBILE_SIGNATURE, "").replace(/\n{3,}/g, "\n\n").trim();
}

function htmlFieldText(value: string, mode: "raw" | "clean"): string | null {
  const trimmed = value.trim();
  if (!trimmed || /\[object\s+Object\]/i.test(trimmed) || /\{\{[^}]+\}\}/.test(trimmed)) return null;
  const plain = stripHtml(trimmed, { dropQuoted: mode === "clean" });
  const finished = mode === "clean" ? stripQuotedReply(plain) : plain.trim();
  const result = finished.trim();
  return result ? result.slice(0, 10000) : null;
}

function leafText(text: string, depth: number, mode: "raw" | "clean"): string | null {
  const trimmed = text.trim();
  if (!trimmed || /\[object\s+Object\]/i.test(trimmed) || /\{\{[^}]+\}\}/.test(trimmed)) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return readMessage(JSON.parse(trimmed), depth + 1, mode);
    } catch {
      /* ordinary text that happens to start with a brace */
    }
  }
  const plain = looksLikeHtml(trimmed) ? stripHtml(trimmed, { dropQuoted: mode === "clean" }) : trimmed;
  const finished = mode === "clean" ? stripQuotedReply(plain) : plain.trim();
  const result = finished.trim();
  return result ? result.slice(0, 10000) : null;
}

function readMessage(value: unknown, depth: number, mode: "raw" | "clean"): string | null {
  if (depth > 5) return null;
  if (typeof value === "string") return leafText(value, depth, mode);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const field of TEXT_FIELDS) {
    const child = record[field];
    if (child == null || child === "") continue;
    if (field === "html" && typeof child === "string") {
      const html = htmlFieldText(child, mode);
      if (html) return html;
      continue;
    }
    const text = readMessage(child, depth + 1, mode);
    if (text) return text;
  }
  return null;
}

/** Extract real text from common workflow/email message shapes, without quoted history. */
export function customerReplyText(value: unknown, depth = 0): string | null {
  return readMessage(value, depth, "clean");
}

const CUSTOM_FIELD_KEYS = ["customer_email", "customer_name", "customer_reply", "ticket_number", "ticket_id", "ticket", "subject", "email_subject"] as const;

/** GoHighLevel webhook actions nest Custom Data here. `customData` wins over `custom_data`. */
export function customDataRecord(payload: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of ["customData", "custom_data"]) {
    const value = payload[key];
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  }
  return null;
}

/** Copy the mapped Custom Data fields onto the payload so they win over contact fields. */
export function withCustomDataPriority(payload: Record<string, unknown>): Record<string, unknown> {
  const custom = customDataRecord(payload);
  if (!custom) return payload;
  const overlay: Record<string, unknown> = {};
  for (const key of CUSTOM_FIELD_KEYS) {
    const value = custom[key];
    if (value == null || value === "") continue;
    overlay[key] = value;
  }
  return { ...payload, ...overlay };
}

/**
 * Prefer customer_reply, then reply / message / body / text / plain / html.
 * `raw` still contains quoted history so a ticket token in the original email can be found.
 * `body` is what gets stored.
 */
export function replyFromPayload(payload: Record<string, unknown>): { raw: string | null; body: string | null } {
  for (const field of PAYLOAD_FIELDS) {
    const value = payload[field];
    if (value == null || value === "") continue;
    const body = readMessage(value, 0, "clean");
    if (!body) continue;
    return { raw: readMessage(value, 0, "raw") ?? body, body };
  }
  return { raw: null, body: null };
}

export function parseTicketNumber(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  for (const pattern of TICKET_PATTERNS) {
    const match = pattern.exec(value);
    if (match?.[1] && /^\d{1,10}$/.test(match[1])) return String(Number(match[1]));
  }
  return null;
}

export function explicitTicketNumber(payload: Record<string, unknown>): string | null {
  const raw = scalarText(payload.ticket_number ?? payload.ticket, 20)?.replace(/^#/, "") ?? null;
  if (!raw || !/^\d+$/.test(raw)) return null;
  return String(Number(raw));
}

function subjectFrom(payload: Record<string, unknown>): string | null {
  const direct = scalarText(payload.subject ?? payload.email_subject, 500);
  if (direct) return direct;
  for (const key of ["customer_reply", "message", "reply"]) {
    const value = payload[key];
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nested = scalarText((value as Record<string, unknown>).subject, 500);
    if (nested) return nested;
  }
  return null;
}

export type InboundReplyFields = {
  email: string | null;
  name: string | null;
  ticketId: string | null;
  ticketNumber: string | null;
  raw: string | null;
  body: string | null;
};

/**
 * Read a GoHighLevel Customer Replied webhook.
 * Custom Data wins for customer_email, customer_name, customer_reply, ticket_number, and ticket_id.
 * Otherwise use the top-level contact email, full_name, and message.body.
 */
export function readInboundPayload(payload: Record<string, unknown>): InboundReplyFields {
  const source = withCustomDataPriority(payload);
  const { raw, body } = replyFromPayload(source);
  return {
    email: scalarText(source.customer_email ?? source.email, 320)?.toLowerCase() ?? null,
    name: scalarText(source.customer_name ?? source.name ?? source.full_name, 200),
    ticketId: scalarText(source.ticket_id, 60),
    ticketNumber: ticketNumberFromReply(source, raw),
    raw,
    body,
  };
}

/** Explicit ticket_number wins. Otherwise read `[#239]`, `ticket #239`, or `Ticket 239` from the subject, then the raw reply. */
export function ticketNumberFromReply(payload: Record<string, unknown>, rawReply: string | null): string | null {
  const explicit = explicitTicketNumber(payload);
  if (scalarText(payload.ticket_id, 60)) return explicit;
  if (explicit) return explicit;
  return parseTicketNumber(subjectFrom(payload)) ?? parseTicketNumber(rawReply);
}

/** Structured rejection log. The webhook key is redacted and is never a field. */
export function inboundRejectionLog(
  status: number,
  reason: string,
  agencyId: string | null | undefined,
  secret?: string | null,
): { source: string; status: number; reason: string; agency_id: string | null } {
  const hide = (value: string) => (secret && secret.length >= 8 ? value.split(secret).join("[redacted]") : value);
  return {
    source: "inbound-ticket-reply",
    status,
    reason: hide(reason),
    agency_id: agencyId ? hide(agencyId) : null,
  };
}
