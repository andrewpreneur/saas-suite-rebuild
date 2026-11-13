import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("training Lead fires only after the server confirms a new row", () => {
  const shared = read("src/components/one-feature/shared.tsx");
  const match = shared.slice(
    shared.indexOf("export function leadTracking"),
    shared.indexOf("export function fireConfirmedLead"),
  );
  expect(match).not.toContain("fbq");
  expect(match).not.toContain("event_id");
  expect(shared).toContain('fbq("track", "Lead", data, { eventID: eventId })');
  expect(shared).toContain('if (!eventId.startsWith("lead_")) return;');
  expect(shared).toContain('data?.created === true && typeof data.event_id === "string"');

  const strategy = read("src/pages/OneFeatureStrategy.tsx");
  expect(strategy).toContain('data.created === true && typeof data.event_id === "string"');
  expect(strategy).toContain('data?.created === true && typeof data.event_id === "string"');
  expect(strategy).not.toContain("Date.now().toString(36)");

  const quiz = read("src/pages/OneFeatureQuiz.tsx");
  const success = read("src/pages/OneFeatureTrainingSuccess.tsx");
  expect(quiz).not.toContain("leadTracking");
  expect(quiz).not.toContain("fireConfirmedLead");
  expect(quiz).not.toContain("fbq");
  expect(success).not.toContain("leadTracking");
  expect(success).not.toContain("fireConfirmedLead");
  expect(success).not.toContain('fbq("track", "Lead"');

  const lead = read("supabase/functions/one-feature-lead/index.ts");
  expect(lead).toContain("created: false");
  expect(lead).toContain("const stable = `lead_${data.id}`");
  expect(lead).toContain("s(m.event_id, 80) || stable");
  expect(lead).toContain("!parsed.quiz");
  expect(lead).toContain('body.action === "plan"');
  expect(lead).toContain('body.action === "highlevel"');
  const planAt = lead.indexOf('body.action === "plan"');
  const insertAt = lead.indexOf("const stable = `lead_${data.id}`");
  expect(planAt).toBeGreaterThan(-1);
  expect(insertAt).toBeGreaterThan(planAt);
});

test("apply funnels share lead_<row id> and skip a repeat opt-in", () => {
  const fn = read("supabase/functions/funnel-apply/index.ts");
  expect(fn).toContain("text(meta.event_id, 80) || `lead_${saved.data.id}`");
  expect(fn).toContain("createdRow");
  expect(fn).toContain('step === "optin" && createdRow');
  expect(fn).not.toContain("hlu_");
  expect(fn).not.toContain("agents_${sessionKey}");

  const high = read("src/pages/HighLevelers.tsx");
  expect(high).toContain("result.created === true && result.event_id");
  expect(high).toContain('if (!eventId.startsWith("lead_")) return;');
  expect(high).not.toContain("hlu_");
  expect(high).not.toContain("event_id: eventId");

  const founders = read("src/pages/FoundersPlan.tsx");
  expect(founders).toContain("optin.created === true && optin.event_id");
  expect(founders).not.toContain("fp_${sessionId");

  const agents = read("src/pages/AgentsApply.tsx");
  expect(agents).toContain("if (result.event_id) fireLead(result.event_id)");
  expect(agents).not.toContain("agents_${sessionId");

  const html = read("index.html");
  expect(html).toContain("bareEvent === 'Lead' || bareEvent === 'Purchase'");
  expect(html).toContain("if (!bareId) return;");
});
