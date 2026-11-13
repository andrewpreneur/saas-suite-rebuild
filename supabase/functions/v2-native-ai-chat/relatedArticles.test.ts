import { expect, test } from "bun:test";
import { articleTokens, hasRelatedTitle, MIN_DIRECT_TITLE_MATCHES } from "./relatedArticles.ts";

test("related articles need two specific title words", () => {
  expect(MIN_DIRECT_TITLE_MATCHES).toBe(2);
  expect(
    hasRelatedTitle(
      "How to use the Google Sheets Premium Workflow Action",
      "how do I use google sheets in a workflow",
    ),
  ).toBe(true);
  expect(hasRelatedTitle("Email Verification Action in Workflows", "email verification")).toBe(
    false,
  );
  expect(hasRelatedTitle("Twilio workflow setup", "twilio")).toBe(false);
  expect(hasRelatedTitle("Twilio phone setup guide", "twilio phone setup")).toBe(true);
});

test("generic help-title words do not count, including plurals", () => {
  const tokens = articleTokens(
    "Please help with workflows, emails, accounts, settings, actions, triggers, contacts, and integrations",
  );
  for (const word of [
    "please",
    "help",
    "workflow",
    "email",
    "account",
    "setting",
    "action",
    "trigger",
    "contact",
    "integration",
  ]) {
    expect(tokens.has(word)).toBe(false);
  }
  expect(tokens.size).toBe(0);
  expect(articleTokens("How do I repair my workflow")).toEqual(new Set(["repair"]));
});

test("specific words are still stemmed and kept", () => {
  expect(articleTokens("calendars")).toEqual(new Set(["calendar"]));
  expect(articleTokens("creating snapshots")).toEqual(new Set(["creat", "snapshot"]));
});
