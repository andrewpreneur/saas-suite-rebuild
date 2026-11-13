import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  mayCreateChatTicket,
  mayCreateManualTicket,
  chatTranscript,
  manualTicketRequest,
  resolvedChatIdentifier,
  ticketInsertFields,
  ticketConfirmationText,
  manualTicketUpdateMessage,
  AGENCY_MANUAL_SOURCE,
} from "./contract";

function parseIssueCategory(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 80) return null;
  return trimmed;
}

test("a chat ticket accepts any ticket type up to 80 characters, including Website Edits", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  expect(source).toContain("issue_category: z.string().trim().min(1).max(80)");
  expect(source).not.toContain("z.enum(");
  expect(parseIssueCategory("  Website Edits  ")).toBe("Website Edits");
  expect(parseIssueCategory("Billing Question")).toBe("Billing Question");
  expect(parseIssueCategory("General Inquiry")).toBe("General Inquiry");
  expect(parseIssueCategory("")).toBeNull();
  expect(parseIssueCategory("   ")).toBeNull();
  expect(parseIssueCategory("x".repeat(80))).toHaveLength(80);
  expect(parseIssueCategory("x".repeat(81))).toBeNull();
  expect(parseIssueCategory(12)).toBeNull();
});

test("chat tickets require agency access, chat visibility and ticket edit permission", () => {
  expect(mayCreateChatTicket(true, true, true)).toBe(true);
  expect(mayCreateChatTicket(false, true, true)).toBe(false);
  expect(mayCreateChatTicket(true, false, true)).toBe(false);
  expect(mayCreateChatTicket(true, true, false)).toBe(false);
  expect(mayCreateChatTicket(true, true, null)).toBe(false);
});

test("a queue ticket does not need a conversation, and a chat ticket still does", () => {
  const source = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  expect(source).toContain('source: z.literal("agency_manual").optional()');
  expect(source).toContain("user_identifier: z.string().trim().min(1).max(320).optional()");
  expect(source).toContain('value.source !== "agency_manual" && !value.user_identifier');
  expect(source).toContain("No conversation found for this customer");
  expect(source).toContain("if (!manual) return json({error: \"No conversation found for this customer\"}, 404)");
  expect(source).toContain("manual ? manualTicketUpdateMessage(ticket) : chatTicketUpdateMessage(ticket)");
  expect(source).toContain("mayCreateChatTicket");
  expect(manualTicketRequest("agency_manual")).toBe(true);
  expect(manualTicketRequest(undefined)).toBe(false);
  expect(manualTicketRequest("chat")).toBe(false);
  expect(mayCreateManualTicket(true, true)).toBe(true);
  expect(mayCreateManualTicket(true, false)).toBe(false);
  expect(mayCreateManualTicket(false, true)).toBe(false);
  expect(resolvedChatIdentifier({
    source: undefined,
    userIdentifier: "guest-42",
    customerEmail: "guest@example.com",
  })).toBe("guest-42");
  expect(resolvedChatIdentifier({
    source: AGENCY_MANUAL_SOURCE,
    userIdentifier: "  kept-id  ",
    customerEmail: "Guest@Example.com",
  })).toBe("kept-id");
  expect(resolvedChatIdentifier({
    source: AGENCY_MANUAL_SOURCE,
    customerEmail: "Guest@Example.com",
  })).toBe("guest@example.com");
  expect(resolvedChatIdentifier({
    source: undefined,
    customerEmail: "guest@example.com",
  })).toBe("");
});

test("queue tickets are marked agency_manual and chat tickets omit source", () => {
  const shared = {
    requestText: "Need the homepage updated",
    transcript: "",
    identifier: "client@example.com",
    attachmentUrls: [] as string[],
    assignedEmail: "owner@example.com",
    assignedAt: "2026-10-21T12:00:00.000Z",
  };
  const chat = ticketInsertFields({ ...shared, manual: false, transcript: "[2026-10-21T11:00:00Z] Customer:\nHi" });
  expect(chat).not.toHaveProperty("source");
  expect(chat.request_text).toBe("Need the homepage updated\n\n--- Chat history ---\n[2026-10-21T11:00:00Z] Customer:\nHi");
  expect(chat.assigned_to).toBe("owner@example.com");
  expect(chat.assigned_by).toBe("owner@example.com");
  expect(chat.source_chat_identifier).toBe("client@example.com");
  const manual = ticketInsertFields({ ...shared, manual: true });
  expect(manual.source).toBe("agency_manual");
  expect(manual.request_text).toBe("Need the homepage updated");
  expect(manual.assigned_to).toBe("owner@example.com");
});

test("chat confirmation wording stays the same and a queue ticket does not claim it came from chat", () => {
  const ticket = {
    customer_name: "Jordan",
    ticket_number: 42,
    issue_category: "Website Edits",
    request_text: "Please update the hero.",
    attachment_urls: ["https://example.com/shot.png"],
  };
  expect(ticketConfirmationText(ticket, false)).toBe(
    "Hi Jordan,\n\nWe've created support ticket #42 from your chat.\nCategory: Website Edits\n\nPlease update the hero.\n\nAttachments:\nhttps://example.com/shot.png\n\nYour support team will follow up with you.\n\nThe Support Team",
  );
  const manual = ticketConfirmationText({ ...ticket, attachment_urls: [] }, true);
  expect(manual).toContain("We've created support ticket #42.");
  expect(manual).not.toContain("from your chat");
  expect(manualTicketUpdateMessage(ticket)).not.toContain("from your recent chat");
  expect(manualTicketUpdateMessage(ticket)).toContain("support ticket #42 (Website Edits)");
});

test("email history retains full customer, AI and team messages in chronological order", () => {
  const history = chatTranscript([
    {content: "Team reply https://example.com/screenshot.png", role: "agency_owner", created_at: "2026-10-08T23:03:00Z"},
    {content: "Customer question", role: "user", created_at: "2026-10-08T23:01:00Z"},
    {content: "AI answer", role: "assistant", created_at: "2026-10-08T23:02:00Z"},
  ]);
  expect(history).toContain("Customer:\nCustomer question");
  expect(history).toContain("AI:\nAI answer");
  expect(history).toContain("Support team:\nTeam reply https://example.com/screenshot.png");
  expect(history.indexOf("Customer question")).toBeLessThan(history.indexOf("AI answer"));
  expect(history.indexOf("AI answer")).toBeLessThan(history.indexOf("Team reply"));
});