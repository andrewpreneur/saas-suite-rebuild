/**
 * Plan rank shared with reconcile-plans.
 * STARTER 0, BASIC 1, ADVANCED 2.
 * A cheaper Stripe price or store product must not replace a higher plan,
 * and a seat limit only moves up.
 */

export const PLAN_RANK: Record<string, number> = {
  STARTER: 0,
  BASIC: 1,
  ADVANCED: 2,
};

export const PLAN_SEAT_LIMIT: Record<string, number> = {
  STARTER: 1,
  BASIC: 5,
  ADVANCED: 10000,
};

export function normalizePlan(plan: string | null | undefined): string {
  return String(plan ?? "").trim().toUpperCase();
}

export function planRank(plan: string | null | undefined): number {
  const name = normalizePlan(plan);
  return Object.prototype.hasOwnProperty.call(PLAN_RANK, name) ? PLAN_RANK[name] : 0;
}

/** Highest known plan. Empty and unknown labels are ignored. */
export function highestPlan(plans: Array<string | null | undefined>): string {
  let best = "";
  let bestRank = -1;
  for (const plan of plans) {
    const name = normalizePlan(plan);
    if (!Object.prototype.hasOwnProperty.call(PLAN_RANK, name)) continue;
    const rank = PLAN_RANK[name];
    if (rank > bestRank) {
      best = name;
      bestRank = rank;
    }
  }
  return best;
}

export function raisedSeatLimit(currentMax: number | null | undefined, plan: string): number {
  const floor = PLAN_SEAT_LIMIT[normalizePlan(plan)] ?? PLAN_SEAT_LIMIT.STARTER;
  return Math.max(currentMax ?? 0, floor);
}

export type PlanSyncDecision =
  | { action: "raise"; plan: string; maxUsers: number }
  | { action: "same"; maxUsers: number | null }
  | {
      action: "skip_downgrade";
      kept: string;
      ignored: string;
      /** Live plan is below the plan we are keeping (for example STARTER while past due). */
      liveBelowKept: boolean;
      maxUsers: number;
    };

/**
 * Incoming subscription or checkout plan versus the account.
 * `protectedPlan` is plan_before_delinquency: a past-due row's live plan is
 * STARTER, and that memory is what a cheaper price must not erase.
 */
export function decideSubscriptionPlan(input: {
  currentPlan: string | null | undefined;
  protectedPlan?: string | null | undefined;
  incomingPlan: string;
  currentMax: number | null | undefined;
}): PlanSyncDecision {
  const live = normalizePlan(input.currentPlan) || "STARTER";
  const floor = highestPlan([live, input.protectedPlan]) || live;
  const incoming = normalizePlan(input.incomingPlan);
  const target = highestPlan([floor, incoming]) || incoming || floor;

  if (incoming && planRank(incoming) < planRank(floor)) {
    return {
      action: "skip_downgrade",
      kept: floor,
      ignored: incoming,
      liveBelowKept: planRank(floor) > planRank(live),
      maxUsers: raisedSeatLimit(input.currentMax, floor),
    };
  }

  if (planRank(target) > planRank(live)) {
    return {
      action: "raise",
      plan: target,
      maxUsers: raisedSeatLimit(input.currentMax, target),
    };
  }

  const seat = PLAN_SEAT_LIMIT[live];
  const currentMax = input.currentMax ?? 0;
  return {
    action: "same",
    maxUsers: seat != null && currentMax < seat ? seat : null,
  };
}
