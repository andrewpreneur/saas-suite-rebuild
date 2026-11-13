import { accountRank, UPGRADE_PLANS } from "../../supabase/functions/chat-copilot/billingPolicy.ts";
import { DESIGN_PATH } from "@/lib/appRoutes";

export const START_HERE_TABS = ["onboarding", "education", "support"] as const;
export type StartHereTab = (typeof START_HERE_TABS)[number];
export const WALKTHROUGH_VIDEO =
  "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6aaca43e7bf7555bc30e9a17.mp4";
export const INTRO_VIDEO =
  "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1251673c3aed7c639fbc38.mp4";
export const MENU_REMOVAL_VIDEO: StartHereVideo = {
  id: "menu-link-removal",
  title: "Menu Link Removal",
  duration: "Training video",
  src: "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6acfd5f2f2103dccac63aa82.mp4",
  poster: "",
  type: "video",
  category: "menu",
};

export interface StartHereVideo {
  id: string;
  title: string;
  duration: string;
  src: string;
  poster: string;
  type: "video" | "lesson";
  category: "setup" | "client-hub" | "branding" | "menu";
}

export const ONBOARDING_VIDEOS: StartHereVideo[] = [
  {
    id: "what-is-saassuite",
    title: "What is SaaSSuite and How it Works",
    duration: "4:37",
    src: INTRO_VIDEO,
    poster:
      "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/69ce0b2e66c8fcfd16f88de4.gif",
    type: "video",
    category: "setup",
  },
  {
    id: "platform-walkthrough",
    title: "How to Setup, Understand, and Utilize SaaSSuite",
    duration: "20 minutes",
    src: WALKTHROUGH_VIDEO,
    poster: "/lovable-uploads/onboardingthumbnail.png",
    type: "video",
    category: "setup",
  },
];

export const SETUP_STEPS = [
  {
    id: "highlevel",
    title: "Connect your HighLevel account",
    description: "Connect with your agency’s private integration token in Settings.",
    path: "/app/highlevel",
  },
  {
    id: "install",
    title: "Install your custom menu link, CSS & JS",
    description: "Open the Client Hub installation guide to put your hub inside HighLevel.",
    path: "/app/client-hub?panel=installation-guide",
  },
  {
    id: "hub",
    title: "Configure your Client Hub",
    description: "Choose your videos and add welcome sections for your agency’s clients.",
    path: "/app/client-hub?hubTab=home",
  },
] as const;

/** Older checklist entries stay reachable from walkthroughs, not the three setup steps. */
export const WALKTHROUGH_LINKS = [
  { id: "support", title: "Customize support", path: "/app/support" },
  { id: "streamline", title: "Set up menu link removal", path: "/app/streamline" },
  { id: "success-call", title: "Book a Success Call", path: "/success" },
] as const;

export const START_HERE_STEPS = SETUP_STEPS;

export const FREE_RESOURCES = [
  { id: "prompts", title: "Prompts", path: "/app/community/prompts" },
  { id: "skills", title: "Skills", path: "/app/community/skills" },
  { id: "snapshots", title: "Snapshots", path: "/app/community/snapshots" },
  { id: "tech", title: "Tech Stack", path: "/app/community/tech" },
] as const;

export function startHereDestination(id: string, path: string, plan: string | null): string {
  const belowBasic = accountRank({ plan: plan || undefined }) < UPGRADE_PLANS.basic.rank;
  if (belowBasic && id === "streamline") return "/app/billing";
  if (id === "branding") return belowBasic ? DESIGN_PATH : path;
  return path;
}
export function resolveStartHereTab(value?: string): StartHereTab {
  return START_HERE_TABS.find((tab) => tab === value) ?? "onboarding";
}
