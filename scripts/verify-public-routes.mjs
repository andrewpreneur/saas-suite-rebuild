/**
 * Load every public saassuite.ai route in headless Chrome at desktop and mobile.
 * Fails on an uncaught page error or a document response of 400+.
 *
 *   bun scripts/verify-public-routes.mjs http://127.0.0.1:4173
 */
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer";

const base = (process.argv[2] || "http://127.0.0.1:4173").replace(/\/$/, "");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../public/sitemap.xml", import.meta.url), "utf8");

const skip = new Set(["*", "/app", "/admin"]);
const paths = new Set(["/"]);
for (const match of app.matchAll(/path="([^"]+)"/g)) {
  const path = match[1];
  if (!path.startsWith("/") || path.includes(":") || path.includes("*")) continue;
  if ([...skip].some((item) => path === item || path.startsWith(`${item}/`))) continue;
  paths.add(path);
}
for (const match of sitemap.matchAll(/<loc>https:\/\/saassuite\.ai([^<]*)<\/loc>/g)) {
  const path = match[1] || "/";
  if (path.includes("?")) continue;
  paths.add(path);
}

const routes = [...paths].sort();
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const failures = [];
let checked = 0;

async function check(viewport, path) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  try {
    await page.setViewport(viewport);
    const response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 30000 });
    const status = response ? response.status() : 0;
    await new Promise((resolve) => setTimeout(resolve, 400));
    if (status >= 400) errors.push(`HTTP ${status}`);
    if (errors.length) failures.push({ viewport: viewport.name, path, errors });
  } catch (error) {
    failures.push({ viewport: viewport.name, path, errors: [String(error)] });
  } finally {
    checked += 1;
    await page.close();
  }
}

const queue = [];
for (const viewport of viewports) {
  for (const path of routes) queue.push({ viewport, path });
}
const workers = Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const job = queue.shift();
    if (!job) return;
    await check(job.viewport, job.path);
    if (checked % 20 === 0) console.log(`checked ${checked}/${viewports.length * routes.length}`);
  }
});
await Promise.all(workers);
await browser.close();

console.log(`checked ${routes.length} routes x ${viewports.length} viewports`);
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exit(1);
}
console.log("no page errors");
