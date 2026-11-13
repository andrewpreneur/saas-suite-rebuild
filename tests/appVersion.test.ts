import { describe, expect, test } from "bun:test";
import {
  isMidTyping,
  isTypingTarget,
  nextVersionAction,
  remoteVersionId,
  shouldFetchVersion,
  VERSION_CHECK_INTERVAL_MS,
} from "../src/lib/appVersion";

const field = (tagName: string, value = "", type = "text") => ({ tagName, value, type });

describe("deployed version check", () => {
  test("only a different non-empty id is stale", () => {
    expect(remoteVersionId({ id: "abc" }, "abc")).toBeNull();
    expect(remoteVersionId({ id: "  " }, "abc")).toBeNull();
    expect(remoteVersionId({ id: "def" }, "abc")).toBe("def");
    expect(remoteVersionId(null, "abc")).toBeNull();
    expect(remoteVersionId({ nope: true }, "abc")).toBeNull();
  });

  test("checks are throttled", () => {
    expect(shouldFetchVersion(0, VERSION_CHECK_INTERVAL_MS - 1)).toBe(false);
    expect(shouldFetchVersion(0, VERSION_CHECK_INTERVAL_MS)).toBe(true);
  });

  test("a route change reloads, and typing or a previous reload prompts", () => {
    expect(nextVersionAction({ remoteId: null, routeChanged: true, midTyping: false })).toBe("none");
    expect(nextVersionAction({ remoteId: "new", routeChanged: false, midTyping: false })).toBe("none");
    expect(nextVersionAction({ remoteId: "new", routeChanged: true, midTyping: false })).toBe("reload");
    expect(nextVersionAction({ remoteId: "new", routeChanged: true, midTyping: true })).toBe("prompt");
    expect(nextVersionAction({ remoteId: "new", routeChanged: false, midTyping: true })).toBe("prompt");
    expect(nextVersionAction({
      remoteId: "new",
      routeChanged: true,
      midTyping: false,
      alreadyReloadedFor: "new",
    })).toBe("prompt");
  });

  test("a focused composer or a draft counts as mid-typing", () => {
    expect(isTypingTarget(field("TEXTAREA"))).toBe(true);
    expect(isTypingTarget(field("INPUT", "", "checkbox"))).toBe(false);
    expect(isMidTyping({
      activeElement: field("BUTTON"),
      querySelectorAll: () => [field("TEXTAREA", "keep this")],
    })).toBe(true);
    expect(isMidTyping({
      activeElement: field("TEXTAREA", ""),
      querySelectorAll: () => [],
    })).toBe(true);
    expect(isMidTyping({
      activeElement: field("BUTTON"),
      querySelectorAll: () => [field("INPUT", "   ")],
    })).toBe(false);
  });
});
