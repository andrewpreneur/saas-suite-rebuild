import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const outRoot = process.argv[2] || "/opt/cursor/artifacts/platform-before";
const base = process.env.SCREEN_BASE || "http://127.0.0.1:8080";
const label = process.argv[3] || "before";

const pages = [
  ["dashboard", "/app/dashboard"],
  ["challenge", "/app/challenge"],
  ["client-hub", "/app/client-hub"],
  ["knowledge-base", "/app/knowledge-base"],
  ["simple-onboarding", "/app/simple-onboarding"],
  ["workflows", "/app/workflows"],
  ["support", "/app/support"],
  ["streamline", "/app/streamline"],
  ["branding", "/app/branding"],
  ["start-here", "/app/start-here"],
  ["community", "/app/community"],
  ["community-ideas", "/app/community/ideas"],
  ["affiliate-dashboard", "/app/affiliate-dashboard"],
  ["onboarding-calls", "/app/onboarding-calls"],
  ["agency-support", "/app/agency-support"],
  ["settings", "/app/settings"],
  ["walkthrough", "/app/walkthrough"],
  ["email-warmup", "/app/email-warmup"],
  ["free-leads", "/app/free-leads"],
];

const viewports = [
  ["desktop", 1440, 900],
  ["mobile", 390, 844],
];

fs.mkdirSync(outRoot, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const consoleNotes = [];

for (const [vpName, width, height] of viewports) {
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleNotes.push(`${vpName} ${msg.text().slice(0, 240)}`);
  });
  page.on("pageerror", (err) => consoleNotes.push(`${vpName} PAGE ${String(err).slice(0, 240)}`));
  await page.setViewport({
    width,
    height,
    deviceScaleFactor: 1,
    isMobile: width < 768,
    hasTouch: width < 768,
  });
  await page.goto(base + "/app/dashboard", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const email = "agency@example.com";
    const done = JSON.stringify({ completed: true, step: 0, dismissals: [] });
    localStorage.setItem(`ss_tour_v1:nav:${email}`, done);
    localStorage.setItem(`ss_tour_v1:hub:${email}`, done);
    localStorage.setItem("setup_help_popup_seen", "1");
    sessionStorage.setItem("onboardingReminderShown", "1");
  });
  for (const [name, route] of pages) {
    const file = path.join(outRoot, `${label}-${name}-${vpName}.png`);
    try {
      await page.goto(base + route, { waitUntil: "networkidle2", timeout: 45000 });
      await new Promise((r) => setTimeout(r, 800));
      await page.screenshot({ path: file, fullPage: true });
      console.log("ok", file);
      if (vpName === "mobile" && name === "dashboard") {
        const trigger = await page.$("[data-sidebar='trigger']");
        if (trigger) {
          await trigger.click();
          await new Promise((r) => setTimeout(r, 500));
          const drawer = path.join(outRoot, `${label}-nav-drawer-mobile.png`);
          await page.screenshot({ path: drawer, fullPage: false });
          console.log("ok", drawer);
        }
      }
    } catch (error) {
      console.log("fail", name, vpName, error.message);
    }
  }
  await page.close();
}

fs.writeFileSync(path.join(outRoot, "console.txt"), consoleNotes.slice(0, 200).join("\n"));
await browser.close();
console.log("done", outRoot);
