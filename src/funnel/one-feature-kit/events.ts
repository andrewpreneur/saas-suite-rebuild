/**
 * First-party One Feature Kit funnel events.
 * Meta pixel and CAPI stay in tracking.ts. This insert is separate.
 * Clients never send event "purchase". There is no select() because anon
 * and authenticated have no select policy.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { captureKitAttribution } from "./attribution";
import {
  isKitClientEvent,
  isKitEventLine,
  isKitEventStep,
  type KitClientEvent,
  type KitEventLine,
  type KitEventStep,
} from "../../../supabase/functions/_shared/kit-events";
import type { Json } from "@/integrations/supabase/types";
import { type KitBumps } from "./order";
import { kitEventTrackingOpen, kitFunnelSessionId, kitSessionIsTest } from "./session";
import { sha256Hex } from "./sha256";
import { kitStepForPath } from "./steps";

export { kitEventHostSkipped, kitEventTrackingOpen, kitFunnelSessionId } from "./session";
export { kitStepForPath };

export const KIT_EVENT_NAV_WAIT_MS = 300;

const CHECKOUT_SESSION_ID = /^cs_(live|test)_[A-Za-z0-9]+$/;

const BUMP_LINE_IDS = {
  replay: "bump-replay",
  video: "bump-video",
  install: "bump-install",
} as const;

type KitEventInsert = Database["public"]["Tables"]["kit_events"]["Insert"];

export type KitEventInput = {
  step: KitEventStep;
  line_id?: KitEventLine | null;
  amount_cents?: number | null;
  checkout_session_id?: string | null;
  /** view_id, cta_location, and test. Stored in properties when the column exists. */
  properties?: Record<string, string | boolean | null> | null;
};

export type KitBumpChange = {
  event: "bump_add" | "bump_remove";
  line_id: (typeof BUMP_LINE_IDS)[keyof typeof BUMP_LINE_IDS];
};

/** One event per add-on whose checked state changed. Select all uses this. */
export function kitBumpLineChanges(before: KitBumps, after: KitBumps): KitBumpChange[] {
  const changes: KitBumpChange[] = [];
  for (const key of ["replay", "video", "install"] as const) {
    if (before[key] === after[key]) continue;
    changes.push({
      event: after[key] ? "bump_add" : "bump_remove",
      line_id: BUMP_LINE_IDS[key],
    });
  }
  return changes;
}

function clip(value: string | null | undefined, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function cleanAmount(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const cents = Math.round(value);
  if (cents < 0 || cents > 1_000_000) return null;
  return cents;
}

function cleanCheckoutSessionId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255 || !CHECKOUT_SESSION_ID.test(trimmed)) return null;
  return trimmed;
}

function cleanLineId(value: string | null | undefined): KitEventLine | null {
  if (typeof value !== "string" || !isKitEventLine(value)) return null;
  return value;
}

function cleanProperties(value: KitEventInput["properties"], test: boolean): Json | null {
  const out: Record<string, string | boolean> = {};
  if (value) {
    for (const [key, raw] of Object.entries(value)) {
      if (!/^[a-z0-9_]{1,40}$/.test(key)) continue;
      if (typeof raw === "boolean") out[key] = raw;
      else if (typeof raw === "string") {
        const trimmed = raw.trim().slice(0, 80);
        if (trimmed) out[key] = trimmed;
      }
    }
  }
  if (test) out.test = true;
  return Object.keys(out).length ? out : null;
}

async function hashUserAgent(): Promise<string | null> {
  try {
    if (typeof navigator === "undefined" || typeof navigator.userAgent !== "string") return null;
    // Synchronous SHA-256. crypto.subtle is absent outside a secure context
    // and in some in-app browsers, which used to store a null ua_hash.
    const hex = sha256Hex(navigator.userAgent);
    return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
  } catch {
    return null;
  }
}

/** Row that would be inserted. Null when the event must not be sent. */
export async function buildKitEventRow(event: string, input: KitEventInput): Promise<KitEventInsert | null> {
  if (!isKitClientEvent(event)) return null;
  if (!kitEventTrackingOpen()) return null;
  if (!isKitEventStep(input.step)) return null;
  const sessionId = kitFunnelSessionId();
  if (!sessionId) return null;
  const test = kitSessionIsTest();
  const attr = captureKitAttribution();
  const referrer = attr.referrer || (typeof document !== "undefined" ? document.referrer.slice(0, 500) : "");
  return {
    session_id: sessionId,
    step: input.step,
    event,
    line_id: cleanLineId(input.line_id),
    amount_cents: cleanAmount(input.amount_cents),
    checkout_session_id: cleanCheckoutSessionId(input.checkout_session_id),
    utm_source: clip(attr.utm_source, 200),
    utm_medium: clip(attr.utm_medium, 200),
    utm_campaign: clip(attr.utm_campaign, 200),
    utm_content: clip(attr.utm_content, 200),
    utm_term: clip(attr.utm_term, 200),
    fbclid: clip(attr.fbclid, 500),
    referrer: clip(referrer, 500),
    ua_hash: await hashUserAgent(),
    is_test: test,
    properties: cleanProperties(input.properties, test),
  };
}

/** Until the additive migration is applied, PostgREST rejects the new columns. Remember that and retry without them. */
let testColumns: "unknown" | "yes" | "no" = "unknown";

/** Tests reset the schema-cache probe between cases. */
export function resetKitEventColumnProbe() {
  testColumns = "unknown";
}

function missingTestColumn(error: { message?: string; code?: string } | null): boolean {
  const message = error?.message ?? "";
  return error?.code === "PGRST204" || error?.code === "42703" || /is_test|properties|schema cache/i.test(message);
}

function rowWithoutTestColumns(row: KitEventInsert): KitEventInsert {
  const { is_test: _test, properties: _properties, ...rest } = row;
  return rest;
}

async function insertKitEvent(event: KitClientEvent | "purchase", input: KitEventInput): Promise<void> {
  const row = await buildKitEventRow(event, input);
  if (!row) return;
  const payload = testColumns === "no" ? rowWithoutTestColumns(row) : row;
  const { error } = await supabase.from("kit_events").insert(payload);
  if (!error) {
    if (testColumns === "unknown") testColumns = "yes";
    return;
  }
  if (testColumns !== "yes" && missingTestColumn(error)) {
    testColumns = "no";
    await supabase.from("kit_events").insert(rowWithoutTestColumns(row));
  }
}

/** Fire and forget. Errors are swallowed. Does not include .select(). */
export function trackKitEvent(event: KitClientEvent | "purchase", input: KitEventInput): Promise<void> {
  try {
    return insertKitEvent(event, input).catch(() => undefined);
  } catch {
    return Promise.resolve();
  }
}

/** Give an in-flight insert up to ~300ms before a navigation. */
export function settleKitEvent(pending: Promise<void>): Promise<void> {
  return Promise.race([
    pending.catch(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, KIT_EVENT_NAV_WAIT_MS)),
  ]);
}

export function trackKitEventForNavigation(event: KitClientEvent | "purchase", input: KitEventInput): Promise<void> {
  return settleKitEvent(trackKitEvent(event, input));
}
