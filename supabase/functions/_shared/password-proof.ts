/**
 * Proof that the caller owns the email before a password is set.
 * An email address by itself is never enough.
 */

export const PASSWORD_CODE_TTL_MS = 15 * 60 * 1000;
export const PASSWORD_CODE_MAX_ATTEMPTS = 5;
export const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;

export const AUTH_RATE_LIMITS = {
  lookup: { email: 30, ip: 60 },
  send_code: { email: 5, ip: 10 },
  set_password: { email: 8, ip: 20 },
} as const;

export type AuthRateBucket = keyof typeof AUTH_RATE_LIMITS;

const MAGIC_METHODS = new Set(["otp", "magiclink", "invite", "recovery"]);

export function rateLimitAllows(recentCount: number, max: number): boolean {
  return recentCount < max;
}

export function sessionCanSetPassword(input: {
  sessionEmail: string | null | undefined;
  targetEmail: string;
  amr: Array<{ method?: string | null }> | null | undefined;
}): boolean {
  const sessionEmail = input.sessionEmail?.trim().toLowerCase() ?? "";
  const targetEmail = input.targetEmail.trim().toLowerCase();
  if (!sessionEmail || sessionEmail !== targetEmail) return false;
  return (input.amr ?? []).some((entry) => MAGIC_METHODS.has(String(entry.method ?? "").toLowerCase()));
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const padded = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const json = atob(padded);
    const parsed = JSON.parse(json) as unknown;
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function amrFromToken(token: string): Array<{ method?: string | null }> | null {
  const payload = decodeJwtPayload(token);
  const amr = payload?.amr;
  if (!Array.isArray(amr)) return null;
  return amr.filter((entry) => entry && typeof entry === "object") as Array<{ method?: string | null }>;
}

export type StoredPasswordCode = {
  codeHash: string;
  expiresAt: number;
  used: boolean;
  attempts: number;
};

export function verifyStoredCode(input: {
  stored: StoredPasswordCode | null;
  expectedHash: string;
  now: number;
  maxAttempts?: number;
}): { ok: boolean; reason: "missing" | "used" | "expired" | "locked" | "mismatch" | "ok" } {
  const row = input.stored;
  const maxAttempts = input.maxAttempts ?? PASSWORD_CODE_MAX_ATTEMPTS;
  if (!row) return { ok: false, reason: "missing" };
  if (row.used) return { ok: false, reason: "used" };
  if (row.expiresAt <= input.now) return { ok: false, reason: "expired" };
  if (row.attempts >= maxAttempts) return { ok: false, reason: "locked" };
  if (!timingSafeEqual(row.codeHash, input.expectedHash)) return { ok: false, reason: "mismatch" };
  return { ok: true, reason: "ok" };
}

export function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export type PasswordProof =
  | { ok: true; via: "magic_link" | "code" }
  | { ok: false; httpStatus: number; status: string; error: string };

/**
 * needs_password plus a magic-link session or a verified code.
 * Email alone, a password session, and an account that already has a password are refused.
 */
export function proofForPasswordSet(input: {
  targetEmail: string;
  state: "new" | "password" | "needs_password";
  sessionEmail: string | null;
  amr: Array<{ method?: string | null }> | null;
  codeAccepted: boolean;
}): PasswordProof {
  if (input.state === "new") {
    return { ok: false, httpStatus: 200, status: "no_auth_user", error: "" };
  }
  if (input.state === "password") {
    return {
      ok: false,
      httpStatus: 409,
      status: "has_password",
      error: "This account already has a password. Please log in instead.",
    };
  }
  if (sessionCanSetPassword({
    sessionEmail: input.sessionEmail,
    targetEmail: input.targetEmail,
    amr: input.amr,
  })) {
    return { ok: true, via: "magic_link" };
  }
  if (input.codeAccepted) return { ok: true, via: "code" };
  return {
    ok: false,
    httpStatus: 401,
    status: "proof_required",
    error: "Enter the one-time code from your email, or open the sign-in link we already sent.",
  };
}

export function newNumericCode(randomInt: (max: number) => number): string {
  return String(randomInt(1_000_000)).padStart(6, "0");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPasswordCode(salt: string, code: string, pepper: string): Promise<string> {
  return sha256Hex(`${pepper}:${salt}:${code}`);
}

export function clientIp(forwardedFor: string | null): string {
  return (forwardedFor?.split(",")[0]?.trim() || "unknown").slice(0, 80);
}

export function safeAuthNext(value: unknown): string | null {
  const path = String(value ?? "").trim();
  if (!/^\/(app|copilot)(\/|\?|$)/.test(path) || path.includes("\\") || path.includes("://")) return null;
  return path.slice(0, 300);
}
