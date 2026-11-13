import { checkoutPlanFor, SAAS_PLANS, type CheckoutPlan } from "@/constants/pricingPlans";

/**
 * Weekly token allowance included with Premium Support.
 * TODO(Andrew): set this number. Leave it null until then.
 * null renders a neutral "weekly token allowance" line. Do not invent a number.
 */
export const AGENTS_WEEKLY_TOKENS: number | null = null;

/** Existing Premium Support monthly checkout (`enhanced`, $297). No new Stripe price. */
export const AGENTS_CHECKOUT_PLAN: CheckoutPlan = checkoutPlanFor("premium", "monthly");

export const AGENTS_PLAN_PRICE = SAAS_PLANS.premium.monthlyPrice;
export const AGENTS_PLAN_NAME = SAAS_PLANS.premium.name;

export const AGENTS_CORE_MESSAGE =
  "We use AI agents that log into your HighLevel agency and sub-accounts and perform tasks for you.";

export const AGENTS_AUDIENCE =
  "It works for you, on your own agency. Your customers can use it too: they ask or request something, and the agents do it.";

export const AGENTS_USE_CASES: readonly { title: string; body: string }[] = [
  {
    title: "Buyers get their login the moment they pay",
    body: "Rebuilt a purchase workflow so the login email goes out instantly, tagged the contact, and stopped abandoned-cart messages to people who had already paid.",
  },
  {
    title: "The right people skip emails that don't apply",
    body: "Changed two live email workflows so one customer segment skips messages that don't apply to them. Tested on copies first.",
  },
  {
    title: "Four email workflows, published and tested",
    body: "Built and published four automated email workflows from scratch, wired them to webhooks, and tested them before they went live.",
  },
  {
    title: "Menu links come off on their own",
    body: "Set up an automated menu-link removal system: the product, the workflow, Private Integration tokens, a test sub-account, publish, and security key rotation. The snapshot was set up to work with it.",
  },
  {
    title: "One automation, checked across 18 agencies",
    body: "Logged into 18 agencies and audited whether a key automation was installed and configured correctly.",
  },
  {
    title: "Menu links corrected across 72 sub-accounts",
    body: "Verified admin access, surveyed an agency's 72 sub-accounts, and repointed their custom menu links.",
  },
];

export const AGENTS_STEPS: readonly { title: string; body: string }[] = [
  { title: "Ask", body: "You or a customer request the task." },
  {
    title: "The agent logs in",
    body: "An AI agent signs into the HighLevel agency or sub-account.",
  },
  { title: "The task is done", body: "The agent completes the work inside the account." },
  { title: "You review", body: "You check what changed." },
];

export type AgentsAccount = {
  plan?: string | null;
  premium_support?: boolean | null;
};

export type AgentsPlanState = "included" | "upgrade";

/**
 * Premium Support is Advanced plus the premium_support flag, or a plan stored
 * as Premium / Enhanced. Same rule as accountRank in billingPolicy.
 */
export function agentsIncludedInPlan(account: AgentsAccount | null | undefined): boolean {
  if (!account) return false;
  if (account.premium_support === true) return true;
  return /^(PREMIUM|ENHANCED|PREMIUM SUPPORT)$/i.test((account.plan || "").trim());
}

export function agentsPlanState(account: AgentsAccount | null | undefined): AgentsPlanState {
  return agentsIncludedInPlan(account) ? "included" : "upgrade";
}

/** A failed or missing account read stays on the upgrade. It never claims the feature is included. */
export function agentsPlanStateFromRead(
  account: AgentsAccount | null | undefined,
  failed: boolean,
): AgentsPlanState {
  if (failed) return "upgrade";
  return agentsPlanState(account);
}

export function agentsWeeklyTokenLine(tokens: number | null = AGENTS_WEEKLY_TOKENS): string {
  if (tokens == null || !Number.isFinite(tokens)) return "Includes a weekly token allowance.";
  const amount = Math.trunc(tokens);
  return `Includes ${amount.toLocaleString("en-US")} tokens each week.`;
}

export function agentsPublicCopy(): string {
  return [
    AGENTS_CORE_MESSAGE,
    AGENTS_AUDIENCE,
    ...AGENTS_USE_CASES.flatMap((item) => [item.title, item.body]),
    ...AGENTS_STEPS.flatMap((item) => [item.title, item.body]),
    agentsWeeklyTokenLine(null),
    "Included in your plan",
    "Upgrade to Premium Support",
    AGENTS_PLAN_NAME,
  ].join("\n");
}
