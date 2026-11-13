/** Locked bridge copy for /onefeaturetraining-success. */
export const BRIDGE_TITLE = "We'll confirm the best path for you";

export const BRIDGE_BODY =
  "Our team will reach out shortly to confirm the best next step for your setup. No call required unless you want one.";

export const BRIDGE_MEANTIME =
  "In the meantime, log in to SaaSSuite — you'll land in your One Feature Kit so you can explore everything right away.";

export const SUB_VIA =
  "Our team will reach out to confirm the best path forward. Meanwhile your One Feature Kit is ready — open it in SaaSSuite below.";

export const SUB_OFT =
  "We've got your details. Our team will reach out to confirm the best path forward. Log in to SaaSSuite to open your One Feature Kit now.";

export const SUB_FALLBACK = "Your One Feature Kit and setup steps are below.";

export const GOOGLE_CTA = "Log in to open your One Feature Kit";

export const OPEN_KIT_CTA = "Open your One Feature Kit →";

export const NEXT_STEPS = [
  ["Our team reaches out.", "We'll confirm the best path forward for your setup."],
  ["Explore your kit in SaaSSuite.", "Log in anytime — you'll go straight to the One Feature Kit."],
  ["Launch when you're ready.", "Follow the setup training, or ask us to install it for you."],
] as const;

export const KIT_ROW_LABELS = [
  "100% Brandless AI Studio Sales Video",
  "20-minute setup training",
  "Menu Link Removal Snapshot",
  "High converting sales page",
  "1 ad creative template",
  "Your free SaaSSuite account",
] as const;

export function successSub(src: string, via: string): string {
  if (via === "google" || via === "email") return SUB_VIA;
  if (src === "oft5" || src === "oft4") return SUB_OFT;
  return SUB_FALLBACK;
}
