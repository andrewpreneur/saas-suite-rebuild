import { TRAINING_YOUTUBE_ID, WL_SALES_VIDEO } from "@/components/one-feature/shared";
import { KIT_HOME_PATH } from "@/lib/kitReturn";
import { WALKTHROUGH_VIDEO } from "@/lib/startHere";

/** In-app page buyers land on after signup or login. */
export const KIT_DASHBOARD_PATH = KIT_HOME_PATH;

/** Sales page already named in the kit's What's Included list. */
export const KIT_SALES_PAGE_URL = "https://lynkific.com/vibe";

export const KIT_TRAINING_URL = `https://www.youtube.com/watch?v=${TRAINING_YOUTUBE_ID}`;

export const KIT_REPLAY_URL = "https://viralmeetings.com/replay/6ac025c8b106329d6236ba46";

/** Unlocked Webinar Sales System training. The $97 upsell stays on buyHref. */
export const KIT_WEBINAR_URL = "https://getviralmeetings.com";

export type KitDeliverable = {
  id: string;
  title: string;
  detail: string;
  group: "kit" | "addon";
  lineId: string;
  href: string | null;
  action: string | null;
  intakeHref: string | null;
  intakeAction: string | null;
  status: string | null;
  buyHref: string;
  priceLabel: string;
};

export const KIT_DELIVERABLES: KitDeliverable[] = [
  {
    id: "white-label-video",
    title: "White-label AI Studio sales video",
    detail: "Download the brandless sales video and put it on your sales page. It does not name GoHighLevel.",
    group: "kit",
    lineId: "kit",
    href: WL_SALES_VIDEO,
    action: "Download the video",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "snapshot",
    title: "Menu Link Removal snapshot",
    detail: "Import this snapshot so the menu your customer sees is the one feature, not the full GoHighLevel menu.",
    group: "kit",
    lineId: "kit",
    href: null,
    action: "Import the snapshot",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "instructional-video",
    title: "20-minute setup training",
    detail: "Watch the setup training, then put the sales page live.",
    group: "kit",
    lineId: "kit",
    href: WALKTHROUGH_VIDEO,
    action: "Watch the setup",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "menu-link-removal",
    title: "Menu link removal",
    detail: "Open the Menu link removal page and hide every link except the one feature.",
    group: "kit",
    lineId: "kit",
    href: "/app/streamline",
    action: "Open menu link removal",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "copilot",
    title: "AI Copilot",
    detail: "Ask Copilot while you connect HighLevel, install the menu link, and set the kit up.",
    group: "kit",
    lineId: "kit",
    href: "/app/copilot",
    action: "Open AI Copilot",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "training",
    title: "One Feature training",
    detail: "The training walkthrough of the $27 kit.",
    group: "kit",
    lineId: "kit",
    href: KIT_TRAINING_URL,
    action: "Watch the training",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "sales-page",
    title: "High converting sales page",
    detail: "Use the sales page that already converts.",
    group: "kit",
    lineId: "kit",
    href: KIT_SALES_PAGE_URL,
    action: "Preview the sales page",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "ad-template",
    title: "1 ad creative template",
    detail: "The HighLevel creative that says 60 Day Free Trial and Vibe Code for Free with AI Studio.",
    group: "kit",
    lineId: "kit",
    href: "/kit/ad-templates/highlevel/vibe-code-for-free.png",
    action: "Download the template",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "basic-30",
    title: "SaaSSuite Basic for 30 days",
    detail: "SaaSSuite Basic turns on for 30 days when this account is still Starter. The 30 days start at purchase. Advanced stays Advanced.",
    group: "kit",
    lineId: "kit",
    href: null,
    action: null,
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit",
    priceLabel: "$27",
  },
  {
    id: "bump-replay",
    title: "Full 90-minute training replay",
    detail: "Watch the replay as many times as you want.",
    group: "addon",
    lineId: "bump-replay",
    href: KIT_REPLAY_URL,
    action: "Watch the replay",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit/checkout",
    priceLabel: "$17",
  },
  {
    id: "bump-video",
    title: "Done-for-you branded AI Studio video",
    detail: "We brand the AI Studio sales video with your logo.",
    group: "addon",
    lineId: "bump-video",
    href: null,
    action: null,
    intakeHref: "/one-feature-kit/thank-you",
    intakeAction: "Open the intake form",
    status: "In progress. Send your logo on the onboarding form and we'll email the branded video.",
    buyHref: "/one-feature-kit/checkout",
    priceLabel: "$27",
  },
  {
    id: "bump-install",
    title: "DFY installation, customization, and setup",
    detail: "We install the snapshot, the sales page, and the sales video in your agency.",
    group: "addon",
    lineId: "bump-install",
    href: null,
    action: null,
    intakeHref: "/one-feature-kit/thank-you",
    intakeAction: "Open the intake form",
    status: "Setup requested. Use the intake form. A direct Slack channel confirms the install. No call. We'll email you when it's done.",
    buyHref: "/one-feature-kit/checkout",
    priceLabel: "$299",
  },
  {
    id: "launch",
    title: "Launch Pack — 17 ad creatives",
    detail: "17 ad creatives are in the library on this page. Download one, copy its prompt, or send your logo and we'll brand it.",
    group: "addon",
    lineId: "launch",
    href: "#kit-ad-templates",
    action: "Open the creatives",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit/launch-pack",
    priceLabel: "$147",
  },
  {
    id: "webinar-system",
    title: "Webinar Sales System",
    detail: "One training module on setting up an automated WebinarKit webinar. WebinarKit is a separate account and is not included.",
    group: "addon",
    lineId: "webinar-system",
    href: KIT_WEBINAR_URL,
    action: "Open the training",
    intakeHref: null,
    intakeAction: null,
    status: null,
    buyHref: "/one-feature-kit/webinar-sales-system",
    priceLabel: "$97",
  },
];

export type KitDeliverableState = KitDeliverable & { unlocked: boolean };

export function kitDeliveryState(ownedLineIds: Iterable<string>): KitDeliverableState[] {
  const owned = new Set(ownedLineIds);
  return KIT_DELIVERABLES.map(item => ({ ...item, unlocked: owned.has(item.lineId) }));
}

/** Deliverables that have no file or page link in the repo. */
export function unlinkedKitDeliverables(items: KitDeliverable[] = KIT_DELIVERABLES): string[] {
  return items.filter(item => !item.href && item.id !== "snapshot").map(item => item.title);
}

export function kitAuthDestination(email: string, hasAccount: boolean): string {
  const clean = email.trim().toLowerCase();
  const next = encodeURIComponent(KIT_DASHBOARD_PATH);
  const path = hasAccount ? "/login" : "/signup";
  return `${path}?email=${encodeURIComponent(clean)}&next=${next}`;
}

/** Absolute sign-in URL. The kit domain has no /signup route, so the button must leave that host. */
export function kitSignInHref(email: string, hasAccount: boolean): string {
  return `https://saassuite.ai${kitAuthDestination(email, hasAccount)}`;
}

/** Login only when this email already has a password. Anything else stays on signup. */
export function kitBuyerHasPassword(data: unknown, error: { message?: string } | null): boolean {
  if (error || !Array.isArray(data)) return false;
  const row = data[0] as { has_password?: boolean } | undefined;
  return row?.has_password === true;
}
