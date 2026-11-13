// Browser checks for the theme grant the customizer sends from a sub-account.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import puppeteer from "puppeteer";

const SCRIPT = readFileSync(resolve(import.meta.dirname, "../public/theme-builder.js"), "utf8");

function grant(agency, exp) {
  const body = Buffer.from(JSON.stringify({ v: 1, a: agency, loc: "*", exp })).toString("base64url");
  return `${body}.signaturevalue1`;
}

function pageHtml(token) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body>
  <aside id="sidebar-v2">
    <div id="location-switcher">Bekah</div>
    <nav>
      <a id="sb_dashboard" href="/v2/location/loc55/dashboard"><span class="nav-title">Dashboard</span></a>
    </nav>
  </aside>
  <script>
    window.__calls = [];
    window.__issued = ${JSON.stringify(token)};
    window.fetch = function (url, opts) {
      var href = String(url);
      var method = (opts && opts.method) || "GET";
      window.__calls.push({ url: href, method: method, body: typeof opts?.body === "string" ? opts.body : "" });
      if (href.indexOf("dynamic-styles") !== -1) {
        var id = "demo";
        try { id = new URL(href).searchParams.get("agency_id") || id; } catch (e) {}
        var issued = window.__nextGrant || "";
        var js = issued ? '"saveToken":"' + issued + '"' : "";
        return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(js); }, json: function () { return Promise.resolve({}); } });
      }
      if (href.indexOf("location-theme") !== -1 && method === "POST") {
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ theme: {} }); } });
      }
      return Promise.resolve({ ok: true, status: 200, text: function () { return Promise.resolve(""); }, json: function () { return Promise.resolve({}); } });
    };
    window.SAI_THEME_CONFIG = {
      brandingVersion: "v3",
      motion: false,
      builderAccess: "all",
      agencyKey: "agency-demo",
      saveToken: window.__issued,
      agencyTheme: { sidebarBg: "#111827", sidebarBgEnd: "#111827", sidebarText: "#F8FAFC", accent: "#206F2D", font: "Inter", fontScope: "sidebar", iconPack: "default", appAccent: false, radius: 10 },
      themeEndpoint: "https://auth.saassuite.ai/functions/v1/location-theme"
    };
  </script>
  <script src="/theme-builder.js"></script>
</body>
</html>`;
}

function listen() {
  return new Promise((resolveServer) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (url.pathname === "/theme-builder.js") {
        res.writeHead(200, { "content-type": "text/javascript" });
        res.end(SCRIPT);
        return;
      }
      res.writeHead(200, { "content-type": "text/html" });
      res.end(pageHtml(url.searchParams.get("token") || ""));
    });
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

async function save(page) {
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await page.waitForFunction(() => window.__calls.some((call) => call.method === "POST" && call.url.includes("location-theme")) || /this browser only|Couldn't save/i.test(document.querySelector(".sai-tb-status")?.textContent || ""));
  return page.evaluate(() => {
    const post = window.__calls.filter((call) => call.method === "POST" && call.url.includes("location-theme")).pop();
    const grantFetch = window.__calls.filter((call) => call.url.includes("dynamic-styles")).map((call) => call.url);
    return {
      body: post ? JSON.parse(post.body) : null,
      grantFetch,
      status: document.querySelector(".sai-tb-status")?.textContent || "",
    };
  });
}

const failures = [];
function check(name, ok, detail) {
  if (!ok) failures.push(`${name}: ${detail}`);
  else console.log(`ok ${name}`);
}

const now = Math.floor(Date.now() / 1000);
const live = grant("demo", now + 3600);
const stale = grant("demo", now - 120);
const fresh = grant("demo", now + 7200);
const otherFresh = grant("other", now + 7200);
const foreign = grant("other-agency", now + 3600);
const victim = grant("victim", now + 3600);

const server = await listen();
const { port } = server.address();
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  page.on("pageerror", (err) => failures.push(`pageerror: ${err}`));
  await page.goto(`http://127.0.0.1:${port}/v2/location/loc55/dashboard?token=${encodeURIComponent(live)}`, { waitUntil: "load" });
  const legitimate = await save(page);
  check(
    "legitimate sub-account save sends the issued grant",
    legitimate.body && legitimate.body.locationId === "loc55" && legitimate.body.agencyKey === "agency-demo" && legitimate.body.saveToken === live && legitimate.grantFetch.length === 0,
    JSON.stringify({ locationId: legitimate.body && legitimate.body.locationId, agencyKey: legitimate.body && legitimate.body.agencyKey, fetched: legitimate.grantFetch.length, same: legitimate.body && legitimate.body.saveToken === live }),
  );

  await page.goto(`http://127.0.0.1:${port}/v2/location/loc55/dashboard?token=${encodeURIComponent(stale)}`, { waitUntil: "load" });
  await page.evaluate((next) => { window.__nextGrant = next; }, fresh);
  const renewed = await save(page);
  check(
    "an expired grant is replaced before the sub-account save",
    renewed.body && renewed.body.locationId === "loc55" && renewed.body.saveToken === fresh && renewed.body.saveToken !== stale && renewed.grantFetch.some((url) => url.includes("agency_id=demo") && url.includes("force=1")),
    JSON.stringify({ fetched: renewed.grantFetch, renewed: renewed.body && renewed.body.saveToken === fresh }),
  );

  await page.goto(`http://127.0.0.1:${port}/v2/location/loc55/dashboard?token=${encodeURIComponent(live)}`, { waitUntil: "load" });
  await page.evaluate((next) => { window.__nextGrant = next; window.__calls = []; }, otherFresh);
  await page.evaluate((oldToken) => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { agencyKey: "agency-other", saveToken: oldToken }));
  }, live);
  const switched = await save(page);
  const switchedToken = switched.body && switched.body.saveToken;
  check(
    "switching accounts does not send the previous grant",
    switched.body && switched.body.agencyKey === "agency-other" && switchedToken !== live && switched.grantFetch.some((url) => url.includes("agency_id=other")),
    JSON.stringify({ agencyKey: switched.body && switched.body.agencyKey, reused: switchedToken === live, fetched: switched.grantFetch }),
  );

  await page.goto(`http://127.0.0.1:${port}/v2/location/loc55/dashboard?token=${encodeURIComponent(foreign)}`, { waitUntil: "load" });
  await page.evaluate((next) => { window.__nextGrant = next; }, victim);
  const spoofed = await save(page);
  check(
    "a grant issued for another account is not sent",
    (!spoofed.body || (spoofed.body.saveToken !== foreign && spoofed.body.saveToken !== victim)) && spoofed.grantFetch.some((url) => url.includes("agency_id=demo")),
    JSON.stringify({ sent: spoofed.body && spoofed.body.saveToken, status: spoofed.status, fetched: spoofed.grantFetch }),
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
