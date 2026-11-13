import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AGENTS_CHECKOUT_PLAN,
  AGENTS_PLAN_NAME,
  AGENTS_PLAN_PRICE,
  AGENTS_WEEKLY_TOKENS,
  agentsPlanState,
  agentsPlanStateFromRead,
  agentsPublicCopy,
  agentsWeeklyTokenLine,
} from "../src/lib/agentsOffer";
import { fewestLabeledSidebarSection, typicalSidebarLinkCounts } from "../src/lib/sidebarNav";
import { SAAS_PLANS } from "../src/constants/pricingPlans";

const VENDOR_TERMS = [
  "grok",
  "cursor",
  "openai",
  "anthropic",
  "claude",
  "chatgpt",
  "gpt-4",
  "gpt-5",
  "gemini",
  "lovable",
];

describe("agents plan state", () => {
  test("Starter, Basic, and Advanced see the upgrade", () => {
    expect(agentsPlanState({ plan: "STARTER", premium_support: false })).toBe("upgrade");
    expect(agentsPlanState({ plan: "BASIC", premium_support: false })).toBe("upgrade");
    expect(agentsPlanState({ plan: "ADVANCED", premium_support: false })).toBe("upgrade");
    expect(agentsPlanState({ plan: "starter" })).toBe("upgrade");
    expect(agentsPlanState(null)).toBe("upgrade");
  });

  test("Premium Support is included, including the flag on an Advanced row", () => {
    expect(agentsPlanState({ plan: "ADVANCED", premium_support: true })).toBe("included");
    expect(agentsPlanState({ plan: "PREMIUM", premium_support: false })).toBe("included");
    expect(agentsPlanState({ plan: "enhanced" })).toBe("included");
    expect(agentsPlanState({ plan: "Premium Support" })).toBe("included");
  });

  test("a failed plan read does not claim the feature is included", () => {
    expect(agentsPlanStateFromRead({ plan: "ADVANCED", premium_support: true }, true)).toBe(
      "upgrade",
    );
    expect(agentsPlanStateFromRead(null, false)).toBe("upgrade");
    expect(agentsPlanStateFromRead({ plan: "ADVANCED", premium_support: true }, false)).toBe(
      "included",
    );
  });

  test("the weekly token allowance is a single unset placeholder", () => {
    expect(AGENTS_WEEKLY_TOKENS).toBeNull();
    expect(agentsWeeklyTokenLine()).toBe("Includes a weekly token allowance.");
    expect(agentsWeeklyTokenLine(null)).toBe("Includes a weekly token allowance.");
    expect(agentsWeeklyTokenLine(1200)).toBe("Includes 1,200 tokens each week.");
  });

  test("the upgrade uses the existing Premium Support checkout", () => {
    expect(AGENTS_PLAN_NAME).toBe("Premium Support");
    expect(AGENTS_PLAN_PRICE).toBe(297);
    expect(SAAS_PLANS.premium.monthlyPrice).toBe(297);
    expect(AGENTS_CHECKOUT_PLAN).toBe("enhanced");
  });

  test("customer-facing copy does not name an AI vendor or model", () => {
    const copy = agentsPublicCopy().toLowerCase();
    for (const term of VENDOR_TERMS) {
      expect(copy.includes(term)).toBe(false);
    }
    const page = readFileSync(
      new URL("../src/components/agents/AgentsPage.tsx", import.meta.url),
      "utf8",
    ).toLowerCase();
    for (const term of VENDOR_TERMS) {
      expect(page.includes(term)).toBe(false);
    }
  });
});

describe("agents sidebar placement", () => {
  test("Resources is the labeled section with the fewest links for a typical owner", () => {
    const counts = typicalSidebarLinkCounts();
    expect(counts).toEqual([
      { id: "home", label: "Home", count: 1 },
      { id: "build", label: "Client Hub", count: 5 },
      { id: "grow", label: "Resources", count: 3 },
      { id: "more", label: "More Tools", count: 6 },
    ]);
    expect(fewestLabeledSidebarSection().label).toBe("Resources");
  });
});
