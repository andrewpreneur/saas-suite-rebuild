import { describe, expect, test } from "bun:test";
import { consumeCopilotStream } from "../src/lib/copilotStream";
import { readCompletion } from "../supabase/functions/chat-copilot/workspaceStream";
import { videoTopics, BIG_FEATURES, SMALL_FEATURES, WORKSPACE_PRIORITIES, nextSetupStep } from "../supabase/functions/chat-copilot/workspacePolicy";
import training from "../supabase/functions/chat-copilot/videoTraining.json";

function chunks(parts: string[]) {
  return new Response(new ReadableStream({ start(c) { for (const p of parts) c.enqueue(new TextEncoder().encode(p)); c.close(); } }));
}
describe("Copilot progressive replies", () => {
  test("done releases the client without waiting for the connection to close", async () => {
    let cancelled = false;
    const seen: string[] = [];
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"type":"delta","text":"Ready"}\n\ndata: {"type":"done"}\n\n'));
      },
      cancel() { cancelled = true; },
    }));
    const outcome = await Promise.race([
      consumeCopilotStream(response, event => seen.push(event.type)).then(() => "completed"),
      new Promise<string>(resolve => setTimeout(() => resolve("stuck"), 100)),
    ]);
    expect(outcome).toBe("completed");
    expect(cancelled).toBe(true);
    expect(seen).toEqual(["delta", "done"]);
  });
  test("client renders deltas across chunk boundaries and completes", async () => {
    const text: string[] = [];
    await consumeCopilotStream(chunks(['data: {"type":"del', 'ta","text":"Hello"}\n\ndata: {"type":"delta","text":" world"}\n\ndata: {"type":"done"}\n\n']), e => { if (e.type === "delta") text.push(e.text); });
    expect(text).toEqual(["Hello", " world"]);
  });
  test("interrupted streams fail rather than persist incomplete answers", async () => {
    await expect(consumeCopilotStream(chunks(['data: {"type":"delta","text":"Hi"}\n\n']), () => {})).rejects.toThrow("interrupted");
  });
  test("provider assembles split tool arguments and streams text", async () => {
    const delta = (d: unknown) => `data: ${JSON.stringify({choices:[{delta:d}]})}\n\n`;
    const seen: string[] = [];
    const result = await readCompletion(chunks([delta({content:"I'll check."}), delta({tool_calls:[{index:0,id:"call-1",function:{name:"lookup_user",arguments:'{"email":'}}]}), delta({tool_calls:[{index:0,function:{arguments:'"a@example.com"}'}}]}), 'data: [DONE]\n\n']), t => seen.push(t));
    expect(seen).toEqual(["I'll check."]);
    expect(JSON.parse(result.tool_calls?.[0].function.arguments || "{}")).toEqual({email:"a@example.com"});
  });
});
describe("Copilot training priorities", () => {
  test("setup starts with HighLevel", () => expect(nextSetupStep(false, false, false)).toBe("highlevel"));
  test("connected users install the menu link next", () => expect(nextSetupStep(true, false, false)).toBe("menu_link"));
  test("menu alone does not prove code installation", () => expect(nextSetupStep(true, true, false)).toBe("install_code"));
  test("installed users can personalize", () => expect(nextSetupStep(true, true, true)).toBe("business"));
  test("skipped users can choose a priority", () => expect(nextSetupStep(false, false, false, true)).toBe("priority"));
  test("server priority contract matches the four requested areas", () => expect([...WORKSPACE_PRIORITIES]).toEqual(["Onboarding", "Education", "Support", "Other"]));
  test("impactful features include welcome videos and onboarding checklists", () => { expect(BIG_FEATURES).toContain("welcome videos"); expect(BIG_FEATURES).toContain("onboarding checklists"); });
  test("subheadlines and daily checklists are deferred details", () => { expect(SMALL_FEATURES).toContain("subheadlines"); expect(SMALL_FEATURES).toContain("daily checklists"); expect(BIG_FEATURES).not.toContain("subheadlines"); });
  test("training matches the three supplied videos and relevant topics", () => {
    expect(training.map(v => v.topic)).toEqual(["menu-removal", "branding", "installation"]);
    expect(training[0].url).toEndWith("6acefdae44233097161c6294.mp4");
    expect(training[1].url).toEndWith("6acefdaeed5644a05f0a93e9.mp4");
    expect(training[2].url).toEndWith("6acefeeeed5644a05f0ac262.mp4");
    expect(videoTopics("Help with branding")).toEqual(["branding"]);
    expect(videoTopics("How do I install and connect HighLevel?")).toContain("installation");
    expect(videoTopics("menu link removal preset")).toContain("menu-removal");
  });
});