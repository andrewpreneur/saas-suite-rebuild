import { describe, expect, test } from "bun:test";
import {
  applyUnverifiedClaimGuard,
  factsFromAccount,
  factsFromValue,
  factsFromWorkspace,
  JSON_UNVERIFIED_NOTE,
  STREAM_UNVERIFIED_NOTE,
  unverifiedClaimLogRow,
} from "../supabase/functions/chat-copilot/claimGuard.ts";

describe("unverified claim guard", () => {
  test("skips the warning when HighLevel was already checked as connected", () => {
    const facts = factsFromWorkspace({ ghlConnected: true, slackConnected: false });
    const content = "HighLevel is already connected, so you're all set.";
    const result = applyUnverifiedClaimGuard(content, { wrote: false, facts, note: STREAM_UNVERIFIED_NOTE });
    expect(result.fired).toBe(false);
    expect(result.content).toBe(content);
  });

  test("still warns when the claim disagrees with the checked state", () => {
    const facts = { ...factsFromAccount({ login_enabled: false }), ...factsFromWorkspace({ ghlConnected: false }) };
    const result = applyUnverifiedClaimGuard("I've enabled login tracking.", { wrote: false, facts, note: JSON_UNVERIFIED_NOTE });
    expect(result.fired).toBe(true);
    expect(result.content).not.toContain("I've enabled login tracking.");
  });

  test("stays quiet after a real write and logs the same row the JSON path uses", () => {
    const facts = factsFromValue({ login_enabled: true });
    const content = "I've enabled login tracking.";
    expect(applyUnverifiedClaimGuard(content, { wrote: true, facts, note: JSON_UNVERIFIED_NOTE, confirmedMessages: ["Login tracking enabled."] }).content).toContain("Login tracking enabled.");
    expect(unverifiedClaimLogRow("owner@example.com", content, ["diagnose_install"])).toEqual({
      user_email: "owner@example.com",
      source: "copilot",
      title: "copilot_unverified_claim",
      message: content + " | tools: diagnose_install",
    });
  });
});
