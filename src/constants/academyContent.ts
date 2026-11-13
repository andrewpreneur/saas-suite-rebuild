export type Stage = "foundation" | "build" | "market" | "sell";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "foundation", label: "Foundation" },
  { id: "build", label: "Build" },
  { id: "market", label: "Market" },
  { id: "sell", label: "Sell" },
];

export const STAGE_STYLES: Record<Stage, string> = {
  foundation: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  build: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  market: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  sell: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
};

export type AcademyLesson = {
  id: string;
  stage: Stage;
  title: string;
  videoUrl: string;
  durationMinutes: number;
  format: string;
  description?: string;
  thumbnailUrl?: string;
  externalUrl?: string;
};

export type AcademyPrompt = {
  id: string;
  stage: Stage;
  title: string;
  category: string;
  description: string;
  prompt: string;
};

export type AcademySkill = {
  id: string;
  stage: Stage;
  title: string;
  description: string;
  fileUrl?: string;
  fileLabel?: string;
  /** Opens an external link (e.g. a Google Doc) instead of downloading a file. */
  externalUrl?: string;
  /** Owner-only skill: locked for everyone except the SaaSSuite owner account. */
  ownerOnly?: boolean;
  /** Highlight the skill card with a NEW badge. */
  isNew?: boolean;
  /** File is uploaded and served unchanged from Supabase Storage. */
  storageManaged?: boolean;
};

export type TechTool = {
  id: string;
  name: string;
  url: string;
  description: string;
};

export const ACADEMY_LESSONS: AcademyLesson[] = [
  {
    id: "welcome-to-ghl",
    stage: "foundation",
    title: "Welcome to GoHighLevel",
    videoUrl: "https://www.youtube.com/embed/-w0gKpOJfeQ",
    durationMinutes: 120,
    format: "Presentation",
  },
  {
    id: "claude-tutorial",
    stage: "build",
    title: "Claude Tutorial For Beginners",
    videoUrl: "https://www.youtube.com/embed/pui6RSpqDtE",
    durationMinutes: 14,
    format: "Presentation",
  },
  {
    id: "email-marketing-101",
    stage: "market",
    title: "Email Marketing 101",
    videoUrl: "https://www.youtube.com/embed/eeEKchZAotI",
    durationMinutes: 13,
    format: "Presentation",
  },
  {
    id: "sell-without-calls",
    stage: "sell",
    title: "Sell Anything Online Without Sales Calls Using GoHighLevel",
    videoUrl: "https://www.youtube.com/embed/br7RmbG6wKs",
    durationMinutes: 17,
    format: "Presentation",
  },
  {
    id: "autopilot-saas-webinar",
    stage: "sell",
    title: "How to Build, Launch, & Monetize an Auto-Pilot, SaaS Product",
    videoUrl: "https://viralmeetings.com/replay/69eed50c0c1c0f01d771a478",
    externalUrl: "https://viralmeetings.com/replay/69eed50c0c1c0f01d771a478",
    durationMinutes: 60,
    format: "Webinar Replay",
  },
];

export const ACADEMY_PROMPTS: AcademyPrompt[] = [
  {
    id: "ghl-onboarding-welcome-agent",
    stage: "build",
    title: "GHL Onboarding Welcome Agent",
    category: "Onboarding",
    description: "Walks new clients through your software onboarding via SMS or chat",
    prompt: `You are an onboarding guide for [SaaS Product Name]. Your job is to help new users get their first win quickly.

When a new contact is created, send this sequence:
Message 1 (immediately): "Welcome to [Product]! I'm your setup guide. This will take about 5 minutes. First question: what's your business name so I can personalize your account?"

When they reply with business name:
Message 2: "Perfect. Your account is being set up for [business name]. Are you mainly looking to [Option A] or [Option B]?" (Fill in your core use cases)

Based on their answer, route them to the correct onboarding checklist link.

If they don't respond within 24 hours, send: "Hey — just checking in! Your account is ready. Here's your login: [Link]. Let me know if you have any questions."

Never overwhelm. One action per message. Celebrate small wins.`,
  },
  {
    id: "review-request-agent",
    stage: "market",
    title: "Review Request & Reputation Agent",
    category: "Reviews",
    description: "Requests Google reviews at the right moment with the right message",
    prompt: `You are a reputation manager for [Business Name]. Your job is to request reviews from happy customers at the perfect time.

Trigger: When a contact's pipeline stage moves to "Service Delivered" or a satisfaction tag is added.

Message 1 (send via SMS): "Hey [First Name]! It was great working with you. If you had a good experience, it would mean a lot if you left us a quick Google review — it only takes 60 seconds: [Review Link]. Thank you!"

If no response after 3 days:
Message 2: "Hi [First Name] — just a gentle follow-up! If you enjoyed working with us, a quick review helps us help more people like you: [Review Link]"

If they respond positively (detect keywords: great, love, amazing, helpful):
Reply: "Thank you so much! That really means a lot to us. Here's the direct link: [Review Link] — it only takes a minute!"

If they respond negatively: Immediately notify [Owner Name] via internal notification and do NOT send the review link. Flag for manual follow-up.`,
  },
  {
    id: "cold-lead-reactivation-agent",
    stage: "market",
    title: "Cold Lead Reactivation Agent",
    category: "Lead Gen",
    description: "Re-engages dead leads in your CRM with a conversational AI sequence",
    prompt: `You are a reactivation specialist for [Business Name]. Your job is to restart conversations with leads who went cold.

Target: Contacts who haven't responded in 30+ days and are tagged "Cold Lead."

Message 1 (SMS): "Hey [First Name] — it's been a while! Are you still looking for help with [pain point relevant to your offer]? A lot has changed on our end and I wanted to check in."

If they respond:
- Listen to what they say
- Ask one clarifying question: "What's the biggest obstacle right now?"
- Based on their answer, either offer a free resource OR book a call: "I'd love to catch you up — want to grab 15 minutes this week?" + [Calendar Link]

If no response after 5 days:
Message 2: "No worries if the timing isn't right — I'll leave this here in case it helps: [Resource Link]. Reach out anytime!"

After Message 2 with no response: tag as "Long-Term Nurture" and add to monthly newsletter list only.`,
  },
  {
    id: "appointment-booking-agent",
    stage: "sell",
    title: "Appointment Booking AI Agent",
    category: "Booking",
    description: "Qualifies leads and books calls on your GHL calendar automatically",
    prompt: `You are a professional appointment booking assistant for [Business Name]. Your job is to qualify leads and get them scheduled.

Greet warmly, then ask these qualification questions one at a time (never all at once):
1. "What's the main challenge you're trying to solve right now?"
2. "Are you currently generating leads or looking to start?"
3. "What's your monthly budget for tools and software?"

If they meet criteria (have a challenge, have budget intent), say: "Great — I'd love to get you on a call with our team. I'm going to send you a scheduling link right now: [Calendar Link]"

If they're not ready: "No problem at all — let me send you something helpful to get started: [Lead Magnet Link]"

Keep every message under 3 sentences. Never pitch. Never use exclamation marks. Always respond within the conversation thread.`,
  },
  {
    id: "trial-to-paid-agent",
    stage: "sell",
    title: "SaaS Trial-to-Paid Conversion Agent",
    category: "Conversion",
    description: "Converts free trial users to paid by providing value and removing friction",
    prompt: `You are a conversion specialist for [SaaS Product]. Your goal is to convert active trial users to paid subscribers before their trial ends.

Day 1 of trial (email): "Welcome to your [X]-day trial! Here's the #1 thing our best customers do in week one: [Specific action]. Try it today and reply if you have questions."

Day 3 (SMS if not logged in): "Hey [First Name] — noticed you haven't logged in yet. Is there anything blocking you? I'm here to help."

Day 5 (email): "Quick question — what's been the most useful feature so far? Reply and let me know. Also, here's a feature most people miss: [Feature]."

Day [X-2] before trial ends (SMS): "Your trial ends in 2 days! Here's what you'd be getting with the full plan: [3 bullet benefits]. Upgrade now and lock in [any promo]: [Upgrade Link]"

Trial end day (email): "Your trial has ended. But your progress is saved. Upgrade in the next 48 hours to keep your [data/settings/contacts]: [Upgrade Link]"

If they upgrade at any point: Send a celebration message and route to the onboarding agent.`,
  },
];

export const ACADEMY_SKILLS: AcademySkill[] = [
  {
    id: "master-ai-studio-seo-prompt",
    stage: "market",
    title: "Master AI Studio SEO Prompt",
    description:
      "The copy-paste prompt that turns AI Studio into an SEO content machine for your agency — open it, copy it, rank.",
    externalUrl:
      "https://docs.google.com/document/d/1uu93A3YmT1MP6FJizfsHa8qPmS4E4ymNqecdRAl5ChQ/edit?usp=drivesdk",
    isNew: true,
  },
  {
    id: "claude-ghl-skill",
    stage: "build",
    title: "Claude + GHL Skill",
    description:
      "Full operating framework for running GoHighLevel / LeadConnector through its MCP with Claude — capability map, clarify-build-handoff loop, daily operator routines, and automation patterns.",
    storageManaged: true,
    isNew: true,
  },
  {
    id: "saas-offer-builder",
    stage: "foundation",
    title: "SaaS Offer Builder",
    description:
      "Helps you craft irresistible SaaS offers with positioning, pricing, and packaging guidance.",
  },
  {
    id: "ui-ux-pro-max",
    stage: "build",
    title: "UI/UX Pro Max",
    description:
      "Comprehensive UI/UX design intelligence skill with 50+ styles, 161 color palettes, 57 font pairings, and 99 UX guidelines across 10 stacks.",
    fileUrl: "/skills/ui-ux-pro-max.md",
    fileLabel: "ui-ux-pro-max.md",
  },
  {
    id: "ghl-workflow-architect",
    stage: "build",
    title: "GHL Workflow Architect",
    description:
      "Claude skill file for designing and troubleshooting GoHighLevel automation workflows.",
  },
  {
    id: "lovable-app-planner",
    stage: "build",
    title: "Lovable App Planner",
    description:
      "Plans your Lovable app architecture, pages, and database schema before you start building.",
  },
  {
    id: "nano-banana",
    stage: "market",
    title: "Nano Banana",
    description:
      "Image generation skill using the Gemini CLI's nanobanana extension for thumbnails, icons, diagrams, patterns, and photo edits.",
    fileUrl: "/skills/nano-banana.md",
    fileLabel: "nano-banana.md",
  },
  {
    id: "ghl-wrapper",
    stage: "build",
    title: "GHL Wrapper",
    description:
      "Connect any frontend or app to the GoHighLevel (LeadConnector) API v2 — auth, credential storage, every endpoint group, webhooks, multi-tenant setups, and the quirks that cost hours to discover.",
    fileUrl: "/skills/ghl-wrapper.md",
    fileLabel: "ghl-wrapper.md",
    ownerOnly: true,
  },
  {
    id: "meta-ad-copy-generator",
    stage: "market",
    title: "Meta Ad Copy Generator",
    description:
      "Generates high-converting Facebook & Instagram ad copy based on your offer and audience.",
  },
  {
    id: "youtube-script-writer",
    stage: "market",
    title: "YouTube Script Writer",
    description:
      "Writes engaging YouTube scripts with hooks, retention strategies, and CTAs built in.",
  },
];

export const TECH_LIBRARY: TechTool[] = [
  {
    id: "gohighlevel",
    name: "GoHighLevel",
    url: "https://www.gohighlevel.com/5528b4?fp_ref=howtousehighlevel",
    description: "All-in-one CRM, funnels, automations, and SaaS mode for service businesses.",
  },
  {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai",
    description: "AI thinking partner for writing, strategy, research, and building skill files.",
  },
  {
    id: "manus",
    name: "Manus",
    url: "https://manus.im",
    description: "Autonomous AI agent for research, data analysis, and complex multi-step tasks.",
  },
  {
    id: "lovable",
    name: "Lovable",
    url: "https://lovable.dev/?via=howtousehighlevel",
    description: "Build full-stack web apps with natural language prompts — no code required.",
  },
  {
    id: "21stdev",
    name: "21st.dev",
    url: "https://21st.dev",
    description: "AI-powered UI component library for building modern interfaces fast.",
  },
  {
    id: "aceternity",
    name: "Aceternity",
    url: "https://ui.aceternity.com",
    description: "Beautiful animated React components for landing pages and marketing sites.",
  },
  {
    id: "magicui",
    name: "MagicUI",
    url: "https://magicui.design",
    description: "Copy-paste animated components built with React, TypeScript, and Tailwind.",
  },
  {
    id: "github",
    name: "GitHub",
    url: "https://github.com",
    description: "Version control and collaboration platform — your code's safety net.",
  },
];
