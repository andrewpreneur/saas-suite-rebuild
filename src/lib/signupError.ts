export function signupErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code === '57014') return 'Account setup took too long. Please try again; if this continues, contact support.';
  if (error?.code === '23505') return 'This email is already registered. Please sign in or reset your password.';
  return 'We could not prepare your account. Please try again or contact support.';
}