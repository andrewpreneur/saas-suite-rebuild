import { expect, test } from "bun:test";
import {
  buildGlobalHandoverPayload,
  handoverInputFromSupportAlert,
  handoverStableKey,
  withSupportAlertEnvelope,
} from "../supabase/functions/_shared/globalHandoverWebhook.ts";
import {
  buildCopilotSupportAlert,
  copilotAsksForHuman,
  copilotHandoverThreadId,
  copilotReplyHandsOff,
} from "../supabase/functions/chat-copilot/humanHandoverAlert.ts";

test("an owner asking for a person or to cancel support alerts, a client-handover how-to does not", () => {
  for (const text of [
    "I need to speak with someone and cancel support",
    "Can I talk to a specialist?",
    "human please",
    "Please cancel my premium support",
    "get me a real person",
    "I'd like to speak with the team",
  ]) {
    expect(copilotAsksForHuman(text)).toBe(true);
  }
  for (const text of [
    "",
    "How do I set up human handover for my customers?",
    "How do I enable chat with support for my clients?",
    "I need a human handover for my customers",
    "I don't want a human",
    "What is the onboarding checklist?",
  ]) {
    expect(copilotAsksForHuman(text)).toBe(false);
  }
});

test("a Copilot handoff reply is the text-us widget or the team-member line", () => {
  expect(copilotReplyHandsOff("Our team can help by text.\n[[widget:human_help]]")).toBe(true);
  expect(copilotReplyHandsOff("We're getting one of our team members for you, one moment...")).toBe(
    true,
  );
  expect(copilotReplyHandsOff("Here is how to paste the install code.")).toBe(false);
});

test("Copilot uses the support-alert envelope and the same global handover payload", () => {
  const base = buildCopilotSupportAlert({
    agencyId: "gable",
    email: "Tony@GableGrassroots.com",
    name: "Tony",
    agencyName: "Gable Grassroots",
    plan: "ADVANCED",
    lastMessage: "I need to speak with someone and cancel support",
    reason: "Owner asked for a person",
    timestamp: "2026-10-26T15:00:00.000Z",
  });
  const lead = withSupportAlertEnvelope(
    { handled_by: "saas_suite", user_name: "from context" },
    base,
  );
  expect(lead).toMatchObject({
    notification_type: "support_alert",
    event_type: "chat_handover",
    event: "human_handover",
    agency_id: "gable",
    user_email: "tony@gablegrassroots.com",
    user_name: "Tony",
    owner_email: "tony@gablegrassroots.com",
    last_message: "I need to speak with someone and cancel support",
    fallback_reason: "Owner asked for a person",
    source: "ai_copilot",
    chat_category: "AI Copilot",
    handled_by: "saas_suite",
    timestamp: "2026-10-26T15:00:00.000Z",
  });

  const threadId = copilotHandoverThreadId("Tony@GableGrassroots.com");
  const globalInput = handoverInputFromSupportAlert(base, "gable", base.user_email, {
    surface: "copilot",
    threadId,
  });
  expect(handoverStableKey(globalInput)).toBe("copilot:gable:tony@gablegrassroots.com");
  expect(buildGlobalHandoverPayload(globalInput, threadId)).toEqual({
    event: "handover_requested",
    agency_id: "gable",
    customer_email: "tony@gablegrassroots.com",
    customer_name: "Tony",
    thread_id: "copilot:tony@gablegrassroots.com",
    ticket_number: null,
    last_customer_message: "I need to speak with someone and cancel support",
    timestamp: "2026-10-26T15:00:00.000Z",
  });
});
