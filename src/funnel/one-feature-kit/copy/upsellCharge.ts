/**
 * PLACEHOLDER copy for the Launch Pack and Webinar one-click charge screens.
 * Landing Pages will replace this file. The charge sentence stays
 * "$X will be charged to your card immediately."
 */
import { formatUsdShort } from "../order";

export const UPSELL_CHARGE_COPY = {
  confirmLabel: "Confirm charge",
  confirm: "Confirm",
  cancel: "Cancel",
  charging: "Charging your card",
  adding: "Adding this to your kit",
  successLabel: "Added",
  successTitle: "You're in",
  continue: "Continue",
  errorLabel: "Charge failed",
  errorTitle: "Nothing was added",
  close: "Close",
} as const;

export function kitChargeConfirmCopy(cents: number): string {
  return `${formatUsdShort(cents)} will be charged to your card immediately.`;
}

export function kitChargeSuccessBody(name: string): string {
  return `${name} is in your kit.`;
}
