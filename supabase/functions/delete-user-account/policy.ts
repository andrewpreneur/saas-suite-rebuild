export function validateDeletionConfirmation(body: unknown, authenticatedEmail: string): boolean {
  if (!body || typeof body !== 'object') return false;
  const input = body as Record<string, unknown>;
  return input.confirmation === 'DELETE' && typeof input.email === 'string'
    && input.email.trim().toLowerCase() === authenticatedEmail.trim().toLowerCase();
}

export function canDeleteDisplayedAccount(actualEmail: string | null, displayedEmail: string | null, impersonating: boolean): boolean {
  return !impersonating && Boolean(actualEmail && displayedEmail
    && actualEmail.trim().toLowerCase() === displayedEmail.trim().toLowerCase());
}