import { describe, expect, test, beforeEach } from "bun:test";
import {
  autoToursSuppressedThisSession,
  readTour,
  recordComplete,
  recordDismiss,
  recordSequenceComplete,
  sequenceCompleted,
  setToursDisabled,
  shouldAutoStart,
  suppressAutoToursForSession,
  toursDisabled,
} from "../src/lib/tourSchedule.ts";

function memoryStorage() {
  const mem = new Map<string, string>();
  return {
    getItem: (key: string) => (mem.has(key) ? mem.get(key)! : null),
    setItem: (key: string, value: string) => { mem.set(key, String(value)); },
    removeItem: (key: string) => { mem.delete(key); },
    clear: () => mem.clear(),
  };
}

describe("tour schedule", () => {
  const email = "admin@digitalaspect.io";

  beforeEach(() => {
    globalThis.localStorage = memoryStorage() as Storage;
    globalThis.sessionStorage = memoryStorage() as Storage;
  });

  test("End Tour completes that tour on the first write and blocks the next auto tour this session", () => {
    expect(shouldAutoStart("nav", email)).toBe(true);
    recordComplete("nav", email);
    suppressAutoToursForSession(email);
    expect(readTour("nav", email).completed).toBe(true);
    expect(shouldAutoStart("nav", email)).toBe(false);
    expect(shouldAutoStart("hub", email)).toBe(false);
    expect(autoToursSuppressedThisSession(email)).toBe(true);
  });

  test("a dismiss still resumes later, and Don't show tours blocks every tour", () => {
    recordDismiss("hub", email, 2);
    expect(readTour("hub", email).step).toBe(2);
    expect(readTour("hub", email).completed).toBe(false);
    setToursDisabled(email, true);
    expect(toursDisabled(email)).toBe(true);
    expect(shouldAutoStart("nav", email)).toBe(false);
    expect(shouldAutoStart("hub", email)).toBe(false);
  });

  test("an ad-hoc tour stays finished after End Tour", () => {
    recordSequenceComplete("community_tour_nav", email);
    expect(sequenceCompleted("community_tour_nav", email)).toBe(true);
  });
});
