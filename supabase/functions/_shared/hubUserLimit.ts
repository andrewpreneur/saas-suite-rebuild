// Who consumes a client-hub seat.
// The agency owner's own emails and preview/test visits do not. Guests never did.
// Kept in plain TypeScript so hub-session, Copilot, and tests share one rule.
// A preview visit that uses a normal customer email still counts: there is no
// seat-exempt column on user_progress.

export const HUB_USER_LIMIT_EVENT = "hub_user_limit_reached";
export const HUB_LIMIT_NOTIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface HubPerson {
  email?: string | null;
  name?: string | null;
  created_at?: string | null;
}

export interface HubUserSummary {
  email: string | null;
  name: string | null;
  first_seen: string | null;
  counts_toward_limit: boolean;
}

const PREVIEW_NAME = /^(preview|test|demo)( user)?$/i;
const PREVIEW_NAME_PHRASE = /\b(preview|test|demo) user\b/i;
const PREVIEW_LOCAL = /^(preview|test|demo)(\+.*)?$/;
const GUEST_NAME = /^Guest User #/i;

export function normalizeEmail(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export function isGuestIdentity(email: string | null | undefined, name: string | null | undefined): boolean {
  if (normalizeEmail(email)) return false;
  const n = String(name || "").trim();
  return !n || GUEST_NAME.test(n);
}

export function isPreviewIdentity(email: string | null | undefined, name: string | null | undefined): boolean {
  const n = String(name || "").trim();
  if (PREVIEW_NAME.test(n) || PREVIEW_NAME_PHRASE.test(n)) return true;
  const local = normalizeEmail(email).split("@")[0] || "";
  return PREVIEW_LOCAL.test(local);
}

export function countsTowardLimit(input: {
  email?: string | null;
  name?: string | null;
  ownerEmails?: string[];
}): boolean {
  if (isGuestIdentity(input.email, input.name)) return false;
  if (isPreviewIdentity(input.email, input.name)) return false;
  const email = normalizeEmail(input.email);
  if (email && (input.ownerEmails || []).some((owner) => normalizeEmail(owner) === email)) return false;
  return !!email || !!String(input.name || "").trim();
}

export function seatKey(email?: string | null, name?: string | null): string {
  const normalized = normalizeEmail(email);
  if (normalized) return normalized;
  return String(name || "").trim();
}

export function summarizeHubUsers(rows: HubPerson[], ownerEmails: string[] = []): { users: HubUserSummary[]; used: number } {
  const grouped = new Map<string, HubUserSummary>();
  for (const row of rows) {
    if (isGuestIdentity(row.email, row.name)) continue;
    const key = seatKey(row.email, row.name);
    if (!key) continue;
    const summary: HubUserSummary = {
      email: normalizeEmail(row.email) ? String(row.email).trim() : null,
      name: String(row.name || "").trim() || null,
      first_seen: row.created_at || null,
      counts_toward_limit: countsTowardLimit({ email: row.email, name: row.name, ownerEmails }),
    };
    const prev = grouped.get(key);
    if (!prev || (summary.first_seen && (!prev.first_seen || summary.first_seen < prev.first_seen))) {
      grouped.set(key, summary);
    }
  }
  const users = [...grouped.values()].sort((a, b) => String(a.first_seen || "").localeCompare(String(b.first_seen || "")));
  return { users, used: users.filter((user) => user.counts_toward_limit).length };
}

/** Null limit means unlimited. Existing seated people stay allowed when their rank is inside the limit. */
export function visitorWithinLimit(input: {
  email?: string | null;
  name?: string | null;
  preview?: boolean;
  ownerEmails?: string[];
  rows: HubPerson[];
  limit: number | null;
}): { allowed: boolean; used: number; currentIdentityCounts: boolean } {
  const owners = input.ownerEmails || [];
  const preview = !!input.preview || isPreviewIdentity(input.email, input.name);
  const owner = !!normalizeEmail(input.email) && owners.some((item) => normalizeEmail(item) === normalizeEmail(input.email));
  const { users, used } = summarizeHubUsers(input.rows, owners);
  const key = seatKey(input.email, input.name);
  const counting = users.filter((user) => user.counts_toward_limit);
  const index = counting.findIndex((user) => seatKey(user.email, user.name) === key);
  const currentIdentityCounts = !preview && !owner && countsTowardLimit({ email: input.email, name: input.name, ownerEmails: owners });
  if (preview || owner || !currentIdentityCounts) return { allowed: true, used, currentIdentityCounts: false };
  if (input.limit == null) return { allowed: true, used, currentIdentityCounts: true };
  if (index >= 0) return { allowed: index < input.limit, used, currentIdentityCounts: true };
  return { allowed: used < input.limit, used, currentIdentityCounts: true };
}

export function subscriptionPlanName(plan: string | null | undefined, premiumSupport?: boolean | null): string {
  if (premiumSupport || /^(PREMIUM|ENHANCED|PREMIUM SUPPORT)$/i.test(plan || "")) return "Premium Support";
  switch ((plan || "").trim().toUpperCase()) {
    case "ADVANCED": return "Advanced";
    case "BASIC": return "Basic";
    case "STARTER": return "Starter";
    default: return (plan || "").trim() || "Unknown";
  }
}

export function hubLimitResponse(input: {
  plan?: string | null;
  premiumSupport?: boolean | null;
  limit: number | null;
  current: number;
  agencyName?: string | null;
}) {
  return {
    status: "limit" as const,
    reason: "user_limit_reached" as const,
    plan: (input.plan || "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
    plan_name: subscriptionPlanName(input.plan, input.premiumSupport),
    limit: input.limit,
    current: input.current,
    agency_name: input.agencyName || null,
  };
}

export function shouldNotifyHubLimit(recentCreatedAt: string | null | undefined, now = Date.now()): boolean {
  if (!recentCreatedAt) return true;
  const then = Date.parse(recentCreatedAt);
  if (Number.isNaN(then)) return true;
  return now - then >= HUB_LIMIT_NOTIFY_WINDOW_MS;
}
