export interface AlternativePage {
  slug: string;
  competitor: string;
  headline: string;
  subheadline: string;
  differentiators: { title: string; body: string }[];
  faq: { question: string; answer: string }[];
  /** Short positioning line shown above the fold */
  eyebrow?: string;
  /** What people tell us they were paying / dealing with before */
  painPoints?: string[];
  /** Feature-by-feature comparison rows */
  comparison?: { feature: string; saassuite: string; them: string }[];
  /** Feature groups for the "everything you get" section */
  featureGroups?: { title: string; items: string[] }[];
}

export interface NichePage {
  slug: string;
  niche: string;
  headline: string;
  subheadline: string;
  useCases: { title: string; body: string }[];
  faq: { question: string; answer: string }[];
}

export const SAASSUITE_FEATURE_GROUPS: { title: string; items: string[] }[] = [
  {
    title: "Client onboarding",
    items: [
      "Interactive walkthroughs that run inside your client's HighLevel account",
      "Video onboarding modules you can reorder, rename, and brand",
      "Daily + onboarding checklists so clients know what to do next",
      "Self-serve activation — fewer kickoff calls on your calendar",
    ],
  },
  {
    title: "AI + human support",
    items: [
      "AI chat trained on your own knowledge base and prompts",
      "Human handover with ticketing, so nothing gets dropped",
      "Image attachments both directions in chat",
      "Optional Premium Support ($297/mo) and 24/7 coverage add-ons",
    ],
  },
  {
    title: "White-label branding",
    items: [
      "CSS-level control of colors, fonts, and logos",
      "Branded login page and client hub",
      "Custom domain available on Advanced ($49/mo add-on)",
      "Menu link removal so HighLevel stays invisible",
    ],
  },
  {
    title: "Retention & growth",
    items: [
      "Login tracking and activation signals per client",
      "Behavioral churn-risk indicators",
      "Community, courses, prompts, and skill packs for your team",
      "Affiliate program at 30% recurring, paid on the 1st and 15th",
    ],
  },
];

const CORE_COMPARISON: { feature: string; saassuite: string; them: string }[] = [
  { feature: "Free plan to start", saassuite: "Yes — Starter is free, forever", them: "Check their current plans" },
  { feature: "Contract required", saassuite: "None — month to month, cancel anytime", them: "Varies by plan" },
  { feature: "Entry paid price", saassuite: "$27/mo (Basic) · $97/mo (Advanced)", them: "Quoted per agency" },
  { feature: "Interactive in-app walkthroughs", saassuite: "Built in, step-by-step inside HighLevel", them: "Compare against their feature list" },
  { feature: "AI chat trained on your knowledge base", saassuite: "Native, with human handover + ticketing", them: "Compare against their feature list" },
  { feature: "CSS-level white-label branding", saassuite: "Colors, fonts, logo, login page, custom domain", them: "Compare against their feature list" },
  { feature: "Retention & churn signals", saassuite: "Login tracking, activation + behavioral signals", them: "Compare against their feature list" },
  { feature: "Done-for-you fulfillment option", saassuite: "Agency Support from $49/account/mo", them: "Ask about their service tiers" },
];

export const ALTERNATIVE_PAGES: AlternativePage[] = [
  {
    slug: "ghlengine",
    competitor: "GHLEngine",
    headline: "The SaaSSuite alternative to GHLEngine",
    subheadline:
      "GHLEngine focuses on snapshots and support templates. SaaSSuite is a full white-label platform: onboarding, native AI support, branding, and retention — purpose-built for HighLevel SaaS agencies.",
    eyebrow: "No contracts. No setup fees. Free to start.",
    painPoints: [
      "Agencies tell us they don't want to sign an annual contract to test a support tool.",
      "Four-figure monthly retainers don't work until your SaaS is actually profitable.",
      "Snapshots and PDFs don't onboard clients — clients still book calls with you.",
      "Bolting on a generic chat widget isn't the same as branded AI support with human handover.",
    ],
    comparison: CORE_COMPARISON,
    featureGroups: SAASSUITE_FEATURE_GROUPS,
    differentiators: [
      {
        title: "Interactive onboarding, not just snapshots",
        body: "Guided walkthroughs, video onboarding, and a daily checklist that live inside your client's HighLevel account — so new users activate without a call.",
      },
      {
        title: "Native AI support, not third-party bots",
        body: "AI chat trained on your knowledge base with true human handover, ticketing, and 24/7 coverage — all under your brand.",
      },
      {
        title: "True CSS-level white-label",
        body: "Custom domain, colors, fonts, logo, and login page — matching your agency identity end-to-end.",
      },
    ],
    faq: [
      {
        question: "Can I switch from GHLEngine to SaaSSuite?",
        answer:
          "Yes. SaaSSuite installs on top of HighLevel exactly like GHLEngine does, so switching is a matter of updating the custom menu link and reconnecting your branding — no migration of client data required.",
      },
      {
        question: "Do I need to keep GHLEngine's snapshots?",
        answer:
          "No — your existing HighLevel snapshots stay in place. SaaSSuite adds the onboarding, AI support, and branding layer on top of whatever snapshots you already sell.",
      },
    ],
  },
  {
    slug: "hlprotools",
    competitor: "HLProTools",
    headline: "SaaSSuite vs HLProTools for HighLevel agencies",
    subheadline:
      "HLProTools bundles utilities and support add-ons. SaaSSuite is a single platform that combines onboarding, AI support, branding, and retention — designed around HighLevel SaaS mode.",
    eyebrow: "No contracts. No setup fees. Free to start.",
    painPoints: [
      "You shouldn't need five separate add-ons to give clients one coherent experience.",
      "No annual commitment — SaaSSuite is month to month, and Starter is free.",
      "You don't need a four-figure monthly bill to look like a real software company.",
      "Support tickets, AI chat, onboarding, and branding should live in one dashboard.",
    ],
    comparison: CORE_COMPARISON,
    featureGroups: SAASSUITE_FEATURE_GROUPS,
    differentiators: [
      {
        title: "One platform, not a bundle of tools",
        body: "Onboarding, AI chat, branding, ticketing, and retention live in one dashboard — no toggling between disconnected utilities.",
      },
      {
        title: "Interactive walkthroughs built in",
        body: "Guide clients step-by-step inside their own HighLevel account instead of pointing them at a static help site.",
      },
      {
        title: "Retention automations, not just support",
        body: "Login tracking, behavioral signals, and daily checklists surface churn risk before you lose the client.",
      },
    ],
    faq: [
      {
        question: "Can I run SaaSSuite alongside HLProTools during migration?",
        answer:
          "Yes. SaaSSuite is modular, so you can enable branding or AI support on top of HLProTools first, then move onboarding and ticketing over once you're ready.",
      },
    ],
  },
  {
    slug: "extendly",
    competitor: "Extendly",
    headline: "SaaSSuite vs Extendly — a modern HighLevel white-label toolkit",
    subheadline:
      "Extendly focuses on support snapshots. SaaSSuite delivers a full onboarding, AI, branding, and retention platform.",
    eyebrow: "No contracts. No setup fees. Free to start.",
    painPoints: [
      "Start free and upgrade when your SaaS is making money — not before.",
      "Month-to-month billing, so you're never locked into a term you can't exit.",
      "AI support that's actually yours: your prompts, your knowledge base, your brand.",
      "Onboarding that replaces kickoff calls instead of adding another PDF.",
    ],
    comparison: CORE_COMPARISON,
    featureGroups: SAASSUITE_FEATURE_GROUPS,
    differentiators: [
      {
        title: "AI-first support",
        body: "Native AI chat trained on your brand, plus ticketing, human handover, and 24/7 coverage.",
      },
      {
        title: "Onboarding built in",
        body: "Interactive walkthroughs and video onboarding so clients activate themselves.",
      },
      {
        title: "White-label branding tool",
        body: "Full CSS-level customization of the HighLevel client experience.",
      },
    ],
    faq: [
      {
        question: "Can I run SaaSSuite alongside my current support provider?",
        answer:
          "Yes. SaaSSuite is modular — enable only the pieces (AI support, onboarding, branding) you want.",
      },
    ],
  },
];

export const NICHE_PAGES: NichePage[] = [
  {
    slug: "med-spas",
    niche: "med spas",
    headline: "HighLevel white-label SaaS for med spa agencies",
    subheadline:
      "Give your med spa clients a branded SaaS experience — with onboarding, AI support, and retention built for beauty and wellness businesses.",
    useCases: [
      {
        title: "Consult booking flows",
        body: "Pre-built walkthroughs for consult calendars, deposit collection, and follow-up.",
      },
      {
        title: "Review & referral automations",
        body: "Onboard clients into your best-performing HighLevel workflows in minutes.",
      },
      {
        title: "AI support for treatment questions",
        body: "Your knowledge base drives the AI, so clients get answers without pinging your team.",
      },
    ],
    faq: [
      {
        question: "Does SaaSSuite work with med spa HighLevel snapshots?",
        answer:
          "Yes — SaaSSuite runs on top of any HighLevel account and any snapshot.",
      },
    ],
  },
  {
    slug: "real-estate",
    niche: "real estate",
    headline: "HighLevel white-label SaaS for real estate agencies",
    subheadline:
      "Onboard real estate teams into your HighLevel SaaS with branded walkthroughs, AI support, and retention playbooks tuned for agents and brokerages.",
    useCases: [
      {
        title: "Lead nurture playbooks",
        body: "Guided onboarding for IDX integrations, SMS drips, and appointment funnels.",
      },
      {
        title: "Brokerage-level branding",
        body: "White-label the entire HighLevel client experience under the brokerage's identity.",
      },
      {
        title: "24/7 AI support",
        body: "Answer 'how do I add a listing' at 11pm without waking your team.",
      },
    ],
    faq: [
      {
        question: "Can I sell SaaSSuite to individual agents?",
        answer:
          "Yes — SaaSSuite scales from single-agent seats up to full brokerage rollouts.",
      },
    ],
  },
  {
    slug: "chiropractors",
    niche: "chiropractors",
    headline: "HighLevel white-label SaaS for chiropractic agencies",
    subheadline:
      "Deliver a branded HighLevel SaaS to chiropractic offices — with onboarding, AI support, and retention built for healthcare service providers.",
    useCases: [
      {
        title: "New patient intake",
        body: "Onboard practices into intake-form and reminder workflows in a single guided flow.",
      },
      {
        title: "Recall & reactivation",
        body: "Preconfigured HighLevel campaigns for lapsed-patient reactivation.",
      },
      {
        title: "HIPAA-conscious messaging",
        body: "AI support responds within your defined boundaries and escalates sensitive topics to your team.",
      },
    ],
    faq: [
      {
        question: "Is SaaSSuite HIPAA-compliant?",
        answer:
          "SaaSSuite itself doesn't store PHI. It layers UX and support on top of HighLevel — you configure PHI handling inside HighLevel itself.",
      },
    ],
  },
  {
    slug: "law-firms",
    niche: "law firms",
    headline: "HighLevel white-label SaaS for legal marketing agencies",
    subheadline:
      "Onboard law firms into a branded HighLevel SaaS with intake, reminder, and case-follow-up flows built for legal.",
    useCases: [
      {
        title: "Consult intake",
        body: "Guided setup for consult calendars, conflict checks, and deposit flows.",
      },
      {
        title: "Case pipeline automations",
        body: "Deploy your best legal HighLevel workflows through a self-serve walkthrough.",
      },
      {
        title: "Compliance-aware AI",
        body: "AI support answers process questions and defers legal advice to your attorneys.",
      },
    ],
    faq: [
      {
        question: "Can attorneys log in and see a branded experience?",
        answer:
          "Yes — the client-facing HighLevel experience is fully white-labeled under your agency (or the firm's) brand.",
      },
    ],
  },
];