import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { initialTicketDescription, summarizeChat } from "../src/lib/chatTicketDraft";
import { ticketAgencyChoices } from "../src/lib/ticketAgencyChoices";

describe("create ticket from the agency queue", () => {
  test("the tickets screen reuses the chat dialog and refreshes the list", () => {
    const dashboard = readFileSync("src/components/SupportDashboard.tsx", "utf8");
    const dialog = readFileSync("src/components/support/OpenTicketFromChatDialog.tsx", "utf8");
    const chat = readFileSync("src/components/client-hub/ChatInterventionPanel.tsx", "utf8");
    const admin = readFileSync("src/pages/AdminSupport.tsx", "utf8");
    expect(dashboard).toContain("Create ticket");
    expect(dashboard).toContain('source="agency_manual"');
    expect(dashboard).toContain("onCreated={() => {\n          void loadAll();");
    expect(dashboard).toContain("canEditTickets");
    expect(dialog).toContain("useAgencyTicketCategories");
    expect(dialog).toContain('source: "agency_manual"');
    expect(dialog).toContain("get_agency_clients");
    expect(dialog).toContain("...(manual ? { source: \"agency_manual\" as const } : {})");
    expect(chat).not.toContain("agency_manual");
    expect(admin).not.toContain("agency_manual");
  });

  test("a queue ticket starts blank and a chat ticket still summarizes the conversation", () => {
    const messages = [
      { content: "Please change the homepage", role: "user", created_at: "2026-10-21T12:00:00Z" },
    ];
    expect(initialTicketDescription(true, messages, "client@example.com")).toBe("");
    expect(initialTicketDescription(false, messages, "client@example.com")).toBe(
      summarizeChat(messages, "client@example.com"),
    );
    expect(summarizeChat(messages, "client@example.com")).toContain("Please change the homepage");
  });

  test("plan accounts are listed once, keeping the first label", () => {
    expect(ticketAgencyChoices({
      base_id: "north",
      basic_id: "north",
      advanced_id: " north-2 ",
      elite_id: "",
    })).toEqual([
      { id: "north", label: "Primary" },
      { id: "north-2", label: "Advanced" },
    ]);
    expect(ticketAgencyChoices({ base_id: "  ", basic_id: null })).toEqual([]);
  });
});
