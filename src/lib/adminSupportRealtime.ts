import { compareCreatedAtThenId } from "../../supabase/functions/admin-support-api/ticket-reply";

/** Open transcript catch-up while the tab is visible. Realtime stays primary. */
export const OPEN_CONVERSATION_POLL_MS = 4000;

/** Inbox list catch-up. Slower than the open transcript so the full ticket read stays quiet. */
export const INBOX_POLL_MS = 15000;

export const ADMIN_SUPPORT_REALTIME_TABLES = [
  "agency_owner_messages",
  "ai_chat_messages",
  "chat_threads",
  "support_tickets",
  "support_ticket_replies",
] as const;

export type AdminSupportRealtimeTable = (typeof ADMIN_SUPPORT_REALTIME_TABLES)[number];

export type ChatMsg = {
  id: string;
  content: string;
  role: string;
  created_at: string;
  sender_type?: string;
};

export type ThreadIdentity = {
  agency_id: string;
  user_identifier: string;
};

export type TicketReply = {
  id: string;
  sender_role: string;
  sender_name: string | null;
  sender_email: string | null;
  body: string;
  created_at: string;
};

type RealtimePayload = {
  eventType?: string;
  event?: string;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
};

type RealtimeClientLike = {
  channel: (name: string) => any;
  removeChannel: (channel: any) => void;
  realtime: { setAuth: (token: string) => void };
};

export function supportPartyKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function rowMatchesThread(
  row: { agency_id?: unknown; user_identifier?: unknown } | null | undefined,
  thread: ThreadIdentity | null,
): boolean {
  if (!row || !thread) return false;
  return (
    supportPartyKey(row.agency_id) === supportPartyKey(thread.agency_id) &&
    supportPartyKey(row.user_identifier) === supportPartyKey(thread.user_identifier)
  );
}

export function realtimeEventType(payload: RealtimePayload): string {
  return payload.eventType || payload.event || "";
}

export function realtimeRow(payload: RealtimePayload): Record<string, unknown> | null {
  if (realtimeEventType(payload) === "DELETE") return payload.old ?? null;
  const inserted = payload.new;
  if (inserted && Object.keys(inserted).length > 0) return inserted;
  return payload.old ?? null;
}

export function chatMessageFromRealtime(
  table: "ai_chat_messages" | "agency_owner_messages",
  row: Record<string, unknown>,
): ChatMsg | null {
  const id = String(row.id || "");
  if (!id) return null;
  if (table === "agency_owner_messages") {
    return {
      id,
      content: String(row.content ?? ""),
      role: "agency_owner",
      sender_type: String(row.sender_type || "agency_owner"),
      created_at: String(row.created_at || new Date(0).toISOString()),
    };
  }
  const role = String(row.role || "assistant");
  return {
    id,
    content: String(row.content ?? ""),
    role,
    sender_type: role,
    created_at: String(row.created_at || new Date(0).toISOString()),
  };
}

export function mergeChatMessages(prev: ChatMsg[], incoming: ChatMsg[]): ChatMsg[] {
  const byId = new Map(prev.map((message) => [message.id, message]));
  incoming.forEach((message) => {
    const existing = byId.get(message.id);
    byId.set(message.id, existing ? { ...existing, ...message, id: message.id } : message);
  });
  return Array.from(byId.values()).sort((a, b) => {
    const byTime = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (byTime) return byTime;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Insert or replace one realtime chat row in the open transcript. Same id stays one row. */
export function applyIncomingChatMessage(
  prev: ChatMsg[],
  table: "ai_chat_messages" | "agency_owner_messages",
  row: Record<string, unknown>,
  thread: ThreadIdentity | null,
): ChatMsg[] {
  if (!rowMatchesThread(row, thread)) return prev;
  const message = chatMessageFromRealtime(table, row);
  if (!message) return prev;
  return mergeChatMessages(prev, [message]);
}

export function removeChatMessage(
  prev: ChatMsg[],
  row: Record<string, unknown>,
  thread: ThreadIdentity | null,
): ChatMsg[] {
  if (!row?.id) return prev;
  if (row.agency_id != null || row.user_identifier != null) {
    if (!rowMatchesThread(row, thread)) return prev;
  }
  if (!prev.some((message) => message.id === String(row.id))) return prev;
  return prev.filter((message) => message.id !== String(row.id));
}

export function upsertById<T extends { id: string }>(rows: T[], row: T): T[] {
  const id = String(row.id || "");
  if (!id) return rows;
  const index = rows.findIndex((item) => item.id === id);
  if (index < 0) return [{ ...row, id }, ...rows];
  const next = rows.slice();
  next[index] = { ...rows[index], ...row, id };
  return next;
}

export function removeById<T extends { id: string }>(rows: T[], id: string): T[] {
  if (!rows.some((row) => row.id === id)) return rows;
  return rows.filter((row) => row.id !== id);
}

export function ticketReplyFromRealtime(
  row: Record<string, unknown>,
  ticketId: string,
): TicketReply | null {
  if (!row.id || String(row.ticket_id || "") !== ticketId) return null;
  return {
    id: String(row.id),
    sender_role: String(row.sender_role || "customer"),
    sender_name: row.sender_name == null ? null : String(row.sender_name),
    sender_email: row.sender_email == null ? null : String(row.sender_email),
    body: String(row.body ?? ""),
    created_at: String(row.created_at || new Date(0).toISOString()),
  };
}

export function mergeTicketReplies(prev: TicketReply[], incoming: TicketReply[]): TicketReply[] {
  const byId = new Map(prev.map((reply) => [reply.id, reply]));
  incoming.forEach((reply) => {
    const existing = byId.get(reply.id);
    byId.set(reply.id, existing ? { ...existing, ...reply, id: reply.id } : reply);
  });
  return Array.from(byId.values()).sort(compareCreatedAtThenId);
}

export function applyTicketReply(
  prev: TicketReply[],
  row: Record<string, unknown>,
  ticketId: string,
): TicketReply[] {
  const reply = ticketReplyFromRealtime(row, ticketId);
  if (!reply) return prev;
  return mergeTicketReplies(prev, [reply]);
}

/** The just-sent team response is already in the thread once its realtime/server row arrives. */
export function withLatestTicketResponse(
  replies: TicketReply[],
  latestResponse?: string | null,
  latestResponseAt?: string | null,
): TicketReply[] {
  const items = [...replies];
  const trimmed = latestResponse?.trim();
  if (
    trimmed &&
    !items.some((reply) => reply.sender_role !== "customer" && reply.body.trim() === trimmed)
  ) {
    items.push({
      id: "latest-response",
      sender_role: "admin",
      sender_name: "SaaS Suite",
      sender_email: null,
      body: trimmed,
      created_at: latestResponseAt || new Date(0).toISOString(),
    });
  }
  items.sort(compareCreatedAtThenId);
  return items;
}

export function realtimeStatusNeedsReconnect(status: string): boolean {
  return status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED";
}

/**
 * One admin inbox channel. The caller owns how long it lives; this does not
 * resubscribe when the open conversation changes. A fresh topic avoids joining
 * a channel that is still leaving under the same name.
 */
export function bindAdminSupportRealtime(
  client: RealtimeClientLike,
  options: {
    getAccessToken: () => string;
    onPayload: (table: AdminSupportRealtimeTable, payload: RealtimePayload) => void;
    onStatus?: (status: string) => void;
    scheduleRetry?: (run: () => void) => void;
  },
): { unsubscribe: () => void } {
  let stopped = false;
  let generation = 0;
  let active: any = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryQueued = false;

  const clearRetry = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    retryQueued = false;
  };

  const connect = () => {
    if (stopped) return;
    const token = options.getAccessToken();
    if (!token) return;
    const gen = ++generation;
    const previous = active;
    client.realtime.setAuth(token);
    const channel = client.channel(`admin-support-inbox-${crypto.randomUUID()}`);
    active = channel;
    if (previous) client.removeChannel(previous);
    for (const table of ADMIN_SUPPORT_REALTIME_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        if (stopped || gen !== generation) return;
        options.onPayload(table, payload);
      });
    }
    channel.subscribe((status) => {
      if (stopped || gen !== generation) return;
      options.onStatus?.(status);
      if (status === "SUBSCRIBED") {
        clearRetry();
        return;
      }
      if (!realtimeStatusNeedsReconnect(status) || retryQueued) return;
      retryQueued = true;
      const run = () => {
        retryQueued = false;
        retryTimer = null;
        if (stopped || gen !== generation) return;
        connect();
      };
      if (options.scheduleRetry) options.scheduleRetry(run);
      else retryTimer = setTimeout(run, 1500);
    });
  };

  connect();

  return {
    unsubscribe() {
      stopped = true;
      generation += 1;
      clearRetry();
      if (active) client.removeChannel(active);
      active = null;
    },
  };
}
