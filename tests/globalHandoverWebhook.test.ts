import { test, expect } from "bun:test";
import {
  buildGlobalHandoverPayload,
  claimGlobalHandover,
  handoverInputFromSupportAlert,
  withSupportAlertEnvelope,
  deliverGlobalHandover,
  globalHandoverAuthHeader,
  globalHandoverWebhookUrl,
  deferGlobalHandoverRequested,
  handoverAlreadySent,
  handoverLastCustomerMessage,
  handoverPersonKey,
  handoverStableKey,
  isAiAutoOpenedHandoverTicket,
  notifyGlobalHandover,
  serviceRoleAuthorized,
  testHandoverPayload,
  type HandoverDb,
} from "../supabase/functions/_shared/globalHandoverWebhook.ts";

test("auto-opened handover tickets are recognized and ordinary tickets are not", () => {
  expect(isAiAutoOpenedHandoverTicket("Human handover request from AI support.\nIssue:\nNeed help.")).toBe(true);
  expect(isAiAutoOpenedHandoverTicket("  human handover request from AI support")).toBe(true);
  expect(isAiAutoOpenedHandoverTicket("Customer asked about DNS records")).toBe(false);
  expect(isAiAutoOpenedHandoverTicket("")).toBe(false);
});

test("webhook URL and auth come only from the env values", () => {
  expect(globalHandoverWebhookUrl(undefined)).toBeNull();
  expect(globalHandoverWebhookUrl("   ")).toBeNull();
  expect(globalHandoverWebhookUrl(" https://hooks.example/handover ")).toBe("https://hooks.example/handover");
  expect(globalHandoverAuthHeader(undefined)).toBeUndefined();
  expect(globalHandoverAuthHeader("")).toBeUndefined();
  expect(globalHandoverAuthHeader("Token abc")).toBe("Token abc");
});

test("service role is required and the anon key is refused", () => {
  expect(serviceRoleAuthorized("Bearer service-secret", "service-secret")).toBe(true);
  expect(serviceRoleAuthorized("Bearer anon-key", "service-secret")).toBe(false);
  expect(serviceRoleAuthorized(null, "service-secret")).toBe(false);
  expect(serviceRoleAuthorized("Bearer service-secret", undefined)).toBe(false);
  expect(serviceRoleAuthorized("service-secret", "service-secret")).toBe(false);
});

test("one handover claims once per type per thread inside the window", async () => {
  const rows = new Map<string, { id: string; last_sent_at: string }>();
  const db = {
    from() {
      const filters: Record<string, string> = {};
      const api = {
        select() { return api; },
        eq(column: string, value: string) { filters[column] = value; return api; },
        async maybeSingle() {
          const key = `${filters.source}|${filters.agency_id}|${filters.identifier}`;
          const row = rows.get(key);
          return { data: row ?? null, error: null };
        },
        async insert(row: { source: string; agency_id: string; identifier: string; last_sent_at: string }) {
          const key = `${row.source}|${row.agency_id}|${row.identifier}`;
          if (rows.has(key)) return { error: { code: "23505", message: "duplicate" } };
          rows.set(key, { id: "row-1", last_sent_at: row.last_sent_at });
          return { data: null, error: null };
        },
        update(row: { last_sent_at: string }) {
          return { eq(_column: string, id: string) {
            const found = [...rows.values()].find((item) => item.id === id);
            if (found) found.last_sent_at = row.last_sent_at;
            return Promise.resolve({ error: null });
          } };
        },
      };
      return api;
    },
  } as HandoverDb;

  const now = Date.parse("2026-10-21T15:16:56.000Z");
  expect(await claimGlobalHandover(db, "Keystone", "handover_requested:hub:keystone:fran@digitalaspect.io", now)).toBe(true);
  expect(await claimGlobalHandover(db, "keystone", "handover_requested:hub:keystone:fran@digitalaspect.io", now + 1000)).toBe(false);
  expect(await claimGlobalHandover(db, "keystone", "ticket_auto_opened:hub:keystone:fran@digitalaspect.io", now + 1000)).toBe(true);
  expect(handoverAlreadySent(new Date(now).toISOString(), now + 11 * 60 * 1000)).toBe(false);
});

test("payload matches the handover contract and the test event is obviously fake", () => {
  const payload = buildGlobalHandoverPayload({
    event: "ticket_auto_opened",
    agencyId: "keystone",
    customerEmail: "fran@digitalaspect.io",
    customerName: "Guest",
    ticketNumber: 246,
    lastCustomerMessage: "Need help.",
    timestamp: "2026-10-21T15:16:56.810Z",
  }, "thread-1");
  expect(payload).toEqual({
    event: "ticket_auto_opened",
    agency_id: "keystone",
    customer_email: "fran@digitalaspect.io",
    customer_name: "Guest",
    thread_id: "thread-1",
    ticket_number: 246,
    last_customer_message: "Need help.",
    timestamp: "2026-10-21T15:16:56.810Z",
  });
  expect(payload).not.toHaveProperty("test");

  const testEvent = testHandoverPayload("2026-10-21T16:00:00.000Z");
  expect(testEvent.event).toBe("handover_requested");
  expect(testEvent.test).toBe(true);
  expect(testEvent.customer_email).toBe("handover-test@example.com");
  expect(testEvent.thread_id).toBe("test-thread");
  expect(testEvent.ticket_number).toBeNull();
});

test("unset URL skips, auth is sent as-is, and a failed post does not throw", async () => {
  const posts: { url: string; body: string; auth?: string }[] = [];
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  let skipped: string;
  try {
    skipped = await notifyGlobalHandover({
      event: "handover_requested",
      agencyId: "keystone",
      customerEmail: "fran@digitalaspect.io",
      threadId: "thread-1",
    }, { webhookUrl: "  ", db: null, waitUntil: null });
  } finally {
    console.warn = originalWarn;
  }
  expect(skipped!).toBe("skipped");
  expect(warnings).toEqual([[
    "global handover webhook skipped: SUPPORT_HANDOVER_WEBHOOK_URL not configured",
    "handover_requested",
    "keystone",
  ]]);

  const result = await notifyGlobalHandover({
    event: "handover_requested",
    agencyId: "keystone",
    customerEmail: "fran@digitalaspect.io",
    customerName: "Fran",
    threadId: "thread-1",
    lastCustomerMessage: "I need a human",
    dedupe: false,
  }, {
    webhookUrl: "https://hooks.example/handover",
    authHeader: "Token raw-secret",
    db: null,
    waitUntil: null,
    post: async (url, body, authHeader) => {
      posts.push({ url, body, auth: authHeader });
      return { ok: false, status: 500 };
    },
  });
  expect(result).toBe("failed");
  expect(posts).toHaveLength(1);
  expect(posts[0].url).toBe("https://hooks.example/handover");
  expect(posts[0].auth).toBe("Token raw-secret");
  expect(JSON.parse(posts[0].body).event).toBe("handover_requested");
  expect(handoverStableKey({ agencyId: "Keystone", customerEmail: "Fran@DigitalAspect.io" }))
    .toBe("hub:keystone:fran@digitalaspect.io");
  expect(handoverPersonKey({ userIdentifier: "email:fran@digitalaspect.io" })).toBe("fran@digitalaspect.io");
  expect(handoverStableKey({
    agencyId: "keystone",
    userIdentifier: "email:fran@digitalaspect.io",
    customerEmail: "Fran@DigitalAspect.io",
  })).toBe("hub:keystone:fran@digitalaspect.io");
  expect(handoverStableKey({ agencyId: "keystone", userIdentifier: "name:Guest" }))
    .toBe("hub:keystone:guest");
  expect(handoverStableKey({ surface: "copilot", agencyId: "keystone", customerEmail: "fran@digitalaspect.io" }))
    .toBe("copilot:keystone:fran@digitalaspect.io");
});

test("a rate-limit id and the plain email produce one handover post", async () => {
  const rows = new Map<string, { id: string; last_sent_at: string }>();
  const db = {
    from(table: string) {
      const filters: Record<string, string> = {};
      const api = {
        select() { return api; },
        eq(column: string, value: string) { filters[column] = value; return api; },
        ilike() { return api; },
        limit() {
          return Promise.resolve({
            data: table === "chat_threads" ? [{ id: "0c39db04-ae75-4ad3-a46c-8afee2cb3521" }] : [],
            error: null,
          });
        },
        async maybeSingle() {
          const key = `${filters.source}|${filters.agency_id}|${filters.identifier}`;
          return { data: rows.get(key) ?? null, error: null };
        },
        async insert(row: { source: string; agency_id: string; identifier: string; last_sent_at: string }) {
          const key = `${row.source}|${row.agency_id}|${row.identifier}`;
          if (rows.has(key)) return { error: { code: "23505", message: "duplicate" } };
          rows.set(key, { id: `row-${rows.size + 1}`, last_sent_at: row.last_sent_at });
          return { data: null, error: null };
        },
        update(row: { last_sent_at: string }) {
          return { eq(_column: string, id: string) {
            const found = [...rows.values()].find((item) => item.id === id);
            if (found) found.last_sent_at = row.last_sent_at;
            return Promise.resolve({ error: null });
          } };
        },
      };
      return api;
    },
  } as HandoverDb;
  const posts: string[] = [];
  const deps = {
    webhookUrl: "https://hooks.example/handover",
    authHeader: "Token raw-secret",
    db,
    waitUntil: null as null,
    now: Date.parse("2026-10-21T15:16:56.000Z"),
    post: async (_url: string, body: string) => {
      posts.push(body);
      return { ok: true, status: 200 };
    },
  };
  const first = await notifyGlobalHandover({
    event: "handover_requested",
    agencyId: "Keystone",
    customerEmail: "Fran@DigitalAspect.io",
    userIdentifier: "email:fran@digitalaspect.io",
    threadId: "0c39db04-ae75-4ad3-a46c-8afee2cb3521",
    lastCustomerMessage: "I need a human",
  }, deps);
  const infos: unknown[][] = [];
  const originalInfo = console.info;
  console.info = (...args: unknown[]) => { infos.push(args); };
  let second: string;
  try {
    second = await notifyGlobalHandover({
      event: "handover_requested",
      agencyId: "keystone",
      customerEmail: "fran@digitalaspect.io",
      lastCustomerMessage: "I need a human",
    }, deps);
  } finally {
    console.info = originalInfo;
  }
  expect(first).toBe("sent");
  expect(second!).toBe("duplicate");
  expect(infos).toEqual([[
    "global handover webhook duplicate",
    "handover_requested",
    "keystone",
  ]]);
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0]).thread_id).toBe("0c39db04-ae75-4ad3-a46c-8afee2cb3521");
});

test("the final widget payload uses issue_description when last_message is absent", () => {
  expect(handoverLastCustomerMessage(undefined, "The menu link is missing on two sub-accounts.")).toBe(
    "The menu link is missing on two sub-accounts.",
  );
  expect(handoverLastCustomerMessage(null, "Need the login page updated.")).toBe("Need the login page updated.");
  expect(handoverLastCustomerMessage("help", "The real issue")).toBe("help");
  expect(handoverLastCustomerMessage(undefined, undefined)).toBeNull();
  expect(handoverLastCustomerMessage({ text: "nope" }, 12)).toBeNull();
});

test("defer_global_handover is only a boolean true on the body or metadata", () => {
  expect(deferGlobalHandoverRequested({ defer_global_handover: true })).toBe(true);
  expect(deferGlobalHandoverRequested({ metadata: { defer_global_handover: true, last_message: "help" } })).toBe(true);
  expect(deferGlobalHandoverRequested({ defer_global_handover: false, metadata: { source: "hub" } })).toBe(false);
  expect(deferGlobalHandoverRequested({ defer_global_handover: "true" })).toBe(false);
  expect(deferGlobalHandoverRequested({ metadata: { defer_global_handover: 1 } })).toBe(false);
  expect(deferGlobalHandoverRequested({})).toBe(false);
  expect(deferGlobalHandoverRequested(null)).toBe(false);
});

test("support alerts keep the hub claim unless Copilot sets a surface and thread", () => {
  const hub = handoverInputFromSupportAlert({
    user_email: "fran@digitalaspect.io",
    user_name: "Fran",
    last_message: "I need a human",
    timestamp: "2026-10-21T15:16:56.810Z",
  }, "keystone", "email:fran@digitalaspect.io");
  expect(hub.surface).toBeUndefined();
  expect(hub.threadId).toBeUndefined();
  expect(hub.event).toBe("handover_requested");
  expect(hub.userIdentifier).toBe("fran@digitalaspect.io");
  expect(handoverStableKey(hub)).toBe("hub:keystone:fran@digitalaspect.io");
  expect(withSupportAlertEnvelope(
    { contact_email: "fran@digitalaspect.io", event_type: "other" },
    { event: "human_handover", agency_id: "keystone", user_email: "fran@digitalaspect.io", last_message: "I need a human" },
  )).toMatchObject({
    notification_type: "support_alert",
    event_type: "chat_handover",
    event: "human_handover",
    contact_email: "fran@digitalaspect.io",
    last_message: "I need a human",
  });
});

test("deliver aborts a slow webhook at about 3 seconds", async () => {
  const started = Date.now();
  const result = await deliverGlobalHandover(testHandoverPayload(), "https://hooks.example/slow", "Token x", (_url, _body, _auth, signal) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")));
    }), 50);
  expect(result).toBe("failed");
  expect(Date.now() - started).toBeLessThan(1000);
});
