/**
 * Paid-through cancellation window for suspend-user-access.
 *
 * The protected window is a parsed instant strictly after now. Equality, a past
 * instant, null, and an unparseable value are not protected, so explicit
 * suspension still runs. This does not replace expire-payment-grace, which
 * selects cancel_access_until < now() and calls mark_payment_delinquent.
 *
 * Override is not a body flag. force is honored only together with the existing
 * platform-admin identity (public.is_platform_admin / requireAdmin): an Auth
 * email on the platform admin allowlist. Webhook secrets, anon keys, and the
 * service role are not that identity.
 */

import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAIL } from "./platformAdmins.ts";

export { PLATFORM_ADMIN_EMAIL };

const INSTANT_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

export type CancelAccessWindow =
  | { state: "future"; until: string }
  | { state: "equal"; until: string }
  | { state: "expired"; until: string }
  | { state: "absent" }
  | { state: "invalid" };

export function isExistingPlatformAdminEmail(email: string | null | undefined): boolean {
  return isPlatformAdminEmail(email);
}

export function readBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length);
  return token.length > 0 ? token : null;
}

/** Maps an Auth getUser result. An error or a missing email is not a session. */
export function sessionEmailFromAuthUser(
  user: { email?: string | null } | null | undefined,
  error: boolean,
): string | null {
  if (error || !user?.email) return null;
  return user.email;
}

export async function resolveSessionEmail(
  req: Request,
  getUser: (token: string) => Promise<{ user: { email?: string | null } | null; error: boolean }>,
): Promise<string | null> {
  const token = readBearerToken(req);
  if (!token) return null;
  try {
    const result = await getUser(token);
    return sessionEmailFromAuthUser(result?.user, Boolean(result?.error));
  } catch {
    return null;
  }
}

/** force bypasses the window only for a resolved platform-admin session. */
export function suspendOverrideAllowed(force: unknown, sessionEmail: string | null): boolean {
  return force === true && isExistingPlatformAdminEmail(sessionEmail);
}

/**
 * Calendar fields are checked after the offset is applied so 2026-13-40 and
 * other rollovers stay invalid instead of becoming a later instant.
 */
export function parseCancelAccessInstant(value: string): number | null {
  const match = INSTANT_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = match[7] ?? "";
  const zone = match[8];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  let offsetMinutes = 0;
  if (zone !== "Z") {
    const sign = zone.startsWith("+") ? 1 : -1;
    const zoneHour = Number(zone.slice(1, 3));
    const zoneMinute = Number(zone.slice(4, 6));
    if (zoneHour > 23 || zoneMinute > 59) return null;
    offsetMinutes = sign * (zoneHour * 60 + zoneMinute);
  }
  const fractionMs = fraction ? Number(fraction.padEnd(3, "0").slice(0, 3)) : 0;
  if (!Number.isFinite(fractionMs)) return null;
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const instant = utc - offsetMinutes * 60_000 + fractionMs;
  const zoned = new Date(instant + offsetMinutes * 60_000);
  if (
    zoned.getUTCFullYear() !== year ||
    zoned.getUTCMonth() !== month - 1 ||
    zoned.getUTCDate() !== day ||
    zoned.getUTCHours() !== hour ||
    zoned.getUTCMinutes() !== minute ||
    zoned.getUTCSeconds() !== second ||
    zoned.getUTCMilliseconds() !== fractionMs
  ) {
    return null;
  }
  return instant;
}

export function classifyCancelAccessUntil(value: unknown, nowMs: number): CancelAccessWindow {
  if (value == null) return { state: "absent" };
  if (typeof value !== "string") return { state: "invalid" };
  const until = value.trim();
  if (!until) return { state: "absent" };
  const instant = parseCancelAccessInstant(until);
  if (instant == null) return { state: "invalid" };
  if (instant > nowMs) return { state: "future", until };
  if (instant === nowMs) return { state: "equal", until };
  return { state: "expired", until };
}

export type SuspendAccessDecision =
  | { action: "already_suspended" }
  | { action: "skip_paid_through"; cancelAccessUntil: string }
  | { action: "suspend" };

export function decideSuspendAccess(input: {
  approval: string | null;
  cancelAccessUntil: unknown;
  nowMs: number;
  force: unknown;
  sessionEmail: string | null;
}): SuspendAccessDecision {
  if (input.approval === "NO") return { action: "already_suspended" };
  const window = classifyCancelAccessUntil(input.cancelAccessUntil, input.nowMs);
  if (window.state === "future" && !suspendOverrideAllowed(input.force, input.sessionEmail)) {
    return { action: "skip_paid_through", cancelAccessUntil: window.until };
  }
  return { action: "suspend" };
}
