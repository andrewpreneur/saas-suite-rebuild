/**
 * One Feature Kit funnel event names shared by the browser and the webhook.
 * Pure: no Deno, no network. Purchase rows are built here and inserted only
 * with the service role, after kit_purchases is saved.
 */

export const KIT_EVENT_STEPS = ["sales", "checkout", "ghl", "launch", "webinar", "thanks"] as const;
export type KitEventStep = (typeof KIT_EVENT_STEPS)[number];

export const KIT_CLIENT_EVENTS = [
  "view",
  "cta_click",
  "checkout_start",
  "bump_add",
  "bump_remove",
  "upsell_accept",
  "upsell_decline",
] as const;
export type KitClientEvent = (typeof KIT_CLIENT_EVENTS)[number];

export const KIT_EVENT_LINES = ["kit", "bump-replay", "bump-video", "bump-install", "launch", "webinar-system"] as const;
export type KitEventLine = (typeof KIT_EVENT_LINES)[number];

const SESSION_ID = /^[A-Za-z0-9_-]{8,64}$/;
const CHECKOUT_SESSION_ID = /^cs_(live|test)_[A-Za-z0-9]+$/;

export function isKitEventStep(value: string): value is KitEventStep {
  return (KIT_EVENT_STEPS as readonly string[]).includes(value);
}

export function isKitClientEvent(value: string): value is KitClientEvent {
  return (KIT_CLIENT_EVENTS as readonly string[]).includes(value);
}

export function isKitEventLine(value: string): value is KitEventLine {
  return (KIT_EVENT_LINES as readonly string[]).includes(value);
}

/** Browser session id stored on the Checkout Session. UUID-shaped, max 64 chars. */
export function isKitOfkSessionId(value: string): boolean {
  return SESSION_ID.test(value);
}

/** site_analytics_events.session_id. Same shape as the funnel session, different value. */
export function isSiteAnalyticsSessionId(value: string): boolean {
  return SESSION_ID.test(value);
}

/**
 * Session id for a purchase row. A valid browser id is kept.
 * Otherwise `srv_` plus the checkout session id, cut to 64 characters so the
 * session_id check accepts it.
 */
export function kitPurchaseSessionId(ofkSessionId: string | null | undefined, checkoutSessionId: string): string {
  const raw = (ofkSessionId ?? "").trim();
  if (isKitOfkSessionId(raw)) return raw;
  const fallback = `srv_${checkoutSessionId}`.slice(0, 64);
  return fallback.length >= 8 ? fallback : "srv_missing";
}

/** Checkout lines were bought on the checkout step. Later bumps are thank-you adds. */
export function kitPurchaseStep(source: "checkout" | "upsell", lineId: string): KitEventStep {
  if (source === "checkout") return "checkout";
  if (lineId === "launch") return "launch";
  if (lineId === "webinar-system") return "webinar";
  return "thanks";
}

function clip(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanCheckoutSessionId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255 || !CHECKOUT_SESSION_ID.test(trimmed)) return null;
  return trimmed;
}

function cleanAmount(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value);
  if (cents < 0 || cents > 1_000_000) return null;
  return cents;
}

export type KitPurchaseEventLine = { line_id: string; amount_cents: number };

export type KitPurchaseEventInput = {
  lines: KitPurchaseEventLine[];
  checkoutSessionId: string;
  ofkSessionId?: string | null;
  source: "checkout" | "upsell";
  metadata?: Record<string, string | null | undefined> | null;
};

export type KitPurchaseEventRow = {
  session_id: string;
  step: KitEventStep;
  event: "purchase";
  line_id: KitEventLine;
  amount_cents: number | null;
  checkout_session_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  fbclid: string | null;
  referrer: string | null;
  is_test: boolean;
};

export function kitPurchaseEventRows(input: KitPurchaseEventInput): KitPurchaseEventRow[] {
  const checkoutSessionId = cleanCheckoutSessionId(input.checkoutSessionId);
  if (!checkoutSessionId) return [];
  const sessionId = kitPurchaseSessionId(input.ofkSessionId, checkoutSessionId);
  const meta = input.metadata ?? {};
  const shared = {
    session_id: sessionId,
    event: "purchase" as const,
    checkout_session_id: checkoutSessionId,
    utm_source: clip(meta.utm_source, 200),
    utm_medium: clip(meta.utm_medium, 200),
    utm_campaign: clip(meta.utm_campaign, 200),
    utm_content: clip(meta.utm_content, 200),
    utm_term: clip(meta.utm_term, 200),
    fbclid: clip(meta.fbclid, 500),
    referrer: clip(meta.referrer, 500),
    is_test: meta.is_test === "true" || meta.is_test === "1",
  };
  const rows: KitPurchaseEventRow[] = [];
  for (const line of input.lines) {
    if (!isKitEventLine(line.line_id)) continue;
    rows.push({
      ...shared,
      step: kitPurchaseStep(input.source, line.line_id),
      line_id: line.line_id,
      amount_cents: cleanAmount(line.amount_cents),
    });
  }
  return rows;
}

type KitEventsDb = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): PromiseLike<{
          data: Array<{ line_id?: string | null }> | null;
          error: { message?: string } | null;
        }>;
      };
    };
    insert(rows: KitPurchaseEventRow[]): PromiseLike<{ error: { message?: string } | null }>;
  };
};

/** Service-role insert. A read or write failure is logged and never thrown. */
export async function insertKitPurchaseEvents(db: unknown, input: KitPurchaseEventInput): Promise<void> {
  const client = db as KitEventsDb;
  try {
    const rows = kitPurchaseEventRows(input);
    if (rows.length === 0) return;
    let pending = rows;
    try {
      const existing = await client.from("kit_events").select("line_id").eq("event", "purchase").eq("checkout_session_id", rows[0].checkout_session_id);
      if (!existing.error && Array.isArray(existing.data)) {
        const have = new Set(existing.data.map((row) => row.line_id).filter((id): id is string => typeof id === "string"));
        pending = rows.filter((row) => !have.has(row.line_id));
      }
    } catch (error) {
      console.error("kit events purchase read", error instanceof Error ? error.message : "unknown");
    }
    if (pending.length === 0) return;
    const { error } = await client.from("kit_events").insert(pending);
    if (error) console.error("kit events purchase", error.message ?? "failed");
  } catch (error) {
    console.error("kit events purchase", error instanceof Error ? error.message : "unknown");
  }
}
