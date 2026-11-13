/**
 * Headless Chrome checks for the HighLevel top-nav Help & Support widget.
 * Serves a mocked top bar + sidebar, exercises both open modes, then
 * optionally screenshots the Design page editor.
 *
 *   bun scripts/verify-top-nav-widget.ts
 *   DESIGN_URL=http://127.0.0.1:8080/app/branding bun scripts/verify-top-nav-widget.ts
 */
import { createServer, type ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import puppeteer, { type Browser, type Page } from "puppeteer";
import { buildTopNavWidgetJS } from "../supabase/functions/dynamic-styles/top-nav-widget.ts";

const OUT = "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const options = [
  {
    id: "live-support",
    label: "Chat with us",
    description: "Opens the chat popup",
    icon: "chat",
    visible: true,
    openMode: "embed" as const,
    target: "/support-chat",
  },
  {
    id: "help-library",
    label: "Guides",
    description: "How-to videos and articles",
    icon: "book",
    visible: true,
    openMode: "tab" as const,
    target: "/education",
  },
  {
    id: "open-ticket",
    label: "Request help",
    description: "We'll follow up by email",
    icon: "ticket",
    visible: false,
    openMode: "embed" as const,
    target: "/support-ticket",
  },
];

function pageHtml(port: number) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HighLevel mock</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #f4f6f8; color: #101828; }
    .app { display: flex; min-height: 100vh; }
    #sidebar-v2 { width: 232px; background: #101828; color: #fff; padding: 18px 12px; flex: none; }
    #sidebar-v2 strong { display: block; padding: 8px; font-size: 14px; }
    #sidebar-v2 a { display: block; color: #d0d5dd; text-decoration: none; padding: 10px 8px; border-radius: 8px; font-size: 14px; }
    section.main { flex: 1; min-width: 0; }
    .hl_header { height: 56px; background: #fff; border-bottom: 1px solid #e4e7ec; }
    .container-fluid { height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; gap: 12px; }
    .hl_header--controls { display: flex; align-items: center; gap: 8px; }
    .location-row { align-items: flex-start; height: 40px; padding-top: 6px; box-sizing: border-box; }
    .location-row .ghl-icon { height: 28px; }
    .shimmer { display: block; width: 120px; height: 32px; background: #eef2f6; border-radius: 8px; }
    .loc { font-weight: 600; font-size: 14px; }
    .ghl-icon { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e4e7ec; background: #fff; font-size: 12px; }
    main { padding: 24px; }
    .stale { display: none; }
    @media (max-width: 767px) {
      #sidebar-v2 { width: 60px; padding: 12px 8px; }
      #sidebar-v2 strong, #sidebar-v2 a span { display: none; }
      .hl_header { height: 52px; }
      .loc { font-size: 13px; }
    }
  </style>
</head>
<body>
  <div class="app sidebar-v2-location">
    <aside id="sidebar-v2">
      <strong>North Clinic</strong>
      <nav>
        <a><span>Dashboard</span></a>
        <a><span>Conversations</span></a>
        <a><span>Calendars</span></a>
        <a><span>Payments</span></a>
      </nav>
    </aside>
    <section class="main">
      <div id="header-mount">
        <header class="hl_header hl_header--placeholder" id="placeholder-header">
          <div class="container-fluid">
            <div class="hl_header--controls"><span class="shimmer"></span></div>
            <div class="hl_header--controls"><span class="shimmer"></span></div>
          </div>
        </header>
      </div>
      <main>
        <h1>Sub-account</h1>
        <p>Pipeline and conversations stay in HighLevel.</p>
      </main>
    </section>
  </div>
  <header class="hl_header stale" id="stale-header">
    <div class="container-fluid">
      <div class="hl_header--controls"><span>Hidden duplicate</span></div>
      <div class="hl_header--controls"><button class="ghl-icon" type="button">Old</button></div>
    </div>
  </header>
  <script>
    window.__hub = ${JSON.stringify(`http://127.0.0.1:${port}`)};
    function headerMarkup() {
      return '<header class="hl_header" id="live-header"><div class="container-fluid">' +
        '<div class="hl_header--controls" id="left-controls"><span class="loc">North Clinic</span></div>' +
        '<div class="hl_header--controls location-row" id="right-controls">' +
          '<button class="ghl-icon" type="button" id="ghl-search" aria-label="Search">Search</button>' +
          '<button class="ghl-icon" type="button" id="ghl-bell" aria-label="Notifications">Alerts</button>' +
          '<button class="ghl-icon" type="button" id="ghl-help" aria-label="HighLevel help">?</button>' +
          '<button class="ghl-icon" type="button" id="ghl-avatar" aria-label="Account">AQ</button>' +
        '</div></div></header>';
    }
    window.mountHeader = function () {
      document.getElementById('header-mount').innerHTML = headerMarkup();
    };
  </script>
  <script>document.write('<scr' + 'ipt src="/widget.js' + location.search + '"></scr' + 'ipt>');</script>
</body>
</html>`;
}

const educationHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Help Library</title>
<style>body{margin:0;font-family:system-ui;background:#fff;color:#101828}main{padding:48px;max-width:720px}h1{font-size:32px}</style>
</head><body><main><p>Opened in a new tab</p><h1>Help Library</h1><p>This is the Client Hub guides page for the option set to open in a new tab.</p></main></body></html>`;

function overlaps(a: DOMRect, b: DOMRect) {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 1 && y > 1;
}

async function widgetState(page: Page) {
  return page.evaluate(() => {
    const hosts = Array.from(document.querySelectorAll("#support-widget-launcher-host"));
    const host = hosts[0] as HTMLElement | undefined;
    const search = document.getElementById("ghl-search");
    const header = document.getElementById("live-header");
    const right = document.getElementById("right-controls");
    const stale = document.getElementById("stale-header");
    const label = host?.shadowRoot?.querySelector(".lbl") as HTMLElement | null;
    const button = host?.shadowRoot?.querySelector(".launch") as HTMLElement | null;
    const names = Array.from(document.querySelectorAll("#support-widget-panel-host")).flatMap(
      (panel) => {
        const root = (panel as HTMLElement).shadowRoot;
        return Array.from(root?.querySelectorAll(".name") || []).map(
          (node) => node.textContent || "",
        );
      },
    );
    const popup = document.querySelector(".lvb-panel") as HTMLElement | null;
    const frame = popup?.querySelector("iframe");
    const menu = document.getElementById("support-widget-panel-host");
    return {
      count: hosts.length,
      inRight: !!host && right?.firstElementChild === host,
      inStale: !!host && !!stale?.contains(host),
      compact: host?.getAttribute("data-compact") || "",
      labelDisplay: label ? getComputedStyle(label).display : "",
      labelText: label?.textContent || "",
      names,
      cardSubtitle:
        document.getElementById("support-widget-panel-host")?.shadowRoot?.querySelector(".sub")
          ?.textContent || "",
      button: button ? button.getBoundingClientRect().toJSON() : null,
      search: search ? search.getBoundingClientRect().toJSON() : null,
      header: header ? header.getBoundingClientRect().toJSON() : null,
      popupOpen: popup?.classList.contains("lvb-open") || false,
      popupZ: popup ? getComputedStyle(popup).zIndex : "",
      menuZ: menu ? getComputedStyle(menu).zIndex : "",
      frameSrc: frame?.getAttribute("src") || "",
      panelCount: document.querySelectorAll(".lvb-panel").length,
    };
  });
}

async function main() {
  let port = 0;
  let widgetJs = "";
  let agencyWidgetJs = "";
  const server = createServer((req, res: ServerResponse) => {
    const url = req.url || "/";
    if (url.startsWith("/widget.js")) {
      res.writeHead(200, { "content-type": "application/javascript" });
      res.end(url.includes("widget=agency") ? agencyWidgetJs : widgetJs);
      return;
    }
    if (url.startsWith("/popup-sizer")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(
        `<!doctype html><html><body><script>parent.postMessage({ type: "lvb-popup-preferred-size", width: 520, height: 700 }, "*");</script></body></html>`,
      );
      return;
    }
    if (url.startsWith("/education")) {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(educationHtml);
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(pageHtml(port));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  port = address.port;
  widgetJs = buildTopNavWidgetJS("Need help?", "#163a5f", {
    iconColor: "#f4c56d",
    tileColor: "#163a5f",
    hubUrl: `http://127.0.0.1:${port}`,
    hideInEmbed: true,
    agencyId: "lynkific",
    options,
  });
  agencyWidgetJs = buildTopNavWidgetJS("Need help?", "#163a5f", {
    iconColor: "#f4c56d",
    tileColor: "#163a5f",
    hubUrl: `http://127.0.0.1:${port}`,
    hideInEmbed: true,
    showOn: "agency",
    agencyId: "lynkific",
    options,
  });

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-popup-blocking"],
  });
  try {
    if (process.env.DESIGN_ONLY === "1") {
      if (!process.env.DESIGN_URL) throw new Error("DESIGN_URL is required");
      await design(browser, process.env.DESIGN_URL);
    } else {
      await desktop(browser, port);
      await mobile(browser, port);
      await audience(browser, port);
      if (process.env.DESIGN_URL) await design(browser, process.env.DESIGN_URL);
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log("top-nav widget checks passed");
}

function watchConsole(page: Page) {
  const logs: string[] = [];
  page.on("pageerror", (error) => logs.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    if (/favicon|Download the React DevTools/i.test(text)) return;
    logs.push(`${message.type()}:${text}`);
  });
  return logs;
}

async function desktop(browser: Browser, port: number) {
  const page = await browser.newPage();
  const logs = watchConsole(page);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${port}/ghl`, { waitUntil: "load" });
  await page.waitForFunction(
    () => (window as unknown as { __supportWidgetLoaded?: boolean }).__supportWidgetLoaded === true,
  );
  let state = await widgetState(page);
  await new Promise((r) => setTimeout(r, 700));
  state = await widgetState(page);
  if (state.count !== 0)
    throw new Error(`launcher mounted on the header placeholder: ${state.count}`);

  await page.evaluate(() => (window as unknown as { mountHeader: () => void }).mountHeader());
  await page.waitForFunction(() =>
    document.getElementById("right-controls")?.querySelector("#support-widget-launcher-host"),
  );
  await new Promise((r) => setTimeout(r, 400));
  state = await widgetState(page);
  assertDesktop(state, "after late mount");
  await phoneIconDoesNotShift(page);

  await page.evaluate(() => {
    const root = document.getElementById("support-widget-launcher-host")?.shadowRoot;
    root?.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const panel = document
      .getElementById("support-widget-panel-host")
      ?.shadowRoot?.querySelector(".panel");
    return panel?.classList.contains("open");
  });
  state = await widgetState(page);
  if (state.names.join("|") !== "Chat with us|Guides") {
    throw new Error(`menu rows: ${state.names.join("|")}`);
  }
  if (state.cardSubtitle !== "We're here to help") {
    throw new Error(`card subtitle: ${state.cardSubtitle}`);
  }
  await page.screenshot({ path: `${OUT}/help-widget-desktop-menu.png` });

  await page.evaluate(() => {
    const mount = document.getElementById("header-mount");
    if (mount)
      mount.innerHTML =
        (window as unknown as { headerMarkup?: () => string }).headerMarkup?.() || mount.innerHTML;
    // headerMarkup is not global; rebuild via mountHeader.
    (window as unknown as { mountHeader: () => void }).mountHeader();
  });
  await page.waitForFunction(
    () => document.querySelectorAll("#support-widget-launcher-host").length === 1,
  );
  await new Promise((r) => setTimeout(r, 1200));
  state = await widgetState(page);
  assertDesktop(state, "after route change");
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.src = "/widget.js?again=1";
    document.body.appendChild(script);
  });
  await new Promise((r) => setTimeout(r, 500));
  state = await widgetState(page);
  if (state.count !== 1) throw new Error(`duplicate after re-inject: ${state.count}`);

  await page.evaluate(() => {
    const root = document.getElementById("support-widget-launcher-host")?.shadowRoot;
    const button = root?.querySelector("button");
    if (button && button.getAttribute("aria-expanded") !== "true") {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    const row = document
      .getElementById("support-widget-panel-host")
      ?.shadowRoot?.querySelector('[data-action="live-support"]') as HTMLButtonElement | null;
    row?.click();
  });
  await page.waitForFunction(() => document.querySelector(".lvb-panel.lvb-open"));
  await assertMenuClosed(page, "after embed option");
  state = await widgetState(page);
  if (!state.frameSrc.includes("tab=support-chat")) throw new Error(`embed src ${state.frameSrc}`);
  if (!(Number(state.menuZ) < Number(state.popupZ))) {
    throw new Error(`z-index menu ${state.menuZ} popup ${state.popupZ}`);
  }
  if (state.panelCount !== 1) throw new Error(`popup panels ${state.panelCount}`);
  await page.screenshot({ path: `${OUT}/help-widget-desktop-embed.png` });
  await page.evaluate(() => {
    const frame = document.querySelector(".lvb-panel iframe") as HTMLIFrameElement | null;
    if (frame) frame.src = "/popup-sizer";
  });
  await page.waitForFunction(() => {
    const panel = document.querySelector(".lvb-panel") as HTMLElement | null;
    if (!panel) return false;
    const box = panel.getBoundingClientRect();
    return Math.abs(box.width - 520) < 2 && Math.abs(box.height - 700) < 2;
  });
  await page.setViewport({ width: 320, height: 500 });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.waitForFunction(() => {
    const panel = document.querySelector(".lvb-panel") as HTMLElement | null;
    if (!panel) return false;
    const box = panel.getBoundingClientRect();
    return Math.abs(box.width - 280) < 2 && Math.abs(box.height - 460) < 2;
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));

  await page.evaluate(() => {
    (window as unknown as { SaaSSuitePopup?: { open: (d: unknown) => void } }).SaaSSuitePopup = {
      open(detail: unknown) {
        (window as unknown as { __embedDetail?: unknown }).__embedDetail = detail;
      },
    };
  });
  await page.evaluate(() => {
    const root = document.getElementById("support-widget-launcher-host")?.shadowRoot;
    root?.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForFunction(() =>
    document
      .getElementById("support-widget-panel-host")
      ?.shadowRoot?.querySelector(".panel")
      ?.classList.contains("open"),
  );
  await page.evaluate(() => {
    const row = document
      .getElementById("support-widget-panel-host")
      ?.shadowRoot?.querySelector('[data-action="live-support"]') as HTMLButtonElement | null;
    row?.click();
  });
  const detail = await page.evaluate(
    () => (window as unknown as { __embedDetail?: { tab?: string } }).__embedDetail,
  );
  if (detail?.tab !== "support-chat")
    throw new Error(`SaaSSuitePopup.open detail ${JSON.stringify(detail)}`);

  const opened = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("new tab did not open")), 8000);
    browser.on("targetcreated", async (target) => {
      if (target.type() !== "page") return;
      const openedPage = await target.page();
      if (!openedPage) return;
      try {
        await openedPage.waitForFunction(() => location.pathname.includes("education"), {
          timeout: 5000,
        });
      } catch {
        return;
      }
      clearTimeout(timer);
      resolve(openedPage.url());
    });
  });
  await page.evaluate(() => {
    const root = document.getElementById("support-widget-launcher-host")?.shadowRoot;
    const button = root?.querySelector("button");
    if (button && button.getAttribute("aria-expanded") !== "true") {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    const row = document
      .getElementById("support-widget-panel-host")
      ?.shadowRoot?.querySelector('[data-action="help-library"]') as HTMLButtonElement | null;
    row?.click();
  });
  const url = await opened;
  if (!url.endsWith("/education") && !url.includes("/education")) throw new Error(url);
  await assertMenuClosed(page, "after new-tab option");
  const pages = await browser.pages();
  const tab = pages.find((item) => item.url().includes("/education"));
  if (!tab) throw new Error("education tab missing");
  await tab.setViewport({ width: 1440, height: 900 });
  await tab.screenshot({ path: `${OUT}/help-widget-desktop-new-tab.png` });
  if (logs.length) throw new Error(`widget console: ${logs.join(" | ")}`);
  await page.close();
}

async function assertMenuClosed(page: Page, when: string) {
  const menu = await page.evaluate(() => {
    const panel = document
      .getElementById("support-widget-panel-host")
      ?.shadowRoot?.querySelector(".panel");
    const button = document
      .getElementById("support-widget-launcher-host")
      ?.shadowRoot?.querySelector("button");
    return {
      open: !!panel?.classList.contains("open"),
      hidden: panel ? getComputedStyle(panel).visibility === "hidden" : false,
      expanded: button?.getAttribute("aria-expanded") || "",
    };
  });
  if (menu.open || !menu.hidden || menu.expanded !== "false") {
    throw new Error(`${when}: menu stayed open ${JSON.stringify(menu)}`);
  }
}

async function phoneIconDoesNotShift(page: Page) {
  const before = await page.evaluate(() => {
    const host = document.getElementById("support-widget-launcher-host");
    return host ? host.getBoundingClientRect().left : 0;
  });
  await page.evaluate(() => {
    const slot = document.getElementById("right-controls");
    const host = document.getElementById("support-widget-launcher-host");
    if (!slot || !host) return;
    const phone = document.createElement("button");
    phone.className = "ghl-icon";
    phone.id = "ghl-phone";
    phone.type = "button";
    phone.setAttribute("aria-label", "Phone");
    phone.textContent = "Call";
    phone.style.width = "32px";
    slot.insertBefore(phone, host.nextSibling);
  });
  await new Promise((r) => setTimeout(r, 120));
  const after = await page.evaluate(() => {
    const host = document.getElementById("support-widget-launcher-host");
    return host ? host.getBoundingClientRect().left : 0;
  });
  if (Math.abs(after - before) > 4) {
    throw new Error(`phone icon shifted the button from ${before} to ${after}`);
  }
}

function assertDesktop(state: Awaited<ReturnType<typeof widgetState>>, when: string) {
  if (state.count !== 1) throw new Error(`${when}: launcher count ${state.count}`);
  if (!state.inRight)
    throw new Error(`${when}: launcher is not the first item in the right controls`);
  if (state.inStale) throw new Error(`${when}: launcher attached to the hidden header`);
  if (state.compact === "1") throw new Error(`${when}: desktop button collapsed`);
  if (!state.button || !state.search || !state.header) throw new Error(`${when}: missing boxes`);
  if (overlaps(state.button as DOMRect, state.search as DOMRect))
    throw new Error(`${when}: overlaps Search`);
  if (state.button.right > state.header.right + 1 || state.button.left < state.header.left) {
    throw new Error(`${when}: button outside the header`);
  }
  if (state.button.left > state.search.left) throw new Error(`${when}: button is right of Search`);
  const buttonMid = state.button.top + state.button.height / 2;
  const iconMid = state.search.top + state.search.height / 2;
  if (Math.abs(buttonMid - iconMid) > 2) {
    throw new Error(
      `${when}: button is ${Math.abs(buttonMid - iconMid).toFixed(1)}px off the icon row`,
    );
  }
}

async function audience(browser: Browser, port: number) {
  const page = await browser.newPage();
  const logs = watchConsole(page);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:${port}/ghl?widget=agency`, { waitUntil: "load" });
  await page.evaluate(() => (window as unknown as { mountHeader: () => void }).mountHeader());
  await new Promise((r) => setTimeout(r, 800));
  const hidden = await page.evaluate(
    () => document.querySelectorAll("#support-widget-launcher-host").length,
  );
  if (hidden !== 0) throw new Error(`agency-only widget showed in a sub-account (${hidden})`);
  await page.evaluate(() => {
    document.querySelector(".app")?.classList.remove("sidebar-v2-location");
    document.querySelector(".app")?.classList.add("sidebar-v2-agency");
    history.pushState({}, "", "/agency");
  });
  await page.waitForFunction(() =>
    document.getElementById("right-controls")?.querySelector("#support-widget-launcher-host"),
  );
  if (logs.length) throw new Error(`audience console: ${logs.join(" | ")}`);
  await page.close();
}

async function mobile(browser: Browser, port: number) {
  const page = await browser.newPage();
  const logs = watchConsole(page);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`http://127.0.0.1:${port}/ghl?mobile=1`, { waitUntil: "load" });
  await page.evaluate(() => (window as unknown as { mountHeader: () => void }).mountHeader());
  await page.waitForFunction(() =>
    document.getElementById("right-controls")?.querySelector("#support-widget-launcher-host"),
  );
  await new Promise((r) => setTimeout(r, 400));
  let state = await widgetState(page);
  if (state.count !== 1) throw new Error(`mobile count ${state.count}`);
  if (state.compact !== "1") {
    const width = await page.evaluate(() => window.innerWidth);
    throw new Error(`mobile not compact: ${state.compact} innerWidth ${width}`);
  }
  if (state.labelDisplay !== "none") throw new Error(`mobile label display ${state.labelDisplay}`);
  if (!state.button || !state.header || !state.search) throw new Error("mobile boxes missing");
  if (overlaps(state.button as DOMRect, state.search as DOMRect))
    throw new Error("mobile overlaps Search");
  if (state.button.right > state.header.right + 1)
    throw new Error("mobile button overflows the header");
  await page.evaluate(() => {
    document
      .getElementById("support-widget-launcher-host")
      ?.shadowRoot?.querySelector("button")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await page.waitForFunction(() =>
    document
      .getElementById("support-widget-panel-host")
      ?.shadowRoot?.querySelector(".panel")
      ?.classList.contains("open"),
  );
  await page.screenshot({ path: `${OUT}/help-widget-mobile-menu.png` });
  await page.evaluate(() => {
    const row = document
      .getElementById("support-widget-panel-host")
      ?.shadowRoot?.querySelector('[data-action="live-support"]') as HTMLButtonElement | null;
    row?.click();
  });
  await page.waitForFunction(() => document.querySelector(".lvb-panel.lvb-open"));
  await assertMenuClosed(page, "after mobile option");
  state = await widgetState(page);
  if (!state.frameSrc.includes("tab=support-chat"))
    throw new Error(`mobile embed ${state.frameSrc}`);
  await page.screenshot({ path: `${OUT}/help-widget-mobile-embed.png` });
  if (logs.length) throw new Error(`mobile console: ${logs.join(" | ")}`);
  await page.close();
}

async function design(browser: Browser, url: string) {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes("Top Navigation Help Widget"), {
    timeout: 30000,
  });
  await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("body *"));
    const hit = nodes.find(
      (node) =>
        node.textContent?.includes("Menu options") &&
        (node as HTMLElement).innerText?.includes("Chat with us"),
    );
    hit?.scrollIntoView({ block: "center" });
  });
  await new Promise((r) => setTimeout(r, 500));
  const text = await page.evaluate(() => document.body.innerText);
  if (!text.includes("Chat with us") || !text.includes("Open embed") || !text.includes("Guides")) {
    throw new Error("Design editor did not show the saved menu");
  }
  if (
    !text.includes("We're here to help") ||
    !text.includes("Card subtitle") ||
    !text.includes("Show on")
  ) {
    throw new Error("Design editor is missing the card copy or show-on setting");
  }
  if (!text.includes("Sub-accounts and agency view")) {
    throw new Error("Design editor is missing the audience choices");
  }
  if (text.includes("Request help") && !text.includes("Show")) {
    throw new Error("hidden option missing from the editor");
  }
  const card = await page.evaluateHandle(() => {
    const heading = Array.from(document.querySelectorAll("span, h2, p, label")).find(
      (node) => (node.textContent || "").trim() === "Top Navigation Help Widget",
    );
    return heading?.closest("section") || null;
  });
  const element = card.asElement();
  if (!element) throw new Error("could not find the help widget card");
  await element.screenshot({ path: `${OUT}/help-widget-design-editor.png` });
  if (errors.length) throw new Error(`Design page errors: ${errors.join(" | ")}`);
  await page.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
