import { describe, expect, test } from "bun:test";
import { impossibleCssReason } from "../supabase/functions/chat-copilot/cssFeasibility";
import { applyUnverifiedClaimGuard } from "../supabase/functions/chat-copilot/claimGuard";

describe("Copilot honesty guards", () => {
  test("refuses favicon CSS like the Keystone conversation", () => {
    expect(impossibleCssReason(`link[rel*="icon"] { content: url('x.png') !important; }`)).not.toBeNull();
  });
  test("still allows normal CSS tweaks", () => {
    expect(impossibleCssReason("#chat-widget-container { bottom: 80px !important; }", "Move chat widget up")).toBeNull();
  });
  test("replaces a made-up 'Agency Admin Access' HighLevel setting", () => {
    const out = applyUnverifiedClaimGuard("Go to Settings > Company and toggle on **Agency Admin Access**.", { wrote: false, facts: {}, note: "" });
    expect(out.fired).toBe(true);
    expect(out.content).not.toMatch(/Agency Admin Access/);
  });
});
