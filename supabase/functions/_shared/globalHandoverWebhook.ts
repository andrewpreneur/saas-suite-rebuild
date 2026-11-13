// One global outbound webhook for every agency when a support chat needs a human.
// Separate from the per-agency support_webhook_url and from the existing
// LeadConnector "New Chat" alert. A failure here must never break chat or tickets.
// Owners on platform_support_excluded_agencies send nothing. When the service
// client can run the exclusion RPC, an error skips the POST (fail closed).
import { globalHandoverExclusionGate } from "./platformSupportExcluded.ts";

export const GLOBAL_HANDOVER_TIMEOUT_MS = 3000;
export const GLOBAL_HANDOVER_DEDUPE_MS = 10 * 60 * 1000;
export const GLOBAL_HANDOVER_SOURCE = "global_handover";

export type GlobalHandoverEvent = "handover_requested" | "ticket_auto_opened";

export type GlobalHandoverPayload = {
  event: GlobalHandoverEvent;
  agency_id: string;
  customer_email: string | null;
  customer_name: string | null;
  thread_id: string;
  ticket_number: number | null;
  last_customer_message: string | null;
  timestamp: string;
  test?: true;
};

export type GlobalHandoverInput = {
  event: GlobalHandoverEvent;
  agencyId: string;
  customerEmail?: string | null;
  customerName?: string | null;
  /** Chat thread uuid when already known. */
  threadId?: string | null;
  /** Email or name the chat tables use for this customer. */
  userIdentifier?: string | null;
  ticketNumber?: number | null;
  lastCustomerMessage?: string | null;
  timestamp?: string;
  /** Copilot/Help is a different conversation from the client-hub thread. */
  surface?: "hub" | "copilot";
  test?: boolean;
  /** Skip the per-thread claim. Used only by the service-role test action. */
  dedupe?: boolean;
};

type QueryError = { code?: string; message?: string } | null;
type QueryResult = { data?: unknown; error?: QueryError };

// Minimal slice of the Supabase client used for the dedupe row and thread lookup.
export type HandoverDb = {
  from: (table: string) => any;
};

export type HandoverPost = (
  url: string,
  body: string,
  authHeader: string | undefined,
  signal: AbortSignal,
) => Promise<{ ok: boolean; status: number }>;

const clip = (value: string | null | undefined, max = 2000) => {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
};

const textOrNull = (value: string | null | undefined) => {
  const text = clip(value, 320);
  return text;
};

/** Tickets the AI opens itself when nobody is available to take the chat. */
export function isAiAutoOpenedHandoverTicket(requestText: string | null | undefined): boolean {
  return /^\s*Human handover request from AI support\b/i.test(requestText || "");
}

/**
 * The person this handover is about. A real email wins. Rate-limit ids such as
 * `email:person@example.com` and `name:guest` collapse to the same key the hub
 * stores, so the widget, the AI chat, and the workflow dispatcher share one claim.
 */
export function handoverPersonKey(input: {
  userIdentifier?: string | null;
  customerEmail?: string | null;
}): string {
  const email = (input.customerEmail || "").trim().toLowerCase();
  if (email.includes("@")) return email;
  const raw = (input.userIdentifier || "").trim().toLowerCase();
  const stripped = raw.replace(/^(email|name):/, "");
  if (stripped.includes("@")) return stripped;
  return stripped;
}

/** Same person + agency + surface, so parallel code paths share one claim. */
export function handoverStableKey(input: {
  surface?: "hub" | "copilot";
  agencyId: string;
  userIdentifier?: string | null;
  customerEmail?: string | null;
  threadId?: string | null;
}): string {
  const who = handoverPersonKey(input) || (input.threadId || "unknown").trim().toLowerCase();
  const agency = (input.agencyId || "").trim().toLowerCase();
  return `${input.surface === "copilot" ? "copilot" : "hub"}:${agency}:${who}`;
}

export function handoverAlreadySent(lastSentAt: string | null | undefined, now: number, windowMs = GLOBAL_HANDOVER_DEDUPE_MS): boolean {
  if (!lastSentAt) return false;
  const sent = new Date(lastSentAt).getTime();
  if (Number.isNaN(sent)) return false;
  return now - sent < windowMs;
}

/**
 * The customer text on the global payload. `last_message` wins when it is set.
 * The client-hub widget's final handover body only sends `issue_description`.
 */
export function handoverLastCustomerMessage(lastMessage: unknown, issueDescription?: unknown): string | null {
  const message = lastMessage ?? issueDescription;
  return typeof message === "string" ? message : null;
}

/**
 * Hold the global handover until the final intake step.
 * Field names the client hub sends: `defer_global_handover` on the request body,
 * or `metadata.defer_global_handover`. Only a boolean true defers. Other surfaces
 * omit the flag and still fire immediately.
 */
export function deferGlobalHandoverRequested(source: unknown): boolean {
  if (!source || typeof source !== "object") return false;
  const body = source as { defer_global_handover?: unknown; metadata?: unknown };
  if (body.defer_global_handover === true) return true;
  const meta = body.metadata;
  if (!meta || typeof meta !== "object") return false;
  return (meta as { defer_global_handover?: unknown }).defer_global_handover === true;
}

/** Blank or missing URL means skip. The value is never defaulted to a hardcoded hook. */
export function globalHandoverWebhookUrl(envValue: string | undefined): string | null {
  const target = (envValue ?? "").trim();
  return target ? target : null;
}

/** Authorization is whatever the env var contains. Empty means no Authorization header. */
export function globalHandoverAuthHeader(envValue: string | undefined): string | undefined {
  if (envValue == null) return undefined;
  return envValue.trim() ? envValue.trim() : undefined;
}

export function serviceRoleAuthorized(authorization: string | null | undefined, serviceRoleKey: string | undefined): boolean {
  if (!serviceRoleKey) return false;
  return (authorization || "").trim() === `Bearer ${serviceRoleKey}`;
}

/**
 * The LeadConnector body support-handover-alert and v2-native-ai-chat send.
 * Caller fields stay, and these two keys are always present.
 */
export function withSupportAlertEnvelope(
  extra: Record<string, unknown> | null | undefined,
  base: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...(extra || {}), ...base };
  payload.notification_type = "support_alert";
  payload.event_type = "chat_handover";
  return payload;
}

/**
 * Global handover input for a support alert. Omitting surface and threadId
 * keeps the hub lookup. Copilot sets both so an owner chat does not share
 * a claim with that agency's client-hub thread.
 */
export function handoverInputFromSupportAlert(
  base: {
    user_email?: unknown;
    user_name?: unknown;
    contact_name?: unknown;
    last_message?: unknown;
    issue_description?: unknown;
    timestamp?: unknown;
  },
  agencyId: string,
  userIdentifier: string | null | undefined,
  options?: { surface?: "hub" | "copilot"; threadId?: string | null },
): GlobalHandoverInput {
  const email = typeof base.user_email === "string" ? base.user_email
    : (userIdentifier && userIdentifier.includes("@") ? userIdentifier.replace(/^(email|name):/i, "") : null);
  const person = email && email.includes("@")
    ? email
    : (userIdentifier || "").replace(/^(email|name):/i, "") || email;
  return {
    event: "handover_requested",
    agencyId,
    customerEmail: email,
    customerName: typeof base.user_name === "string" ? base.user_name
      : (typeof base.contact_name === "string" ? base.contact_name : null),
    userIdentifier: person,
    threadId: options?.threadId,
    lastCustomerMessage: handoverLastCustomerMessage(base.last_message, base.issue_description),
    timestamp: typeof base.timestamp === "string" ? base.timestamp : undefined,
    surface: options?.surface,
  };
}

export function buildGlobalHandoverPayload(input: GlobalHandoverInput, threadId: string, now = new Date()): GlobalHandoverPayload {
  const email = textOrNull(input.customerEmail);
  const payload: GlobalHandoverPayload = {
    event: input.event,
    agency_id: (input.agencyId || "").trim(),
    customer_email: email && email.includes("@") ? email : null,
    customer_name: textOrNull(input.customerName),
    thread_id: threadId,
    ticket_number: typeof input.ticketNumber === "number" && Number.isFinite(input.ticketNumber) ? input.ticketNumber : null,
    last_customer_message: clip(input.lastCustomerMessage),
    timestamp: input.timestamp || now.toISOString(),
  };
  if (input.test) payload.test = true;
  return payload;
}

export function testHandoverPayload(now = new Date().toISOString()): GlobalHandoverPayload {
  return {
    event: "handover_requested",
    agency_id: "test-agency",
    customer_email: "handover-test@example.com",
    customer_name: "Test Customer",
    thread_id: "test-thread",
    ticket_number: null,
    last_customer_message: "This is a fake test handover. Nobody is waiting.",
    timestamp: now,
    test: true,
  };
}

export async function deliverGlobalHandover(
  payload: GlobalHandoverPayload,
  url: string,
  authHeader: string | undefined,
  post: HandoverPost,
  timeoutMs = GLOBAL_HANDOVER_TIMEOUT_MS,
): Promise<"sent" | "failed"> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      post(url, JSON.stringify(payload), authHeader, controller.signal).then(
        (value) => ({ ok: value?.ok === true, status: value?.status ?? 0 }),
        () => ({ ok: false, status: 0 }),
      ),
      new Promise<{ ok: boolean; status: number }>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve({ ok: false, status: 0 });
        }, timeoutMs);
      }),
    ]);
    if (!result.ok) {
      console.error("global handover webhook failed", payload.event, payload.agency_id, result.status || "timeout");
      return "failed";
    }
    console.log("global handover webhook sent", payload.event, payload.agency_id, payload.thread_id);
    return "sent";
  } catch (error) {
    console.error("global handover webhook failed", payload.event, error instanceof Error ? error.message : error);
    return "failed";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function postGlobalHandover(url: string, body: string, authHeader: string | undefined, signal: AbortSignal) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers.Authorization = authHeader;
  return fetch(url, { method: "POST", headers, body, signal }).then((response) => ({ ok: response.ok, status: response.status }));
}

function edgeWaitUntil(): ((promise: Promise<unknown>) => void) | null {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof runtime?.waitUntil !== "function") return null;
  return (promise) => runtime.waitUntil!(promise);
}

function envGet(name: string): string | undefined {
  const deno = (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno;
  return deno?.env.get(name);
}

async function lookupThreadId(db: HandoverDb, agencyId: string, userIdentifier: string): Promise<string | null> {
  const ident = userIdentifier.trim();
  if (!agencyId || !ident) return null;
  try {
    const { data, error } = await db.from("chat_threads").select("id").eq("agency_id", agencyId).ilike("user_identifier", ident).limit(1);
    if (error) {
      console.error("global handover thread lookup failed", error.message || error.code);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : null;
    const id = row && typeof row === "object" && "id" in row ? String((row as { id?: string }).id || "") : "";
    return id || null;
  } catch (error) {
    console.error("global handover thread lookup failed", error instanceof Error ? error.message : error);
    return null;
  }
}

/** True when this caller won the claim and should POST. Failures fail open so an alert is not dropped. */
export async function claimGlobalHandover(
  db: HandoverDb,
  agencyId: string,
  identifier: string,
  now: number,
): Promise<boolean> {
  const agency = (agencyId || "").trim().toLowerCase();
  try {
    const { data, error } = await db
      .from("team_reply_webhook_throttle")
      .select("id, last_sent_at")
      .eq("source", GLOBAL_HANDOVER_SOURCE)
      .eq("agency_id", agency)
      .eq("identifier", identifier)
      .maybeSingle();
    if (error) {
      console.error("global handover dedupe read failed", error.message || error.code);
      return true;
    }
    const row = data && typeof data === "object" ? data as { id?: string; last_sent_at?: string } : null;
    if (row?.id && handoverAlreadySent(row.last_sent_at, now)) return false;
    if (row?.id) {
      const updated = await db.from("team_reply_webhook_throttle").update({ last_sent_at: new Date(now).toISOString() }).eq("id", row.id);
      if (updated.error) console.error("global handover dedupe update failed", updated.error.message || updated.error.code);
      return true;
    }
    const inserted = await db.from("team_reply_webhook_throttle").insert({
      source: GLOBAL_HANDOVER_SOURCE,
      agency_id: agency,
      identifier,
      last_sent_at: new Date(now).toISOString(),
    });
    if (inserted.error?.code === "23505") return false;
    if (inserted.error) {
      console.error("global handover dedupe insert failed", inserted.error.message || inserted.error.code);
      return true;
    }
    return true;
  } catch (error) {
    console.error("global handover dedupe failed", error instanceof Error ? error.message : error);
    return true;
  }
}

export type NotifyGlobalHandoverDeps = {
  webhookUrl: string | undefined;
  authHeader?: string | undefined;
  db?: HandoverDb | null;
  post?: HandoverPost;
  waitUntil?: ((promise: Promise<unknown>) => void) | null;
  now?: number;
  timeoutMs?: number;
};

/**
 * POST the global handover event. Unset URL skips. One event per type per thread
 * inside the dedupe window. EdgeRuntime.waitUntil keeps the POST off the caller.
 * This function does not throw.
 */
export async function notifyGlobalHandover(
  input: GlobalHandoverInput,
  deps: NotifyGlobalHandoverDeps,
): Promise<"skipped" | "duplicate" | "sent" | "failed" | "scheduled"> {
  try {
    const url = globalHandoverWebhookUrl(deps.webhookUrl);
    if (!url) {
      console.warn(
        "global handover webhook skipped: SUPPORT_HANDOVER_WEBHOOK_URL not configured",
        input.event,
        input.agencyId,
      );
      return "skipped";
    }
    if ((await globalHandoverExclusionGate(deps.db, input.agencyId)) === "skip") {
      console.info(
        "global handover webhook skipped: platform support excluded",
        input.event,
        input.agencyId,
      );
      return "skipped";
    }
    const now = deps.now ?? Date.now();
    const who = handoverPersonKey(input);
    const lookedUp = !input.threadId && deps.db && who ? await lookupThreadId(deps.db, input.agencyId, who) : null;
    const threadId = (input.threadId || lookedUp || handoverStableKey(input)).trim();
    if (input.dedupe !== false && deps.db) {
      const claimed = await claimGlobalHandover(
        deps.db,
        input.agencyId,
        `${input.event}:${handoverStableKey({ ...input, threadId })}`,
        now,
      );
      if (!claimed) {
        console.info("global handover webhook duplicate", input.event, input.agencyId);
        return "duplicate";
      }
    }
    const payload = buildGlobalHandoverPayload(input, threadId, new Date(now));
    const work = deliverGlobalHandover(
      payload,
      url,
      globalHandoverAuthHeader(deps.authHeader),
      deps.post ?? postGlobalHandover,
      deps.timeoutMs,
    );
    const waitUntil = deps.waitUntil === undefined ? edgeWaitUntil() : deps.waitUntil;
    if (typeof waitUntil === "function") {
      waitUntil(work);
      return "scheduled";
    }
    return await work;
  } catch (error) {
    console.error("global handover webhook failed", error instanceof Error ? error.message : error);
    return "failed";
  }
}

/** Edge-function entry. Reads the two env vars and uses the caller's service client for dedupe. */
export function notifyGlobalHandoverFromEnv(input: GlobalHandoverInput, db?: HandoverDb | null) {
  return notifyGlobalHandover(input, {
    webhookUrl: envGet("SUPPORT_HANDOVER_WEBHOOK_URL"),
    authHeader: envGet("SUPPORT_HANDOVER_WEBHOOK_AUTH"),
    db: db ?? null,
  });
}
