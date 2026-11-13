import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  applyImmediateCancelAttempt,
  cancelDedupeKey,
  cancelMessageStatus,
  cancelResponseStatus,
  emailImmediateClaimKey,
  immediateClaimKeysToHonor,
  resolveImmediateCancelClaimKey,
  GHL_SUBSCRIPTION_CANCEL_WEBHOOK_URL,
  ghlCancelWebhookIntended,
  keepsPaidAccess,
  planSubscriptionCancel,
  recordSubscriptionCanceled,
  shouldRecordScheduledCancel,
  SUBSCRIPTION_CANCELED_EVENT,
  subscriptionOutcomeLine,
  withGhlWebhookStatus,
  type CancelPlan,
  type SubscriptionCanceledMessage,
} from "../supabase/functions/_shared/subscription-cancel-log.ts";

const WEBHOOK = readFileSync("supabase/functions/stripe-subscription-webhook/index.ts", "utf8");

function outcome(customer: string, price: string, result: string): string {
  return subscriptionOutcomeLine({ customer, price, result });
}

describe("subscription cancel tracking", () => {
  test("a paid-period cancel writes subscription_canceled and does not fire GoHighLevel", async () => {
    const posts: Array<{ url: string; body: string }> = [];
    const rows: SubscriptionCanceledMessage[] = [];
    const recorded = await recordSubscriptionCanceled({
      email: " Buyer.Example@agency.test ",
      priceId: "price_1UNPAOGdZ9PRE3ZiQIH5kh8O",
      productId: "prod_advanced",
      kind: "access_kept",
      accessUntil: "2026-11-18T14:39:03.000Z",
      fetchImpl: async (url, init) => {
        posts.push({ url: String(url), body: String(init?.body ?? "") });
        return new Response("ok", { status: 200 });
      },
      insertMessage: async (row) => {
        rows.push(row);
        return { ok: true };
      },
    });

    expect(ghlCancelWebhookIntended("access_kept")).toBe(false);
    expect(recorded.webhookFired).toBe(false);
    expect(posts).toHaveLength(0);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.templateKey).toBe(SUBSCRIPTION_CANCELED_EVENT);
    expect(rows[0]?.templateKey).toBe("subscription_canceled");
    expect(rows[0]?.userEmail).toBe("buyer.example@agency.test");
    expect(rows[0]?.channel).toBe("webhook");
    expect(rows[0]?.provider).toBe("ghl");
    expect(rows[0]?.status).toBe("suppressed");
    expect(rows[0]?.metadata).toMatchObject({
      kind: "access_kept",
      price_id: "price_1UNPAOGdZ9PRE3ZiQIH5kh8O",
      ghl_webhook: "deferred",
    });
  });

  test("an immediate cancel writes subscription_canceled and posts the existing GoHighLevel webhook", async () => {
    const posts: Array<{ url: string; body: string }> = [];
    const rows: SubscriptionCanceledMessage[] = [];
    const updates: Array<{ key: string; outcome: string }> = [];
    const recorded = await recordSubscriptionCanceled({
      email: "owner@agency.com",
      priceId: "price_1SDdmJGdZ9PRE3Zi84yGzqVd",
      kind: "immediate",
      dedupeKey: "sub_immediate:2026-10-01T00:00:00.000Z:immediate",
      fetchImpl: async (url, init) => {
        posts.push({ url: String(url), body: String(init?.body ?? "") });
        return new Response("accepted", { status: 200 });
      },
      insertMessage: async (row) => {
        rows.push(row);
        return { ok: true, claimed: true };
      },
      markStatus: async (key, outcome) => {
        updates.push({ key, outcome });
      },
    });

    expect(ghlCancelWebhookIntended("immediate")).toBe(true);
    expect(ghlCancelWebhookIntended("cancel_at_period_end")).toBe(false);
    expect(recorded).toEqual({ webhookFired: true, logged: true, duplicate: false });
    expect(posts).toEqual([
      {
        url: GHL_SUBSCRIPTION_CANCEL_WEBHOOK_URL,
        body: JSON.stringify({ email: "owner@agency.com" }),
      },
    ]);
    expect(GHL_SUBSCRIPTION_CANCEL_WEBHOOK_URL).toBe(
      "https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/8269ec40-aa2b-4068-b3b7-4cc6404d8ff8",
    );
    expect(rows[0]?.templateKey).toBe("subscription_canceled");
    expect(rows[0]?.status).toBe("queued");
    expect(rows[0]?.metadata).toMatchObject({ kind: "immediate", ghl_webhook: "pending" });
    expect(updates).toEqual([
      { key: "sub_immediate:2026-10-01T00:00:00.000Z:immediate", outcome: "sent" },
    ]);
  });

  test("a failed insert does not post to GoHighLevel", async () => {
    const errors: string[] = [];
    let posts = 0;
    const failedInsert = await recordSubscriptionCanceled({
      email: "owner@agency.com",
      priceId: "price_1SDdmJGdZ9PRE3Zi84yGzqVd",
      kind: "immediate",
      dedupeKey: "sub_fail:2026-10-01T00:00:00.000Z:immediate",
      fetchImpl: async () => {
        posts += 1;
        return new Response("no", { status: 500 });
      },
      insertMessage: async (row) => {
        expect(row.status).toBe("queued");
        expect(row.metadata).toMatchObject({ ghl_webhook: "pending" });
        return { ok: false, error: "permission denied for table customer_message_events" };
      },
      logError: (message) => errors.push(message),
    });

    expect(failedInsert).toEqual({ webhookFired: false, logged: false, duplicate: false });
    expect(posts).toBe(0);
    expect(errors.some((line) => line.includes("cancel notification failed"))).toBe(false);
    const insertError = errors.find((line) => line.includes("insert failed"));
    expect(insertError).toContain("ERROR");
    expect(insertError).toContain("subscription_canceled");
    expect(insertError).toContain("owner@agency.com");
    expect(insertError).toContain("key=sub_fail:2026-10-01T00:00:00.000Z:immediate");
    expect(insertError).toContain("permission denied for table customer_message_events");
    expect(insertError).not.toContain("sk_live");
  });

  test("a lost immediate claim returns 500 and the retry posts once with the same user state", async () => {
    expect(cancelResponseStatus({ webhookFired: false, logged: false, duplicate: false })).toBe(500);
    expect(cancelResponseStatus({ webhookFired: false, logged: false, duplicate: true })).toBe(200);
    expect(cancelResponseStatus({ webhookFired: false, logged: true, duplicate: false })).toBe(200);

    const user = {
      premium_support: true,
      cancel_access_until: "2026-11-16T14:30:07.000Z",
      billing_state: "ACTIVE" as "ACTIVE" | "PAST_DUE",
      plan: "ADVANCED",
    };
    const audits: Array<{ email: string; action: string; details: Record<string, unknown> }> = [];
    const rows: SubscriptionCanceledMessage[] = [];
    let posts = 0;
    let purges = 0;
    let claimFailuresLeft = 1;
    const cancelKey = "sub_retry:2026-10-01T00:00:00.000Z:immediate";
    const email = "owner@agency.com";

    const attempt = () => applyImmediateCancelAttempt({
      cancelKey,
      clearPremium: async () => {
        user.premium_support = false;
      },
      markDelinquent: async () => {
        if (user.billing_state === "PAST_DUE") {
          return { error: false, details: { success: true, skipped: true, reason: "already_past_due" } };
        }
        user.billing_state = "PAST_DUE";
        user.plan = "STARTER";
        return {
          error: false,
          details: { success: true, reason: "stripe_canceled", previous_plan: "ADVANCED" },
        };
      },
      auditExists: async () => audits.some((row) => row.details.cancel_key === cancelKey),
      insertAudit: async (details) => {
        audits.push({ email, action: "past_due", details });
      },
      purgeCache: async () => {
        purges += 1;
      },
      record: () => recordSubscriptionCanceled({
        email,
        kind: "immediate",
        dedupeKey: cancelKey,
        insertMessage: async (row) => {
          if (claimFailuresLeft > 0) {
            claimFailuresLeft -= 1;
            return { ok: false, error: "permission denied for table customer_message_events" };
          }
          if (rows.some((existing) => existing.providerMessageId === row.providerMessageId)) {
            return { ok: true, claimed: false };
          }
          rows.push(row);
          return { ok: true, claimed: true };
        },
        fetchImpl: async () => {
          posts += 1;
          return new Response("ok", { status: 200 });
        },
      }),
    });

    const first = await attempt();
    expect(first.status).toBe(500);
    expect(first.duplicate).toBe(false);
    expect(posts).toBe(0);
    expect(rows).toHaveLength(0);
    expect(audits).toHaveLength(1);
    expect(audits[0]?.details.cancel_key).toBe(cancelKey);
    expect(audits[0]?.details.skipped).toBeUndefined();
    expect(purges).toBe(1);
    const afterFailure = { ...user };

    const retry = await attempt();
    expect(retry.status).toBe(200);
    expect(retry.recorded).toEqual({ webhookFired: true, logged: true, duplicate: false });
    expect(posts).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.providerMessageId).toBe(cancelKey);
    expect(audits).toHaveLength(1);
    expect(purges).toBe(1);
    expect(user).toEqual(afterFailure);
    expect(user).toEqual({
      premium_support: false,
      cancel_access_until: "2026-11-16T14:30:07.000Z",
      billing_state: "PAST_DUE",
      plan: "STARTER",
    });

    const duplicate = await attempt();
    expect(duplicate.status).toBe(200);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.recorded).toEqual({ webhookFired: false, logged: false, duplicate: true });
    expect(posts).toBe(1);
    expect(rows).toHaveLength(1);
    expect(audits).toHaveLength(1);
    expect(user).toEqual(afterFailure);

    const ghlFailed = await applyImmediateCancelAttempt({
      cancelKey: "sub_ghl_status:2026-10-01T00:00:00.000Z:immediate",
      clearPremium: async () => undefined,
      markDelinquent: async () => ({ error: false, details: { success: true, skipped: true, reason: "already_past_due" } }),
      auditExists: async () => true,
      insertAudit: async () => {
        throw new Error("audit should not be inserted again");
      },
      purgeCache: async () => {
        throw new Error("cache should not be purged again");
      },
      record: () => recordSubscriptionCanceled({
        email,
        kind: "immediate",
        dedupeKey: "sub_ghl_status:2026-10-01T00:00:00.000Z:immediate",
        insertMessage: async () => ({ ok: true, claimed: true }),
        fetchImpl: async () => new Response("no", { status: 502 }),
      }),
    });
    expect(ghlFailed.status).toBe(200);
    expect(ghlFailed.duplicate).toBe(false);
    expect(ghlFailed.recorded).toEqual({ webhookFired: false, logged: true, duplicate: false });
  });

  test("an access-kept claim error returns 500 and the retry keeps the same access date", async () => {
    const until = "2026-11-16T14:30:07.000Z";
    let stored: string | null = null;
    const rows: string[] = [];
    let failures = 1;
    let posts = 0;
    const deliver = async () => {
      stored = until;
      return recordSubscriptionCanceled({
        email: "owner@agency.com",
        kind: "access_kept",
        accessUntil: until,
        dedupeKey: "sub_kept:2026-11-16T14:30:07.000Z:access_kept",
        immediateClaimKey: "sub_kept:2026-11-16T14:30:07.000Z:immediate",
        insertMessage: async (row) => {
          if (failures > 0) {
            failures -= 1;
            return { ok: false, error: "permission denied" };
          }
          const id = row.providerMessageId || "";
          if (rows.includes(id)) return { ok: true, claimed: false };
          rows.push(id);
          return { ok: true, claimed: true };
        },
        fetchImpl: async () => {
          posts += 1;
          return new Response("ok", { status: 200 });
        },
      });
    };
    const first = await deliver();
    expect(cancelResponseStatus(first)).toBe(500);
    expect(posts).toBe(0);
    const second = await deliver();
    expect(cancelResponseStatus(second)).toBe(200);
    expect(second.logged).toBe(true);
    expect(stored).toBe(until);
    expect(rows).toEqual(["sub_kept:2026-11-16T14:30:07.000Z:access_kept"]);
    expect(posts).toBe(0);
  });

  test("a failed GoHighLevel post is stored as failed after the row is claimed", async () => {
    const errors: string[] = [];
    const updates: string[] = [];
    let posts = 0;
    const failedWebhook = await recordSubscriptionCanceled({
      email: "owner@agency.com",
      kind: "immediate",
      dedupeKey: "sub_ghl_fail:2026-10-01T00:00:00.000Z:immediate",
      fetchImpl: async () => {
        posts += 1;
        return new Response("no", { status: 500 });
      },
      insertMessage: async () => ({ ok: true, claimed: true }),
      markStatus: async (_key, outcome) => {
        updates.push(outcome);
      },
      logError: (message) => errors.push(message),
    });

    expect(failedWebhook).toEqual({ webhookFired: false, logged: true, duplicate: false });
    expect(posts).toBe(1);
    expect(updates).toEqual(["failed"]);
    expect(errors.some((line) => line.includes("cancel notification failed 500"))).toBe(true);
    expect(errors.some((line) => line.includes("insert failed"))).toBe(false);
  });

  test("a thrown insert is logged and does not escape", async () => {
    const errors: string[] = [];
    const recorded = await recordSubscriptionCanceled({
      email: "owner@agency.com",
      kind: "access_kept",
      accessUntil: "2026-11-18T14:39:03.000Z",
      insertMessage: async () => {
        throw new Error("connection reset");
      },
      logError: (message) => errors.push(message),
    });
    expect(recorded).toEqual({ webhookFired: false, logged: false, duplicate: false });
    expect(errors[0]).toContain("insert failed");
    expect(errors[0]).toContain("subscription_canceled");
    expect(errors[0]).toContain("connection reset");
  });

  test("the same cancel-at-period-end instant is not recorded again", () => {
    expect(shouldRecordScheduledCancel(null, "2026-11-18T14:39:03.000Z")).toBe(true);
    expect(shouldRecordScheduledCancel(undefined, null)).toBe(false);
    expect(
      shouldRecordScheduledCancel("2026-11-18T14:39:03.000Z", "2026-11-18T14:39:03+00:00"),
    ).toBe(false);
    expect(
      shouldRecordScheduledCancel("2026-11-18T14:39:03.000Z", "2026-12-18T14:39:03.000Z"),
    ).toBe(true);
  });

  test("updated and deleted for one paid-period cancel share one row and do not post twice", async () => {
    const now = Date.parse("2026-10-24T17:55:37.000Z");
    const periodEnd = Date.parse("2026-11-16T14:30:07.000Z");
    const updated = planSubscriptionCancel({
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_test_pair",
      status: "canceled",
      periodEndMs: periodEnd,
      nowMs: now,
    });
    const deleted = planSubscriptionCancel({
      eventType: "customer.subscription.deleted",
      subscriptionId: "sub_test_pair",
      status: "canceled",
      periodEndMs: periodEnd,
      nowMs: now,
    });
    expect(updated.kind).toBe("access_kept");
    expect(deleted.kind).toBe("access_kept");
    expect(updated.keepsAccess).toBe(true);
    expect(deleted.dedupeKey).toBe(updated.dedupeKey);
    expect(updated.dedupeKey).toBe(cancelDedupeKey("sub_test_pair", "2026-11-16T14:30:07+00:00", "access_kept"));

    const rows: SubscriptionCanceledMessage[] = [];
    const keys = new Set<string>();
    let posts = 0;
    const record = (plan: CancelPlan) =>
      recordSubscriptionCanceled({
        email: "buyer.example@agency.test",
        priceId: "price_1UNPAOGdZ9PRE3ZiQIH5kh8O",
        subscriptionId: "sub_test_pair",
        kind: plan.kind,
        accessUntil: plan.accessUntil,
        dedupeKey: plan.dedupeKey,
        insertMessage: async (row) => {
          const id = row.providerMessageId ?? "";
          if (id && keys.has(id)) return { ok: true, claimed: false };
          if (id) keys.add(id);
          rows.push(row);
          return { ok: true, claimed: true };
        },
        fetchImpl: async () => {
          posts += 1;
          return new Response("ok", { status: 200 });
        },
      });

    const [first, second] = await Promise.all([record(updated), record(deleted)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.templateKey).toBe("subscription_canceled");
    expect(rows[0]?.providerMessageId).toBe(updated.dedupeKey);
    expect(posts).toBe(0);
    expect([first, second].filter((result) => result.logged)).toHaveLength(1);
    expect([first, second].filter((result) => result.duplicate)).toHaveLength(1);
    expect([first, second].every((result) => result.webhookFired === false)).toBe(true);

    const retry = await record(deleted);
    expect(retry).toEqual({ webhookFired: false, logged: false, duplicate: true });
    expect(rows).toHaveLength(1);
    expect(posts).toBe(0);
  });

  test("overlapping immediate claims insert one row and post once", async () => {
    const now = Date.parse("2026-11-16T15:00:00.000Z");
    const periodEnd = Date.parse("2026-11-16T14:30:07.000Z");
    const updated = planSubscriptionCancel({
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_overlap",
      status: "canceled",
      periodEndMs: periodEnd,
      nowMs: now,
    });
    const deleted = planSubscriptionCancel({
      eventType: "customer.subscription.deleted",
      subscriptionId: "sub_overlap",
      status: "canceled",
      periodEndMs: periodEnd,
      nowMs: now,
    });
    expect(updated.kind).toBe("immediate");
    expect(updated.dedupeKey).toBe(deleted.dedupeKey);

    const rows: SubscriptionCanceledMessage[] = [];
    const keys = new Set<string>();
    let posts = 0;
    const record = (plan: CancelPlan) =>
      recordSubscriptionCanceled({
        email: "owner@agency.com",
        kind: plan.kind,
        dedupeKey: plan.dedupeKey,
        insertMessage: async (row) => {
          const id = row.providerMessageId ?? "";
          if (id && keys.has(id)) return { ok: true, claimed: false };
          if (id) keys.add(id);
          rows.push(row);
          return { ok: true, claimed: true };
        },
        fetchImpl: async () => {
          posts += 1;
          return new Response("ok", { status: 200 });
        },
      });

    const [first, second] = await Promise.all([record(updated), record(deleted)]);
    expect(rows).toHaveLength(1);
    expect(posts).toBe(1);
    expect([first, second].filter((result) => result.webhookFired)).toHaveLength(1);
    expect([first, second].filter((result) => result.duplicate)).toHaveLength(1);
  });

  test("a unique-violation error does not post", async () => {
    let posts = 0;
    const recorded = await recordSubscriptionCanceled({
      email: "owner@agency.com",
      kind: "immediate",
      dedupeKey: "sub_unique:2026-10-01T00:00:00.000Z:immediate",
      fetchImpl: async () => {
        posts += 1;
        return new Response("ok", { status: 200 });
      },
      insertMessage: async () => ({ ok: false, error: "duplicate key value violates unique constraint" }),
    });
    expect(recorded).toEqual({ webhookFired: false, logged: false, duplicate: true });
    expect(posts).toBe(0);
  });

  test("ghl_webhook moves from pending to sent, failed, or skipped without dropping other metadata", () => {
    expect(withGhlWebhookStatus({ ghl_webhook: "pending", kind: "immediate" }, "sent")).toEqual({
      ghl_webhook: "sent",
      kind: "immediate",
    });
    expect(withGhlWebhookStatus({ ghl_webhook: "pending", price_id: "price_1" }, "failed").ghl_webhook).toBe("failed");
    expect(withGhlWebhookStatus(null, "skipped")).toEqual({ ghl_webhook: "skipped" });
    expect(cancelMessageStatus("sent")).toBe("sent");
    expect(cancelMessageStatus("failed")).toBe("failed");
    expect(cancelMessageStatus("skipped")).toBe("suppressed");
  });

  test("a scheduled countdown does not consume the immediate GoHighLevel post", async () => {
    const periodEnd = Date.parse("2026-11-16T14:30:07.000Z");
    const scheduled = planSubscriptionCancel({
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_test_later",
      status: "active",
      periodEndMs: periodEnd,
      cancelAtMs: periodEnd,
      nowMs: Date.parse("2026-10-24T17:55:37.000Z"),
    });
    const immediate = planSubscriptionCancel({
      eventType: "customer.subscription.deleted",
      subscriptionId: "sub_test_later",
      status: "canceled",
      periodEndMs: periodEnd,
      nowMs: Date.parse("2026-11-16T15:00:00.000Z"),
    });
    expect(scheduled.kind).toBe("cancel_at_period_end");
    expect(scheduled.inCancelBranch).toBe(false);
    expect(scheduled.keepsAccess).toBe(false);
    expect(immediate.kind).toBe("immediate");
    expect(immediate.keepsAccess).toBe(false);
    expect(scheduled.dedupeKey).toContain("2026-11-16T14:30:07.000Z:cancel_at_period_end");
    expect(immediate.dedupeKey).toContain("2026-11-16T14:30:07.000Z:immediate");
    expect(immediate.dedupeKey).not.toBe(scheduled.dedupeKey);

    const rows: SubscriptionCanceledMessage[] = [];
    const keys = new Set<string>();
    const posts: string[] = [];
    const record = (plan: CancelPlan) =>
      recordSubscriptionCanceled({
        email: "owner@agency.com",
        kind: plan.kind,
        dedupeKey: plan.dedupeKey,
        accessUntil: plan.accessUntil,
        insertMessage: async (row) => {
          const id = row.providerMessageId ?? "";
          if (id && keys.has(id)) return { ok: true, claimed: false };
          if (id) keys.add(id);
          rows.push(row);
          return { ok: true, claimed: true };
        },
        fetchImpl: async (url, init) => {
          posts.push(String(init?.body ?? ""));
          return new Response("ok", { status: 200 });
        },
      });

    const scheduledResult = await record(scheduled);
    const immediateResult = await record(immediate);
    expect(scheduledResult).toEqual({ webhookFired: false, logged: true, duplicate: false });
    expect(immediateResult).toEqual({ webhookFired: true, logged: true, duplicate: false });
    expect(rows.map((row) => row.metadata && (row.metadata as { kind?: string }).kind)).toEqual([
      "cancel_at_period_end",
      "immediate",
    ]);
    expect(posts).toEqual([JSON.stringify({ email: "owner@agency.com" })]);
  });

  test("paid access stays only while a canceled period is still in the future", () => {
    const now = Date.parse("2026-10-24T17:55:37.000Z");
    const future = Date.parse("2026-11-16T14:30:07.000Z");
    const past = Date.parse("2026-10-01T00:00:00.000Z");
    expect(keepsPaidAccess("canceled", future, now)).toBe(true);
    expect(keepsPaidAccess("canceled", past, now)).toBe(false);
    expect(keepsPaidAccess("canceled", null, now)).toBe(false);
    expect(keepsPaidAccess("active", future, now)).toBe(false);
    expect(keepsPaidAccess("unpaid", future, now)).toBe(false);
    expect(keepsPaidAccess("incomplete_expired", future, now)).toBe(false);

    const unpaid = planSubscriptionCancel({
      eventType: "customer.subscription.updated",
      subscriptionId: "sub_test_unpaid",
      status: "unpaid",
      periodEndMs: future,
      nowMs: now,
    });
    expect(unpaid.inCancelBranch).toBe(true);
    expect(unpaid.keepsAccess).toBe(false);
    expect(unpaid.kind).toBe("immediate");

    const deletedPast = planSubscriptionCancel({
      eventType: "customer.subscription.deleted",
      subscriptionId: "sub_test_past",
      status: "canceled",
      periodEndMs: past,
      nowMs: now,
    });
    expect(deletedPast.keepsAccess).toBe(false);
    expect(deletedPast.kind).toBe("immediate");
  });
});

describe("subscription outcome lines", () => {
  test("a deleted skip names the customer, the price, and the reason", () => {
    const line = outcome("cus_Nofound", "price_not_ours", "not a SaaSSuite price");
    expect(line).toBe(
      "[STRIPE-SUB-WEBHOOK] outcome customer=cus_Nofound price=price_not_ours result=not a SaaSSuite price",
    );
    expect(outcome("cus_unknown", "price_1", "unknown customer")).toContain("result=unknown customer");
    expect(outcome("owner@agency.com", "prod_addon", "other active plan")).toContain("price=prod_addon");
  });

  test("a subscription update with nothing to do still names the customer and price", () => {
    const line = outcome("owner@agency.com", "price_1UNPAOGdZ9PRE3ZiQIH5kh8O", "no change");
    expect(line).toContain("customer=owner@agency.com");
    expect(line).toContain("price=price_1UNPAOGdZ9PRE3ZiQIH5kh8O");
    expect(line).toContain("result=no change");
    expect(outcome("", "", "test mode")).toBe(
      "[STRIPE-SUB-WEBHOOK] outcome customer=unknown price=unknown result=test mode",
    );
  });

  test("the access-kept outcome keeps the customer, price, and the paid-through date", () => {
    const line = outcome(
      "buyer.example@agency.test",
      "price_1UNPAOGdZ9PRE3ZiQIH5kh8O",
      "canceled; access kept until 2026-11-18T14:39:03.000Z",
    );
    expect(line).toContain("customer=buyer.example@agency.test");
    expect(line).toContain("price=price_1UNPAOGdZ9PRE3ZiQIH5kh8O");
    expect(line).toContain("result=canceled; access kept until 2026-11-18T14:39:03.000Z");
  });
});

describe("stripe subscription webhook wiring", () => {
  test("every handled event ends in one outcome line", () => {
    const after = WEBHOOK.slice(WEBHOOK.indexOf("Received ${event.type}"));
    expect(after.match(/return new Response/g)).toHaveLength(1);
    expect(after).toContain('result: "no change"');
    expect(after).toContain('result: "not a SaaSSuite price"');
    expect(after).toContain('result: "unknown customer"');
    expect(after).toContain('"test mode"');
    expect(after).toContain("logSubscriptionOutcome");
  });

  test("handled cancels record subscription_canceled without Resend", () => {
    expect(WEBHOOK).toContain('kind: "cancel_at_period_end"');
    expect(WEBHOOK).toContain("kind: plan.kind");
    expect(WEBHOOK).toContain("dedupeKey: plan.dedupeKey");
    expect(WEBHOOK).toContain("insertMessage: insertTrackedMessage");
    expect(WEBHOOK).toContain("insertSubscriptionCanceledClaim");
    expect(WEBHOOK).toContain("applyImmediateCancelAttempt");
    expect(WEBHOOK).toContain("cancelResponseStatus");
    expect(WEBHOOK).toContain("subscription_canceled claim failed");
    expect(WEBHOOK).toContain('contains("details", { cancel_key: postKey })');
    expect(WEBHOOK).toContain("dedupeKey: postKey");
    expect(WEBHOOK).toContain('action: "past_due"');
    expect(WEBHOOK).not.toContain("delinquency as { skipped?: boolean }");
    expect(WEBHOOK).toContain("access_until: plan.accessUntil");
    expect(WEBHOOK).toContain("let sessionEmailForLog");
    expect(WEBHOOK).not.toMatch(/const sessionEmailForLog/);
    const log = readFileSync("supabase/functions/_shared/subscription-cancel-log.ts", "utf8");
    expect(log).toContain("claim_subscription_canceled_message");
    expect(log).toContain("withGhlWebhookStatus");
    const grace = readFileSync("supabase/functions/expire-payment-grace/index.ts", "utf8");
    expect(grace).toContain("resolveImmediateCancelClaimKey");
    expect(grace).not.toContain("left to the Stripe delete");
    expect(grace).toContain("recordSubscriptionCanceled");
    expect(WEBHOOK).toContain("immediateClaimKeysToHonor");
    expect(WEBHOOK).toContain("for (const key of honorKeys)");
    expect(WEBHOOK).toContain("cancel_claim_key: immediateKey");
    expect(grace).toContain("stripe_canceled_period_end");
    expect(grace).toContain("payment_grace_expired");
    expect(log).toContain('"access_kept"');
    expect(log).toContain('"immediate"');
    expect(log).toContain('"cancel_at_period_end"');
    expect(WEBHOOK).not.toMatch(/resend/i);
    expect(WEBHOOK).not.toContain("sk_live");
    expect(WEBHOOK).not.toContain("whsec_");
  });
});

describe("shared cancel claim", () => {
  test("a stored subscription key is the one grace and the delete both use", () => {
    const until = "2026-11-19T09:01:52.000Z";
    const email = "buyer@agency.test";
    const subKey = cancelDedupeKey("sub_1UN7mR", until, "immediate");
    expect(resolveImmediateCancelClaimKey({
      storedKey: subKey,
      priorMessages: [],
      cancelAccessUntil: until,
      email,
    })).toBe(subKey);
    const honor = immediateClaimKeysToHonor({
      subscriptionKey: subKey,
      email,
      storedKey: subKey,
      instants: [until, "2026-11-19T09:01:52+00:00"],
    });
    expect(honor[0]).toBe(subKey);
    expect(honor).toContain(emailImmediateClaimKey(email, until));
    expect(honor.filter((key) => key === emailImmediateClaimKey(email, until))).toHaveLength(1);
  });

  test("no prior row still posts once because the delete honors the email key", async () => {
    const until = "2026-10-26T05:22:53.000Z";
    const email = "owner@agency.com";
    const emailKey = emailImmediateClaimKey(` ${email} `, until);
    const subKey = cancelDedupeKey("sub_kevin", until, "immediate");
    expect(resolveImmediateCancelClaimKey({
      storedKey: null,
      priorMessages: [],
      cancelAccessUntil: until,
      email: ` ${email} `,
    })).toBe(emailKey);
    expect(emailImmediateClaimKey(email, "2026-10-26T05:22:53+00:00")).toBe(emailKey);

    const claimed = new Set<string>();
    let posts = 0;
    const insertMessage = async (row: SubscriptionCanceledMessage) => {
      const key = row.providerMessageId ?? "";
      if (claimed.has(key)) return { ok: true as const, claimed: false };
      claimed.add(key);
      return { ok: true as const, claimed: true };
    };
    const send = (dedupeKey: string) => recordSubscriptionCanceled({
      email,
      kind: "immediate",
      dedupeKey,
      accessUntil: until,
      source: "expire-payment-grace",
      webhookBody: { email, reason: "stripe_canceled_period_end" },
      insertMessage,
      fetchImpl: async () => {
        posts += 1;
        return new Response("ok", { status: 200 });
      },
    });

    await send(emailKey);
    const honor = immediateClaimKeysToHonor({
      subscriptionKey: subKey,
      email,
      storedKey: null,
      instants: [until],
    });
    expect(honor.some((key) => claimed.has(key))).toBe(true);
    expect(posts).toBe(1);
    const again = await send(emailKey);
    expect(again.duplicate).toBe(true);
    expect(posts).toBe(1);
  });
});
