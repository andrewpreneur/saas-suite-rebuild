import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  PUBLIC_SUPPORT_AGENCY_ID,
  PUBLIC_SUPPORT_SOURCE,
  isPublicSupportTicket,
  supportTicketAlertNeedsOwner,
} from "../supabase/functions/_shared/publicSupportTicket";

const TICKET_MIGRATION = "supabase/migrations/20261021230000_public_support_submission_tickets.sql";
const HANDLED_MIGRATION = "supabase/migrations/20261021231000_mark_existing_public_support_submissions_handled.sql";

const HANDLED_NOTE =
  "Handled outside the ticket system. Andrew emailed this person directly, so this submission was not turned into a ticket and no new-ticket alert was sent.";
const SARA_NOTE =
  "Handled outside the ticket system. The reply to Sara is pending Andrew's approval, so this submission was not turned into a ticket and no new-ticket alert was sent.";
const QA_NOTE =
  "Closed without a ticket. This submission was a QA test from andrew@dna-media.net, so no ticket was opened and no new-ticket alert was sent.";

const schema = `
CREATE ROLE anon;
CREATE ROLE authenticated;

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number serial UNIQUE,
  agency_id text NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  issue_category text NOT NULL,
  request_text text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.public_support_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  agency_name text,
  topic text NOT NULL,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'spam')),
  source text NOT NULL DEFAULT 'public_support_page',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ticket_alert_log (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_id uuid NOT NULL,
  event text NOT NULL
);

CREATE FUNCTION public.set_public_support_submission_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_public_support_submission_updated_at
BEFORE UPDATE ON public.public_support_submissions
FOR EACH ROW EXECUTE FUNCTION public.set_public_support_submission_updated_at();

CREATE FUNCTION public.trg_support_ticket_assignee_notify()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.ticket_alert_log (ticket_id, event) VALUES (NEW.id, 'ticket_created');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_ticket_assignee_notify
AFTER INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_support_ticket_assignee_notify();
`;

type Submission = {
  email: string;
  status: string;
  ticket_id: string | null;
  note: string | null;
};

type Ticket = {
  id: string;
  agency_id: string;
  customer_name: string;
  customer_email: string;
  issue_category: string;
  request_text: string;
  status: string;
  source: string | null;
};

async function count(db: PGlite, sql: string) {
  const result = await db.query<{ n: number }>(sql);
  return Number(result.rows[0].n);
}

async function submissions(db: PGlite) {
  const result = await db.query<Submission>(
    `SELECT lower(email) AS email, status, ticket_id::text AS ticket_id, note
     FROM public.public_support_submissions ORDER BY email`,
  );
  return result.rows;
}

async function tickets(db: PGlite) {
  const result = await db.query<Ticket>(
    `SELECT id::text AS id, agency_id, customer_name, customer_email, issue_category, request_text, status, source
     FROM public.support_tickets ORDER BY ticket_number`,
  );
  return result.rows;
}

describe("public support ticket routing", () => {
  test("a public form ticket alerts SaaS Suite without an agency owner", () => {
    expect(isPublicSupportTicket({ source: PUBLIC_SUPPORT_SOURCE, agency_id: "anything" })).toBe(true);
    expect(isPublicSupportTicket({ agency_id: PUBLIC_SUPPORT_AGENCY_ID })).toBe(true);
    expect(isPublicSupportTicket({ agency_id: `${PUBLIC_SUPPORT_AGENCY_ID}NO` })).toBe(true);
    expect(isPublicSupportTicket({ source: "chat", agency_id: "agency-1" })).toBe(false);
    expect(isPublicSupportTicket(null)).toBe(false);
    expect(supportTicketAlertNeedsOwner({ source: PUBLIC_SUPPORT_SOURCE, agency_id: PUBLIC_SUPPORT_AGENCY_ID })).toBe(false);
    expect(supportTicketAlertNeedsOwner({ source: null, agency_id: "agency-1" })).toBe(true);
    expect(supportTicketAlertNeedsOwner(null)).toBe(true);

    const notify = readFileSync("supabase/functions/notify-support-assignee/index.ts", "utf8");
    const gate = notify.indexOf("supportTicketAlertNeedsOwner");
    const skip = notify.indexOf('skipped: "no owner"');
    expect(gate).toBeGreaterThan(-1);
    expect(skip).toBeGreaterThan(gate);
    expect(notify).toContain('publicSupport ? "managed"');
    expect(readFileSync("supabase/functions/_shared/ticket-update.ts", "utf8")).toContain("customer_email: ticket.customer_email");
    expect(readFileSync("supabase/functions/respond-to-ticket/index.ts", "utf8")).toContain("customer_email: ticket.customer_email");
  });

  test("the public form still submits through public-support-submit", () => {
    const page = readFileSync("src/pages/Support.tsx", "utf8");
    const submit = readFileSync("supabase/functions/public-support-submit/index.ts", "utf8");
    expect(page).toContain('functions.invoke("public-support-submit"');
    expect(page).not.toContain("support_tickets");
    expect(submit).toContain('.from("public_support_submissions")');
    expect(submit).not.toContain("support_tickets");
  });
});

describe("public support submission tickets", () => {
  test("new inserts become tickets and the four existing submissions do not", async () => {
    const ticketSql = readFileSync(TICKET_MIGRATION, "utf8");
    const handledSql = readFileSync(HANDLED_MIGRATION, "utf8");
    expect(ticketSql).toContain("AFTER INSERT ON public.public_support_submissions");
    expect(ticketSql).not.toContain("AFTER UPDATE ON public.public_support_submissions");
    expect(ticketSql).toContain("SECURITY DEFINER");
    expect(ticketSql).toContain("search_path = public");
    expect(ticketSql).not.toContain("DROP TRIGGER IF EXISTS trg_support_ticket_assignee_notify");
    expect(handledSql.toLowerCase()).not.toContain("insert into");
    expect(handledSql).not.toContain("trg_public_support_submission_to_ticket");

    const db = new PGlite();
    await db.exec(schema);
    await db.exec(`
      INSERT INTO public.public_support_submissions (name, email, topic, question)
      VALUES
        ('Michael', 'TrafficQC@gmail.com', 'Other', 'Need help with the traffic setup'),
        ('Dave', 'dmeholovitch@gmail.com', 'Billing', 'Question about a billing charge'),
        ('Sara', 'info@healthiihub.com', 'Installation', 'Install question from the health hub'),
        ('Andrew', 'andrew@dna-media.net', 'Other', 'This is a QA test submission'),
        ('Older', 'older-visitor@example.com', 'Other', 'An older question that stays new');
    `);

    await db.exec(ticketSql);
    expect(await count(db, "SELECT count(*)::int AS n FROM public.support_tickets")).toBe(0);
    expect(await count(db, "SELECT count(*)::int AS n FROM public.ticket_alert_log")).toBe(0);

    await db.exec(handledSql);
    expect(await count(db, "SELECT count(*)::int AS n FROM public.support_tickets")).toBe(0);
    expect(await count(db, "SELECT count(*)::int AS n FROM public.ticket_alert_log")).toBe(0);

    const marked = await submissions(db);
    const byEmail = Object.fromEntries(marked.map((row) => [row.email, row]));
    expect(byEmail["trafficqc@gmail.com"]).toMatchObject({ status: "handled", ticket_id: null, note: HANDLED_NOTE });
    expect(byEmail["dmeholovitch@gmail.com"]).toMatchObject({ status: "handled", ticket_id: null, note: HANDLED_NOTE });
    expect(byEmail["info@healthiihub.com"]).toMatchObject({ status: "handled", ticket_id: null, note: SARA_NOTE });
    expect(byEmail["andrew@dna-media.net"]).toMatchObject({ status: "closed", ticket_id: null, note: QA_NOTE });
    expect(byEmail["older-visitor@example.com"]).toMatchObject({ status: "new", ticket_id: null, note: null });

    await db.query(
      `UPDATE public.public_support_submissions SET question = question || ' updated' WHERE email = 'older-visitor@example.com'`,
    );
    expect(await count(db, "SELECT count(*)::int AS n FROM public.support_tickets")).toBe(0);
    expect(await count(db, "SELECT count(*)::int AS n FROM public.ticket_alert_log")).toBe(0);

    await db.query(
      `INSERT INTO public.public_support_submissions (name, email, agency_name, topic, question)
       VALUES ('Casey Guest', 'Casey.Guest@example.com', 'Northwind Agency', 'Client Hub', 'The hub page will not load for me')`,
    );
    const opened = await tickets(db);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      agency_id: PUBLIC_SUPPORT_AGENCY_ID,
      customer_name: "Casey Guest",
      customer_email: "casey.guest@example.com",
      issue_category: "Client Hub",
      request_text: "The hub page will not load for me\n\nAgency: Northwind Agency",
      status: "open",
      source: PUBLIC_SUPPORT_SOURCE,
    });
    const linked = await db.query<{ status: string; ticket_id: string }>(
      `SELECT status, ticket_id::text AS ticket_id FROM public.public_support_submissions WHERE email = 'Casey.Guest@example.com'`,
    );
    expect(linked.rows[0]).toEqual({ status: "ticketed", ticket_id: opened[0].id });
    expect(await count(db, "SELECT count(*)::int AS n FROM public.ticket_alert_log")).toBe(1);

    await db.query(
      `INSERT INTO public.public_support_submissions (name, email, topic, question, status)
       VALUES ('Spam Bot', 'spam@example.com', 'Other', 'This is not a real question', 'spam')`,
    );
    expect(await tickets(db)).toHaveLength(1);

    const preset = await db.query(
      `INSERT INTO public.public_support_submissions (name, email, topic, question, status, ticket_id)
       VALUES ('Already linked', 'linked@example.com', 'Other', 'This row already points at a ticket', 'new', $1::uuid)
       RETURNING status, ticket_id::text AS ticket_id`,
      [opened[0].id],
    );
    expect(preset.rows[0]).toEqual({ status: "new", ticket_id: opened[0].id });
    expect(await tickets(db)).toHaveLength(1);
    expect(await count(db, "SELECT count(*)::int AS n FROM public.ticket_alert_log")).toBe(1);

    await db.exec(ticketSql);
    await db.exec(handledSql);
    expect(await tickets(db)).toHaveLength(1);
    expect((await submissions(db)).find((row) => row.email === "trafficqc@gmail.com")?.status).toBe("handled");
    expect(await count(db, "SELECT count(*)::int AS n FROM public.ticket_alert_log")).toBe(1);

    const triggers = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_trigger WHERE tgname = 'trg_public_support_submission_to_ticket' AND NOT tgisinternal`,
    );
    expect(Number(triggers.rows[0].n)).toBe(1);
    const definition = await db.query<{ prosecdef: boolean; proconfig: string[] | null }>(
      `SELECT prosecdef, proconfig FROM pg_proc WHERE proname = 'trg_public_support_submission_to_ticket'`,
    );
    expect(definition.rows[0].prosecdef).toBe(true);
    expect(definition.rows[0].proconfig?.join(" ")).toContain("search_path=public");

    await db.query(
      `INSERT INTO public.public_support_submissions (name, email, topic, question)
       VALUES ('Riley', 'riley@example.com', 'Billing', 'Where do I update the card')`,
    );
    const after = await tickets(db);
    expect(after).toHaveLength(2);
    expect(after[1].request_text).toBe("Where do I update the card");
    expect(after[1].customer_email).toBe("riley@example.com");
    expect(await count(db, "SELECT count(*)::int AS n FROM public.ticket_alert_log")).toBe(2);
  });
});
