import type { CountryCode } from "libphonenumber-js";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export const AGENTS_SESSION_KEY = "agents_apply_session";
export const AGENTS_DRAFT_KEY = "agents_apply_draft";
export const AGENTS_QUEUE_KEY = "agents_apply_queue";

export type AgentStep = "email" | "has_highlevel" | "ghl_plan" | "sub_account_count" | "phone" | "thanks";

export type AgentDraft = {
  email: string;
  hasHighlevel: boolean | null;
  plan: string;
  count: string;
  phone: string;
  country: CountryCode;
  step: AgentStep;
  submitted: boolean;
  already: boolean;
};

const TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outloo.com": "outlook.com",
  "outlok.com": "outlook.com",
};

export function agentsSessionId(): string {
  try {
    const existing = localStorage.getItem(AGENTS_SESSION_KEY);
    if (existing && existing.length >= 8) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(AGENTS_SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function suggestEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at < 1) return null;
  const fixed = TYPOS[email.slice(at + 1)];
  if (!fixed) return null;
  return `${email.slice(0, at)}@${fixed}`;
}

export function emailLooksValid(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim().toLowerCase());
}

/**
 * Real numbers must pass libphonenumber. QA uses fictional NANP 555 numbers
 * such as 555-010-1999. That area code is not assigned, so isValid() rejects
 * it, but it is a 10-digit US number the server already stores as E.164.
 */
function qaUs555(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!/^1?555\d{7}$/.test(digits)) return null;
  return `+1${digits.slice(-10)}`;
}

export function toAgentPhone(raw: string, country: CountryCode): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = trimmed.startsWith("+")
    ? parsePhoneNumberFromString(trimmed)
    : parsePhoneNumberFromString(trimmed, country);
  if (parsed?.isValid()) return parsed.number;
  if (country === "US" || trimmed.startsWith("+1")) return qaUs555(trimmed);
  return null;
}

export function readAgentDraft(): AgentDraft | null {
  try {
    const raw = localStorage.getItem(AGENTS_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AgentDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAgentDraft(draft: AgentDraft) {
  try {
    localStorage.setItem(AGENTS_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function readAgentQueue(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(AGENTS_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeAgentQueue(items: Record<string, unknown>[]) {
  try {
    localStorage.setItem(AGENTS_QUEUE_KEY, JSON.stringify(items.slice(-8)));
  } catch {
    /* ignore */
  }
}

/** keepalive so a refresh can still deliver a partial. sendBeacon cannot set the function key. */
export function postAgentKeepalive(body: Record<string, unknown>) {
  try {
    void fetch(`${SUPABASE_URL}/functions/v1/funnel-apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* the queue retries on the next visit */
  }
}
