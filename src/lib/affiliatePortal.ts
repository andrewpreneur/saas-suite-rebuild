/** Affiliate ownership follows the signed-in person, not a client workspace.
 * Verified platform impersonation can still inspect the selected affiliate.
 */
export function affiliatePortalEmail(identity: {
  actualEmail: string | null;
  effectiveEmail: string | null;
  isImpersonating: boolean;
}): string | null {
  if (!identity.actualEmail) return null;
  const email = identity.isImpersonating ? identity.effectiveEmail : identity.actualEmail;
  return email?.trim().toLowerCase() || null;
}

/** Failed reads must never masquerade as missing affiliate records. */
export function affiliateQueryData<T>(result: {
  data: T;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}