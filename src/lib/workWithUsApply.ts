import { supabase, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

export const WWU_SESSION_KEY = "wwu_apply_session";
export const WWU_CTX_KEY = "wwu_ctx";
export const WWU_QUEUE_KEY = "wwu_apply_queue";
export const WWU_STARTED_KEY = "wwu_apply_started";

export function wwuSessionId() {
  try {
    const existing = localStorage.getItem(WWU_SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(WWU_SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function stashWwuContext() {
  const params = new URLSearchParams(window.location.search);
  const ctx: Record<string, string> = {
    landing_url: window.location.href.slice(0, 500),
    referrer: document.referrer.slice(0, 500),
    first_seen_at: new Date().toISOString(),
    session_id: wwuSessionId(),
  };
  params.forEach((value, key) => {
    if (key.startsWith("utm_") || key === "fbclid") ctx[key] = value.slice(0, 200);
  });
  const cookie = (name: string) => document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? "";
  if (cookie("_fbp")) ctx.fbp = cookie("_fbp");
  if (cookie("_fbc")) ctx.fbc = cookie("_fbc");
  const raw = JSON.stringify(ctx);
  try {
    sessionStorage.setItem(WWU_CTX_KEY, raw);
    localStorage.setItem(WWU_CTX_KEY, raw);
  } catch {
    /* ignore */
  }
  return ctx;
}

export function readWwuContext(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(WWU_CTX_KEY) || localStorage.getItem(WWU_CTX_KEY) || "";
    const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export type WwuAnswers = {
  has_highlevel?: boolean;
  ghl_plan?: string;
  account_count?: string;
  path?: string;
  path_other?: string;
};

export type WwuResult = {
  ok: boolean;
  already_applied?: boolean;
  next_step?: string;
  first_name?: string;
  name?: string;
  email?: string;
  path?: string;
  lead_id?: string;
  event_id?: string;
  answers?: WwuAnswers;
  error?: string;
  ignored?: boolean;
};

export function markWwuStarted(email: string) {
  try {
    localStorage.setItem(WWU_STARTED_KEY, email.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export function wwuStartedFor(email: string) {
  try {
    return localStorage.getItem(WWU_STARTED_KEY) === email.trim().toLowerCase();
  } catch {
    return false;
  }
}

/** A second Google account is a new lead, so it must not reuse the first session key. */
export function rotateWwuSession() {
  const id = crypto.randomUUID();
  try {
    localStorage.setItem(WWU_SESSION_KEY, id);
    localStorage.removeItem(WWU_STARTED_KEY);
  } catch {
    /* ignore */
  }
  return id;
}

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || "";
  return token ? { Authorization: `Bearer ${token}`, apikey: SUPABASE_PUBLISHABLE_KEY } : null;
}

/** Anon step. The magic link opens in another browser, so the row has to exist before the OTP email. */
export async function requestWwuMagic(body: Record<string, unknown>): Promise<WwuResult> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/work-with-us-apply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        apikey: SUPABASE_PUBLISHABLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, step: "magic_requested" }),
    });
    const payload = await response.json().catch(() => ({})) as WwuResult & { ignored?: boolean };
    if (response.status === 429) return { ok: false, error: payload.error || "Too many tries. Wait a few minutes and try again." };
    if (!response.ok || payload.ok === false) return { ok: false, error: payload.error || "Could not save" };
    return { ok: true, ...payload };
  } catch {
    return { ok: false, error: "Could not save" };
  }
}

export async function postWorkWithUs(body: Record<string, unknown>, keepalive = false): Promise<WwuResult> {
  const headers = await authHeader();
  if (!headers) return { ok: false, error: "Sign in required" };
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/work-with-us-apply`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive,
    });
    if (response.status === 401) return { ok: false, error: "Sign in required" };
    const payload = await response.json().catch(() => ({})) as WwuResult;
    if (!response.ok || payload.ok === false) return { ok: false, error: payload.error || "Could not save", ...payload };
    return { ok: true, ...payload };
  } catch {
    return { ok: false, error: "Could not save" };
  }
}

export function readWwuQueue(): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(WWU_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeWwuQueue(queue: Record<string, unknown>[]) {
  try {
    localStorage.setItem(WWU_QUEUE_KEY, JSON.stringify(queue.slice(-8)));
  } catch {
    /* ignore */
  }
}
