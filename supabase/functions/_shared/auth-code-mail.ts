/**
 * One-time password codes go out through a GoHighLevel webhook.
 * The POST body is only the fields that workflow reads. This module does not call another mail provider.
 */

import { PASSWORD_CODE_TTL_MS } from "./password-proof.ts";

export const AUTH_CODE_EVENT = "saassuite.auth_password_code";
export const AUTH_CODE_FIELDS = [
  "event",
  "email",
  "first_name",
  "code",
  "expires_minutes",
  "set_password_url",
  "request_id",
  "requested_at",
] as const;

const KIT_NEXT = "/app/dashboard?view=kit";
const NAME_MAX = 80;

export type AuthCodeMail = {
  email: string;
  code: string;
  storedFirstName?: string | null;
  fullName?: string | null;
  nextPath: string | null;
  requestId: string;
  requestedAt: string;
};

export type AuthCodePayload = {
  event: typeof AUTH_CODE_EVENT;
  email: string;
  first_name: string;
  code: string;
  expires_minutes: number;
  set_password_url: string;
  request_id: string;
  requested_at: string;
};

export function authCodeExpiresMinutes(ttlMs = PASSWORD_CODE_TTL_MS): number | null {
  if (ttlMs <= 0 || ttlMs % 60000 !== 0) return null;
  return ttlMs / 60000;
}

function cleanName(value: string | null | undefined): string {
  return (value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

export function escapeAuthCodeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch] ?? ch));
}

/** Cap by Unicode code point so an emoji is kept whole, and do not cut an HTML entity in half. */
export function capAuthCodeField(value: string, max = NAME_MAX): string {
  const points = Array.from(value);
  if (points.length <= max) return value;
  let cut = points.slice(0, max).join("");
  const amp = cut.lastIndexOf("&");
  if (amp >= 0 && !cut.slice(amp).includes(";")) cut = cut.slice(0, amp);
  return cut;
}

/**
 * Greeting for the email. Stored first name, then full name, then the
 * email's local part with its first letter capitalized, then "there".
 */
export function authCodeFirstName(input: {
  storedFirstName?: string | null;
  fullName?: string | null;
  email: string;
}): string {
  const stored = cleanName(input.storedFirstName);
  const full = cleanName(input.fullName);
  const local = input.email.split("@")[0]?.trim() ?? "";
  const fromEmail = local ? local.charAt(0).toUpperCase() + local.slice(1) : "";
  const raw = stored || full || fromEmail || "there";
  return capAuthCodeField(escapeAuthCodeHtml(raw));
}

function kitNextForUrl(nextPath: string | null | undefined): string {
  const raw = (nextPath ?? "").trim();
  if (!raw.startsWith("/app/dashboard") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return KIT_NEXT;
  }
  const [path, query = ""] = raw.split("?");
  const params = new URLSearchParams(query.split("#")[0] ?? "");
  params.delete("code");
  if (params.get("view") !== "kit") return KIT_NEXT;
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

/** Signup URL the email button opens. https only, with email and the kit next, and no code. */
export function authCodeSetPasswordUrl(email: string, nextPath: string | null | undefined): string | null {
  const clean = email.trim().toLowerCase();
  if (!clean.includes("@") || clean.startsWith("@")) return null;
  const next = kitNextForUrl(nextPath);
  const emailParam = encodeURIComponent(clean);
  const url = `https://saassuite.ai/signup?email=${emailParam}&next=${encodeURIComponent(next)}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    if (parsed.searchParams.get("email") !== clean) return null;
    const nextValue = parsed.searchParams.get("next") ?? "";
    if (!nextValue.includes("view=kit")) return null;
    if (parsed.searchParams.has("code")) return null;
    if (!parsed.search.includes(`email=${emailParam}`)) return null;
    return url;
  } catch {
    return null;
  }
}

export function authCodeWebhookBody(mail: AuthCodeMail): AuthCodePayload | null {
  const email = mail.email.trim().toLowerCase();
  const code = mail.code.trim();
  if (!/^\d{6}$/.test(code)) return null;
  const setPasswordUrl = authCodeSetPasswordUrl(email, mail.nextPath);
  if (!setPasswordUrl?.startsWith("https://")) return null;
  const requestId = mail.requestId.trim();
  if (!requestId || requestId.length > 80) return null;
  const requestedAt = mail.requestedAt.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(requestedAt)) return null;
  const expires = authCodeExpiresMinutes();
  if (expires == null) return null;
  return {
    event: AUTH_CODE_EVENT,
    email,
    first_name: authCodeFirstName({
      storedFirstName: mail.storedFirstName,
      fullName: mail.fullName,
      email,
    }),
    code,
    expires_minutes: expires,
    set_password_url: setPasswordUrl,
    request_id: requestId,
    requested_at: requestedAt,
  };
}

export async function postAuthCodeWebhook(input: {
  fetchImpl: typeof fetch;
  webhookUrl: string | undefined;
  mail: AuthCodeMail;
  timeoutMs?: number;
}): Promise<"sent" | "skipped" | "failed"> {
  const url = input.webhookUrl?.trim() ?? "";
  const body = authCodeWebhookBody(input.mail);
  if (!url || !body) return "skipped";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 3000);
  try {
    const response = await input.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  } finally {
    clearTimeout(timer);
  }
}
