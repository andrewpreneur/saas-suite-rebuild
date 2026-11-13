/**
 * PLACEHOLDER copy for the GoHighLevel plan popup on
 * /one-feature-kit/ghl-signup-and-upgrade.
 * Landing Pages will replace this file. Signup and upgrade URLs live in
 * src/constants/ghlAffiliate.ts. The result screens reuse UpgradeDestination.
 */
export const GHL_POPUP_COPY = {
  buttonSmall: "Choose your plan, then continue",
  dialogLabel: "GoHighLevel plan",
  accountTitle: "Do you have a GHL account?",
  yes: "Yes",
  no: "No",
  later: "Sign up/Upgrade Later",
  planTitle: "What HighLevel plan are you on?",
  plan97: "$97 per month",
  plan297: "$297 per month",
  plan497: "$497 per month",
  back: "Back",
  destinationTitle: "Your HighLevel link",
  signupLabel: "Sign up for the $97 plan",
  signupCopyLabel: "Your $97 signup link",
  readyTitle: "You're all set",
  readyDetail: "Your HighLevel plan already covers this step. Continue with your kit.",
  readyAction: "Continue",
  save: "Save link (.txt)",
  copied: "Copied",
  saved: "Saved gohighlevel-link.txt",
  openedNote: "HighLevel is open in a new tab.",
  doneTitle: "Done signing up?",
  doneContinue: "Continue",
  saveFileName: "gohighlevel-link.txt",
} as const;

export function applyGhlCopy(root: ParentNode) {
  const small = root.querySelector("#ofk-ghl-small");
  if (small) small.textContent = GHL_POPUP_COPY.buttonSmall;
}
