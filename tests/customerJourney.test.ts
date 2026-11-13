import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { normalizeMessageStatus } from "../supabase/functions/_shared/message-status";

test("customer message statuses stay on the shared list", () => {
  expect(normalizeMessageStatus(" Delivered ")).toBe("delivered");
  expect(normalizeMessageStatus("sent")).toBe("sent");
  expect(normalizeMessageStatus("failed")).toBe("failed");
  expect(normalizeMessageStatus("queued-ish")).toBeNull();
  expect(normalizeMessageStatus("missing_url")).toBeNull();
});

test("the journey migration is additive and the timeline is service-role only", () => {
  const sql = readFileSync("supabase/migrations/20261021193000_customer_journey.sql", "utf8");
  for (const table of ["customer_message_events", "checkout_sessions", "plan_change_history", "login_events"]) {
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    expect(sql).toContain(`REVOKE ALL ON TABLE public.${table} FROM PUBLIC, anon, authenticated`);
  }
  expect(sql).toContain("COALESCE(user_record.login_count, 0) = 0");
  expect(sql).toContain("FOR UPDATE");
  expect(sql).toContain("DISABLE TRIGGER USER");
  expect(sql).toContain("ENABLE TRIGGER USER");
  expect(sql).toContain("CREATE OR REPLACE FUNCTION public.customer_timeline(p_email text)");
  expect(sql).toContain("SECURITY INVOKER");
  expect(sql).toContain("REVOKE ALL ON FUNCTION public.customer_timeline(text) FROM PUBLIC, anon, authenticated");
  expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.customer_timeline(text) TO service_role");
  expect(sql).not.toContain("DROP TABLE");
  expect(sql).not.toContain("DELETE FROM public.saas_suite_users");
});

test("a sign-in is recorded before the same-user session load returns early", () => {
  const source = readFileSync("src/contexts/UserContext.tsx", "utf8");
  const start = source.indexOf("const loadAuthenticatedSession");
  const body = source.slice(start, source.indexOf("inFlightSessionUserRef.current = uid", start));
  expect(body.indexOf("recordLoginOnce(userEmail)")).toBeGreaterThan(-1);
  expect(body.indexOf("recordLoginOnce(userEmail)")).toBeLessThan(body.indexOf("loadedSessionUserRef.current === uid"));
  expect(body).toContain('event === "SIGNED_IN"');
  expect(body).toContain('event === "INITIAL_SESSION"');
  expect(source).toContain("clearLoginRecordedFlags");
});

test("the status webhook stays off until a secret is configured", () => {
  const source = readFileSync("supabase/functions/message-status-webhook/index.ts", "utf8");
  expect(source).toContain("MESSAGE_STATUS_WEBHOOK_SECRET");
  expect(source).not.toContain("svix");
  expect(source).toContain('reason: "not_configured"');
  expect(readFileSync("supabase/config.toml", "utf8")).toContain("[functions.message-status-webhook]");
  const docs = readFileSync("docs/customer-timeline.sql", "utf8");
  expect(docs).toContain("customer_timeline('admin@digitalaspect.io')");
  expect(docs).toContain("send-activation-rescue");
});
