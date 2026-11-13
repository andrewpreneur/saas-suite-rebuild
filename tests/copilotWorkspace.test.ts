import { describe, expect, test } from "bun:test";
import { parseAssistant, splitReply, composerPlaceholder, INTRO_SLIDES, NAME_OPTIONS, requiresCustomAnswer, PRIORITY_OPTIONS, FIRST_TIME_ONBOARDING_PATH, onboardingPhaseKey } from "../src/lib/copilotWorkspace";

describe("copilot workspace", () => {
  test("Re-Onboard starts a separate phase without replacing the previous setup", () => {
    const phases = new Map([[onboardingPhaseKey("owner", "previous"), "ai"]]);
    phases.set(onboardingPhaseKey("owner", "restart"), "name");
    expect(phases.get(onboardingPhaseKey("owner", "restart"))).toBe("name");
    expect(phases.get(onboardingPhaseKey("owner", "previous"))).toBe("ai");
    expect(onboardingPhaseKey("other-owner", "restart")).not.toBe(onboardingPhaseKey("owner", "restart"));
  });
  test("completed initial questions lead to Copilot first-time", () => expect(FIRST_TIME_ONBOARDING_PATH).toBe("/app/copilot/first-time"));
  test("five intro slides", () => expect(INTRO_SLIDES.length).toBe(5));
  test("name options", () => expect([...NAME_OPTIONS]).toEqual(["Frankie", "Jamie", "Copilot", "Other"]));
  test("placeholder uses chosen name", () => {
    expect(composerPlaceholder(null)).toBe("Work with Copilot");
    expect(composerPlaceholder("Jamie")).toBe("Work with Jamie");
  });
  test("parses widgets out of text", () => {
    const r = parseAssistant("Pick one\n[[choices: Yes, that's fine | No, I want...]]\n[[widget:ghl_connect]]");
    expect(r.text).toBe("Pick one");
    expect(r.widgets).toEqual([{ kind: "choices", options: ["Yes, that's fine", "No, I want..."] }, { kind: "widget", name: "ghl_connect" }]);
  });
  test("splits multiple messages on ---", () => expect(splitReply("a\n---\nb")).toEqual(["a", "b"]));
  test("priority choices are onboarding, education, support and other", () => expect([...PRIORITY_OPTIONS]).toEqual(["Onboarding", "Education", "Support", "Other"]));
  test("custom choices collect actual text before sending", () => {
    for (const choice of ["Other", "No, I want something else", "I have preferences"]) expect(requiresCustomAnswer(choice)).toBe(true);
    for (const choice of ["Yes, that's fine", "Onboarding", "Skip for now", "Keep it off"]) expect(requiresCustomAnswer(choice)).toBe(false);
  });
});

import { standardPresetLinks, GUIDE_SCREENSHOTS } from "../src/lib/menuRemovalGuide";
import { SETTINGS_NAV_LINKS } from "../src/components/highlevel/settingsNavLinks";
import { readdirSync } from "fs";
describe("menu removal guide", () => {
  test("standard preset keeps only Media, and Profile/Billing/Users/Labs in settings", () => {
    const hidden = standardPresetLinks(SETTINGS_NAV_LINKS.map((l) => l.tabId));
    for (const kept of ["#sb_app-media", "#sb_profile", "#sb_saas-billing", "#sb_my-staff", "#sb_labs"]) expect(hidden).not.toContain(kept);
    expect(hidden).toContain("#sb_contacts");
    expect(hidden).toContain("#sb_tags");
  });
  test("parses screenshots", () => expect(parseAssistant("Look\n[[screenshot:testfirstcodeaction]]").widgets).toEqual([{ kind: "screenshot", key: "testfirstcodeaction" }]));
  test("every screenshot key has an uploaded image", () => {
    const files = readdirSync("src/assets/menu-removal-guide");
    for (const k of Object.keys(GUIDE_SCREENSHOTS)) expect(files).toContain(`${k}.png.asset.json`);
  });
});

import { hubMenuLinkInstalled, isNameAnswer } from "../src/lib/copilotFocus";
describe("existing account awareness", () => {
  test("detects a menu link installed in HighLevel for this agency", () => {
    expect(hubMenuLinkInstalled([{ url: "https://yoursoftwareonboarding.com/v2/saassuite" }], "saassuite")).toBe(true);
    expect(hubMenuLinkInstalled([{ url: "https://yoursoftwareonboarding.com/v2/dialog" }], "paul-4")).toBe(false);
  });
  test("only treats listed options as a name on the name step", () => {
    expect(isNameAnswer("Jamie", ["Frankie", "Jamie", "Copilot", "Other"], "name")).toBe(true);
    expect(isNameAnswer("help me with menu link removal", ["Frankie", "Jamie", "Copilot", "Other"], "name")).toBe(false);
    expect(isNameAnswer("Max", ["Frankie"], "name_other")).toBe(true);
  });
});
