/**
 * Headless WebKit, iPhone viewport.
 * Landing ?fbclid=test&utm_source=facebook, then checkout with storage cleared
 * so only the first-party cookie remains.
 * Only the local dev server is allowed on the network. Stripe, create-checkout,
 * Meta, GoHighLevel, and Supabase are aborted. one-feature-kit-payment is stubbed.
 * Nothing is charged.
 */
import { webkit, devices } from "playwright";

const base = process.env.KIT_ATTR_BASE || "http://127.0.0.1:8080";
const landing = `${base}/one-feature-kit?fbclid=test&utm_source=facebook`;
const checkout = `${base}/one-feature-kit/checkout`;
const iPhone = devices["iPhone 13"];

function localHost(url) {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
  } catch {
    return false;
  }
}

const browser = await webkit.launch({ headless: true });
const context = await browser.newContext({
  ...iPhone,
  viewport: { width: 390, height: 844 },
});
let body = null;
await context.addInitScript(() => {
  const allow = (url) => {
    const value = String(url);
    if (value.includes("/functions/v1/one-feature-kit-payment")) return true;
    try {
      const host = new URL(value, location.href).hostname;
      return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
    } catch {
      return false;
    }
  };
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input instanceof Request ? input.url : String(input);
    if (!allow(url)) return Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }));
    return origFetch(input, init);
  };
  const origBeacon = navigator.sendBeacon?.bind(navigator);
  navigator.sendBeacon = (url, data) => {
    if (!allow(String(url))) return true;
    return origBeacon ? origBeacon(url, data) : false;
  };
});
await context.route("**/*", async (route) => {
  const url = route.request().url();
  if (url.includes("/functions/v1/one-feature-kit-payment")) {
    body = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ error: "stubbed" }),
    });
    return;
  }
  if (!localHost(url)) {
    await route.abort();
    return;
  }
  await route.continue();
});

const landingPage = await context.newPage();
const page = await context.newPage();
try {
  await landingPage.goto(landing, { waitUntil: "domcontentloaded", referer: "https://facebook.com/" });
  await landingPage.waitForFunction(() => document.cookie.includes("ofk_attr="), null, { timeout: 20000 });
  await landingPage.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await landingPage.close();
  await context.addCookies([{ name: "_fbp", value: "fb.1.9.555", url: base }]);
  await page.goto(checkout, { waitUntil: "domcontentloaded" });
  await page.locator("#ofk-name").waitFor({ timeout: 20000 });
  await page.locator("#ofk-name").fill("Ada");
  await page.locator("#ofk-email").fill("ada@example.com");
  await page.locator("#ofk-phone").fill("3375551212");
  await page.locator("#ofk-complete").click();
  const started = Date.now();
  while (!body && Date.now() - started < 20000) {
    await page.waitForTimeout(100);
  }
  if (!body) throw new Error("checkout create was not called");
  const tracking = body.tracking ?? {};
  const problems = [];
  if (tracking.fbclid !== "test" && body.fbclid !== "test") problems.push(`fbclid missing: ${JSON.stringify(tracking.fbclid)}`);
  if (tracking.utm_source !== "facebook" && body.utm_source !== "facebook") problems.push("utm_source missing");
  const fbc = String(tracking.fbc || "");
  if (!/^fb\.1\.\d+\.test$/.test(fbc)) problems.push(`fbc was ${fbc}`);
  if (!String(tracking.landing_page || "").includes("fbclid=test")) problems.push(`landing_page was ${tracking.landing_page}`);
  if (tracking.fbp !== "fb.1.9.555") problems.push(`fbp was ${tracking.fbp}`);
  if (tracking.referrer !== "https://facebook.com/") problems.push(`referrer was ${tracking.referrer}`);
  if (tracking.checkout_page !== "/one-feature-kit/checkout") problems.push(`checkout_page was ${tracking.checkout_page}`);
  if (problems.length) {
    console.error(JSON.stringify(body, null, 2));
    throw new Error(problems.join("; "));
  }
  console.log(JSON.stringify({
    fbclid: tracking.fbclid,
    fbc: tracking.fbc,
    fbp: tracking.fbp ?? null,
    utm_source: tracking.utm_source,
    landing_page: tracking.landing_page,
    referrer: tracking.referrer,
    checkout_page: tracking.checkout_page,
  }));
} finally {
  await browser.close();
}
