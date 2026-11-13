import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { createSnapshotRedactor, redactSnapshotSecrets, snapshotEntitled, STANDARD_SNAPSHOT_URL, SNAPSHOT_SHARE_ID } from "../supabase/functions/_shared/snapshotAccess";
import { ensureBookingOffer } from "../supabase/functions/_shared/bookingOffer";
import { publicSystemPrompt } from "../supabase/functions/_shared/publicCopilotPolicy";

const SHARE = SNAPSHOT_SHARE_ID;

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      out.push(...filesUnder(path));
    } else out.push(path);
  }
  return out;
}

describe("snapshot entitlement", () => {
  test("anonymous, missing, and free starter accounts are not entitled", () => {
    expect(snapshotEntitled(null)).toBe(false);
    expect(snapshotEntitled(undefined)).toBe(false);
    expect(snapshotEntitled({})).toBe(false);
    expect(snapshotEntitled({ plan: "STARTER" })).toBe(false);
    expect(snapshotEntitled({ plan: "starter", snapshot_access: false })).toBe(false);
    expect(redactSnapshotSecrets(`Install ${STANDARD_SNAPSHOT_URL} now`, false)).not.toContain(SHARE);
    expect(redactSnapshotSecrets(`share=${SHARE}`, false)).not.toContain(SHARE);
  });

  test("paid plans, the snapshot flag, premium support, and a kit purchase are entitled", () => {
    for (const plan of ["BASIC", "ADVANCED", "PREMIUM", "ENHANCED"]) {
      expect(snapshotEntitled({ plan })).toBe(true);
    }
    expect(snapshotEntitled({ plan: "STARTER", snapshot_access: true })).toBe(true);
    expect(snapshotEntitled({ plan: "STARTER", premium_support: true })).toBe(true);
    expect(snapshotEntitled({ plan: "STARTER" }, { kitPurchased: true })).toBe(true);
    expect(redactSnapshotSecrets(STANDARD_SNAPSHOT_URL, true)).toBe(STANDARD_SNAPSHOT_URL);
  });

  test("a streamed share id split across chunks never reaches a free session", () => {
    const redactor = createSnapshotRedactor(false);
    const url = STANDARD_SNAPSHOT_URL;
    let seen = "";
    for (let i = 0; i < url.length; i += 5) seen += redactor.push(url.slice(i, i + 5));
    seen += redactor.flush();
    expect(seen).not.toContain(SHARE);
    expect(seen).not.toContain("affiliates.gohighlevel.com");
  });

  test("the first request to book includes the booking link", () => {
    const first = ensureBookingOffer("I can help with that.", "Can I book a call?", { widget: true });
    expect(first).toContain("https://saassuite.ai/book");
    expect(first).toContain("[[widget:book_call]]");
    expect(ensureBookingOffer("Hello", "How do I install the menu link?")).toBe("Hello");
    expect(ensureBookingOffer("Please talk to someone on the team.", "I want to talk to someone")).toContain("https://saassuite.ai/book");
  });

  test("client code and public prompts do not contain the paid share id", () => {
    const allowed = new Set([
      "supabase/functions/_shared/snapshotAccess.ts",
      "tests/snapshotAccess.test.ts",
      "tests/publicCopilot.test.ts",
    ]);
    const roots = ["src", "supabase/functions", "public"];
    for (const root of roots) {
      for (const file of filesUnder(root)) {
        if (!/\.(ts|tsx|js|jsx|html|json|sql|md)$/.test(file)) continue;
        if (allowed.has(file)) continue;
        const text = readFileSync(file, "utf8");
        expect(text.includes(SHARE)).toBe(false);
      }
    }
    expect(publicSystemPrompt({ isMobile: false })).not.toContain(SHARE);
    expect(publicSystemPrompt({ isMobile: false })).toContain("does NOT unlock");
  });
});
