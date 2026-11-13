/**
 * Local walkthrough for /saaspartner.
 * Vite runs with VITE_PLATFORM_MOCK=1. Every non-local host is blocked.
 * Nothing is written to the live project.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 8091;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = process.env.SAAS_PARTNER_SHOTS || "/opt/cursor/artifacts/screenshots";
const WIDTHS = [375, 768, 1280];
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const failures = [];

function fail(message) {
  failures.push(message);
  console.error("FAIL", message);
}

async function startDev() {
  const vite = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
  const child = spawn(process.execPath, [vite, "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    env: { ...process.env, VITE_PLATFORM_MOCK: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  child.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/saaspartner`);
      if (response.ok) return child;
    } catch {
      /* still booting */
    }
    if (child.exitCode != null) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  child.kill("SIGTERM");
  throw new Error(`dev server did not start\n${logs.slice(-2000)}`);
}

async function blockExternal(context) {
  const leaked = [];
  await context.route("**/*", async (route) => {
    let host = "";
    try {
      host = new URL(route.request().url()).hostname.replace(/^\[|\]$/g, "");
    } catch {
      await route.abort();
      return;
    }
    if (host === "127.0.0.1" || host === "localhost" || host === "::1") {
      await route.continue();
      return;
    }
    leaked.push(host);
    const type = route.request().resourceType();
    if (type === "script" || type === "document") {
      await route.fulfill({ status: 200, contentType: "application/javascript", body: "/* blocked */" });
      return;
    }
    if (type === "stylesheet") {
      await route.fulfill({ status: 200, contentType: "text/css", body: "/* blocked */" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ mocked: true }),
    });
  });
  return leaked;
}

async function openPage(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const leaked = await blockExternal(context);
  await context.addInitScript(() => {
    localStorage.setItem("ss_cookie_notice_ack", "1");
    sessionStorage.setItem("ss_mock_signed_out", "1");
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(`${ORIGIN}/saaspartner`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Let us Promote Your SaaS" }).waitFor({ timeout: 20000 });
  await page.getByTestId("saas-partner-form").waitFor();
  return { context, page, leaked, pageErrors };
}

async function age(page) {
  await page.locator("#saas-partner-started-at").fill(String(Date.now() - 8000), { force: true });
}

async function fillRequired(page, fields) {
  await page.getByLabel("Business name").fill(fields.business);
  await page.getByLabel("Business website").fill(fields.website);
  await page.getByLabel("Your name").fill(fields.name);
  await page.getByLabel("Email").fill(fields.email);
  await page.getByLabel("Phone").fill(fields.phone);
  await age(page);
}

function person(width, tag) {
  return {
    business: `${tag} SaaS`,
    website: `https://${tag}.example`,
    name: "Ada Lovelace",
    email: `${tag}@example.test`,
    phone: "5550100199",
  };
}

async function logOf(page) {
  return page.evaluate(() => window.__ssSaasPartner || null);
}

async function assertNoPhone(page, where) {
  const text = await page.locator("body").innerText();
  if (text.includes("227-0501") || text.includes("3372270501") || text.includes("(337)")) {
    fail(`${where}: support phone appeared as text`);
  }
}

async function assertFits(page, where) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) fail(`${where}: horizontal overflow ${overflow}px`);
}

async function see(page, text) {
  await page.getByText(text).first().waitFor({ timeout: 10000 });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true });
}

async function runWidth(browser, width) {
  const tag = `w${width}`;
  const { context, page, leaked, pageErrors } = await openPage(browser, width);
  try {
    await assertNoPhone(page, `${tag} empty`);
    await assertFits(page, `${tag} empty`);
    await page.locator("header").getByText("SaaSSuite").waitFor();
    await page.getByText("Privacy Policy").first().waitFor();
    await shot(page, `saaspartner_empty_${width}.png`);

    await age(page);
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await see(page, "Enter your business name.");
    await see(page, "Enter a valid website, including http or https.");
    await see(page, "Enter your name.");
    await see(page, "Enter a valid email address.");
    await see(page, "Enter a valid phone number.");
    await assertFits(page, `${tag} error`);
    await shot(page, `saaspartner_error_${width}.png`);

    const missing = [
      ["business", "Business name", "Enter your business name."],
      ["website", "Business website", "Enter a valid website, including http or https."],
      ["name", "Your name", "Enter your name."],
      ["email", "Email", "Enter a valid email address."],
      ["phone", "Phone", "Enter a valid phone number."],
    ];
    for (const [key, label, message] of missing) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId("saas-partner-form").waitFor();
      const fields = person(width, `${tag}-miss-${key}`);
      fields[key] = "";
      await fillRequired(page, fields);
      await page.getByRole("button", { name: "Join the waitlist" }).click();
      await see(page, message);
      const kept = key === "business" ? fields.website : fields.business;
      const keptLabel = key === "business" ? "Business website" : "Business name";
      const value = await page.getByLabel(keptLabel).inputValue();
      if (value !== kept) fail(`${tag} missing ${key}: expected ${keptLabel} to stay ${kept}, got ${value}`);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("saas-partner-form").waitFor();
    const invalidEmail = person(width, `${tag}-email`);
    invalidEmail.email = "ada@acme";
    await fillRequired(page, invalidEmail);
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await see(page, "Enter a valid email address.");
    if ((await page.getByLabel("Email").inputValue()) !== "ada@acme") fail(`${tag} invalid email cleared the field`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("saas-partner-form").waitFor();
    const invalidUrl = person(width, `${tag}-url`);
    invalidUrl.website = "notaurl";
    await fillRequired(page, invalidUrl);
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await see(page, "Enter a valid website, including http or https.");
    if ((await page.getByLabel("Business website").inputValue()) !== "notaurl") fail(`${tag} invalid URL cleared the field`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("saas-partner-form").waitFor();
    const bare = person(width, `${tag}-bare`);
    bare.website = `${tag}-bare.example`;
    await fillRequired(page, bare);
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await page.getByRole("heading", { name: "You're on the waitlist" }).waitFor();
    const bareLog = await logOf(page);
    if (bareLog?.last?.website !== `https://${tag}-bare.example/`) {
      fail(`${tag} bare URL was not normalized: ${bareLog?.last?.website}`);
    }
    if (bareLog?.last?.affiliate_link) fail(`${tag} required-only path stored an affiliate link`);

    await page.getByRole("button", { name: "Add another SaaS" }).click();
    await page.getByTestId("saas-partner-form").waitFor();
    const full = person(width, `${tag}-full`);
    await fillRequired(page, full);
    await page.getByLabel("Affiliate signup link").fill("partners.example/ada");
    await page.getByLabel("Logo").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
    await page.getByAltText("Logo preview").waitFor();
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await page.getByRole("heading", { name: "You're on the waitlist" }).waitFor();
    await assertNoPhone(page, `${tag} thanks`);
    await assertFits(page, `${tag} thanks`);
    await shot(page, `saaspartner_thanks_${width}.png`);
    const fullLog = await logOf(page);
    const saved = fullLog?.submissions?.find((row) => row.email === full.email);
    if (!saved?.has_logo) fail(`${tag} happy path did not store a logo`);
    if (saved?.affiliate_link !== "https://partners.example/ada") {
      fail(`${tag} affiliate link was not normalized: ${saved?.affiliate_link}`);
    }

    await page.getByRole("button", { name: "Add another SaaS" }).click();
    await page.getByTestId("saas-partner-form").waitFor();
    await fillRequired(page, full);
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await see(page, "This business is already on the waitlist.");
    if ((await page.getByLabel("Email").inputValue()) !== full.email) fail(`${tag} duplicate cleared the email`);
    const afterDup = await logOf(page);
    if (afterDup.submissions.filter((row) => row.email === full.email).length !== 1) {
      fail(`${tag} duplicate inserted a second row`);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("saas-partner-form").waitFor();
    const big = person(width, `${tag}-big`);
    await fillRequired(page, big);
    await page.getByLabel("Logo").setInputFiles({
      name: "big.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(2 * 1024 * 1024 + 1, 7),
    });
    await see(page, "Logo must be a PNG, JPG, WEBP, or SVG under 2 MB.");
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await page.getByTestId("saas-partner-form").waitFor();
    if (await page.getByRole("heading", { name: "You're on the waitlist" }).count()) {
      fail(`${tag} oversized logo was accepted`);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("saas-partner-form").waitFor();
    const gif = person(width, `${tag}-gif`);
    await fillRequired(page, gif);
    await page.getByLabel("Logo").setInputFiles({
      name: "logo.gif",
      mimeType: "image/gif",
      buffer: Buffer.from("GIF89a"),
    });
    await see(page, "Upload a PNG, JPG, WEBP, or SVG logo.");
    if (await page.getByAltText("Logo preview").count()) fail(`${tag} rejected logo still previewed`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("saas-partner-form").waitFor();
    const bait = person(width, `${tag}-bait`);
    await fillRequired(page, bait);
    await page.locator("#saas-partner-company-url").evaluate((element) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, "https://spam.example");
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await page.getByRole("heading", { name: "You're on the waitlist" }).waitFor();
    const baitLog = await logOf(page);
    if (!baitLog?.discarded?.includes("honeypot")) fail(`${tag} honeypot was stored`);
    if (baitLog?.submissions?.some((row) => row.email === bait.email)) fail(`${tag} honeypot inserted a row`);

    await page.evaluate(() => sessionStorage.setItem("ss_saas_partner_mode", "error"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("saas-partner-form").waitFor();
    const down = person(width, `${tag}-down`);
    await fillRequired(page, down);
    await page.getByRole("button", { name: "Join the waitlist" }).click();
    await see(page, "We couldn't add you to the waitlist. Please try again.");
    if ((await page.getByLabel("Business name").inputValue()) !== down.business) fail(`${tag} server error cleared the form`);
    const downLog = await logOf(page);
    if (downLog?.submissions?.some((row) => row.email === down.email)) fail(`${tag} server error stored a row`);

    await page.evaluate(() => sessionStorage.removeItem("ss_saas_partner_mode"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByTestId("saas-partner-form").waitFor();
    await page.locator("#saas-partner-business").focus();
    const order = [];
    for (let step = 0; step < 8; step += 1) {
      order.push(await page.evaluate(() => document.activeElement?.id || ""));
      await page.keyboard.press("Tab");
    }
    for (const id of [
      "saas-partner-business",
      "saas-partner-website",
      "saas-partner-name",
      "saas-partner-email",
      "saas-partner-phone",
      "saas-partner-affiliate",
      "saas-partner-logo",
    ]) {
      if (!order.includes(id)) fail(`${tag} keyboard order missed ${id}: ${order.join(",")}`);
    }
    const labels = ["Business name", "Business website", "Your name", "Email", "Phone", "Affiliate signup link", "Logo"];
    for (const label of labels) {
      const control = page.getByLabel(label);
      if ((await control.count()) < 1) fail(`${tag} missing accessible label ${label}`);
    }
    const keys = person(width, `${tag}-keys`);
    await page.locator("#saas-partner-business").focus();
    await page.keyboard.type(keys.business);
    await page.keyboard.press("Tab");
    await page.keyboard.type(keys.website);
    await page.keyboard.press("Tab");
    await page.keyboard.type(keys.name);
    await page.keyboard.press("Tab");
    await page.keyboard.type(keys.email);
    await page.keyboard.press("Tab");
    await page.keyboard.type(keys.phone);
    await age(page);
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: "You're on the waitlist" }).waitFor();

    if (pageErrors.length) fail(`${tag} page errors: ${pageErrors.join(" | ")}`);
    const external = [...new Set(leaked)];
    if (external.some((host) => host === "auth.saassuite.ai" || host.includes("leadconnector") || host.includes("supabase"))) {
      /* Blocked responses are expected. A leaked host is one we continued, and we never continue those. */
    }
    console.log(`ok ${width}`, external.length ? `blocked ${external.length} external hosts` : "no external hosts");
  } finally {
    await context.close();
  }
}

const child = await startDev();
const browser = await chromium.launch({ headless: true });
try {
  await mkdir(OUT, { recursive: true });
  for (const width of WIDTHS) await runWidth(browser, width);
} finally {
  await browser.close();
  child.kill("SIGTERM");
}

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("saas partner walkthrough passed");
