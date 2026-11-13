/**
 * Kit buyer sign-in decisions.
 * Account existence comes from the server. These helpers only shape the form,
 * the login link, and the onboarding gate. They do not list users.
 */

export {
  accountStateForPassword,
  publicAccountState,
  type AuthAccountState,
} from "../../supabase/functions/_shared/auth-account-state";

import type { AuthAccountState } from "../../supabase/functions/_shared/auth-account-state";

export type SignupMode = "email" | "create" | "sign-in" | "set-password";

export function signupModeForState(state: AuthAccountState): Exclude<SignupMode, "email"> {
  if (state === "password") return "sign-in";
  if (state === "needs_password") return "set-password";
  return "create";
}

/**
 * signUp said the email is taken. Stay on this form.
 * A missing auth row here still means the account exists, so ask for the password.
 */
export function modeAfterAlreadyRegistered(state: AuthAccountState): "sign-in" | "set-password" {
  return state === "needs_password" ? "set-password" : "sign-in";
}

export function isKitDeepLink(path: string | null | undefined): boolean {
  if (!path) return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/app/dashboard")) return false;
  if (trimmed.startsWith("//") || trimmed.includes("\\") || trimmed.includes("://")) return false;
  const query = trimmed.split("?")[1]?.split("#")[0] ?? "";
  if (!query) return false;
  return new URLSearchParams(query).get("view") === "kit";
}

/** Login link and the account-exists redirect. Email and next both stay on the URL. */
export function accountExistsLoginPath(email: string, next: string | null | undefined): string {
  const params = new URLSearchParams();
  const clean = email.trim().toLowerCase();
  if (clean) params.set("email", clean);
  if (next && isSafeNext(next)) params.set("next", next);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function resetPasswordRedirect(origin: string, next: string | null | undefined): string {
  const base = `${origin.replace(/\/$/, "")}/reset-password`;
  if (!next || !isSafeNext(next)) return base;
  return `${base}?next=${encodeURIComponent(next)}`;
}

function isSafeNext(path: string): boolean {
  return /^\/(app|copilot)(\/|\?|$)/.test(path) && !path.includes("\\") && !path.includes("://");
}

export function mustSendToOnboarding(input: {
  needsCheck: boolean;
  isAdmin: boolean;
  skippedThisSession: boolean;
  skipDeepLink: boolean;
  onOnboardingPage: boolean;
  pathname: string;
  search: string;
  pendingNext: string | null;
}): boolean {
  if (!input.needsCheck || input.isAdmin || input.skippedThisSession || input.skipDeepLink || input.onOnboardingPage) {
    return false;
  }
  if (isKitDeepLink(`${input.pathname}${input.search}`)) return false;
  if (isKitDeepLink(input.pendingNext)) return false;
  return true;
}
