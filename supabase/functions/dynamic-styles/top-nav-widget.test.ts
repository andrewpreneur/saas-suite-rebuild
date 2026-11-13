import { expect, test } from "bun:test";
import { buildTopNavWidgetJS } from "./top-nav-widget.ts";
import { capPopupFrame } from "../_shared/popupFrame.ts";
import {
  sanitizeTopNavWidgetConfig,
  sanitizeTopNavWidgetOptions,
  targetError,
} from "../_shared/topNavWidgetOptions.ts";

const custom = [
  {
    id: "open-ticket",
    label: "Request help",
    description: "We'll follow up",
    icon: "mail",
    visible: false,
    openMode: "embed",
    target: "/support-ticket",
  },
  {
    id: "live-support",
    label: "Chat with us",
    description: "Opens the chat popup",
    icon: "chat",
    visible: true,
    openMode: "embed",
    target: "/support-chat",
  },
  {
    id: "help-library",
    label: "Guides",
    description: "How-to videos",
    icon: "book",
    visible: true,
    openMode: "tab",
    target: "javascript:alert(1)",
  },
];

test("saved order is kept and unsafe targets fall back", () => {
  const options = sanitizeTopNavWidgetOptions(custom);
  expect(options.map((option) => option.id)).toEqual([
    "open-ticket",
    "live-support",
    "help-library",
  ]);
  expect(options[0].visible).toBe(false);
  expect(options[0].openMode).toBe("embed");
  expect(options[0].icon).toBe("mail");
  expect(options[1].label).toBe("Chat with us");
  expect(options[2].target).toBe("/education");
  expect(options[2].label).toBe("Guides");
});

test("missing and duplicate options collapse to the three built-ins", () => {
  const options = sanitizeTopNavWidgetOptions([
    {
      id: "live-support",
      label: "Chat",
      visible: true,
      openMode: "tab",
      target: "/support-chat",
      icon: "chat",
    },
    { id: "live-support", label: "Again", target: "/support-chat" },
    { id: "made-up", label: "Extra", target: "https://example.com" },
  ]);
  expect(options.map((option) => option.id)).toEqual([
    "live-support",
    "help-library",
    "open-ticket",
  ]);
  expect(options[0].label).toBe("Chat");
  expect(options[1].label).toBe("Help Library");
});

test("labels cannot carry markup and null storage uses the defaults", () => {
  const options = sanitizeTopNavWidgetOptions([
    { id: "help-library", label: "<script>alert(1)</script>", target: "https://example.com/help" },
  ]);
  expect(options[0].label).not.toContain("<");
  expect(options[0].target).toBe("https://example.com/help");
  const defaults = sanitizeTopNavWidgetConfig(null);
  expect(defaults.options.map((option) => option.openMode)).toEqual(["tab", "tab", "tab"]);
  expect(defaults.options.map((option) => option.embedTab)).toEqual([
    "education",
    "support-chat",
    "support-ticket",
  ]);
  expect(defaults.subtitle).toBe("We're here to help");
  expect(defaults.title).toBe("How can we help?");
  expect(defaults.showOn).toBe("both");
  expect(defaults.subtitle).not.toContain("24/7");
  expect(sanitizeTopNavWidgetOptions([{ id: "help-library", target: "/docs" }])[0].embedTab).toBe(
    "docs",
  );
  expect(capPopupFrame(400, 640, 1440, 900)).toEqual({ width: 400, height: 640 });
  expect(capPopupFrame(400, 640, 320, 500)).toEqual({ width: 280, height: 460 });
  expect(targetError("javascript:alert(1)")).toBeTruthy();
  expect(targetError("/education")).toBeNull();
});

test("injected script is valid, single-instance, and stays under the chat popup", () => {
  const js = buildTopNavWidgetJS("Help & Support", "#112233", {
    iconColor: "#abcdef",
    tileColor: "#445566",
    hubUrl: "https://yoursoftwareonboarding.com/v2/demo",
    hideInEmbed: true,
    agencyId: "demo-agency",
    options: custom,
  });
  expect(() => new Function(js)).not.toThrow();
  expect(js).toContain("Chat with us");
  expect(js).toContain("Guides");
  expect(js).not.toContain("javascript:");
  expect(js).not.toContain("<script>");
  expect(js).toContain("window.__supportWidgetToken");
  expect(js).toContain("data-compact");
  expect(js).toContain("z-index:2147483000");
  expect(js).toContain("z-index:2147483647");
  expect(js.indexOf("2147483000")).toBeLessThan(js.indexOf("2147483647"));
  expect(js).toContain("saassuite:popup-open");
  expect(js).toContain("window.SaaSSuitePopup");
  expect(js).toContain("?tab=");
  expect(js).not.toContain("#crmSupportWidget");
  expect(js).toContain("hideInEmbed: true");
  expect(js).toContain("We're here to help");
  expect(js).not.toContain("24/7");
  expect(js).toContain("headerReady");
  expect(js).toContain("sidebar-v2-location");
  expect(js).not.toContain("console.error");
  expect(js).not.toContain("console.warn");
  expect(js).toContain("docs: 'Docs'");
  expect(js).toContain("lvb-popup-preferred-size");
  expect(js).not.toContain("height:80vh");
  expect(js).toContain("width:400px !important");
  expect(js).toContain("height:640px !important");
  expect(js).toContain("syncPhoneHold");
  expect(js).toContain("suppressLauncherUntil");
});

test("popup launcher exposes the embed open hook", async () => {
  const source = await Bun.file(new URL("./index.ts", import.meta.url)).text();
  expect(source).toContain("window.SaaSSuitePopup");
  expect(source).toContain("saassuite:popup-open");
  expect(source).toContain("e.source === window");
  expect(source).toContain("top_nav_widget_options");
  expect(source).toContain("lvb-popup-preferred-size");
  expect(source).toContain("popupFrameRuntimeJS");
  expect(source).not.toContain("height:80vh");
});
