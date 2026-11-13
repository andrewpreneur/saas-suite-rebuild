/**
 * Funnel session id for kit_events.
 * localStorage key `ofk_session`, 30-minute rolling inactivity expiry.
 * The early-view script in index.html must use the same key, fields, and windows.
 */
import { isTestTraffic } from "@/utils/testTraffic";
import { hasOptedOutOfTracking } from "@/utils/trackingConsent";
import { isKitOfkSessionId } from "../../../supabase/functions/_shared/kit-events";

export const KIT_SESSION_STORAGE_KEY = "ofk_session";
/** Previous tab-scoped id. Adopted once so a live tab is not split in two. */
const LEGACY_SESSION_KEY = "ofk_session_id";
export const KIT_SESSION_IDLE_MS = 30 * 60 * 1000;
export const KIT_CHECKOUT_VIEW_DEDUPE_MS = 30 * 1000;
export const KIT_EARLY_VIEW_KEY = "__ofkEarlyView";

export type KitSessionRecord = {
  id: string;
  touchedAt: number;
  test: boolean;
  checkoutViewAt?: number;
  checkoutStartAt?: number;
};

export type KitEarlyView = {
  id: string;
  path: string;
  step: string;
  sessionId: string;
};

const recentViewAt = new Map<string, number>();

export function kitEventHostSkipped(hostname: string): boolean {
  const host = (hostname || "").toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  ) {
    return true;
  }
  const bare = host.replace(/^www\./, "");
  const blocked = ["lovable.app", "lovableproject.com", "lovable.dev"];
  return blocked.some((domain) => bare === domain || bare.endsWith(`.${domain}`));
}

/** Opt-out and preview hosts only. The Meta pixel host list is not used. */
export function kitEventTrackingOpen(): boolean {
  if (typeof window === "undefined") return false;
  if (hasOptedOutOfTracking()) return false;
  return !kitEventHostSkipped(window.location.hostname || "");
}

function readRaw(): KitSessionRecord | null {
  try {
    const raw = localStorage.getItem(KIT_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<KitSessionRecord>;
    if (!parsed || typeof parsed.id !== "string" || !isKitOfkSessionId(parsed.id)) return null;
    if (typeof parsed.touchedAt !== "number" || !Number.isFinite(parsed.touchedAt)) return null;
    return {
      id: parsed.id,
      touchedAt: parsed.touchedAt,
      test: parsed.test === true,
      checkoutViewAt: typeof parsed.checkoutViewAt === "number" ? parsed.checkoutViewAt : undefined,
      checkoutStartAt: typeof parsed.checkoutStartAt === "number" ? parsed.checkoutStartAt : undefined,
    };
  } catch {
    return null;
  }
}

function writeRaw(record: KitSessionRecord) {
  localStorage.setItem(KIT_SESSION_STORAGE_KEY, JSON.stringify(record));
}

/** randomUUID is missing on insecure http origins. The id still has to match the session check. */
function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const rand = Math.floor(Math.random() * 16);
    const value = ch === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function newId(): string | null {
  const created = randomId();
  return isKitOfkSessionId(created) ? created : null;
}

function explicitTestOff(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("ss_test") === "0";
  } catch {
    return false;
  }
}

function legacyId(): string | null {
  try {
    const existing = sessionStorage.getItem(LEGACY_SESSION_KEY);
    return existing && isKitOfkSessionId(existing) ? existing : null;
  } catch {
    return null;
  }
}

/**
 * Current funnel session. Each call rolls touchedAt forward.
 * After 30 minutes without a call, the next call mints a new id.
 * ?ss_test=1 and ?ofk_test=1 mark the session as a test.
 * ?ss_test=0 clears the sticky flag and this session's test bit.
 */
export function touchKitSession(now = Date.now()): KitSessionRecord | null {
  if (!kitEventTrackingOpen()) return null;
  try {
    const forcedOff = explicitTestOff();
    const test = forcedOff ? false : isTestTraffic();
    const current = readRaw();
    if (current && now - current.touchedAt <= KIT_SESSION_IDLE_MS) {
      const next: KitSessionRecord = {
        ...current,
        touchedAt: now,
        test: forcedOff ? false : current.test || test,
      };
      writeRaw(next);
      return next;
    }
    const id = newId() ?? legacyId();
    if (!id) return null;
    const created: KitSessionRecord = { id, touchedAt: now, test };
    writeRaw(created);
    return created;
  } catch {
    return null;
  }
}

export function kitFunnelSessionId(now = Date.now()): string | null {
  return touchKitSession(now)?.id ?? null;
}

export function kitSessionIsTest(now = Date.now()): boolean {
  return touchKitSession(now)?.test === true;
}

function earlyView(): KitEarlyView | null {
  const value = (window as unknown as Record<string, unknown>)[KIT_EARLY_VIEW_KEY];
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<KitEarlyView>;
  if (typeof row.id !== "string" || typeof row.path !== "string" || typeof row.sessionId !== "string") return null;
  return { id: row.id, path: row.path, step: typeof row.step === "string" ? row.step : "", sessionId: row.sessionId };
}

/**
 * Whether this page load should insert a view row.
 * The inline script's view id wins for the same path so React does not double-count.
 */
export function claimKitPageView(
  step: string,
  path: string,
  now = Date.now(),
): { send: boolean; viewId: string } {
  const session = touchKitSession(now);
  if (!session) return { send: false, viewId: "" };
  const early = earlyView();
  if (early && early.path === path && early.sessionId === session.id) {
    return { send: false, viewId: early.id };
  }
  if (step === "checkout" && session.checkoutViewAt && now - session.checkoutViewAt < KIT_CHECKOUT_VIEW_DEDUPE_MS) {
    return { send: false, viewId: "" };
  }
  const memoryKey = `${session.id}:${step}:${path}`;
  const seen = recentViewAt.get(memoryKey);
  if (seen && now - seen < 1000) return { send: false, viewId: "" };
  const viewId = randomId();
  recentViewAt.set(memoryKey, now);
  if (step === "checkout") {
    session.checkoutViewAt = now;
    try {
      writeRaw(session);
    } catch {
      /* The in-memory guard still blocks a second call on this load. */
    }
  }
  return { send: true, viewId };
}

/** First checkout field interaction or contact submit, once per session. */
export function markKitCheckoutStart(now = Date.now()): boolean {
  const session = touchKitSession(now);
  if (!session || session.checkoutStartAt) return false;
  session.checkoutStartAt = now;
  try {
    writeRaw(session);
  } catch {
    return false;
  }
  return true;
}
