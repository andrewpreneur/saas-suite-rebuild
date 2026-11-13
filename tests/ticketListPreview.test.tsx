import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TicketsTable } from "../src/components/SupportDashboard";
import { TicketListPreview } from "../src/components/support/TicketListPreview";
import { ticketListPreviewText } from "../src/lib/ticketListPreview";

const longDescription = `Please change the homepage hero.

${"The old headline is still live on every plan page. ".repeat(12)}TAIL_SHOULD_BE_HIDDEN`;

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    ticket_number: 1042,
    agency_id: "launch-360",
    customer_name: "Suzi Guzman",
    customer_email: "suzi@launch360.co",
    issue_category: "Website Edits",
    request_text: longDescription,
    status: "open",
    created_at: "2026-11-10T15:00:00.000Z",
    assigned_to: null,
    ...overrides,
  };
}

describe("agency ticket list preview", () => {
  test("collapses the description to a short snippet and falls back to a loaded customer message", () => {
    const preview = ticketListPreviewText({ request_text: longDescription });
    expect(preview).toContain("Please change the homepage hero.");
    expect(preview).toContain("The old headline is still live");
    expect(preview?.endsWith("…")).toBe(true);
    expect(preview).not.toContain("TAIL_SHOULD_BE_HIDDEN");
    expect(preview).not.toContain("\n");

    expect(ticketListPreviewText({ request_text: "   \n  " })).toBeNull();
    expect(
      ticketListPreviewText({
        request_text: "  ",
        first_customer_message: "  The login button is missing on mobile.  ",
      }),
    ).toBe("The login button is missing on mobile.");
    expect(
      ticketListPreviewText({
        request_text: "Use this description",
        first_customer_message: "Ignore this message",
      }),
    ).toBe("Use this description");
  });

  test("the queue renders a truncated description and hides the preview when it is empty", () => {
    const html = renderToStaticMarkup(
      <TicketsTable
        team={[]}
        onAssign={() => {}}
        onSelect={() => {}}
        onStatusChange={() => {}}
        emptyLabel="No support tickets yet."
        tickets={[
          ticket(),
          ticket({
            id: "t-empty",
            ticket_number: 1043,
            customer_name: "Empty Ticket",
            request_text: " \n\t ",
          }),
          ticket({
            id: "t-message",
            ticket_number: 1044,
            customer_name: "Message Fallback",
            request_text: "",
            first_customer_message: "The welcome video will not play.",
          }),
        ]}
      />,
    );

    expect(html).toContain("line-clamp-2");
    expect(html).toContain("text-muted-foreground");
    expect(html).toContain("Please change the homepage hero.");
    expect(html).not.toContain("TAIL_SHOULD_BE_HIDDEN");
    expect(html).toContain("The welcome video will not play.");

    const cards = html.split('role="button"').slice(1);
    const emptyCard = cards.find((row) => row.includes("Empty Ticket"));
    const describedCard = cards.find((row) => row.includes("Suzi Guzman"));
    expect(emptyCard).toBeTruthy();
    expect(emptyCard).not.toContain("data-ticket-preview");
    expect(describedCard).toContain("data-ticket-preview");
    expect(describedCard).toContain("Please change the homepage hero.");

    const tableRows = html.split("<tr").slice(1);
    const emptyTableRow = tableRows.find((row) => row.includes("Empty Ticket"));
    const describedTableRow = tableRows.find((row) => row.includes("Suzi Guzman"));
    expect(emptyTableRow).toBeTruthy();
    expect(emptyTableRow).not.toContain("data-ticket-preview");
    expect(describedTableRow).toContain('class="text-sm text-muted-foreground line-clamp-2');
    expect(describedTableRow).toContain("Please change the homepage hero.");
    expect(describedTableRow).not.toContain("TAIL_SHOULD_BE_HIDDEN");
  });

  test("a preview line is omitted when both the description and the customer message are blank", () => {
    const html = renderToStaticMarkup(
      <ul>
        <li>
          <TicketListPreview ticket={{ request_text: "   ", first_customer_message: "\n" }} />
        </li>
      </ul>,
    );
    expect(html).not.toContain("data-ticket-preview");
  });
});
