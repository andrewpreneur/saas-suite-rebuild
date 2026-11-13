export const SUPPORT_SMS_NUMBER = "3372270501";
/** Public Text Us link. Digits belong in this href only, never in visible text. */
export const SUPPORT_SMS_HREF = "sms:+13372270501";

export function supportSmsUrl(message: string, phone = SUPPORT_SMS_NUMBER): string {
  const digits = (phone || "").replace(/\D/g, "");
  const target =
    !digits || digits === SUPPORT_SMS_NUMBER || digits === `1${SUPPORT_SMS_NUMBER}`
      ? "+13372270501"
      : digits;
  const href = `sms:${target}`;
  return message ? `${href}?body=${encodeURIComponent(message)}` : href;
}

/** True on phone browsers, where an sms: link opens the Messages app. */
export function canOpenSmsDirectly(
  userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "",
): boolean {
  return /Android|iPhone|iPad|iPod/i.test(userAgent);
}
