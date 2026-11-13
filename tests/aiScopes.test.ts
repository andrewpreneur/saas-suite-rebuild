import { expect, test } from "bun:test";
import { readFileSync } from "fs";
import {
  AI_FEATURE_SCOPES,
  AI_SCOPE_GENERATOR_VERSION,
  AI_STUDIO_V2_SCOPES,
  isBlockedUserScope,
  mergeUserAccess,
  PRODUCT_SCOPE_NOTES,
  scopesForFeatures,
  scopesToAdd,
} from "../src/components/highlevel/aiScopes";
import { buildAiPermissionCode } from "../src/lib/menuRemovalWorkflowCode";
import { MENU_REMOVAL_GUIDE_POLICY } from "../supabase/functions/_shared/menuRemovalGuide";

/** Eleven AI Agents scopes, plus Gift Cards, Loyalty, and WhatsApp.
 * HighLevel has not published the gift-card, loyalty, or WhatsApp scope strings.
 * These stand in for those permission groups so the merge has to keep them.
 */
const AI_AGENTS = [
  "voice-ai-agents.readonly",
  "voice-ai-agents.write",
  "voice-ai-common.readonly",
  "voice-ai-common.write",
  "voice-ai-agent-goals.readonly",
  "voice-ai-agent-goals.write",
  "voice-ai-dashboard.readonly",
  "text-ai-agents.write",
  "text-ai-agent-goals.readonly",
  "text-ai-agent-goals.write",
  "text-ai-agents-dashboard.readonly",
];
const GIFT_CARDS = [
  "payments/giftCards.orders.readonly",
  "payments/giftCards.details.readonly",
  "payments/giftCards.code.readonly",
  "payments/giftCards.products.readonly",
  "payments/giftCards.products.write",
  "payments/giftCards.sell",
  "payments/giftCards.send",
  "payments/giftCards.products.delete",
];
const LOYALTY = ["loyalty.write", "loyalty/scanner.write"];
const WHATSAPP = [
  "whatsapp/templates.write",
  "whatsapp/templates.delete",
  "whatsapp/flows.write",
  "whatsapp/flows.delete",
  "whatsapp/business-profile.write",
  "whatsapp/phone-numbers.write",
  "whatsapp/integration.disconnect",
];
const EXISTING = [...AI_AGENTS, ...GIFT_CARDS, ...LOYALTY, ...WHATSAPP];

const AGENCY_SCOPES = [
  "loginas.write",
  "locations.create",
  "locations.delete",
  "locations.write",
  "locations.billing.manage",
  "locations.agency-subaccounts.manage",
  "companies.write",
  "internaltools.billing.write",
  "internaltools.billing.readonly",
  "snapshots/api.push",
  "snapshots/api.delete",
  "snapshots/api.readonly",
  "sso-config.write",
  "users/team-management.write",
  "users/team-management.readonly",
  "private-integration-company.write",
  "private-integration-location.write",
  "custom-menu-link.write",
  "oauth.write",
  "saas/company.write",
  "saas/location.write",
  "agency/launchpad.write",
  "audit-logs.export",
  "affiliateportal.write",
];

const buyer = {
  id: "user-1",
  type: "account",
  role: "admin",
  locationIds: ["loc-1"],
  email: "buyer@example.com",
  scopes: EXISTING,
  scopesAssignedToOnly: ["whatsapp/templates.write"],
  permissions: { paymentsEnabled: true, communitiesEnabled: false },
  roles: { type: "account", role: "user", locationIds: ["loc-1"] },
};

test("AI Studio uses both v2 scopes and every kept scope is explained", () => {
  expect(scopesForFeatures(["ai_studio"])).toEqual([...AI_STUDIO_V2_SCOPES]);
  expect(scopesForFeatures(["ai_studio"])).not.toContain("ai-studio.readonly");
  expect(scopesForFeatures(["ai_studio"])).not.toContain("ai-studio.write");
  const granted = scopesForFeatures(AI_FEATURE_SCOPES.map((feature) => feature.key));
  for (const scope of granted) {
    expect(PRODUCT_SCOPE_NOTES[scope], scope).toBeTruthy();
    expect(isBlockedUserScope(scope), scope).toBe(false);
  }
  expect(granted).toContain("ai-studio.readonlyv2");
  expect(granted).toContain("ai-studio.writev2");
});

test("agency-level and destructive scopes are never granted", () => {
  const granted = scopesForFeatures(AI_FEATURE_SCOPES.map((feature) => feature.key));
  for (const scope of AGENCY_SCOPES) {
    expect(isBlockedUserScope(scope), scope).toBe(true);
    expect(granted, scope).not.toContain(scope);
  }
  expect(isBlockedUserScope("locations/tags.write")).toBe(false);
});

test("merge keeps AI Agents, Gift Cards, Loyalty, and WhatsApp and adds AI Studio v2", () => {
  const body = mergeUserAccess("company-1", buyer, ["ai_studio"]);
  expect(body.companyId).toBe("company-1");
  expect(body.scopes.slice(0, EXISTING.length)).toEqual(EXISTING);
  expect(body.scopes.slice(EXISTING.length)).toEqual([...AI_STUDIO_V2_SCOPES]);
  expect(body.scopesAssignedToOnly).toEqual(["whatsapp/templates.write"]);
  expect(body.permissions).toEqual({ paymentsEnabled: true, communitiesEnabled: false });
  expect(body).not.toHaveProperty("type");
  expect(body).not.toHaveProperty("role");
  expect(body).not.toHaveProperty("locationIds");
  expect(body).not.toHaveProperty("roles");
  expect(body).not.toHaveProperty("email");
  for (const scope of AGENCY_SCOPES) expect(body.scopes, scope).not.toContain(scope);
  expect(scopesToAdd(buyer, ["ai_studio"])).toEqual([...AI_STUDIO_V2_SCOPES]);
});

test("merge keeps an agency scope the buyer already has and does not add another", () => {
  const body = mergeUserAccess("company-1", { scopes: ["loginas.write", "loyalty.write"] }, [
    "ai_studio",
  ]);
  expect(body.scopes).toEqual(["loginas.write", "loyalty.write", ...AI_STUDIO_V2_SCOPES]);
});

test("merge reads nested and string scope lists and refuses to guess", () => {
  const nested = mergeUserAccess(
    "company-1",
    { permissions: { scopes: ["loyalty.write"], paymentsEnabled: true, scopesAssignedToOnly: [] } },
    ["ai_studio"],
  );
  expect(nested.scopes).toEqual(["loyalty.write", ...AI_STUDIO_V2_SCOPES]);
  expect(nested.permissions).toEqual({ paymentsEnabled: true });
  expect(nested.scopesAssignedToOnly).toEqual([]);

  const fromString = mergeUserAccess(
    "company-1",
    { scopes: "loyalty.write, whatsapp/templates.write" },
    ["ai_studio"],
  );
  expect(fromString.scopes).toEqual([
    "loyalty.write",
    "whatsapp/templates.write",
    ...AI_STUDIO_V2_SCOPES,
  ]);

  expect(() =>
    mergeUserAccess("company-1", { permissions: { paymentsEnabled: true } }, ["ai_studio"]),
  ).toThrow("did not return the buyer's current scopes");
  expect(() => mergeUserAccess("company-1", { scopes: 1 }, ["ai_studio"])).toThrow(
    "unexpected shape",
  );
});

async function runPermissionCode(user: unknown, features = ["ai_studio"], token = "fresh-token") {
  const calls: {
    method: string;
    url: string;
    body?: unknown;
    config?: { headers?: Record<string, string> };
  }[] = [];
  const customRequest = {
    get: async (url: string, config: { headers?: Record<string, string> }) => {
      calls.push({ method: "GET", url, config });
      return { status: 200, data: user };
    },
    put: async (url: string, body: unknown, config: { headers?: Record<string, string> }) => {
      calls.push({ method: "PUT", url, body, config });
      return { status: 200, data: body };
    },
  };
  const code = buildAiPermissionCode("company-1", token, features);
  const execute = new Function(
    "inputData",
    "customRequest",
    `return (async () => { let output; ${code} return output; })();`,
  );
  let output:
    | { user_id?: string; scopes_added?: string[]; scope_count?: number; unchanged?: boolean }
    | undefined;
  let error: Error | null = null;
  try {
    output = await execute({ user_id: " user-1 " }, customRequest);
  } catch (caught) {
    error = caught instanceof Error ? caught : new Error(String(caught));
  }
  return { output, calls, code, error };
}

test("generated code GETs the buyer and PUTs the union, and does not call HighLevel itself", async () => {
  const { output, calls, code } = await runPermissionCode(buyer);
  expect(code).toContain(AI_SCOPE_GENERATOR_VERSION);
  expect(code).toContain("ai-studio.readonlyv2");
  expect(code).toContain("ai-studio.writev2");
  expect(code).not.toContain('"ai-studio.readonly"');
  expect(code).not.toContain('"ai-studio.write"');
  expect(code).not.toContain("fetch(");
  expect(calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
  expect(calls[0].url).toBe("https://services.leadconnectorhq.com/users/user-1");
  expect(calls[1].url).toBe(calls[0].url);
  expect(calls[0].config?.headers).toEqual({
    Authorization: "Bearer fresh-token",
    Version: "2021-07-28",
    "Content-Type": "application/json",
  });
  expect(calls[1].config?.headers).toEqual(calls[0].config?.headers);
  expect(calls[1].body).toEqual(mergeUserAccess("company-1", { data: buyer }, ["ai_studio"]));
  expect(output).toEqual({
    user_id: "user-1",
    scopes_added: [...AI_STUDIO_V2_SCOPES],
    scope_count: EXISTING.length + AI_STUDIO_V2_SCOPES.length,
    unchanged: false,
  });
  const putScopes = (calls[1].body as { scopes: string[] }).scopes;
  for (const scope of EXISTING) expect(putScopes).toContain(scope);
  for (const scope of AI_STUDIO_V2_SCOPES) expect(putScopes).toContain(scope);
  for (const scope of AGENCY_SCOPES) expect(putScopes).not.toContain(scope);
});

test("generated code does not PUT when the read fails or nothing new is needed", async () => {
  const missing = await runPermissionCode({ id: "user-1", permissions: { paymentsEnabled: true } });
  expect(missing.error?.message).toContain("did not return the buyer's current scopes");
  expect(missing.calls.map((call) => call.method)).toEqual(["GET"]);

  const refused = await runPermissionCode(buyer, ["ai_studio"], "YOURTOKENHERE");
  expect(refused.error?.message).toContain("Map user_id");
  expect(refused.calls).toEqual([]);

  const already = await runPermissionCode({
    ...buyer,
    scopes: [...EXISTING, ...AI_STUDIO_V2_SCOPES],
  });
  expect(already.error).toBeNull();
  expect(already.calls.map((call) => call.method)).toEqual(["GET"]);
  expect(already.output?.unchanged).toBe(true);
  expect(already.output?.scopes_added).toEqual([]);
});

test("generated HighLevel calls send Version 2021-07-28", async () => {
  const { calls, code } = await runPermissionCode(buyer);
  expect(code).toContain('Version: "2021-07-28"');
  expect(code).not.toContain('Version: "v3"');
  expect(calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
  for (const call of calls) expect(call.config?.headers?.Version).toBe("2021-07-28");
});

test("setup copy no longer tells agencies to paste a replacement scope body", () => {
  const panel = readFileSync("src/components/highlevel/MenuAutomationPanel.tsx", "utf8");
  const card = readFileSync("src/components/copilot-workspace/MenuRemovalSetupCard.tsx", "utf8");
  const guide = readFileSync("supabase/functions/_shared/menuRemovalGuide.ts", "utf8");
  for (const source of [panel, card, guide]) {
    expect(source).not.toContain("buildUserScopesBody");
    expect(source).not.toMatch(/ai-studio\.readonly(?!v2)/);
    expect(source).not.toMatch(/ai-studio\.write(?!v2)/);
    expect(source).not.toContain("users/USER_ID");
  }
  expect(panel).toContain("buildAiPermissionCode");
  expect(card).toContain("buildAiPermissionCode");
  expect(MENU_REMOVAL_GUIDE_POLICY).toContain("ai-studio.readonlyv2");
  expect(MENU_REMOVAL_GUIDE_POLICY).toContain("Custom Code");
  expect(MENU_REMOVAL_GUIDE_POLICY).not.toContain("paste the full body");
  for (const source of [panel, card, guide]) {
    expect(source).toContain("dummy or test user");
    expect(source).toContain("never a real client user");
  }
  expect(panel).not.toContain("test it with a real buyer");
});
