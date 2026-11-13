import { describe, expect, test } from "bun:test";

const base = process.env.OVERFLOW_BASE || "http://127.0.0.1:8080";

const routes = [
  "/app/dashboard",
  "/app/challenge",
  "/app/client-hub",
  "/app/knowledge-base",
  "/app/simple-onboarding",
  "/app/workflows",
  "/app/support",
  "/app/streamline",
  "/app/branding",
  "/app/learning",
  "/app/community",
  "/app/community/ideas",
  "/app/community/snapshots",
  "/app/community/academy",
  "/app/affiliate-dashboard",
  "/app/onboarding-calls",
  "/app/agency-support",
  "/app/settings",
  "/app/walkthrough",
  "/app/email-warmup",
  "/app/free-leads",
];

let serverUp = false;
try {
  const res = await fetch(`${base}/app/dashboard`, { signal: AbortSignal.timeout(2000) });
  serverUp = res.ok;
} catch {
  serverUp = false;
}

describe.skipIf(!serverUp)("logged-in pages at 390", () => {
  test(
    "do not scroll sideways and keep a single page title",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: true,
        executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(45000);
        await page.setViewport({
          width: 390,
          height: 844,
          deviceScaleFactor: 1,
          isMobile: true,
          hasTouch: true,
        });
        await page.goto(`${base}/app/dashboard`, { waitUntil: "domcontentloaded" });
        await page.evaluate(() => {
          const email = "agency@example.com";
          const done = JSON.stringify({ completed: true, step: 0, dismissals: [] });
          localStorage.setItem(`ss_tour_v1:nav:${email}`, done);
          localStorage.setItem(`ss_tour_v1:hub:${email}`, done);
          localStorage.setItem("setup_help_popup_seen", "1");
          localStorage.setItem("ss_cookie_notice_ack", "1");
          sessionStorage.setItem("onboardingReminderShown", "1");
        });

        const problems: string[] = [];
        for (const route of routes) {
          await page.goto(`${base}${route}`, { waitUntil: "networkidle2", timeout: 45000 });
          await new Promise((resolve) => setTimeout(resolve, 400));
          const report = await page.evaluate(() => {
            const main = document.querySelector("main");
            const h1s = [...document.querySelectorAll("h1")].map((el) => el.textContent?.trim() || "");
            return {
              mainOverflow: main ? main.scrollWidth - main.clientWidth : 0,
              docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              h1s,
            };
          });
          if (report.mainOverflow > 8 || report.docOverflow > 8) {
            problems.push(
              `${route} overflow main ${report.mainOverflow}px document ${report.docOverflow}px`,
            );
          }
          if (report.h1s.length !== 1 || report.h1s[0] === "SaaSSuite") {
            problems.push(`${route} headings ${JSON.stringify(report.h1s)}`);
          }
        }
        expect(problems).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    180000,
  );
});
