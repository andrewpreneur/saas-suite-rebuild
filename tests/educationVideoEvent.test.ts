import { describe, expect, test } from "bun:test";
import {
  VIDEO_COMPLETED_DEDUPE_MS,
  educationVideoCompletedEvent,
  isDuplicateVideoCompleted,
  videoIdentity,
} from "../supabase/functions/_shared/educationVideoEvent.ts";

const base = {
  markingComplete: true,
  existing: null,
  agencyId: "fentresssolutions-3",
  categoryId: "foundational-setup",
  moduleId: "new-contact",
  userEmail: "bryan@worthitwindows.com",
  userName: "Bryan",
  title: "Create a New Contact",
};

describe("education video completion", () => {
  test("a new completion emits video_completed once", () => {
    const first = educationVideoCompletedEvent(base);
    expect(first).toEqual({
      agency_id: "fentresssolutions-3",
      trigger_type: "video_completed",
      user_email: "bryan@worthitwindows.com",
      user_name: "Bryan",
      metadata: {
        category_id: "foundational-setup",
        module_id: "new-contact",
        video_id: "foundational-setup:new-contact",
        title: "Create a New Contact",
        video_title: "Create a New Contact",
      },
    });

    const again = educationVideoCompletedEvent({
      ...base,
      existing: { completed: true },
    });
    expect(again).toBeNull();
  });

  test("saving progress on a video that is already complete does not emit", () => {
    expect(educationVideoCompletedEvent({ ...base, existing: { completed: null } })).toBeNull();
    expect(educationVideoCompletedEvent({ ...base, markingComplete: false, existing: null })).toBeNull();
  });

  test("a row that is explicitly not complete can emit again", () => {
    const event = educationVideoCompletedEvent({ ...base, existing: { completed: false } });
    expect(event?.trigger_type).toBe("video_completed");
    expect(event?.metadata.video_id).toBe("foundational-setup:new-contact");
  });

  test("onboarding's follow-up for the same video is a duplicate inside the window", () => {
    const now = Date.parse("2026-10-24T21:00:00.000Z");
    const incoming = videoIdentity({
      category_id: "foundational-setup",
      module_id: "new-contact",
      title: "Create a New Contact",
    });
    const prior = videoIdentity({
      category_id: "foundational-setup",
      module_id: "new-contact",
      video_id: "foundational-setup:new-contact",
    });
    expect(isDuplicateVideoCompleted({
      incoming,
      prior,
      priorCreatedAt: new Date(now - 1_000).toISOString(),
      now,
    })).toBe(true);
    expect(isDuplicateVideoCompleted({
      incoming,
      prior,
      priorCreatedAt: new Date(now - VIDEO_COMPLETED_DEDUPE_MS - 1).toISOString(),
      now,
    })).toBe(false);
    expect(isDuplicateVideoCompleted({
      incoming,
      prior: videoIdentity({ category_id: "foundational-setup", module_id: "scheduling" }),
      priorCreatedAt: new Date(now - 1_000).toISOString(),
      now,
    })).toBe(false);
  });
});
