import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { KitDeliveryList } from "../src/components/dashboard/OneFeatureKitDelivery";
import {
  KIT_CATALOG_LINE_IDS,
  entitledKitLineIds,
  hasFullKitAccess,
  kitAccountIsOpen,
  signedUpViaOneFeatureKit,
} from "../src/lib/kitEntitlement";
import { KIT_ONBOARDING_STEP_IDS } from "../src/lib/kitProgressSync";
import {
  filterKitCustomers,
  kitAddonTitles,
  kitCustomerProgress,
  parseKitCustomerDirectory,
  sortKitCustomers,
} from "../src/lib/kitCustomers";
import { KIT_CUSTOMER_FIXTURES } from "../src/lib/kitCustomerFixtures";

test("an open SaaSSuite account unlocks every catalog line", () => {
  const open = { approval: "YES" };
  expect(kitAccountIsOpen(open)).toBe(true);
  expect(kitAccountIsOpen({ approval: "" })).toBe(true);
  expect(kitAccountIsOpen({ approval: null })).toBe(true);
  expect(kitAccountIsOpen({ approval: "TRIALING" })).toBe(true);
  expect(kitAccountIsOpen({ approval: "no" })).toBe(false);
  expect(kitAccountIsOpen({ approval: "NO" })).toBe(false);
  expect(kitAccountIsOpen({ source: "signup" })).toBe(false);
  expect(kitAccountIsOpen(null)).toBe(false);
  expect(entitledKitLineIds([], open)).toEqual([...KIT_CATALOG_LINE_IDS]);
  expect(entitledKitLineIds(["launch"], { approval: "NO" })).toEqual([]);
  expect(entitledKitLineIds(["kit"], null)).toEqual([]);
  expect(entitledKitLineIds([], { trial_source: "one_feature_kit_30day" })).toEqual([]);
  expect(signedUpViaOneFeatureKit({ referrer: "https://onefeaturekit.com/" })).toBe(true);
  expect(signedUpViaOneFeatureKit({ source: "newsletter" })).toBe(false);
  expect(hasFullKitAccess([], open)).toBe(true);
  expect(hasFullKitAccess(["webinar-system"], { approval: "NO" })).toBe(false);
  expect(hasFullKitAccess([], null)).toBe(false);

  const html = renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(KitDeliveryList, { lineIds: entitledKitLineIds([], open) }),
    ),
  );
  expect(html).not.toContain('data-kit-unlocked="no"');
  expect(html).not.toContain('data-kit-template-unlocked="no"');
  expect(html).not.toContain("Buy ·");
  expect(html).toContain("Launch Pack");
  expect(html).toContain("Webinar Sales System");
  expect(html).toContain("Run payroll as many times as you need.");
  expect(readFileSync("src/components/dashboard/OneFeatureKitDelivery.tsx", "utf8")).toContain(
    "entitledKitLineIds",
  );
  expect(readFileSync("supabase/functions/kit-ad-customization/index.ts", "utf8")).toContain(
    "entitledKitLineIds",
  );
  expect(readFileSync("supabase/functions/chat-copilot/index.ts", "utf8")).toContain(
    "hasFullKitAccess",
  );
  expect(readFileSync("supabase/functions/chat-copilot/index.ts", "utf8")).not.toContain(
    '.eq("line_id", "kit")',
  );
});

test("the admin directory parses, searches, and sorts kit customers", () => {
  const rows = parseKitCustomerDirectory(KIT_CUSTOMER_FIXTURES);
  expect(rows).toHaveLength(3);
  expect(parseKitCustomerDirectory([{ email: "not-an-email" }, null, { email: "a@b.co" }])).toEqual(
    [expect.objectContaining({ email: "a@b.co", purchasedLineIds: [], access: [] })],
  );
  expect(filterKitCustomers(rows, "harbor")).toHaveLength(1);
  expect(filterKitCustomers(rows, "Launch Pack")).toHaveLength(1);
  expect(kitAddonTitles(rows[0].purchasedLineIds)).toEqual([
    "Full 90-minute training replay",
    "DFY installation, customization, and setup",
  ]);
  const byProgress = sortKitCustomers(rows, "progress", "desc");
  expect(byProgress[0].email).toBe("avery@northstar.example");
  const avery = kitCustomerProgress(byProgress[0]);
  expect(avery.percent).toBeGreaterThan(0);
  expect(avery.percent).toBeLessThan(100);
  expect(avery.steps.find((step) => step.id === "install-saas")?.status).toBe("confirmed");
  expect(avery.steps.find((step) => step.id === "sales-page")?.status).toBe("confirmed");
  expect(avery.steps.find((step) => step.id === "launch-ads")?.status).toBe("confirmed");
  expect(avery.steps.find((step) => step.id === "customize-video")?.status).toBe("marked");
  expect(avery.steps.find((step) => step.id === "menu-training")?.status).toBe("open");
  const signup = kitCustomerProgress(rows.find((row) => row.email === "sam@kindling.example")!);
  expect(signup.percent).toBe(0);
  expect(sortKitCustomers(rows, "name", "asc").map((row) => row.name)).toEqual([
    "Avery Quinn",
    "Jordan Hale",
    "Sam Rivera",
  ]);
});

test("the kit customer migration is admin-only and does not change plans", () => {
  const sql = readFileSync("supabase/migrations/20261022053008_kit_customer_access.sql", "utf8");
  expect(sql).toContain("is_platform_admin()");
  expect(sql).toContain("admin_kit_customers");
  expect(sql).toContain("enable row level security");
  expect(sql).toContain("revoke all on function public.admin_kit_customers()");
  expect(sql.toLowerCase()).not.toContain("update public.saas_suite_users");
  expect(sql).not.toContain("plan =");
  for (const id of KIT_ONBOARDING_STEP_IDS) expect(sql).toContain(`'${id}'`);
  expect(readFileSync("src/App.tsx", "utf8")).toContain('path="/admin/kit-customers"');
  expect(readFileSync("src/pages/Admin.tsx", "utf8")).toContain('to="/admin/kit-customers"');
});
