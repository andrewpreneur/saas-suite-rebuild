import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AI_FAILURE_MESSAGE_LIMIT,
  authFailureRow,
  insertFailureRow,
  lastUserMessageText,
  recordAiChatFailure,
  unverifiedJwtHint,
} from "../supabase/functions/chat-copilot/failureLog";

function bearer(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `Bearer header.${body}.sig`;
}

describe("copilot refusal log", () => {
  test("uses an email hint from the body or an unverified jwt, and keeps the message", () => {
    const token = bearer({ email: "jwt@example.com", sub: "user-1" });
    expect(unverifiedJwtHint(token)).toEqual({ email: "jwt@example.com", sub: "user-1" });
    expect(unverifiedJwtHint("Bearer not-a-jwt")).toEqual({ email: null, sub: null });

    const text = "please look at billing";
    const row = authFailureRow({
      status: 401,
      userEmail: "body@example.com",
      authorization: token,
      page: "https://saassuite.ai/app/billing?promo=secret",
      message: text,
      agencyId: "acme",
      now: "2026-10-22T00:00:00.000Z",
    });
    expect(row).toEqual({
      agency_id: "acme",
      user_identifier: "body@example.com",
      stage: "auth_rejected",
      status: 401,
      detail: "path: https://saassuite.ai/app/billing\njwt_email: jwt@example.com\njwt_sub: user-1\nmessage: please look at billing",
      created_at: "2026-10-22T00:00:00.000Z",
    });
    expect(JSON.stringify(row)).not.toContain("secret");
    expect(JSON.stringify(row)).not.toContain("header.");

    const fromJwt = authFailureRow({ status: 403, authorization: token, now: "2026-10-22T00:00:00.000Z" });
    expect(fromJwt.user_identifier).toBe("jwt@example.com");
    expect(fromJwt.stage).toBe("auth_forbidden");
    expect(fromJwt.status).toBe(403);
  });

  test("truncates the message and only writes existing columns", () => {
    const huge = "x".repeat(AI_FAILURE_MESSAGE_LIMIT + 50);
    const messages = [{ role: "assistant", content: "hi" }, { role: "user", content: huge }];
    expect(lastUserMessageText(messages)).toHaveLength(AI_FAILURE_MESSAGE_LIMIT);
    const row = insertFailureRow({
      stage: "user_message_insert",
      user: "a@example.com",
      content: huge,
      error: "permission denied",
      now: "2026-10-22T00:00:00.000Z",
    });
    expect(Object.keys(row).sort()).toEqual(["agency_id", "created_at", "detail", "stage", "status", "user_identifier"]);
    expect(row.detail?.includes("permission denied")).toBe(true);
    expect(row.detail?.length).toBeLessThanOrEqual(4500);
    expect(row.status).toBeNull();
  });

  test("a logging failure does not throw", async () => {
    const row = authFailureRow({ status: 401, userEmail: "a@example.com", now: "2026-10-22T00:00:00.000Z" });
    await recordAiChatFailure(async () => { throw new Error("db down"); }, row);
    await recordAiChatFailure(async () => ({ error: { message: "rls" } }), row);
  });

  test("the copilot prompt points at /app/billing", () => {
    const src = readFileSync("supabase/functions/chat-copilot/index.ts", "utf8");
    expect(src).toContain("https://saassuite.ai/app/billing");
    expect(src).not.toContain("NO \\`/app/billing\\`");
    expect(src).toContain("persistCopilotMessage");
    expect(src).toContain("logAuthRefusal");
  });
});
