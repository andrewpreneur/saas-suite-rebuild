import salesAbove from "./markup/sales-above.html?raw";
import { FUNNEL_ROUTES } from "./order";

/** Hero only. Below-fold sections are separate chunks so the sales entry does not parse them. */
export const SALES_ABOVE_HTML = salesAbove;

export const SALES_FOLDS: { id: string; load: () => Promise<string> }[] = [
  { id: "story", load: () => import("./markup/sales-story.html?raw").then((mod) => mod.default) },
  { id: "steps", load: () => import("./markup/sales-steps.html?raw").then((mod) => mod.default) },
  { id: "inside", load: () => import("./markup/sales-inside.html?raw").then((mod) => mod.default) },
  { id: "proof", load: () => import("./markup/sales-proof.html?raw").then((mod) => mod.default) },
  { id: "close", load: () => import("./markup/sales-close.html?raw").then((mod) => mod.default) },
];

async function loadCheckoutHtml(): Promise<string> {
  const [html, replayWebp, replayJpg, videoWebp, videoJpg, installWebp, installJpg] = await Promise.all([
    import("./markup/checkout.html?raw"),
    import("@/assets/one-feature-kit/bumps/bump-replay-1200.webp"),
    import("@/assets/one-feature-kit/bumps/bump-replay-1200.jpg"),
    import("@/assets/one-feature-kit/bumps/bump-branded-video-1200.webp"),
    import("@/assets/one-feature-kit/bumps/bump-branded-video-1200.jpg"),
    import("@/assets/one-feature-kit/bumps/bump-dfy-setup-1200.webp"),
    import("@/assets/one-feature-kit/bumps/bump-dfy-setup-1200.jpg"),
  ]);
  return html.default
    .replace(/__BUMP_REPLAY_WEBP__/g, () => replayWebp.default)
    .replace(/__BUMP_REPLAY_JPG__/g, () => replayJpg.default)
    .replace(/__BUMP_VIDEO_WEBP__/g, () => videoWebp.default)
    .replace(/__BUMP_VIDEO_JPG__/g, () => videoJpg.default)
    .replace(/__BUMP_INSTALL_WEBP__/g, () => installWebp.default)
    .replace(/__BUMP_INSTALL_JPG__/g, () => installJpg.default);
}

const PAGE_HTML = {
  upsell1: () => import("./markup/upsell1.html?raw").then((mod) => mod.default),
  launch: () => import("./markup/launch.html?raw").then((mod) => mod.default),
  webinar: () => import("./markup/webinar.html?raw").then((mod) => mod.default),
  thankyou: () => import("./markup/thankyou.html?raw").then((mod) => mod.default),
} as const;

export async function loadFunnelHtml(pageId: FunnelPageId): Promise<string> {
  if (pageId === "sales") {
    const folds = await Promise.all(SALES_FOLDS.map((fold) => fold.load()));
    return SALES_ABOVE_HTML + folds.join("");
  }
  if (pageId === "checkout") return loadCheckoutHtml();
  return PAGE_HTML[pageId]();
}

export type FunnelPageId = "sales" | "checkout" | keyof typeof PAGE_HTML;

export const FUNNEL_PAGE_BY_PATH: Record<string, FunnelPageId> = {
  [FUNNEL_ROUTES.sales]: "sales",
  [FUNNEL_ROUTES.checkout]: "checkout",
  [FUNNEL_ROUTES.ghl]: "upsell1",
  [FUNNEL_ROUTES.launch]: "launch",
  [FUNNEL_ROUTES.webinar]: "webinar",
  [FUNNEL_ROUTES.thanks]: "thankyou",
};

export const FUNNEL_META: Record<FunnelPageId, { title: string; description: string }> = {
  sales: {
    title: "The GoHighLevel One Feature Kit · $27",
    description:
      "Sell one GoHighLevel feature as your own AI software. The One Feature Kit is $27, one time.",
  },
  checkout: {
    title: "Checkout · The GoHighLevel One Feature Kit",
    description:
      "Get the $27 One Feature Kit. Add the 90-minute replay, a branded sales video, or done-for-you setup.",
  },
  upsell1: {
    title: "GoHighLevel signup · Advanced plan, normally $97/mo, free with your GHL account",
    description:
      "Sign up for GoHighLevel through our link. SaaSSuite's Advanced plan is normally $97/mo and is free with that GoHighLevel account.",
  },
  launch: {
    title: "25 White-Labeled Ad Templates · $147",
    description:
      "Twenty-five white-labeled ad templates. Add your logo with AI and download them immediately.",
  },
  webinar: {
    title: "Webinar Sales System · $97",
    description:
      "One training module on setting up an automated WebinarKit webinar that sells your one-feature app.",
  },
  thankyou: {
    title: "You're in · One Feature Kit",
    description: "Your One Feature Kit order is saved. Finish the onboarding form to tell us what you bought.",
  },
};
