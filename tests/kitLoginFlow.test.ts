import { readFileSync } from "fs";
import { expect, test } from "bun:test";
import { accountStateForPassword, publicAccountState } from "../supabase/functions/_shared/auth-account-state";
import {
  AUTH_CODE_EVENT,
  AUTH_CODE_FIELDS,
  authCodeExpiresMinutes,
  authCodeFirstName,
  authCodeSetPasswordUrl,
  authCodeWebhookBody,
  capAuthCodeField,
  postAuthCodeWebhook,
} from "../supabase/functions/_shared/auth-code-mail";
import { clearSkipOnboarding, markSkipOnboarding, shouldSkipOnboarding } from "../src/utils/deepLink";
import { navigateWithParams, sanitizeNextPath } from "../src/utils/preserveParams";
import { PASSWORD_CODE_TTL_MS } from "../supabase/functions/_shared/password-proof";
import {
  AUTH_RATE_LIMITS,
  hashPasswordCode,
  proofForPasswordSet,
  rateLimitAllows,
  sessionCanSetPassword,
  verifyStoredCode,
} from "../supabase/functions/_shared/password-proof";
import {
  accountExistsLoginPath,
  isKitDeepLink,
  modeAfterAlreadyRegistered,
  mustSendToOnboarding,
  resetPasswordRedirect,
  signupModeForState,
} from "../src/lib/kitLoginFlow";

const signup = readFileSync(new URL("../src/pages/Signup.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../src/pages/Login.tsx", import.meta.url), "utf8");
const reset = readFileSync(new URL("../src/pages/ResetPassword.tsx", import.meta.url), "utf8");
const guard = readFileSync(new URL("../src/components/InitialQuestionsGuard.tsx", import.meta.url), "utf8");
const setPassword = readFileSync(new URL("../supabase/functions/set-initial-password/index.ts", import.meta.url), "utf8");
const accountStateFn = readFileSync(new URL("../supabase/functions/auth-account-state/index.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../supabase/migrations/20261023063923_lookup_auth_account_state.sql", import.meta.url),
  "utf8",
);
const mailer = readFileSync(new URL("../supabase/functions/_shared/auth-code-mail.ts", import.meta.url), "utf8");

const kitNext = "/app/dashboard?view=kit";

test("an existing account is recognized from the password column, not a stale flag", () => {
  expect(accountStateForPassword(false, null)).toBe("new");
  expect(accountStateForPassword(true, "")).toBe("needs_password");
  expect(accountStateForPassword(true, null)).toBe("needs_password");
  expect(accountStateForPassword(true, "hashed-secret")).toBe("password");
  expect(signupModeForState("password")).toBe("sign-in");
  expect(signupModeForState("needs_password")).toBe("set-password");
  expect(signupModeForState("new")).toBe("create");
  expect(modeAfterAlreadyRegistered("new")).toBe("sign-in");
  expect(modeAfterAlreadyRegistered("password")).toBe("sign-in");
  expect(modeAfterAlreadyRegistered("needs_password")).toBe("set-password");
});

test("the account lookup response is a single state", () => {
  const body = publicAccountState("password");
  expect(body).toEqual({ state: "password" });
  expect(Object.keys(body ?? {})).toEqual(["state"]);
  expect(publicAccountState("needs_password")).toEqual({ state: "needs_password" });
  expect(publicAccountState("new")).toEqual({ state: "new" });
  expect(publicAccountState("list")).toBeNull();
  expect(accountStateFn).toContain("lookup_auth_account_for_service");
  expect(accountStateFn).toContain("publicAccountState");
  expect(accountStateFn).toContain("rateLimitAllows");
  expect(accountStateFn).not.toContain("user_id");
  expect(accountStateFn).toContain("`{ state }` only");
  const accountStateShared = readFileSync(new URL("../supabase/functions/_shared/auth-account-state.ts", import.meta.url), "utf8");
  expect(accountStateShared).toContain("cannot");
  expect(accountStateShared).toContain("list accounts");
  expect(accountStateFn).not.toContain("resend");
});

test("signup keeps the email and next, and switches the same form to sign-in", () => {
  expect(accountExistsLoginPath("Buyer@Example.com", kitNext)).toBe(
    `/login?email=buyer%40example.com&next=${encodeURIComponent(kitNext)}`,
  );
  expect(accountExistsLoginPath("buyer@example.com", "https://evil.example")).toBe(
    "/login?email=buyer%40example.com",
  );
  expect(signup).toContain("signupModeForState");
  expect(signup).toContain("modeAfterAlreadyRegistered");
  expect(signup).toContain('id="signup-login-link"');
  expect(signup).toContain("accountExistsLoginPath");
  expect(signup).not.toContain("get_user_auth_status_by_email");
  expect(signup).not.toContain("This email is already registered. Please log in or reset your password.");
  expect(signup).toContain("Forgot password?");
  expect(signup).toContain("resetPasswordRedirect");
  expect(login).toContain("resetPasswordRedirect");
  expect(login).toContain("fetchAuthAccountState");
});

test("forgot password and the reset page keep the kit next target", () => {
  const redirect = resetPasswordRedirect("https://saassuite.ai", kitNext);
  expect(redirect).toContain("/reset-password?next=");
  expect(decodeURIComponent(redirect.split("next=")[1] ?? "")).toBe(kitNext);
  expect(reset).toContain("readNextPath");
  expect(reset).toContain("keepResetQuery");
  expect(reset).toContain('navigate(next || "/login")');
});

test("the onboarding gate lets a kit deep link through without changing user rows", () => {
  const blocked = {
    needsCheck: true,
    isAdmin: false,
    skippedThisSession: false,
    skipDeepLink: false,
    onOnboardingPage: false,
    pathname: "/app/dashboard",
    search: "",
    pendingNext: null,
  };
  expect(mustSendToOnboarding(blocked)).toBe(true);
  expect(mustSendToOnboarding({ ...blocked, search: "?view=kit", pathname: "/app/dashboard" })).toBe(false);
  expect(mustSendToOnboarding({ ...blocked, pendingNext: "/app/dashboard?view=kit&step=replay" })).toBe(false);
  expect(isKitDeepLink("/app/dashboard?view=kit")).toBe(true);
  expect(isKitDeepLink("/app/dashboard?view=kit&step=install-snapshot")).toBe(true);
  expect(isKitDeepLink("/v2-onboarding")).toBe(false);
  expect(isKitDeepLink("/app/dashboard")).toBe(false);
  expect(isKitDeepLink("//evil.example/app/dashboard?view=kit")).toBe(false);
  expect(guard).toContain("mustSendToOnboarding");
  expect(guard).toContain("clearSkipOnboarding");
  expect(guard).not.toContain("initial_questions_completed: true");
  expect(migration).not.toMatch(/update\s+public\.saas_suite_users/i);
  expect(migration).not.toMatch(/update\s+auth\.users/i);
});

test("a password can be set only with a magic-link session or a verified code", async () => {
  const email = "buyer@example.com";
  expect(proofForPasswordSet({
    targetEmail: email,
    state: "needs_password",
    sessionEmail: null,
    amr: null,
    codeAccepted: false,
  })).toMatchObject({ ok: false, status: "proof_required", httpStatus: 401 });
  expect(proofForPasswordSet({
    targetEmail: email,
    state: "password",
    sessionEmail: email,
    amr: [{ method: "otp" }],
    codeAccepted: true,
  })).toMatchObject({ ok: false, status: "has_password" });
  expect(proofForPasswordSet({
    targetEmail: email,
    state: "needs_password",
    sessionEmail: email,
    amr: [{ method: "otp" }],
    codeAccepted: false,
  })).toEqual({ ok: true, via: "magic_link" });
  expect(sessionCanSetPassword({ sessionEmail: email, targetEmail: email, amr: [{ method: "password" }] })).toBe(false);
  expect(sessionCanSetPassword({ sessionEmail: "other@example.com", targetEmail: email, amr: [{ method: "otp" }] })).toBe(false);
  expect(proofForPasswordSet({
    targetEmail: email,
    state: "needs_password",
    sessionEmail: null,
    amr: null,
    codeAccepted: true,
  })).toEqual({ ok: true, via: "code" });

  const now = 1_700_000_000_000;
  const pepper = "test-pepper";
  const salt = "salt";
  const codeHash = await hashPasswordCode(salt, "123456", pepper);
  expect(verifyStoredCode({
    stored: { codeHash, expiresAt: now + 1000, used: false, attempts: 0 },
    expectedHash: codeHash,
    now,
  }).ok).toBe(true);
  expect(verifyStoredCode({
    stored: { codeHash, expiresAt: now + 1000, used: false, attempts: 0 },
    expectedHash: await hashPasswordCode(salt, "000000", pepper),
    now,
  }).reason).toBe("mismatch");
  expect(verifyStoredCode({
    stored: { codeHash, expiresAt: now - 1, used: false, attempts: 0 },
    expectedHash: codeHash,
    now,
  }).reason).toBe("expired");
  expect(verifyStoredCode({
    stored: { codeHash, expiresAt: now + 1000, used: true, attempts: 0 },
    expectedHash: codeHash,
    now,
  }).reason).toBe("used");
  expect(rateLimitAllows(AUTH_RATE_LIMITS.send_code.email, AUTH_RATE_LIMITS.send_code.email)).toBe(false);
  expect(rateLimitAllows(AUTH_RATE_LIMITS.send_code.email - 1, AUTH_RATE_LIMITS.send_code.email)).toBe(true);

  expect(setPassword).toContain("pepper.length < 16");
  expect(setPassword).toContain("claimed.data.length === 1");
  expect(setPassword).toContain("sessionCanSetPassword");
  expect(setPassword).toContain("verifyStoredCode");
  expect(setPassword).toContain("postAuthCodeWebhook");
  expect(setPassword).toContain('action !== "send_code" && action !== "set_password"');
  expect(setPassword).not.toContain("get_user_auth_status_by_email");
  expect(setPassword.toLowerCase()).not.toContain("resend");
  expect(mailer).not.toMatch(/from ["'].*resend|api\.resend\.com|RESEND_API_KEY/);
});

const sampleMail = {
  email: "Buyer@Example.com",
  code: "123456",
  storedFirstName: "Ada",
  fullName: "Ada Lovelace",
  nextPath: kitNext,
  requestId: "11111111-1111-4111-8111-111111111111",
  requestedAt: "2026-10-23T06:59:00.000Z",
};

const samplePayload = {
  event: "saassuite.auth_password_code",
  email: "buyer@example.com",
  first_name: "Ada",
  code: "123456",
  expires_minutes: 15,
  set_password_url: "https://saassuite.ai/signup?email=buyer%40example.com&next=%2Fapp%2Fdashboard%3Fview%3Dkit",
  request_id: "11111111-1111-4111-8111-111111111111",
  requested_at: "2026-10-23T06:59:00.000Z",
};

test("the password-code webhook posts the GoHighLevel fields and nothing else", async () => {
  expect(authCodeExpiresMinutes()).toBe(PASSWORD_CODE_TTL_MS / 60000);
  expect(authCodeWebhookBody(sampleMail)).toEqual(samplePayload);
  expect(Object.keys(authCodeWebhookBody(sampleMail) ?? {})).toEqual([...AUTH_CODE_FIELDS]);
  expect(JSON.stringify(samplePayload)).not.toMatch(/phone|full_name|user_id|last_name/i);
  expect(samplePayload.set_password_url.startsWith("https://")).toBe(true);
  expect(new URL(samplePayload.set_password_url).searchParams.get("email")).toBe("buyer@example.com");
  expect(new URL(samplePayload.set_password_url).searchParams.get("next")).toBe(kitNext);
  expect(new URL(samplePayload.set_password_url).searchParams.has("code")).toBe(false);
  expect(Number.isInteger(samplePayload.expires_minutes)).toBe(true);

  expect(authCodeFirstName({ storedFirstName: "Ada <Kit>", fullName: "Ignored", email: "buyer@example.com" })).toBe("Ada &lt;Kit&gt;");
  expect(authCodeFirstName({ storedFirstName: "  ", fullName: "Ada & Co", email: "buyer@example.com" })).toBe("Ada &amp; Co");
  expect(authCodeFirstName({ storedFirstName: "", fullName: "", email: "kit-buyer@example.test" })).toBe("Kit-buyer");
  expect(authCodeFirstName({ email: "@example.com" })).toBe("there");
  expect(authCodeFirstName({ storedFirstName: "A".repeat(90), email: "buyer@example.com" })).toHaveLength(80);

  const calls: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(String(init?.body));
    return new Response("ok", { status: 200 });
  }) as typeof fetch;

  expect(await postAuthCodeWebhook({
    fetchImpl,
    webhookUrl: "  ",
    mail: sampleMail,
  })).toBe("skipped");
  expect(await postAuthCodeWebhook({
    fetchImpl,
    webhookUrl: "https://services.leadconnectorhq.com/hooks/example",
    mail: { ...sampleMail, code: "" },
  })).toBe("skipped");
  expect(await postAuthCodeWebhook({
    fetchImpl,
    webhookUrl: "https://services.leadconnectorhq.com/hooks/example",
    mail: { ...sampleMail, email: "not-an-email" },
  })).toBe("skipped");
  expect(calls).toEqual([]);

  const sent = await postAuthCodeWebhook({
    fetchImpl: (async (url: string, init?: RequestInit) => {
      expect(url).toBe("https://services.leadconnectorhq.com/hooks/example");
      expect(JSON.parse(String(init?.body))).toEqual(samplePayload);
      return new Response("ok", { status: 200 });
    }) as typeof fetch,
    webhookUrl: "https://services.leadconnectorhq.com/hooks/example",
    mail: sampleMail,
  });
  expect(sent).toBe("sent");
  expect(AUTH_CODE_EVENT).toBe("saassuite.auth_password_code");
});

test("the migration reads encrypted_password for one user and is not granted to anon", () => {
  expect(migration).toContain("auth.users");
  expect(migration).toContain("encrypted_password");
  expect(migration).toContain("LIMIT 1");
  expect(migration).toContain("REVOKE ALL ON FUNCTION public.lookup_auth_account_for_service(text) FROM anon, authenticated");
  expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.lookup_auth_account_for_service(text) TO service_role");
  expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.auth_account_attempts");
  expect(migration).toContain("CREATE TABLE IF NOT EXISTS public.auth_password_codes");
  expect(migration).toContain("CREATE INDEX IF NOT EXISTS");
  expect(migration).toContain("CREATE OR REPLACE FUNCTION public.lookup_auth_account_for_service");
  expect(migration).toContain("IF NOT EXISTS (");
  expect(migration).toContain("pg_policies");
  expect(migration).toContain("USING (false)");
  expect(migration).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.lookup_auth_account_for_service\(text\) TO (PUBLIC|anon|authenticated)/);
});

test("next copied onto login or the learning hub is a same-origin path", () => {
  expect(sanitizeNextPath("/app/dashboard?view=kit")).toBe("/app/dashboard?view=kit");
  expect(sanitizeNextPath("/app/learning")).toBe("/app/learning");
  expect(sanitizeNextPath("//evil.example")).toBeNull();
  expect(sanitizeNextPath("/\\evil")).toBeNull();
  expect(sanitizeNextPath("https://evil.example/app")).toBeNull();
  expect(sanitizeNextPath("/javascript:alert(1)")).toBeNull();
  expect(sanitizeNextPath("/app/\nsettings")).toBeNull();
  expect(sanitizeNextPath("/%2F%2Fevil.example")).toBeNull();

  const oldWindow = globalThis.window;
  const run = (search: string, path: string) => {
    Object.assign(globalThis, { window: { location: { search } } });
    return navigateWithParams(path);
  };
  try {
    expect(run("?next=/app/dashboard?view=kit&utm_source=kit", "/login")).toContain("next=%2Fapp%2Fdashboard");
    expect(run("?next=/app/dashboard?view=kit", "/app/learning")).toContain("/app/learning?next=");
    expect(run("?next=//evil.example&utm_source=kit", "/login")).not.toContain("next=");
    expect(run("?next=//evil.example&utm_source=kit", "/login")).toContain("utm_source=kit");
    expect(run("?utm_source=kit", "/login?next=https://evil.example")).not.toContain("evil");
    expect(run("", "/app/learning?next=\\\\evil")).not.toContain("next=");
  } finally {
    Object.assign(globalThis, { window: oldWindow });
  }
});

test("a kit landing clears the onboarding skip so settings is not held for the tab", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  };
  const oldSession = globalThis.sessionStorage;
  Object.assign(globalThis, { sessionStorage: storage });
  try {
    markSkipOnboarding();
    expect(shouldSkipOnboarding()).toBe(true);
    clearSkipOnboarding();
    expect(shouldSkipOnboarding()).toBe(false);
  } finally {
    Object.assign(globalThis, { sessionStorage: oldSession });
  }
  expect(signup).toContain("clears this once that page is open");
  expect(guard).toContain("if (isKitDeepLink(`${location.pathname}${location.search}`)) clearSkipOnboarding();");
});

test("the greeting cap keeps emoji whole and a plus in the email stays encoded", () => {
  const wave = "👋";
  expect(capAuthCodeField(`${"A".repeat(79)}${wave}`)).toBe(`${"A".repeat(79)}${wave}`);
  expect(capAuthCodeField(`${"A".repeat(80)}${wave}`)).toBe("A".repeat(80));
  expect(Array.from(capAuthCodeField(wave.repeat(90))).length).toBe(80);
  expect(capAuthCodeField(wave.repeat(90))).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);

  const url = authCodeSetPasswordUrl("buyer+kit@example.com", kitNext);
  expect(url).toContain(`email=${encodeURIComponent("buyer+kit@example.com")}`);
  expect(url).toContain("buyer%2Bkit%40example.com");
  expect(new URL(url ?? "").searchParams.get("email")).toBe("buyer+kit@example.com");
});
