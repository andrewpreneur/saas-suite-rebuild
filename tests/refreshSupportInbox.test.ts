import { expect, test } from "bun:test";
import { refreshSupportInbox } from "../src/lib/refreshSupportInbox";

test("a notified new ticket refreshes ticket rows as well as the inbox count", async () => {
  const savedTickets = [{ ticket_number: 215, status: "open", request_text: "Business niche: personal coaching and health and Wellness" }];
  let count = 0;
  let visibleTickets: typeof savedTickets = [];
  await refreshSupportInbox(
    async () => { count = savedTickets.length; },
    async () => { visibleTickets = [...savedTickets]; },
  );
  expect(count).toBe(1);
  expect(visibleTickets.map((ticket) => ticket.ticket_number)).toEqual([215]);
});