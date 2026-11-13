import { parsePhoneNumberFromString } from "libphonenumber-js";

export const REAL_PLANS = ["STARTER", "BASIC", "ADVANCED"] as const;
export type RealPlan = (typeof REAL_PLANS)[number];

export type PlanSyncInput = {
  id: number | string;
  email?: string | null;
  full_name?: string | null;
  bonuses_phone?: string | null;
  plan?: string | null;
  previous_plan?: string | null;
  agency_id?: string | null;
  plan_changed_at?: string | Date | null;
};

export type LynkificPlanPayload = {
  event: "saassuite.plan_changed";
  email: string;
  phone?: string;
  first_name: string;
  last_name: string;
  saassuite_user_id: number | string;
  plan: RealPlan;
  previous_plan: RealPlan | null;
  agency_id: string | null;
  plan_changed_at: string;
  source: "saassuite";
};

/** STARTER, BASIC, and ADVANCED are the only plans we forward. */
export function isRealPlan(plan: unknown): plan is RealPlan {
  return typeof plan === "string" && (REAL_PLANS as readonly string[]).includes(plan.trim());
}

/** Enum junk labels that mean "no plan": null, NULL, Null, and empty. */
export function isJunkPlan(plan: unknown): boolean {
  if (plan == null) return true;
  const text = String(plan).trim().toLowerCase();
  return text === "" || text === "null";
}

export function splitFullName(fullName: string | null | undefined): {
  first_name: string;
  last_name: string;
} {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

/**
 * E.164 when the number parses (international as written, otherwise US).
 * Returns null when it does not, so the caller can omit `phone`.
 */
export function toE164(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  const direct = parsePhoneNumberFromString(trimmed);
  if (direct?.isValid()) return direct.number;
  const us = parsePhoneNumberFromString(trimmed, "US");
  if (us?.isValid()) return us.number;
  return null;
}

function toIsoUtc(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function userId(id: number | string): number | string {
  if (typeof id === "number" && Number.isSafeInteger(id)) return id;
  const numeric = typeof id === "string" ? Number(id) : NaN;
  if (Number.isSafeInteger(numeric)) return numeric;
  return String(id);
}

/** Null when the plan is junk/unknown or the row has no email. */
export function buildLynkificPlanPayload(input: PlanSyncInput): LynkificPlanPayload | null {
  const planText = typeof input.plan === "string" ? input.plan.trim() : "";
  if (!isRealPlan(planText) || isJunkPlan(planText)) return null;

  const email = (input.email ?? "").trim();
  if (!email) return null;

  const names = splitFullName(input.full_name);
  const phone = toE164(input.bonuses_phone);
  const previous = typeof input.previous_plan === "string" ? input.previous_plan.trim() : "";

  const payload: LynkificPlanPayload = {
    event: "saassuite.plan_changed",
    email,
    first_name: names.first_name,
    last_name: names.last_name,
    saassuite_user_id: userId(input.id),
    plan: planText,
    previous_plan: isRealPlan(previous) ? previous : null,
    agency_id: (input.agency_id ?? "").trim() || null,
    plan_changed_at: toIsoUtc(input.plan_changed_at),
    source: "saassuite",
  };

  if (phone) payload.phone = phone;
  return payload;
}
