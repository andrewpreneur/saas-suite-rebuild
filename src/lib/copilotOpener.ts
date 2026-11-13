// Rule-based, instant proactive opener for the CoPilot.
// No AI call — reads plan + current route + a couple of quick account flags.

export interface Opener {
  message: string;
  suggestions: string[];
}

interface OpenerCtx {
  plan: string | null | undefined;
  route: string;
  brandingComplete?: boolean;
  supportWebhookSet?: boolean;
  welcomeConfigured?: boolean;
  firstName?: string | null;
  snapshot?: {
    totalUsers?: number;
    active7d?: number;
    sessions7d?: number;
    workflowsConfigured?: number;
    workflowsTotal?: number;
    brandingSet?: boolean;
    supportSet?: boolean;
  };
}

function planLabel(plan: string | null | undefined): string {
  switch ((plan || "").toUpperCase()) {
    case "ADVANCED": return "Advanced";
    case "BASIC": return "Basic";
    default: return "Starter";
  }
}

export function computeCopilotOpener(ctx: OpenerCtx): Opener {
  const plan = (ctx.plan || "STARTER").toUpperCase();
  const route = ctx.route || "/";
  const rawName = (ctx.firstName || "").trim();
  const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase() : "";
  const hi = name ? `Hey ${name}` : "Hey";
  const snap = ctx.snapshot;

  // If we have a data snapshot, prefer a personalized dynamic opener over
  // the route-based generic ones — this is the main app landing case.
  if (snap && (route === "/" || route.startsWith("/app"))) {
    const parts: string[] = [];
    const total = snap.totalUsers ?? 0;
    const active = snap.active7d ?? 0;
    if (total > 0) {
      parts.push(`you have ${total} user${total === 1 ? "" : "s"}`);
      parts.push(`${active} active this week`);
    } else {
      parts.push("no users yet");
    }
    const setup: string[] = [];
    const gaps: string[] = [];
    if (snap.brandingSet) setup.push("branding"); else gaps.push("branding");
    if (snap.supportSet) setup.push("support ticketing"); else gaps.push("support ticketing");
    if ((snap.workflowsConfigured ?? 0) > 0) setup.push("workflows"); else if (plan === "ADVANCED") gaps.push("workflows");

    const setupLine = setup.length ? ` You've set up ${setup.join(", ")}.` : "";
    const gapLine = gaps.length ? ` Haven't set up ${gaps.slice(0, 2).join(" or ")} yet.` : "";
    const suggestions: string[] = [];
    if (gaps.includes("branding")) suggestions.push("Set up my branding");
    if (gaps.includes("support ticketing")) suggestions.push("Turn on support ticketing");
    if (gaps.includes("workflows")) suggestions.push("Show me workflow options");
    if (total > 0) suggestions.push("Look up a user");
    if (suggestions.length < 3) suggestions.push("Give me an account health check");

    return {
      message: `${hi} — ${parts.join(", ")}.${setupLine}${gapLine} What would you like to do next?`,
      suggestions: suggestions.slice(0, 4),
    };
  }

  if (route.startsWith("/branding-tool")) {
    return {
      message: ctx.brandingComplete
        ? "Your branding looks set. Want to push it to HighLevel or tweak a color?"
        : "Let's get your brand colors dialed in — what's your primary color?",
      suggestions: ["Set my brand colors", "Push branding to GHL", "Preview my current colors"],
    };
  }
  if (route.includes("/support")) {
    return {
      message: ctx.supportWebhookSet
        ? "Support ticketing is wired up. Want to test a webhook payload?"
        : "Set up your inbound webhook so support tickets notify you — want the exact HighLevel steps?",
      suggestions: ["Configure my webhook", "Show me the HL setup steps", "Turn on support ticketing"],
    };
  }
  if (route.includes("/workflow")) {
    if (plan !== "ADVANCED") {
      return {
        message: "Workflows are on the Advanced plan — want a quick tour of what they can trigger?",
        suggestions: ["What can workflows do?", "How do I upgrade?", "Go back to my dashboard"],
      };
    }
    return {
      message: "Want me to list your workflows or wire up a new one?",
      suggestions: ["List my workflows", "Trigger a workflow", "Explain trigger types"],
    };
  }
  if (route.startsWith("/v2-onboarding") || route.startsWith("/initial-questions")) {
    return {
      message: "I can walk you through the next setup step — want me to pick the highest-impact one?",
      suggestions: ["What's my next step?", "Skip onboarding", "Show me my checklist"],
    };
  }
  if (route.includes("/app/branding") || route.includes("/app/home")) {
    return {
      message: ctx.welcomeConfigured
        ? "Your home page is set. Want to fine-tune the welcome text or add a video?"
        : "Let's set your welcome headline first — what should it say?",
      suggestions: ["Update welcome text", "Add a welcome video", "Show my current settings"],
    };
  }

  const suggestions: string[] = [];
  if (plan === "STARTER") {
    suggestions.push("What's included in my plan?", "How do I add branding?", "Set up support ticketing");
  } else if (plan === "BASIC") {
    suggestions.push("Set up AI chat support", "Configure my brand colors", "How do I remove menu links?");
  } else {
    suggestions.push("Give me an account health check", "List my workflows", "Look up a user");
  }

  return {
    message: `${hi}! You're on the ${planLabel(plan)} plan. What can I help you set up next?`,
    suggestions,
  };
}
