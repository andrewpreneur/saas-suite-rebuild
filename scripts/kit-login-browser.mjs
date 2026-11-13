/**
 * Local kit-login check. Auth is stubbed. Stripe, checkout, and GoHighLevel are blocked.
 * No live account is read or written.
 */
import { chromium, webkit } from "playwright";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORT = 4173;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const KIT = "/app/dashboard?view=kit";
const PASSWORD = "local-test-pass";
const HOSTS = ["https://backend-disconnected.invalid", "https://backend-disconnected.invalid"];

const PEOPLE = {
  password: { email: "kit-buyer-password@example.test", state: "password" },
  nopass: { email: "kit-buyer-nopass@example.test", state: "needs_password" },
  fresh: { email: "kit-buyer-new@example.test", state: "new" },
};

function sessionFor(email) {
  return {
    access_token: `test-access-${email}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `test-refresh-${email}`,
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email,
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: "email" },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

function accountRow(email) {
  return {
    approval: "YES",
    plan: "STARTER",
    email_warmup_access: false,
    free_leads_access: false,
    hide_bonuses: false,
    branding_tool_access: false,
    is_affiliate: false,
    snapshot_access: false,
    initial_questions_completed: false,
    trial_source: null,
    landing_page: null,
    checkout_page: null,
    referrer: null,
    source: null,
    email,
  };
}

async function startPreview() {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const child = spawn(fileURLToPath(new URL("../node_modules/.bin/vite", import.meta.url)), ["preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(ORIGIN);
      if (response.ok) return child;
    } catch { /* preview still booting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill("SIGTERM");
  throw new Error("preview did not start");
}

async function stubAuth(page, person) {
  let session = null;
  const questionsSeen = { value: false };
  const recoverUrls = [];

  const blocked = /js\.stripe\.com|create-checkout|leadconnectorhq|facebook\.net|facebook\.com|google-analytics|googletagmanager|googleadservices|stape|lynkific|doubleclick|hotjar|segment\.io|sentry\.io/i;

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    if (blocked.test(url)) {
      await route.abort();
      return;
    }
    if (!HOSTS.some((host) => url.startsWith(host))) {
      await route.continue();
      return;
    }
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
        },
      });
      return;
    }

    const json = (body, status = 200, extra = {}) => route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*", ...extra },
      body: JSON.stringify(body),
    });

    const path = new URL(url).pathname;
    if (path.endsWith("/auth/v1/signup")) {
      if (person.state !== "new") {
        await json({ error: "User already registered", msg: "User already registered", error_code: "user_already_exists" }, 422);
        return;
      }
      session = sessionFor(person.email);
      await json(session);
      return;
    }
    if (path.endsWith("/auth/v1/token")) {
      const raw = request.postData() || "";
      let email = person.email;
      let password = "";
      try {
        const parsed = JSON.parse(raw);
        email = parsed.email || email;
        password = parsed.password || "";
      } catch {
        const params = new URLSearchParams(raw);
        email = params.get("email") || email;
        password = params.get("password") || "";
      }
      if (url.includes("grant_type=refresh_token") || raw.includes("refresh_token")) {
        session = session || sessionFor(email);
        await json(session);
        return;
      }
      if (password !== PASSWORD) {
        await json({ error: "invalid_grant", error_description: "Invalid login credentials", msg: "Invalid login credentials" }, 400);
        return;
      }
      session = sessionFor(email);
      await json(session);
      return;
    }
    if (path.endsWith("/auth/v1/user")) {
      const header = request.headers()["authorization"] || "";
      if (!session || !header.includes(session.access_token)) {
        await json({ message: "Unauthorized" }, 401);
        return;
      }
      await json(session.user);
      return;
    }
    if (path.endsWith("/auth/v1/recover")) {
      recoverUrls.push(url);
      await json({});
      return;
    }
    if (path.endsWith("/functions/v1/auth-account-state")) {
      await json({ state: person.state });
      return;
    }
    if (path.endsWith("/functions/v1/set-initial-password")) {
      const body = JSON.parse(request.postData() || "{}");
      if (body.action === "send_code") {
        await json({ status: "sent" });
        return;
      }
      if (body.action === "set_password" && body.code === "123456" && String(body.password || "").length >= 6) {
        await json({ status: "password_set" });
        return;
      }
      await json({ status: "proof_required", error: "Enter the one-time code from your email, or open the sign-in link we already sent." }, 401);
      return;
    }
    if (path.includes("/rest/v1/rpc/get_user_initial_questions_status")) {
      questionsSeen.value = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "access-control-allow-origin": "*" },
        body: "false",
      });
      return;
    }
    if (path.includes("/rest/v1/rpc/get_user_approval_by_email")) {
      await json(person.state === "new" ? [] : [{ approval: "YES", has_auth_account: true }]);
      return;
    }
    if (path.includes("/rest/v1/rpc/")) {
      await json(null);
      return;
    }
    if (path.includes("/rest/v1/saas_suite_users")) {
      const row = accountRow(person.email);
      const accept = request.headers()["accept"] || "";
      await json(accept.includes("vnd.pgrst.object") ? row : [row]);
      return;
    }
    if (path.includes("/rest/v1/kit_purchases")) {
      await json([{ line_id: "kit", email: person.email, comped: false, user_id: sessionFor(person.email).user.id }]);
      return;
    }
    if (path.includes("/rest/v1/")) {
      const accept = request.headers()["accept"] || "";
      await json(accept.includes("vnd.pgrst.object") ? null : []);
      return;
    }
    await json({});
  });

  if (typeof page.routeWebSocket === "function") {
    await page.routeWebSocket(/saassuite|supabase/, (socket) => socket.close());
  }

  return { questionsSeen, recoverUrls };
}

async function runPerson(browser, person, width) {
  const page = await browser.newPage({ viewport: { width, height: 800 } });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  const stubs = await stubAuth(page, person);
  const next = encodeURIComponent(KIT);
  await page.goto(`${ORIGIN}/signup?email=${encodeURIComponent(person.email)}&next=${next}`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="signup-card"][data-mode="email"]').waitFor();
  await page.getByText("Create your account", { exact: true }).waitFor();
  await page.waitForFunction((email) => {
    const value = document.querySelector("#email")?.value === email;
    const href = document.querySelector("#signup-login-link")?.getAttribute("href") || "";
    return value && href.includes(encodeURIComponent(email)) && href.includes("next=");
  }, person.email);
  const loginHref = await page.locator("#signup-login-link").getAttribute("href");
  const signupOverflow = width === 375
    ? await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    : null;

  await page.getByRole("button", { name: "Continue", exact: true }).click();

  if (person.state === "password") {
    await page.locator('[data-testid="signup-card"][data-mode="sign-in"]').waitFor();
    await page.getByText("Sign in", { exact: true }).first().waitFor();
    await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
    const recoverDeadline = Date.now() + 5000;
    while (stubs.recoverUrls.length === 0 && Date.now() < recoverDeadline) {
      await page.waitForTimeout(100);
    }
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  } else if (person.state === "needs_password") {
    await page.locator('[data-testid="signup-card"][data-mode="set-password"]').waitFor();
    await page.getByText("Set your password", { exact: true }).waitFor();
    await page.locator("#password-code").fill("123456");
    await page.locator("#new-password").fill(PASSWORD);
    await page.getByRole("button", { name: "Set password", exact: true }).click();
  } else {
    await page.getByText("You're signing up with").waitFor();
    await page.locator("#signup-terms").check();
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create Account", exact: true }).click();
  }

  await page.getByRole("heading", { name: "One Feature Kit", exact: true }).waitFor({ timeout: 25000 });
  await page.waitForTimeout(1200);
  const finalUrl = page.url();
  const kitOverflow = width === 375
    ? await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    : null;
  await page.close();
  return {
    email: person.email,
    state: person.state,
    width,
    loginHref,
    recoverUrls: stubs.recoverUrls,
    questionsSeen: stubs.questionsSeen.value,
    finalUrl,
    signupOverflow,
    kitOverflow,
    pageErrors,
  };
}

const engines = [{ name: "chromium", type: chromium }];
try {
  engines.push({ name: "webkit", type: webkit });
} catch { /* webkit optional */ }

const preview = await startPreview();
const results = [];
try {
  for (const engine of engines) {
    let browser;
    try {
      browser = await engine.type.launch({ headless: true });
    } catch (error) {
      results.push({ engine: engine.name, error: `launch failed: ${error.message}` });
      continue;
    }
    for (const width of [375, 1280]) {
      for (const person of Object.values(PEOPLE)) {
        try {
          const result = await runPerson(browser, person, width);
          const loginOk = result.loginHref?.includes(encodeURIComponent(person.email)) && result.loginHref?.includes("next=");
          const onKit = result.finalUrl.includes("/app/dashboard") && result.finalUrl.includes("view=kit") && !result.finalUrl.includes("v2-onboarding");
          const recoverOk = person.state !== "password" || result.recoverUrls.some((url) => url.includes("reset-password") && url.includes("next"));
          const overflowOk = result.width !== 375 || ((result.signupOverflow ?? 1) <= 1 && (result.kitOverflow ?? 1) <= 1);
          results.push({
            engine: engine.name,
            ...result,
            pass: Boolean(loginOk && onKit && recoverOk && overflowOk && result.questionsSeen && result.pageErrors.length === 0),
            loginOk,
            onKit,
            recoverOk,
            overflowOk,
          });
        } catch (error) {
          results.push({ engine: engine.name, state: person.state, width, pass: false, error: String(error).slice(0, 500) });
        }
      }
    }
    await browser.close();
  }
} finally {
  preview.kill("SIGTERM");
}

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((result) => {
  if (result.pass === true) return false;
  if (result.engine === "webkit" && String(result.error || "").includes("launch failed")) return false;
  return true;
});
if (failed.length) process.exit(1);
