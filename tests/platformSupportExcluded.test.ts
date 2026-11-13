import { test, expect } from "bun:test";
import { notifyGlobalHandover } from "../supabase/functions/_shared/globalHandoverWebhook.ts";
import {
  agencyAssigneeWebhookSends,
  agencyIdMatchesPrefix,
  allowPlatformNotification,
  deliverPlatformSupportAlert,
  excludedAgencyIdSet,
  filterPlatformQueue,
  globalHandoverExclusionGate,
  isAgencyIdExcluded,
  ownerMatchesAgencyPrefix,
  platformAdminSeesSupportRow,
  platformLeadConnectorDecision,
  type AgencyIdOwner,
} from "../supabase/functions/_shared/platformSupportExcluded.ts";

const buzzbull: AgencyIdOwner = {
  email: "CurtisV@BuzzBullMarketing.com",
  agency_id: "buzzbull-marketing-systems",
  agency_id_basic: "buzzbull-marketing-systems",
  agency_id_advanced: "buzzbull-marketing-systems-2",
  agency_id_elite: "buzzbull-marketing-systems-3",
};

const launch360: AgencyIdOwner = {
  email: "owner@launch360.example",
  agency_id: "Launch360",
  agency_id_basic: "launch360",
  agency_id_advanced: "launch360-2",
  agency_id_elite: "launch360-3NO",
};

const other: AgencyIdOwner = {
  email: "fran@digitalaspect.io",
  agency_id: "keystone",
  agency_id_basic: "keystone",
  agency_id_advanced: "keystone-2",
  agency_id_elite: "keystone-3",
};

const excluded = excludedAgencyIdSet(
  [buzzbull, launch360, other],
  ["curtisv@buzzbullmarketing.com", "owner@launch360.example"],
);

test("agency ids matching launch360 are excluded from platform chats and tickets", () => {
  expect(ownerMatchesAgencyPrefix(launch360, "launch360")).toBe(true);
  expect(agencyIdMatchesPrefix("Launch360NO", "launch360")).toBe(true);
  expect(agencyIdMatchesPrefix("launch360-2", "launch360")).toBe(true);
  expect(agencyIdMatchesPrefix("not-launch360", "launch360")).toBe(false);
  expect(isAgencyIdExcluded("launch360", excluded)).toBe(true);
  expect(isAgencyIdExcluded("LAUNCH360NO", excluded)).toBe(true);
  expect(isAgencyIdExcluded("launch360-2", excluded)).toBe(true);
  expect(isAgencyIdExcluded("launch360-3", excluded)).toBe(true);

  const chats = filterPlatformQueue([
    { agency_id: "launch360", customer: "a@example.com" },
    { agency_id: "launch360-2NO", customer: "b@example.com" },
    { agency_id: "keystone", customer: "fran@digitalaspect.io" },
  ], excluded);
  expect(chats).toEqual([{ agency_id: "keystone", customer: "fran@digitalaspect.io" }]);

  const tickets = filterPlatformQueue([
    { agency_id: "launch360-3", ticket_number: 9 },
    { agency_id: "keystone", ticket_number: 10 },
  ], excluded);
  expect(tickets).toEqual([{ agency_id: "keystone", ticket_number: 10 }]);
});

test("Buzz Bull plan ids are excluded and a normal agency is unchanged", () => {
  expect(ownerMatchesAgencyPrefix(buzzbull, "buzzbull")).toBe(true);
  for (const id of [
    "buzzbull-marketing-systems",
    "buzzbull-marketing-systems-2",
    "buzzbull-marketing-systems-3NO",
  ]) {
    expect(isAgencyIdExcluded(id, excluded)).toBe(true);
  }
  expect(isAgencyIdExcluded("keystone", excluded)).toBe(false);
  expect(isAgencyIdExcluded("keystone-2", excluded)).toBe(false);

  const chats = filterPlatformQueue([
    { agency_id: "buzzbull-marketing-systems" },
    { agency_id: "buzzbull-marketing-systems-2" },
    { agency_id: "keystone" },
  ], excluded);
  expect(chats.map((row) => row.agency_id)).toEqual(["keystone"]);

  const tickets = filterPlatformQueue([
    { agency_id: "buzzbull-marketing-systems-3" },
    { agency_id: "keystone" },
  ], excluded);
  expect(tickets.map((row) => row.agency_id)).toEqual(["keystone"]);
});

test("excluded agencies send no handover webhook and no LeadConnector ping", async () => {
  const posts: string[] = [];
  const skipped = await deliverPlatformSupportAlert({
    exclusion: "excluded",
    postLeadConnector: async () => { posts.push("leadconnector"); },
    postGlobal: async () => { posts.push("handover"); },
  });
  expect(skipped).toBe("skipped");
  expect(posts).toEqual([]);

  const unknown = await deliverPlatformSupportAlert({
    exclusion: "unknown",
    postLeadConnector: async () => { posts.push("leadconnector"); },
    postGlobal: async () => { posts.push("handover"); },
  });
  expect(unknown).toBe("skipped");
  expect(allowPlatformNotification("unknown")).toBe(false);

  const sent = await deliverPlatformSupportAlert({
    exclusion: "allowed",
    postLeadConnector: async () => { posts.push("leadconnector"); },
    postGlobal: async () => { posts.push("handover"); },
  });
  expect(sent).toBe("sent");
  expect(posts).toEqual(["leadconnector", "handover"]);
});

test("the global handover POST is skipped for an excluded agency and still sent for others", async () => {
  const posts: string[] = [];
  const rpc = async (_fn: string, args?: Record<string, unknown>) => ({
    data: String(args?.p_agency_id || "").toLowerCase().startsWith("launch360"),
    error: null,
  });
  const db = { rpc, from() { throw new Error("dedupe should not run when excluded"); } };
  const deps = {
    webhookUrl: "https://hooks.example/handover",
    authHeader: "Token raw-secret",
    db,
    waitUntil: null as null,
    post: async (_url: string, body: string) => {
      posts.push(body);
      return { ok: true, status: 200 };
    },
  };
  const excludedResult = await notifyGlobalHandover({
    event: "handover_requested",
    agencyId: "launch360-2NO",
    customerEmail: "guest@launch360.example",
    threadId: "thread-launch",
    dedupe: false,
  }, deps);
  expect(excludedResult).toBe("skipped");
  expect(posts).toEqual([]);

  const allowed = await notifyGlobalHandover({
    event: "handover_requested",
    agencyId: "keystone",
    customerEmail: "fran@digitalaspect.io",
    threadId: "thread-keystone",
    dedupe: false,
  }, deps);
  expect(allowed).toBe("sent");
  expect(JSON.parse(posts[0]).agency_id).toBe("keystone");

  const failedLookup = await globalHandoverExclusionGate({
    rpc: async () => ({ data: null, error: { message: "db down" } }),
  }, "keystone");
  expect(failedLookup).toBe("skip");
});

test("public form tickets stay in the platform queue", () => {
  expect(isAgencyIdExcluded("public-support", excluded)).toBe(false);
  expect(isAgencyIdExcluded("public-supportNO", excluded)).toBe(false);
  expect(agencyIdMatchesPrefix("public-support", "launch360")).toBe(false);
  expect(agencyIdMatchesPrefix("public-support", "buzzbull")).toBe(false);

  const tickets = filterPlatformQueue([
    { agency_id: "public-support", ticket_number: 1 },
    { agency_id: "launch360", ticket_number: 2 },
    { agency_id: "buzzbull-marketing-systems", ticket_number: 3 },
    { agency_id: null, ticket_number: 4 },
    { agency_id: "keystone", ticket_number: 5 },
  ], excluded);
  expect(tickets.map((row) => row.agency_id)).toEqual(["public-support", null, "keystone"]);

  // Public form tickets have no owner and use the managed alert path.
  // They still ping the platform unless the exclusion lookup says otherwise.
  expect(platformLeadConnectorDecision({
    exclusion: "allowed",
    mode: "managed",
    ownerIsPlatformAccount: false,
    emailAlertsOn: true,
  })).toBe("send");
  expect(platformLeadConnectorDecision({
    exclusion: "unknown",
    mode: "managed",
    ownerIsPlatformAccount: false,
    emailAlertsOn: true,
  })).toBe("skip-excluded");
});

test("platform ticket alerts skip excluded agencies and agency assignee alerts still send", () => {
  expect(platformLeadConnectorDecision({
    exclusion: "excluded",
    mode: "managed",
    ownerIsPlatformAccount: false,
    emailAlertsOn: true,
  })).toBe("skip-excluded");
  expect(platformLeadConnectorDecision({
    exclusion: "unknown",
    mode: "managed",
    ownerIsPlatformAccount: false,
    emailAlertsOn: true,
  })).toBe("skip-excluded");
  expect(platformLeadConnectorDecision({
    exclusion: "allowed",
    mode: "managed",
    ownerIsPlatformAccount: false,
    emailAlertsOn: true,
  })).toBe("send");
  expect(platformLeadConnectorDecision({
    exclusion: "allowed",
    mode: "self",
    ownerIsPlatformAccount: false,
    emailAlertsOn: true,
  })).toBe("skip-self-managed");
  expect(agencyAssigneeWebhookSends(true, true)).toBe(true);
  expect(agencyAssigneeWebhookSends(false, true)).toBe(false);
});

test("agency-side views still see Buzz Bull and launch360; the platform inbox does not", () => {
  expect(platformAdminSeesSupportRow(false, true)).toBe(true);
  expect(platformAdminSeesSupportRow(true, true)).toBe(false);
  expect(platformAdminSeesSupportRow(true, false)).toBe(true);
  expect(platformAdminSeesSupportRow(false, false)).toBe(true);
});
