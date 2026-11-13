import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { KIT_CATALOG, KIT_CUSTOMER_COPY, KIT_POST_PURCHASE_IDS } from "../supabase/functions/_shared/kit-catalog";
import {
  addonChargeAllowed,
  completedUpsellLineId,
  mergeOwnedKitLineIds,
  upsellEntitlementRow,
  type KitCheckoutSession,
} from "../supabase/functions/_shared/kit-entitlements";
import { EMPTY_DRAFT } from "../src/funnel/one-feature-kit/order";
import {
  THANK_YOU_ADDON_FIELDS,
  applyThankYouAddons,
  draftWithVerifiedLines,
  thankYouAddonView,
  thankYouPreviewLines,
  unlockThankYouAddon,
} from "../src/funnel/one-feature-kit/thankYouForm";

const html = readFileSync("src/funnel/one-feature-kit/markup/thankyou.html", "utf8");

function addonMarkup(id: string): string {
  const start = html.indexOf(`data-ofk-addon="${id}"`);
  expect(start).toBeGreaterThan(-1);
  const next = html.indexOf('data-ofk-addon="', start + 10);
  return html.slice(start, next === -1 ? html.indexOf('id="ofk-onboard-submit"') : next);
}

test("kit only keeps every add-on locked and hides its fields", () => {
  const view = thankYouAddonView(["kit"]);
  expect(view.map((item) => item.id)).toEqual([...KIT_POST_PURCHASE_IDS]);
  expect(view.every((item) => item.state === "locked")).toBe(true);
  expect(view.every((item) => item.fields.length === 0)).toBe(true);
  for (const item of view) {
    expect(item.name).toBe(KIT_CATALOG[item.id].label);
    expect(item.benefit).toBe(KIT_CUSTOMER_COPY[item.id].description);
    expect(item.amountCents).toBe(KIT_CATALOG[item.id].amount);
    expect(item.priceLabel.startsWith("$")).toBe(true);
  }
});

test("each owned line opens only that section", () => {
  const view = thankYouAddonView(["kit", "bump-video", "launch"]);
  const byId = Object.fromEntries(view.map((item) => [item.id, item]));
  expect(byId["bump-video"].state).toBe("open");
  expect(byId["bump-video"].fields).toEqual(["logo", "brand colours"]);
  expect(byId.launch.state).toBe("open");
  expect(byId.launch.fields).toEqual([]);
  expect(byId["bump-install"].state).toBe("locked");
  expect(byId["bump-replay"].state).toBe("locked");
  expect(byId["webinar-system"].state).toBe("locked");
  expect(byId["bump-install"].fields).toEqual([]);
});

test("buying a locked add-on opens its fields and leaves the others locked", () => {
  const before = thankYouAddonView(["kit"]);
  expect(before.find((item) => item.id === "bump-install")?.state).toBe("locked");
  const after = thankYouAddonView(["kit", "bump-install"]);
  const install = after.find((item) => item.id === "bump-install");
  expect(install?.state).toBe("open");
  expect(install?.fields).toEqual([...THANK_YOU_ADDON_FIELDS["bump-install"]]);
  expect(after.find((item) => item.id === "bump-video")?.state).toBe("locked");
  expect(after.find((item) => item.id === "launch")?.state).toBe("locked");
  const draft = draftWithVerifiedLines(
    { ...EMPTY_DRAFT, contact: { firstName: "Ada", email: "ada@example.com", phone: "3372270501" }, checkoutId: "cs_live_test" },
    ["kit", "bump-install"],
  );
  expect(draft.contact.firstName).toBe("Ada");
  expect(draft.lines.map((line) => line.id)).toEqual(["kit", "bump-install"]);
  expect(draft.lines.find((line) => line.id === "bump-install")?.amountCents).toBe(KIT_CATALOG["bump-install"].amount);
  expect(draft.bumps).toEqual({ replay: false, video: false, install: true });
});

test("locked cards are in the form and conditional wording is gone", () => {
  expect(html).not.toMatch(/only if you bought/i);
  expect(html).not.toContain("Extra sections appear only");
  expect(html).not.toContain("Leave blank otherwise");
  expect(html).not.toContain("Added the 90-minute");
  const core = html.slice(html.indexOf('id="ofk-onboard"'), html.indexOf('data-ofk-addon="bump-replay"'));
  expect(core).toContain("First name");
  expect(core).toContain("Business / brand name");
  expect(core).not.toContain("Link to your logo");
  expect(core).not.toContain('id="ofk-copy-team"');

  const video = addonMarkup("bump-video");
  expect(video).toContain('data-ofk-add="bump-video"');
  expect(video).toContain(">Add it<");
  expect(video).toContain('data-ofk-field="logo"');
  expect(video).toContain('data-ofk-field="brand"');
  expect(video).toContain("Brand colours");
  expect(video).not.toContain("agency");

  const install = addonMarkup("bump-install");
  expect(install).toContain('data-ofk-add="bump-install"');
  expect(install).toContain('id="ofk-copy-team"');
  expect(install).toContain('id="ofk-team-email"');
  expect(install).toContain('data-ofk-field="collaborator"');
  expect(install).toContain('data-ofk-field="agency"');
  expect(install).toContain("Add our team as a user");
  expect(install).not.toContain("Link to your logo");

  for (const id of KIT_POST_PURCHASE_IDS) {
    expect(html).toContain(`data-ofk-addon="${id}"`);
    expect(html).toContain(`data-ofk-add="${id}"`);
  }
});

test("a line the buyer already owns is not charged again", () => {
  expect(addonChargeAllowed(["kit"], "bump-video")).toBe(true);
  expect(addonChargeAllowed(["kit", "bump-video"], "bump-video")).toBe(false);
  expect(addonChargeAllowed(["kit", "launch"], "launch")).toBe(false);
  expect(addonChargeAllowed(["kit"], "kit")).toBe(false);
  const owned = mergeOwnedKitLineIds(
    ["kit"],
    ["bump-video", completedUpsellLineId("upsell:cs_live_abc:launch", "cs_live_abc"), "nope"],
  );
  expect(owned).toEqual(["kit", "bump-video", "launch"]);
  expect(completedUpsellLineId("upsell:cs_live_other:launch", "cs_live_abc")).toBeNull();
  expect(addonChargeAllowed(owned, "launch")).toBe(false);
  expect(addonChargeAllowed(owned, "bump-install")).toBe(true);
});

test("a post-purchase bump is saved at the catalog price", () => {
  const session: KitCheckoutSession = {
    metadata: { funnel: "one-feature-kit", line_ids: "kit", email: "buyer@example.com" },
    payment_status: "paid",
    amount_total: 2700,
    currency: "usd",
    mode: "payment",
    livemode: true,
    customer: "cus_test",
    payment_intent: { id: "pi_kit", status: "succeeded", payment_method: "pm_test" },
    customer_details: { email: "buyer@example.com" },
  };
  const row = upsellEntitlementRow(session, "cs_live_abc", "bump-install", "pi_install", false);
  expect(row.line_id).toBe("bump-install");
  expect(row.amount_cents).toBe(KIT_CATALOG["bump-install"].amount);
  expect(row.stripe_price_id).toBe(KIT_CATALOG["bump-install"].price);
  expect(row.source).toBe("upsell");
  const payment = readFileSync("supabase/functions/one-feature-kit-payment/index.ts", "utf8");
  expect(payment).toContain("KIT_POST_PURCHASE_IDS");
  expect(payment).toContain("alreadyOwned: true");
  expect(payment).toContain("amount: item.amount");
  expect(payment).not.toContain('z.enum(["launch", "webinar-system"])');
});

type Node = {
  dataset: Record<string, string>;
  hidden: boolean;
  textContent: string;
  value: string;
  className: string;
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
  focused: boolean;
  querySelector: (selector: string) => Node | null;
  querySelectorAll: (selector: string) => Node[];
  setAttribute: (name: string, value: string) => void;
  focus: () => void;
};

function matches(node: Node, selector: string): boolean {
  return selector.split(",").some((part) => {
    const token = part.trim();
    if (token.startsWith(".")) return node.className.split(/\s+/).includes(token.slice(1));
    if (token === node.tag) return true;
    const attr = token.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    if (!attr) return false;
    const key = attr[1].replace(/^data-/, "").replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return attr[2] == null ? node.dataset[key] != null : node.dataset[key] === attr[2];
  });
}

function node(tag: string, options: { className?: string; dataset?: Record<string, string>; hidden?: boolean; value?: string } = {}, ...children: Node[]): Node {
  const current: Node = {
    dataset: { ...(options.dataset ?? {}) },
    hidden: options.hidden ?? false,
    textContent: "",
    value: options.value ?? "",
    className: options.className ?? "",
    tag,
    attrs: {},
    children,
    focused: false,
    querySelector: (selector) => current.querySelectorAll(selector)[0] ?? null,
    querySelectorAll: (selector) => {
      const found: Node[] = [];
      const walk = (child: Node) => {
        if (matches(child, selector)) found.push(child);
        child.children.forEach(walk);
      };
      current.children.forEach(walk);
      return found;
    },
    setAttribute: (name, value) => {
      current.attrs[name] = value;
    },
    focus: () => {
      current.focused = true;
    },
  };
  return current;
}

test("owned receipt rows stay visible and an unlock keeps typed answers", () => {
  const name = node("input", { value: "Ada" });
  const logo = node("input");
  const videoPrice = node("b", { className: "ofk-addon-price" });
  const video = node("div", { dataset: { ofkAddon: "bump-video" } },
    node("b", { className: "ofk-addon-name" }),
    node("p", { className: "ofk-addon-benefit" }),
    videoPrice,
    node("button", { dataset: { ofkAdd: "bump-video" } }),
    logo,
  );
  const install = node("div", { dataset: { ofkAddon: "bump-install" } },
    node("b", { className: "ofk-addon-name" }),
    node("p", { className: "ofk-addon-benefit" }),
    node("b", { className: "ofk-addon-price" }),
    node("button", { dataset: { ofkAdd: "bump-install" } }),
  );
  const rows = {
    kit: node("tr", { dataset: { ofkRow: "kit" } }),
    video: node("tr", { dataset: { ofkRow: "bump-video" }, hidden: true }),
    install: node("tr", { dataset: { ofkRow: "bump-install" }, hidden: true }),
  };
  const root = node("div", {}, name, video, install, rows.kit, rows.video, rows.install);

  applyThankYouAddons(root, ["kit"]);
  expect(video.dataset.ofkState).toBe("locked");
  expect(install.dataset.ofkState).toBe("locked");
  expect(videoPrice.textContent).toBe("$27");
  expect(rows.kit.hidden).toBe(false);
  expect(rows.video.hidden).toBe(true);
  expect(rows.install.hidden).toBe(true);

  unlockThankYouAddon(root, "bump-video");
  expect(video.dataset.ofkState).toBe("open");
  expect(install.dataset.ofkState).toBe("locked");
  expect(rows.video.hidden).toBe(false);
  expect(rows.install.hidden).toBe(true);
  expect(name.value).toBe("Ada");
  expect(logo.focused).toBe(true);
  expect(name.focused).toBe(false);
});

test("the preview switch is off unless the dev flag is on", () => {
  expect(thankYouPreviewLines("?ofk_preview=kit", false)).toBeNull();
  expect(thankYouPreviewLines("?ofk_preview=kit", true)).toEqual(["kit"]);
  expect(thankYouPreviewLines("?ofk_preview=all", true)).toEqual(["kit", ...KIT_POST_PURCHASE_IDS]);
  expect(thankYouPreviewLines("", true)).toBeNull();
});
