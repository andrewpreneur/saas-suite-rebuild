/** One email in, one state out. Never a list of users. */

export type AuthAccountState = "new" | "password" | "needs_password";

/** A real password is a non-empty auth.users.encrypted_password. A stale flag is ignored. */
export function accountStateForPassword(
  found: boolean,
  encryptedPassword: string | null | undefined,
): AuthAccountState {
  if (!found) return "new";
  if (typeof encryptedPassword === "string" && encryptedPassword.length > 0) return "password";
  return "needs_password";
}

/**
 * The only response the browser is allowed to see from the account lookup.
 * Returning `{ state }` is intentional. The signup form already has the email
 * the person typed and needs new, password, or needs_password to choose the
 * next step. The body has no email, user id, or other rows, so this cannot
 * list accounts or harvest addresses.
 */
export function publicAccountState(state: string | null | undefined): { state: AuthAccountState } | null {
  if (state === "new" || state === "password" || state === "needs_password") return { state };
  return null;
}
