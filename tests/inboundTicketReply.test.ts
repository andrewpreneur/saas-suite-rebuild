import { describe, expect, test } from "bun:test";
import { ticketReplyHint, ticketUpdateSubject } from "../supabase/functions/_shared/ticket-reply-match";
import {
  EMAIL_MATCH_STATUSES,
  customerReplyText,
  inboundRejectionLog,
  parseTicketNumber,
  readInboundPayload,
  replyFromPayload,
  scalarText,
  stripHtml,
  stripQuotedReply,
  ticketNumberFromReply,
} from "../supabase/functions/inbound-ticket-reply/payload";

const GMAIL = [
  "Thanks, that fixed it.",
  "",
  "On Tue, Oct 17, 2026 at 3:45 PM Support <support@example.com> wrote:",
  "> Update on your support ticket [#239]",
  "> Please try again.",
].join("\n");

const OUTLOOK = [
  "Please check again.",
  "",
  "-----Original Message-----",
  "From: Support",
  "Sent: Friday, October 17, 2026 3:14 PM",
  "To: Customer",
  "Subject: Update on your support ticket [#239]",
  "",
  "Previous message",
].join("\n");

describe("inbound customer reply payload", () => {
  for (const status of ["open", "responded", "in_progress", "resolved", "closed"]) {
    test(`email-only replies can match a ${status} ticket`, () => {
      expect([...EMAIL_MATCH_STATUSES]).toContain(status);
    });
  }

  test("message objects store actual customer text instead of object coercion", () => {
    expect(customerReplyText({ body: "Please reopen my ticket" })).toBe("Please reopen my ticket");
    expect(customerReplyText({ message: { body: { text: "I still need help" } } })).toBe("I still need help");
    expect(customerReplyText('{"body":"My reply"}')).toBe("My reply");
  });

  test("lost or missing message text is rejected instead of stored", () => {
    for (const input of ["[object Object]", "[object Object][object Object]", { id: "123" }, ["one", "two"], "{{message.body}}", null, 123]) {
      expect(customerReplyText(input)).toBeNull();
    }
  });

  test("plain replies preserve customer text", () => {
    expect(customerReplyText("  Thank you!\nIt works now.  ")).toBe("Thank you!\nIt works now.");
  });

  test("object identifiers cannot become object Object", () => {
    expect(scalarText({ email: "test@example.com" })).toBeNull();
    expect(scalarText(177)).toBe("177");
  });

  test("accepts text, plain, html, and message fields and strips HTML", () => {
    expect(customerReplyText({ text: "Plain reply", html: "<p>HTML reply</p>" })).toBe("Plain reply");
    expect(customerReplyText({ plain: "From the plain field" })).toBe("From the plain field");
    expect(customerReplyText({ html: "<p>Hello <b>there</b></p>" })).toBe("Hello there");
    expect(customerReplyText({ message: "<div>Line one<br>Line two</div>" })).toBe("Line one\nLine two");
    expect(customerReplyText("2 < 3 and 5 > 1")).toBe("2 < 3 and 5 > 1");
  });

  test("top-level body, message, or text is used when customer_reply has no text", () => {
    expect(replyFromPayload({ body: "Top level body" }).body).toBe("Top level body");
    expect(replyFromPayload({ message: "Top level message" }).body).toBe("Top level message");
    expect(replyFromPayload({ text: "Top level text" }).body).toBe("Top level text");
    expect(replyFromPayload({ customer_reply: { id: "msg_1", type: "Email" }, text: "I still need help with login" }).body)
      .toBe("I still need help with login");
    expect(replyFromPayload({ customer_reply: { body: "Inside the object" }, text: "Ignored sibling" }).body)
      .toBe("Inside the object");
  });

  test("strips Gmail and Outlook quoted history and angle-bracket quote lines", () => {
    expect(stripQuotedReply(GMAIL)).toBe("Thanks, that fixed it.");
    expect(stripQuotedReply("Still broken\n> old line\n> another")).toBe("Still broken");
    expect(stripQuotedReply(OUTLOOK)).toBe("Please check again.");
    expect(stripQuotedReply([
      "Hello",
      "",
      "From: Support <support@example.com>",
      "Sent: Friday, October 17, 2026 3:14 PM",
      "To: Customer <customer@example.com>",
      "Subject: Update on your support ticket [#88]",
      "",
      "old",
    ].join("\n"))).toBe("Hello");
    expect(stripQuotedReply("Hello there\n\n_______________________________\nFrom: Support\n\nold")).toBe("Hello there");
    expect(stripQuotedReply("On Friday I wrote: a note\nPlease help")).toBe("On Friday I wrote: a note\nPlease help");
    expect(customerReplyText(GMAIL)).toBe("Thanks, that fixed it.");
    expect(customerReplyText("On Tue, Oct 17, 2026 at 3:45 PM Support <a@b.com> wrote:\n> old")).toBeNull();
  });

  test("strips a signature delimiter and mobile footers without eating ordinary dashes", () => {
    expect(stripQuotedReply("Sounds good.\n\n-- \nJane Doe\nCEO")).toBe("Sounds good.");
    expect(stripQuotedReply("Yes please\n\nSent from my iPhone")).toBe("Yes please");
    expect(stripQuotedReply("Got it\n\nGet Outlook for iOS")).toBe("Got it");
    expect(stripQuotedReply("Use the -- flag\nThe total is > 5 items\nI wrote: hello"))
      .toBe("Use the -- flag\nThe total is > 5 items\nI wrote: hello");
  });

  test("drops HTML blockquotes and keeps the new reply", () => {
    const html = '<p>Please reopen</p><blockquote>On Tue, Oct 17, 2026 at 1:00 PM Agent &lt;a@b.com&gt; wrote:<br>old [#18]</blockquote>';
    expect(stripHtml(html)).toBe("Please reopen");
    expect(customerReplyText({ html })).toBe("Please reopen");
  });

  test("parses a ticket number from the subject or body when it was not sent as its own field", () => {
    expect(parseTicketNumber("Re: Update on your support ticket [#239]")).toBe("239");
    expect(parseTicketNumber("please see ticket #239 today")).toBe("239");
    expect(parseTicketNumber("Ticket 239")).toBe("239");
    expect(parseTicketNumber("ticket number: #240")).toBe("240");
    expect(parseTicketNumber("ticket #10 [#239]")).toBe("239");
    expect(parseTicketNumber("See order #239")).toBeNull();
    expect(parseTicketNumber("I have 239 questions")).toBeNull();

    const payload = { customer_reply: GMAIL };
    const parts = replyFromPayload(payload);
    expect(parts.body).toBe("Thanks, that fixed it.");
    expect(ticketNumberFromReply(payload, parts.raw)).toBe("239");
    expect(ticketNumberFromReply({ subject: "Re: Update on your support ticket [#240]", customer_reply: "Thanks" }, "Thanks")).toBe("240");
    expect(ticketNumberFromReply({ ticket_number: 15, subject: "Re: [#239]" }, "x")).toBe("15");
    expect(ticketNumberFromReply({ ticket_id: "abc", subject: "[#239]" }, "x")).toBeNull();
    expect(parseTicketNumber(OUTLOOK)).toBe("239");
  });

  test("outbound subject token round-trips into the parser", () => {
    expect(ticketUpdateSubject(239)).toBe("Update on your support ticket [#239]");
    expect(parseTicketNumber(`Re: ${ticketUpdateSubject(239)}`)).toBe("239");
    expect(ticketReplyHint(239)).toContain("[#239]");
  });

  test("reads a GoHighLevel Customer Replied webhook from customData and strips the Message Body", () => {
    const messageBody = [
      '<div dir="ltr">The login still fails.</div>',
      '<div class="gmail_quote">',
      '<div dir="ltr">On Tue, Oct 17, 2026 at 3:45 PM Launch360 Support &lt;support@example.com&gt; wrote:<br></div>',
      '<blockquote class="gmail_quote">Update on your support ticket [#239]<br>Please try again.</blockquote>',
      "</div>",
    ].join("");
    const payload = {
      contact_id: "seIvqPasdf",
      first_name: "Pat",
      last_name: "Lee",
      full_name: "Wrong Top Level Name",
      email: "wrong@example.com",
      phone: "+15555550123",
      tags: "",
      country: "US",
      date_created: "2026-10-17T15:00:00.000Z",
      contact_type: "customer",
      location: { name: "Launch360", id: "loc_launch360" },
      message: {
        type: "Email",
        subject: "Re: Update on your support ticket [#1]",
        body: "<p>This top-level body should not win.</p>",
      },
      workflow: { id: "wf_customer_replied", name: "Customer Replied" },
      triggerData: {},
      customData: {
        customer_email: "Pat@Example.com",
        customer_name: "Pat Lee",
        customer_reply: messageBody,
        ticket_number: 240,
        ticket_id: "ticket-from-custom-data",
      },
    };

    const fields = readInboundPayload(payload);
    expect(fields.email).toBe("pat@example.com");
    expect(fields.name).toBe("Pat Lee");
    expect(fields.body).toBe("The login still fails.");
    expect(fields.body).not.toContain("Please try again");
    expect(fields.body).not.toContain("<");
    expect(fields.ticketNumber).toBe("240");
    expect(fields.ticketId).toBe("ticket-from-custom-data");
    expect(fields.raw).toContain("[#239]");
  });

  test("falls back to top-level email, full_name, and message.body when Custom Data omits them", () => {
    const messageBody = [
      "<div>Please reopen this.</div>",
      "<div>On Fri, Oct 17, 2026 at 1:00 PM Agent &lt;a@b.com&gt; wrote:</div>",
      "<div>&gt; old reply about ticket [#239]</div>",
    ].join("");
    const fields = readInboundPayload({
      email: "pat@example.com",
      full_name: "Pat Lee",
      first_name: "Pat",
      phone: "+15555550123",
      message: { type: "Email", body: messageBody },
      workflow: { name: "Customer Replied" },
      customData: {},
    });
    expect(fields.email).toBe("pat@example.com");
    expect(fields.name).toBe("Pat Lee");
    expect(fields.body).toBe("Please reopen this.");
    expect(fields.ticketNumber).toBe("239");
  });

  test("custom_data uses the same priority as customData", () => {
    const fields = readInboundPayload({
      email: "top@example.com",
      full_name: "Top Name",
      ticket_number: 1,
      ticket_id: "top-id",
      message: { body: "<p>Top level message</p>" },
      custom_data: {
        customer_email: "custom@example.com",
        customer_name: "Custom Name",
        customer_reply: "<p>From <b>custom_data</b></p>",
        ticket_number: "#88",
        ticket_id: "custom-id",
      },
    });
    expect(fields).toMatchObject({
      email: "custom@example.com",
      name: "Custom Name",
      body: "From custom_data",
      ticketNumber: "88",
      ticketId: "custom-id",
    });
  });

  test("rejection logs include the reason and agency and never the webhook key", () => {
    const secret = "abc123def456abc123def456abc123de";
    const entry = inboundRejectionLog(401, `Invalid agency or key ${secret}`, "launch360", secret);
    expect(entry).toEqual({
      source: "inbound-ticket-reply",
      status: 401,
      reason: "Invalid agency or key [redacted]",
      agency_id: "launch360",
    });
    expect(Object.keys(entry).sort()).toEqual(["agency_id", "reason", "source", "status"]);
    expect(JSON.stringify(entry)).not.toContain(secret);
    expect(inboundRejectionLog(400, "Body must be JSON", null).agency_id).toBeNull();
  });
});
