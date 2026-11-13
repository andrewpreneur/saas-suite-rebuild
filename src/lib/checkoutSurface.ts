const PLAN_CARD_LABEL: Record<string, string> = {
  basic: "Basic",
  advanced: "Advanced",
  enhanced: "Premium Support",
  special: "Special",
};

/** The page and card that opened checkout, for example "/app/billing Advanced card". */
export function checkoutSurfaceLabel(plan: string, page: string): string {
  const base = plan.replace(/_annual$/, "");
  const name = PLAN_CARD_LABEL[base] ?? plan;
  const where = page.trim() || "/";
  return `${where} ${name} card`;
}

export function billingIntervalForPlan(plan: string): "monthly" | "annual" {
  if (plan === "special" || plan.endsWith("_annual")) return "annual";
  return "monthly";
}
