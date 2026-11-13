import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  API_TICKET_REPLY_SENDER,
  compareCreatedAtThenId,
  recordTicketReply,
  teamReplySenderEmail,
} from "../supabase/functions/admin-support-api/ticket-reply";

const JS_RESPONDED_AT = new Date("2020-01-01T00:00:00.453Z");

const schema = `
CREATE ROLE anon;
CREATE ROLE authenticated;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY,
  admin_response text,
  responded_at timestamptz,
  responded_by text,
  responded_by_name text,
  status text,
  updated_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.support_ticket_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id),
  sender_role text NOT NULL,
  sender_name text,
  sender_email text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.reply_webhook_calls (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL,
  body text NOT NULL
);

CREATE FUNCTION public.count_ticket_reply_webhook()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.reply_webhook_calls (ticket_id, body) VALUES (NEW.ticket_id, NEW.body);
  RETURN NEW;
END $$;

CREATE TRIGGER trg_count_ticket_reply_webhook
AFTER INSERT ON public.support_ticket_replies
FOR EACH ROW EXECUTE FUNCTION public.count_ticket_reply_webhook();
`;

type ReplyRow = {
  id: string;
  sender_email: string | null;
  sender_name: string | null;
  sender_role: string;
  body: string;
  created_at: string | Date;
};

function sameInstant(value: string | Date, expected: Date) {
  return Math.abs(new Date(value).getTime() - expected.getTime()) < 2;
}

async function seedTicket(db: PGlite) {
  const id = crypto.randomUUID();
  await db.query(`INSERT INTO public.support_tickets (id, status) VALUES ($1, 'open')`, [id]);
  return id;
}

async function replies(db: PGlite, ticketId: string) {
  const result = await db.query<ReplyRow>(
    `SELECT id::text AS id, sender_email, sender_name, sender_role, body, created_at
     FROM public.support_ticket_replies WHERE ticket_id = $1 ORDER BY created_at, id`,
    [ticketId],
  );
  return result.rows;
}

async function webhookCount(db: PGlite, ticketId: string) {
  const result = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.reply_webhook_calls WHERE ticket_id = $1`,
    [ticketId],
  );
  return Number(result.rows[0].n);
}

async function ticketResponse(db: PGlite, ticketId: string) {
  const result = await db.query<{ admin_response: string | null; responded_by: string | null; status: string | null }>(
    `SELECT admin_response, responded_by, status FROM public.support_tickets WHERE id = $1`,
    [ticketId],
  );
  return result.rows[0];
}

async function apiReply(
  db: PGlite,
  ticketId: string,
  input: {
    message?: string;
    senderName?: string;
    senderEmail?: string | null;
    status?: string | null;
    notify?: boolean;
    now?: Date;
  } = {},
) {
  const emails: string[] = [];
  const message = input.message ?? "Thanks, this is fixed.";
  const result = await recordTicketReply({
    ticket: { id: ticketId, ticket_number: 246 },
    message,
    senderName: input.senderName ?? "Alex",
    senderEmail: input.senderEmail ?? null,
    status: input.status ?? null,
    notify: input.notify ?? true,
    now: input.now ?? JS_RESPONDED_AT,
    findRecentDuplicate: async (id, body, sinceIso) => {
      const found = await db.query<{ id: string }>(
        `SELECT id::text AS id FROM public.support_ticket_replies
         WHERE ticket_id = $1 AND sender_role <> 'customer' AND body = $2 AND created_at >= $3
         ORDER BY created_at DESC, id DESC
         LIMIT 1`,
        [id, body, sinceIso],
      );
      return found.rows[0]?.id ?? null;
    },
    insertReply: async (row) => {
      const inserted = await db.query<{ id: string }>(
        `INSERT INTO public.support_ticket_replies (ticket_id, sender_role, sender_name, sender_email, body)
         VALUES ($1, $2, $3, $4, $5) RETURNING id::text AS id`,
        [row.ticket_id, row.sender_role, row.sender_name, row.sender_email, row.body],
      );
      return inserted.rows[0].id;
    },
    updateTicket: async (id, patch) => {
      await db.query(
        `UPDATE public.support_tickets
         SET admin_response = $2, responded_at = $3, responded_by = $4, responded_by_name = $5, status = $6
         WHERE id = $1`,
        [id, patch.admin_response, patch.responded_at, patch.responded_by, patch.responded_by_name, patch.status],
      );
    },
    sendCustomerEmail: async (body) => {
      emails.push(body);
      return true;
    },
  });
  return { result, emails };
}

describe("ticket reply created_at tiebreak", () => {
  test("orders by created_at, then id", () => {
    const shared = "2024-03-01T15:00:00.000Z";
    const rows = [
      { id: "ffffffff-ffff-4000-8000-00000000000b", created_at: shared },
      { id: "00000000-0000-4000-8000-00000000000a", created_at: shared },
      { id: "00000000-0000-4000-8000-000000000001", created_at: "2024-03-01T16:00:00.000Z" },
    ];
    expect([...rows].sort(compareCreatedAtThenId).map((row) => row.id)).toEqual([
      "00000000-0000-4000-8000-00000000000a",
      "ffffffff-ffff-4000-8000-00000000000b",
      "00000000-0000-4000-8000-000000000001",
    ]);

    const api = readFileSync("supabase/functions/admin-support-api/index.ts", "utf8");
    expect(api).toContain('.order("created_at", { ascending: true }).order("id", { ascending: true })');
    expect(api).toContain('.order("created_at", { ascending: false }).order("id", { ascending: false })');
    expect(api).toContain("loadExcludedAgencyIds");
    expect(api).toContain("platform support exclusion list unavailable");
    const staff = readFileSync("supabase/migrations/20261023060000_ticket_reply_created_at_id_order.sql", "utf8");
    expect(staff).toContain("ORDER BY r.created_at ASC, r.id ASC");
    expect(staff).toContain("REVOKE ALL ON FUNCTION public.get_ticket_replies_for_staff(uuid) FROM public, anon;");
    expect(staff).toContain("GRANT EXECUTE ON FUNCTION public.get_ticket_replies_for_staff(uuid) TO authenticated;");
    expect(readFileSync("supabase/functions/chat-copilot/index.ts", "utf8")).toContain('.order("created_at").order("id")');
    expect(readFileSync("supabase/functions/support-wins/index.ts", "utf8")).toContain('.order("id", { ascending: false })');
    expect(readFileSync("src/components/support/TicketRepliesThread.tsx", "utf8")).toContain("compareCreatedAtThenId");
  });
});

describe("team reply sender", () => {
  test("uses the caller email, or api when the caller does not send one", () => {
    expect(teamReplySenderEmail(null)).toBe(API_TICKET_REPLY_SENDER);
    expect(teamReplySenderEmail(undefined)).toBe("api");
    expect(teamReplySenderEmail("")).toBe("api");
    expect(teamReplySenderEmail("   ")).toBe("api");
    expect(teamReplySenderEmail("  agent@example.com  ")).toBe("agent@example.com");
    expect(teamReplySenderEmail("a".repeat(400))).toHaveLength(320);
  });
});

describe("POST /tickets/reply against log_ticket_team_response", () => {
  test("one call stores the API row once and sends one customer email", async () => {
    const db = new PGlite();
    await db.exec(schema);
    await db.exec(readFileSync("supabase/migrations/20260930182646_e9c4d492-df3f-45d5-bd65-a4cc4b6da4e6.sql", "utf8"));

    const duplicateTicket = await seedTicket(db);
    const before = await apiReply(db, duplicateTicket, { senderName: "Alex" });
    const duplicated = await replies(db, duplicateTicket);
    expect(before.emails).toEqual(["Thanks, this is fixed."]);
    expect(duplicated).toHaveLength(2);
    expect(duplicated.filter((row) => sameInstant(row.created_at, JS_RESPONDED_AT))).toHaveLength(1);
    expect(await webhookCount(db, duplicateTicket)).toBe(2);

    await db.exec(readFileSync("supabase/migrations/20261021165342_skip_duplicate_ticket_team_reply.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261029052000_ticket_team_reply_after_existing.sql", "utf8"));

    const ticketId = await seedTicket(db);
    const sent = await apiReply(db, ticketId, { senderName: "Alex" });
    const stored = await replies(db, ticketId);
    expect(sent.result).toEqual({
      ok: true,
      reply_id: stored[0]?.id,
      ticket_number: 246,
      email_notification_sent: true,
    });
    expect(stored).toEqual([
      expect.objectContaining({
        id: sent.result.ok && "reply_id" in sent.result ? sent.result.reply_id : "",
        sender_role: "admin",
        sender_name: "Alex",
        sender_email: "api",
        body: "Thanks, this is fixed.",
      }),
    ]);
    expect(stored.some((row) => sameInstant(row.created_at, JS_RESPONDED_AT))).toBe(false);
    expect(sent.emails).toEqual(["Thanks, this is fixed."]);
    expect(await webhookCount(db, ticketId)).toBe(1);
    expect(await ticketResponse(db, ticketId)).toEqual({
      admin_response: "Thanks, this is fixed.",
      responded_by: "api",
      status: "responded",
    });

    const named = await seedTicket(db);
    await apiReply(db, named, { senderEmail: "agent@example.com", senderName: "Agent", status: "pending" });
    const namedRows = await replies(db, named);
    expect(namedRows).toHaveLength(1);
    expect(namedRows[0]).toEqual(expect.objectContaining({
      sender_email: "agent@example.com",
      sender_name: "Agent",
    }));
    expect((await ticketResponse(db, named)).status).toBe("pending");
    expect(await webhookCount(db, named)).toBe(1);

    const quiet = await seedTicket(db);
    const quietResult = await apiReply(db, quiet, { notify: false, message: "Internal note" });
    expect(quietResult.emails).toEqual([]);
    expect(quietResult.result).toMatchObject({ email_notification_sent: false });
    expect(await replies(db, quiet)).toHaveLength(1);
    expect(await webhookCount(db, quiet)).toBe(1);

    const again = await apiReply(db, ticketId, { senderName: "Alex" });
    expect(again.result).toEqual({ ok: true, deduped: true, ticket_number: 246 });
    expect(again.emails).toEqual([]);
    expect(await replies(db, ticketId)).toHaveLength(1);
    expect(await webhookCount(db, ticketId)).toBe(1);

    const second = await apiReply(db, ticketId, { message: "A later update", senderName: "Alex", now: new Date() });
    expect(await replies(db, ticketId)).toHaveLength(2);
    expect(second.emails).toEqual(["A later update"]);
    expect(await webhookCount(db, ticketId)).toBe(2);

    const portal = await seedTicket(db);
    await db.query(
      `UPDATE public.support_tickets
       SET admin_response = 'Portal reply', responded_at = now(), responded_by = 'agent@example.com',
           responded_by_name = 'Agent', status = 'responded'
       WHERE id = $1`,
      [portal],
    );
    const portalRows = await replies(db, portal);
    expect(portalRows).toEqual([
      expect.objectContaining({
        sender_role: "admin",
        sender_name: "SaaS Suite",
        sender_email: "agent@example.com",
        body: "Portal reply",
      }),
    ]);
    expect(await webhookCount(db, portal)).toBe(1);

    await db.query(
      `UPDATE public.support_tickets
       SET admin_response = 'Different reply', responded_at = now(), responded_by = 'agent@example.com', status = 'responded'
       WHERE id = $1`,
      [portal],
    );
    await db.query(
      `UPDATE public.support_tickets
       SET admin_response = 'Portal reply', responded_at = now(), responded_by = 'agent@example.com', status = 'responded'
       WHERE id = $1`,
      [portal],
    );
    const repeated = await replies(db, portal);
    expect(repeated.filter((row) => row.body === "Portal reply")).toHaveLength(2);
    expect(repeated.filter((row) => row.body === "Different reply")).toHaveLength(1);

    const customer = await seedTicket(db);
    const sharedAt = "2024-03-01T15:00:00.000Z";
    const customerId = "ffffffff-ffff-4000-8000-00000000000c";
    await db.query(
      `INSERT INTO public.support_ticket_replies (id, ticket_id, sender_role, sender_name, sender_email, body, created_at)
       VALUES ($3, $1, 'customer', 'Customer', 'c@example.com', 'Same words', $2)`,
      [customer, sharedAt, customerId],
    );
    await db.query(
      `UPDATE public.support_tickets
       SET admin_response = 'Same words', responded_at = $2, responded_by = 'agent@example.com', status = 'responded'
       WHERE id = $1`,
      [customer, sharedAt],
    );
    const customerRows = await replies(db, customer);
    expect(customerRows).toHaveLength(2);
    expect(customerRows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sender_role: "customer",
        sender_name: "Customer",
        sender_email: "c@example.com",
        body: "Same words",
      }),
      expect.objectContaining({
        sender_role: "admin",
        sender_name: "SaaS Suite",
        sender_email: "agent@example.com",
        body: "Same words",
      }),
    ]));
    expect(customerRows.every((row) => sameInstant(row.created_at, new Date(sharedAt)))).toBe(true);
    // The trigger intentionally puts the team reply one microsecond later.
    // PGlite's Date decoding loses that precision, so comparing decoded Dates
    // incorrectly treats these as a tie and flakes with random UUID ordering.
    expect(customerRows.map((row) => row.sender_role)).toEqual(["customer", "admin"]);
    expect(customerRows[0]?.id).toBe(customerId);
    const spacing = await db.query<{ microseconds: number }>(
      `SELECT (extract(epoch FROM (max(created_at) - min(created_at))) * 1000000)::int AS microseconds
       FROM public.support_ticket_replies WHERE ticket_id = $1`,
      [customer],
    );
    expect(spacing.rows[0]?.microseconds).toBe(1);

    const tieTicket = await seedTicket(db);
    const lowId = "00000000-0000-4000-8000-00000000000a";
    const highId = "ffffffff-ffff-4000-8000-00000000000b";
    await db.query(
      `INSERT INTO public.support_ticket_replies (id, ticket_id, sender_role, sender_name, body, created_at)
       VALUES
         ($1, $3, 'admin', 'Later id', 'Shared instant', $4),
         ($2, $3, 'customer', 'Earlier id', 'Shared instant', $4)`,
      [highId, lowId, tieTicket, sharedAt],
    );
    const tied = await replies(db, tieTicket);
    expect(tied.map((row) => row.id)).toEqual([lowId, highId]);
    const latest = await db.query<{ id: string }>(
      `SELECT id::text AS id FROM public.support_ticket_replies
       WHERE ticket_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [tieTicket],
    );
    expect(latest.rows[0]?.id).toBe(highId);

    const blank = await seedTicket(db);
    await db.query(`UPDATE public.support_tickets SET admin_response = '   ' WHERE id = $1`, [blank]);
    expect(await replies(db, blank)).toEqual([]);

    const created = crypto.randomUUID();
    await db.query(
      `INSERT INTO public.support_tickets (id, admin_response, responded_at, responded_by, status)
       VALUES ($1, 'Opened with a response', now(), 'agent@example.com', 'responded')`,
      [created],
    );
    expect(await replies(db, created)).toHaveLength(1);
  });
});
