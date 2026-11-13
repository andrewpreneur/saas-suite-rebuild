import { describe, expect, test } from "bun:test";
import { messagesPreferInChat, noLiveHumanReply, rewriteEmailUpdatePromise } from "../supabase/functions/_shared/inChatFollowUp.ts";

describe("in-chat follow-up copy", () => {
  const history = [
    { role: "assistant", content: "How would you like the specialist to follow up with you?" },
    { role: "user", content: "Keep it in this chat" },
  ];

  test("does not promise an email when the visitor chose the chat", () => {
    expect(messagesPreferInChat(history)).toBe(true);
    const canned = "As soon as a specialist picks it up, you'll get an email update — and any replies will also show up right here.";
    expect(rewriteEmailUpdatePromise(canned, true)).toContain("you'll get the update in this chat");
    expect(rewriteEmailUpdatePromise(canned, true)).not.toContain("email update");
    expect(noLiveHumanReply(true)).not.toContain("by email");
    expect(noLiveHumanReply(false)).toContain("by email");
  });
});
