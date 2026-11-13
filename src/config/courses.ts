import type { CourseKey } from "@/components/course/CourseCheckout";

export interface CourseConfig {
  key: CourseKey;
  path: string;
  /** Small pill above the headline. */
  eyebrow: string;
  /** H1 — split on spaces for the word-by-word hero animation. */
  headline: string;
  subhead: string;
  /** Bold promise line under the hero video. */
  promise: string;
  /** "Who this is for" bullets. */
  forWho: string[];
  /** What's inside the course. */
  includes: { title: string; body: string }[];
  /** Guarantee block — omit terms for the no-guarantee variant. */
  guarantee: { headline: string; body: string; terms?: string[] };
  /** Price-card copy. */
  cardTitle: string;
  cardSubtitle: string;
  ctaLabel: string;
  seo: { title: string; description: string };
}

const SHARED_INCLUDES: CourseConfig["includes"] = [
  {
    title: "7 Day Setup Basics Video Course",
    body: "The exact week-one build: HighLevel account, snapshot, offer, and delivery — done in seven short sessions.",
  },
  {
    title: "25 Video Simple SaaS Training Course",
    body: "Twenty-five focused videos that take you from a raw GHL account to a sellable SaaS product.",
  },
  {
    title: "Ai Andrew — My AI Skill File",
    body: "Drop it into your AI tool and it answers exactly the way I would if I were sitting in your seat running your agency.",
  },
  {
    title: "GHL Brandless AI Studio Sales Video + SaaS Welcome Video",
    body: "Two finished, unbranded videos: one that sells the software, one that welcomes new clients. Both yours to brand.",
  },
  {
    title: "White Label Sales Page",
    body: "A proven page you can put your logo on and start sending traffic to today. No design work, no copywriting.",
  },
];

export const FIRST_CLIENT_COURSE: CourseConfig = {
  key: "first_client",
  path: "/first-ghl-client",
  eyebrow: "One-time $27 · Instant access",
  headline: "Get your first GHL Client in 30 Days",
  subhead:
    "A step-by-step path to your first HighLevel client. Everything you need to land client number one is already built for you.",
  promise: "The exact steps, pages, and offer we use to land client number one.",
  forWho: [
    "You have (or are about to get) a HighLevel account and zero clients",
    "You're tired of buying courses that stop at theory",
    "You want the videos, the page, and the offer handed to you",
  ],
  includes: SHARED_INCLUDES,
  guarantee: {
    headline: "What you get",
    body: "Instant lifetime access to every module, template, and page — yours to keep. Purchases are non-refundable; see our Refund Policy.",
    terms: [
      "Works alongside any paid HighLevel account",
      "Includes our white-label onboarding videos",
      "Includes the landing page and white-label sales video",
    ],
  },
  cardTitle: "Your First GHL Client",
  cardSubtitle: "The 30-day, get-a-client-or-don't-pay course.",
  ctaLabel: "Get the course — $27",
  seo: {
    title: "Get Your First GHL Client in 30 Days — $27 Course",
    description:
      "Land your first GoHighLevel client in 30 days or you don't pay. Includes the 7 Day Setup course, 25-video SaaS training, Ai Andrew skill file, brandless sales videos, and a white-label sales page.",
  },
};

export const AGENCY_FREEDOM_COURSE: CourseConfig = {
  key: "agency_freedom",
  path: "/digital-agency-freedom",
  eyebrow: "Digital Agency Freedom Course · One-time $27",
  headline: "Grow to 20+ Paying GHL Clients",
  subhead:
    "And achieve financial freedom. The system that turns a handful of one-off clients into predictable monthly SaaS revenue.",
  promise: "20+ paying clients is a repeatable process, not luck. This is the process.",
  forWho: [
    "You already have a client or two and want a real book of business",
    "You're trading hours for money and want recurring SaaS revenue instead",
    "You want onboarding, support, and delivery to run without you",
  ],
  includes: SHARED_INCLUDES,
  guarantee: {
    headline: "What you get",
    body: "Instant lifetime access to every module, template, and page — yours to keep. Purchases are non-refundable; see our Refund Policy.",
  },
  cardTitle: "Digital Agency Freedom Course",
  cardSubtitle: "Scale from a few clients to 20+ paying accounts.",
  ctaLabel: "Get the course — $27",
  seo: {
    title: "Digital Agency Freedom Course — Grow to 20+ GHL Clients | $27",
    description:
      "Scale to 20+ paying GoHighLevel clients and build recurring SaaS revenue. Includes the 7 Day Setup course, 25-video SaaS training, Ai Andrew skill file, brandless sales videos, and a white-label sales page.",
  },
};

export const COURSES: CourseConfig[] = [FIRST_CLIENT_COURSE, AGENCY_FREEDOM_COURSE];
