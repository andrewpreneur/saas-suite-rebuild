import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  humanThreadIsQuiet,
  isExplicitAiResumeRequest,
  isQuietHandoverAck,
  messageIsTeamReply,
  replyShouldStayWithHuman,
  showHandoverWaitingNote,
  teamReplyWithinQuietWindow,
} from "../supabase/functions/chat-copilot/handoverQuiet";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const NOW = Date.parse("2026-10-26T14:00:00.000Z");
const team = (timestamp: number) => ({
  role: "assistant" as const,
  actions: [{ tool: "admin_reply" }],
  timestamp,
});

describe("help chat composer after handover", () => {
  test("a team reply is the admin_reply action, not every assistant line", () => {
    expect(messageIsTeamReply(team(NOW))).toBe(true);
    expect(
      messageIsTeamReply({
        role: "assistant",
        actions: [{ tool: "human_handover" }],
        timestamp: NOW,
      }),
    ).toBe(false);
    expect(messageIsTeamReply({ role: "user", content: "hi" } as { role: string })).toBe(false);
  });

  test("the waiting note is only for the gap before the first teammate message", () => {
    expect(showHandoverWaitingNote({ isHandedOver: true, hasTeamReply: false })).toBe(true);
    expect(showHandoverWaitingNote({ isHandedOver: true, hasTeamReply: true })).toBe(false);
    expect(showHandoverWaitingNote({ isHandedOver: false, hasTeamReply: true })).toBe(false);
  });

  test("once a person owns the chat, a customer answer stays with the team", () => {
    const input = {
      isHandedOver: true,
      hasRecentTeamReply: true,
      resumedAt: null,
      latestTeamReplyAt: NOW - 60_000,
      text: "The other email is tony@example.com",
    };
    expect(humanThreadIsQuiet(input)).toBe(true);
    expect(replyShouldStayWithHuman(input)).toBe(true);
  });

  test("a team question keeps the thread quiet even if the page was reloaded", () => {
    const messages = [team(NOW - 5 * 60_000)];
    expect(teamReplyWithinQuietWindow(messages, NOW)).toBe(true);
    expect(
      replyShouldStayWithHuman({
        isHandedOver: false,
        hasRecentTeamReply: true,
        resumedAt: null,
        latestTeamReplyAt: NOW - 5 * 60_000,
        text: "What's the email on the second account? It's billing@example.com",
      }),
    ).toBe(true);
  });

  test("a team reply older than the quiet window does not keep the AI off", () => {
    const old = NOW - 25 * 60 * 60 * 1000;
    expect(teamReplyWithinQuietWindow([team(old)], NOW)).toBe(false);
    expect(
      replyShouldStayWithHuman({
        isHandedOver: false,
        hasRecentTeamReply: false,
        resumedAt: null,
        latestTeamReplyAt: old,
        text: "Can you check my menu link?",
      }),
    ).toBe(false);
  });

  test("asking for the copilot back is the only customer line that reaches the model", () => {
    expect(isExplicitAiResumeRequest("turn the AI copilot back on")).toBe(true);
    expect(isExplicitAiResumeRequest("Please turn the copilot back on")).toBe(true);
    expect(isExplicitAiResumeRequest("bring the AI back")).toBe(true);
    expect(isExplicitAiResumeRequest("please enable the assistant for my clients")).toBe(false);
    expect(isExplicitAiResumeRequest("The second account email is tony@example.com")).toBe(false);
    expect(
      replyShouldStayWithHuman({
        isHandedOver: true,
        hasRecentTeamReply: true,
        resumedAt: null,
        latestTeamReplyAt: NOW,
        text: "turn the AI copilot back on",
      }),
    ).toBe(false);
  });

  test("an explicit resume sticks until a newer team message", () => {
    const resumedAt = NOW;
    expect(
      humanThreadIsQuiet({
        isHandedOver: false,
        hasRecentTeamReply: true,
        resumedAt,
        latestTeamReplyAt: resumedAt - 1000,
      }),
    ).toBe(false);
    expect(
      humanThreadIsQuiet({
        isHandedOver: false,
        hasRecentTeamReply: true,
        resumedAt,
        latestTeamReplyAt: resumedAt + 1000,
      }),
    ).toBe(true);
    expect(
      humanThreadIsQuiet({
        isHandedOver: true,
        hasRecentTeamReply: false,
        resumedAt,
        latestTeamReplyAt: null,
      }),
    ).toBe(true);
  });

  test("the paused-copilot canned line is not shown as a new AI reply", () => {
    expect(
      isQuietHandoverAck({
        handover: true,
        actions: [],
        content:
          "A member of the SaaSSuite team is handling this conversation — they'll reply right here shortly. If you'd rather have me back now, just say \"turn the AI copilot back on\".",
      }),
    ).toBe(true);
    expect(
      isQuietHandoverAck({
        handover: true,
        actions: [{ tool: "human_handover" }],
        content: "We're getting one of our team members for you, one moment...",
      }),
    ).toBe(false);
  });

  test("Help's request-a-human path pauses the copilot", () => {
    const src = readFileSync(`${ROOT}/supabase/functions/chat-copilot/index.ts`, "utf8");
    const start = src.indexOf("if (requestHuman === true)");
    const end = src.indexOf('if (action === "snapshot_link")');
    const block = src.slice(start, end);
    expect(block).toContain('"human_handover"');
    const tool = src.slice(src.indexOf('case "human_handover":'), src.indexOf('case "start_upgrade":'));
    expect(tool).toContain("copilot_ai_paused");
    expect(tool).toContain("HANDOVER_PAUSE_HOURS");
    expect(tool).toContain("paused = !error");
  });

  test("the Help composer is not swapped out for the waiting banner", () => {
    const src = readFileSync(`${ROOT}/src/components/chat-copilot/ChatCoPilot.tsx`, "utf8");
    const input = readFileSync(`${ROOT}/src/components/chat-copilot/ChatInput.tsx`, "utf8");
    expect(src).toContain("<ChatInput");
    expect(src).not.toMatch(/isHandedOver \? \(/);
    expect(input).toContain('data-testid="help-chat-composer"');
  });
});
