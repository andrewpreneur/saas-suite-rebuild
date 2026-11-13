import { expect, test } from "bun:test";
import {
  ADMIN_SUPPORT_REALTIME_TABLES,
  applyIncomingChatMessage,
  applyTicketReply,
  bindAdminSupportRealtime,
  mergeChatMessages,
  removeById,
  rowMatchesThread,
  upsertById,
  withLatestTicketResponse,
  type ChatMsg,
  type TicketReply,
} from "../src/lib/adminSupportRealtime";

const openThread = {
  id: "thread-1",
  agency_id: "keystone",
  user_identifier: "fran@digitalaspect.io",
};

const customerRow = {
  id: "msg-customer",
  agency_id: "Keystone",
  user_identifier: "Fran@digitalaspect.io",
  role: "user",
  content: "I need a person",
  created_at: "2026-11-06T18:00:00.000Z",
};

function message(
  partial: Partial<ChatMsg> & Pick<ChatMsg, "id" | "content" | "created_at">,
): ChatMsg {
  return { role: "user", sender_type: "user", ...partial };
}

test("a customer chat insert arrives in the open conversation and the thread list", () => {
  expect(rowMatchesThread(customerRow, openThread)).toBe(true);
  const messages = applyIncomingChatMessage([], "ai_chat_messages", customerRow, openThread);
  expect(messages).toEqual([
    {
      id: "msg-customer",
      content: "I need a person",
      role: "user",
      sender_type: "user",
      created_at: "2026-11-06T18:00:00.000Z",
    },
  ]);

  const threads = upsertById(
    [
      {
        ...openThread,
        last_user_message_at: "2026-11-06T17:00:00.000Z",
        updated_at: "2026-11-06T17:00:00.000Z",
      },
    ],
    {
      id: "thread-1",
      agency_id: "keystone",
      user_identifier: "fran@digitalaspect.io",
      last_user_message_at: "2026-11-06T18:00:00.000Z",
      updated_at: "2026-11-06T18:00:01.000Z",
    },
  );
  expect(threads).toHaveLength(1);
  expect(threads[0].last_user_message_at).toBe("2026-11-06T18:00:00.000Z");
  expect(threads[0].updated_at).toBe("2026-11-06T18:00:01.000Z");
});

test("another chat does not enter the open transcript, and an optimistic send is one row", () => {
  const optimistic = message({
    id: "optimistic-1",
    content: "On it",
    role: "agency_owner",
    sender_type: "agency_owner",
    created_at: "2026-11-06T18:01:00.000Z",
  });
  const openMessages = [optimistic];
  const other = applyIncomingChatMessage(
    openMessages,
    "ai_chat_messages",
    {
      ...customerRow,
      id: "other-chat",
      agency_id: "other-agency",
      content: "different customer",
    },
    openThread,
  );
  expect(other).toBe(openMessages);

  const echoed = applyIncomingChatMessage(
    openMessages,
    "agency_owner_messages",
    {
      id: "optimistic-1",
      agency_id: "keystone",
      user_identifier: "fran@digitalaspect.io",
      sender_type: "agency_owner",
      content: "On it",
      created_at: "2026-11-06T18:01:00.000Z",
    },
    openThread,
  );
  expect(echoed).toHaveLength(1);
  expect(echoed[0].id).toBe("optimistic-1");
  expect(echoed[0].content).toBe("On it");

  const followed = applyIncomingChatMessage(
    echoed,
    "ai_chat_messages",
    {
      ...customerRow,
      id: "msg-followup",
      content: "Thanks",
      created_at: "2026-11-06T18:02:00.000Z",
    },
    openThread,
  );
  expect(followed.map((row) => row.id)).toEqual(["optimistic-1", "msg-followup"]);
});

test("older pages and live rows merge by id", () => {
  const older = message({ id: "old", content: "earlier", created_at: "2026-11-06T17:00:00.000Z" });
  const live = message({ id: "live", content: "now", created_at: "2026-11-06T18:00:00.000Z" });
  const merged = mergeChatMessages([live], [older, live]);
  expect(merged.map((row) => row.id)).toEqual(["old", "live"]);
});

test("a customer ticket reply arrives on the open ticket and the ticket list", () => {
  const ticketId = "11111111-1111-4111-8111-111111111111";
  const replies = applyTicketReply(
    [],
    {
      id: "reply-1",
      ticket_id: ticketId,
      sender_role: "customer",
      sender_name: "Fran",
      sender_email: "fran@digitalaspect.io",
      body: "Following up",
      created_at: "2026-11-06T18:05:00.000Z",
    },
    ticketId,
  );
  expect(replies.map((reply) => reply.body)).toEqual(["Following up"]);

  const ignored = applyTicketReply(
    replies,
    {
      id: "reply-other",
      ticket_id: "22222222-2222-4222-8222-222222222222",
      sender_role: "customer",
      body: "other ticket",
      created_at: "2026-11-06T18:06:00.000Z",
    },
    ticketId,
  );
  expect(ignored).toBe(replies);

  const tickets = upsertById(
    [{ id: ticketId, status: "responded", updated_at: "2026-11-06T17:00:00.000Z" }],
    { id: ticketId, status: "open", updated_at: "2026-11-06T18:05:00.000Z" },
  );
  expect(tickets).toEqual([
    { id: ticketId, status: "open", updated_at: "2026-11-06T18:05:00.000Z" },
  ]);
  expect(removeById(tickets, "missing")).toBe(tickets);
});

test("ticket optimistic send and the realtime row stay one reply", () => {
  const ticketId = "11111111-1111-4111-8111-111111111111";
  const sent: TicketReply = {
    id: "team-reply-1",
    sender_role: "admin",
    sender_name: "SaaS Suite",
    sender_email: null,
    body: "Thanks, this is fixed",
    created_at: "2026-11-06T18:10:00.000Z",
  };
  const echoed = applyTicketReply(
    [sent],
    {
      ...sent,
      ticket_id: ticketId,
    },
    ticketId,
  );
  expect(echoed).toHaveLength(1);
  expect(echoed[0].id).toBe("team-reply-1");

  const shown = withLatestTicketResponse(
    echoed,
    "Thanks, this is fixed",
    "2026-11-06T18:10:00.000Z",
  );
  expect(shown).toHaveLength(1);
  expect(shown[0].id).toBe("team-reply-1");

  const pending = withLatestTicketResponse([], "Thanks, this is fixed", "2026-11-06T18:10:00.000Z");
  expect(pending.map((reply) => reply.id)).toEqual(["latest-response"]);
  const landed = withLatestTicketResponse(
    applyTicketReply([], { ...sent, ticket_id: ticketId }, ticketId),
    "Thanks, this is fixed",
    "2026-11-06T18:10:00.000Z",
  );
  expect(landed.map((reply) => reply.id)).toEqual(["team-reply-1"]);
});

test("the inbox channel auths once, listens to replies, and reconnects after a drop", () => {
  const statuses: string[] = [];
  const payloads: string[] = [];
  const tokens: string[] = [];
  const channels: Array<{
    name: string;
    tables: string[];
    handlers: Record<string, (payload: unknown) => void>;
    status?: (status: string) => void;
  }> = [];
  let removed = 0;
  let retry: (() => void) | null = null;
  const client = {
    realtime: { setAuth: (token: string) => tokens.push(token) },
    removeChannel: () => {
      removed += 1;
    },
    channel(name: string) {
      const channel = {
        name,
        tables: [] as string[],
        handlers: {} as Record<string, (payload: unknown) => void>,
        status: undefined as ((status: string) => void) | undefined,
        on(_event: string, filter: { table: string }, callback: (payload: unknown) => void) {
          channel.tables.push(filter.table);
          channel.handlers[filter.table] = callback;
          return channel;
        },
        subscribe(cb?: (status: string) => void) {
          channel.status = cb;
          cb?.("SUBSCRIBED");
          return channel;
        },
      };
      channels.push(channel);
      return channel;
    },
  };

  const bound = bindAdminSupportRealtime(client, {
    getAccessToken: () => "session-token",
    onPayload: (table) => payloads.push(table),
    onStatus: (status) => statuses.push(status),
    scheduleRetry: (run) => {
      retry = run;
    },
  });

  expect(tokens).toEqual(["session-token"]);
  expect(channels).toHaveLength(1);
  expect(channels[0].name.startsWith("admin-support-inbox-")).toBe(true);
  expect(channels[0].tables).toEqual([...ADMIN_SUPPORT_REALTIME_TABLES]);
  expect(statuses).toEqual(["SUBSCRIBED"]);
  channels[0].handlers.ai_chat_messages?.({ eventType: "INSERT", new: customerRow });
  expect(payloads).toEqual(["ai_chat_messages"]);

  channels[0].status?.("TIMED_OUT");
  expect(statuses).toEqual(["SUBSCRIBED", "TIMED_OUT"]);
  expect(channels).toHaveLength(1);
  expect(retry).toBeTypeOf("function");
  retry?.();
  expect(tokens).toEqual(["session-token", "session-token"]);
  expect(channels).toHaveLength(2);
  expect(channels[1].tables).toEqual([...ADMIN_SUPPORT_REALTIME_TABLES]);
  expect(removed).toBe(1);

  bound.unsubscribe();
  expect(removed).toBe(2);
  const before = channels.length;
  retry?.();
  expect(channels).toHaveLength(before);
});
