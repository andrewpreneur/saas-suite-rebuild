import { KIT_DELIVERABLES, type KitDeliverable, type KitDeliverableState } from "@/lib/kitDelivery";
import { MENU_REMOVAL_VIDEO } from "@/lib/startHere";

export const KIT_LAUNCH_VIDEO =
  "https://files.leadconnectorhq.com/file/6af5f1314dccfd82dad9f5e2/onefeaturelaunchq-a.mp4";

/** Same destination Start Here uses to install the menu link inside HighLevel. */
export const KIT_INSTALL_PATH = "/app/client-hub?panel=installation-guide";

export type KitStepAction = {
  href: string | null;
  label: string;
  /** Fetches the paid snapshot URL from the server. The share id stays out of the client bundle. */
  kind?: "snapshot";
};

export type KitOnboardingStep = {
  id: string;
  title: string;
  subtitle: string;
  mediaSrc: string | null;
  notes: string[];
  preview: { src: string; alt: string } | null;
  actions: KitStepAction[];
};

export type KitOnboardingProgress = {
  completed: string[];
  selected: string | null;
};

export type KitProgressStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type KitAddonView = {
  id: string;
  title: string;
  detail: string;
  unlocked: boolean;
  priceLabel: string;
  buyHref: string;
  statusLabel: "Not started" | "In progress" | "Marked done" | "Confirmed" | "Purchased" | "Included";
  status: string;
  next: string;
  missing: string | null;
  /** Set when the purchase is known and the request behind it cannot be read back. */
  confirmationNote: string | null;
  actions: KitStepAction[];
};

function deliverable(id: string): KitDeliverable {
  const item = KIT_DELIVERABLES.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing kit deliverable ${id}`);
  return item;
}

function videoSrc(href: string | null): string | null {
  if (!href) return null;
  return /\.(mp4|webm|mov)(\?|$)/i.test(href) ? href : null;
}

function imageSrc(href: string | null): string | null {
  if (!href) return null;
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(href) ? href : null;
}

export function kitOnboardingSteps(ownedLineIds: Iterable<string>): KitOnboardingStep[] {
  const owned = new Set(ownedLineIds);
  const replay = deliverable("bump-replay");
  const snapshot = deliverable("snapshot");
  const video = deliverable("white-label-video");
  const setup = deliverable("instructional-video");
  const training = deliverable("training");
  const menu = deliverable("menu-link-removal");
  const sales = deliverable("sales-page");
  const ad = deliverable("ad-template");
  const copilot = deliverable("copilot");
  const basic = deliverable("basic-30");
  const launch = deliverable("launch");
  const adImage = imageSrc(ad.href);

  const steps: KitOnboardingStep[] = [];

  if (owned.has("bump-replay")) {
    steps.push({
      id: "replay",
      title: "Watch the 90-minute training",
      subtitle: "Watch the full replay as many times as you want.",
      mediaSrc: videoSrc(replay.href),
      notes: [],
      preview: null,
      actions: [{ href: replay.href, label: replay.action ?? "Watch the replay" }],
    });
  }

  steps.push({
    id: "install-saas",
    title: "Install SaaSSuite",
    subtitle:
      "Connect HighLevel and install your menu link. Basic covers your first 5 customers for 30 days.",
    mediaSrc: null,
    notes: basic.href
      ? []
      : [
          "SaaSSuite Basic for 30 days is included. A separate signup link for that plan isn't in the app yet.",
        ],
    preview: null,
    actions: [
      { href: KIT_INSTALL_PATH, label: "Open the install guide" },
      basic.href
        ? { href: basic.href, label: "Open SaaSSuite Basic" }
        : { href: copilot.href, label: "Ask Copilot" },
    ],
  });

  steps.push({
    id: "install-snapshot",
    title: "Install the snapshot",
    subtitle:
      "Import the Menu Link Removal snapshot so customers see one feature, not the full menu.",
    mediaSrc: null,
    notes: [],
    preview: null,
    actions: [
      { href: null, label: snapshot.action ?? "Import the snapshot", kind: "snapshot" },
      { href: menu.href, label: "Open menu removal" },
    ],
  });

  steps.push({
    id: "customize-video",
    title: "Customize the sales video",
    subtitle:
      "Download the white-label AI Studio video and brand it in Claude with your logo and colors.",
    mediaSrc: videoSrc(video.href),
    notes: [],
    preview: null,
    actions: [{ href: video.href, label: video.action ?? "Download the video" }],
  });

  steps.push({
    id: "saas-training",
    title: "Watch the SaaSSuite training",
    subtitle: "The 20-minute setup walks through how to use SaaSSuite.",
    mediaSrc: videoSrc(setup.href),
    notes: [],
    preview: null,
    actions: [
      { href: setup.href, label: setup.action ?? "Watch the setup" },
      { href: training.href, label: training.action ?? "Watch the training" },
    ],
  });

  steps.push({
    id: "menu-training",
    title: "Watch the menu training",
    subtitle: "Watch the Menu Link Removal training, then hide every link except the one feature.",
    mediaSrc: MENU_REMOVAL_VIDEO.src || null,
    notes: [],
    preview: null,
    actions: [{ href: menu.href, label: "Open menu removal" }],
  });

  steps.push({
    id: "sales-page",
    title: "Create your sales page",
    subtitle: "Start from the sales page we gave you, then put your video on it.",
    mediaSrc: null,
    notes: [],
    preview: null,
    actions: [{ href: sales.href, label: "Open the sales page" }],
  });

  steps.push({
    id: "launch-ads",
    title: "Launch ads",
    subtitle: "Open the ads folder, download the ad template, and start your first campaign.",
    mediaSrc: null,
    notes: [],
    preview: adImage ? { src: adImage, alt: ad.title } : null,
    actions: [
      { href: launch.href ?? "#kit-ad-templates", label: "Open the ads" },
      { href: ad.href, label: ad.action ?? "Download the template" },
    ],
  });

  steps.push({
    id: "launch-video",
    title: "Watch the launch video",
    subtitle: "Watch the launch Q&A before you go live with your one feature offer.",
    mediaSrc: KIT_LAUNCH_VIDEO,
    notes: [],
    preview: null,
    actions: [{ href: KIT_LAUNCH_VIDEO, label: "Watch the launch video" }],
  });

  return steps;
}

export function emptyKitProgress(): KitOnboardingProgress {
  return { completed: [], selected: null };
}

export function kitProgressStorageKey(userId: string): string {
  return `kit-onboarding:${userId}`;
}

export function parseKitProgress(raw: string | null): KitOnboardingProgress {
  if (!raw) return emptyKitProgress();
  try {
    const value = JSON.parse(raw) as { completed?: unknown; selected?: unknown };
    const completed = Array.isArray(value.completed)
      ? [...new Set(value.completed.filter((id): id is string => typeof id === "string"))]
      : [];
    const selected = typeof value.selected === "string" ? value.selected : null;
    return { completed, selected };
  } catch {
    return emptyKitProgress();
  }
}

export function readKitProgress(
  userId: string | null,
  storage: KitProgressStorage | null,
): KitOnboardingProgress {
  if (!userId || !storage) return emptyKitProgress();
  try {
    return parseKitProgress(storage.getItem(kitProgressStorageKey(userId)));
  } catch {
    return emptyKitProgress();
  }
}

export function writeKitProgress(
  userId: string | null,
  progress: KitOnboardingProgress,
  storage: KitProgressStorage | null,
): void {
  if (!userId || !storage) return;
  try {
    storage.setItem(
      kitProgressStorageKey(userId),
      JSON.stringify({
        completed: progress.completed,
        selected: progress.selected,
      }),
    );
  } catch {
    // A blocked storage write still leaves the choice on screen for this visit.
  }
}

export function withStepCompleted(
  progress: KitOnboardingProgress,
  stepId: string,
): KitOnboardingProgress {
  if (progress.completed.includes(stepId)) return progress;
  return { ...progress, completed: [...progress.completed, stepId] };
}

export function withStepSelected(
  progress: KitOnboardingProgress,
  stepId: string,
): KitOnboardingProgress {
  return { ...progress, selected: stepId };
}

export function kitStepProgress(steps: { id: string }[], completed: Iterable<string>) {
  const done = new Set(completed);
  const completedCount = steps.filter((step) => done.has(step.id)).length;
  const current = steps.find((step) => !done.has(step.id)) ?? null;
  return {
    completedCount,
    total: steps.length,
    label: `${completedCount}/${steps.length}`,
    currentId: current?.id ?? null,
  };
}

export function resolveSelectedStep(
  steps: { id: string }[],
  progress: KitOnboardingProgress,
): string | null {
  if (steps.length === 0) return null;
  if (progress.selected && steps.some((step) => step.id === progress.selected))
    return progress.selected;
  return kitStepProgress(steps, progress.completed).currentId ?? steps[steps.length - 1].id;
}

const ADDON_COPY: Record<
  string,
  {
    statusLabel: "Not started" | "In progress" | "Purchased";
    status: string;
    next: string;
    missing: string | null;
  }
> = {
  "bump-replay": {
    statusLabel: "Not started",
    status: "Watch the replay from the first training step.",
    next: "Watch it here, or open it as the first training step.",
    missing: null,
  },
  "bump-video": {
    statusLabel: "In progress",
    status: "In progress. Send your logo on the onboarding form and we'll email the branded video.",
    next: "Open the intake form and send your logo. That starts the branded video.",
    missing: "The branded video isn't linked in the app yet.",
  },
  "bump-install": {
    statusLabel: "In progress",
    status:
      "Setup requested. Use the intake form. A direct Slack channel confirms the install. No call. We'll email you when it's done.",
    next: "Finish the intake form. We'll confirm in Slack and email you when the install is done.",
    missing: "There's no install tracker link in the app yet.",
  },
  launch: {
    statusLabel: "Not started",
    status: "All 17 creatives are in the ads library on this page.",
    next: "Download a creative, copy its prompt, or send your logo on the form in the library.",
    missing: null,
  },
  "webinar-system": {
    statusLabel: "Not started",
    status: "The training module is open.",
    next: "Open the training and set up your webinar. WebinarKit is a separate account and is not included.",
    missing: null,
  },
};

export function kitAddonViews(items: KitDeliverableState[]): KitAddonView[] {
  return items
    .filter((item) => item.group === "addon")
    .map((item) => {
      const copy = ADDON_COPY[item.id] ?? {
        statusLabel: "Not started" as const,
        status: item.detail,
        next: "Open the link below.",
        missing: null,
      };
      const actions: KitStepAction[] = [];
      if (item.action || item.href) actions.push({ href: item.href, label: item.action ?? "Open" });
      if (item.intakeHref && item.intakeAction)
        actions.push({ href: item.intakeHref, label: item.intakeAction });
      const missing = item.unlocked
        ? item.href
          ? null
          : (copy.missing ?? "This file isn't linked in the app yet.")
        : null;
      const digitalIncluded =
        item.unlocked && (item.id === "launch" || item.id === "webinar-system");
      const requestableService =
        item.unlocked && (item.id === "bump-video" || item.id === "bump-install");
      return {
        id: item.id,
        title: item.title,
        detail: item.detail,
        unlocked: item.unlocked,
        priceLabel: item.priceLabel,
        buyHref: item.buyHref,
        statusLabel: digitalIncluded
          ? "Confirmed"
          : requestableService
            ? "Included"
            : copy.statusLabel,
        status: digitalIncluded
          ? "Included with your account."
          : (item.status ?? copy.status),
        next: copy.next,
        missing,
        confirmationNote: requestableService
          ? "Included with your account. Open the intake form to request it. The form is write-only, so the request itself stays unverified."
          : null,
        actions,
      };
    });
}
