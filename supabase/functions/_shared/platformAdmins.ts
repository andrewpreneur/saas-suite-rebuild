/**
 * Signed-in platform admins. This list must match public.is_platform_admin().
 * current_auth_email() already lowercases the JWT email, so these values stay lowercase.
 */
export const PLATFORM_ADMIN_EMAILS = [
  "andrew@dna-media.net",
  "team@yoursoftwareonboarding.com",
] as const;

/** Original platform admin. Older call sites still name this address. */
export const PLATFORM_ADMIN_EMAIL = PLATFORM_ADMIN_EMAILS[0];

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  return (PLATFORM_ADMIN_EMAILS as readonly string[]).includes(normalized);
}
