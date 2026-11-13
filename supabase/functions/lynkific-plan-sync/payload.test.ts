import { expect, test } from "bun:test";
import { buildLynkificPlanPayload, isJunkPlan, splitFullName, toE164 } from "./payload.ts";

const base = {
  id: 42,
  email: "ada@example.com",
  full_name: "Ada Lovelace",
  plan: "BASIC",
  agency_id: "ada-agency",
  plan_changed_at: "2026-01-02T03:04:05.000Z",
};

test("splits a full name into first and last", () => {
  expect(splitFullName("Jane Doe")).toEqual({ first_name: "Jane", last_name: "Doe" });
  expect(splitFullName("  Jane   Mary   Doe  ")).toEqual({
    first_name: "Jane",
    last_name: "Mary Doe",
  });
  expect(splitFullName("Madonna")).toEqual({ first_name: "Madonna", last_name: "" });
  expect(splitFullName("   ")).toEqual({ first_name: "", last_name: "" });
  expect(splitFullName(null)).toEqual({ first_name: "", last_name: "" });
});

test("normalizes parseable phones to E.164 and drops the rest", () => {
  expect(toE164("(650) 253-0000")).toBe("+16502530000");
  expect(toE164("6502530000")).toBe("+16502530000");
  expect(toE164("1 (650) 253-0000")).toBe("+16502530000");
  expect(toE164("+44 20 7946 0958")).toBe("+442079460958");
  expect(toE164("")).toBeNull();
  expect(toE164("   ")).toBeNull();
  expect(toE164("abc")).toBeNull();
  expect(toE164("123")).toBeNull();
  expect(toE164("0000000000")).toBeNull();
});

test("skips junk and unknown plans", () => {
  for (const plan of ["null", "NULL", "Null", "", "  ", null]) {
    expect(isJunkPlan(plan)).toBe(true);
    expect(buildLynkificPlanPayload({ ...base, plan })).toBeNull();
  }
  expect(isJunkPlan("PREMIUM")).toBe(false);
  expect(buildLynkificPlanPayload({ ...base, plan: "PREMIUM" })).toBeNull();
  expect(buildLynkificPlanPayload({ ...base, plan: undefined })).toBeNull();
});

test("builds the Lynkific payload and omits an unparseable phone", () => {
  const payload = buildLynkificPlanPayload({
    ...base,
    bonuses_phone: "not a phone",
    previous_plan: "STARTER",
  });
  expect(payload).toEqual({
    event: "saassuite.plan_changed",
    email: "ada@example.com",
    first_name: "Ada",
    last_name: "Lovelace",
    saassuite_user_id: 42,
    plan: "BASIC",
    previous_plan: "STARTER",
    agency_id: "ada-agency",
    plan_changed_at: "2026-01-02T03:04:05.000Z",
    source: "saassuite",
  });
  expect(payload && "phone" in payload).toBe(false);
});

test("includes a parsed phone and clears a junk previous plan", () => {
  const payload = buildLynkificPlanPayload({
    ...base,
    plan: "ADVANCED",
    previous_plan: "NULL",
    bonuses_phone: "650.253.0000",
    full_name: "  Grace   Hopper ",
    agency_id: "  ",
  });
  expect(payload?.phone).toBe("+16502530000");
  expect(payload?.first_name).toBe("Grace");
  expect(payload?.last_name).toBe("Hopper");
  expect(payload?.previous_plan).toBeNull();
  expect(payload?.agency_id).toBeNull();
  expect(payload?.source).toBe("saassuite");
  expect(payload?.plan).toBe("ADVANCED");
});

test("forwards STARTER and skips a row with no email", () => {
  expect(buildLynkificPlanPayload({ ...base, plan: "STARTER", previous_plan: null })?.plan).toBe(
    "STARTER",
  );
  expect(buildLynkificPlanPayload({ ...base, email: "  " })).toBeNull();
});
