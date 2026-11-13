import { describe, expect, test } from "bun:test";
import { LOGIN_TRACKING_REQUIRES_ADVANCED, loginTrackingUserReply } from "../supabase/functions/_shared/loginTrackingAccess";
import { toolUpgrade } from "../supabase/functions/chat-copilot/billingPolicy";
import { videoTopics } from "../supabase/functions/chat-copilot/workspacePolicy";
import { FEATURES_WITHOUT_TRAINING_VIDEO, connectIsRelevant, featureVideoUrl, isSimpleCopilotTurn, stripUnsolicitedHighLevelConnect, workspaceTurnPlan } from "../supabase/functions/_shared/featureAnswers";
import { mergeLoadedMessages, queueOutgoing } from "../src/lib/copilotQueue";
import { withoutDuplicateSkip } from "../src/lib/copilotWorkspace";
import videoTraining from "../supabase/functions/chat-copilot/videoTraining.json";

function legacyTopics(text: string): string[] {
  const topics: string[] = [];
  if (/brand|theme|sidebar|font|logo|mobile|top button/i.test(text)) topics.push("branding");
  if (/menu|remov|preset|workflow|AI Studio/i.test(text)) topics.push("menu-removal");
  if (/install|connect|token|scope|location|company|white label|css|javascript|\bghl\b|highlevel/i.test(text)) topics.push("installation");
  return topics;
}
function trainingChars(topics: string[]): number {
  return videoTraining.filter((video) => topics.includes(video.topic)).reduce((sum, video) => sum + Math.min(video.transcript.length, 1800), 0);
}

describe("copilot follow-up", () => {
  test("login tracking stays easy to open for free users until the flag flips", () => {
    expect(LOGIN_TRACKING_REQUIRES_ADVANCED).toBe(false);
    expect(toolUpgrade("toggle_login_tracking", { enabled: false }, { plan: "STARTER" })).toBeNull();
    const reply = loginTrackingUserReply(0);
    expect(reply).toContain("Login tracking shows");
    expect(reply).toContain("There isn't a separate login-tracking training video");
    expect(reply.match(/Advanced \(\$97\/month\)/g)?.length).toBe(1);
    expect(loginTrackingUserReply(2)).not.toContain("[[widget:upgrade]]");
  });

  test("features without a training video are listed, and the ones with videos use the shipped ids", () => {
    expect([...FEATURES_WITHOUT_TRAINING_VIDEO]).toEqual(["login tracking", "client hub", "community", "support"]);
    expect(featureVideoUrl("login-tracking")).toBeNull();
    expect(featureVideoUrl("client-hub")).toBeNull();
    expect(featureVideoUrl("branding")).toContain("6acefdaeed5644a05f0a93e9");
    expect(featureVideoUrl("installation")).toContain("6acefeeeed5644a05f0ac262");
    expect(featureVideoUrl("menu-removal")).toContain("6acfd5f2f2103dccac63aa82");
    expect(featureVideoUrl("understanding")).toContain("6a1251673c3aed7c639fbc38");
  });

  test("highlevel connection is not attached to unrelated answers", () => {
    const reply = stripUnsolicitedHighLevelConnect("Community is where owners share prompts.\n[[widget:ghl_connect]]", "What is the community?", { focus: "the community" });
    expect(reply).not.toContain("ghl_connect");
    expect(connectIsRelevant("How do I install the menu link?", null)).toBe(true);
    expect(stripUnsolicitedHighLevelConnect("Connect first.\n[[widget:ghl_connect]]", "How do I install the menu link?")).toContain("ghl_connect");
  });

  test("a connect card does not also render a Skip for now choice", () => {
    const widgets = withoutDuplicateSkip([
      { kind: "widget", name: "ghl_connect" },
      { kind: "choices", options: ["Connect", "Skip for now"] },
    ]);
    expect(widgets).toEqual([
      { kind: "widget", name: "ghl_connect" },
      { kind: "choices", options: ["Connect"] },
    ]);
  });

  test("messages sent before the chat is ready are kept and then released", () => {
    expect(queueOutgoing([], { id: "1", content: "first" }, false)).toEqual({ queue: [{ id: "1", content: "first" }], sendNow: [] });
    const ready = queueOutgoing([{ id: "1", content: "first" }], { id: "2", content: "second" }, true);
    expect(ready.sendNow.map((item) => item.content)).toEqual(["first", "second"]);
    const merged = mergeLoadedMessages([{ id: "saved", role: "assistant" }], [{ id: "initial" }, { id: "local", role: "user" }]);
    expect(merged.map((item) => item.id)).toEqual(["saved", "local"]);
  });

  test("simple turns skip the installation transcript that used to ride along", () => {
    const earlier = "I connected HighLevel at the company location. What is the community?";
    const before = trainingChars(legacyTopics(earlier));
    const plan = workspaceTurnPlan("What is the community?", "the community", videoTopics);
    const after = trainingChars(plan.topics);
    expect(before).toBeGreaterThan(1500);
    expect(after).toBe(0);
    expect(before - after).toBeGreaterThan(1500);
    expect(plan.simple).toBe(true);
    expect(plan.includeTools).toBe(false);
    expect(plan.historyLimit).toBe(6);
    expect(isSimpleCopilotTurn("Turn on login tracking")).toBe(false);
    expect(videoTopics("How do I install and connect HighLevel?")).toContain("installation");
  });
});
