import { accountRank, UPGRADE_PLANS } from "../../supabase/functions/chat-copilot/billingPolicy.ts";

/** Writes that restyle the agency's own HighLevel account. Widgets and layout stay out. */
const BRANDING_WRITE_KINDS = new Set(["sidebar", "colors", "login", "buttons", "mobile", "favicon"]);

/** Labels a Starter can still save on Design. */
const OPEN_DESIGN_LABELS = new Set([
  "Client Hub layout",
  "Bottom right chat popup",
  "Top navigation help widget",
]);

/**
 * Branding tool and Theme Customizer start at Basic.
 * A standalone purchase (`saas_suite_users.branding_tool_access === true`)
 * unlocks the same controls and saves without raising the plan.
 * Rank and the plan name come from the Copilot billing plan model.
 */
export function designBrandingUnlocked(
  plan: string | null | undefined,
  premiumSupport = false,
  brandingToolAccess = false,
): boolean {
  if (brandingToolAccess === true) return true;
  return accountRank({ plan: plan || undefined, premium_support: premiumSupport }) >= UPGRADE_PLANS.basic.rank;
}

export function designThemeUnlocked(
  plan: string | null | undefined,
  premiumSupport = false,
  brandingToolAccess = false,
): boolean {
  return designBrandingUnlocked(plan, premiumSupport, brandingToolAccess);
}

export function minimumBrandingPlanName(): string {
  return UPGRADE_PLANS.basic.name;
}

export function visibleDesignLabels(
  labels: string[],
  plan: string | null | undefined,
  premiumSupport = false,
  brandingToolAccess = false,
): string[] {
  if (designBrandingUnlocked(plan, premiumSupport, brandingToolAccess)) return labels;
  return labels.filter((label) => OPEN_DESIGN_LABELS.has(label));
}

export function filterDesignWrites<T extends { kind: string }>(
  writes: T[],
  plan: string | null | undefined,
  premiumSupport = false,
  brandingToolAccess = false,
): T[] {
  if (designBrandingUnlocked(plan, premiumSupport, brandingToolAccess)) return writes;
  return writes.filter((write) => !BRANDING_WRITE_KINDS.has(write.kind));
}
