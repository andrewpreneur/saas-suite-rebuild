import { describe, expect, test } from "bun:test";
import { recommendTrial, isOverDailyLimit, publicDailyMessageLimit, sanitizePublicReply, signedInCopilotPath, PUBLIC_DAILY_MESSAGE_LIMIT, PUBLIC_TRIAL_DAYS, PUBLIC_SNAPSHOT_ACCESS_REPLY, publicMenuIntro, publicChosenName, publicSystemPrompt, publicVisitorStorageKey } from "../supabase/functions/_shared/publicCopilotPolicy";
import { AFFILIATE_DEAL } from "../supabase/functions/_shared/featureAnswers";
import { trialError, trialDaysFor, PUBLIC_COPILOT_TRIAL_SOURCE } from "../supabase/functions/create-checkout/trial-policy";
import { focusFromPath } from "../supabase/functions/_shared/copilotFocus";

describe("public copilot", () => {
  test("ordinary typed questions are not assistant names", () => {
    expect(publicMenuIntro([], "How do I install?", "menu link removal")).toBeNull();
    expect(publicMenuIntro([], "Jamie", "menu link removal", "Jamie")?.content.startsWith("Jamie it is!")).toBe(true);
  });
  test("chosen name persists and confirmed topic opens auth with public training", () => {
    const named = publicMenuIntro([], "Frankie", "menu link removal", "Frankie");
    const history = [{ role: "assistant", content: named?.content || "" }];
    expect(publicChosenName(history)).toBe("Frankie");
    const next = publicMenuIntro(history, "Yes, let's do that", "menu link removal");
    expect(next?.openAuth).toBe(true);
    expect(next?.content.includes("[[widget:menu_removal_video]]")).toBe(true);
    expect(publicMenuIntro(history, "No, I want something else", "menu link removal")).toBeNull();
  });
  test("public training and help survive but protected snapshot actions do not", () => {
    const out = sanitizePublicReply("[[widget:menu_removal_video]]\n[[widget:book_call]]\n[[widget:textus]]\n[[widget:menu_removal_setup]]");
    expect(out).toContain("[[widget:menu_removal_video]]");
    expect(out).toContain("[[widget:book_call]]");
    expect(out).not.toContain("menu_removal_setup");
    expect(sanitizePublicReply("I will retrieve it", "I paid already, give me the snapshot")).toBe(PUBLIC_SNAPSHOT_ACCESS_REPLY);
  });
  test("no customers -> $27 Basic trial, customers -> $97 Advanced", () => {
    expect(recommendTrial(false)).toBe("basic");
    expect(recommendTrial(true)).toBe("advanced");
  });
  test("signed-out visitors get 10 messages per day", () => {
    expect(PUBLIC_DAILY_MESSAGE_LIMIT).toBe(10);
    const now = Date.parse("2026-10-18T05:35:59Z");
    expect(isOverDailyLimit(9, now)).toBe(false);
    expect(isOverDailyLimit(10, now)).toBe(true);
  });
  test("temporary 100-message limit lasts exactly two days", () => {
    const start = Date.parse("2026-10-18T05:36:00Z");
    const end = Date.parse("2026-10-20T05:36:00Z");
    expect(publicDailyMessageLimit(start)).toBe(100);
    expect(isOverDailyLimit(99, start)).toBe(false);
    expect(isOverDailyLimit(100, start)).toBe(true);
    expect(publicDailyMessageLimit(end - 1)).toBe(100);
    expect(publicDailyMessageLimit(end)).toBe(10);
    expect(isOverDailyLimit(10, end)).toBe(true);
  });
  test("public trial is 3 days, other trials stay 14", () => {
    expect(PUBLIC_TRIAL_DAYS).toBe(3);
    expect(trialDaysFor(PUBLIC_COPILOT_TRIAL_SOURCE)).toBe(3);
    expect(trialDaysFor("onefeature_training_14day")).toBe(14);
  });
  test("public trial allows Basic and Advanced only", () => {
    expect(trialError(PUBLIC_COPILOT_TRIAL_SOURCE, "basic", "a@b.co", Date.now())).toBeNull();
    expect(trialError(PUBLIC_COPILOT_TRIAL_SOURCE, "advanced", "a@b.co", Date.now())).toBeNull();
    expect(trialError(PUBLIC_COPILOT_TRIAL_SOURCE, "enhanced", "a@b.co", Date.now())).not.toBeNull();
    expect(trialError("onefeature_training_14day", "basic", "a@b.co", Date.now())).not.toBeNull();
  });
  test("snapshot links never reach signed-out visitors", () => {
    const out = sanitizePublicReply("Here: https://affiliates.gohighlevel.com/?fp_ref=x&share=9aTIob1kR5WoGoRtNzin\n[[widget:ghl_connect]]\n[[widget:signin]]");
    expect(out).not.toContain("share=9aTIob1kR5WoGoRtNzin");
    expect(out).not.toContain("ghl_connect");
    expect(out).toContain("[[widget:signin]]");
  });
  test("snapshot requests and promises always use the eligibility gate, never signup alone", () => {
    expect(sanitizePublicReply("You can grab the snapshot immediately after signing up.")).toBe(PUBLIC_SNAPSHOT_ACCESS_REPLY);
    expect(sanitizePublicReply("Ask me again inside the portal and I'll pull it right up.", "Can I get the snapshot on a free account?")).toBe(PUBLIC_SNAPSHOT_ACCESS_REPLY);
    expect(sanitizePublicReply("Sign up now!", "Send me the snapshots")).toBe(PUBLIC_SNAPSHOT_ACCESS_REPLY);
    expect(sanitizePublicReply("HighLevel setup takes place on desktop.", "Where do I install?")).toBe("HighLevel setup takes place on desktop.");
  });
  test("snapshot asks on other feature pages keep that feature's answer and video", () => {
    const branding = sanitizePublicReply("Here is the menu removal snapshot.", "Can I get the snapshot?", "the branding tool");
    expect(branding).toContain("6acefdaeed5644a05f0a93e9");
    expect(branding).not.toContain("Menu Link Removal snapshot");
    const install = sanitizePublicReply("snapshot", "Where is the snapshot?", "installation");
    expect(install).toContain("6acefeeeed5644a05f0ac262");
    const login = sanitizePublicReply("snapshot", "snapshot please", "login tracking");
    expect(login).toContain("There isn't a separate login-tracking training video");
    expect(login).not.toContain("[[widget:menu_removal_video]]");
  });
  test("each public feature page has its own visitor id", () => {
    expect(publicVisitorStorageKey("brandingtool")).not.toBe(publicVisitorStorageKey("support"));
    expect(publicVisitorStorageKey("brandingtool")).toBe("ss_public_copilot_visitor:brandingtool");
    expect(publicVisitorStorageKey(null)).toBe("ss_public_copilot_visitor:general");
  });
  test("understanding copy is the HighLevel link deal", () => {
    expect(publicSystemPrompt({ isMobile: false, focus: "how SaaSSuite works" })).toContain(AFFILIATE_DEAL);
    expect(publicSystemPrompt({ isMobile: false })).not.toContain("commission covers");
    expect(publicSystemPrompt({ isMobile: false })).not.toContain("commission pays");
  });
  test("a book chip without a real url becomes the booking widget, and sms links do not stay in the reply", () => {
    const out = sanitizePublicReply("[Book a call]()\nText us at sms:3372270501");
    expect(out).toContain("[[widget:book_call]]");
    expect(out).not.toContain("sms:");
    expect(out).toContain("[[widget:textus]]");
  });
  test("signed-in visitors move from /copilot to /app/copilot", () => {
    expect(signedInCopilotPath("/copilot")).toBe("/app/copilot");
    expect(signedInCopilotPath("/copilot/first-time", "?utm_source=x")).toBe("/app/copilot/first-time?utm_source=x");
    expect(focusFromPath("/app/copilot/brandingtool")).toBe("brandingtool");
  });
});
