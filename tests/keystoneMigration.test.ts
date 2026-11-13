import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("keystone migration", () => {
  const sql = readFileSync("supabase/migrations/20261021210000_keystone_hub_limit_and_ticket_close.sql", "utf8");

  test("excludes owner seats, closes the linked ticket, and rewrites the in-chat promise", () => {
    expect(sql).toContain("hub_seat_exempt");
    expect(sql).toContain("is_user_within_limit");
    expect(sql).toContain("get_agency_user_limit");
    expect(sql).toContain("close_linked_ticket_when_chat_resolved");
    expect(sql).toContain("rewrite_inchat_email_promise");
    expect(sql).toContain("Resolved in chat.");
    expect(sql).not.toContain("max_onboarding_users =");
  });
});
