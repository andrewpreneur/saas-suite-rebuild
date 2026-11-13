/**
 * Dashboard entitlement for the One Feature Kit.
 * Any SaaSSuite account that is not denied, blocked, or canceled unlocks the
 * full catalog. approval "NO" is that block (rejected, suspended, or canceled).
 * There is no deleted column. A past-due bill is still an open account.
 * This does not write kit_purchases and does not change plan.
 */

export const KIT_CATALOG_LINE_IDS = [
  "kit",
  "bump-replay",
  "bump-video",
  "bump-install",
  "launch",
  "webinar-system",
] as const;

export const KIT_SIGNUP_TRIAL_SOURCE = "one_feature_kit_30day";

export type KitSignupAccount = {
  approval?: string | null;
  trial_source?: string | null;
  landing_page?: string | null;
  checkout_page?: string | null;
  referrer?: string | null;
  source?: string | null;
};

function mentionsKit(value: string | null | undefined): boolean {
  const text = (value ?? "").toLowerCase();
  return text.includes("one-feature-kit") || text.includes("onefeaturekit");
}

/** The account was created from the kit funnel. The admin directory still uses this. */
export function signedUpViaOneFeatureKit(account: KitSignupAccount | null | undefined): boolean {
  if (!account) return false;
  if ((account.trial_source ?? "").trim() === KIT_SIGNUP_TRIAL_SOURCE) return true;
  return (
    mentionsKit(account.landing_page) ||
    mentionsKit(account.checkout_page) ||
    mentionsKit(account.referrer) ||
    mentionsKit(account.source)
  );
}

/**
 * True for a loaded saas_suite_users row that is not approval NO.
 * A missing approval field means the row was not loaded.
 */
export function kitAccountIsOpen(account: KitSignupAccount | null | undefined): boolean {
  if (!account || !Object.prototype.hasOwnProperty.call(account, "approval")) return false;
  return String(account.approval ?? "").trim().toUpperCase() !== "NO";
}

/**
 * Lines the dashboard, ad library, and snapshot check should treat as owned.
 * An open account receives the full catalog. Purchase rows are not required.
 */
export function entitledKitLineIds(
  _purchasedLineIds: Iterable<string | null | undefined>,
  account?: KitSignupAccount | null,
): string[] {
  if (kitAccountIsOpen(account)) return [...KIT_CATALOG_LINE_IDS];
  return [];
}

/** Snapshot and Copilot use this. True when the full kit catalog is unlocked. */
export function hasFullKitAccess(
  purchasedLineIds: Iterable<string | null | undefined>,
  account?: KitSignupAccount | null,
): boolean {
  return entitledKitLineIds(purchasedLineIds, account).includes("kit");
}
