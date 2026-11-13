import type { NavigateFunction } from "react-router-dom";
import { mountYouTubeFacade, unmountYouTubeFacades } from "@/components/media/YouTubeFacade";
import { TRAINING_YOUTUBE_ID } from "@/components/one-feature/videoId";
import { kitBuyerHasPassword, kitSignInHref } from "@/lib/kitDelivery";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { rewriteHref } from "./host";
import { kitDailyCapLine, kitLiveNotice, kitLiveNoticeShort } from "./scarcity";
import { requestKitOnboardingNotify, settleKitOnboardingNotify } from "./onboardingNotify";
import { maybeNotifyKitPurchase } from "./slack";
import { isKitPostPurchaseId, KIT_CATALOG, kitDiscountedCents } from "../../../supabase/functions/_shared/kit-catalog";
import { kitBumpLineChanges, kitStepForPath, settleKitEvent, trackKitEvent, trackKitEventForNavigation } from "./events";
import { KIT_PROMO_INVALID, chargeKitOffer, createKitCheckout, loadKitEntitlements, lookupKitPromotion } from "./payment";
import { thankYouCheckoutPurchase } from "./bootTiming";
import { trackKitCheckoutPurchase, trackKitCheckoutStarted, trackKitUpsellPurchase } from "./tracking";
import { closeKitEmbeddedCheckout, openKitEmbeddedCheckout, preloadKitStripe } from "./embeddedCheckout";
import { markKitCheckoutStart } from "./session";
import { applyCheckoutCopy } from "./copy/checkout";
import { applyGhlCopy } from "./copy/ghl";
import { THANK_YOU_COPY, applyThankYouCopy } from "./copy/thankYou";
import { applyThankYouAddons, draftWithVerifiedLines, thankYouPreviewLines, unlockThankYouAddon } from "./thankYouForm";
import { kitChargeConfirmCopy } from "./copy/upsellCharge";
import { openKitGhlPopup } from "./kitGhlBridge";
import { askKitChargeConfirm, closeKitOverlay, showKitChargeError, showKitChargeProgress, showKitChargeSuccess } from "./overlays";
import {
  FUNNEL_ROUTES,
  OFFERS,
  ONE_FEATURE_KIT_REVIEW_CHROME,
  ONE_FEATURE_KIT_PAYMENTS_LIVE,
  PAGE_OFFER,
  checkoutLines,
  completeCheckout,
  decide,
  formatUsd,
  formatUsdShort,
  kitBumpsForSelectAll,
  kitSelectAllOn,
  loadDraft,
  orderTotalCents,
  saveDraft,
  type KitBumps,
  type KitDraft,
} from "./order";

/** The email on the paid checkout. The thank-you field is only a fallback before that draft exists. */
function kitPurchaseEmail(root: HTMLElement): string {
  const draft = loadDraft();
  const purchased = (draft.contact.email || draft.lead.email || "").trim().toLowerCase();
  if (purchased.includes("@")) return purchased;
  return (root.querySelector<HTMLInputElement>("#ofk-ty-email")?.value ?? "").trim().toLowerCase();
}

/** Signup when the email is new. Login when that email already has a password. */
function openKitAccount(email: string) {
  const clean = email.trim().toLowerCase();
  const go = (hasPassword: boolean) => window.location.assign(kitSignInHref(clean, hasPassword));
  if (!clean.includes("@")) {
    go(false);
    return;
  }
  void Promise.resolve(supabase.rpc("get_user_auth_status_by_email", { user_email: clean }))
    .then(({ data: authStatus, error }) => {
      go(kitBuyerHasPassword(authStatus, error));
    })
    .catch(() => go(false));
}

function showNote(button: HTMLElement, className: string, message: string) {
  const parent = button.parentElement;
  if (!parent) return;
  parent.querySelectorAll(".ofk-error, .ofk-ok").forEach((node) => node.remove());
  const note = document.createElement("p");
  note.className = className;
  note.textContent = message;
  button.before(note);
}

/** Permission is checked before any table-name mention, so a 42501 is not logged as a missing table. */
export function onboardingInsertKind(
  code: string | undefined,
  message: string | undefined,
): "permission" | "missing-table" | "other" {
  const text = message ?? "";
  if (code === "42501" || /permission denied|row-level security/i.test(text)) return "permission";
  if (code === "42P01" || code === "PGRST205" || /schema cache/i.test(text)) return "missing-table";
  return "other";
}

function fieldLabel(el: Element): string {
  const label = el.closest(".field")?.querySelector("label");
  if (!label) return "field";
  const clone = label.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("span").forEach((span) => span.remove());
  return clone.textContent?.replace(/\s+/g, " ").trim() || "field";
}

function readFields(root: ParentNode): Record<string, string> {
  const data: Record<string, string> = {};
  root.querySelectorAll("input, select, textarea").forEach((el) => {
    if (el.closest("[hidden], [data-ofk-state='locked'], [data-ofk-state='pending']")) return;
    const label = fieldLabel(el);
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      data[label] = el.checked ? "yes" : "no";
      return;
    }
    const value = (el as HTMLInputElement).value.trim();
    if (!value || value === "Choose one") return;
    data[label] = value;
  });
  return data;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch
  ));
}

type StoredPromo = { code: string; percentOff: number | null; amountOff: number | null };

function storedPromo(root: HTMLElement): StoredPromo | null {
  const raw = root.dataset.ofkPromo;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPromo>;
    if (typeof parsed.code !== "string" || !parsed.code) return null;
    return {
      code: parsed.code,
      percentOff: typeof parsed.percentOff === "number" ? parsed.percentOff : null,
      amountOff: typeof parsed.amountOff === "number" ? parsed.amountOff : null,
    };
  } catch {
    return null;
  }
}

/** The quote applies only while the box still contains the code that was checked. */
function activePromo(root: HTMLElement): StoredPromo | null {
  const stored = storedPromo(root);
  const typed = root.querySelector<HTMLInputElement>("#ofk-promo")?.value.trim() ?? "";
  if (!stored || stored.code.toLowerCase() !== typed.toLowerCase()) return null;
  return stored;
}

function renderSummary(root: HTMLElement, bumps: KitDraft["bumps"]) {
  const lines = checkoutLines(bumps);
  const total = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const promo = activePromo(root);
  const due = kitDiscountedCents(total, promo);
  const side = root.querySelector("#ofk-side-total");
  if (side) side.textContent = formatUsd(due);
  const table = root.querySelector<HTMLTableElement>("#ofk-summary");
  if (!table) return;
  const discount = promo && due !== total
    ? `<tr><td>Promo ${escapeHtml(promo.code)}</td><td></td><td>−${formatUsd(total - due)}</td></tr>`
    : "";
  table.innerHTML = `<tr><th>Item</th><th>Qty</th><th>Amount</th></tr>${lines
    .map(
      (line) => `<tr><td>${line.label}</td><td>1</td><td>${formatUsd(line.amountCents)}</td></tr>`,
    )
    .join("")}${discount}<tr class="tot"><td>Order total</td><td></td><td>${formatUsd(due)}</td></tr>`;
  const small = root.querySelector("#ofk-complete small");
  if (small) small.textContent = `${formatUsdShort(due)} today · instant access`;
}

const BUMP_KEYS = ["replay", "video", "install"] as const;

function bumpState(root: HTMLElement): KitBumps {
  return {
    replay: Boolean(root.querySelector("#ofk-bump-replay.is-on")),
    video: Boolean(root.querySelector("#ofk-bump-video.is-on")),
    install: Boolean(root.querySelector("#ofk-bump-install.is-on")),
  };
}

function applyBumps(root: HTMLElement, bumps: KitBumps) {
  for (const key of BUMP_KEYS) {
    const bump = root.querySelector<HTMLElement>(`#ofk-bump-${key}`);
    bump?.classList.toggle("is-on", bumps[key]);
    bump?.querySelector(".head")?.setAttribute("aria-checked", bumps[key] ? "true" : "false");
    root.querySelector(`#ofk-side-${key}`)?.classList.toggle("is-on", bumps[key]);
  }
  const allOn = kitSelectAllOn(bumps);
  root.querySelectorAll<HTMLInputElement>("[data-ofk-select-all]").forEach((input) => {
    input.checked = allOn;
  });
  renderSummary(root, bumps);
}

function receiptText(draft: KitDraft): string {
  if (!draft.checkoutId) {
    return "No checkout in this browser yet. Start at the sales page to click the path. Nothing is charged.";
  }
  const items = draft.lines
    .map((line) =>
      line.kind === "trial"
        ? `${line.label} ($0 today, then $49/mo)`
        : `${line.label} (${formatUsd(line.amountCents)})`,
    )
    .join(" · ");
  const declined = Object.entries(draft.decisions)
    .filter(([, choice]) => choice === "declined")
    .map(([id]) => id);
  return `Review order ${draft.checkoutId} (not charged). Today ${formatUsd(orderTotalCents(draft))}. ${items}.${
    declined.length ? ` Declined: ${declined.join(", ")}.` : ""
  }`;
}

function rewriteLinks(root: HTMLElement) {
  const host = window.location.hostname;
  root.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    const next = rewriteHref(href, host);
    if (next === href) return;
    link.setAttribute("href", next);
    if (next.startsWith("http")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noreferrer");
    }
  });
}

const STICKY_PAGES = new Set<string>([
  FUNNEL_ROUTES.sales,
  FUNNEL_ROUTES.launch,
  FUNNEL_ROUTES.webinar,
]);

type LiveHost = Window & { __ofkLiveTimer?: number };

function paintLiveNotice(root: HTMLElement, now = new Date()) {
  const full = root.querySelector(".ofk-live-full");
  if (full) full.textContent = ` ${kitLiveNotice(now).replace(/^LIVE:\s*/, "")}`;
  const short = root.querySelector(".ofk-live-short");
  if (short) short.textContent = ` ${kitLiveNoticeShort(now).replace(/^LIVE:\s*/, "")}`;
  const line = kitDailyCapLine(now);
  root.querySelectorAll(".ofk-daily-cap").forEach((el) => {
    el.textContent = line;
  });
}

/** Keep the checkout summary below the measured LIVE bar, using the real viewport. */
function fitCheckoutSummary(root: HTMLElement) {
  const bar = root.querySelector(".ofk-live");
  const height = bar ? Math.ceil(bar.getBoundingClientRect().height) : 0;
  document.documentElement.style.setProperty("--ofk-live-h", `${height}px`);
}

function mountLiveNotice(root: HTMLElement, pathname: string) {
  if (pathname === FUNNEL_ROUTES.thanks) {
    root.querySelector(".ofk-live")?.remove();
    return;
  }
  // Keep a prerendered bar so the hero does not jump when the page hydrates.
  let bar = root.querySelector<HTMLElement>(".ofk-live");
  if (!bar) {
    bar = document.createElement("div");
    bar.className = "ofk-live";
    bar.setAttribute("role", "status");
    const dot = document.createElement("span");
    dot.className = "ofk-live-dot";
    dot.setAttribute("aria-hidden", "true");
    const label = document.createElement("b");
    label.textContent = "LIVE:";
    const full = document.createElement("span");
    full.className = "ofk-live-full";
    const short = document.createElement("span");
    short.className = "ofk-live-short";
    bar.append(dot, label, full, short);
    root.prepend(bar);
  }
  const tick = () => paintLiveNotice(root);
  tick();
  const host = window as LiveHost;
  if (!host.__ofkLiveTimer) host.__ofkLiveTimer = window.setInterval(tick, 60_000);
}

type StickyHost = Window & {
  __ofkStickyFit?: () => void;
  __ofkStickyWatch?: IntersectionObserver;
  __ofkSummaryFit?: () => void;
};

/** Drop sticky-bar padding, the live-cap timer, and the cookie offset from the previous step. */
export function releaseFunnelPage() {
  document.querySelector(".ofk.ofk-has-sticky")?.classList.remove("ofk-has-sticky");
  document.documentElement.style.removeProperty("--ofk-sticky-h");
  document.documentElement.style.removeProperty("--ofk-live-h");
  const host = window as StickyHost;
  if (host.__ofkStickyFit) {
    window.removeEventListener("resize", host.__ofkStickyFit);
    delete host.__ofkStickyFit;
  }
  host.__ofkStickyWatch?.disconnect();
  delete host.__ofkStickyWatch;
  if (host.__ofkSummaryFit) {
    window.removeEventListener("resize", host.__ofkSummaryFit);
    delete host.__ofkSummaryFit;
  }
  const live = window as LiveHost;
  if (live.__ofkLiveTimer) {
    window.clearInterval(live.__ofkLiveTimer);
    delete live.__ofkLiveTimer;
  }
  closeKitEmbeddedCheckout();
  closeKitOverlay();
  unmountYouTubeFacades();
}

/** Get the Kit clicks record where the button sat. Other steps keep a stable location too. */
function kitCtaLocation(link: HTMLElement, step: string): string {
  if (link.closest(".ofk-sticky-cta")) return "sticky";
  if (step === "sales") {
    if (link.closest(".hero")) return "hero";
    const heading = link.closest("section")?.querySelector("h2")?.textContent ?? "";
    if (heading.includes("Frequently")) return "faq";
    if (heading.includes("Everything in the")) return "mid";
    if ((link.closest(".buybox")?.textContent ?? "").includes("EVERYTHING YOU GET")) return "final";
    return "other";
  }
  if (link.id === "ofk-ghl-yes") return "ghl_yes";
  return "primary";
}

/** First contact-field interaction, or the contact submit if they never focused a field. Once per session. */
function ensureCheckoutStart() {
  if (!markKitCheckoutStart()) return;
  void trackKitEvent("checkout_start", { step: "checkout" });
}

/** In-memory only. A data attribute would be saved in the prerendered HTML and then skipped on the real visit. */
const listenersBound = new WeakSet<EventTarget>();

function bindOnce(node: EventTarget): boolean {
  if (listenersBound.has(node)) return false;
  listenersBound.add(node);
  return true;
}

function bindCheckoutStart(root: HTMLElement) {
  const onField = () => ensureCheckoutStart();
  for (const id of ["ofk-name", "ofk-email", "ofk-phone"]) {
    const field = root.querySelector<HTMLInputElement>(`#${id}`);
    if (!field || !bindOnce(field)) continue;
    field.addEventListener("focus", onField);
    field.addEventListener("input", onField);
  }
}

function mountStickyCta(root: HTMLElement, pathname: string) {
  const shell = root.parentElement;
  if (!STICKY_PAGES.has(pathname)) {
    root.querySelector(".ofk-sticky-cta")?.remove();
    shell?.classList.remove("ofk-has-sticky");
    document.documentElement.style.removeProperty("--ofk-sticky-h");
    return;
  }
  let bar = root.querySelector<HTMLElement>(".ofk-sticky-cta");
  const source = [...root.querySelectorAll("a.btn")].find(
    (link) => /\$\d+/.test(link.textContent ?? "") && !link.closest(".ofk-sticky-cta"),
  );
  if (!bar) {
    if (!source) return;
    bar = document.createElement("div");
    bar.className = "ofk-sticky-cta";
    bar.hidden = true;
    const link = source.cloneNode(true) as HTMLAnchorElement;
    link.classList.remove("inline");
    link.querySelector("small")?.remove();
    bar.appendChild(link);
    root.appendChild(bar);
  }
  if (!bar || !source) return;
  const fit = () => {
    if (bar.hidden) return;
    const height = Math.ceil(bar.getBoundingClientRect().height);
    document.documentElement.style.setProperty("--ofk-sticky-h", `${height}px`);
  };
  const show = (visible: boolean) => {
    bar.hidden = !visible;
    shell?.classList.toggle("ofk-has-sticky", visible);
    if (visible) fit();
    else document.documentElement.style.removeProperty("--ofk-sticky-h");
  };
  // The snapshot may already be showing the bar. Restore its padding in this turn,
  // before the browser paints, so releaseFunnelPage's class strip does not shift the page.
  if (!bar.hidden) {
    shell?.classList.add("ofk-has-sticky");
    fit();
  }
  const host = window as StickyHost;
  const watch = new IntersectionObserver(([entry]) => {
    show(entry ? !entry.isIntersecting : false);
  });
  watch.observe(source);
  host.__ofkStickyWatch = watch;
  host.__ofkStickyFit = fit;
  window.addEventListener("resize", fit);
}

/** Prefill the stub order, embed the sales VSL only, and mark conditional sections. */
export function enhancePage(root: HTMLElement, pathname: string) {
  releaseFunnelPage();
  rewriteLinks(root);
  mountLiveNotice(root, pathname);
  const summaryFit = () => fitCheckoutSummary(root);
  summaryFit();
  (window as StickyHost).__ofkSummaryFit = summaryFit;
  window.addEventListener("resize", summaryFit);
  mountStickyCta(root, pathname);
  if (pathname === FUNNEL_ROUTES.sales) {
    root.querySelectorAll<HTMLElement>(".video").forEach((el) => {
      const prerendered = el.classList.contains("ofk-yt") && !!el.querySelector("button.ofk-facade");
      if (!prerendered && !el.textContent?.includes("sales video (VSL)")) return;
      // Hero video. eager so a later above-the-fold placement can be the LCP image.
      // A prerendered button stays in the DOM; mountYouTubeFacade only adds the click.
      mountYouTubeFacade(el, {
        videoId: TRAINING_YOUTUBE_ID,
        title: "GoHighLevel One Feature training",
        eager: true,
        fetchPriority: "high",
      });
    });
  }

  const draft = loadDraft();

  if (pathname === FUNNEL_ROUTES.sales) {
    const name = root.querySelector<HTMLInputElement>("#ofk-name");
    const email = root.querySelector<HTMLInputElement>("#ofk-email");
    if (name && !name.value) name.value = draft.lead.firstName;
    if (email && !email.value) email.value = draft.lead.email;
  }

  if (pathname === FUNNEL_ROUTES.checkout) {
    preloadKitStripe();
    bindCheckoutStart(root);
    const name = root.querySelector<HTMLInputElement>("#ofk-name");
    const email = root.querySelector<HTMLInputElement>("#ofk-email");
    const phone = root.querySelector<HTMLInputElement>("#ofk-phone");
    if (name && !name.value) name.value = draft.contact.firstName || draft.lead.firstName;
    if (email && !email.value) email.value = draft.contact.email || draft.lead.email;
    if (phone && !phone.value) phone.value = draft.contact.phone;
    applyBumps(root, draft.bumps);
    const promoInput = root.querySelector<HTMLInputElement>("#ofk-promo");
    if (promoInput && bindOnce(promoInput)) {
      promoInput.addEventListener("input", () => renderSummary(root, bumpState(root)));
    }
    root.querySelectorAll<HTMLInputElement>("[data-ofk-select-all]").forEach((selectAll) => {
      if (!bindOnce(selectAll)) return;
      selectAll.addEventListener("change", () => {
        const before = bumpState(root);
        const bumps = kitBumpsForSelectAll(selectAll.checked);
        applyBumps(root, bumps);
        saveDraft({ ...loadDraft(), bumps });
        for (const change of kitBumpLineChanges(before, bumps)) {
          void trackKitEvent(change.event, { step: "checkout", line_id: change.line_id });
        }
      });
    });
    root.querySelectorAll<HTMLElement>(".bump .head").forEach((head) => {
      head.setAttribute("role", "checkbox");
      head.tabIndex = 0;
      if (!bindOnce(head)) return;
      head.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          head.click();
        }
      });
    });
    applyCheckoutCopy(root);
    const pay = root.querySelector("#ofk-pay");
    if (ONE_FEATURE_KIT_REVIEW_CHROME && pay && !root.querySelector("#ofk-pay-note")) {
      const note = document.createElement("div");
      note.id = "ofk-pay-note";
      note.className = "note ofk-review";
      note.innerHTML =
        "<b>Review build:</b> Complete my order does not charge a card. Stripe is not called. The order stays in this browser so the rest of the funnel can be clicked through.";
      pay.after(note);
    }
  }

  if (pathname === FUNNEL_ROUTES.ghl) applyGhlCopy(root);

  if (pathname === FUNNEL_ROUTES.thanks) {
    const purchase = thankYouCheckoutPurchase(draft);
    if (purchase) trackKitCheckoutPurchase(purchase);
    applyThankYouCopy(root);
    const name = root.querySelector<HTMLInputElement>("#ofk-ty-name");
    const email = root.querySelector<HTMLInputElement>("#ofk-ty-email");
    const phone = root.querySelector<HTMLInputElement>("#ofk-ty-phone");
    if (name && !name.value) name.value = draft.contact.firstName || draft.lead.firstName;
    if (email && !email.value) email.value = draft.contact.email || draft.lead.email;
    if (phone && !phone.value) phone.value = draft.contact.phone;
    const openKit = root.querySelector<HTMLAnchorElement>("#ofk-open-kit");
    if (openKit) openKit.href = kitSignInHref(kitPurchaseEmail(root), false);
    const status = root.querySelector<HTMLElement>("#ofk-order-status");
    const submit = root.querySelector<HTMLButtonElement>("#ofk-onboard-submit");
    const showStatus = (message: string) => {
      if (!status) return;
      status.hidden = false;
      status.textContent = message;
    };
    const paintOwned = (owned: readonly string[] | null) => {
      if (!root.isConnected) return;
      applyThankYouAddons(root, owned);
      if (submit) {
        submit.disabled = false;
        delete submit.dataset.pending;
      }
      if (status) status.hidden = true;
    };
    const preview = thankYouPreviewLines(window.location.search, import.meta.env.DEV === true);
    if (preview) {
      paintOwned(preview);
    } else if (draft.checkoutId?.startsWith("cs_live_")) {
      if (submit) {
        submit.disabled = true;
        submit.dataset.pending = "1";
      }
      showStatus("Checking your order…");
      void loadKitEntitlements(draft.checkoutId).then((entitlements) => {
        if (!root.isConnected || loadDraft().checkoutId !== draft.checkoutId) return;
        const next = draftWithVerifiedLines(loadDraft(), entitlements.lineIds);
        saveDraft({
          ...next,
          customerId: entitlements.customerId ?? next.customerId,
          paymentMethodId: entitlements.paymentMethodId,
        });
        paintOwned(entitlements.lineIds);
        const note = root.querySelector("#ofk-receipt");
        if (note) note.innerHTML = `<b>This browser only.</b> ${receiptText(next)}`;
      }).catch(() => {
        if (!root.isConnected) return;
        if (submit) {
          submit.disabled = false;
          delete submit.dataset.pending;
        }
        showStatus("We couldn't confirm this order in this browser. Refresh the page where you checked out.");
      });
    } else {
      paintOwned(null);
    }
    if (draft.checkoutId && !draft.slackPing) {
      void maybeNotifyKitPurchase(draft).then(next => {
        if (!root.isConnected || loadDraft().checkoutId !== draft.checkoutId) return;
        saveDraft({ ...loadDraft(), slackPing: next.slackPing });
      }).catch(() => console.warn("Kit notification will retry server-side"));
    }
    const heading = [...root.querySelectorAll("h3")].find((node) =>
      node.textContent?.includes("Where to find what you bought"),
    );
    const card = heading?.closest(".card");
    if (card && !card.querySelector("#ofk-receipt")) {
      const note = document.createElement("div");
      note.id = "ofk-receipt";
      note.className = "note ofk-review";
      note.innerHTML = `<b>This browser only.</b> ${receiptText(draft)}`;
      heading?.after(note);
    }
  }
  flushQueuedFunnelInput();
}

type QueuedWindow = Window & {
  __ofkReady?: boolean;
  __ofkClicks?: HTMLElement[];
  __ofkFocus?: string;
};

/** Clicks and field focus that landed before this module finished are replayed once. */
function flushQueuedFunnelInput() {
  const host = window as QueuedWindow;
  host.__ofkReady = true;
  const focusId = host.__ofkFocus;
  if (focusId) document.getElementById(focusId)?.dispatchEvent(new FocusEvent("focus"));
  const clicks = host.__ofkClicks ?? [];
  host.__ofkClicks = [];
  for (const el of clicks) {
    if (el.isConnected) el.click();
  }
}

export function handleFunnelClick(
  root: HTMLElement,
  pathname: string,
  event: React.MouseEvent<HTMLElement>,
  navigate: NavigateFunction,
) {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  const addButton = target.closest<HTMLButtonElement>("[data-ofk-add]");
  if (addButton) {
    event.preventDefault();
    const offerId = addButton.dataset.ofkAdd ?? "";
    if (!isKitPostPurchaseId(offerId)) return;
    if (addButton.dataset.saving === "1" || root.dataset.charging === "1") return;
    if (thankYouPreviewLines(window.location.search, import.meta.env.DEV === true)) {
      unlockThankYouAddon(root, offerId);
      showNote(addButton, "ofk-ok", "Preview only. No card was charged.");
      return;
    }
    const item = KIT_CATALOG[offerId];
    void (async () => {
      const comped = !loadDraft().paymentMethodId;
      if (!comped) {
        const accepted = await askKitChargeConfirm(kitChargeConfirmCopy(item.amount), item.label);
        if (!accepted || !addButton.isConnected) return;
      }
      if (root.dataset.charging === "1" || !addButton.isConnected) return;
      root.dataset.charging = "1";
      addButton.dataset.saving = "1";
      addButton.setAttribute("aria-busy", "true");
      showKitChargeProgress(item.label, !comped);
      try {
        const charge = await chargeKitOffer(loadDraft(), offerId);
        if (!charge.alreadyOwned) {
          trackKitUpsellPurchase({
            paymentIntentId: charge.paymentIntentId ?? "",
            offerId,
            amountCents: item.amount,
            contentName: item.label,
            comped: charge.comped,
          });
          void trackKitEvent("upsell_accept", {
            step: "thanks",
            line_id: offerId,
            amount_cents: item.amount,
            checkout_session_id: loadDraft().checkoutId,
          });
        }
        if (!addButton.isConnected) return;
        const current = loadDraft();
        const ids = current.lines.map((line) => line.id);
        const nextIds = ids.includes(offerId) ? ids : [...ids, offerId];
        if (!nextIds.includes("kit")) nextIds.unshift("kit");
        saveDraft(draftWithVerifiedLines(current, nextIds));
        unlockThankYouAddon(root, offerId);
        await showKitChargeSuccess(item.label);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Your card wasn't charged. Nothing was added.";
        if (addButton.isConnected) showNote(addButton, "ofk-error", message);
        await showKitChargeError(message);
      } finally {
        delete root.dataset.charging;
        addButton.dataset.saving = "";
        addButton.removeAttribute("aria-busy");
      }
    })();
    return;
  }

  if (target.closest("#ofk-promo-apply")) {
    event.preventDefault();
    const code = root.querySelector<HTMLInputElement>("#ofk-promo")?.value.trim() ?? "";
    const button = root.querySelector<HTMLElement>("#ofk-promo-apply");
    if (!button || button.dataset.saving === "1") return;
    if (!code) {
      showNote(button, "ofk-error", "Enter a code.");
      return;
    }
    button.dataset.saving = "1";
    button.setAttribute("aria-busy", "true");
    void lookupKitPromotion(code).then((quote) => {
      if (!button.isConnected) return;
      root.dataset.ofkPromo = JSON.stringify({ code, percentOff: quote.percentOff, amountOff: quote.amountOff });
      renderSummary(root, bumpState(root));
      showNote(button, "ofk-ok", "Code applied.");
    }).catch(error => {
      if (button.isConnected) showNote(button, "ofk-error", error instanceof Error ? error.message : KIT_PROMO_INVALID);
    }).finally(() => {
      button.dataset.saving = "";
      button.removeAttribute("aria-busy");
    });
    return;
  }

  const bumpHead = target.closest(".bump .head");
  const bump = bumpHead?.closest<HTMLElement>("[data-bump]");
  if (bumpHead && bump) {
    event.preventDefault();
    const before = bumpState(root);
    bump.classList.toggle("is-on");
    const bumps = bumpState(root);
    applyBumps(root, bumps);
    saveDraft({ ...loadDraft(), bumps });
    for (const change of kitBumpLineChanges(before, bumps)) {
      void trackKitEvent(change.event, { step: "checkout", line_id: change.line_id });
    }
    return;
  }

  if (target.closest("[data-ofk-complete-proxy]")) {
    event.preventDefault();
    root.querySelector<HTMLElement>("#ofk-complete")?.click();
    root.querySelector(".ofk-error")?.scrollIntoView({ block: "center" });
    return;
  }

  if (target.closest("#ofk-complete")) {
    event.preventDefault();
    const button = root.querySelector<HTMLElement>("#ofk-complete");
    const contact = {
      firstName: root.querySelector<HTMLInputElement>("#ofk-name")?.value.trim() ?? "",
      email: root.querySelector<HTMLInputElement>("#ofk-email")?.value.trim().toLowerCase() ?? "",
      phone: root.querySelector<HTMLInputElement>("#ofk-phone")?.value.trim() ?? "",
    };
    if (!button) return;
    if (!contact.firstName || !contact.email.includes("@") || contact.phone.length < 7) {
      showNote(
        button,
        "ofk-error",
        "Enter your first name, a valid email, and a phone number. Nothing is charged.",
      );
      return;
    }
    if (!ONE_FEATURE_KIT_PAYMENTS_LIVE) {
      ensureCheckoutStart();
      saveDraft(completeCheckout(loadDraft(), contact, bumpState(root)));
      void trackKitEventForNavigation("cta_click", {
        step: "checkout",
        line_id: "kit",
        properties: { cta_location: "checkout_submit" },
      }).then(() => {
        navigate(FUNNEL_ROUTES.ghl);
      });
      return;
    }
    if (button.dataset.saving === "1") return;
    button.dataset.saving = "1";
    button.setAttribute("aria-busy", "true");
    const bumps = bumpState(root);
    const promotionCode = root.querySelector<HTMLInputElement>("#ofk-promo")?.value.trim() ?? "";
    ensureCheckoutStart();
    saveDraft({ ...loadDraft(), contact, bumps, checkoutId: null, lines: [], decisions: {}, slackPing: null });
    void trackKitEvent("cta_click", {
      step: "checkout",
      line_id: "kit",
      properties: { cta_location: "checkout_submit" },
    });
    void createKitCheckout(contact, bumps, promotionCode).then(created => {
      const clientSecret = created.clientSecret;
      trackKitCheckoutStarted({
        bumps,
        sessionId: created.sessionId,
        leadEventId: created.leadEventId,
        initiateCheckoutEventId: created.initiateCheckoutEventId,
      });
      if (button.isConnected) return openKitEmbeddedCheckout(clientSecret);
    }).catch(error => {
      if (!button.isConnected) return;
      const message = error instanceof Error ? error.message : "Checkout couldn't open. Please try again.";
      const promoButton = root.querySelector<HTMLElement>("#ofk-promo-apply");
      // Stay on this page. A bad code is shown on the promo row before any Stripe redirect.
      showNote(message === KIT_PROMO_INVALID && promoButton ? promoButton : button, "ofk-error", message);
    }).finally(() => {
      button.dataset.saving = "";
      button.removeAttribute("aria-busy");
    });
    return;
  }

  if (target.closest("#ofk-copy-team")) {
    event.preventDefault();
    const button = target.closest<HTMLButtonElement>("#ofk-copy-team");
    const email = THANK_YOU_COPY.teamEmail;
    void navigator.clipboard?.writeText(email).then(() => {
      if (button?.isConnected) button.textContent = THANK_YOU_COPY.copied;
    }).catch(() => {
      if (button?.isConnected) button.textContent = email;
    });
    return;
  }

  if (target.closest("#ofk-onboard-submit")) {
    event.preventDefault();
    const button = root.querySelector<HTMLElement>("#ofk-onboard-submit");
    const card = root.querySelector("#ofk-onboard");
    if (!button || !card || button.dataset.pending === "1") return;
    const name = card.querySelector<HTMLInputElement>("#ofk-ty-name")?.value.trim() ?? "";
    const email = card.querySelector<HTMLInputElement>("#ofk-ty-email")?.value.trim().toLowerCase() ?? "";
    if (!name || !email.includes("@")) {
      showNote(button, "ofk-error", "Enter the first name and email you bought with.");
      return;
    }
    if (button.dataset.saving === "1") return;
    button.dataset.saving = "1";
    card.querySelectorAll(".ofk-error, .ofk-ok").forEach((node) => node.remove());
    if (!button.dataset.label) button.dataset.label = button.innerHTML;
    button.textContent = "Saving…";
    button.setAttribute("disabled", "true");
    button.setAttribute("aria-busy", "true");
    const draft = loadDraft();
    const answers = readFields(card);
    const phone = card.querySelector<HTMLInputElement>("#ofk-ty-phone")?.value.trim() ?? "";
    const rowId = crypto.randomUUID();
    void supabase
      .from("funnel_onboarding")
      .insert({
        id: rowId,
        checkout_id: draft.checkoutId,
        first_name: name,
        email,
        phone,
        order_lines: draft.lines as unknown as Json,
        answers: answers as Json,
        source: "one-feature-kit",
      })
      .then(async ({ error }) => {
        if (error) {
          button.dataset.saving = "";
          button.innerHTML = button.dataset.label ?? "Send my onboarding form →";
          button.removeAttribute("disabled");
          button.removeAttribute("aria-busy");
          const kind = onboardingInsertKind(error.code, error.message);
          console.error(`funnel onboarding insert failed: ${kind}`, { code: error.code });
          showNote(
            button,
            "ofk-error",
            "We couldn't save your answers. Please try again. Your form is still here.",
          );
          return;
        }
        saveDraft({
          ...draft,
          onboarding: answers,
          contact: { ...draft.contact, firstName: name, email, phone: phone || draft.contact.phone },
        });
        showNote(button, "ofk-ok", "Saved. Create your password and log in to SaaSSuite.");
        button.hidden = true;
        button.removeAttribute("aria-busy");
        if (!card.querySelector("#ofk-login")) {
          const link = document.createElement("a");
          link.id = "ofk-login";
          link.className = "btn mt16";
          link.href = kitSignInHref(email, false);
          link.textContent = "Set Your PW and Login";
          button.after(link);
        }
        try {
          await settleKitOnboardingNotify(requestKitOnboardingNotify(rowId, email));
        } catch {
          // A failed or slow notify still continues to the password page.
        }
        openKitAccount(email);
      });
    return;
  }

  if (target.closest("#ofk-build-submit")) {
    event.preventDefault();
    const button = root.querySelector<HTMLElement>("#ofk-build-submit");
    const card = root.querySelector("#ofk-build");
    if (!button || !card) return;
    const description = card.querySelector("textarea")?.value.trim() ?? "";
    if (!description) {
      showNote(button, "ofk-error", "Describe the project. This request is not emailed.");
      return;
    }
    saveDraft({ ...loadDraft(), buildRequest: readFields(card) });
    showNote(
      button,
      "ofk-ok",
      "Saved in this browser only. No email was sent and no quote was requested.",
    );
    return;
  }

  const link = target.closest("a");
  if (!link) return;
  const href = link.getAttribute("href");
  if (link.id === "ofk-open-kit" || link.id === "ofk-login" || href === "#kit") {
    event.preventDefault();
    openKitAccount(kitPurchaseEmail(root));
    return;
  }
  if (link.id === "ofk-ghl-yes") {
    event.preventDefault();
    const step = kitStepForPath(pathname);
    if (step) void trackKitEvent("cta_click", { step, properties: { cta_location: "ghl_yes" } });
    openKitGhlPopup();
    return;
  }
  if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("sms:"))
    return;
  event.preventDefault();

  const step = kitStepForPath(pathname);
  const isCta = link.classList.contains("btn");
  const isDecline = link.classList.contains("nothanks");
  const go = () => {
    if (href.startsWith("/")) navigate(href);
  };

  if (pathname === FUNNEL_ROUTES.sales && isCta) {
    const draft = loadDraft();
    saveDraft({
      ...draft,
      lead: {
        firstName: root.querySelector<HTMLInputElement>("#ofk-name")?.value.trim() ?? "",
        email: root.querySelector<HTMLInputElement>("#ofk-email")?.value.trim() ?? "",
      },
    });
  }

  const offerId = PAGE_OFFER[pathname];
  if (offerId && (isCta || isDecline)) {
    if (root.dataset.charging === "1") return;
    if (ONE_FEATURE_KIT_PAYMENTS_LIVE && !isDecline) {
      if (step) void trackKitEvent("cta_click", { step, line_id: offerId, properties: { cta_location: kitCtaLocation(link, step) } });
      const offer = OFFERS[offerId];
      const comped = !loadDraft().paymentMethodId;
      void (async () => {
        if (!comped) {
          const accepted = await askKitChargeConfirm(kitChargeConfirmCopy(offer.amountCents), offer.label);
          if (!accepted || !link.isConnected) return;
        }
        if (root.dataset.charging === "1") return;
        root.dataset.charging = "1";
        link.setAttribute("aria-busy", "true");
        showKitChargeProgress(offer.label, !comped);
        try {
          const charge = await chargeKitOffer(loadDraft(), offerId);
          trackKitUpsellPurchase({
            paymentIntentId: charge.paymentIntentId ?? "",
            offerId,
            amountCents: offer.amountCents,
            contentName: offer.label,
            comped: charge.comped,
          });
          const tracked = step
            ? trackKitEvent("upsell_accept", {
              step,
              line_id: offerId,
              amount_cents: offer.amountCents,
              checkout_session_id: loadDraft().checkoutId,
            })
            : Promise.resolve();
          if (!link.isConnected) {
            await settleKitEvent(tracked);
            return;
          }
          saveDraft(decide(loadDraft(), offerId, "accepted"));
          await showKitChargeSuccess(offer.label);
          await settleKitEvent(tracked);
          go();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Your card wasn't charged. Nothing was added.";
          if (link.isConnected) showNote(link, "ofk-error", message);
          await showKitChargeError(message);
        } finally {
          delete root.dataset.charging;
          link.removeAttribute("aria-busy");
        }
      })();
      return;
    }
    saveDraft(decide(loadDraft(), offerId, isDecline ? "declined" : "accepted"));
    if (isDecline && step) {
      void trackKitEventForNavigation("upsell_decline", { step, line_id: offerId }).then(go);
      return;
    }
    if (isCta && step) {
      void trackKitEventForNavigation("cta_click", {
        step,
        line_id: offerId,
        properties: { cta_location: kitCtaLocation(link, step) },
      }).then(go);
      return;
    }
    go();
    return;
  }

  if (isCta && step) {
    void trackKitEventForNavigation("cta_click", {
      step,
      ...(step === "sales" ? { line_id: "kit" as const } : {}),
      properties: { cta_location: kitCtaLocation(link, step) },
    }).then(go);
    return;
  }

  go();
}
