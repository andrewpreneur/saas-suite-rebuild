/**
 * PLACEHOLDER copy for the kit checkout screen and its embedded checkout modal.
 * Landing Pages will replace this file. Keep every visitor-facing string for
 * this screen here so the swap is one edit.
 */
export const CHECKOUT_COPY = {
  payTitle: "Card",
  payBody:
    "Complete my order opens secure checkout on this page. You confirm the charge there. Nothing is charged until you pay.",
  dialogLabel: "Secure checkout",
  dialogTitle: "Secure checkout",
  close: "Close",
  closeConfirm: "Close checkout? The card details you've started will be lost.",
  keepCheckingOut: "Keep checking out",
  confirmClose: "Close checkout",
} as const;

export function applyCheckoutCopy(root: ParentNode) {
  const title = root.querySelector("#ofk-pay b");
  const body = root.querySelector("#ofk-pay span");
  if (title) title.textContent = CHECKOUT_COPY.payTitle;
  if (body) body.textContent = CHECKOUT_COPY.payBody;
}
