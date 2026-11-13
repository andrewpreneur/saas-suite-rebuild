/**
 * saas_suite_users writes from the two Stripe fulfillment functions.
 *
 * Both functions can insert the same email at once. The loser used to ignore
 * the unique-violation, and the trial_source update then matched no row.
 * A statement timeout (57014) is retried. Plan fields are whatever the caller
 * already decided; this module only makes that write land.
 */

export type DbWriteError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null;

export type WriteResult<T> = { data: T | null; error: DbWriteError };

export const SAAS_USER_WRITE_ATTEMPTS = 3;

const RETRY_MS = [200, 600];

export function isUniqueViolation(error: DbWriteError): boolean {
  if (!error) return false;
  if (String(error.code ?? "") === "23505") return true;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return /duplicate key|unique constraint|23505/i.test(text);
}

export function isStatementTimeout(error: DbWriteError): boolean {
  if (!error) return false;
  if (String(error.code ?? "") === "57014") return true;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  return /statement timeout|canceling statement due to statement timeout|57014/i.test(text);
}

export type CommitSuccess<T> = { ok: true; created: boolean; row: T };
export type CommitFailure = {
  ok: false;
  reason: "timeout" | "conflict_missing" | "error";
  message: string;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function adoptWithRetry<T>(
  adopt: () => Promise<WriteResult<T>>,
  attempts: number,
  sleep: (ms: number) => Promise<void>,
): Promise<CommitSuccess<T> | CommitFailure> {
  let last = "unique violation but no row for this email";
  for (let i = 0; i < attempts; i++) {
    const adopted = await adopt();
    if (adopted.error && isStatementTimeout(adopted.error)) {
      last = adopted.error.message || "statement timeout";
      if (i < attempts - 1) await sleep(RETRY_MS[Math.min(i, RETRY_MS.length - 1)]);
      continue;
    }
    if (adopted.error) {
      return { ok: false, reason: "error", message: adopted.error.message || "adopt failed" };
    }
    if (!adopted.data) return { ok: false, reason: "conflict_missing", message: last };
    return { ok: true, created: false, row: adopted.data };
  }
  return { ok: false, reason: "timeout", message: last };
}

/**
 * Insert the row. On unique violation, `adopt` loads the winner and applies the
 * caller's existing-user update. On statement timeout, try again.
 * `insert` must `.select()` so a real write returns `data`.
 */
export async function commitSaasUserWrite<T>(opts: {
  insert: () => Promise<WriteResult<T>>;
  adopt: () => Promise<WriteResult<T>>;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<CommitSuccess<T> | CommitFailure> {
  const attempts = opts.attempts ?? SAAS_USER_WRITE_ATTEMPTS;
  const sleep = opts.sleep ?? defaultSleep;
  let lastMessage = "insert failed";
  for (let i = 0; i < attempts; i++) {
    const inserted = await opts.insert();
    if (!inserted.error && inserted.data) return { ok: true, created: true, row: inserted.data };
    if (inserted.error && isUniqueViolation(inserted.error)) {
      return adoptWithRetry(opts.adopt, attempts, sleep);
    }
    if (inserted.error && isStatementTimeout(inserted.error)) {
      lastMessage = inserted.error.message || "statement timeout";
      if (i < attempts - 1) await sleep(RETRY_MS[Math.min(i, RETRY_MS.length - 1)]);
      continue;
    }
    if (inserted.error) {
      return { ok: false, reason: "error", message: inserted.error.message || "insert failed" };
    }
    lastMessage = "insert returned no row";
    return { ok: false, reason: "error", message: lastMessage };
  }
  return { ok: false, reason: "timeout", message: lastMessage };
}

/** Retry a single update/insert that must return the row. A miss is not retried. */
export async function writeUntilRow<T>(
  op: () => Promise<WriteResult<T>>,
  opts?: { attempts?: number; sleep?: (ms: number) => Promise<void> },
): Promise<{ ok: true; row: T } | { ok: false; reason: "timeout" | "missing_row" | "error"; message: string }> {
  const attempts = opts?.attempts ?? SAAS_USER_WRITE_ATTEMPTS;
  const sleep = opts?.sleep ?? defaultSleep;
  let last = "write failed";
  for (let i = 0; i < attempts; i++) {
    const result = await op();
    if (!result.error && result.data) return { ok: true, row: result.data };
    if (result.error && isStatementTimeout(result.error)) {
      last = result.error.message || "statement timeout";
      if (i < attempts - 1) await sleep(RETRY_MS[Math.min(i, RETRY_MS.length - 1)]);
      continue;
    }
    if (result.error) return { ok: false, reason: "error", message: result.error.message || "write failed" };
    return { ok: false, reason: "missing_row", message: "update matched no row" };
  }
  return { ok: false, reason: "timeout", message: last };
}

export function trialAccessUpdate(
  meta: { trial_source?: string | null; plan?: string | null; trial_days?: string | number | null },
  nowIso: string,
): {
  trial_source: string;
  plan: "BASIC" | "ADVANCED";
  approval: "YES";
  trial_start_date: string;
  trial_length: number;
} | null {
  const source = String(meta.trial_source ?? "").trim();
  if (!source) return null;
  const days = Number(meta.trial_days);
  return {
    trial_source: source,
    plan: source === "public_copilot_3day" && String(meta.plan ?? "").toLowerCase() === "basic" ? "BASIC" : "ADVANCED",
    approval: "YES",
    trial_start_date: nowIso,
    trial_length: Number.isFinite(days) && days > 0 ? days : 14,
  };
}

type ExistingPurchaseUser = {
  full_name?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  agency_id?: string | null;
  agency_name?: string | null;
  landing_page?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  utm_id?: string | null;
  gclid?: string | null;
  referrer?: string | null;
};

/** Same fields the existing-user branch of notify-stripe-purchase already wrote. */
export function purchaseExistingUpdate(input: {
  dbPlan: string;
  maxUsers: number;
  resolvedName: string;
  isPremiumSupport: boolean;
  nowIso: string;
  existing: ExistingPurchaseUser;
  resolvedFbclid: string;
  resolvedFbc: string;
  resolvedFbp: string;
  attribution: Record<string, string>;
  checkoutPage: string;
  generatedAgencyId: string;
  agencySlugSource: string;
}): Record<string, unknown> {
  const existing = input.existing;
  const updateData: Record<string, unknown> = {
    approval: "YES",
    plan: input.dbPlan,
    max_onboarding_users: input.maxUsers,
    full_name: input.resolvedName || existing.full_name || null,
    ...(input.isPremiumSupport
      ? { premium_support: true, premium_support_started_at: input.nowIso }
      : {}),
  };
  if (input.resolvedFbclid && !existing.fbclid) updateData.fbclid = input.resolvedFbclid;
  if (input.resolvedFbc && !existing.fbc) updateData.fbc = input.resolvedFbc;
  if (input.resolvedFbp && !existing.fbp) updateData.fbp = input.resolvedFbp;
  for (const [key, value] of Object.entries(input.attribution)) {
    if (value && !existing[key as keyof ExistingPurchaseUser]) updateData[key] = value;
  }
  if (input.checkoutPage) updateData.checkout_page = input.checkoutPage;
  if (!existing.agency_id) {
    updateData.agency_id = input.generatedAgencyId;
    updateData.agency_id_basic = input.generatedAgencyId;
    updateData.agency_name = input.resolvedName || existing.agency_name || input.agencySlugSource;
  }
  return updateData;
}

/** Written on saas_suite_users.source for a kit buyer when that column is still empty. */
export const KIT_BUYER_SOURCE = "one_feature_kit";

const KIT_ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "landing_page",
  "referrer",
] as const;

const KIT_LAST_UTM_KEYS = {
  utm_source: "last_utm_source",
  utm_medium: "last_utm_medium",
  utm_campaign: "last_utm_campaign",
  utm_term: "last_utm_term",
  utm_content: "last_utm_content",
  utm_id: "last_utm_id",
} as const;

/** Plan, approval, seats, and agency ids stay on the existing grant path. */
const KIT_ATTRIBUTION_BLOCKED = [
  "approval",
  "plan",
  "max_onboarding_users",
  "agency_id",
  "agency_id_basic",
  "agency_name",
  "premium_support",
  "premium_support_started_at",
  "trial_source",
  "trial_start_date",
  "trial_length",
  "billing_state",
] as const;

export type KitAttributionExisting = ExistingPurchaseUser & {
  checkout_page?: string | null;
  source?: string | null;
  last_utm_source?: string | null;
  last_utm_medium?: string | null;
  last_utm_campaign?: string | null;
  last_utm_term?: string | null;
  last_utm_content?: string | null;
  last_utm_id?: string | null;
  last_touch_at?: string | null;
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function metaText(metadata: Record<string, string | null | undefined> | null | undefined, key: string, max: number): string {
  const value = metadata?.[key];
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

/**
 * First-touch and last-touch fields from a kit Checkout Session.
 * Reuses the null-only rules in purchaseExistingUpdate, then drops every
 * plan, approval, seat, and agency write. Whitespace-only click and UTM
 * columns count as empty. checkout_page prefers session metadata.checkout_page,
 * then page_url, and full_name is filled only when the row's value is empty.
 * source becomes one_feature_kit when it is null, or when this call just
 * created the starter row (that insert stamps source signup).
 */
export function kitBuyerAttributionPatch(input: {
  existing: KitAttributionExisting;
  metadata: Record<string, string | null | undefined> | null | undefined;
  name: string;
  nowIso: string;
  createdHere?: boolean;
}): Record<string, unknown> {
  const metadata = input.metadata ?? {};
  const existing: KitAttributionExisting = { ...input.existing };
  for (const key of ["fbclid", "fbc", "fbp", ...KIT_ATTRIBUTION_KEYS] as const) {
    if (!hasText(existing[key])) existing[key] = null;
  }
  const attribution: Record<string, string> = {};
  for (const key of KIT_ATTRIBUTION_KEYS) {
    const value = metaText(metadata, key, key === "landing_page" || key === "referrer" ? 500 : 200);
    if (value) attribution[key] = value;
  }
  const patch = purchaseExistingUpdate({
    dbPlan: "STARTER",
    maxUsers: 1,
    resolvedName: "",
    isPremiumSupport: false,
    nowIso: input.nowIso,
    existing,
    resolvedFbclid: metaText(metadata, "fbclid", 500),
    resolvedFbc: metaText(metadata, "fbc", 500),
    resolvedFbp: metaText(metadata, "fbp", 200),
    attribution,
    checkoutPage: "",
    generatedAgencyId: "kit-attribution-unused",
    agencySlugSource: "kit-attribution-unused",
  });
  for (const key of KIT_ATTRIBUTION_BLOCKED) delete patch[key];
  delete patch.full_name;
  delete patch.checkout_page;

  const name = (input.name.trim() || metaText(metadata, "name", 200)).slice(0, 200);
  if (!hasText(input.existing.full_name) && name) patch.full_name = name;

  const pageUrl = metaText(metadata, "page_url", 500);
  const checkoutPage = metaText(metadata, "checkout_page", 500);
  if (!hasText(input.existing.checkout_page)) {
    const page = checkoutPage || pageUrl;
    if (page) patch.checkout_page = page;
  }

  for (const [from, to] of Object.entries(KIT_LAST_UTM_KEYS) as [keyof typeof KIT_LAST_UTM_KEYS, (typeof KIT_LAST_UTM_KEYS)[keyof typeof KIT_LAST_UTM_KEYS]][]) {
    const value = metaText(metadata, from, 200);
    if (value && !hasText(input.existing[to])) patch[to] = value;
  }

  const trackingPresent = Boolean(
    pageUrl
    || metaText(metadata, "fbclid", 500)
    || metaText(metadata, "fbc", 500)
    || metaText(metadata, "fbp", 200)
    || KIT_ATTRIBUTION_KEYS.some((key) => metaText(metadata, key, 500)),
  );
  if (trackingPresent && !hasText(input.existing.last_touch_at)) patch.last_touch_at = input.nowIso;

  const source = input.existing.source;
  if (!hasText(source) || (input.createdHere === true && source === "signup")) {
    patch.source = KIT_BUYER_SOURCE;
  }
  return patch;
}

/** Same fields the insert branch of notify-stripe-purchase already wrote. */
export function purchaseInsertRow(input: {
  email: string;
  dbPlan: string;
  maxUsers: number;
  resolvedName: string;
  isPremiumSupport: boolean;
  nowIso: string;
  agencySlugSource: string;
  generatedAgencyId: string;
  resolvedFbclid: string;
  attribution: Record<string, string>;
  checkoutPage: string;
}): Record<string, unknown> {
  return {
    email: input.email,
    approval: "YES",
    plan: input.dbPlan,
    max_onboarding_users: input.maxUsers,
    full_name: input.resolvedName || null,
    ...(input.isPremiumSupport
      ? { premium_support: true, premium_support_started_at: input.nowIso }
      : {}),
    agency_name: input.resolvedName || input.agencySlugSource,
    agency_id: input.generatedAgencyId,
    agency_id_basic: input.generatedAgencyId,
    initial_questions_completed: false,
    ...(input.resolvedFbclid ? { fbclid: input.resolvedFbclid } : {}),
    ...input.attribution,
    ...(input.checkoutPage ? { checkout_page: input.checkoutPage } : {}),
  };
}
