import { UPSELL_CHARGE_COPY, kitChargeSuccessBody } from "./copy/upsellCharge";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
}

function modal(label: string, html: string): HTMLElement {
  document.getElementById("ofk-overlay")?.remove();
  const root = document.createElement("div");
  root.className = "ofk ofk-modal-root";
  root.id = "ofk-overlay";
  root.innerHTML = `<div class="ofk-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}"><div class="ofk-modal-card">${html}</div></div>`;
  document.body.appendChild(root);
  return root;
}

export function closeKitOverlay() {
  document.getElementById("ofk-overlay")?.remove();
}

export function askKitChargeConfirm(message: string, name: string): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted: boolean) => {
      if (settled) return;
      settled = true;
      closeKitOverlay();
      resolve(accepted);
    };
    const copy = UPSELL_CHARGE_COPY;
    const root = modal(copy.confirmLabel, `<h2>${escapeHtml(name)}</h2><p class="ofk-charge-copy">${escapeHtml(message)}</p>
      <div class="ofk-choice"><button type="button" class="btn" data-act="confirm">${escapeHtml(copy.confirm)}</button><button type="button" class="btn dark" data-act="cancel">${escapeHtml(copy.cancel)}</button></div>`);
    root.addEventListener("click", (event) => {
      const act = (event.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act;
      if (act === "confirm") finish(true);
      if (act === "cancel") finish(false);
    });
  });
}

export function showKitChargeProgress(name: string, chargingCard: boolean) {
  const heading = chargingCard ? UPSELL_CHARGE_COPY.charging : UPSELL_CHARGE_COPY.adding;
  modal(heading, `<div class="ofk-spin" role="status"></div><h2>${heading}</h2><p>${escapeHtml(name)}</p>`);
}

export function showKitChargeSuccess(name: string): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      closeKitOverlay();
      resolve();
    };
    const copy = UPSELL_CHARGE_COPY;
    const root = modal(copy.successLabel, `<div class="ofk-check" aria-hidden="true"></div><h2>${escapeHtml(copy.successTitle)}</h2><p>${escapeHtml(kitChargeSuccessBody(name))}</p><button type="button" class="btn" data-act="continue">${escapeHtml(copy.continue)}</button>`);
    root.querySelector("[data-act='continue']")?.addEventListener("click", finish);
    window.setTimeout(finish, 1600);
  });
}

export function showKitChargeError(message: string): Promise<void> {
  return new Promise((resolve) => {
    const copy = UPSELL_CHARGE_COPY;
    const root = modal(copy.errorLabel, `<h2>${escapeHtml(copy.errorTitle)}</h2><p role="alert">${escapeHtml(message)}</p><button type="button" class="btn" data-act="close">${escapeHtml(copy.close)}</button>`);
    root.querySelector("[data-act='close']")?.addEventListener("click", () => {
      closeKitOverlay();
      resolve();
    });
  });
}
