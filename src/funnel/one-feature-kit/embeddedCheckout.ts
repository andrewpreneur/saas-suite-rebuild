import { CHECKOUT_COPY } from "./copy/checkout";

const LIVE_PK = "pk_live_51MjPyIGdZ9PRE3ZipiIrE9ZxAF9obgIObU1VX1MgwWuh3SpFaq0nTZH8VLPDzrs0N9JREHGq0hnyGm1Kpd20Ev1I00UQDvqjfC";

let stripeLoader: Promise<import("@stripe/stripe-js").Stripe | null> | null = null;

/** Load Stripe.js only when a checkout step asks for it. The sales page must not call this. */
export function preloadKitStripe() {
  if (!stripeLoader) {
    stripeLoader = import("@stripe/stripe-js").then(({ loadStripe }) => loadStripe(LIVE_PK)).catch(() => null);
  }
  return stripeLoader;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

type Embedded = { destroy: () => void; mount: (selector: string) => void };

let current: Embedded | null = null;
let stopWatching: (() => void) | null = null;
let restoreBody: (() => void) | null = null;

function clearCheckoutShell() {
  stopWatching?.();
  stopWatching = null;
  restoreBody?.();
  restoreBody = null;
  document.getElementById("ofk-checkout-modal")?.remove();
}

export function closeKitEmbeddedCheckout() {
  clearCheckoutShell();
  current?.destroy();
  current = null;
}

/** Close bar, confirm, and scroll lock. Stripe mounts into #ofk-embedded-checkout. */
export function mountKitCheckoutShell(): HTMLElement {
  clearCheckoutShell();
  const previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  restoreBody = () => {
    document.body.style.overflow = previousOverflow;
  };
  const root = document.createElement("div");
  root.className = "ofk ofk-modal-root";
  root.id = "ofk-checkout-modal";
  const copy = CHECKOUT_COPY;
  root.innerHTML = `<div class="ofk-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(copy.dialogLabel)}">
    <div class="ofk-modal-card ofk-checkout-card">
      <div class="ofk-modal-bar">
        <b>${escapeHtml(copy.dialogTitle)}</b>
        <button type="button" class="ofk-modal-x" id="ofk-checkout-close">${escapeHtml(copy.close)}</button>
        <div id="ofk-checkout-confirm" class="ofk-close-confirm" hidden>
          <p>${escapeHtml(copy.closeConfirm)}</p>
          <div class="ofk-choice">
            <button type="button" class="btn" id="ofk-checkout-stay">${escapeHtml(copy.keepCheckingOut)}</button>
            <button type="button" class="btn dark" id="ofk-checkout-confirm-close">${escapeHtml(copy.confirmClose)}</button>
          </div>
        </div>
      </div>
      <div id="ofk-embedded-checkout"></div>
    </div>
  </div>`;
  document.body.appendChild(root);
  let formStarted = false;
  const markStarted = () => {
    formStarted = true;
  };
  const onBlur = () => {
    const active = document.activeElement;
    if (active instanceof HTMLIFrameElement && root.contains(active)) markStarted();
  };
  window.addEventListener("blur", onBlur);
  const mountPoint = root.querySelector("#ofk-embedded-checkout");
  mountPoint?.addEventListener("pointerdown", markStarted);
  stopWatching = () => {
    window.removeEventListener("blur", onBlur);
    mountPoint?.removeEventListener("pointerdown", markStarted);
  };
  const requestClose = () => {
    if (!formStarted) {
      closeKitEmbeddedCheckout();
      return;
    }
    const confirm = root.querySelector<HTMLElement>("#ofk-checkout-confirm");
    if (confirm) confirm.hidden = false;
  };
  root.querySelector("#ofk-checkout-close")?.addEventListener("click", requestClose);
  root.querySelector("#ofk-checkout-stay")?.addEventListener("click", () => {
    const confirm = root.querySelector<HTMLElement>("#ofk-checkout-confirm");
    if (confirm) confirm.hidden = true;
  });
  root.querySelector("#ofk-checkout-confirm-close")?.addEventListener("click", () => closeKitEmbeddedCheckout());
  return root;
}

/** Card form on the checkout page. Stripe sends a paid buyer to the GHL step. */
export async function openKitEmbeddedCheckout(clientSecret: string) {
  closeKitEmbeddedCheckout();
  const stripe = await preloadKitStripe();
  if (!stripe) throw new Error("Secure checkout is unavailable. Please try again.");
  const checkout = await stripe.createEmbeddedCheckoutPage({ clientSecret });
  current = checkout;
  mountKitCheckoutShell();
  checkout.mount("#ofk-embedded-checkout");
}
