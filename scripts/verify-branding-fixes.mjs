/**
 * Headless check of the Design save fixes, preset clean-up, More Tools sidebar
 * links and the resizable Copilot panel.
 * Requires the dev server in mock mode, which never talks to the live project:
 *   VITE_PLATFORM_MOCK=1 npx vite dev --host 127.0.0.1 --port 5199
 *   node scripts/verify-branding-fixes.mjs
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const { chromium } = createRequire(import.meta.url)("playwright");
const ORIGIN = process.env.APP_ORIGIN || "http://127.0.0.1:5199";
const OUT = process.env.SHOTS_DIR || "screenshots/branding-fixes";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function setColor(page, label, hex) {
  const input = page.getByLabel(label, { exact: false }).last();
  await input.fill(hex);
  await input.press("Enter");
  await input.blur();
}

/** Toasts sit over the bottom-right corner; move away and let them clear before the next click. */
async function clearToasts(page) {
  await page.mouse.move(700, 300);
  await page
    .waitForFunction(() => !document.querySelector("[data-sonner-toast]"), null, { timeout: 15000 })
    .catch(() => {});
}

async function presetNames(page) {
  await clearToasts(page);
  await page.getByTestId("design-save-menu").click();
  const menu = page.getByRole("menu");
  await menu.waitFor();
  const names = await menu.locator("[role='menuitem'] span.truncate").allInnerTexts();
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "hidden" });
  return names.map((name) => name.trim());
}

// Set CHROMIUM_PATH when the installed Playwright does not match the local browser build.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
// UI=new runs the same walkthrough in the new UI (design system + rebuilt sidebar).
await context.addInitScript((ui) => {
  localStorage.setItem("ss_tours_disabled_v1:agency@example.com", "1");
  localStorage.setItem("ss_cookie_notice_ack", "1");
  if (ui === "new") localStorage.setItem("ss_ui_version", "new");
}, process.env.UI || "old");
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("dialog", (dialog) => void dialog.accept());
await mkdir(OUT, { recursive: true });
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

await page.goto(`${ORIGIN}/app/branding`, { waitUntil: "domcontentloaded" });
await page.getByTestId("design-page").waitFor({ timeout: 30000 });
await page.getByText("Brand colors", { exact: true }).waitFor();

// 1. Sidebar: tools that used to be search-only now have links.
for (const name of [
  "Simplified Onboarding",
  "Knowledge Base",
  "Onboarding Calls",
  "Agency Support",
]) {
  const item = page.locator("[data-sidebar='menu-button']", { hasText: name });
  if (name === "Agency Support") await item.scrollIntoViewIfNeeded().catch(() => {});
  check(`sidebar shows "${name}"`, (await item.count()) > 0);
}
await shot("01-sidebar-more-tools");

// 2. A blocked Save explains itself instead of being a dead grey button.
const before = await presetNames(page);
await setColor(page, "Sidebar background", "#111827");
const bar = page.getByTestId("design-save-bar");
await bar.waitFor();
const barSave = bar.getByRole("button", { name: "Save changes" });
check("blocked save: the Save button stays clickable", await barSave.isEnabled());
check(
  "blocked save: the bar says what is required",
  (await bar.innerText()).includes("Required before saving"),
);
const bubbleBox = await page.getByRole("button", { name: "Open SaaSSuite Copilot" }).boundingBox();
const closedSaveBox = await barSave.boundingBox();
check(
  "Save button is not covered by the floating Copilot button",
  closedSaveBox.x + closedSaveBox.width <= bubbleBox.x,
  `button ends ${Math.round(closedSaveBox.x + closedSaveBox.width)}px, Copilot button starts ${Math.round(bubbleBox.x)}px`,
);
await shot("02-save-blocked-explained");
await barSave.click();
await page
  .getByText("Confirm the sidebar mode note before saving.")
  .first()
  .waitFor({ timeout: 5000 });
check("blocked save: clicking Save shows the reason", true);
check("blocked save: nothing is marked saved", await bar.isVisible());
const confirmBox = page.locator("#design-sidebar-confirm");
check("blocked save: the required checkbox is scrolled into view", await confirmBox.isVisible());
await confirmBox.getByRole("checkbox").click();
await clearToasts(page);
await barSave.click();
await page.getByText("All changes saved").first().waitFor({ timeout: 15000 });
check("save succeeds once the box is ticked", true);
await shot("03-saved");

// 3. Presets: one rolling automatic backup, same-name saves replace, delete works.
await clearToasts(page);
await setColor(page, "Highlight color", "#2563eb");
await bar.waitFor();
await bar.getByRole("button", { name: "Save changes" }).click();
await page.getByText("All changes saved").first().waitFor({ timeout: 15000 });
await clearToasts(page);
await setColor(page, "Highlight color", "#db2777");
await bar.waitFor();
await bar.getByRole("button", { name: "Save changes" }).click();
await page.getByText("All changes saved").first().waitFor({ timeout: 15000 });
let names = await presetNames(page);
const autos = names.filter((name) => name.startsWith("Previous setup"));
check(
  "three saves leave exactly one automatic backup",
  autos.length === 1,
  `presets: ${names.join(" | ")}`,
);
check(
  "named presets survive",
  before.every((name) => names.includes(name)),
);

for (let i = 0; i < 2; i += 1) {
  await clearToasts(page);
  await page.getByTestId("design-save-menu").click();
  await page.getByRole("menuitem", { name: "Save as preset…" }).click();
  await page.getByLabel("Preset name").fill("QA preset");
  await page.getByRole("button", { name: "Save preset" }).click();
  await page
    .getByText(/Preset (saved|"QA preset" updated)/)
    .first()
    .waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
}
names = await presetNames(page);
check(
  "saving the same preset name twice keeps one copy",
  names.filter((name) => name === "QA preset").length === 1,
  `presets: ${names.join(" | ")}`,
);

await clearToasts(page);
await page.getByTestId("design-save-menu").click();
await page.getByRole("menu").waitFor();
await shot("04-preset-menu-with-delete");
await page.getByRole("button", { name: "Delete preset QA preset" }).click();
await page.getByText('Preset "QA preset" deleted').first().waitFor({ timeout: 15000 });
await page.keyboard.press("Escape");
names = await presetNames(page);
check("a preset can be deleted", !names.includes("QA preset"), `presets: ${names.join(" | ")}`);

// 4. Copilot: the docked panel can be resized and no longer covers the Save bar.
await clearToasts(page);
await page.getByRole("button", { name: "Open SaaSSuite Copilot" }).click();
const panel = page.locator("[data-copilot-panel='dock']");
await panel.waitFor();
const handle = page.getByTestId("copilot-resize-handle");
const startWidth = (await panel.boundingBox()).width;
const grip = await handle.boundingBox();
await page.mouse.move(grip.x + 2, grip.y + grip.height / 2);
await page.mouse.down();
await page.mouse.move(grip.x - 160, grip.y + grip.height / 2, { steps: 8 });
await page.mouse.up();
const wide = (await panel.boundingBox()).width;
check(
  "Copilot panel gets wider when dragged",
  wide > startWidth + 120,
  `${Math.round(startWidth)}px → ${Math.round(wide)}px`,
);

await setColor(page, "Highlight color", "#16a34a");
await bar.waitFor();
const panelBox = await panel.boundingBox();
const saveBox = await bar.getByRole("button", { name: "Save changes" }).boundingBox();
check(
  "Save button is not hidden under the Copilot panel",
  saveBox.x + saveBox.width <= panelBox.x + 1,
  `button ends ${Math.round(saveBox.x + saveBox.width)}px, panel starts ${Math.round(panelBox.x)}px`,
);
const pageRight = await page
  .getByTestId("design-page")
  .evaluate((node) => node.getBoundingClientRect().right);
check(
  "page content stops at the Copilot panel",
  pageRight <= panelBox.x + 1,
  `content ends ${Math.round(pageRight)}px`,
);
await shot("05-copilot-wide-save-bar-visible");

const grip2 = await handle.boundingBox();
await page.mouse.move(grip2.x + 2, grip2.y + 200);
await page.mouse.down();
await page.mouse.move(1440 - 100, grip2.y + 200, { steps: 8 });
await page.mouse.up();
const narrow = (await panel.boundingBox()).width;
check("Copilot panel shrinks but stops at its minimum", narrow === 320, `${Math.round(narrow)}px`);
await shot("06-copilot-narrow");

await handle.dblclick();
check("double-click resets the Copilot width", (await panel.boundingBox()).width === 380);
await handle.focus();
await page.keyboard.press("ArrowLeft");
check("arrow keys resize the Copilot panel", (await panel.boundingBox()).width === 404);
const stored = await page.evaluate(() => localStorage.getItem("copilot_dock_width"));
check("the chosen width is remembered", stored === "404", `stored ${stored}`);

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((result) => !result.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
