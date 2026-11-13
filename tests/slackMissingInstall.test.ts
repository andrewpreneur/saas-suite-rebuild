import { describe, expect, test } from "bun:test";
import { missingSlackInstallResult } from "../supabase/functions/slack-notify/missingInstall.ts";

describe("slack-notify without an install", () => {
  test("is an info skip, not a 404", () => {
    expect(missingSlackInstallResult("keystone")).toEqual({
      logLevel: "info",
      status: 200,
      body: { ok: true, skipped: "no_slack_install", agency_id: "keystone" },
    });
  });
});
