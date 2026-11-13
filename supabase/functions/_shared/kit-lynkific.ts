import { ghlGreetingName, ghlStripText, ghlUrlFieldProblem } from "./ghl-email-text.ts";
import { KIT_CATALOG, KIT_CUSTOMER_COPY, type KitLineId } from "./kit-catalog.ts";
import { kitBuyerSignInUrl } from "./kit-login.ts";
import { kitUtmFields, type KitContactUtms } from "./kit-meta.ts";

export type KitPurchasedItem = { sku: string; name: string; amount: number };

/** Flat body for the GoHighLevel "One Feature Kit – Purchased" inbound webhook. */
export type KitPurchasedPayload = {
  event: "saassuite.kit_purchased";
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  login_url: string;
  magic_link: string;
  order_total: number;
  currency: string;
  stripe_session_id: string;
  /** Old payload name for the same Checkout Session id. */
  checkout_session_id: string;
  payment_intent: string;
  items: KitPurchasedItem[];
  has_kit: boolean;
  has_video_bump: boolean;
  has_replay_bump: boolean;
  has_install_bump: boolean;
  kit_amount: number;
  video_bump_amount: number;
  replay_bump_amount: number;
  install_bump_amount: number;
  purchased_at: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  comped: boolean;
  promotion_code: string;
  /** One line per item, joined with <br>, for the GoHighLevel HTML email. */
  items_summary: string;
  /** Old payload fields. The Oct 21 sample mapped these. */
  line_ids: string[];
  amount_cents_total: number;
  source: "saassuite";
};

export function splitKitBuyerName(name: string): { first_name: string; last_name: string } {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return { first_name: "", last_name: "" };
  const [first, ...rest] = clean.split(" ");
  return { first_name: first ?? "", last_name: rest.join(" ") };
}

/** Stripe code string when present, otherwise the promotion code id. */
export function kitPromotionCode(discounts: { promotion_code?: unknown }[] | null | undefined): string | null {
  for (const discount of discounts ?? []) {
    const promo = discount.promotion_code;
    if (typeof promo === "string" && promo) return promo;
    if (promo && typeof promo === "object") {
      const record = promo as { code?: unknown; id?: unknown };
      if (typeof record.code === "string" && record.code) return record.code;
      if (typeof record.id === "string" && record.id) return record.id;
    }
  }
  return null;
}

function dollars(cents: number): number {
  return Math.round(cents) / 100;
}

function clipText(value: string | null | undefined, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function catalogAmount(id: string): number {
  if (!(id in KIT_CATALOG)) return 0;
  return dollars(KIT_CATALOG[id as KitLineId].amount);
}

function priceLabel(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** "The GoHighLevel One Feature Kit ($27)<br>…" so the HTML email keeps each item on its own line. */
export function kitItemsSummary(items: KitPurchasedItem[]): string {
  return items.map((item) => `${item.name} (${priceLabel(item.amount)})`).join("<br>");
}

export function kitPurchasedPayload(input: {
  email: string;
  phone: string;
  name: string;
  lineIds: string[];
  amountCentsTotal: number;
  comped: boolean;
  promotionCode: string | null;
  checkoutSessionId: string;
  /** Durable signup URL. A delayed GoHighLevel send still works. */
  loginUrl: string | null;
  /** Supabase invite or magic link. Empty when none is available. It expires. */
  magicLink?: string | null;
  paymentIntentId?: string | null;
  currency?: string | null;
  purchasedAt: string;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  fbclid?: string | null;
}): KitPurchasedPayload {
  const name = ghlGreetingName({ fullName: input.name, email: input.email });
  const utm: KitContactUtms = kitUtmFields(input);
  const owned = new Set(input.lineIds);
  const items: KitPurchasedItem[] = input.lineIds.filter((id) => id in KIT_CATALOG).map((id) => ({
    sku: id,
    name: KIT_CUSTOMER_COPY[id as KitLineId].name,
    amount: catalogAmount(id),
  }));
  const currency = clipText(input.currency, 8).toUpperCase() || "USD";
  return {
    event: "saassuite.kit_purchased",
    email: input.email.trim().toLowerCase(),
    first_name: name.first_name,
    last_name: name.last_name,
    full_name: name.full_name,
    phone: ghlStripText(input.phone),
    login_url: input.loginUrl?.trim() || "",
    magic_link: input.magicLink?.trim() || "",
    order_total: dollars(input.amountCentsTotal),
    currency,
    stripe_session_id: input.checkoutSessionId,
    checkout_session_id: input.checkoutSessionId,
    payment_intent: input.paymentIntentId?.trim() || "",
    items,
    has_kit: owned.has("kit"),
    has_video_bump: owned.has("bump-video"),
    has_replay_bump: owned.has("bump-replay"),
    has_install_bump: owned.has("bump-install"),
    kit_amount: owned.has("kit") ? catalogAmount("kit") : 0,
    video_bump_amount: owned.has("bump-video") ? catalogAmount("bump-video") : 0,
    replay_bump_amount: owned.has("bump-replay") ? catalogAmount("bump-replay") : 0,
    install_bump_amount: owned.has("bump-install") ? catalogAmount("bump-install") : 0,
    purchased_at: input.purchasedAt,
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_content: utm.utm_content,
    utm_term: clipText(input.utm_term, 200),
    fbclid: clipText(input.fbclid, 500),
    comped: input.comped,
    promotion_code: input.promotionCode?.trim() || "",
    items_summary: kitItemsSummary(items),
    line_ids: input.lineIds.filter((id) => id in KIT_CATALOG),
    amount_cents_total: Math.round(input.amountCentsTotal),
    source: "saassuite",
  };
}

/**
 * Sample for the GoHighLevel workflow test. Kit + video bump + replay is $71.
 * No Stripe session and no account row.
 */
export function kitPurchasedSamplePayload(email: string, purchasedAt = "2026-10-23T00:00:00.000Z"): KitPurchasedPayload {
  const clean = email.trim().toLowerCase();
  const loginUrl = kitBuyerSignInUrl(clean);
  return kitPurchasedPayload({
    email: clean,
    phone: "",
    name: "Kit Test",
    lineIds: ["kit", "bump-replay", "bump-video"],
    amountCentsTotal: 7100,
    comped: false,
    promotionCode: null,
    checkoutSessionId: "cs_test_kit_purchased_sample",
    paymentIntentId: "",
    currency: "USD",
    loginUrl,
    magicLink: loginUrl,
    purchasedAt,
    utm_source: "sample",
    utm_medium: "test",
    utm_campaign: "one-feature-kit",
    utm_content: "ghl-workflow",
    utm_term: "",
    fbclid: "",
  });
}

/** Sent or failed means the inbound webhook was POSTed. Duplicates are not another login email. */
export function kitLoginLogStatus(result: string): "sent" | "failed" | null {
  if (result === "sent" || result === "failed") return result;
  return null;
}

export type KitPurchasedLogSource = "webhook" | "manual_refire";

export type KitGhlReceipt = { httpStatus: number | null; responseId: string | null };

export function kitGhlReceipt(): KitGhlReceipt {
  return { httpStatus: null, responseId: null };
}

/** HTTP status plus an id from a GoHighLevel webhook body, when it sends one. */
export function kitGhlPostResult(status: number, body: string): { ok: boolean; status: number; id: string | null } {
  let id: string | null = null;
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const key of ["id", "messageId", "webhookId", "traceId"]) {
        const value = parsed?.[key];
        if (typeof value === "string" && value.trim()) {
          id = value.trim().slice(0, 200);
          break;
        }
      }
    } catch {
      /* A non-JSON body still keeps the HTTP status. */
    }
  }
  return { ok: status >= 200 && status < 300, status, id };
}

/**
 * Row for customer_message_events. template_key is the kit_purchased event.
 * metadata holds the checkout session and the GoHighLevel status and id.
 */
export function kitPurchasedSendLog(input: {
  email: string;
  checkoutSessionId: string;
  source: KitPurchasedLogSource;
  outcome: "sent" | "failed" | "duplicate" | "overlap" | "skipped" | "missing_url";
  /** Shown on the log row when the POST did not happen, such as missing_login_url. */
  reason?: string | null;
  httpStatus?: number | null;
  responseId?: string | null;
}): {
  userEmail: string;
  channel: "webhook";
  templateKey: "kit_purchased";
  provider: "ghl";
  providerMessageId: string | null;
  status: "sent" | "failed" | "suppressed";
  source: KitPurchasedLogSource;
  detail: string;
  metadata: {
    event: "saassuite.kit_purchased";
    checkout_session_id: string;
    ghl_status: number | null;
    ghl_id: string | null;
  };
} {
  const httpStatus = typeof input.httpStatus === "number" ? input.httpStatus : null;
  const responseId = input.responseId?.trim() || null;
  const posted = input.outcome === "sent" || input.outcome === "failed";
  const refused = input.outcome === "missing_url";
  return {
    userEmail: input.email.trim().toLowerCase(),
    channel: "webhook",
    templateKey: "kit_purchased",
    provider: "ghl",
    providerMessageId: responseId,
    status: input.outcome === "sent" ? "sent" : input.outcome === "failed" || refused ? "failed" : "suppressed",
    source: input.source,
    detail: input.reason?.trim() || (posted ? `http_${httpStatus ?? "none"}` : input.outcome),
    metadata: {
      event: "saassuite.kit_purchased",
      checkout_session_id: input.checkoutSessionId,
      ghl_status: httpStatus,
      ghl_id: responseId,
    },
  };
}

export function kitLynkificActionKey(checkoutId: string): string {
  return `lynkific:${checkoutId}`;
}

/** GoHighLevel inbound hook used when LYNKIFIC_KIT_WEBHOOK_URL is unset. */
export const KIT_LYNKIFIC_WEBHOOK_FALLBACK =
  "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/d9553c9e-6631-48e2-83d2-3a7d0e5c5ab8";

/** Bound the POST so a slow GoHighLevel hook cannot hold the Stripe webhook open. */
export const KIT_LYNKIFIC_TIMEOUT_MS = 3000;

export type KitLynkificPost = (
  url: string,
  body: string,
  signal: AbortSignal,
) => Promise<{ ok: boolean; status?: number | null; id?: string | null }>;

/**
 * Unset uses the GoHighLevel hook. An explicit empty or blank value skips the POST.
 */
export function kitLynkificWebhookUrl(envValue: string | undefined): string | null {
  if (envValue === undefined) return KIT_LYNKIFIC_WEBHOOK_FALLBACK;
  const target = envValue.trim();
  return target ? target : null;
}

/** Location id shared by the Checkout Started and Purchased GoHighLevel hooks. */
export const KIT_GHL_LOCATION_ID = "T69cI1milcirIORef4Ib";

/** Location id from a LeadConnector hook URL, or null when the path is not one. */
export function kitGhlLocationId(url: string | null | undefined): string | null {
  const raw = url?.trim() ?? "";
  if (!raw) return null;
  try {
    const parts = new URL(raw).pathname.split("/").filter(Boolean);
    const hooks = parts.indexOf("hooks");
    const location = hooks >= 0 ? parts[hooks + 1] : "";
    return location || null;
  } catch {
    return null;
  }
}

/**
 * LYNKIFIC_KIT_WEBHOOK_URL stays first only when it is location T69cI1milcirIORef4Ib.
 * Any other value is ignored. Then GHL_KIT_PURCHASED_WEBHOOK_URL, then the
 * d9553c9e Purchased hook. A blank Lynkific secret does not skip the POST.
 */
export function kitPurchasedWebhookUrl(ghlUrl: string | undefined, lynkificUrl?: string | undefined): string {
  const lynkific = lynkificUrl?.trim() ?? "";
  if (lynkific && kitGhlLocationId(lynkific) === KIT_GHL_LOCATION_ID) return lynkific;
  const ghl = ghlUrl?.trim() ?? "";
  if (ghl) return ghl;
  return KIT_LYNKIFIC_WEBHOOK_FALLBACK;
}

/** login_url and magic_link are the purchase-email buttons. Both must be https. */
export function kitPurchasedUrlProblem(payload: { login_url?: string | null; magic_link?: string | null }): string | null {
  return ghlUrlFieldProblem("login_url", payload.login_url) || ghlUrlFieldProblem("magic_link", payload.magic_link);
}

/** A real HTTP status that is not 2xx. Missing, 0, or a thrown post is not one. */
export function kitGhlDefiniteFailure(value: { ok?: boolean; status?: number | null } | null | undefined): boolean {
  if (value?.ok === true) return false;
  const status = typeof value?.status === "number" && Number.isFinite(value.status) ? value.status : null;
  if (status !== null && status >= 200 && status < 300) return false;
  return status !== null && status >= 100 && status <= 599;
}

/**
 * POST the recorded checkout. An empty URL is a skip.
 * "failed" is a definite non-2xx. "uncertain" is a timeout or a network error
 * with no response. Neither throws.
 */
export async function deliverLynkificKitPurchase(
  payload: KitPurchasedPayload,
  url: string | null | undefined,
  post: KitLynkificPost,
  timeoutMs = KIT_LYNKIFIC_TIMEOUT_MS,
  receipt?: KitGhlReceipt,
): Promise<"skipped" | "sent" | "failed" | "uncertain" | "missing_url"> {
  const target = url?.trim() ?? "";
  if (!target) return "skipped";
  if (kitPurchasedUrlProblem(payload)) return "missing_url";
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const verdict = await Promise.race([
      post(target, JSON.stringify(payload), controller.signal).then(
        (value) => {
          if (receipt) {
            receipt.httpStatus = typeof value?.status === "number" ? value.status : null;
            receipt.responseId = value?.id?.trim() || null;
          }
          if (value?.ok === true || (typeof value?.status === "number" && value.status >= 200 && value.status < 300)) return "sent" as const;
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
    return verdict;
  } catch {
    return "uncertain";
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * One Lynkific POST per checkout. A completed claim or a lease held by another
 * delivery does not post again. A definite non-2xx releases the claim. A timeout
 * or a network error with no response keeps the in-flight lease so a retry skips
 * until that lease expires.
 */
export async function runLynkificDelivery(input: {
  claimed: boolean;
  completed: boolean;
  payload: KitPurchasedPayload;
  url: string | null | undefined;
  post: KitLynkificPost;
  timeoutMs?: number;
  receipt?: KitGhlReceipt;
  release: () => Promise<void>;
  complete: () => Promise<void>;
}): Promise<"skipped" | "sent" | "failed" | "duplicate" | "overlap" | "missing_url"> {
  if (input.completed) return "duplicate";
  if (!input.claimed) return "overlap";
  const result = await deliverLynkificKitPurchase(input.payload, input.url, input.post, input.timeoutMs, input.receipt);
  if (result === "uncertain") return "failed";
  if (result === "missing_url") {
    try { await input.release(); } catch { /* A later delivery can post once the URL exists. */ }
    return "missing_url";
  }
  if (result === "failed") {
    try { await input.release(); } catch { /* A later Stripe delivery can post. */ }
    return "failed";
  }
  try {
    await input.complete();
  } catch {
    /* The POST already happened. Leave the lease so an overlap cannot post again. */
  }
  return result;
}
