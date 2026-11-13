/**
 * Customer email goes out through a GoHighLevel inbound webhook.
 * A workflow on that URL sends the message. This module only POSTs flat JSON.
 *
 * first_name is never empty. Names and other free text are stripped, capped,
 * and HTML-escaped. A template URL that is empty or not https is not posted:
 * customer_message_events gets status failed and a reason, and the claim is
 * not completed. A duplicate claim does not post again. A timeout holds the
 * lease. A definite non-2xx releases it. A 2xx completes it.
 *
 * customer_message_events.status is `sent` or `failed` (the table check has no
 * missing_url value). A blank secret is status `failed` and detail `missing_url`.
 * An unset secret uses the coded default. portal_invite is not a GoHighLevel event.
 * Nothing here throws: a logging or network problem must not fail the caller.
 */
import { ghlEmailDedupeKey, runClaimedGhlSend, type GhlEmailClaimClient } from "./ghl-email-claim.ts";
import { ghlEscapeHtml, ghlFreeText, ghlGreetingName, ghlMessageText, ghlUrlFieldProblem } from "./ghl-email-text.ts";

export { ghlEmailDedupeKey };
export type { GhlEmailClaimClient };

export const GHL_EMAIL_EVENT_SECRETS: Record<string, string> = {
  ticket_confirmation: "GHL_TICKET_CONFIRMATION_WEBHOOK_URL",
  admin_invite: "GHL_ADMIN_INVITE_WEBHOOK_URL",
  support_rep_login: "GHL_SUPPORT_REP_LOGIN_WEBHOOK_URL",
};

/** Used when the matching secret is unset. */
export const GHL_EMAIL_WEBHOOK_DEFAULTS: Record<string, string> = {
  ticket_confirmation: "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/8a019abe-e928-452c-b546-ed9d32124a98",
  admin_invite: "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/1e7f9e48-013c-47ac-b4c8-174757f0166a",
  support_rep_login: "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/7927e167-5d41-41b6-84ea-84f7034d19fd",
};

/** Button fields the workflow inserts. Empty or non-https refuses the POST. */
export const GHL_TEMPLATE_URL_FIELDS: Record<string, readonly string[]> = {
  ticket_confirmation: ["ticket_url"],
  admin_invite: ["invite_url"],
  support_rep_login: ["login_url"],
};

export type GhlEmailOutcome = "sent" | "failed" | "missing_url" | "duplicate" | "overlap";

export type GhlEmailResult = {
  ok: boolean;
  status: GhlEmailOutcome;
  detail: string | null;
};

type EnvGetter = (name: string) => string | undefined;

export type GhlEmailFetch = (
  url: string,
  init: { method: "POST"; headers: { "Content-Type": "application/json" }; body: string; signal?: AbortSignal },
) => Promise<{ ok: boolean; status: number }>;

type MessageLog = {
  userEmail?: string | null;
  channel: "email";
  templateKey: string;
  subject?: string | null;
  provider: "ghl";
  status: "sent" | "failed" | "suppressed";
  source: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
};

export type GhlEmailOptions = {
  source?: string;
  getEnv?: EnvGetter;
  fetchImpl?: GhlEmailFetch;
  log?: (row: MessageLog) => Promise<void>;
  /** ticket_confirmation:<ticket id>, admin_invite:<invite id>, support_rep_login:<rep id>:<code id>. */
  dedupeKey?: string | null;
  claims?: GhlEmailClaimClient | null;
};

const CORE_KEYS = new Set(["event", "email", "first_name", "last_name", "full_name"]);

function defaultEnv(name: string): string | undefined {
  try {
    const deno = (globalThis as { Deno?: { env?: { get?: EnvGetter } } }).Deno;
    return deno?.env?.get?.(name);
  } catch {
    return undefined;
  }
}

export function ghlEmailEventSecret(eventName: string): string | null {
  const secret = GHL_EMAIL_EVENT_SECRETS[eventName];
  return secret ?? null;
}

/**
 * Webhook URL for this event. An unset secret uses the coded default.
 * An explicit blank value skips. portal_invite is ignored, including GHL_PORTAL_INVITE_WEBHOOK_URL.
 */
export function readGhlEmailWebhookUrl(eventName: string, getEnv: EnvGetter = defaultEnv): string | null {
  const secret = ghlEmailEventSecret(eventName);
  if (!secret) return null;
  const raw = getEnv(secret);
  if (raw === undefined) return GHL_EMAIL_WEBHOOK_DEFAULTS[eventName] ?? null;
  const target = raw.trim();
  return target ? target : null;
}

function isUrlField(key: string): boolean {
  return key.endsWith("_url") || key.endsWith("_link");
}

function isNewUserFlag(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== "string") return false;
  const flag = value.trim().toLowerCase();
  return flag === "yes" || flag === "true";
}

/** Escape text, then turn newlines into breaks, so a workflow can drop the result into HTML. */
export function ghlEmailHtml(text: string): string {
  return ghlEscapeHtml(text)
    .replace(/\r\n/g, "<br>")
    .replace(/\n/g, "<br>");
}

/**
 * Why this event must not be posted, or null when every template URL is https.
 * portal_invite is not listed: it never posts to GoHighLevel.
 */
export function ghlTemplateUrlProblem(eventName: string, body: Record<string, unknown>): string | null {
  const fields = GHL_TEMPLATE_URL_FIELDS[eventName];
  if (!fields) return null;
  for (const field of fields) {
    const problem = ghlUrlFieldProblem(field, body[field]);
    if (problem) return problem;
  }
  return null;
}

/** Flat JSON body. Nested objects are dropped so a workflow can map each field. */
export function ghlEmailBody(eventName: string, payload: Record<string, unknown>): Record<string, string | number | boolean> {
  const names = ghlGreetingName({
    firstName: payload.first_name,
    lastName: payload.last_name,
    fullName: payload.full_name ?? payload.name,
    email: payload.email,
  });
  const body: Record<string, string | number | boolean> = {
    event: eventName,
    email: typeof payload.email === "string" ? payload.email.trim().toLowerCase().slice(0, 320) : "",
    first_name: names.first_name,
    last_name: names.last_name,
    full_name: names.full_name,
  };
  for (const [key, value] of Object.entries(payload)) {
    if (CORE_KEYS.has(key) || key === "name" || key === "ticket_message") continue;
    if (typeof value === "string") {
      if (isUrlField(key)) {
        const trimmed = value.trim().slice(0, 2000);
        if (trimmed) body[key] = trimmed;
        continue;
      }
      if (key === "code") {
        const code = value.trim().slice(0, 32);
        if (code) body[key] = code;
        continue;
      }
      const cap = key === "subject" || key === "ticket_subject" ? 200 : 80;
      const text = ghlFreeText(value, cap);
      if (text) body[key] = text;
    } else if (typeof value === "number" && Number.isFinite(value)) {
      body[key] = value;
    } else if (typeof value === "boolean") {
      body[key] = value;
    }
  }
  if (eventName === "ticket_confirmation") {
    const message = ghlMessageText(payload.ticket_message);
    if (message) {
      body.ticket_message = ghlEscapeHtml(message);
      body.ticket_message_html = ghlEmailHtml(message);
    }
  }
  if (eventName === "admin_invite") {
    body.button_label = isNewUserFlag(payload.is_new_user) ? "Accept invite" : "Open";
  }
  return body;
}

function subjectOf(payload: Record<string, unknown>): string | null {
  const subject = ghlFreeText(payload.subject, 200) || ghlFreeText(payload.ticket_subject, 200);
  return subject || null;
}

async function writeLog(row: MessageLog, log?: (row: MessageLog) => Promise<void>): Promise<void> {
  try {
    if (log) {
      await log(row);
      return;
    }
    const mod = await import("./journey-log.ts");
    await mod.logCustomerMessage(row);
  } catch (error) {
    console.error("ghl email log", error instanceof Error ? error.message : error);
  }
}

function dbStatusFor(status: GhlEmailOutcome): "sent" | "failed" | "suppressed" {
  if (status === "sent") return "sent";
  if (status === "duplicate" || status === "overlap") return "suppressed";
  return "failed";
}

/**
 * POST one customer-email event. `eventName` selects the URL secret
 * (`GHL_TICKET_CONFIRMATION_WEBHOOK_URL`, `GHL_ADMIN_INVITE_WEBHOOK_URL`,
 * `GHL_SUPPORT_REP_LOGIN_WEBHOOK_URL`). Portal invites are not sent from here.
 * Kit login mail is the `saassuite.kit_purchased` workflow.
 */
export async function postGhlEmailEvent(
  eventName: string,
  payload: Record<string, unknown>,
  options: GhlEmailOptions = {},
): Promise<GhlEmailResult> {
  const getEnv = options.getEnv ?? defaultEnv;
  const source = (options.source || "ghl-email-webhook").slice(0, 80);
  const body = ghlEmailBody(eventName, payload);
  const email = typeof body.email === "string" ? body.email : "";
  const subject = subjectOf(payload);
  const dedupeKey = (options.dedupeKey ?? "").trim();

  const finish = async (status: GhlEmailOutcome, detail: string | null): Promise<GhlEmailResult> => {
    await writeLog({
      userEmail: email || null,
      channel: "email",
      templateKey: eventName,
      subject,
      provider: "ghl",
      status: dbStatusFor(status),
      source,
      detail,
      metadata: { outcome: status, ...(dedupeKey ? { claim_key: dedupeKey } : {}) },
    }, options.log);
    return { ok: status === "sent" || status === "duplicate", status, detail };
  };

  try {
    if (!email || !email.includes("@")) {
      return await finish("failed", "missing_email");
    }
    const url = readGhlEmailWebhookUrl(eventName, getEnv);
    if (!url) return await finish("missing_url", "missing_url");
    if (!/^https:\/\//i.test(url)) return await finish("failed", "invalid_url");

    const templateProblem = ghlTemplateUrlProblem(eventName, body);
    if (templateProblem) return await finish("failed", templateProblem);

    const fetchImpl = options.fetchImpl ?? fetch;
    let failureDetail = "request_failed";
    const send = async (): Promise<"sent" | "failed" | "uncertain"> => {
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) return "sent";
        const status = typeof response.status === "number" && Number.isFinite(response.status) ? response.status : 0;
        if (status >= 100 && status <= 599) {
          failureDetail = `http_${status}`;
          console.error("ghl email webhook", eventName, status);
          return "failed";
        }
        failureDetail = "request_failed";
        return "uncertain";
      } catch (error) {
        failureDetail = "request_failed";
        console.error("ghl email webhook", eventName, error instanceof Error ? error.message : error);
        return "uncertain";
      }
    };

    if (dedupeKey && options.claims) {
      const claimed = await runClaimedGhlSend({ key: dedupeKey, claims: options.claims, send });
      if (claimed === "duplicate") return await finish("duplicate", "duplicate");
      if (claimed === "overlap") return await finish("overlap", "in_progress");
      if (claimed === "sent") return await finish("sent", null);
      if (claimed === "uncertain") return await finish("failed", failureDetail);
      if (claimed === "missing_url" || claimed === "skipped") return await finish("failed", claimed);
      return await finish("failed", failureDetail);
    }

    const posted = await send();
    if (posted === "sent") return await finish("sent", null);
    return await finish("failed", failureDetail);
  } catch (error) {
    console.error("ghl email webhook", eventName, error instanceof Error ? error.message : error);
    return await finish("failed", "request_failed");
  }
}
