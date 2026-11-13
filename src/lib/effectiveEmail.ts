// Resolves which account email the app should act as.
// Rule: without a live authenticated session (actualEmail from Supabase auth),
// the result is ALWAYS null — stale account-switching or impersonation state
// left in sessionStorage after sign-out must never make the app look signed in.
export function resolveEffectiveEmail(opts: {
  actualEmail: string | null;
  selectedAccountEmail: string | null;
  impersonatingFlag: boolean;
  impersonatedBy: string | null;
  adminEmail: string;
  /** When set, any of these emails may impersonate. Defaults to adminEmail. */
  adminEmails?: readonly string[];
}): { effectiveEmail: string | null; isImpersonating: boolean; isAccountSwitched: boolean } {
  const { actualEmail, selectedAccountEmail, impersonatingFlag, impersonatedBy, adminEmail, adminEmails } = opts;
  if (!actualEmail) {
    return { effectiveEmail: null, isImpersonating: false, isAccountSwitched: false };
  }
  const allowed = (adminEmails?.length ? adminEmails : [adminEmail]).map((email) => email.toLowerCase());
  const actual = actualEmail.toLowerCase();
  const isImpersonating =
    impersonatingFlag &&
    !!selectedAccountEmail &&
    impersonatedBy?.toLowerCase() === actual &&
    allowed.includes(actual);
  const isAccountSwitched =
    !!selectedAccountEmail && selectedAccountEmail.toLowerCase() !== actualEmail.toLowerCase();
  const effectiveEmail = isImpersonating
    ? selectedAccountEmail
    : isAccountSwitched
      ? selectedAccountEmail
      : actualEmail;
  return { effectiveEmail, isImpersonating, isAccountSwitched };
}
