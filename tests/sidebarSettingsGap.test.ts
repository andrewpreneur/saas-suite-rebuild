import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import puppeteer from "puppeteer";
import { buildV2SidebarHeightFix } from "../supabase/functions/dynamic-styles/sidebar-height";

const fix = buildV2SidebarHeightFix("#16a34a");

const ghl = `
  html, body { margin: 0; background: #f4f5f7; }
  #sidebar-v2 { width: 248px; margin: 10px; border: 3px solid #16a34a; border-radius: 15px; background: #fff; box-sizing: border-box; }
  #sidebar-v2 .h-screen { height: 100vh; display: flex; flex-direction: column; }
  #sidebar-v2 .lead-connector { display: flex; flex-direction: column; min-height: 100vh; flex: 1; }
  #sidebar-v2 .hl_nav-settings { position: absolute; left: 0; right: 0; bottom: 0; min-height: 44px; }
  #sidebar-v2 nav a { display: flex; align-items: center; height: 40px; padding: 0 12px; box-sizing: border-box; }
  #sidebar-v2 .hl_nav-header-without-footer > nav,
  #sidebar-v2 .hl_nav-settings > nav { min-height: calc(100vh - 40px); padding-bottom: 220px; box-sizing: border-box; }
  section.main { width: 640px; display: flex; flex-direction: column; height: 800px; }
  .hl_header { height: 56px; flex: 0 0 56px; background: #fff; }
  .hl_wrapper { flex: 1; overflow: auto; }
  #companySettingsPage, .hl_settings--body { min-height: calc(100vh - 20px); padding-bottom: 240px; margin-bottom: 80px; }
  .card { height: 220px; margin: 16px; background: #fff; }
`;

function pageHtml(body: string) {
  return `<!doctype html><html><head><style>${ghl}${fix}</style></head><body>${body}</body></html>`;
}

describe("Settings bottom gap", () => {
  test("the one-link footer stays pinned and Settings drops the footer spacer", () => {
    expect(fix).toContain("flex: 0 0 auto !important;");
    expect(fix).toContain("#sidebar-v2 .hl_nav-settings:is(:has(a ~ a), :has(> nav > :nth-child(2))):not(:has(:is(#sb_settings, #sb_location-settings, #sb_agency-settings))) {");
    expect(fix).toContain("flex: 1 1 auto !important;");
    expect(fix).toContain("#companySettingsPage,\n.companySettingsPage,\n.hl_settings--body,\n.hl_settings--main {");
    const theme = readFileSync("public/theme-builder.js", "utf8");
    expect(theme).toContain(".hl_nav-settings:is(:has(a ~ a),:has(> nav > :nth-child(2))):not(:has(:is(#sb_settings,#sb_location-settings,#sb_agency-settings))){flex:1 1 auto!important");
    expect(theme).toContain("if (settingsMenu) { clearFootPad(sb); return; }");
  });

  test("Settings no longer scrolls into a footer-sized blank band", async () => {
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 });

      await page.setContent(pageHtml(`
        <aside id="sidebar-v2" class="hl_fixed-width">
          <div class="h-screen"><div class="lead-connector">
            <div class="hl_nav-header-without-footer"><nav>
              <a>Go Back</a><a>My Profile</a><a>Billing</a><a>Users</a>
              <a>Calendars</a><a>Phone System</a><a>Custom Fields</a><a>Import Data</a>
            </nav></div>
          </div></div>
        </aside>
      `), { waitUntil: "load" });
      const menu = await page.evaluate(() => {
        const list = document.querySelector(".hl_nav-header-without-footer > nav") as HTMLElement;
        const last = list.querySelector("a:last-child") as HTMLElement;
        return list.scrollHeight - (last.offsetTop + last.offsetHeight);
      });
      expect(menu).toBeLessThan(24);

      await page.setContent(pageHtml(`
        <aside id="sidebar-v2" class="hl_fixed-width">
          <div class="h-screen"><div class="lead-connector">
            <div class="hl_nav-header"></div>
            <div class="hl_nav-settings"><nav>
              <a>Go Back</a><a>My Profile</a><a>Company</a><a>Team</a><a>Billing</a>
            </nav></div>
          </div></div>
        </aside>
      `), { waitUntil: "load" });
      const reused = await page.evaluate(() => {
        const list = document.querySelector(".hl_nav-settings > nav") as HTMLElement;
        const last = list.querySelector("a:last-child") as HTMLElement;
        return list.scrollHeight - (last.offsetTop + last.offsetHeight);
      });
      expect(reused).toBeLessThan(24);

      await page.setContent(pageHtml(`
        <aside id="sidebar-v2" class="hl_fixed-width">
          <div class="h-screen"><div class="lead-connector">
            <div class="hl_nav-header"><nav>
              <a>Agency Dashboard</a><a id="sb_reporting">Reporting</a>
            </nav></div>
            <div class="hl_nav-settings"><a id="sb_settings">Settings</a></div>
          </div></div>
        </aside>
      `), { waitUntil: "load" });
      const footer = await page.evaluate(() => {
        const side = document.querySelector("#sidebar-v2")!.getBoundingClientRect();
        const link = document.querySelector("#sb_settings")!.getBoundingClientRect();
        const reporting = document.querySelector("#sb_reporting")!.getBoundingClientRect();
        return {
          fromBottom: side.bottom - link.bottom,
          overlap: Math.min(reporting.bottom, link.bottom) - Math.max(reporting.top, link.top),
        };
      });
      expect(footer.fromBottom).toBeGreaterThan(-4);
      expect(footer.fromBottom).toBeLessThan(48);
      expect(footer.overlap).toBeLessThanOrEqual(0);

      // Agency footer: all three actions must retain their own rows, even
      // when HighLevel's old footer nav is constrained to one row.
      await page.setContent(pageHtml(`
        <style>.hl_nav-settings > nav { height: 40px; display:flex; flex-direction:column; }
        .hl_nav-settings a { flex-shrink:1; }</style>
        <aside id="sidebar-v2"><div class="h-screen"><div class="lead-connector">
          <div class="hl_nav-header"><nav><a>Desktop App</a></nav></div>
          <div class="hl_nav-settings"><nav><a id="sb_settings">Settings</a>
          <a>App Marketplace</a><a>SaaSSuite</a></nav></div>
        </div></div></aside>
      `), { waitUntil: "load" });
      const agencyFooter = await page.evaluate(() => {
        const bar = document.querySelector(".hl_nav-settings");
        const header = document.querySelector(".hl_nav-header");
        if (!bar || !header) throw new Error("Missing agency footer");
        const rows = Array.from(bar.querySelectorAll("a")).map(a => a.getBoundingClientRect());
        return {
          grow: getComputedStyle(bar).flexGrow,
          headerGrow: getComputedStyle(header).flexGrow,
          overlaps: rows.slice(1).map((r, i) => (rows[i]?.bottom || 0) - r.top),
          heights: rows.map(r => r.height),
        };
      });
      expect(agencyFooter.grow).toBe("0");
      expect(agencyFooter.headerGrow).toBe("1");
      for (const overlap of agencyFooter.overlaps) expect(overlap).toBeLessThanOrEqual(0);
      for (const height of agencyFooter.heights) expect(height).toBeGreaterThanOrEqual(40);

      await page.setContent(pageHtml(`
        <section class="main">
          <header class="hl_header"></header>
          <div class="hl_wrapper"><div id="companySettingsPage"><div class="card"></div></div></div>
        </section>
      `), { waitUntil: "load" });
      const form = await page.evaluate(() => {
        const pageEl = document.querySelector("#companySettingsPage") as HTMLElement;
        const wrap = document.querySelector(".hl_wrapper") as HTMLElement;
        const cs = getComputedStyle(pageEl);
        return {
          pad: cs.paddingBottom,
          minHeight: cs.minHeight,
          extra: wrap.scrollHeight - wrap.clientHeight,
        };
      });
      expect(form.pad).toBe("0px");
      expect(form.minHeight).toBe("0px");
      expect(form.extra).toBeLessThan(24);
    } finally {
      await browser.close();
    }
  });
});
