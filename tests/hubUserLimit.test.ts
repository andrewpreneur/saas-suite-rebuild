import { describe, expect, test } from "bun:test";
import {
  countsTowardLimit,
  hubLimitResponse,
  shouldNotifyHubLimit,
  subscriptionPlanName,
  summarizeHubUsers,
  visitorWithinLimit,
} from "../supabase/functions/_shared/hubUserLimit.ts";

const owners = ["admin@digitalaspect.io"];

describe("hub user limit", () => {
  test("the agency owner and preview visits do not take the Starter seat", () => {
    const rows = [
      { email: "admin@digitalaspect.io", name: "", created_at: "2026-10-21T14:16:00Z" },
      { email: "", name: "Guest User #1", created_at: "2026-10-16T00:00:00Z" },
      { email: "preview@example.com", name: "Preview User", created_at: "2026-10-21T12:00:00Z" },
    ];
    const decision = visitorWithinLimit({
      email: "james@digitalaspect.io",
      name: "James",
      ownerEmails: owners,
      rows,
      limit: 1,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.used).toBe(0);
  });

  test("a real user still fills the only Starter seat", () => {
    const rows = [{ email: "james@digitalaspect.io", name: "James", created_at: "2026-10-21T15:00:00Z" }];
    const decision = visitorWithinLimit({
      email: "ash@digitalaspect.io",
      name: "Ash",
      ownerEmails: owners,
      rows,
      limit: 1,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.used).toBe(1);
  });

  test("the same email in a different case is one seat", () => {
    const rows = [
      { email: "James@DigitalAspect.io", name: "James", created_at: "2026-10-21T15:00:00Z" },
      { email: "james@digitalaspect.io", name: "James", created_at: "2026-10-21T16:00:00Z" },
    ];
    expect(summarizeHubUsers(rows, owners).used).toBe(1);
  });

  test("an existing real user keeps access when the owner signed in first", () => {
    const rows = [
      { email: "admin@digitalaspect.io", name: "", created_at: "2026-10-21T14:16:00Z" },
      { email: "james@digitalaspect.io", name: "James", created_at: "2026-10-21T15:00:00Z" },
    ];
    expect(visitorWithinLimit({ email: "james@digitalaspect.io", ownerEmails: owners, rows, limit: 1 }).allowed).toBe(true);
    expect(visitorWithinLimit({ email: "ash@digitalaspect.io", ownerEmails: owners, rows, limit: 1 }).allowed).toBe(false);
  });

  test("a preview flag does not block that visit", () => {
    const rows = [{ email: "james@digitalaspect.io", name: "James", created_at: "2026-10-21T15:00:00Z" }];
    expect(visitorWithinLimit({
      email: "someone@example.com",
      preview: true,
      ownerEmails: owners,
      rows,
      limit: 1,
    }).allowed).toBe(true);
  });

  test("owner, admin, guest, and test identities do not count", () => {
    expect(countsTowardLimit({ email: "Admin@DigitalAspect.io", ownerEmails: owners })).toBe(false);
    expect(countsTowardLimit({ email: "coach@digitalaspect.io", ownerEmails: ["coach@digitalaspect.io"] })).toBe(false);
    expect(countsTowardLimit({ name: "Guest User #4", ownerEmails: owners })).toBe(false);
    expect(countsTowardLimit({ email: "test+hub@example.com", name: "Sam", ownerEmails: owners })).toBe(false);
    expect(countsTowardLimit({ email: "client@example.com", name: "Sam", ownerEmails: owners })).toBe(true);
  });

  test("the limit response names the plan the pricing page uses", () => {
    expect(hubLimitResponse({ plan: "STARTER", limit: 1, current: 1, agencyName: "Keystone" })).toEqual({
      status: "limit",
      reason: "user_limit_reached",
      plan: "STARTER",
      plan_name: "Starter",
      limit: 1,
      current: 1,
      agency_name: "Keystone",
    });
    expect(subscriptionPlanName("ADVANCED", true)).toBe("Premium Support");
    expect(subscriptionPlanName("ADVANCED")).toBe("Advanced");
  });

  test("the owner notification is deduped for a day", () => {
    const now = Date.parse("2026-10-21T18:00:00Z");
    expect(shouldNotifyHubLimit(null, now)).toBe(true);
    expect(shouldNotifyHubLimit("2026-10-21T17:00:00Z", now)).toBe(false);
    expect(shouldNotifyHubLimit("2026-10-20T17:00:00Z", now)).toBe(true);
  });
});
