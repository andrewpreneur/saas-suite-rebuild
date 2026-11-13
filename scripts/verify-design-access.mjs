/**
 * Client Hub Design access harness.
 * STARTER means no branding purchase (`ss_mock_branding=0`).
 * A separate pass sets that flag on Starter and expects branding open.
 * Requires the dev server with VITE_PLATFORM_MOCK=1. Never calls a live host.
 *
 *   DESIGN_PAGE_URL=http://127.0.0.1:8080 bun scripts/verify-design-access.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = process.env.DESIGN_PAGE_URL || "http://127.0.0.1:8080";
const OUT = process.env.DESIGN_ACCESS_SHOTS || "/opt/cursor/artifacts/screenshots/design-access/after";
const WIDTHS = [375, 768, 1280];

let host = "";
try {
  host = new URL(BASE).hostname.replace(/^\[|\]$/g, "");
} catch {
  console.error("DESIGN_PAGE_URL is not a URL");
  process.exit(1);
}
if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
  console.error("Refusing to run against a non-local host:", host);
  process.exit(1);
}

const failures = [];

function fail(message) {
  failures.push(message);
  console.error("FAIL", message);
}

async function blockLiveHosts(context) {
  await context.route("**/*", async (route) => {
    let requestHost = "";
    try {
      requestHost = new URL(route.request().url()).hostname.replace(/^\[|\]$/g, "");
    } catch {
      await route.abort();
      return;
    }
    if (requestHost === "127.0.0.1" || requestHost === "localhost" || requestHost === "::1") {
      await route.continue();
      return;
    }
    const type = route.request().resourceType();
    if (type === "script") {
      await route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "/* blocked */",
      });
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
}

async function openContext(browser, plan, width, brandingToolAccess = false) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    deviceScaleFactor: 1,
  });
  await blockLiveHosts(context);
  await context.addInitScript((state) => {
    localStorage.setItem("ss_tours_disabled_v1:agency@example.com", "1");
    localStorage.setItem("ss_cookie_notice_ack", "1");
    sessionStorage.setItem("ss_mock_plan", state.planName);
    sessionStorage.setItem("ss_mock_branding", state.branding ? "1" : "0");
    sessionStorage.setItem("ss_mock_install", "installed");
  }, { planName: plan, branding: brandingToolAccess });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  return { context, page, pageErrors };
}

async function heading(page) {
  const node = page.getByRole("heading", { level: 1 }).first();
  await node.waitFor({ timeout: 20000 });
  return (await node.innerText()).replace(/\s+/g, " ").trim();
}

async function openDesignNav(page, width) {
  if (width < 768) {
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  }
  const design = page.locator("[data-tip-target='sidebar-branding']");
  await design.waitFor({ timeout: 10000 });
  return design;
}

async function assertWidgetsUsable(page, label) {
  await page.getByTestId("design-tab-widgets").click();
  const widgets = page.getByTestId("design-widgets");
  await widgets.waitFor({ timeout: 10000 });
  for (const id of ["design-widget-popup", "design-widget-top-nav"]) {
    const toggle = page.getByTestId(id);
    await toggle.waitFor();
    const disabled = await toggle.isDisabled();
    if (disabled) fail(`${label} ${id} is disabled`);
    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    const after = await toggle.getAttribute("aria-checked");
    if (before === after) fail(`${label} ${id} did not toggle (${before})`);
  }
  if ((await page.getByRole("dialog").count()) > 0) {
    fail(`${label} widget toggle opened a dialog`);
  }
}

async function shootDesign(browser, plan, width) {
  const { context, page, pageErrors } = await openContext(browser, plan, width);
  const label = `${plan} ${width}`;
  try {
    await page.goto(`${BASE}/app/client-hub/design`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("design-page").waitFor({ timeout: 20000 });
    const title = await heading(page);
    const url = new URL(page.url());
    if (url.pathname !== "/app/client-hub/design") fail(`${label} url ${url.pathname}`);
    if (title !== "Design") fail(`${label} heading ${title}`);
    if ((await page.getByRole("heading", { name: "Edit Pages" }).count()) > 0) {
      fail(`${label} rendered Edit Pages`);
    }

    if (plan === "STARTER") {
      await page.getByTestId("design-theme-lock").waitFor();
      await page.getByTestId("design-widgets").waitFor();
      if ((await page.getByTestId("design-install").count()) > 0) {
        fail(`${label} showed the Theme Customizer install card`);
      }
      const theme = await page.getByTestId("design-theme-lock").innerText();
      if (!theme.includes("Theme Customizer") || !theme.includes("Upgrade to Basic")) {
        fail(`${label} theme lock copy: ${theme}`);
      }
      await page.getByTestId("design-tab-style").click();
      await page.getByTestId("design-branding-lock").waitFor();
      const branding = await page.getByTestId("design-branding-lock").innerText();
      if (!branding.includes("Branding tool") || !branding.includes("Upgrade to Basic")) {
        fail(`${label} branding lock copy: ${branding}`);
      }
      if ((await page.getByText("Brand colors", { exact: true }).count()) > 0) {
        fail(`${label} showed Brand colors`);
      }
      await page.getByTestId("design-tab-advanced").click();
      await page.getByTestId("design-branding-lock").waitFor();
      if ((await page.getByText("Login Page Customization", { exact: true }).count()) > 0) {
        fail(`${label} showed advanced branding controls`);
      }
      await page.getByTestId("design-tab-widgets").click();
      await page.getByTestId("design-widgets").waitFor();
    } else {
      await page.getByText("Brand colors", { exact: true }).waitFor({ timeout: 20000 });
      await page.getByTestId("design-install").waitFor();
      if ((await page.getByTestId("design-theme-lock").count()) > 0) {
        fail(`${label} locked the Theme Customizer`);
      }
      if ((await page.getByTestId("design-branding-lock").count()) > 0) {
        fail(`${label} locked the branding tool`);
      }
      const install = await page.getByTestId("design-install").innerText();
      if (!install.includes("Theme Customizer")) fail(`${label} install copy: ${install}`);
      await page.getByTestId("design-tab-advanced").click();
      await page.getByText("Login Page Customization", { exact: true }).waitFor();
      if ((await page.getByTestId("design-branding-lock").count()) > 0) {
        fail(`${label} locked advanced branding`);
      }
      await page.getByTestId("design-tab-style").click();
      await page.getByText("Brand colors", { exact: true }).waitFor();
    }

    if ((await page.getByRole("dialog").count()) > 0) fail(`${label} opened an upgrade dialog`);
    await page.screenshot({
      path: `${OUT}/${plan.toLowerCase()}-${width}.png`,
      fullPage: true,
    });
    await assertWidgetsUsable(page, label);
    if (pageErrors.length) fail(`${label} page errors ${pageErrors.join(" | ")}`);
  } finally {
    await context.close();
  }
}

async function shootSidebar(browser, plan, width) {
  const { context, page, pageErrors } = await openContext(browser, plan, width);
  const label = `${plan} sidebar ${width}`;
  try {
    await page.goto(`${BASE}/app/client-hub`, { waitUntil: "domcontentloaded" });
    const title = await heading(page);
    if (title !== "Edit Pages") fail(`${label} start heading ${title}`);
    if (new URL(page.url()).pathname !== "/app/client-hub") fail(`${label} start url ${page.url()}`);

    const design = await openDesignNav(page, width);
    const navText = (await design.innerText()).replace(/\s+/g, " ");
    if (plan === "STARTER" && /upgrade/i.test(navText)) {
      fail(`${label} Design nav is locked: ${navText}`);
    }
    if (plan === "STARTER" && width >= 768) {
      const streamline = (await page.locator("[data-tip-target='sidebar-streamline']").innerText())
        .replace(/\s+/g, " ");
      if (!/upgrade/i.test(streamline)) fail(`${label} menu removal lost its lock: ${streamline}`);
    }
    await design.click();
    await page.getByTestId("design-page").waitFor({ timeout: 20000 });
    const next = new URL(page.url());
    if (next.pathname !== "/app/client-hub/design") fail(`${label} click url ${next.pathname}`);
    if ((await heading(page)) !== "Design") fail(`${label} click heading`);
    if ((await page.getByRole("dialog").count()) > 0) fail(`${label} click opened a dialog`);

    if (plan === "STARTER" && width === 1280) {
      await page.screenshot({ path: `${OUT}/starter-1280-sidebar-click.png`, fullPage: true });
    }

    if (width >= 768) {
      await page.locator("[data-tip-target='sidebar-client-hub']").click();
      await page.getByRole("heading", { name: "Edit Pages" }).waitFor({ timeout: 20000 });
      if (new URL(page.url()).pathname !== "/app/client-hub") {
        fail(`${label} Edit Pages url ${page.url()}`);
      }
    }
    if (pageErrors.length) fail(`${label} page errors ${pageErrors.join(" | ")}`);
  } finally {
    await context.close();
  }
}

async function shootRoutes(browser) {
  const { context, page, pageErrors } = await openContext(browser, "STARTER", 1280);
  try {
    for (const path of ["/app/client-hub/home", "/app/client-hub?hubTab=home", "/app/client-hub?panel=installation-guide"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      if (path.includes("panel=installation-guide")) {
        await page.getByRole("dialog", { name: "Installation Guide" }).waitFor({ timeout: 20000 });
      } else {
        const title = await heading(page);
        if (title !== "Edit Pages") fail(`starter ${path} heading ${title}`);
      }
      const landed = new URL(page.url()).pathname;
      if (landed === "/app/client-hub/design" || !landed.startsWith("/app/client-hub")) {
        fail(`starter ${path} url ${page.url()}`);
      }
      if ((await page.getByTestId("design-page").count()) > 0) fail(`starter ${path} rendered Design`);
    }
    await page.goto(`${BASE}/app/branding`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("design-page").waitFor({ timeout: 20000 });
    if ((await heading(page)) !== "Design") fail("legacy /app/branding heading");
    if (new URL(page.url()).pathname !== "/app/branding") fail(`legacy branding redirected to ${page.url()}`);

    await page.goto(`${BASE}/app/copilot/brandingtool`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    if (page.url().includes("/app/client-hub")) fail(`copilot brandingtool left copilot: ${page.url()}`);
    const documentStatus = await page.evaluate(() => performance.getEntriesByType("navigation")[0]?.responseStatus ?? 0);
    if (documentStatus >= 400) fail(`copilot brandingtool document ${documentStatus}`);
    if (pageErrors.length) fail(`route page errors ${pageErrors.join(" | ")}`);
  } finally {
    await context.close();
  }
}

async function shootPurchasedStarter(browser) {
  const { context, page, pageErrors } = await openContext(browser, "STARTER", 1280, true);
  const label = "STARTER branding purchase 1280";
  try {
    await page.goto(`${BASE}/app/client-hub/design`, { waitUntil: "domcontentloaded" });
    await page.getByTestId("design-page").waitFor({ timeout: 20000 });
    await page.getByText("Brand colors", { exact: true }).waitFor({ timeout: 20000 });
    await page.getByTestId("design-install").waitFor();
    if ((await page.getByTestId("design-theme-lock").count()) > 0) {
      fail(`${label} locked the Theme Customizer`);
    }
    if ((await page.getByTestId("design-branding-lock").count()) > 0) {
      fail(`${label} locked the branding tool`);
    }
    await page.getByTestId("design-tab-advanced").click();
    await page.getByText("Login Page Customization", { exact: true }).waitFor();
    if ((await page.getByTestId("design-branding-lock").count()) > 0) {
      fail(`${label} locked advanced branding`);
    }
    const streamline = (await page.locator("[data-tip-target='sidebar-streamline']").innerText()).replace(
      /\s+/g,
      " ",
    );
    if (!/upgrade/i.test(streamline)) fail(`${label} menu removal lost its lock: ${streamline}`);
    await page.screenshot({ path: `${OUT}/starter-branding-purchase-1280.png`, fullPage: true });
    await assertWidgetsUsable(page, label);
    if (pageErrors.length) fail(`${label} page errors ${pageErrors.join(" | ")}`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
for (const plan of ["STARTER", "BASIC"]) {
  for (const width of WIDTHS) {
    await shootDesign(browser, plan, width);
    await shootSidebar(browser, plan, width);
  }
}
await shootPurchasedStarter(browser);
await shootRoutes(browser);
await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("Design access harness passed");
