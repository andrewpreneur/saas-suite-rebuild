/**
 * Headless walkthrough of Client Hub > Design.
 * Requires the dev server with VITE_PLATFORM_MOCK=1 (see package.json test:design-page).
 */
import { chromium, webkit } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.DESIGN_PAGE_URL || "http://127.0.0.1:8080/app/branding";
const OUT = process.env.DESIGN_PAGE_SHOTS || "/opt/cursor/artifacts/screenshots";
const WIDTHS = [375, 414, 768, 1280, 1440, 1920];

const failures = [];
let engine = "chromium";

function fail(message) {
  failures.push(`${engine}: ${message}`);
  console.error("FAIL", engine, message);
}

async function prepare(context, install, cookies = "acked") {
  await context.addInitScript(
    ({ mode, cookies: cookieMode }) => {
      localStorage.setItem("ss_tours_disabled_v1:agency@example.com", "1");
      if (cookieMode === "show") {
        localStorage.removeItem("ss_cookie_notice_ack");
        localStorage.removeItem("ss_tracking_optout");
      } else {
        localStorage.setItem("ss_cookie_notice_ack", "1");
      }
      sessionStorage.setItem("ss_mock_install", mode);
    },
    { mode: install, cookies },
  );
}

async function blockLiveHosts(context) {
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

async function openDesign(browser, { install, width, height = 900, cookies = "acked" }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await blockLiveHosts(context);
  await prepare(context, install, cookies);
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.getByTestId("design-page").waitFor({ timeout: 20000 });
  await page.getByRole("heading", { name: "Branding" }).waitFor();
  await page.getByText("Brand colors", { exact: true }).waitFor();
  return { context, page, pageErrors };
}

async function overflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const bar = document.querySelector("[data-testid='design-save-bar']");
    const pageBox = document.querySelector("[data-testid='design-page']")?.getBoundingClientRect();
    const barBox = bar?.getBoundingClientRect();
    let covered = null;
    if (barBox && pageBox) {
      const nodes = document.querySelectorAll(
        "[data-testid='design-page'] button, [data-testid='design-page'] a",
      );
      for (const node of nodes) {
        const box = node.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const visible =
          box.bottom > 0 &&
          box.top < window.innerHeight &&
          box.right > 0 &&
          box.left < window.innerWidth;
        if (!visible) continue;
        if (bar.contains(node)) continue;
        const overlaps =
          box.bottom > barBox.top + 2 &&
          box.top < barBox.bottom &&
          box.right > barBox.left &&
          box.left < barBox.right;
        if (overlaps) {
          covered = (node.innerText || node.getAttribute("aria-label") || node.tagName)
            .trim()
            .slice(0, 80);
          break;
        }
      }
    }
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      covered,
    };
  });
}

async function assertFit(page, label) {
  const box = await overflow(page);
  if (box.scrollWidth > box.clientWidth + 1) {
    fail(`${label} horizontal overflow ${box.scrollWidth} > ${box.clientWidth}`);
  }
  const cleared = await page.evaluate(() => {
    const bar = document.querySelector("[data-testid='design-save-bar']");
    if (!bar) return { ok: true };
    const nodes = [
      ...document.querySelectorAll(
        "[data-testid='design-page'] button, [data-testid='design-page'] a",
      ),
    ];
    const overlap = () => {
      const barBox = bar.getBoundingClientRect();
      for (const node of nodes) {
        if (bar.contains(node)) continue;
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const visible =
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          rect.right > 0 &&
          rect.left < window.innerWidth;
        if (!visible) continue;
        const hits =
          rect.bottom > barBox.top + 2 &&
          rect.top < barBox.bottom &&
          rect.right > barBox.left &&
          rect.left < barBox.right;
        if (hits) return node;
      }
      return null;
    };
    let node = overlap();
    if (!node) return { ok: true };
    let parent = node.parentElement;
    let scroller = null;
    while (parent) {
      const style = getComputedStyle(parent);
      if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 2) {
        scroller = parent;
        break;
      }
      parent = parent.parentElement;
    }
    for (let attempt = 0; attempt < 12 && node; attempt += 1) {
      const rect = node.getBoundingClientRect();
      const delta = rect.bottom - bar.getBoundingClientRect().top + 16;
      if (delta <= 0) break;
      if (scroller) scroller.scrollTop += delta;
      else window.scrollBy(0, delta);
      node = overlap();
    }
    if (!node) return { ok: true };
    const rect = node.getBoundingClientRect();
    return {
      ok: false,
      label: (node.innerText || node.getAttribute("aria-label") || node.tagName)
        .trim()
        .slice(0, 80),
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      barTop: Math.round(bar.getBoundingClientRect().top),
      scroller: scroller
        ? `${scroller.tagName} ${Math.round(scroller.scrollTop)}/${scroller.scrollHeight}`
        : `window ${Math.round(window.scrollY)}`,
    };
  });
  if (!cleared.ok) fail(`${label} save bar still covers content ${JSON.stringify(cleared)}`);
}

async function shot(page, name) {
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log("shot", file);
}

async function selectStyle(page, name) {
  await page.getByRole("radio", { name: new RegExp(name) }).click();
  await page.getByTestId("design-dirty").waitFor();
}

async function main(browser) {
  console.log(`\n== ${engine} ==`);
  try {
    const missing = await openDesign(browser, { install: "missing", width: 1440, height: 1000 });
    const missingText = await missing.page.locator("body").innerText();
    if (!missingText.includes("Not detected")) fail("missing install did not show Not detected");
    if (missingText.includes("Accent")) fail("Accent appeared on the not-detected frame");
    await selectStyle(missing.page, "Classic");
    await missing.page
      .getByTestId("design-dirty")
      .filter({ hasText: "1 unsaved change: Sidebar style" })
      .waitFor();
    const styleCard = missing.page.getByRole("radiogroup", { name: "Sidebar style" });
    if (await styleCard.locator("input").count()) fail("brand color cards render an input");
    await assertFit(missing.page, "1440 not-detected");
    await shot(missing.page, "design-style-not-detected-1440.png");
    await missing.page.getByTestId("design-save-menu").click();
    await missing.page.getByText("Agency default").waitFor();
    if (await missing.page.getByText("Dark Purple").count())
      fail("mockup preset name Dark Purple is shown");
    if (await missing.page.getByText("Client: Example Co").count())
      fail("mockup preset name is shown");
    await shot(missing.page, "design-save-menu-1440.png");
    await missing.page.keyboard.press("Escape");
    await missing.context.close();

    for (const width of WIDTHS) {
      const session = await openDesign(browser, {
        install: "installed",
        width,
        height: width < 800 ? 900 : 1000,
      });
      const { page } = session;
      const installed = await page.locator("body").innerText();
      if (!installed.includes("Theme Customizer installed"))
        fail(`${width} missing installed banner`);
      if (installed.includes("Accent")) fail(`${width} Accent is visible`);
      await selectStyle(page, "Classic");
      await page
        .getByTestId("design-dirty")
        .filter({ hasText: "1 unsaved change: Sidebar style" })
        .waitFor();
      await page
        .getByTestId("design-save-bar")
        .filter({ hasText: "You have 1 unsaved change: Sidebar style" })
        .waitFor();
      await assertFit(page, `${width} style`);
      if (width === 375 || width === 1440 || width === 768 || width === 1920) {
        await shot(page, `design-style-${width}.png`);
      }

      await page.getByTestId("design-tab-layout").click();
      await page.getByText("Client Hub layout", { exact: true }).waitFor();
      await page.getByRole("radio", { name: /The Video Library/ }).click();
      await assertFit(page, `${width} layout`);
      if (width === 375 || width === 1440) await shot(page, `design-layout-${width}.png`);

      await page.getByTestId("design-tab-widgets").click();
      await page.getByText("Popup & help widgets", { exact: true }).waitFor();
      await assertFit(page, `${width} widgets`);
      if (width === 375 || width === 1440) await shot(page, `design-widgets-${width}.png`);
      const popup = page.getByRole("switch", { name: "Bottom right chat popup" });
      const before = await popup.getAttribute("data-state");
      await popup.click();
      const after = await popup.getAttribute("data-state");
      if (before === after) fail(`${width} popup switch did not change`);
      await popup.click();
      const help = page.getByRole("switch", { name: "Top navigation help widget" });
      const helpBefore = await help.getAttribute("data-state");
      await help.click();
      if ((await help.getAttribute("data-state")) === helpBefore) {
        fail(`${width} help widget switch did not change`);
      }
      await help.click();

      await page.getByTestId("design-tab-advanced").click();
      await page.getByText("Login Page Customization", { exact: true }).waitFor();
      await page.getByRole("switch", { name: "Login page customization" }).click();
      await page.getByText("Login & Top Button Color").waitFor();
      await page.getByRole("switch", { name: "Mobile branding" }).click();
      await page.getByText("Menu Widget Color", { exact: true }).waitFor();
      await page.getByText("Zoom Controls (+ / − / %)", { exact: true }).waitFor();
      await assertFit(page, `${width} advanced`);
      if (width === 375 || width === 1440) await shot(page, `design-advanced-${width}.png`);

      if (width === 414 || width === 1280) {
        await shot(page, `design-advanced-${width}.png`);
      }

      if (session.pageErrors.length)
        fail(`${width} page errors: ${session.pageErrors.join(" | ")}`);
      await session.context.close();
    }

    const flow = await openDesign(browser, { install: "installed", width: 1440, height: 1000 });
    const { page } = flow;
    const turnOff = page.getByTestId("design-turn-off-branding");
    await turnOff.waitFor();
    if (await page.getByRole("button", { name: "Remove branding" }).count()) {
      fail("Remove branding is still on the page");
    }
    await page.getByTestId("design-tab-advanced").click();
    await page.getByRole("button", { name: "Sidebar details" }).click();
    if (await page.getByRole("button", { name: "Remove branding" }).count()) {
      fail("Remove branding is still inside Sidebar details");
    }
    await page.getByTestId("design-tab-style").click();
    await turnOff.click();
    await page.getByRole("alertdialog", { name: "Are you sure?" }).waitFor();
    await shot(page, "design-turn-off-confirm-1440.png");
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("alertdialog").waitFor({ state: "hidden" });
    if (!(await turnOff.isVisible())) fail("cancel hid Turn off branding");
    await turnOff.click();
    await page.getByTestId("design-turn-off-branding-confirm").click();
    await page.getByText("Customization removed").waitFor({ timeout: 15000 });
    await page.getByTestId("design-dirty").filter({ hasText: "All changes saved" }).waitFor();
    if (await page.getByTestId("design-save-bar").count()) {
      fail("turn off branding left a save bar that would re-apply the sidebar");
    }
    await turnOff.waitFor({ state: "detached" });
    await shot(page, "design-branding-off-1440.png");
    await selectStyle(page, "Classic");
    await page.getByTestId("design-discard").click();
    await page.getByTestId("design-dirty").filter({ hasText: "All changes saved" }).waitFor();
    if (await page.getByTestId("design-save-bar").count()) fail("discard left the save bar up");

    await selectStyle(page, "Minimalist");
    await page
      .getByTestId("design-dirty")
      .filter({ hasText: "1 unsaved change: Sidebar style" })
      .waitFor();
    await page.getByTestId("design-save").click();
    await page
      .getByTestId("design-dirty")
      .filter({ hasText: "All changes saved" })
      .waitFor({ timeout: 15000 });

    await page.getByTestId("design-save-menu").click();
    await page.getByRole("menuitem", { name: /Agency default/ }).click();
    await page
      .getByText("Preset loaded")
      .waitFor({ timeout: 10000 })
      .catch(() => {});
    const afterPreset = await page.getByTestId("design-dirty").innerText();
    if (!afterPreset.includes("unsaved"))
      fail(`preset load did not dirty the draft: ${afterPreset}`);
    if (afterPreset.includes("Accent")) fail("preset dirty text names Accent");
    if (afterPreset.includes("Simple sidebar gradient")) {
      fail(`preset load counted an off gradient: ${afterPreset}`);
    }
    const warning = page.getByText("Required before saving");
    if (await warning.count()) {
      await page.getByRole("checkbox").check();
    }
    await page.getByTestId("design-save").click();
    await page
      .getByTestId("design-dirty")
      .filter({ hasText: "All changes saved" })
      .waitFor({ timeout: 15000 });

    await page.getByTestId("design-tab-layout").click();
    await page.getByRole("radio", { name: /The Split View/ }).click();
    await page.getByTestId("design-save").click();
    await page.getByText("Layout set to").waitFor({ timeout: 10000 });
    await page
      .getByTestId("design-dirty")
      .filter({ hasText: "All changes saved" })
      .waitFor({ timeout: 15000 });

    await page
      .getByTestId("design-page")
      .getByRole("button", { name: "Simplified Onboarding" })
      .click();
    await page.waitForURL(/\/app\/simple-onboarding/);
    await page.goBack();
    await page.getByTestId("design-page").waitFor();

    await page.getByTestId("design-tab-widgets").click();
    await page.getByPlaceholder("Help & Support").fill("Help");
    await page.getByLabel("Card title").fill("Need a hand?");
    await page
      .getByTestId("design-dirty")
      .filter({ hasText: "Top navigation help widget" })
      .waitFor();

    await page.getByTestId("design-tab-advanced").click();
    await page.getByRole("switch", { name: "Login page customization" }).click();
    await page.getByRole("button", { name: "Green", exact: true }).click();
    await page.getByText("Login & Top Button Color", { exact: true }).waitFor();
    await page.getByRole("switch", { name: "Top button customization" }).click();
    await page.getByRole("switch", { name: "Custom top button gradient" }).click();
    await page.getByText("Top Gradient Start", { exact: true }).waitFor();
    await page.getByRole("switch", { name: "Mobile branding" }).click();
    await page.getByRole("switch", { name: "Zoom Controls (+ / − / %)" }).click();
    await page.getByRole("button", { name: "Sidebar details" }).click();
    await page.getByText("Highlight color", { exact: true }).waitFor();
    await page.getByText("Sidebar background", { exact: true }).waitFor();
    await page.getByRole("combobox", { name: "Icon style" }).click();
    await page.getByRole("option", { name: "Phosphor", exact: true }).click();
    await page.getByRole("switch", { name: "Navigation animations" }).click();
    const gradient = page.getByRole("switch", { name: "Simple sidebar gradient" });
    if (await gradient.count()) await gradient.click();
    const dirty = await page.getByTestId("design-dirty").innerText();
    if (dirty.includes("Accent")) fail(`advanced edits named Accent: ${dirty}`);
    if (!dirty.includes("unsaved")) fail(`advanced edits did not dirty the page: ${dirty}`);
    await page.getByTestId("design-save").click();
    await page
      .getByTestId("design-dirty")
      .filter({ hasText: "All changes saved" })
      .waitFor({ timeout: 20000 });

    await page.getByTestId("design-tab-style").click();
    await page.getByRole("link", { name: /Edit in Settings/ }).click();
    await page.waitForURL(/\/app\/settings/);
    if (flow.pageErrors.length) fail(`flow page errors: ${flow.pageErrors.join(" | ")}`);
    await flow.context.close();

    const sizes = [
      [375, 812],
      [414, 896],
      [768, 1024],
      [1280, 800],
      [1920, 1080],
    ];
    for (const [width, height] of sizes) {
      const session = await openDesign(browser, { install: "installed", width, height });
      const { page } = session;
      await page.getByRole("button", { name: "Why?" }).click();
      await page.getByText("Update your HighLevel Custom JS", { exact: true }).waitFor();
      await page.getByText("Leave your Custom CSS line as it is.").waitFor();
      if (width === 1280) {
        await page.screenshot({ path: path.join(OUT, "qa-install-note-1280.png") });
      }

      await page.getByTestId("design-tab-advanced").click();
      await page.getByRole("button", { name: "Sidebar details" }).click();
      await page.locator('[id="color-Highlight color"]').fill("#ff00aa");
      await page
        .getByTestId("design-dirty")
        .filter({ hasText: "1 unsaved change: Login & top button color" })
        .waitFor();
      const highlight = await page.getByTestId("design-dirty").innerText();
      if (highlight.includes("Simple sidebar gradient")) {
        fail(`${width} highlight badge counted the gradient: ${highlight}`);
      }
      await page.getByRole("button", { name: "Undo color change" }).click();
      await page.getByTestId("design-dirty").filter({ hasText: "All changes saved" }).waitFor();

      await page.locator('[id="color-Sidebar background"]').fill("#eeeeee");
      await page
        .getByTestId("design-dirty")
        .filter({ hasText: "1 unsaved change: Sidebar background" })
        .waitFor();
      const background = await page.getByTestId("design-dirty").innerText();
      if (background.includes("Simple sidebar gradient")) {
        fail(`${width} background badge counted the gradient: ${background}`);
      }

      await page.getByTestId("design-tab-style").click();
      await selectStyle(page, "Classic");
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        const main = document.querySelector("main");
        if (main) main.scrollTop = 0;
      });
      const hitBack = () =>
        page.evaluate(() => {
          const button = document.querySelector("[data-testid='design-back']");
          const message = document.querySelector("[data-testid='design-save-bar'] p");
          if (!button) return { ok: false, reason: "missing" };
          const rect = button.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const inView =
            rect.width > 0 &&
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth;
          const hit = document.elementFromPoint(cx, cy);
          return {
            ok: inView && !!hit && (hit === button || button.contains(hit)),
            inView,
            hit: hit ? `${hit.tagName}:${(hit.innerText || "").trim().slice(0, 40)}` : null,
            cx,
            cy,
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            truncated: message ? message.scrollWidth > message.clientWidth + 2 : true,
            text: message?.innerText || "",
            scrollWidth: message?.scrollWidth ?? 0,
            clientWidth: message?.clientWidth ?? 0,
          };
        });
      const atTop = await hitBack();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const atEnd = await hitBack();
      if (!atTop.ok)
        fail(`${width}x${height} Back is not clickable at the top ${JSON.stringify(atTop)}`);
      if (!atEnd.ok)
        fail(`${width}x${height} Back is not clickable when scrolled ${JSON.stringify(atEnd)}`);
      if (width < 640 && atTop.truncated) {
        fail(
          `${width} save message truncated ${atTop.scrollWidth}>${atTop.clientWidth} (${atTop.text})`,
        );
      }
      if (!atTop.text.includes("Sidebar style"))
        fail(`${width} bar message dropped the change name`);
      if (width === 375 || width === 1280) {
        await page.screenshot({ path: path.join(OUT, `qa-save-bar-${width}.png`) });
      }
      await page.mouse.click(atEnd.cx, atEnd.cy);
      try {
        await page.waitForURL(/\/app\/client-hub/, { timeout: 5000 });
      } catch {
        fail(`${width}x${height} elementFromPoint click on Back did not open Client Hub`);
      }
      await session.context.close();
    }

    const cookie = await openDesign(browser, {
      install: "installed",
      width: 375,
      height: 812,
      cookies: "show",
    });
    await selectStyle(cookie.page, "Classic");
    await cookie.page.getByRole("region", { name: "Cookie notice" }).waitFor({ timeout: 5000 });
    try {
      await cookie.page.waitForFunction(
        () => {
          const notice = document
            .querySelector('[aria-label="Cookie notice"]')
            ?.getBoundingClientRect();
          const bar = document
            .querySelector("[data-testid='design-save-bar']")
            ?.getBoundingClientRect();
          if (!notice || !bar) return false;
          return bar.bottom <= notice.top + 1;
        },
        { timeout: 4000 },
      );
    } catch {
      fail("cookie notice overlaps the save bar at 375");
    }
    await cookie.page.screenshot({ path: path.join(OUT, "qa-cookie-375.png") });
    await cookie.context.close();

    for (const [width, height] of [
      [375, 812],
      [414, 896],
    ]) {
      const session = await openDesign(browser, { install: "installed", width, height });
      const { page } = session;
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
      const sheet = page.getByRole("dialog", { name: "Sidebar" });
      await sheet.waitFor();
      await sheet.getByRole("button", { name: "Dashboard", exact: true }).click();
      await page.waitForURL(/\/app\/dashboard/);
      await page.goBack();
      await page.waitForURL(/\/app\/branding/);
      await page.getByTestId("design-page").waitFor();
      try {
        await sheet.waitFor({ state: "hidden", timeout: 3000 });
      } catch {
        fail(`${width} mobile sheet still open after browser Back`);
      }
      await page.getByRole("button", { name: "Back", exact: true }).waitFor();
      if (width === 375) {
        await page.screenshot({ path: path.join(OUT, "qa-sheet-closed-375.png") });
      }
      await session.context.close();
    }
  } finally {
    await browser.close();
  }
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const launches = [
    ["chromium", () => chromium.launch({ headless: true, executablePath: "/opt/pw-browsers/chromium" })],
    
  ];
  for (const [name, launch] of launches) {
    engine = name;
    const browser = await launch();
    await main(browser);
  }
  if (failures.length) {
    console.error(`\n${failures.length} failure(s)`);
    process.exit(1);
  }
  console.log("Design page walkthrough passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
