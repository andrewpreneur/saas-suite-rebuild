import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { NO_ACCOUNT_URL, UPGRADE_297_URL, UPGRADE_497_URL } from "../src/components/one-feature/shared";
import { GHL_AFFILIATE_SIGNUP_URL, GHL_AFFILIATE_TRIAL_URL, GHL_UPGRADE_297_URL, GHL_UPGRADE_497_URL } from "../src/constants/ghlAffiliate";
import { CHECKOUT_COPY } from "../src/funnel/one-feature-kit/copy/checkout";
import { GHL_POPUP_COPY } from "../src/funnel/one-feature-kit/copy/ghl";
import { THANK_YOU_COPY } from "../src/funnel/one-feature-kit/copy/thankYou";
import { kitChargeConfirmCopy } from "../src/funnel/one-feature-kit/copy/upsellCharge";
import { kitGhlResult, kitGhlSavedText } from "../src/funnel/one-feature-kit/ghlResult";
import { oneFeatureDestination } from "../src/lib/oneFeatureFlow";
import {
  EMPTY_DRAFT,
  ONE_FEATURE_KIT_PAYMENTS_LIVE,
  ONE_FEATURE_KIT_REVIEW_CHROME,
  checkoutLines,
  completeCheckout,
  decide,
  hasOffer,
  kitBumpsForSelectAll,
  kitSelectAllOn,
  loadDraft,
  orderTotalCents,
  paymentsLiveBlock,
  saveDraft,
} from "../src/funnel/one-feature-kit/order";

const SALES_PARTS = ["sales-above", "sales-story", "sales-steps", "sales-inside", "sales-proof", "sales-close"];

const read = (page: string) => {
  if (page === "sales") {
    return SALES_PARTS.map((name) => readFileSync(`src/funnel/one-feature-kit/markup/${name}.html`, "utf8")).join("");
  }
  return readFileSync(`src/funnel/one-feature-kit/markup/${page}.html`, "utf8");
};

test("payments are live and every price id is filled", () => {
  expect(ONE_FEATURE_KIT_PAYMENTS_LIVE).toBe(true);
  expect(paymentsLiveBlock(false)).toBeNull();
  expect(paymentsLiveBlock(true)).toBeNull();
});

test("checkout total is the kit plus the bumps that are ticked", () => {
  expect(
    orderTotalCents({
      ...EMPTY_DRAFT,
      lines: checkoutLines({ replay: false, video: false, install: false }),
    }),
  ).toBe(2700);
  expect(
    orderTotalCents({
      ...EMPTY_DRAFT,
      lines: checkoutLines({ replay: true, video: true, install: true }),
    }),
  ).toBe(37000);
  expect(EMPTY_DRAFT.bumps).toEqual({ replay: false, video: false, install: false });
  expect(orderTotalCents({ ...EMPTY_DRAFT, lines: checkoutLines(EMPTY_DRAFT.bumps) })).toBe(2700);
});

test("checkout starts with no add-ons, and a choice saved this session is restored", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  };
  const previous = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  try {
    expect(loadDraft().bumps).toEqual({ replay: false, video: false, install: false });
    saveDraft({ ...loadDraft(), bumps: { replay: true, video: false, install: false } });
    const restored = loadDraft();
    expect(restored.bumps).toEqual({ replay: true, video: false, install: false });
    expect(orderTotalCents({ ...restored, lines: checkoutLines(restored.bumps) })).toBe(4400);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "sessionStorage");
    else Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: previous });
  }
});

test("checkout markup defaults to the kit price and the four step counters are back", () => {
  const checkout = read("checkout");
  expect(checkout).not.toMatch(/\schecked(?:\s|>|=)/);
  expect(checkout).not.toContain("is-on");
  expect(checkout).not.toContain('aria-checked="true"');
  expect(checkout).toContain('aria-checked="false"');
  expect(checkout).not.toContain('id="ofk-bump-all"');
  expect(checkout).not.toContain("Select all 3");
  expect(checkout).toContain("$27.00");
  expect(checkout).toContain("$27 today");
  expect(checkout).not.toContain("$17.00");
  expect(checkout).not.toContain("$299.00");
  expect(checkout).not.toContain("$370");
  expect(checkout).toContain('class="progress"');
  expect(checkout).toContain("STEP 1 OF 4");
  expect(read("upsell1")).toContain("STEP 2 OF 4");
  expect(read("launch")).toContain("STEP 3 OF 4");
  expect(read("webinar")).toContain("STEP 4 OF 4");
  for (const page of ["sales", "thankyou"]) {
    expect(read(page)).not.toContain('class="progress"');
  }
  const css = readFileSync("src/funnel/one-feature-kit/funnel.css", "utf8");
  expect(css).toContain(".ofk .progress");
  expect(css).toContain(".ofk .progress i.on");
  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  expect(wire).toContain("applyBumps(root, draft.bumps)");
  expect(wire).toContain("createKitCheckout(contact, bumps, promotionCode)");
});

test("the final Select all box follows the add-ons and drives the order total", () => {
  const checkout = read("checkout");
  const install = checkout.indexOf('id="ofk-bump-install"');
  const selectAll = checkout.indexOf('id="ofk-select-all"');
  const summary = checkout.indexOf("Order summary");
  expect(install).toBeGreaterThan(checkout.indexOf('id="ofk-bump-video"'));
  expect(selectAll).toBeGreaterThan(install);
  expect(summary).toBeGreaterThan(selectAll);
  const block = checkout.slice(checkout.lastIndexOf('class="ofk-select-all"', selectAll), selectAll + 140);
  expect(block).toContain('class="ofk-select-all"');
  expect(block).toContain('data-ofk-select-all');
  expect(block).toContain(">Select all<");
  expect(block).not.toContain("Select all 3");
  expect(block).not.toMatch(/\schecked(?:\s|>|=)/);
  expect(checkout.match(/data-ofk-select-all/g)?.length).toBe(1);
  expect(checkout.indexOf('id="ofk-bump-replay"')).toBeGreaterThan(checkout.indexOf("Add to your order"));
  expect(checkout.slice(checkout.indexOf("Add to your order"), checkout.indexOf('id="ofk-bump-replay"'))).not.toContain("checkbox");

  const all = kitBumpsForSelectAll(true);
  expect(all).toEqual({ replay: true, video: true, install: true });
  expect(kitSelectAllOn(all)).toBe(true);
  expect(checkoutLines(all).map((line) => line.id)).toEqual([
    "kit",
    "bump-replay",
    "bump-video",
    "bump-install",
  ]);
  expect(orderTotalCents({ ...EMPTY_DRAFT, lines: checkoutLines(all) })).toBe(37000);

  const none = kitBumpsForSelectAll(false);
  expect(none).toEqual({ replay: false, video: false, install: false });
  expect(kitSelectAllOn(none)).toBe(false);
  expect(checkoutLines(none).map((line) => line.id)).toEqual(["kit"]);
  expect(orderTotalCents({ ...EMPTY_DRAFT, lines: checkoutLines(none) })).toBe(2700);

  const missingOne = { replay: true, video: false, install: true };
  expect(kitSelectAllOn(missingOne)).toBe(false);
  expect(orderTotalCents({ ...EMPTY_DRAFT, lines: checkoutLines(missingOne) })).toBe(2700 + 1700 + 29900);
  expect(kitSelectAllOn({ replay: true, video: true, install: true })).toBe(true);

  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  expect(wire).toContain('querySelectorAll<HTMLInputElement>("[data-ofk-select-all]")');
  expect(wire).toContain("kitBumpsForSelectAll(selectAll.checked)");
  expect(wire).toContain("kitSelectAllOn(bumps)");
  expect(wire).toContain("applyBumps(root, bumps)");
});

test("later yes and no record the order without a charge", () => {
  const checkedOut = completeCheckout(
    EMPTY_DRAFT,
    { firstName: "Ada", email: "ada@example.com", phone: "3372270501" },
    { replay: true, video: false, install: false },
    "cs_live_test",
  );
  expect(checkedOut.checkoutId).toBe("cs_live_test");
  expect(checkedOut.lines.map((line) => line.id)).toEqual(["kit", "bump-replay"]);

  const declined = decide(checkedOut, "launch", "declined");
  expect(hasOffer(declined, "launch")).toBe(false);

  const launch = decide(checkedOut, "launch", "accepted");
  const webinar = decide(launch, "webinar-system", "accepted");
  expect(hasOffer(webinar, "launch")).toBe(true);
  expect(hasOffer(webinar, "webinar-system")).toBe(true);
  expect(webinar.lines.some((line) => line.id === "community")).toBe(false);
  expect(orderTotalCents(webinar)).toBe(2700 + 1700 + 14700 + 9700);
});

test("the kit offer and the GoHighLevel step match the current copy", () => {
  const sales = read("sales");
  expect(sales).toContain("WHAT'S INCLUDED");
  expect(sales).toContain("100% Brandless AI Studio Sales Video");
  expect(sales).toContain("SaaSSuite Basic Account Included For 30 Days");
  expect(sales).toContain("Menu Link Removal Snapshot");
  expect(sales).toContain("20 MINUTE SETUP TRAINING");
  expect(sales).toContain("https://lynkific.com/vibe");
  expect(sales).toContain("1 Ad Creative Template to Get Started");
  expect(sales).toContain("1,200+ Agencies");
  expect(sales).not.toContain("$97/mo");
  expect(sales).not.toContain("7-Day");
  expect(sales).not.toContain("$1,432");

  const ghl = read("upsell1");
  expect(ghl).toContain("Advanced plan, normally $97/mo, free with your GHL account");
  expect(ghl).toContain('id="ofk-ghl-yes"');
  expect(kitGhlResult("none")).toEqual({ plan: "none", signupUrl: GHL_AFFILIATE_SIGNUP_URL });
  expect(GHL_AFFILIATE_SIGNUP_URL).toBe("https://www.gohighlevel.com/?fp_ref=crm-pricing-reviews&fp_sid=Russell-Andrew");
  expect(kitGhlResult("97")).toEqual({ plan: "97", primaryUrl: GHL_UPGRADE_497_URL, secondaryUrl: GHL_UPGRADE_297_URL });
  expect(kitGhlResult("297")).toEqual({ plan: "297", primaryUrl: GHL_UPGRADE_497_URL });
  expect(kitGhlResult("497")).toEqual({ plan: "497" });
  expect(GHL_UPGRADE_297_URL).toBe("https://www.gohighlevel.com/297upgrade?fp_ref=crm-pricing-reviews&fp_sid=Russell-Andrew");
  expect(GHL_UPGRADE_497_URL).toBe("https://www.gohighlevel.com/saasupgrade?fp_ref=crm-pricing-reviews&fp_sid=Russell-Andrew");
  expect(UPGRADE_297_URL).toBe("https://www.gohighlevel.com/297upgrade?fp_ref=andrewgeorge");
  expect(UPGRADE_497_URL).toBe("https://www.gohighlevel.com/saasupgrade?fp_ref=andrewgeorge");
  expect(GHL_AFFILIATE_TRIAL_URL).toBe("https://www.gohighlevel.com/?fp_ref=andrewgeorge");
  expect(NO_ACCOUNT_URL).toBe(GHL_AFFILIATE_TRIAL_URL);
  expect(oneFeatureDestination("none")).toEqual({ kind: "affiliate", url: GHL_AFFILIATE_SIGNUP_URL });
  expect(GHL_POPUP_COPY.readyTitle).toBe("You're all set");
  expect(GHL_POPUP_COPY.save).toBe("Save link (.txt)");
  expect(GHL_POPUP_COPY.doneTitle).toBe("Done signing up?");
  expect(kitGhlSavedText("none", "Russell-Andrew")).toBe(
    `Your $97 signup link\n${GHL_AFFILIATE_SIGNUP_URL}\n`,
  );
  expect(kitGhlSavedText("97", "Russell-Andrew")).toContain(GHL_UPGRADE_497_URL);
  expect(kitGhlSavedText("97", "Russell-Andrew")).toContain(GHL_UPGRADE_297_URL);
  expect(kitGhlSavedText("97", "Russell-Andrew")).toContain("Russell-Andrew");
  expect(kitGhlSavedText("297", "Russell-Andrew")).toBe(`Affiliate Upgrade Credit\n${GHL_UPGRADE_497_URL}\n`);
  expect(kitGhlSavedText("497", "Russell-Andrew")).toBeNull();
  expect(kitGhlSavedText("none", "Russell-Andrew")).not.toContain("andrewgeorge");
  expect(kitChargeConfirmCopy(14700)).toBe("$147 will be charged to your card immediately.");
  expect(kitChargeConfirmCopy(9700)).toBe("$97 will be charged to your card immediately.");
  expect(THANK_YOU_COPY.teamEmail).toBe("team@yoursoftwareonboarding.com");
  expect(read("thankyou")).toContain('id="ofk-copy-team"');
  expect(read("thankyou")).toContain('id="ofk-team-email"');
  expect(read("thankyou")).not.toContain("team@yoursoftwareonboarding.com");
  expect(GHL_POPUP_COPY.accountTitle).toBe("Do you have a GHL account?");
  expect(CHECKOUT_COPY.payBody).toContain("Complete my order opens secure checkout on this page.");
  expect(ghl).toContain("/one-feature-kit/launch-pack");
  expect(ghl).not.toContain("Open the GoHighLevel signup link");
  expect(ghl).not.toContain("Yes opens the signup link");
  expect(ghl).toContain(">No thanks<");
  expect(ghl).not.toContain("affiliate-club");
  expect(ghl.toLowerCase()).not.toContain("commission rate");
  expect(ghl).toContain("GHL login tracking");
  expect(ghl).toContain("Direct Slack access to the founder");
  expect(ghl).not.toContain("24/7 human support");

  const thankyou = read("thankyou");
  expect(thankyou).toContain(
    "SaaSSuite Advanced plan (normally $97/mo), free for life with your GHL account",
  );
  expect(read("sales")).not.toContain("$97/mo");
  expect(read("launch")).not.toContain("revision");
  expect(read("webinar")).not.toContain("six modules");
});

test("the funnel video is the training embed used on onefeaturetraining-3 and -4", () => {
  const shared = readFileSync("src/components/one-feature/shared.tsx", "utf8");
  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  const page = readFileSync("src/pages/OneFeatureKit.tsx", "utf8");
  const facade = readFileSync("src/components/media/YouTubeFacade.tsx", "utf8");
  expect(readFileSync("src/components/one-feature/videoId.ts", "utf8")).toContain(
    'export const TRAINING_YOUTUBE_ID = "jLStbuti2f4"',
  );
  expect(shared).toContain('import { TRAINING_YOUTUBE_ID } from "./videoId"');
  expect(shared).toContain("export { TRAINING_YOUTUBE_ID }");
  expect(shared).toContain("<YouTubeFacade videoId={TRAINING_YOUTUBE_ID}");
  expect(facade).toContain("encodeURIComponent(videoId)");
  expect(facade).toContain("rel=0");
  expect(wire).toContain("TRAINING_YOUTUBE_ID");
  expect(wire).toContain("mountYouTubeFacade");
  expect(wire).toContain("pathname === FUNNEL_ROUTES.sales");
  expect(wire).toContain("sales video (VSL)");
  expect(facade).toContain("youtube-nocookie.com/embed/");
  expect(page).toContain('behavior: "instant"');
  expect(page).toContain('className="ofk-live"');
  expect(page).toContain('className="ofk-sticky-cta"');
  const doc = readFileSync("src/funnel/one-feature-kit/FunnelDocument.tsx", "utf8");
  expect(doc).toContain("readBakedFunnelChrome");
  expect(doc).toContain('pageId !== "thankyou"');
});

test("thank-you receipt rows match the current offer", () => {
  const html = read("thankyou");
  for (const id of ["kit", "bump-replay", "bump-video", "bump-install", "launch", "webinar-system"]) {
    expect(html).toContain(`data-ofk-row="${id}"`);
  }
  expect(html).toContain('data-ofk-addon="bump-install"');
  expect(html).not.toMatch(/only if you bought/i);
  expect(html).not.toContain("bump-logo");
  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  expect(wire).toContain("Set Your PW and Login");
  expect(wire).toContain("kitSignInHref");
  expect(wire).toContain('id === "ofk-open-kit"');
  expect(wire).toContain('get_user_auth_status_by_email');
  expect(wire).toContain("kitBuyerHasPassword(authStatus, error)");
  expect(wire).toContain(".catch(() => go(false))");
  expect(wire).toContain("openKitAccount(kitPurchaseEmail(root))");
  expect(wire).toContain('link.id === "ofk-open-kit" || link.id === "ofk-login"');
  expect(wire).toContain('from("funnel_onboarding")');
  expect(html).not.toContain("ofk-soon");
});

test("review chrome is one flag and it is off for visitors", () => {
  expect(ONE_FEATURE_KIT_REVIEW_CHROME).toBe(false);
  const page = readFileSync("src/pages/OneFeatureKit.tsx", "utf8");
  const css = readFileSync("src/funnel/one-feature-kit/funnel.css", "utf8");
  expect(page).toContain("ONE_FEATURE_KIT_REVIEW_CHROME");
  expect(page).not.toContain("ofk-stubbar");
  expect(css).toContain(".ofk:not(.ofk-show-review) .draftbar");
  expect(css).toContain(".ofk:not(.ofk-show-review) .proposed");
  expect(css).toContain(".ofk:not(.ofk-show-review) .ofk-review");
  expect(css).not.toContain("scroll-behavior:smooth");
  for (const name of ["sales", "checkout", "upsell1", "launch", "webinar", "thankyou"]) {
    const html = read(name);
    expect(html.match(/class="draftbar"/g)?.length).toBe(1);
    expect(html).not.toContain("DRAFT MOCKUP");
    expect(html.toLowerCase()).not.toContain("guarantee");
    expect(html).not.toContain("ofk-soon");
  }
  const checkout = read("checkout");
  expect(checkout).toContain("ofk-bump-art");
  expect(checkout).not.toContain("Select all 3");
  expect(checkout).not.toContain('id="ofk-bump-all"');
  expect(checkout).toContain(">Select all<");
  expect(checkout).not.toContain("bump-logo");
  expect(checkout).not.toContain("$1,432");
});

test("launch pack is 25 templates and the webinar is one module", () => {
  const launch = read("launch");
  expect(launch).toContain("25");
  expect(launch).toContain("immediately");
  expect(launch.toLowerCase()).not.toContain("turnaround");
  expect(launch).toContain('class="ofk-daily-cap"');
  expect(launch).not.toContain("each week");
  const webinar = read("webinar");
  expect(webinar).toContain("One module");
  expect(webinar).toContain("$97");
  expect(webinar).not.toContain("Module 2");
  expect(webinar).not.toContain("Module 6");
  expect(webinar).not.toContain("ofk-daily-cap");
  expect(webinar).not.toContain("done-for-you spots");
  expect(webinar).not.toContain("each week");
  expect(read("sales")).not.toContain("each week");
  expect(read("checkout")).not.toContain("each week");
  expect(read("upsell1")).not.toContain("each week");
  expect(read("thankyou")).not.toContain("each week");
});

test("a stubbed checkout does not plan a Slack ping", async () => {
  const { planKitSlackPing } = await import("../src/funnel/one-feature-kit/slack");
  const { KIT_SLACK_AGENCY_ID } = await import("../src/funnel/one-feature-kit/stripe");
  expect(KIT_SLACK_AGENCY_ID).toBe("saassuite");
  const stubbed = {
    ...EMPTY_DRAFT,
    contact: { firstName: "Ada", email: "ada@example.com", phone: "3372270501" },
    lines: checkoutLines({ replay: false, video: false, install: false }),
    checkoutId: "stub_test",
  };
  const plan = planKitSlackPing(stubbed);
  expect(plan.send).toBe(false);
  expect(plan.payload.event_type).toBe("one_feature_kit_purchase");
  const live = completeCheckout(
    EMPTY_DRAFT,
    { firstName: "Ada", email: "ada@example.com", phone: "3372270501" },
    { replay: false, video: false, install: false },
    "cs_live_test",
  );
  const livePlan = planKitSlackPing(live);
  expect(livePlan.send).toBe(true);
  expect(livePlan.payload.agency_id).toBe("saassuite");
});

test("the live notice follows the Chicago daily schedule, including across a visitor's zone", async () => {
  const { kitDailyCapLine, kitLiveNotice, kitLiveNoticeShort, kitSlotsLeft } = await import(
    "../src/funnel/one-feature-kit/scarcity"
  );
  // 2026-07-15 is a Wednesday. Chicago is CDT (UTC-5) that day.
  const at = (iso: string) => new Date(iso);
  expect(kitSlotsLeft(at("2026-07-15T16:59:00Z"))).toBe(5); // 11:59am
  expect(kitSlotsLeft(at("2026-07-15T17:00:00Z"))).toBe(4); // 12:00pm
  expect(kitSlotsLeft(at("2026-07-15T19:59:00Z"))).toBe(4); // 2:59pm
  expect(kitSlotsLeft(at("2026-07-15T20:00:00Z"))).toBe(3); // 3:00pm
  expect(kitSlotsLeft(at("2026-07-15T21:59:00Z"))).toBe(3); // 4:59pm
  expect(kitSlotsLeft(at("2026-07-15T22:00:00Z"))).toBe(2); // 5:00pm
  expect(kitSlotsLeft(at("2026-07-15T23:59:00Z"))).toBe(2); // 6:59pm
  expect(kitSlotsLeft(at("2026-07-16T00:00:00Z"))).toBe(1); // 7:00pm
  expect(kitSlotsLeft(at("2026-07-16T04:59:00Z"))).toBe(1); // 11:59pm Wednesday
  expect(kitLiveNotice(at("2026-07-16T04:59:00Z"))).toBe(
    "LIVE: Only 1 done-for-you setup left today (Wednesday)",
  );
  expect(kitLiveNoticeShort(at("2026-07-16T04:59:00Z"))).toBe("LIVE: Only 1 left today");
  expect(kitDailyCapLine(at("2026-07-16T04:59:00Z"))).toBe("Only 1 done-for-you spot left today.");
  expect(kitSlotsLeft(at("2026-07-16T05:00:00Z"))).toBe(5); // Thursday 12:00am
  expect(kitLiveNotice(at("2026-07-16T05:00:00Z"))).toBe(
    "LIVE: Only 5 done-for-you setups left today (Thursday)",
  );
  expect(kitDailyCapLine(at("2026-07-16T05:00:00Z"))).toBe("Only 5 done-for-you spots left today.");

  // Noon in Chicago is 17:00 UTC and 18:00 in London. A local-hour reading would not stay at 4.
  const noonChicago = at("2026-07-15T17:00:00Z");
  const hourIn = (zone: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(noonChicago);
  expect(hourIn("America/Chicago")).not.toBe(hourIn("Europe/London"));
  expect(noonChicago.getUTCHours()).toBe(17);
  expect(kitSlotsLeft(noonChicago)).toBe(4);
  expect(kitLiveNotice(noonChicago)).toBe(
    "LIVE: Only 4 done-for-you setups left today (Wednesday)",
  );
  // Same UTC hour in January is still morning in Chicago (CST, UTC-6) → 5, not the 5pm bucket.
  const winter = at("2026-01-15T17:00:00Z");
  expect(kitSlotsLeft(winter)).toBe(5);
  expect(kitLiveNotice(winter)).toContain("(Thursday)");

  const wire = readFileSync("src/funnel/one-feature-kit/wire.ts", "utf8");
  const scarcity = readFileSync("src/funnel/one-feature-kit/scarcity.ts", "utf8");
  expect(wire).toContain("mountLiveNotice");
  expect(wire).toContain("setInterval(tick, 60_000)");
  expect(wire).toContain("clearInterval");
  expect(scarcity).toContain('timeZone: CHICAGO');
  expect(scarcity).toContain('"America/Chicago"');
  expect(readFileSync("src/funnel/one-feature-kit/ghlResult.ts", "utf8")).toContain('window.open(url, "_blank")');
  expect(readFileSync("src/funnel/one-feature-kit/ghlResult.ts", "utf8")).toContain("opened.opener = null");
  const ghlDialog = readFileSync("src/funnel/one-feature-kit/KitGhlDialog.tsx", "utf8");
  expect(ghlDialog).toContain("@radix-ui/react-dialog");
  expect(ghlDialog).toContain("ofk-ghl-dialog");
  expect(ghlDialog).toContain("ofk-ghl-overlay");
  expect(ghlDialog).not.toContain("@/components/ui/dialog");
  expect(ghlDialog).not.toContain("@/components/ui/button");
  expect(ghlDialog).toContain("copy.doneTitle");
  expect(ghlDialog).toContain("copy.save");
  expect(ghlDialog).toContain("copy.copied");
  expect(ghlDialog).toContain('advance("copied")');
  expect(ghlDialog).toContain('advance("opened")');
  expect(ghlDialog).toContain("saveLinks");
  const checkoutModal = readFileSync("src/funnel/one-feature-kit/embeddedCheckout.ts", "utf8");
  expect(checkoutModal).toContain("ofk-checkout-card");
  expect(checkoutModal).toContain("ofk-checkout-confirm");
  expect(checkoutModal).not.toContain('event.target === root.querySelector(".ofk-modal")');
  const funnelCss = readFileSync("src/funnel/one-feature-kit/funnel.css", "utf8");
  expect(funnelCss).toContain(".ofk-checkout-card .ofk-modal-bar{position:sticky");
  expect(funnelCss).toContain(".ofk .ofk-ghl-dialog{position:fixed");
  expect(funnelCss).toContain(".ofk table.ofk-find");
  expect(funnelCss).toContain(".ofk table.summary.ofk-find td:last-child");
  expect(readFileSync("src/funnel/one-feature-kit/markup/thankyou.html", "utf8")).toContain('class="summary ofk-find"');
  expect(readFileSync("src/funnel/one-feature-kit/funnel.css", "utf8")).toContain('aria-label="Cookie notice"');
  expect(readFileSync("src/pages/OneFeatureStrategy.tsx", "utf8")).not.toContain("UpgradeDestination");
  expect(readFileSync("src/pages/OneFeatureStrategy.tsx", "utf8")).toContain('href={destination.url}');
  expect(readFileSync("src/lib/oneFeatureFlow.ts", "utf8")).toContain("GHL_AFFILIATE_SIGNUP_URL");
  expect(readFileSync("src/lib/oneFeatureFlow.ts", "utf8")).not.toContain("GHL_AFFILIATE_TRIAL_URL");
  expect(wire).toContain("openKitGhlPopup");
  expect(wire).not.toContain("noopener,noreferrer");
  expect(wire).toContain("ofk-sticky-cta");
  expect(wire).toContain("FUNNEL_ROUTES.thanks");
});

test("a failed save names permission and a missing table separately", async () => {
  const { onboardingInsertKind } = await import("../src/funnel/one-feature-kit/wire");
  expect(
    onboardingInsertKind("42501", "permission denied for table funnel_onboarding"),
  ).toBe("permission");
  expect(onboardingInsertKind("PGRST205", "Could not find the table funnel_onboarding in the schema cache")).toBe(
    "missing-table",
  );
  expect(onboardingInsertKind("42P01", "relation funnel_onboarding does not exist")).toBe("missing-table");
  const sitemap = readFileSync("public/sitemap.xml", "utf8");
  expect(sitemap).not.toContain("/one-feature-kit/checkout");
  expect(sitemap).not.toContain("/one-feature-kit/thank-you");
  expect(sitemap.match(/<loc>https:\/\/saassuite\.ai\/blog/g)?.length).toBe(41);
});

test("onefeaturekit.com serves the funnel at the root and saassuite.ai does not", async () => {
  const { canonicalFunnelPath, isKitHost, publicFunnelPath } = await import(
    "../src/funnel/one-feature-kit/host"
  );
  expect(isKitHost("onefeaturekit.com")).toBe(true);
  expect(isKitHost("www.onefeaturekit.com")).toBe(true);
  expect(isKitHost("saassuite.ai")).toBe(false);
  expect(canonicalFunnelPath("/", "onefeaturekit.com")).toBe("/one-feature-kit");
  expect(canonicalFunnelPath("/checkout", "onefeaturekit.com")).toBe("/one-feature-kit/checkout");
  expect(canonicalFunnelPath("/pricing", "onefeaturekit.com")).toBeNull();
  expect(canonicalFunnelPath("/one-feature-kit/checkout", "saassuite.ai")).toBe(
    "/one-feature-kit/checkout",
  );
  expect(canonicalFunnelPath("/checkout", "saassuite.ai")).toBeNull();
  expect(canonicalFunnelPath("/", "localhost")).toBeNull();
  expect(publicFunnelPath("/one-feature-kit/checkout", "onefeaturekit.com")).toBe("/checkout");
  expect(publicFunnelPath("/one-feature-kit", "onefeaturekit.com")).toBe("/");
  expect(publicFunnelPath("/one-feature-kit/checkout", "saassuite.ai")).toBe(
    "/one-feature-kit/checkout",
  );
});
