import type { GhlPlan } from "@/components/one-feature/shared";
import { GHL_AFFILIATE_SIGNUP_URL, GHL_UPGRADE_297_URL, GHL_UPGRADE_497_URL } from "@/constants/ghlAffiliate";
import { GHL_POPUP_COPY } from "./copy/ghl";

export type KitGhlResult =
  | { plan: "none"; signupUrl: string }
  | { plan: "97"; primaryUrl: string; secondaryUrl: string }
  | { plan: "297"; primaryUrl: string }
  | { plan: "497" };

/** Kit popup results. Upgrades use the Russell constants. One Feature pages do not. */
export function kitGhlResult(plan: GhlPlan): KitGhlResult {
  if (plan === "none") return { plan, signupUrl: GHL_AFFILIATE_SIGNUP_URL };
  if (plan === "97") return { plan, primaryUrl: GHL_UPGRADE_497_URL, secondaryUrl: GHL_UPGRADE_297_URL };
  if (plan === "297") return { plan, primaryUrl: GHL_UPGRADE_497_URL };
  return { plan: "497" };
}

/** Opens a HighLevel link beside the funnel. */
export function openKitGhlLink(url: string) {
  const opened = window.open(url, "_blank");
  if (opened) opened.opener = null;
}

/** Text file for this branch. The $497 plan has no HighLevel link to save. */
export function kitGhlSavedText(plan: GhlPlan, affiliateCode: string): string | null {
  const result = kitGhlResult(plan);
  if (result.plan === "none") return `${GHL_POPUP_COPY.signupCopyLabel}\n${result.signupUrl}\n`;
  if (result.plan === "97") {
    return [
      "Affiliate Upgrade Credit",
      result.primaryUrl,
      "",
      "Affiliate Code",
      affiliateCode,
      "",
      "Complete My Upgrade — $297 Plan",
      result.secondaryUrl,
      "",
    ].join("\n");
  }
  if (result.plan === "297") return `Affiliate Upgrade Credit\n${result.primaryUrl}\n`;
  return null;
}

export function downloadKitGhlFile(filename: string, text: string) {
  const file = new Blob([text], { type: "text/plain" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(file);
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(anchor.href);
}
