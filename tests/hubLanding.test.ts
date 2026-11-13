import { describe, expect, test } from "bun:test";
import {
  availableHubLandingPages,
  editorHubDeepLink,
  isHubSupportTabEnabled,
  parseHubDeepLink,
  parseHubSection,
  resolveHubLandingPage,
} from "../src/lib/hubLanding";

describe("hub default landing page", () => {
  test("a missing or unknown saved page stays on Home", () => {
    for (const saved of [null, undefined, "", "   ", "docs", "knowledge-base", "nope"]) {
      expect(resolveHubLandingPage({ saved, supportEnabled: true })).toBe("home");
    }
  });

  test("education and home are used as saved", () => {
    expect(resolveHubLandingPage({ saved: "education", supportEnabled: false })).toBe("education");
    expect(resolveHubLandingPage({ saved: " HOME ", supportEnabled: true })).toBe("home");
  });

  test("a hidden support page falls back to Home", () => {
    expect(resolveHubLandingPage({ saved: "support", supportEnabled: false })).toBe("home");
    expect(resolveHubLandingPage({ saved: "support", supportEnabled: true })).toBe("support");
  });

  test("a deep link wins over the saved page", () => {
    expect(
      resolveHubLandingPage({ saved: "home", supportEnabled: true, deepLink: "education" }),
    ).toBe("education");
    expect(
      resolveHubLandingPage({ saved: "education", supportEnabled: true, deepLink: "support-chat" }),
    ).toBe("support");
    expect(
      resolveHubLandingPage({ saved: "education", supportEnabled: false, deepLink: "support-ticket" }),
    ).toBe("support");
    expect(resolveHubLandingPage({ saved: "education", supportEnabled: true, deepLink: "home" })).toBe(
      "home",
    );
    expect(resolveHubLandingPage({ saved: "home", supportEnabled: true, deepLink: "docs" })).toBe("docs");
  });

  test("path sections and editor queries name a page", () => {
    expect(parseHubSection("education")).toBe("education");
    expect(parseHubSection("support-chat")).toBe("support-chat");
    expect(parseHubSection("home")).toBeNull();
    expect(parseHubDeepLink("ticket")).toBe("support");
    expect(editorHubDeepLink(new URLSearchParams("hubTab=education&support=1"))).toBe("education");
    expect(editorHubDeepLink(new URLSearchParams("support=1"))).toBe("support");
    expect(editorHubDeepLink(new URLSearchParams(""))).toBeNull();
  });

  test("support is offered only when the hub would show that tab", () => {
    expect(isHubSupportTabEnabled({ supportTicketingEnabled: true, chatConfig: { ai_chat_enabled: false, human_chat_enabled: false } })).toBe(true);
    expect(isHubSupportTabEnabled({ supportTicketingEnabled: null })).toBe(true);
    expect(isHubSupportTabEnabled({ supportTicketingEnabled: false, chatConfig: { ai_chat_enabled: false, human_chat_enabled: true } })).toBe(true);
    expect(isHubSupportTabEnabled({ supportTicketingEnabled: false, chatConfig: { ai_chat_enabled: true, human_chat_enabled: false } })).toBe(true);
    expect(isHubSupportTabEnabled({ supportTicketingEnabled: false, chatConfig: { ai_chat_enabled: false, human_chat_enabled: false } })).toBe(false);
    expect(isHubSupportTabEnabled({ supportTicketingEnabled: false, aiChatEnabled: true, aiChatType: "NATIVE" })).toBe(true);
    expect(isHubSupportTabEnabled({ supportTicketingEnabled: false, aiChatEnabled: true, aiChatType: "GHL" })).toBe(false);
    expect(availableHubLandingPages(true)).toEqual(["education", "home", "support"]);
    expect(availableHubLandingPages(false)).toEqual(["home", "education"]);
  });
});
