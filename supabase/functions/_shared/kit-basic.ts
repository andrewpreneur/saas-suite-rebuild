/** Plans a kit purchase may raise to BASIC. Advanced and an existing Basic stay put. */
export const KIT_BASIC_UPGRADE_PLANS = ["STARTER", "null", "NULL", "Null", ""] as const;

/** Stored on saas_suite_users.trial_source. The daily expiry job reads this. */
export const KIT_BASIC_TRIAL_SOURCE = "one_feature_kit_30day";
export const KIT_BASIC_TRIAL_DAYS = 30;

/** plan_change_history.source after a kit Starter → Basic grant. No schema change. */
export const KIT_PLAN_CHANGE_TAG = { source: "one_feature_kit", actor: "one-feature-kit" } as const;

/** The history row the kit grant trigger just wrote, before it is retagged. */
export function kitPlanChangeIsKitGrant(row: {
  old_plan?: string | null;
  new_plan?: string | null;
  source?: string | null;
}): boolean {
  if ((row.source ?? "") !== "database") return false;
  if (row.new_plan !== "BASIC") return false;
  return (KIT_BASIC_UPGRADE_PLANS as readonly string[]).includes(row.old_plan ?? "");
}

export function kitBasicGrant(plan: string | null | undefined): { plan: "BASIC"; max_onboarding_users: 5 } | null {
  const current = plan ?? "";
  if (!(KIT_BASIC_UPGRADE_PLANS as readonly string[]).includes(current)) return null;
  return { plan: "BASIC", max_onboarding_users: 5 };
}

export type KitBasicRow = {
  plan: string | null;
  trial_source: string | null;
  trial_start_date: string | null;
  trial_length: number | null;
};

/** True when this row is the kit's Basic grant and the 30 days are over. */
export function kitBasicTrialEnded(row: KitBasicRow, now = Date.now()): boolean {
  if (row.trial_source !== KIT_BASIC_TRIAL_SOURCE) return false;
  if ((row.plan ?? "").toUpperCase() !== "BASIC") return false;
  if (!row.trial_start_date) return false;
  const start = new Date(row.trial_start_date).getTime();
  if (Number.isNaN(start)) return false;
  const days = row.trial_length && row.trial_length > 0 ? row.trial_length : KIT_BASIC_TRIAL_DAYS;
  return start + days * 86_400_000 <= now;
}

/**
 * Plan, seat count, and the 30-day clock. A repeat delivery during the 30 days
 * keeps the original start. A later purchase after it ended starts a new 30 days.
 */
export function kitBasicAccessUpdate(row: KitBasicRow, now = Date.now(), purchasedAt?: string | null) {
  const grant = kitBasicGrant(row.plan);
  if (!grant) return null;
  const purchased = purchasedAt && !Number.isNaN(Date.parse(purchasedAt)) ? new Date(purchasedAt).toISOString() : new Date(now).toISOString();
  const stillRunning = row.trial_source === KIT_BASIC_TRIAL_SOURCE
    && !!row.trial_start_date
    && !kitBasicTrialEnded({ ...row, plan: "BASIC" }, now);
  return {
    ...grant,
    trial_source: KIT_BASIC_TRIAL_SOURCE,
    trial_length: KIT_BASIC_TRIAL_DAYS,
    trial_start_date: stillRunning ? row.trial_start_date : purchased,
  };
}
