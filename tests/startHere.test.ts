import { describe, expect, test } from "bun:test";
import {
  ONBOARDING_VIDEOS,
  MENU_REMOVAL_VIDEO,
  START_HERE_STEPS,
  startHereDestination,
  resolveStartHereTab,
} from "../src/lib/startHere";
describe("START HERE", () => {
  test("menu removal uses the supplied training video", () => {
    expect(MENU_REMOVAL_VIDEO.src).toBe(
      "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6acfd5f2f2103dccac63aa82.mp4",
    );
  });
  test("onboarding shows the 4:37 intro first, then the 20-minute walkthrough", () => {
    expect(ONBOARDING_VIDEOS.map((video) => [video.title, video.duration, video.src])).toEqual([
      [
        "What is SaaSSuite and How it Works",
        "4:37",
        "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6a1251673c3aed7c639fbc38.mp4",
      ],
      [
        "How to Setup, Understand, and Utilize SaaSSuite",
        "20 minutes",
        "https://assets.cdn.filesafe.space/T69cI1milcirIORef4Ib/media/6aaca43e7bf7555bc30e9a17.mp4",
      ],
    ]);
  });
  test("getting started is the three setup steps", () => {
    expect(START_HERE_STEPS.map((step) => step.path)).toEqual([
      "/app/highlevel",
      "/app/client-hub?panel=installation-guide",
      "/app/client-hub?hubTab=home",
    ]);
  });
  test("Starter branding opens Design", () => {
    expect(startHereDestination("branding", "/app/branding", "STARTER")).toBe("/app/client-hub/design");
  });
  test("Starter menu removal redirects to billing", () => {
    expect(startHereDestination("streamline", "/app/streamline", "STARTER")).toBe("/app/billing");
  });
  test("paid plans retain their destinations", () => {
    for (const plan of ["BASIC", "ADVANCED"]) {
      expect(startHereDestination("branding", "/app/branding", plan)).toBe("/app/branding");
      expect(startHereDestination("streamline", "/app/streamline", plan)).toBe("/app/streamline");
    }
  });
  test("three tabs with onboarding fallback", () => {
    expect(["onboarding", "education", "support", "unknown"].map(resolveStartHereTab)).toEqual([
      "onboarding",
      "education",
      "support",
      "onboarding",
    ]);
  });
});
