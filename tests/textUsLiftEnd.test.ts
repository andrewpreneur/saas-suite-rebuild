import { describe, expect, test } from "bun:test";

const base = process.env.OVERFLOW_BASE || "http://127.0.0.1:8080";

const routes = [
  { path: "/one-feature-kit", bar: "sticky" },
  { path: "/one-feature-kit/checkout", bar: "checkout" },
  { path: "/one-feature-kit/launch-pack", bar: "sticky" },
  { path: "/one-feature-kit/webinar-sales-system", bar: "sticky" },
  { path: "/one-feature-kit/thank-you", bar: "none" },
] as const;

const widths = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
] as const;

let serverUp = false;
try {
  const res = await fetch(`${base}/one-feature-kit`, { signal: AbortSignal.timeout(2000) });
  serverUp = res.ok;
} catch {
  serverUp = false;
}

function localHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
  } catch {
    return false;
  }
}

describe.skipIf(!serverUp)("kit pages scrolled to the document end", () => {
  test(
    "keep painting while the buy bar is up",
    async () => {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: true,
        executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      const problems: string[] = [];
      try {
        const page = await browser.newPage();
        page.setDefaultNavigationTimeout(30000);
        await page.setRequestInterception(true);
        page.on("request", (req) => {
          const url = req.url();
          if (url.startsWith("data:") || url.startsWith("blob:") || localHost(url)) void req.continue();
          else void req.abort();
        });
        await page.evaluateOnNewDocument(() => {
          localStorage.setItem("ss_cookie_notice_ack", "1");
          localStorage.removeItem("ss_tracking_optout");
        });

        for (const size of widths) {
          await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
          for (const route of routes) {
            const label = `${size.width} ${route.path}`;
            try {
              await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
              await page.waitForSelector("footer a[href^='sms:']", { timeout: 15000 });
              await page.evaluate(() => {
                window.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
              });
              if (route.bar === "checkout") {
                await page.waitForFunction(() => {
                  const bar = document.querySelector(".ofk-checkout-sticky");
                  if (!(bar instanceof HTMLElement)) return false;
                  const style = getComputedStyle(bar);
                  const rect = bar.getBoundingClientRect();
                  return style.display !== "none" && style.position === "fixed" && rect.height > 8 && rect.bottom >= window.innerHeight - 2;
                }, { timeout: 8000 });
              } else if (route.bar === "sticky") {
                await page.waitForSelector(".ofk-sticky-cta", { timeout: 15000 });
                await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
                await page.waitForFunction(() => {
                  const bar = document.querySelector(".ofk-sticky-cta");
                  if (!(bar instanceof HTMLElement) || bar.hidden) return false;
                  const style = getComputedStyle(bar);
                  const rect = bar.getBoundingClientRect();
                  return style.display !== "none" && style.position === "fixed" && rect.height > 8 && rect.bottom >= window.innerHeight - 2;
                }, { timeout: 8000 });
              }

              const paint = await Promise.race([
                page.evaluate(() => new Promise<{ frames: number; mutations: number; painted: boolean }>((resolve) => {
                  const footer = document.querySelector("footer");
                  const extra = (() => {
                    if (!(footer instanceof HTMLElement) || !footer.hasAttribute("data-ss-pad")) return 0;
                    const current = Number.parseFloat(footer.style.paddingBottom) || 0;
                    const original = Number.parseFloat(footer.dataset.ssPad || "") || 0;
                    return Math.max(0, current - original);
                  })();
                  const target = Math.max(0, document.documentElement.scrollHeight - extra - window.innerHeight);
                  window.scrollTo(0, target);
                  let mutations = 0;
                  const observer = new MutationObserver((records) => {
                    mutations += records.length;
                  });
                  observer.observe(document.documentElement, {
                    subtree: true,
                    childList: true,
                    attributes: true,
                    attributeFilter: ["style", "class", "hidden"],
                  });
                  const framesWanted = 24;
                  let frames = 0;
                  const step = () => {
                    frames += 1;
                    if (frames >= framesWanted) {
                      observer.disconnect();
                      resolve({ frames, mutations, painted: true });
                      return;
                    }
                    requestAnimationFrame(step);
                  };
                  requestAnimationFrame(step);
                })),
                new Promise<{ frames: number; mutations: number; painted: boolean }>((resolve) => {
                  setTimeout(() => resolve({ frames: 0, mutations: Number.POSITIVE_INFINITY, painted: false }), 4000);
                }),
              ]);

              if (!paint.painted || paint.frames < 24 || paint.mutations > 80) {
                problems.push(`${label} frames ${paint.frames} mutations ${paint.mutations}`);
              }
            } catch (error) {
              const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
              problems.push(`${label} ${message}`);
            }
          }
        }
      } finally {
        await browser.close();
      }
      expect(problems).toEqual([]);
    },
    180000,
  );
});
