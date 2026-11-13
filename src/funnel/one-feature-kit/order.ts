/**
 * Order state for the One Feature Kit funnel.
 *
 * Payments are live. one-feature-kit-payment confirms the charge server-side.
 * Do not reuse create-checkout: that function charges live SaaSSuite subscription prices.
 * The thank-you form inserts into public.funnel_onboarding, then
 * kit-onboarding-notify tells the team. It must not call
 * one-feature-lead, which belongs to the free-training pages.
 */

import { GHL_AFFILIATE_SIGNUP_URL } from "@/constants/ghlAffiliate";
import { missingKitPriceIds } from "./stripe";

export { GHL_AFFILIATE_SIGNUP_URL };

export const ONE_FEATURE_KIT_PAYMENTS_LIVE = true;

/**
 * One switch for draft chrome. false hides every `.draftbar`, `.proposed`
 * badge, `.ofk-review` note, and image `.ph` placeholder.
 */
export const ONE_FEATURE_KIT_REVIEW_CHROME = false;

export const FUNNEL_BASE = "/one-feature-kit";

export const FUNNEL_ROUTES = {
  sales: FUNNEL_BASE,
  checkout: `${FUNNEL_BASE}/checkout`,
  ghl: `${FUNNEL_BASE}/ghl-signup-and-upgrade`,
  launch: `${FUNNEL_BASE}/launch-pack`,
  webinar: `${FUNNEL_BASE}/webinar-sales-system`,
  thanks: `${FUNNEL_BASE}/thank-you`,
} as const;

export type LineKind = "one_time" | "trial";

export type OrderLine = {
  id: string;
  label: string;
  /** Amount charged today, in cents. A trial is $0 today. */
  amountCents: number;
  kind: LineKind;
  recurringCents?: number;
};

export type KitBumps = { replay: boolean; video: boolean; install: boolean };

export type KitDraft = {
  lead: { firstName: string; email: string };
  contact: { firstName: string; email: string; phone: string };
  bumps: KitBumps;
  decisions: Record<string, "accepted" | "declined">;
  lines: OrderLine[];
  checkoutId: string | null;
  customerId?: string;
  paymentMethodId?: string;
  onboarding: Record<string, string> | null;
  buildRequest: Record<string, string> | null;
  slackPing?: { sent: boolean; reason: string } | null;
};

export const EMPTY_DRAFT: KitDraft = {
  lead: { firstName: "", email: "" },
  contact: { firstName: "", email: "", phone: "" },
  bumps: { replay: false, video: false, install: false },
  decisions: {},
  lines: [],
  checkoutId: null,
  onboarding: null,
  buildRequest: null,
};

const KIT_LINE: OrderLine = {
  id: "kit",
  label: "The GoHighLevel One Feature Kit",
  amountCents: 2700,
  kind: "one_time",
};

const BUMP_LINES = {
  replay: {
    id: "bump-replay",
    label: "Full 90-Minute Training Replay",
    amountCents: 1700,
    kind: "one_time" as const,
  },
  video: {
    id: "bump-video",
    label: "Done-For-You Branded AI Studio Sales Video",
    amountCents: 2700,
    kind: "one_time" as const,
  },
  install: {
    id: "bump-install",
    label: "DFY Installation, Customization, and Setup",
    amountCents: 29900,
    kind: "one_time" as const,
  },
};

export const OFFERS = {
  launch: {
    id: "launch",
    label: "25 white-labeled ad templates",
    amountCents: 14700,
    kind: "one_time" as const,
  },
  "webinar-system": {
    id: "webinar-system",
    label: "Webinar Sales System",
    amountCents: 9700,
    kind: "one_time" as const,
  },
} as const;

export type OfferId = keyof typeof OFFERS;

/** Pages whose Yes / No thanks buttons record an offer decision. */
export const PAGE_OFFER: Record<string, OfferId> = {
  [FUNNEL_ROUTES.launch]: "launch",
  [FUNNEL_ROUTES.webinar]: "webinar-system",
};

export const KIT_DRAFT_STORAGE_KEY = "ofk-one-feature-kit-v2";
const STORAGE_KEY = KIT_DRAFT_STORAGE_KEY;

export function isDraftFunnelPath(path: string): boolean {
  return path === FUNNEL_BASE || path.startsWith(`${FUNNEL_BASE}/`);
}

/** Why a live flag cannot charge yet. Null while the stub is in force. */
export function paymentsLiveBlock(live = ONE_FEATURE_KIT_PAYMENTS_LIVE): string | null {
  if (!live) return null;
  const missing = missingKitPriceIds();
  if (missing.length === 0) return null;
  return `ONE_FEATURE_KIT_PAYMENTS_LIVE is on, but these Stripe Price IDs are empty: ${missing.join(", ")}.`;
}

function assertStubbed(): void {
  const message = paymentsLiveBlock();
  if (message) throw new Error(message);
}

export function orderTotalCents(draft: KitDraft): number {
  return draft.lines.reduce((sum, line) => sum + line.amountCents, 0);
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatUsdShort(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : formatUsd(cents);
}

export function checkoutLines(bumps: KitBumps): OrderLine[] {
  return [
    KIT_LINE,
    ...(bumps.replay ? [BUMP_LINES.replay] : []),
    ...(bumps.video ? [BUMP_LINES.video] : []),
    ...(bumps.install ? [BUMP_LINES.install] : []),
  ];
}

/** Select all turns every checkout add-on on or off together. */
export function kitBumpsForSelectAll(checked: boolean): KitBumps {
  return { replay: checked, video: checked, install: checked };
}

/** Select all is on only while every add-on is on. */
export function kitSelectAllOn(bumps: KitBumps): boolean {
  return bumps.replay && bumps.video && bumps.install;
}

export function completeCheckout(
  draft: KitDraft,
  contact: KitDraft["contact"],
  bumps: KitBumps,
  checkoutId = `stub_${Math.random().toString(36).slice(2, 10)}`,
): KitDraft {
  assertStubbed();
  if (ONE_FEATURE_KIT_PAYMENTS_LIVE && !checkoutId.startsWith("cs_live_")) {
    throw new Error("A verified Stripe payment is required.");
  }
  return {
    ...draft,
    contact,
    lead: { firstName: contact.firstName, email: contact.email },
    bumps,
    decisions: {},
    lines: checkoutLines(bumps),
    checkoutId,
    onboarding: null,
    buildRequest: null,
  };
}

export function decide(
  draft: KitDraft,
  offerId: OfferId,
  choice: "accepted" | "declined",
): KitDraft {
  if (choice === "accepted") assertStubbed();
  let lines = draft.lines.filter((line) => line.id !== offerId);
  const decisions: KitDraft["decisions"] = { ...draft.decisions, [offerId]: choice };
  if (choice === "accepted") {
    lines = [...lines, OFFERS[offerId]];
  }
  return { ...draft, decisions, lines };
}

export function hasOffer(draft: KitDraft, offerId: OfferId): boolean {
  return draft.decisions[offerId] === "accepted" || draft.lines.some((line) => line.id === offerId);
}

/** Last draft when both stores throw. A successful read does not use it. */
let memoryDraft: string | null = null;

function storageBox(read: () => Storage | undefined): Storage | undefined {
  try {
    return read();
  } catch {
    return undefined;
  }
}

function storageRead(read: () => Storage | undefined, key: string): { value: string | null; threw: boolean } {
  let storage: Storage | undefined;
  try {
    storage = read();
  } catch {
    return { value: null, threw: true };
  }
  if (!storage) return { value: null, threw: false };
  try {
    return { value: storage.getItem(key), threw: false };
  } catch {
    return { value: null, threw: true };
  }
}

function storageWrite(storage: Storage | undefined, key: string, value: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** This tab's draft wins. localStorage is only a fallback so a copied purchase marker is still seen. */
export function readKitDraftRaw(): string | null {
  const session = storageRead(() => (typeof sessionStorage === "undefined" ? undefined : sessionStorage), STORAGE_KEY);
  if (session.value) return session.value;
  const local = storageRead(() => (typeof localStorage === "undefined" ? undefined : localStorage), STORAGE_KEY);
  if (local.value) return local.value;
  if (session.threw || local.threw) return memoryDraft;
  return null;
}

export function loadDraft(): KitDraft {
  const raw = readKitDraftRaw();
  if (!raw) return structuredClone(EMPTY_DRAFT);
  try {
    const parsed = JSON.parse(raw) as Partial<KitDraft>;
    return {
      ...structuredClone(EMPTY_DRAFT),
      ...parsed,
      lead: { ...EMPTY_DRAFT.lead, ...parsed.lead },
      contact: { ...EMPTY_DRAFT.contact, ...parsed.contact },
      bumps: { ...EMPTY_DRAFT.bumps, ...parsed.bumps },
      decisions: parsed.decisions ?? {},
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      slackPing: parsed.slackPing ?? null,
    };
  } catch {
    return structuredClone(EMPTY_DRAFT);
  }
}

export function saveDraft(draft: KitDraft): void {
  let raw = "";
  try {
    raw = JSON.stringify(draft);
  } catch {
    return;
  }
  const session = storageBox(() => (typeof sessionStorage === "undefined" ? undefined : sessionStorage));
  if (storageWrite(session, STORAGE_KEY, raw)) {
    memoryDraft = null;
    return;
  }
  const local = storageBox(() => (typeof localStorage === "undefined" ? undefined : localStorage));
  if (storageWrite(local, STORAGE_KEY, raw)) {
    memoryDraft = null;
    return;
  }
  memoryDraft = raw;
}
