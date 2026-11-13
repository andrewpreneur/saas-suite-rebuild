import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { moduleCompletionUserIds } from "../supabase/functions/_shared/moduleCompletionIds";

const REAL = "00000000-0000-4000-8000-000000000001";

describe("module completion user ids", () => {
  test("a query waits for at least one real user id", () => {
    expect(moduleCompletionUserIds(null)).toEqual([]);
    expect(moduleCompletionUserIds([])).toEqual([]);
    expect(moduleCompletionUserIds([null, undefined, "", "  "])).toEqual([]);
    expect(moduleCompletionUserIds(["none"])).toEqual([]);
    expect(moduleCompletionUserIds(["NONE", "no-users", "__none__"])).toEqual([]);
    expect(moduleCompletionUserIds(["none", REAL, REAL, "no-users"])).toEqual([REAL]);
  });

  test("module_completion in-filters do not send a sentinel id", () => {
    const files = [
      "src/components/dashboard/DashboardOverview.tsx",
      "src/components/SaaSHealth.tsx",
      "src/components/ActivityDashboard.tsx",
      "supabase/functions/user-360/index.ts",
      "supabase/functions/agency-voice-api/index.ts",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain("moduleCompletionUserIds");
      expect(source).not.toMatch(/\.in\(\s*["']user_id["']\s*,\s*[^\n]*none/);
      expect(source).not.toMatch(/\.in\(\s*["']user_id["']\s*,\s*[^\n]*no-users/);
    }
  });
});
