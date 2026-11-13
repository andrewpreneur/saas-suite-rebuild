import { expect, test } from "bun:test";
import { copilotSourcePath, recentAccountActivity } from "../supabase/functions/chat-copilot/accountActivity";
test("source page excludes query values and external destinations", () => {
  expect(copilotSourcePath("/app/streamline?token=private#test")).toBe("/app/streamline");
  expect(copilotSourcePath("https://external.example/app")).toBeNull();
  expect(copilotSourcePath("/copilot")).toBeNull();
});
test("latest activity is ordered and excludes labels and metadata secrets", () => {
  expect(recentAccountActivity([{ events: [
    { type: "start_here_video_open", timestamp: "2026-10-14T19:00:00Z", metadata: { token: "private" } },
    { type: "branding_colors_saved", timestamp: "2026-10-14T19:20:00Z", metadata: { path: "/app/branding?secret=private" }, label: "private" },
  ] }])).toEqual([
    { action: "branding_colors_saved", at: "2026-10-14T19:20:00Z", page: "/app/branding" },
    { action: "start_here_video_open", at: "2026-10-14T19:00:00Z", page: null },
  ]);
});