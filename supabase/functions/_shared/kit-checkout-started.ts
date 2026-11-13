import { runClaimedGhlSend, type GhlEmailClaimClient } from "./ghl-email-claim.ts";
import { ghlGreetingName, ghlUrlFieldProblem } from "./ghl-email-text.ts";
import { kitGhlDefiniteFailure } from "./kit-lynkific.ts";
import { kitUtmFields, type KitContactUtms } from "./kit-meta.ts";

/** GoHighLevel inbound hook used when KIT_CHECKOUT_STARTED_WEBHOOK_URL is unset. */
export const KIT_CHECKOUT_STARTED_WEBHOOK_FALLBACK =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/21cf8682-7a42-48fe-917b-5c989453985b";

export const KIT_CHECKOUT_PAGE_URL = "https://saassuite.ai/one-feature-kit/checkout";

/** Bound the POST so a slow GoHighLevel hook cannot hold checkout open. */
export const KIT_CHECKOUT_STARTED_TIMEOUT_MS = 3000;

const FRIENDS_INTERNAL_CODE = "friendsinternal";

export type KitCheckoutStartedPayload = {
  event: "saassuite.kit_checkout_started";
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  line_ids: string[];
  amount_cents_total: number;
  promotion_code: string | null;
  checkout_session_id: string;
  checkout_url: string;
  started_at: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  source: "saassuite";
};

export type KitCheckoutStartedSkip = "test-mode" | "missing-email" | "friends-internal" | "test-traffic";

export type KitCheckoutStartedPost = (
  url: string,
  body: string,
  signal: AbortSignal,
) => Promise<{ ok: boolean; status?: number | null }>;

export function kitCheckoutStartedPayload(input: {
  email: string;
  phone: string;
  name: string;
  lineIds: readonly string[];
  amountCentsTotal: number;
  promotionCode: string | null;
  checkoutSessionId: string;
  startedAt: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
}): KitCheckoutStartedPayload {
  const name = ghlGreetingName({ fullName: input.name, email: input.email });
  const promotionCode = input.promotionCode?.trim() ?? "";
  const utm: KitContactUtms = kitUtmFields(input);
  return {
    event: "saassuite.kit_checkout_started",
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    first_name: name.first_name,
    last_name: name.last_name,
    line_ids: [...input.lineIds],
    amount_cents_total: input.amountCentsTotal,
    promotion_code: promotionCode ? promotionCode : null,
    checkout_session_id: input.checkoutSessionId,
    checkout_url: KIT_CHECKOUT_PAGE_URL,
    started_at: input.startedAt,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    source: "saassuite",
  };
}

/** Live Stripe, a real email, and anything other than the internal 100% comp. */
export function kitCheckoutStartedSkipReason(input: {
  livemode: boolean;
  email: string;
  promotionCode: string | null | undefined;
  isTest?: boolean;
}): KitCheckoutStartedSkip | null {
  if (input.isTest) return "test-traffic";
  if (input.livemode !== true) return "test-mode";
  if (!input.email.trim()) return "missing-email";
  if ((input.promotionCode ?? "").trim().toLowerCase() === FRIENDS_INTERNAL_CODE) return "friends-internal";
  return null;
}

/**
 * Unset uses the GoHighLevel hook. An explicit empty or blank value skips the POST.
 */
export function kitCheckoutStartedWebhookUrl(envValue: string | undefined): string | null {
  if (envValue === undefined) return KIT_CHECKOUT_STARTED_WEBHOOK_FALLBACK;
  const target = envValue.trim();
  return target ? target : null;
}

export type KitCheckoutStartedAttempt = "skipped" | "sent" | "failed" | "uncertain" | "missing_url";

/**
 * POST the checkout-started event.
 * missing_url means checkout_url is empty or not https, so nothing is posted.
 * failed is a definite non-2xx. uncertain is a timeout or a network error.
 * An empty webhook URL is a skip. This function does not throw.
 */
export async function attemptKitCheckoutStarted(
  payload: KitCheckoutStartedPayload,
  url: string | null | undefined,
  post: KitCheckoutStartedPost,
  timeoutMs = KIT_CHECKOUT_STARTED_TIMEOUT_MS,
): Promise<KitCheckoutStartedAttempt> {
  if (ghlUrlFieldProblem("checkout_url", payload.checkout_url)) return "missing_url";
  const target = url?.trim() ?? "";
  if (!target) return "skipped";
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      post(target, JSON.stringify(payload), controller.signal).then(
        (value) => {
          if (value?.ok === true) return "sent" as const;
          return kitGhlDefiniteFailure(value) ? "failed" as const : "uncertain" as const;
        },
        () => "uncertain" as const,
      ),
      new Promise<"uncertain">((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve("uncertain");
        }, timeoutMs);
      }),
    ]);
    return result;
  } catch {
    return "uncertain";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Same as attemptKitCheckoutStarted, with a timeout reported as failed. */
export async function deliverKitCheckoutStarted(
  payload: KitCheckoutStartedPayload,
  url: string | null | undefined,
  post: KitCheckoutStartedPost,
  timeoutMs = KIT_CHECKOUT_STARTED_TIMEOUT_MS,
): Promise<"skipped" | "sent" | "failed" | "missing_url"> {
  const result = await attemptKitCheckoutStarted(payload, url, post, timeoutMs);
  if (result === "uncertain") return "failed";
  return result;
}

export function postKitCheckoutStarted(url: string, body: string, signal: AbortSignal): Promise<{ ok: boolean; status: number }> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  }).then(response => ({ ok: response.ok, status: response.status }));
}

function edgeWaitUntil(): ((promise: Promise<unknown>) => void) | null {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof runtime?.waitUntil !== "function") return null;
  return promise => runtime.waitUntil!(promise);
}

export type KitCheckoutStartedInput = {
  livemode: boolean;
  email: string;
  phone: string;
  name: string;
  lineIds: readonly string[];
  amountCentsTotal: number;
  promotionCode: string | null;
  checkoutSessionId: string;
  startedAt: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  /** Deno.env.get("KIT_CHECKOUT_STARTED_WEBHOOK_URL"). Undefined falls back; blank skips. */
  webhookUrl: string | undefined;
  /** QA browser. Skips the GoHighLevel POST. The checkout row is still stored. */
  isTest?: boolean;
};

/**
 * Fire the checkout-started hook after Stripe has created the session.
 * EdgeRuntime.waitUntil keeps the POST off the response. Without it, the POST is awaited
 * and still capped by the timeout. This function does not throw.
 */
export type KitCheckoutStartedResult =
  | "skipped"
  | "sent"
  | "failed"
  | "uncertain"
  | "missing_url"
  | "duplicate"
  | "overlap";

function reportKitCheckoutResult(
  onResult: ((result: KitCheckoutStartedResult) => void | Promise<void>) | undefined,
  result: KitCheckoutStartedResult,
) {
  if (!onResult) return;
  void Promise.resolve(onResult(result)).catch(() => {});
}

export async function queueKitCheckoutStarted(
  input: KitCheckoutStartedInput,
  options?: {
    post?: KitCheckoutStartedPost;
    timeoutMs?: number;
    waitUntil?: ((promise: Promise<unknown>) => void) | null;
    onResult?: (result: KitCheckoutStartedResult) => void | Promise<void>;
    /** checkout_started:<session>. Holds, releases, and completes like the kit purchase lease. */
    claims?: GhlEmailClaimClient | null;
  },
): Promise<"skipped" | "sent" | "failed" | "scheduled" | "duplicate" | "overlap" | "missing_url"> {
  try {
    const url = kitCheckoutStartedWebhookUrl(input.webhookUrl);
    if (kitCheckoutStartedSkipReason(input) || !url) {
      reportKitCheckoutResult(options?.onResult, "skipped");
      return "skipped";
    }
    const payload = kitCheckoutStartedPayload(input);
    if (ghlUrlFieldProblem("checkout_url", payload.checkout_url)) {
      reportKitCheckoutResult(options?.onResult, "missing_url");
      return "missing_url";
    }
    const post = options?.post ?? postKitCheckoutStarted;
    const send = () => attemptKitCheckoutStarted(payload, url, post, options?.timeoutMs);
    const work = options?.claims
      ? runClaimedGhlSend({
        key: `checkout_started:${input.checkoutSessionId}`,
        claims: options.claims,
        send,
      })
      : send();
    const tracked = work.then(
      result => {
        if (result === "failed" || result === "uncertain") console.error("kit checkout started webhook failed");
        reportKitCheckoutResult(options?.onResult, result);
        return result === "uncertain" ? "failed" as const : result;
      },
      error => {
        console.error("kit checkout started", error instanceof Error ? error.message : "unknown");
        reportKitCheckoutResult(options?.onResult, "failed");
        return "failed" as const;
      },
    );
    const waitUntil = options?.waitUntil === undefined ? edgeWaitUntil() : options.waitUntil;
    if (typeof waitUntil === "function") {
      waitUntil(tracked);
      return "scheduled";
    }
    return await tracked;
  } catch (error) {
    console.error("kit checkout started", error instanceof Error ? error.message : "unknown");
    reportKitCheckoutResult(options?.onResult, "failed");
    return "failed";
  }
}
