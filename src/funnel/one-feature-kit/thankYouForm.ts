/**
 * Which thank-you onboarding sections a buyer sees.
 * Line ids come from the verified checkout. Prices come from the server catalog.
 */
import {
  isKitPostPurchaseId,
  KIT_CATALOG,
  KIT_CUSTOMER_COPY,
  KIT_POST_PURCHASE_IDS,
  type KitLineId,
  type KitPostPurchaseId,
} from "../../../supabase/functions/_shared/kit-catalog";
import { formatUsdShort, type KitDraft, type OrderLine } from "./order";

/** Fields that belong to an add-on. The kit section is separate and always the base form. */
export const THANK_YOU_ADDON_FIELDS: Record<KitPostPurchaseId, readonly string[]> = {
  "bump-replay": [],
  "bump-video": ["logo", "brand colours"],
  "bump-install": [
    "collaborator",
    "agency name",
    "custom domain",
    "domain registrar",
    "team member confirmation",
    "anything else",
  ],
  launch: [],
  "webinar-system": [],
};

export type ThankYouAddonState = "open" | "locked";

export type ThankYouAddonView = {
  id: KitPostPurchaseId;
  state: ThankYouAddonState;
  name: string;
  benefit: string;
  amountCents: number;
  priceLabel: string;
  fields: readonly string[];
};

export function thankYouAddonView(ownedLineIds: readonly string[]): ThankYouAddonView[] {
  const owned = new Set(ownedLineIds);
  return KIT_POST_PURCHASE_IDS.map((id) => {
    const open = owned.has(id);
    return {
      id,
      state: open ? "open" : "locked",
      name: KIT_CATALOG[id].label,
      benefit: KIT_CUSTOMER_COPY[id].description,
      amountCents: KIT_CATALOG[id].amount,
      priceLabel: formatUsdShort(KIT_CATALOG[id].amount),
      fields: open ? THANK_YOU_ADDON_FIELDS[id] : [],
    };
  });
}

/** Dev-server preview only. Production passes dev=false and the param is ignored. */
export function thankYouPreviewLines(search: string, dev: boolean): string[] | null {
  if (!dev) return null;
  const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("ofk_preview");
  if (raw == null) return null;
  if (raw === "all") return ["kit", ...KIT_POST_PURCHASE_IDS];
  if (raw === "kit") return ["kit"];
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id === "kit" || isKitPostPurchaseId(id));
  return ids.length > 0 ? ids : ["kit"];
}

export function draftWithVerifiedLines(draft: KitDraft, lineIds: readonly string[]): KitDraft {
  const lines: OrderLine[] = [];
  for (const id of lineIds) {
    if (!(id in KIT_CATALOG)) continue;
    const item = KIT_CATALOG[id as KitLineId];
    lines.push({ id, label: item.label, amountCents: item.amount, kind: "one_time" });
  }
  const decisions = { ...draft.decisions };
  if (lineIds.includes("launch")) decisions.launch = "accepted";
  if (lineIds.includes("webinar-system")) decisions["webinar-system"] = "accepted";
  return {
    ...draft,
    bumps: {
      replay: lineIds.includes("bump-replay"),
      video: lineIds.includes("bump-video"),
      install: lineIds.includes("bump-install"),
    },
    decisions,
    lines,
  };
}

function catalogItem(id: string) {
  return id in KIT_CATALOG ? KIT_CATALOG[id as KitLineId] : null;
}

/** Paint open and locked cards. Does not rewrite inputs, so typed answers stay put. */
export function applyThankYouAddons(root: ParentNode, owned: readonly string[] | null): void {
  const review = owned === null;
  const set = new Set(owned ?? []);
  root.querySelectorAll<HTMLElement>("[data-ofk-addon]").forEach((card) => {
    const id = card.dataset.ofkAddon ?? "";
    const item = catalogItem(id);
    if (!item || !isKitPostPurchaseId(id)) return;
    const open = review || set.has(id);
    card.dataset.ofkState = open ? "open" : "locked";
    card.querySelectorAll(".ofk-addon-name").forEach((el) => {
      el.textContent = item.label;
    });
    card.querySelectorAll(".ofk-addon-benefit").forEach((el) => {
      el.textContent = KIT_CUSTOMER_COPY[id].description;
    });
    card.querySelectorAll(".ofk-addon-price").forEach((el) => {
      el.textContent = formatUsdShort(item.amount);
    });
    const button = card.querySelector<HTMLButtonElement>("[data-ofk-add]");
    if (button) button.setAttribute("aria-label", `Add ${item.label}`);
  });
  root.querySelectorAll<HTMLElement>("[data-ofk-row]").forEach((row) => {
    const id = row.dataset.ofkRow ?? "";
    row.hidden = !(review || set.has(id));
  });
}

/** Open one purchased add-on. Other cards and typed fields are left as they are. */
export function unlockThankYouAddon(root: ParentNode, id: string): void {
  const card = root.querySelector<HTMLElement>(`[data-ofk-addon="${id}"]`);
  if (card) card.dataset.ofkState = "open";
  root.querySelectorAll<HTMLElement>(`[data-ofk-row="${id}"]`).forEach((row) => {
    row.hidden = false;
  });
  card?.querySelector<HTMLElement>("input, select, textarea")?.focus();
}
