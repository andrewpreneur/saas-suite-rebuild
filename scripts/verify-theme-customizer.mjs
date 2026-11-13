// Headless checks for the HighLevel theme customizer. Not part of the app bundle.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import puppeteer from "puppeteer";
import { sidebarModeWarning } from "../src/lib/sidebarMode.ts";
import { THEME_INSTALL_UPDATE_NOTE, installSnippets } from "../src/lib/installSnippets.ts";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = readFileSync(resolve(ROOT, "public/theme-builder.js"), "utf8");
const OUT = "/opt/cursor/artifacts/screenshots";
const STORE = "/cursor/stores/self/theme-customizer";
mkdirSync(OUT, { recursive: true });
mkdirSync(STORE, { recursive: true });

const LIGHT_TO_DARK = sidebarModeWarning("dark", "light");
const DARK_TO_LIGHT = sidebarModeWarning("light", "dark");

function pageHtml({ sidebar, themeClass, path, legacy }) {
  return `<!doctype html>
<html class="${themeClass || ""}">
<head>
  <meta charset="utf-8" />
  <title>${path}</title>
  <style>
    html, body { margin: 0; background: #f4f5f7; font-family: Inter, sans-serif; }
    #sidebar-v2 { position: relative; width: 248px; height: 100vh; overflow: hidden; background: ${sidebar}; color: ${sidebar === "#ffffff" ? "#111827" : "#e5e7eb"}; padding: 12px 0; box-sizing: border-box; }
    #sidebar-v2 .hl_nav-header { position: relative; height: 100%; box-sizing: border-box; }
    #sidebar-v2 nav a { display: flex; gap: 8px; align-items: center; height: 40px; padding: 8px 12px; color: inherit; text-decoration: none; }
    #sb_reporting { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; z-index: 2; }
    .hl_nav-settings { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; z-index: 3; background: transparent; }
    .agency-logo-container { display: block; }
    .agency-logo-container img { height: 120px !important; width: 120px !important; transform: scale(1.45); }
    #grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; margin-left: 260px; }
    #grid div, .media-card { height: 48px; background: #ddd; color: #111; }
    #location-switcher { margin: 8px; padding: 8px; border-radius: 8px; background: rgba(255,255,255,.12); }
    /* The bug: HighLevel sometimes paints sidebar buttons white on white. */
    #sidebar-v2 button { color: #fff !important; background: #fff !important; border-color: #fff !important; }
    #sidebar-v2 .sai-tb-label, #sidebar-v2 input, #sidebar-v2 input::placeholder, #sidebar-v2 kbd { color: #98a2b3 !important; -webkit-text-fill-color: #98a2b3 !important; }
    #globalSearchOpener { display: flex; align-items: center; gap: 8px; margin: 8px; padding: 6px 8px; background: #fff; color: #98a2b3; -webkit-text-fill-color: #98a2b3; }
    .search-shortcut { display: inline-block; min-width: 28px; height: 18px; background: #000; color: #fff; -webkit-mask-image: linear-gradient(#000, #000); mask-image: linear-gradient(#000, #000); }
    .sidebar-search { display: flex; align-items: center; gap: 8px; margin: 8px; }
    #sb-search { flex: 1; height: 32px; border: 0; border-radius: 8px; background: #fff; }
    #sidebar-v2 a :is(svg, .hl-mask-icon, .hl-fa, .hl-nav-img) { width: 18px; height: 18px; flex: 0 0 auto; }
    .hl-mask-icon, .hl-fa { display: inline-block; background: #111; }
    .hl-mask-icon { -webkit-mask-image: linear-gradient(#000, #000); mask-image: linear-gradient(#000, #000); }
    .sb-row { display: flex; align-items: center; }
    #purple-rail { position: absolute; left: 0; top: 0; bottom: 0; width: 28px; background: #4c1d95; }
    #pink-fill { position: absolute; left: 28px; right: 0; top: 0; bottom: 0; background: #f9a8d4; z-index: 0; }
    #sidebar-v2 nav, #sidebar-v2 .sai-tb-trigger, #sidebar-v2 .sidebar-search { position: relative; z-index: 1; }
    .settings-section { font-size: 11px; letter-spacing: .04em; text-transform: uppercase; padding: 12px 12px 4px; }
    .go-back { font-weight: 600; }
    .hl_header { position: fixed; top: 0; left: 248px; right: 0; height: 56px; background: #fff; border-bottom: 1px solid #e4e7ec; z-index: 20; color: #101828; }
    .hl_header.dark { background: #101828; color: #f8fafc; border-bottom-color: #1d2939; }
    /* Settings keeps the desktop header box (left:256px) while the visible bar is pulled back over the viewport. A header-relative left then goes negative. */
    .hl_header.ghl-offset { left: 256px; right: auto; width: 1200px; overflow: visible; }
    .hl_header.ghl-offset .hl-bar { position: absolute; left: -256px; top: 0; width: 100vw; height: 56px; background: #fff; box-sizing: border-box; }
    .hl_header.ghl-dash, .hl_header.ghl-packed { left: 0; right: 0; width: auto; }
    /* Packed bar: at 640 the account control ends at x=624. A ~210px trigger margin pushes it past the viewport; 768 has room. */
    .hl_header.ghl-packed .hl-bar { padding: 0 16px; gap: 0; }
    .hl_header.ghl-packed .hl_header--controls { gap: 8px; }
    .hl_header.ghl-packed .ghl-native { width: 32px; height: 32px; flex: 0 0 32px; }
    .hl_header.ghl-packed .ghl-logo { width: 64px; flex: 0 0 64px; padding: 0; }
    .hl_header.ghl-packed .ghl-search { width: 96px; flex: 0 0 96px; border-radius: 8px; }
    .hl_header.ghl-packed .help-btn { width: 120px; height: 32px; flex: 0 0 120px; padding: 0; font-size: 12px; box-sizing: border-box; }
    .hl-bar { height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; gap: 12px; }
    .hl_header--controls { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; }
    .hl_header.ghl-offset .hl-bar { padding: 0 6px; gap: 4px; }
    .hl_header.ghl-dash .hl-bar { padding: 0 8px; gap: 6px; }
    .hl_header.ghl-offset .hl_header--controls { gap: 2px; }
    .hl_header.ghl-dash .hl_header--controls { gap: 4px; }
    .help-btn { height: 36px; border: 0; border-radius: 980px; background: #3b5bfd; color: #fff; padding: 0 14px; font-size: 14px; font-weight: 600; }
    .hl_header.ghl-offset .help-btn { height: 28px; padding: 0 6px; font-size: 10px; }
    .hl_header.ghl-dash .help-btn { height: 32px; padding: 0 8px; font-size: 12px; }
    .ghl-icon { width: 32px; height: 32px; border-radius: 8px; border: 1px solid #e4e7ec; background: #fff; font-size: 11px; }
    .ghl-native { flex: 0 0 auto; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 999px; background: #eef2f6; color: #101828; font-size: 11px; font-weight: 700; }
    .hl_header.ghl-offset .ghl-native { width: 26px; height: 26px; }
    .ghl-logo { width: auto; padding: 0 6px; background: transparent; font-size: 13px; }
    .hl_header.ghl-offset .ghl-logo { width: 26px; padding: 0; }
    .hl_header.dark .ghl-icon { background: #1f2937; color: #f8fafc; border-color: #344054; }
  </style>
</head>
<body>
  <aside id="sidebar-v2">
    <div class="agency-logo-container"><img id="hl-logo" class="agency-logo" alt="Agency logo" src="https://cdn.example/highlevel.png" width="400" height="400" /></div>
    <div id="location-switcher">Lynkific Test</div>
    <div class="sidebar-search"><input id="sb-search" type="text" placeholder="Search" /><kbd>⌘K</kbd></div>
    <button id="globalSearchOpener" type="button"><span class="search-placeholder">Search</span><span class="search-shortcut">⌘K</span></button>
    <div class="hl_nav-header">
      <nav>
        <a id="sb_launchpad" href="${path}"><svg class="hl-nav-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><span class="nav-title">START HERE</span></a>
        <a id="sb_ask-ai" href="${path}"><i class="hl-fa"></i><span class="nav-title">Ask AI</span></a>
        <a id="sb_dashboard" href="${path}"><span class="hl-mask-icon"></span><svg class="hl-nav-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><i class="hl-fa"></i><img class="hl-nav-img" alt="" src="https://cdn.example/dash.png" /><span class="nav-title">Dashboard</span></a>
        <div class="sb-row"><span class="hl-mask-icon"></span><a id="sb_payments" href="${path}"><span class="nav-title">Payments</span></a></div>
        <a id="sb_conversations" href="${path}"><svg class="hl-nav-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><span class="nav-title">Conversations</span></a>
        <a id="sb_media-storage" href="${path}"><svg class="hl-nav-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><span class="nav-title">Media Storage</span></a>
        <a id="sb_reporting" href="${path}"><svg class="hl-nav-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><span class="nav-title">Reporting</span></a>
      </nav>
    </div>
    <div class="hl_nav-settings"><a id="sb_settings" href="${path}"><svg class="hl-nav-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><span class="nav-title">Settings</span></a></div>
  </aside>
  <main id="grid"><nav class="media-library"><a id="sb_decoy" class="media-card" href="${path}">Media card</a></nav></main>
  <script>
    window.__calls = [];
    window.__sharedTheme = null;
    window.__themes = {};
    window.__logos = {};
    window.__themeStatus = 200;
    window.fetch = function (url, opts) {
      var href = String(url);
      var method = (opts && opts.method) || "GET";
      window.__calls.push({ url: href, method: method, body: typeof opts?.body === "string" ? opts.body : "" });
      function locOf() {
        try { return new URL(href, location.href).searchParams.get("locationId") || ""; } catch (e) { return ""; }
      }
      if (href.indexOf("location-theme") !== -1) {
        if (window.__themeStatus && window.__themeStatus !== 200) {
          var fail = { error: window.__themeError || "" };
          return Promise.resolve({ ok: false, status: window.__themeStatus, json: function () { return Promise.resolve(fail.error ? fail : {}); } });
        }
        if (method === "POST") {
          var sent = JSON.parse(opts.body);
          window.__themes[sent.locationId] = sent.theme;
          return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ theme: sent.theme }); } });
        }
        var loc = locOf();
        var theme = Object.prototype.hasOwnProperty.call(window.__themes, loc) ? window.__themes[loc] : (loc === "loc55" ? window.__sharedTheme : null);
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ theme: theme }); } });
      }
      if (href.indexOf("theme-logo") !== -1) {
        if (method === "DELETE") {
          var removed = JSON.parse(opts.body);
          var finishDelete = function () {
            delete window.__logos[removed.locationId];
            return { ok: true, status: 200, json: function () { return Promise.resolve({ logoUrl: null }); } };
          };
          if (window.__deferLogoDelete) {
            return new Promise(function (resolve) { window.__releaseLogoDelete = function () { resolve(finishDelete()); }; });
          }
          return Promise.resolve(finishDelete());
        }
        if (method === "POST" && typeof opts.body === "string") {
          var posted = JSON.parse(opts.body);
          window.__logos[posted.locationId] = posted.logoUrl;
          return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ logoUrl: posted.logoUrl }); } });
        }
        if (method === "POST" && opts && opts.body && typeof opts.body !== "string") {
          var formUser = "";
          var formToken = "";
          var formLoc = "";
          try {
            formUser = String(opts.body.get("userId") || "");
            formToken = String(opts.body.get("saveToken") || "");
            formLoc = String(opts.body.get("locationId") || "");
          } catch (e) {}
          window.__calls[window.__calls.length - 1].form = { userId: formUser, saveToken: formToken, locationId: formLoc };
          var hosted = "https://cdn.example/uploaded.png";
          if (formLoc) window.__logos[formLoc] = hosted;
          return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ logoUrl: hosted }); } });
        }
        var stored = window.__logos[locOf()] || null;
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ logoUrl: stored }); } });
      }
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
    };
    window.SAI_THEME_CONFIG = ${JSON.stringify({
      brandingVersion: "v3",
      motion: false,
      builderAccess: "all",
      agencyKey: "agency-demo",
      agencyTheme: {
        sidebarBg: sidebar,
        sidebarBgEnd: sidebar,
        sidebarText: "auto",
        accent: "#206F2D",
        font: "Inter",
        fontScope: "sidebar",
        iconPack: "default",
        appAccent: false,
        radius: 10,
      },
      themeEndpoint: "https://backend-disconnected.invalid/functions/v1/location-theme",
      logoEndpoint: "https://backend-disconnected.invalid/functions/v1/theme-logo",
    })};
  </script>
  <script>
    (function () {
      var q = location.search;
      if (q.indexOf("nav=settings") === -1 && q.indexOf("header=1") === -1) return;
      if (q.indexOf("nav=settings") !== -1) {
        var foot = document.querySelector(".hl_nav-settings");
        if (foot) foot.remove();
        var reporting = document.getElementById("sb_reporting");
        if (reporting) reporting.remove();
        var nav = document.querySelector("#sidebar-v2 nav");
        if (nav) nav.innerHTML = ${JSON.stringify(`
          <a class="go-back" href="${path}"><span>Go Back</span></a>
          <a class="settings-heading active" href="${path}"><span class="nav-title">Settings</span></a>
          <a href="${path}"><span class="nav-title">My Profile</span></a>
          <a href="${path}"><span class="nav-title">Billing</span></a>
          <a href="${path}"><span class="nav-title">Users</span></a>
          <a id="sb_opportunities" href="${path}"><span class="nav-title">Opportunities & Pipelines</span></a>
          <div class="settings-section">Business Services</div>
          <a id="sb_calendars" href="${path}"><span class="nav-title">Calendars</span></a>
          <a href="${path}"><span class="nav-title">Email Services</span></a>
          <a href="${path}"><span class="nav-title">Phone System</span></a>
          <a href="${path}"><span class="nav-title">WhatsApp</span></a>
          <div class="settings-section">Other Settings</div>
          <a href="${path}"><span class="nav-title">Objects</span></a>
          <a href="${path}"><span class="nav-title">Custom Fields</span></a>
          <a href="${path}"><span class="nav-title">Custom Values</span></a>
          <a href="${path}"><span class="nav-title">Import Data</span></a>
        `)};
      }
      if (q.indexOf("nav=settings-raw") !== -1) {
        var footRaw = document.querySelector(".hl_nav-settings");
        if (footRaw) footRaw.remove();
        var reportingRaw = document.getElementById("sb_reporting");
        if (reportingRaw) reportingRaw.remove();
        var navRaw = document.querySelector("#sidebar-v2 nav");
        if (navRaw) navRaw.innerHTML = ${JSON.stringify(`
          <a id="sb_my-profile" href="${path}"><span class="nav-title">My Profile</span></a>
          <a id="sb_billing" href="${path}"><span class="nav-title">Billing</span></a>
          <a href="${path}"><span class="nav-title">Users</span></a>
          <a id="sb_opportunities" href="${path}/opportunities"><span class="nav-title">Opportunities & Pipelines</span></a>
          <a id="sb_calendars" href="${path}/calendars"><span class="nav-title">Calendars</span></a>
          <a href="${path}"><span class="nav-title">Email Services</span></a>
          <a href="${path}"><span class="nav-title">Phone System</span></a>
          <a href="${path}"><span class="nav-title">WhatsApp</span></a>
          <a href="${path}"><span class="nav-title">Objects</span></a>
          <a href="${path}"><span class="nav-title">Custom Fields</span></a>
          <a href="${path}"><span class="nav-title">Custom Values</span></a>
          <a href="${path}"><span class="nav-title">Import Data</span></a>
        `)};
      }
      if (q.indexOf("header=1") !== -1) {
        var header = document.createElement("header");
        header.className = "hl_header" + (q.indexOf("top=dark") !== -1 ? " dark" : "");
        header.innerHTML = '<div class="hl-bar"><div class="hl_header--controls" id="left-controls"><strong class="loc">Business Profile Settings</strong></div><div class="hl_header--controls" id="right-controls"><div id="support-widget-launcher-host" data-ss-help-launcher="1"><button class="help-btn" type="button">Help & Support</button></div><button class="ghl-icon" type="button" id="ghl-bell" aria-label="Notifications">Alerts</button><button class="ghl-icon" type="button" id="ghl-help" aria-label="HighLevel help">?</button><button class="ghl-icon" type="button" id="ghl-avatar" aria-label="Account">AQ</button></div></div>';
        if (q.indexOf("bar=settings") !== -1 || q.indexOf("bar=dashboard") !== -1 || q.indexOf("bar=packed") !== -1) {
          var settingsBar = q.indexOf("bar=settings") !== -1;
          var packedBar = q.indexOf("bar=packed") !== -1;
          header.classList.add(settingsBar ? "ghl-offset" : packedBar ? "ghl-packed" : "ghl-dash");
          var leftHtml = packedBar
            ? '<button class="ghl-native ghl-logo" id="ghl-logo" type="button" data-native="1">Lynkific</button><button class="ghl-native ghl-search" id="ghl-search" type="button" data-native="1">Search</button><button class="ghl-native" id="ghl-phone" type="button" data-native="1" aria-label="Phone">Ph</button>'
            : '<button class="ghl-native ghl-logo" id="ghl-logo" type="button" data-native="1">' + (settingsBar ? "L" : "Lynkific") + '</button>' + (settingsBar ? '<button class="ghl-native" id="ghl-phone" type="button" data-native="1" aria-label="Phone">Ph</button>' : "");
          var rightHtml = (settingsBar || packedBar) ? '<button class="ghl-native" id="ghl-helpq" type="button" data-native="1" aria-label="Help">?</button>' : "";
          if (settingsBar) rightHtml += '<button class="ghl-native" id="ghl-ai" type="button" data-native="1" aria-label="AI">AI</button><button class="ghl-native" id="ghl-mega" type="button" data-native="1" aria-label="Announcements">Go</button>';
          rightHtml += '<div id="support-widget-launcher-host" data-ss-help-launcher="1" data-native="1"><button class="help-btn" type="button">Help & Support</button></div><button class="ghl-native" id="ghl-bell" type="button" data-native="1" aria-label="Notifications">Be</button><button class="ghl-native" id="ghl-avatar" type="button" data-native="1" aria-label="Account">AQ</button>';
          header.innerHTML = '<div class="hl-bar"><div class="hl_header--controls" id="left-controls">' + leftHtml + '</div><div class="hl_header--controls" id="right-controls">' + rightHtml + '</div></div>';
        }
        document.body.insertBefore(header, document.body.firstChild);
      }
      if (q.indexOf("neighbor=1") !== -1) {
        var left = document.getElementById("left-controls");
        var right = document.getElementById("right-controls");
        if (left) left.innerHTML = '<strong class="loc">Menu</strong>';
        if (right) right.innerHTML = '<button class="ghl-icon" type="button" id="ghl-alerts" aria-label="Alerts">Alerts</button><div id="support-widget-launcher-host" data-ss-help-launcher="1"><button class="help-btn" type="button">Help & Support</button></div><button class="ghl-icon" type="button" id="ghl-bell" aria-label="Notifications">Bell</button>';
      }
    })();
  </script>
  ${legacy ? '<script src="/sai-theme-saassuite.js?project=bsrdbqgpafipcbbqxvte"></script>' : ""}
  <script src="/theme-builder.js"></script>
</body>
</html>`;
}

function listen() {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    if (url.pathname === "/theme-builder.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(SCRIPT);
      return;
    }
    if (url.pathname === "/sai-theme-saassuite.js") {
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(`(function () {
  if (window.__SAI_THEME_LOCK || (window.SAITheme && !window.SAITheme.__pending)) {
    window.__SAI_OLD_DEFERRED = true;
    return;
  }
  window.__SAI_THEME_LOCK = "legacy";
  window.__SAI_OLD_RAN = true;
  window.SAITheme = { __build: "legacy", configure: function () {} };
  function inject() {
    if (window.__SAI_THEME_ICON_OWNER && window.__SAI_THEME_ICON_OWNER !== "legacy") return;
    var links = document.querySelectorAll("#sidebar-v2 a[id^='sb_']");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.getAttribute("data-sai-icon") === "1") continue;
      if (a.querySelector(".sai-ico")) continue;
      var row = a.parentElement;
      if (row && row.querySelectorAll("a").length === 1 && row.querySelector(":scope > .sai-ico")) continue;
      var s = document.createElement("span");
      s.className = "sai-ico";
      s.setAttribute("data-sai-legacy", "1");
      s.setAttribute("data-sai-nav", "1");
      var svg = a.querySelector("svg");
      if (svg && svg.parentNode) svg.parentNode.insertBefore(s, svg);
      else a.insertBefore(s, a.firstChild);
      var svgs = a.querySelectorAll("svg");
      for (var j = 0; j < svgs.length; j++) svgs[j].style.display = "none";
    }
  }
  inject();
  window.__SAI_OLD_INJECT = inject;
  setInterval(inject, 200);
})();`);
      return;
    }
    if (url.pathname === "/design-install") {
      const snippet = installSnippets("saassuite").js;
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>
        body { font-family: Inter, sans-serif; background: #fff; color: #111; margin: 0; }
        main { max-width: 960px; margin: 0 auto; padding: 24px; }
        .banner { border: 1px solid #f5c451; background: #fff8eb; border-radius: 10px; padding: 16px; }
        ol { padding-left: 20px; }
        .script { display: flex; gap: 12px; align-items: flex-start; border: 1px solid #e4e7ec; background: #f8fafc; border-radius: 10px; padding: 12px; }
        code { font-family: ui-monospace, monospace; font-size: 12px; word-break: break-all; }
        button { height: 36px; padding: 0 14px; border-radius: 8px; border: 1px solid #d0d5dd; background: #fff; }
      </style></head><body><main>
        <h1>Theme Customizer (Beta)</h1>
        <p>This is in beta and may have bugs. The full release is November 1st.</p>
        <div class="banner" role="status">
          <p><strong>Update your HighLevel Custom JS</strong></p>
          <p id="note">${THEME_INSTALL_UPDATE_NOTE} Leave your Custom CSS line as it is.</p>
          <p>Until this tag is saved in HighLevel, Customize theme shows “Update your install script in SaaSSuite &gt; Design” to whoever can edit.</p>
        </div>
        <ol>
          <li>In HighLevel, open Settings, then Company, then White Label, then Custom JS.</li>
          <li>Replace the old SaaS Suite script with the one below and save. Keep your existing Custom CSS line. The old script keeps working until you replace it.</li>
          <li>Refresh HighLevel. A logo or theme saved in one sub-account stays on that sub-account. Another sub-account is unchanged, and one with no logo uses the agency logo.</li>
        </ol>
        <div class="script"><code id="snippet">${snippet.replace(/</g, "&lt;")}</code><button id="copy" type="button">Copy</button></div>
      </main></body></html>`);
      return;
    }
    if (url.pathname === "/design-warning") {
      const warning = url.searchParams.get("dir") === "reverse" ? DARK_TO_LIGHT : LIGHT_TO_DARK;
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1" /><style>
        body { font-family: Inter, sans-serif; background: #fff; color: #111; margin: 24px; }
        label { display: flex; gap: 12px; align-items: flex-start; max-width: 640px; padding: 12px; border: 1px solid #f5c451; background: #fff8eb; border-radius: 10px; }
        button { margin-top: 16px; height: 36px; padding: 0 14px; border-radius: 8px; border: 0; background: #111827; color: #fff; }
        button:disabled { opacity: .4; }
      </style></head><body>
        <h1>Theme Customizer (Beta)</h1>
        <p>This is in beta and may have bugs. The full release is November 1st.</p>
        <label><input id="confirm" type="checkbox" /> <span id="warning">${warning}</span></label>
        <div><button id="save" disabled>Save &amp; apply branding</button></div>
        <script>
          document.getElementById("confirm").addEventListener("change", function (e) {
            document.getElementById("save").disabled = !e.target.checked;
          });
        </script>
      </body></html>`);
      return;
    }
    const sidebar = url.searchParams.get("sidebar") || "#ffffff";
    const themeClass = url.searchParams.get("theme") || "";
    const legacy = url.searchParams.get("legacy") === "1";
    res.writeHead(200, { "content-type": "text/html" });
    res.end(pageHtml({ sidebar, themeClass, path: url.pathname, legacy }));
  });
  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => resolvePromise(server));
  });
}

function rgb(color) {
  const hex = String(color || "").trim().match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return { r: parseInt(hex[1].slice(0, 2), 16), g: parseInt(hex[1].slice(2, 4), 16), b: parseInt(hex[1].slice(4, 6), 16) };
  }
  const m = String(color || "").match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).map(Number);
  return { r: p[0], g: p[1], b: p[2] };
}
function lum(c) {
  const f = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrast(a, b) {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const failures = [];
function check(name, ok, detail) {
  if (!ok) failures.push(`${name}: ${detail}`);
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}

async function shot(page, name) {
  const file = resolve(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  const store = resolve(STORE, `${name}.png`);
  await page.screenshot({ path: store });
  return file;
}

async function setWidth(page, width) {
  if (typeof page.setViewport === "function") await page.setViewport({ width, height: 800 });
  else await page.setViewportSize({ width, height: 800 });
}

async function shotHeader(page, name, width) {
  const clip = { x: 0, y: 0, width, height: 80 };
  await page.screenshot({ path: resolve(OUT, `${name}.png`), clip });
  await page.screenshot({ path: resolve(STORE, `${name}.png`), clip });
}

async function readHeader(page) {
  return page.evaluate(() => {
    const trigger = document.querySelector(".sai-tb-trigger");
    const help = document.getElementById("support-widget-launcher-host");
    const header = document.querySelector(".hl_header");
    const natives = [...document.querySelectorAll("[data-native]")];
    const read = () => natives.map((el) => {
      const r = el.getBoundingClientRect();
      return { id: el.id || "help", x: Math.round(r.left), y: Math.round(r.top), right: Math.round(r.right) };
    });
    const on = read();
    const tr = trigger ? trigger.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
    const hr = help.getBoundingClientRect();
    const hb = header.getBoundingClientRect();
    const style = trigger ? trigger.getAttribute("style") || "" : "";
    const shown = !!(trigger && getComputedStyle(trigger).display !== "none" && tr.width > 2 && tr.height > 2);
    const hits = [];
    if (shown) {
      natives.forEach((el) => {
        const r = el.getBoundingClientRect();
        const x = Math.min(tr.right, r.right) - Math.max(tr.left, r.left);
        const y = Math.min(tr.bottom, r.bottom) - Math.max(tr.top, r.top);
        if (x > 1 && y > 1) hits.push(el.id || "help");
      });
    }
    const chip = trigger ? trigger.querySelector(".sai-tb-chip") : null;
    const chipBox = chip ? chip.getBoundingClientRect() : { width: 0, height: 0 };
    const chipShown = !!(chip && getComputedStyle(chip).display !== "none" && chipBox.width > 4 && chipBox.height > 4);
    const reserved = document.querySelectorAll("[data-sai-theme-reserve]").length;
    document.querySelectorAll("[data-sai-theme-reserve]").forEach((el) => {
      el.style.removeProperty(el.getAttribute("data-sai-theme-reserve") || "margin-left");
      el.removeAttribute("data-sai-theme-reserve");
    });
    if (trigger) trigger.style.setProperty("display", "none", "important");
    const off = read();
    const icons = document.querySelectorAll("#sidebar-v2 .sai-ico[data-sai-nav]").length;
    window.dispatchEvent(new Event("resize"));
    const avatar = on.find((item) => item.id === "ghl-avatar") || null;
    const avatarOff = off.find((item) => item.id === "ghl-avatar") || null;
    return {
      shown,
      negative: /(?:^|;)\s*left:\s*-/.test(style),
      left: trigger ? trigger.style.left : "",
      position: trigger ? trigger.style.position : "",
      viewportLeft: Math.round(tr.left),
      gap: shown ? Math.round(hr.left - tr.right) : null,
      hits,
      chipShown,
      triggerWidth: Math.round(tr.width),
      headerLeft: Math.round(hb.left),
      helpLeft: Math.round(hr.left),
      oldLeft: Math.round(hr.left - hb.left - 36 - 8),
      inHeader: !!(trigger && trigger.closest(".hl_header")),
      icons,
      reserved,
      avatar,
      avatarOff,
      deltas: on.map((item, i) => ({ id: item.id, dx: item.x - off[i].x, dy: item.y - off[i].y })),
      on,
      off,
    };
  });
}

function headerVerdict(kind, width, box) {
  const inside = (item) => !!item && item.x >= -1 && item.right <= width + 1;
  const unmoved = box.deltas.every((d) => Math.abs(d.dx) <= 1 && Math.abs(d.dy) <= 1);
  const offInside = box.off.every(inside);
  const onInside = box.on.every(inside);
  const hiddenOk = !box.shown && box.left === "" && !box.negative && box.reserved === 0 && unmoved && box.inHeader && (offInside ? onInside : true);
  const shownOk = box.shown && box.position === "fixed" && box.viewportLeft >= 0 && box.gap >= 4 && box.gap <= 16 && box.hits.length === 0 && box.chipShown && !box.negative && box.inHeader && onInside && inside(box.avatar) && box.deltas.every((d) => Math.abs(d.dy) <= 1 && Math.abs(d.dx) <= box.triggerWidth + 20);
  let ok = width <= 640 ? hiddenOk : (box.shown ? shownOk : hiddenOk);
  if (kind === "packed" && width === 641) ok = hiddenOk && inside(box.avatar);
  if (kind === "packed" && width >= 768) ok = shownOk;
  if (kind === "settings" && width >= 768) ok = shownOk;
  if (kind === "settings" && width <= 414) ok = ok && box.headerLeft >= 200 && box.oldLeft < 0;
  if (kind === "settings") ok = ok && box.icons === 0;
  return ok;
}

async function openHeader(page, kind) {
  await setWidth(page, 1280);
  const path = kind === "settings"
    ? `/v2/location/locMobile/settings/company?sidebar=${encodeURIComponent("#ffffff")}&nav=settings&header=1&bar=settings`
    : `/v2/location/locPacked/dashboard?sidebar=${encodeURIComponent("#ffffff")}&header=1&bar=packed`;
  await page.goto(`${base}${path}`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      builderAccess: "all",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, { iconPack: "lucide", sidebarBg: "#ffffff", sidebarBgEnd: "#ffffff", sidebarText: "auto" }),
    }));
  });
  await new Promise((r) => setTimeout(r, 300));
}

async function settleHeader(page, width) {
  await setWidth(page, width);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await new Promise((r) => setTimeout(r, 80));
  return readHeader(page);
}

async function runHeaderFit(page, engine) {
  const widths = [320, 375, 414, 639, 640, 641, 700, 767, 768, 1024, 1280, 1920];
  for (const kind of ["settings", "packed"]) {
    await openHeader(page, kind);
    let at641 = null;
    for (const width of widths) {
      const box = await settleHeader(page, width);
      if (width === 641) at641 = box.shown;
      check(
        engine + " " + kind + " header keeps native controls at " + width,
        headerVerdict(kind, width, box),
        JSON.stringify(box),
      );
      if (engine === "chromium" && [375, 640, 641, 768, 1280].includes(width)) await shotHeader(page, kind + "-header-" + width, width);
      if (engine === "webkit" && [640, 641, 768].includes(width)) await shotHeader(page, "webkit-" + kind + "-header-" + width, width);
    }
    const trip = [641, 640, 641, 768, 700, 768, 640, 641];
    const seen = [];
    for (const width of trip) {
      const box = await settleHeader(page, width);
      seen.push({ width, shown: box.shown });
      const narrowStuck = width <= 640 && box.shown;
      check(
        engine + " " + kind + " resize lands at " + width,
        headerVerdict(kind, width, box) && !narrowStuck,
        JSON.stringify({ shown: box.shown, avatar: box.avatar, reserved: box.reserved, left: box.left }),
      );
    }
    check(
      engine + " " + kind + " resize 641 to 640 to 641 does not leave the button stuck",
      seen[0].shown === seen[2].shown && seen[2].shown === seen[7].shown && seen[1].shown === false && seen[6].shown === false && (kind === "packed" ? seen[0].shown === false && seen[3].shown === true : seen[3].shown === true),
      JSON.stringify(seen),
    );
    await settleHeader(page, 1024);
    const before = await readHeader(page);
    await page.evaluate(() => {
      const right = document.getElementById("right-controls");
      const extra = document.createElement("button");
      extra.id = "ghl-extra";
      extra.className = "ghl-native";
      extra.setAttribute("data-native", "1");
      extra.type = "button";
      extra.textContent = "Account";
      extra.style.width = "640px";
      extra.style.flex = "0 0 640px";
      right.appendChild(extra);
    });
    await new Promise((r) => setTimeout(r, 80));
    const crowded = await readHeader(page);
    check(
      engine + " " + kind + " header mutation hides the trigger when the account control would leave",
      before.shown && !crowded.shown && crowded.reserved === 0 && crowded.left === "" && crowded.deltas.every((d) => Math.abs(d.dx) <= 1 && Math.abs(d.dy) <= 1),
      JSON.stringify({ before: before.shown, crowded: { shown: crowded.shown, reserved: crowded.reserved, avatar: crowded.avatar, deltas: crowded.deltas } }),
    );
    await page.evaluate(() => {
      const extra = document.getElementById("ghl-extra");
      if (extra) extra.remove();
    });
    await new Promise((r) => setTimeout(r, 80));
    const restored = await readHeader(page);
    check(
      engine + " " + kind + " header mutation shows the trigger again when the bar has room",
      restored.shown && restored.gap >= 4 && restored.gap <= 16 && restored.avatar && restored.avatar.right <= 1025,
      JSON.stringify({ shown: restored.shown, gap: restored.gap, avatar: restored.avatar }),
    );
    if (at641 == null) check(engine + " " + kind + " measured 641", false, "missing");
  }
}

async function readButton(page) {
  return page.evaluate(() => {
    const open = document.querySelector(".sai-tb-open");
    const trigger = document.querySelector(".sai-tb-trigger");
    const sb = document.querySelector("#sidebar-v2");
    if (!open || !trigger || !sb) return { missing: true, stats: window.SAITheme && window.SAITheme.stats() };
    const cs = getComputedStyle(open);
    const bg = getComputedStyle(sb).backgroundColor;
      const variable = getComputedStyle(document.documentElement).getPropertyValue("--sai-sb-bg").trim();
      return {
      missing: false,
      color: cs.color,
      fill: getComputedStyle(open).webkitTextFillColor || cs.color,
      background: getComputedStyle(trigger).backgroundColor,
      sidebar: bg,
      token: variable,
      contrast: trigger.getAttribute("data-sai-contrast"),
      label: open.innerText,
      stats: window.SAITheme.stats(),
    };
  });
}

const server = await listen();
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;
const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() => localStorage.clear());

  for (const [name, sidebar, expectContrast] of [
    ["button-light-sidebar", "#ffffff", "light"],
    ["button-dark-sidebar", "#0E1A3A", "dark"],
    ["button-navy-sidebar", "#0f172a", "dark"],
    ["button-blue-sidebar", "#dbeafe", "light"],
    ["button-purple-sidebar", "#5b21b6", "dark"],
  ]) {
    await page.goto(`${base}/v2/location/loc123/dashboard?sidebar=${encodeURIComponent(sidebar)}`, { waitUntil: "load" });
    await page.waitForSelector(".sai-tb-open", { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));
    const info = await readButton(page);
    const fg = rgb(info.fill || info.color);
    const bg = rgb(info.sidebar && !/rgba?\(0,\s*0,\s*0,\s*0\)/.test(info.sidebar) ? info.sidebar : (info.background || info.token));
    const ratio = fg && bg ? contrast(fg, bg) : 0;
    check(`${name} contrast`, info.contrast === expectContrast && ratio >= 4.5 && !/98,\s*162,\s*179/.test(info.fill || ""), `mode=${info.contrast} ratio=${ratio.toFixed(2)} color=${info.color} fill=${info.fill} sidebar=${info.sidebar}`);
    await shot(page, name);
  }

  await page.evaluate(() => window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { brandingVersion: "v1" })));
  await new Promise((r) => setTimeout(r, 200));
  const stacked = await page.evaluate(() => {
    const reporting = document.querySelector("#sb_reporting").getBoundingClientRect();
    const settings = document.querySelector("#sb_settings").getBoundingClientRect();
    const overlap = Math.min(reporting.bottom, settings.bottom) - Math.max(reporting.top, settings.top);
    return { overlap, reportingTop: reporting.top, settingsTop: settings.top, pinned: document.documentElement.classList.contains("sai-pin-footer") };
  });
  check("reporting and settings do not overlap on Classic", stacked.pinned && stacked.overlap < 2 && stacked.settingsTop >= stacked.reportingTop, JSON.stringify(stacked));
  await page.evaluate(() => window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { brandingVersion: "v2" })));
  await new Promise((r) => setTimeout(r, 200));
  const simpleFoot = await page.evaluate(() => {
    const reporting = document.querySelector("#sb_reporting").getBoundingClientRect();
    const settings = document.querySelector("#sb_settings").getBoundingClientRect();
    const overlap = Math.min(reporting.bottom, settings.bottom) - Math.max(reporting.top, settings.top);
    return { overlap, pinned: document.documentElement.classList.contains("sai-pin-footer") };
  });
  check("reporting and settings do not overlap on Simple", simpleFoot.pinned && simpleFoot.overlap < 2, JSON.stringify(simpleFoot));
  await page.evaluate(() => window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { brandingVersion: "v3" })));
  await new Promise((r) => setTimeout(r, 200));
  const searchPaint = await page.evaluate(() => {
    const opener = document.getElementById("globalSearchOpener");
    const chip = document.querySelector(".search-shortcut");
    const os = getComputedStyle(opener);
    const cs = getComputedStyle(chip);
    return { opener: os.backgroundColor, chip: cs.backgroundColor, mask: cs.webkitMaskImage || cs.maskImage || "" };
  });
  check("dark sidebar themes the search field and shortcut chip", searchPaint.opener !== "rgb(255, 255, 255)" && searchPaint.chip !== "rgb(0, 0, 0)" && searchPaint.chip !== "rgb(255, 255, 255)" && /none/i.test(searchPaint.mask), JSON.stringify(searchPaint));
  const logoFit = await page.evaluate(() => {
    const logo = document.getElementById("hl-logo");
    const box = logo.closest(".agency-logo-container");
    const sw = document.getElementById("location-switcher");
    const trigger = document.querySelector(".sai-tb-trigger");
    const search = document.querySelector(".sidebar-search");
    function read(node) { return node.getBoundingClientRect(); }
    function measure() {
      const lr = read(logo), br = read(box), sr = read(sw), tr = read(trigger), qr = read(search);
      return {
        logoH: Math.round(lr.height),
        logoW: Math.round(lr.width),
        boxH: Math.round(br.height),
        boxW: Math.round(br.width),
        gapAbove: Math.round(tr.top - sr.bottom),
        gapBelow: Math.round(qr.top - tr.bottom),
        leftDelta: Math.round(Math.abs(tr.left - sr.left)),
        rightDelta: Math.round(Math.abs(tr.right - sr.right)),
        transform: getComputedStyle(logo).transform,
        logoGap: Math.round(sr.top - lr.bottom),
      };
    }
    const square = measure();
    const previousMargin = sw.style.margin;
    sw.style.marginTop = "0px";
    const tight = measure();
    sw.style.margin = previousMargin || "8px";
    logo.setAttribute("width", "800");
    logo.setAttribute("height", "80");
    const wide = measure();
    logo.setAttribute("width", "80");
    logo.setAttribute("height", "800");
    const tall = measure();
    logo.setAttribute("width", "400");
    logo.setAttribute("height", "400");
    return { square, wide, tall, tight };
  });
  check(
    "agency fallback logo stays inside the native slot",
    logoFit.square.logoH <= 40 && logoFit.square.logoH >= 8 && logoFit.square.boxH >= 56 && logoFit.square.boxH <= 64 && logoFit.square.logoW <= logoFit.square.boxW && logoFit.square.transform === "none" &&
      logoFit.wide.logoH <= 40 && logoFit.wide.logoW <= logoFit.wide.boxW && logoFit.wide.logoW > logoFit.wide.logoH &&
      logoFit.tall.logoH <= 40 && logoFit.tall.logoW <= 40,
    JSON.stringify(logoFit),
  );
  check(
    "expanded logo keeps about 12px above the switcher",
    logoFit.tight.logoGap >= 10 && logoFit.tight.logoGap <= 14 && logoFit.tight.boxH >= 56 && logoFit.tight.boxH <= 64,
    JSON.stringify(logoFit.tight),
  );
  check(
    "customize theme keeps space around the switcher and search",
    logoFit.square.gapAbove >= 7 && logoFit.square.gapAbove <= 16 && logoFit.square.gapBelow >= 7 && logoFit.square.gapBelow <= 16 && logoFit.square.leftDelta <= 2 && logoFit.square.rightDelta <= 2,
    JSON.stringify(logoFit.square),
  );
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const panel = await page.evaluate(() => {
    const save = document.querySelector('[data-act="save"]');
    const reset = document.querySelector('[data-act="resetbrand"]');
    const accent = document.querySelector('[data-hex="accent"]');
    accent.value = "#2F6FED";
    accent.dispatchEvent(new Event("input", { bubbles: true }));
    const text = document.querySelector('[data-hex="accentText"]').value;
    const folds = Array.from(document.querySelectorAll("details.sai-fold")).map((d) => ({ name: d.querySelector("summary").textContent, open: d.open }));
    const box = document.querySelector(".sai-tb").getBoundingClientRect();
    return {
      reset: reset.textContent,
      save: save.textContent,
      saveFull: save.scrollWidth <= save.clientWidth + 1,
      gap: window.innerHeight - box.bottom,
      accentText: text,
      folds,
    };
  });
  check("panel has reset, a full Save theme label, and room above the chat bubble", panel.reset === "Reset to agency branding" && panel.save === "Save theme" && panel.saveFull && panel.gap >= 100, JSON.stringify(panel));
  check("blue highlight picks light text and sections start collapsed", panel.accentText.toUpperCase() === "#FFFFFF" && panel.folds.some((f) => f.name === "Colors" && f.open) && panel.folds.some((f) => f.name === "Logo" && !f.open), JSON.stringify(panel));
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  const tealInk = await page.evaluate(() => {
    function hexOf(value) {
      const raw = String(value || "").trim();
      const hex = raw.match(/^#([0-9a-f]{6})$/i);
      if (hex) return "#" + hex[1].toUpperCase();
      const rgb = raw.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
      if (!rgb) return "";
      return "#" + [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    }
    function lum(hex) {
      const f = (i) => { const c = parseInt(hex.substr(i, 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);
    }
    function ratio(bg, ink) {
      const left = hexOf(bg), right = hexOf(ink);
      if (!left || !right) return 0;
      const x = lum(left), y = lum(right);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    }
    function read(bg, text) {
      window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
        agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, { sidebarBg: bg, sidebarBgEnd: bg, sidebarText: text }),
      }));
      const ink = document.documentElement.style.getPropertyValue("--sai-sb-text").trim();
      return { ink, ratio: ratio(bg, ink) };
    }
    return { deep: read("#0F766E", "#111827"), mid: read("#14B8A6", "auto") };
  });
  check("teal sidebar text clears 4.5", tealInk.deep.ratio >= 4.5 && tealInk.mid.ratio >= 4.5 && tealInk.deep.ink.toLowerCase() !== "#111827", JSON.stringify(tealInk));
  const graphite = await page.evaluate(() => {
    document.querySelector("#sidebar-v2").style.background = "#1D2026";
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, {
        sidebarBg: "#1D2026",
        sidebarBgEnd: "#2B3039",
        sidebarText: "#C7CCD4",
        iconPack: "lucide",
      }),
    }));
    const chip = document.querySelector(".search-shortcut");
    const opener = document.getElementById("globalSearchOpener");
    chip.style.webkitTextStroke = "1px white";
    opener.style.webkitTextStroke = "1px white";
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG));
    const cs = getComputedStyle(chip);
    const os = getComputedStyle(opener);
    return {
      chipBorder: cs.borderTopColor,
      openerBorder: os.borderTopColor,
      chipStroke: cs.webkitTextStrokeWidth,
      openerStroke: os.webkitTextStrokeWidth,
    };
  });
  check(
    "dark sidebar search has no white outline",
    /0,\s*0,\s*0,\s*0/.test(graphite.chipBorder) && /0,\s*0,\s*0,\s*0/.test(graphite.openerBorder) && graphite.chipStroke === "0px" && graphite.openerStroke === "0px",
    JSON.stringify(graphite),
  );
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  await page.goto(`${base}/v2/location/loc123/contacts?sidebar=${encodeURIComponent("#0f172a")}`, { waitUntil: "load" });
  await page.waitForSelector("#grid");
  await new Promise((r) => setTimeout(r, 300));
  const contacts = await page.evaluate(() => {
    const grid = document.getElementById("grid");
    const cs = getComputedStyle(grid);
    return { display: cs.display, visibility: cs.visibility, opacity: cs.opacity, quiet: document.documentElement.classList.contains("sai-quiet-page") };
  });
  check("contacts keeps the main page visible", contacts.display !== "none" && contacts.visibility !== "hidden" && Number(contacts.opacity) > 0.9 && contacts.quiet, JSON.stringify(contacts));

  await page.goto(`${base}/v2/location/loc123/dashboard?sidebar=${encodeURIComponent("#ffffff")}&theme=dark`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-trigger");
  const classDriven = await readButton(page);
  check("light sidebar wins over a dark-mode class", classDriven.contrast === "light", `mode=${classDriven.contrast}`);

  await page.evaluate(() => {
    [document.querySelector("#sidebar-v2"), document.body, document.documentElement].forEach((el) => {
      el.style.setProperty("background", "transparent", "important");
      el.style.setProperty("background-image", "none", "important");
    });
    document.documentElement.classList.add("dark");
  });
  await new Promise((r) => setTimeout(r, 250));
  const fallback = await readButton(page);
  check("transparent sidebar uses the dark-mode class", fallback.contrast === "dark", `mode=${fallback.contrast}`);

  await page.goto(`${base}/v2/location/loc123/dashboard?sidebar=${encodeURIComponent("#0E1A3A")}`, { waitUntil: "load" });
  await page.click(".sai-tb-open");
  await page.waitForSelector(".sai-tb.open");
  const beta = await page.evaluate(() => ({
    title: document.querySelector(".sai-tb h2")?.textContent || "",
    note: document.querySelector(".sai-tb-beta")?.textContent || "",
  }));
  check("beta header", beta.title === "Theme Customizer (Beta)" && beta.note.includes("November 1st") && beta.note.toLowerCase().includes("beta"), beta.title + " | " + beta.note);
  await shot(page, "panel-beta-dark");

  await page.goto(`${base}/agency?sidebar=${encodeURIComponent("#ffffff")}`, { waitUntil: "load" });
  const legacy = await page.evaluate(() => window.SAITheme.stats());
  check("missing identity keeps edit access", legacy.canEdit === true && legacy.access === "all" && !legacy.user.type, JSON.stringify(legacy.user) + " " + legacy.access);
  await page.click(".sai-tb-open");
  await page.waitForSelector(".sai-tb.open");
  const oldInstall = await page.evaluate(() => ({
    hidden: document.querySelector(".sai-tb-install").hidden,
    text: document.querySelector(".sai-tb-install").textContent,
  }));
  check("old install asks for the Design update", oldInstall.hidden === false && oldInstall.text === "Update your install script in SaaSSuite > Design", oldInstall.text);
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());

  async function boot(user) {
    await page.evaluate((next) => {
      window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { user: next, builderAccess: "all" }));
    }, user);
    await new Promise((r) => setTimeout(r, 50));
    return page.evaluate(() => ({
      button: !!document.querySelector(".sai-tb-open"),
      stats: window.SAITheme.stats(),
    }));
  }
  const viewer = await boot({ type: "account", role: "user", email: "user@lynkific.com", id: "user-1", companyId: "co-1" });
  check("regular sub-account user only views", viewer.button === false && viewer.stats.canEdit === false && viewer.stats.access === "admins", JSON.stringify(viewer.stats));
  const admin = await boot({ type: "account", role: "admin", email: "admin@lynkific.com", id: "admin-1", companyId: "co-1" });
  check("sub-account admin can edit", admin.button === true && admin.stats.canEdit === true, String(admin.stats.canEdit));
  const agency = await boot({ type: "agency", role: "user", email: "owner@lynkific.com", id: "ag-1", companyId: "co-1" });
  check("agency user can edit", agency.button === true && agency.stats.user.companyId === "co-1", agency.stats.user.companyId);

  await page.evaluate(() => {
    window.__sharedTheme = {
      sidebarBg: "#7A1F3D",
      sidebarBgEnd: "#7A1F3D",
      sidebarText: "#FFFFFF",
      accent: "#F4C7D4",
      accentText: "#3B0A18",
      headerBg: "#FFFFFF",
      font: "Inter",
      fontScope: "sidebar",
      iconPack: "default",
      appAccent: false,
      radius: 10,
      logoUrl: "",
      logoHeight: 40,
    };
  });
  await page.evaluate(() => history.pushState({}, "", "/v2/location/loc55/dashboard"));
  await new Promise((r) => setTimeout(r, 900));
  const shared = await page.evaluate(() => ({
    bg: getComputedStyle(document.documentElement).getPropertyValue("--sai-sb-bg").trim(),
    calls: window.__calls.filter((c) => c.url.indexOf("location-theme") !== -1).map((c) => c.url),
  }));
  const sharedRgb = rgb(shared.bg);
  check("location theme loads for that sub-account", !!sharedRgb && sharedRgb.r === 122 && sharedRgb.g === 31 && sharedRgb.b === 61 && shared.calls.some((u) => u.includes("locationId=loc55")) && shared.calls.some((u) => u.includes("locationId=agency")), shared.bg + " " + shared.calls.join(" | "));

  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await new Promise((r) => setTimeout(r, 300));
  const posted = await page.evaluate(() => {
    const post = window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("location-theme") !== -1).pop();
    return post ? JSON.parse(post.body) : null;
  });
  check("save records the user hint for this location", posted && posted.locationId && posted.locationId.indexOf("loc55") !== -1 && posted.userId === "ag-1" && posted.userEmail === "owner@lynkific.com", JSON.stringify(posted && { locationId: posted.locationId, userId: posted.userId, userEmail: posted.userEmail, userType: posted.userType }));

  await page.evaluate(() => { window.__themeStatus = 404; window.__calls = []; });
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await new Promise((r) => setTimeout(r, 300));
  const fallbackSave = await page.evaluate(() => document.querySelector(".sai-tb-status")?.textContent || "");
  check("undeployed function falls back to this browser", /this browser only/i.test(fallbackSave), fallbackSave);
  await page.evaluate(() => { window.__themeStatus = 400; window.__themeError = "Only a confirmed agency user or sub-account admin can save a shared theme."; });
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await new Promise((r) => setTimeout(r, 300));
  const refused = await page.evaluate(() => document.querySelector(".sai-tb-status")?.textContent || "");
  check("a refused shared save shows the server reason", /confirmed agency user/i.test(refused) && !/aren't available until location-theme is deployed/i.test(refused), refused);
  await page.evaluate(() => { window.__themeStatus = 200; window.__themeError = ""; });
  await page.evaluate(() => {
    window.__calls = [];
    delete window.AppUtils;
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      user: { type: "", role: "", email: "", id: "", companyId: "" },
      builderAccess: "all",
      saveToken: "aaaaaaaaaa.bbbbbbbbbb",
    }));
  });
  await page.waitForSelector(".sai-tb-open");
  await page.click(".sai-tb-open");
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await new Promise((r) => setTimeout(r, 500));
  const tokenSave = await page.evaluate(() => {
    const post = window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("location-theme") !== -1).pop();
    return {
      body: post ? JSON.parse(post.body) : null,
      status: document.querySelector(".sai-tb-status")?.textContent || "",
      note: document.querySelector(".sai-tb-install")?.hidden,
    };
  });
  check(
    "current install saves with the agency token when the tag has no user",
    !!tokenSave.body && tokenSave.body.userId === "" && tokenSave.body.saveToken === "aaaaaaaaaa.bbbbbbbbbb" && /Saved\./.test(tokenSave.status) && !/install tag/i.test(tokenSave.status) && tokenSave.note === true,
    JSON.stringify({ userId: tokenSave.body && tokenSave.body.userId, status: tokenSave.status, note: tokenSave.note }),
  );
  await page.evaluate(() => {
    window.__calls = [];
    window.AppUtils = {
      Utilities: {
        getCurrentUser: () => Promise.resolve({ id: "ag-live", email: "team@lynkific.com", type: "agency", role: "admin" }),
        getCompany: () => Promise.resolve({ id: "co-live", name: "Lynkific" }),
      },
    };
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      user: { type: "", role: "", email: "", id: "", companyId: "" },
      builderAccess: "all",
      saveToken: "aaaaaaaaaa.bbbbbbbbbb",
    }));
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.waitForSelector(".sai-tb-open");
  await page.click(".sai-tb-open");
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await new Promise((r) => setTimeout(r, 500));
  const pageUserSave = await page.evaluate(() => {
    const post = window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("location-theme") !== -1).pop();
    return post ? JSON.parse(post.body) : null;
  });
  check(
    "the page user is sent when the install tag has no user",
    pageUserSave && pageUserSave.userId === "ag-live" && pageUserSave.userEmail === "team@lynkific.com" && pageUserSave.userType === "agency" && pageUserSave.userRole === "admin" && pageUserSave.saveToken === "aaaaaaaaaa.bbbbbbbbbb",
    JSON.stringify(pageUserSave && { userId: pageUserSave.userId, userEmail: pageUserSave.userEmail, userType: pageUserSave.userType, userRole: pageUserSave.userRole }),
  );
  await page.evaluate(() => {
    window.__calls = [];
    const input = document.querySelector("[data-logo-file]");
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "logo.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 500));
  const uploaded = await page.evaluate(() => {
    const post = window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("theme-logo") !== -1).pop();
    return post && post.form;
  });
  check(
    "logo upload sends the page user with the agency token",
    uploaded && uploaded.userId === "ag-live" && uploaded.saveToken === "aaaaaaaaaa.bbbbbbbbbb" && uploaded.locationId && uploaded.locationId.indexOf("loc55") !== -1,
    JSON.stringify(uploaded),
  );
  const identifiedNote = await page.evaluate(() => document.querySelector(".sai-tb-install").hidden);
  check("updated install hides the script note", identifiedNote === true, String(identifiedNote));

  await page.evaluate(() => {
    window.__themes.locPaint = { inheritAgency: true };
    window.__logos.agency = "https://cdn.example/agency.png";
    delete window.__logos.locPaint;
    window.__deferLogoDelete = false;
    window.__calls = [];
    history.pushState({}, "", "/v2/location/locPaint/dashboard");
  });
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => {
    const input = document.querySelector("[data-logo-file]");
    const file = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "bekah.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 500));
  const painted = await page.evaluate(() => {
    const native = document.querySelector("#sidebar-v2 img.agency-logo, #sidebar-v2 img[alt*='logo' i]:not(.sai-logo-slot)");
    const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
    const nativeStyle = native ? getComputedStyle(native) : null;
    const save = document.querySelector('[data-act="save"]');
    return {
      status: document.querySelector(".sai-tb-status")?.textContent || "",
      slot: slot ? slot.getAttribute("src") : "",
      nativeSrc: native ? native.getAttribute("src") : "",
      nativeHidden: !!(native && (native.classList.contains("sai-logo-hidden") || nativeStyle.opacity === "0" || native.getBoundingClientRect().width <= 2)),
      saveDisabled: save ? save.disabled : true,
      stored: window.__logos.locPaint || "",
    };
  });
  check(
    "an uploaded logo replaces the agency image and leaves Save enabled",
    /Logo saved for this sub-account only/.test(painted.status) &&
      painted.slot === "https://cdn.example/uploaded.png" &&
      painted.nativeHidden &&
      painted.nativeSrc.indexOf("uploaded.png") === -1 &&
      painted.saveDisabled === false &&
      painted.stored === "https://cdn.example/uploaded.png",
    JSON.stringify(painted),
  );
  await page.evaluate(() => { window.__calls = []; document.querySelector('[data-act="save"]').click(); });
  await new Promise((r) => setTimeout(r, 500));
  const savedUpload = await page.evaluate(() => {
    const themePost = window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("location-theme") !== -1).pop();
    const deleted = window.__calls.filter((c) => c.method === "DELETE" && c.url.indexOf("theme-logo") !== -1);
    const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
    const save = document.querySelector('[data-act="save"]');
    return {
      theme: themePost ? JSON.parse(themePost.body) : null,
      deletes: deleted.length,
      slot: slot ? slot.getAttribute("src") : "",
      saveDisabled: save ? save.disabled : true,
      stored: window.__logos.locPaint || "",
    };
  });
  check(
    "saving after an upload keeps the sub-account logo",
    savedUpload.theme && savedUpload.theme.locationId === "locPaint" &&
      savedUpload.deletes === 0 &&
      savedUpload.slot === "https://cdn.example/uploaded.png" &&
      savedUpload.stored === "https://cdn.example/uploaded.png" &&
      savedUpload.saveDisabled === false,
    JSON.stringify(savedUpload),
  );
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locPaintB/dashboard"));
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locPaint/dashboard"));
  await new Promise((r) => setTimeout(r, 700));
  const uploadStuck = await page.evaluate(() => {
    const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
    const native = document.querySelector("#sidebar-v2 img.agency-logo, #sidebar-v2 img[alt*='logo' i]:not(.sai-logo-slot)");
    const nativeStyle = native ? getComputedStyle(native) : null;
    return {
      slot: slot ? slot.getAttribute("src") : "",
      nativeHidden: !!(native && (native.classList.contains("sai-logo-hidden") || nativeStyle.opacity === "0" || native.getBoundingClientRect().width <= 2)),
    };
  });
  check(
    "a refresh keeps the uploaded sub-account logo on the sidebar",
    uploadStuck.slot === "https://cdn.example/uploaded.png" && uploadStuck.nativeHidden,
    JSON.stringify(uploadStuck),
  );
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => { window.__deferLogoDelete = true; window.__calls = []; document.querySelector('[data-act="resetbrand"]').click(); });
  await new Promise((r) => setTimeout(r, 400));
  const resetReady = await page.evaluate(() => {
    const save = document.querySelector('[data-act="save"]');
    const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
    return {
      saveDisabled: save ? save.disabled : true,
      slot: slot ? slot.getAttribute("src") : "",
      pending: typeof window.__releaseLogoDelete === "function",
    };
  });
  check(
    "reset enables Save without waiting for the logo delete",
    resetReady.saveDisabled === false && resetReady.slot === "https://cdn.example/agency.png" && resetReady.pending === true,
    JSON.stringify(resetReady),
  );
  await page.evaluate(() => { if (window.__releaseLogoDelete) window.__releaseLogoDelete(); window.__deferLogoDelete = false; });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locPaintB/dashboard"));
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locPaint/dashboard"));
  await new Promise((r) => setTimeout(r, 700));
  const resetBack = await page.evaluate(() => {
    const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
    const native = document.querySelector("#sidebar-v2 img.agency-logo, #sidebar-v2 img[alt*='logo' i]:not(.sai-logo-slot)");
    return {
      slot: slot ? slot.getAttribute("src") : "",
      native: native ? native.getAttribute("src") : "",
      stored: Object.prototype.hasOwnProperty.call(window.__logos, "locPaint") ? window.__logos.locPaint : null,
      agency: window.__logos.agency || "",
    };
  });
  check(
    "reset then refresh shows the agency logo",
    resetBack.slot === "https://cdn.example/agency.png" &&
      resetBack.native.indexOf("uploaded.png") === -1 &&
      resetBack.stored == null &&
      resetBack.agency === "https://cdn.example/agency.png",
    JSON.stringify(resetBack),
  );

  await page.goto(`${base}/v2/location/locA/dashboard?sidebar=${encodeURIComponent("#ffffff")}`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      user: { type: "agency", role: "admin", email: "owner@lynkific.com", id: "ag-1", companyId: "co-1" },
      builderAccess: "all",
    }));
  });
  await page.waitForSelector(".sai-tb-open");
  async function setLogo(url) {
    await page.evaluate(() => document.querySelector(".sai-tb-open").click());
    await page.waitForSelector(".sai-tb.open");
    await page.evaluate((next) => {
      const field = document.querySelector('[data-field="logoUrl"]');
      field.value = next;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }, url);
    await page.evaluate(() => document.querySelector('[data-act="save"]').click());
    await new Promise((r) => setTimeout(r, 350));
  }
  async function readLogos() {
    return page.evaluate(() => {
      const hl = document.getElementById("hl-logo");
      const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
      const slots = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.indexOf("sai_logo_slot_v1:") === 0) slots[key] = localStorage.getItem(key);
      }
      return {
        hl: hl && hl.getAttribute("src"),
        slot: slot ? slot.getAttribute("src") : "",
        route: window.SAITheme.stats().route,
        slots,
        posts: window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("theme-logo") !== -1).map((c) => JSON.parse(c.body)),
      };
    });
  }
  await setLogo("https://cdn.example/a.png");
  const locA = await readLogos();
  check("sub-account logo stays on that location", locA.route === "locA" && locA.slot === "https://cdn.example/a.png" && locA.hl === "https://cdn.example/highlevel.png" && locA.posts.some((p) => p.locationId === "locA" && p.logoUrl === "https://cdn.example/a.png") && !locA.posts.some((p) => p.locationId === "agency"), JSON.stringify({ route: locA.route, slot: locA.slot, hl: locA.hl, posts: locA.posts }));
  await page.evaluate(() => { window.__calls = []; history.pushState({}, "", "/v2/location/locB/dashboard"); });
  await new Promise((r) => setTimeout(r, 300));
  const locB = await readLogos();
  check("second sub-account does not take the first logo", locB.route === "locB" && locB.slot !== "https://cdn.example/a.png" && locB.hl === "https://cdn.example/highlevel.png", JSON.stringify(locB));
  await page.evaluate(() => history.pushState({}, "", "/agency"));
  await new Promise((r) => setTimeout(r, 300));
  const agencyBefore = await readLogos();
  check("agency view does not take the sub-account logo", agencyBefore.route === "agency" && agencyBefore.slot !== "https://cdn.example/a.png", JSON.stringify(agencyBefore));
  await setLogo("https://cdn.example/agency.png");
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locB/dashboard"));
  await new Promise((r) => setTimeout(r, 300));
  const locBInherit = await readLogos();
  const locBSlot = Object.entries(locBInherit.slots).find(([key]) => key.endsWith(":locB"));
  check("sub-account without a logo inherits the agency logo", locBInherit.slot === "https://cdn.example/agency.png" && !locBSlot, locBInherit.slot + " " + JSON.stringify(locBInherit.slots));
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const inheritedPreview = await page.evaluate(() => {
    const img = document.querySelector(".sai-logo-preview");
    const field = document.querySelector('[data-field="logoUrl"]');
    const remove = document.querySelector('[data-act="removelogo"]');
    const scope = document.querySelector(".sai-logo-scope");
    return {
      src: img && img.hidden === false ? img.getAttribute("src") : "",
      field: field ? field.value : "",
      removeDisabled: !!(remove && remove.disabled),
      scope: scope ? scope.textContent : "",
    };
  });
  check(
    "logo section previews the agency logo without copying it into the save field",
    inheritedPreview.src === "https://cdn.example/agency.png" && inheritedPreview.field === "" && inheritedPreview.removeDisabled && /using the agency logo/i.test(inheritedPreview.scope),
    JSON.stringify(inheritedPreview),
  );
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locA/dashboard"));
  await new Promise((r) => setTimeout(r, 300));
  const locAKeeps = await readLogos();
  check("sub-account keeps its own logo", locAKeeps.slot === "https://cdn.example/a.png" && locAKeeps.hl === "https://cdn.example/highlevel.png", locAKeeps.slot);
  await page.evaluate(() => { window.__calls = []; });
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => document.querySelector('[data-act="resetbrand"]').click());
  await new Promise((r) => setTimeout(r, 500));
  const resetClearsLogo = await page.evaluate(() => {
    const themePost = window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("location-theme") !== -1).pop();
    const logoDelete = window.__calls.filter((c) => c.method === "DELETE" && c.url.indexOf("theme-logo") !== -1).pop();
    const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
    return {
      theme: themePost ? JSON.parse(themePost.body) : null,
      deleted: logoDelete ? JSON.parse(logoDelete.body) : null,
      slot: slot ? slot.getAttribute("src") : "",
      agencyLogo: window.__logos.agency || "",
      locationLogo: Object.prototype.hasOwnProperty.call(window.__logos, "locA") ? window.__logos.locA : null,
    };
  });
  check(
    "reset clears the sub-account logo override",
    resetClearsLogo.theme && resetClearsLogo.theme.locationId === "locA" && resetClearsLogo.theme.theme && resetClearsLogo.theme.theme.inheritAgency === true && !resetClearsLogo.theme.theme.sidebarBg &&
      resetClearsLogo.deleted && resetClearsLogo.deleted.locationId === "locA" &&
      resetClearsLogo.slot === "https://cdn.example/agency.png" &&
      resetClearsLogo.locationLogo == null &&
      resetClearsLogo.agencyLogo === "https://cdn.example/agency.png",
    JSON.stringify(resetClearsLogo),
  );
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locB/dashboard"));
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locA/dashboard"));
  await new Promise((r) => setTimeout(r, 500));
  const resetSticks = await readLogos();
  const resetSlot = Object.entries(resetSticks.slots).find(([key]) => key.endsWith(":locA"));
  check(
    "a later visit does not restore a reset sub-account logo",
    resetSticks.slot === "https://cdn.example/agency.png" && (!resetSlot || resetSlot[1] === '""' || resetSlot[1] === ""),
    JSON.stringify({ slot: resetSticks.slot, stored: resetSlot && resetSlot[1] }),
  );
  await setLogo("https://cdn.example/a.png");
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => document.querySelector('[data-act="removelogo"]').click());
  await new Promise((r) => setTimeout(r, 350));
  const locACleared = await readLogos();
  check("clearing a sub-account logo inherits the agency logo again", locACleared.slot === "https://cdn.example/agency.png", locACleared.slot);
  const clearedField = await page.evaluate(() => document.querySelector('[data-field="logoUrl"]').value);
  check("remove clears the logo link field", clearedField === "", clearedField);
  await page.evaluate(() => document.querySelector('[data-act="resetbrand"]').click());
  await new Promise((r) => setTimeout(r, 400));
  const resetPost = await page.evaluate(() => {
    const post = window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("location-theme") !== -1).pop();
    return post ? JSON.parse(post.body) : null;
  });
  check("reset stores an inherit flag instead of copied colors", resetPost && resetPost.locationId === "locA" && resetPost.theme && resetPost.theme.inheritAgency === true && !resetPost.theme.sidebarBg, JSON.stringify(resetPost && resetPost.theme));
  const designSource = readFileSync(resolve(ROOT, "src/components/design/DesignPageView.tsx"), "utf8");
  const snippet = installSnippets("saassuite").js;
  check("design page shows the install update", designSource.includes("THEME_INSTALL_UPDATE_NOTE") && designSource.includes("Leave your Custom CSS line"), THEME_INSTALL_UPDATE_NOTE);
  check("lynkific snippet carries the user fields", snippet.includes("agency_id=saassuite") && snippet.includes('data-user-type="{{user.type}}"') && snippet.includes('data-company-id="{{user.companyId}}"'), snippet);

  await page.evaluate(() => history.pushState({}, "", "/dashboard?location_id=locQuery"));
  await new Promise((r) => setTimeout(r, 250));
  const queryRoute = await page.evaluate(() => window.SAITheme.stats().route);
  check("query location id keys the sub-account", queryRoute === "locQuery", queryRoute);

  await page.evaluate(() => history.pushState({}, "", "/dashboard#/v2/location/locHash/conversations"));
  await new Promise((r) => setTimeout(r, 250));
  const hashRoute = await page.evaluate(() => window.SAITheme.stats().route);
  check("hash location id keys the sub-account", hashRoute === "locHash", hashRoute);

  await page.evaluate(() => {
    document.body.classList.add("sidebar-v2-location");
    document.querySelectorAll("#sidebar-v2 a[href]").forEach((a) => a.setAttribute("href", "/v2/location/locSide/dashboard"));
    history.pushState({}, "", "/dashboard");
  });
  await new Promise((r) => setTimeout(r, 250));
  const sideRoute = await page.evaluate(() => window.SAITheme.stats().route);
  check("location sidebar links key the sub-account when the URL has no id", sideRoute === "locSide", sideRoute);
  await page.evaluate(() => { window.__calls = []; });
  await setLogo("https://cdn.example/side.png");
  const sideLogo = await readLogos();
  check("sidebar-scoped upload does not write the agency logo", sideLogo.route === "locSide" && sideLogo.slot === "https://cdn.example/side.png" && sideLogo.hl === "https://cdn.example/highlevel.png" && sideLogo.posts.some((p) => p.locationId === "locSide") && !sideLogo.posts.some((p) => p.locationId === "agency"), JSON.stringify({ route: sideLogo.route, slot: sideLogo.slot, hl: sideLogo.hl, posts: sideLogo.posts }));

  await page.evaluate(() => {
    document.body.classList.remove("sidebar-v2-location");
    document.body.classList.add("sidebar-v2-agency");
    const links = document.querySelectorAll("#sidebar-v2 nav a");
    if (links[0]) links[0].setAttribute("href", "/v2/location/aaa11111/dashboard");
    if (links[1]) links[1].setAttribute("href", "/v2/location/bbb22222/dashboard");
    history.pushState({}, "", "/agency_dashboard");
  });
  await new Promise((r) => setTimeout(r, 250));
  const agencyListRoute = await page.evaluate(() => window.SAITheme.stats().route);
  check("agency view stays the agency key when the sidebar lists many locations", agencyListRoute === "agency", agencyListRoute);

  await page.evaluate(() => {
    document.body.classList.remove("sidebar-v2-agency");
    document.body.classList.add("sidebar-v2-location");
    window.__calls = [];
    history.pushState({}, "", "/launchpad");
  });
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => {
    const field = document.querySelector('[data-hex="sidebarBg"]');
    field.value = "#112233";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await new Promise((r) => setTimeout(r, 300));
  const blockedSave = await page.evaluate(() => ({
    status: document.querySelector(".sai-tb-status")?.textContent || "",
    route: window.SAITheme.stats().route,
    posts: window.__calls.filter((c) => c.method === "POST").map((c) => c.body),
  }));
  check("a location page without one id does not save onto the agency", blockedSave.route === "agency" && /not saved onto the agency/i.test(blockedSave.status) && !blockedSave.posts.some((body) => body.indexOf('"locationId":"agency"') !== -1), JSON.stringify(blockedSave));

  await page.evaluate(() => {
    document.body.classList.remove("sidebar-v2-location");
    history.pushState({}, "", "/v2/location/locColor/dashboard");
    window.__calls = [];
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => {
    const field = document.querySelector('[data-hex="sidebarBg"]');
    field.value = "#123456";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await new Promise((r) => setTimeout(r, 400));
  const colorPost = await page.evaluate(() => {
    const posts = window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("location-theme") !== -1).map((c) => JSON.parse(c.body));
    return { route: window.SAITheme.stats().route, posts };
  });
  check("sub-account color save stays on that location", colorPost.route === "locColor" && colorPost.posts.some((p) => p.locationId === "locColor" && p.theme && p.theme.sidebarBg === "#123456") && !colorPost.posts.some((p) => p.locationId === "agency"), JSON.stringify(colorPost.posts.map((p) => ({ locationId: p.locationId, sidebarBg: p.theme && p.theme.sidebarBg }))));

  await page.evaluate(() => history.pushState({}, "", "/v2/location/locOther/dashboard"));
  await new Promise((r) => setTimeout(r, 900));
  const otherBg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sai-sb-bg").trim());
  check("another sub-account does not take the saved color", otherBg.toLowerCase() !== "rgb(18, 52, 86)" && otherBg.toLowerCase() !== "#123456", otherBg);

  await page.evaluate(() => {
    history.pushState({}, "", "/v2/location/locA/dashboard");
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { brandingVersion: "v2" }));
  });
  await page.waitForSelector(".sai-tb-open");
  await setLogo("https://cdn.example/v2.png");
  const v2Logo = await page.evaluate(() => {
    const hl = document.getElementById("hl-logo");
    const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
    const style = hl ? getComputedStyle(hl) : null;
    return {
      saiOn: document.documentElement.classList.contains("sai-on"),
      src: hl && hl.getAttribute("src"),
      opacity: style && style.opacity,
      width: style && style.width,
      slot: slot && slot.getAttribute("src"),
    };
  });
  check("classic branding hides the shared logo without changing its src", v2Logo.saiOn === false && v2Logo.src === "https://cdn.example/highlevel.png" && v2Logo.slot === "https://cdn.example/v2.png" && (v2Logo.opacity === "0" || parseFloat(v2Logo.width) <= 2), JSON.stringify(v2Logo));

  await page.evaluate(() => {
    document.body.classList.remove("sidebar-v2-location", "sidebar-v2-agency");
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { brandingVersion: "v3" }));
  });
  await page.waitForSelector(".sai-tb-open");

  const lateStart = Date.now();
  await page.evaluate(() => {
    const old = document.querySelector("#sidebar-v2");
    if (old) old.remove();
    const sb = document.createElement("aside");
    sb.id = "sidebar-v2";
    sb.innerHTML = '<img id="hl-logo" alt="Agency logo" src="https://cdn.example/highlevel.png"><nav><a id="sb_dashboard"><span class="nav-title">Dashboard</span></a><a id="sb_reporting"><span class="nav-title">Reporting</span></a></nav>';
    document.body.prepend(sb);
  });
  await page.waitForSelector("#sidebar-v2 .sai-tb-open", { timeout: 1500 });
  const lateMs = Date.now() - lateStart;
  const lateCount = await page.evaluate(() => document.querySelectorAll(".sai-tb-open").length);
  check("button attaches as soon as the sidebar exists", lateMs < 1000 && lateCount === 1, `ms=${lateMs} count=${lateCount}`);
  await page.evaluate(() => {
    document.querySelector("#sidebar-v2").innerHTML = '<nav><a id="sb_conversations"><span class="nav-title">Conversations</span></a></nav>';
  });
  await page.waitForSelector("#sidebar-v2 .sai-tb-open", { timeout: 1500 });
  const replaced = await page.evaluate(() => document.querySelectorAll(".sai-tb-open").length);
  check("button comes back after the sidebar is re-rendered", replaced === 1, String(replaced));
  await page.evaluate(() => document.querySelector("#sidebar-v2")?.remove());
  const nestedStart = Date.now();
  await page.evaluate(() => {
    const app = document.createElement("div");
    const shell = document.createElement("div");
    const mount = document.createElement("div");
    const sb = document.createElement("aside");
    sb.id = "sidebar-v2";
    sb.innerHTML = '<div class="hl_nav-header"><nav><a id="sb_dashboard"><span class="nav-title">Dashboard</span></a></nav></div>';
    mount.appendChild(sb);
    shell.appendChild(mount);
    app.appendChild(shell);
    document.body.prepend(app);
  });
  await page.waitForSelector("#sidebar-v2 .sai-tb-open", { timeout: 1000 });
  const nestedMs = Date.now() - nestedStart;
  const nestedCount = await page.evaluate(() => document.querySelectorAll(".sai-tb-open").length);
  check("button attaches when a nested sidebar mounts", nestedMs < 1000 && nestedCount === 1, `ms=${nestedMs} count=${nestedCount}`);

  await page.goto(`${base}/v2/location/locKls/dashboard?sidebar=${encodeURIComponent("#F9A8D4")}`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, {
        sidebarBg: "#F9A8D4",
        sidebarBgEnd: "#F9A8D4",
        sidebarText: "#98A2B3",
        iconPack: "lucide",
        motion: false,
      }),
    }));
  });
  await new Promise((r) => setTimeout(r, 500));
  const pink = await page.evaluate(() => {
    const label = document.querySelector(".sai-tb-label");
    const input = document.querySelector("#sb-search");
    const sb = document.querySelector("#sidebar-v2");
    return {
      label: getComputedStyle(label).color,
      input: getComputedStyle(input).color,
      placeholder: getComputedStyle(input, "::placeholder").color,
      sidebar: getComputedStyle(sb).backgroundColor,
      token: getComputedStyle(document.documentElement).getPropertyValue("--sai-sb-bg").trim(),
      icons: [...document.querySelectorAll("#sidebar-v2 a[id^='sb_']")].map((a) => {
        const host = a.parentElement && a.parentElement.classList.contains("sb-row") ? a.parentElement : a;
        const natives = [...host.querySelectorAll("svg, i, img, .hl-mask-icon")].filter((n) => !n.closest(".sai-ico"));
        return {
          id: a.id,
          custom: host.querySelectorAll(".sai-ico[data-sai-nav]").length,
          marked: a.getAttribute("data-sai-icon"),
          nativeHidden: natives.length > 0 && natives.every((n) => n.getAttribute("data-sai-native") === "1" && getComputedStyle(n).display === "none"),
        };
      }),
      lock: window.__SAI_THEME_LOCK === "theme-builder",
    };
  });
  const pinkBg = rgb("#F9A8D4");
  const labelRatio = contrast(rgb(pink.label), pinkBg);
  const inputRatio = contrast(rgb(pink.input), pinkBg);
  const placeholderRatio = contrast(rgb(pink.placeholder), pinkBg);
  check("pink sidebar button and search clear 4.5", labelRatio >= 4.5 && inputRatio >= 4.5 && placeholderRatio >= 4.5 && !/152,\s*162,\s*179/.test(pink.label + pink.input), `label=${labelRatio.toFixed(2)} ${pink.label} input=${inputRatio.toFixed(2)} ${pink.input} placeholder=${placeholderRatio.toFixed(2)}`);
  check("one replacement icon and the original svg is hidden", pink.lock && pink.icons.length === 8 && pink.icons.every((row) => row.custom === 1 && row.marked === "1" && row.nativeHidden), JSON.stringify(pink.icons));
  await shot(page, "button-pink-sidebar");
  await page.evaluate(() => {
    document.querySelectorAll("#sidebar-v2 a[id^='sb_']").forEach((a) => {
      const ico = a.querySelector(".sai-ico[data-sai-nav]");
      if (ico) a.appendChild(ico.cloneNode(true));
    });
    const extra = document.createElement("div");
    extra.className = "sai-tb-trigger";
    document.querySelector("#sidebar-v2").appendChild(extra);
    const refresh = document.createElement("span");
    refresh.className = "hl-nav-refresh";
    document.querySelector("#sidebar-v2 nav").appendChild(refresh);
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      agencyKey: "agency-kls",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, {
        sidebarBg: "#F9A8D4",
        sidebarBgEnd: "#F9A8D4",
        sidebarText: "#98A2B3",
        iconPack: "lucide",
        motion: false,
      }),
    }));
  });
  await new Promise((r) => setTimeout(r, 600));
  const replayed = await page.evaluate(() => ({
    triggers: document.querySelectorAll(".sai-tb-trigger").length,
    icons: [...document.querySelectorAll("#sidebar-v2 a[id^='sb_']")].map((a) => {
      const host = a.parentElement && a.parentElement.classList.contains("sb-row") ? a.parentElement : a;
      return host.querySelectorAll(".sai-ico[data-sai-nav]").length;
    }),
  }));
  check("a second pass reuses injected nodes", replayed.triggers === 1 && replayed.icons.every((n) => n === 1), JSON.stringify(replayed));
  const beforeSecondScript = await page.evaluate(() => document.querySelectorAll(".sai-ico[data-sai-nav]").length);
  await page.evaluate(() => { window.__stashTheme = window.SAITheme; delete window.SAITheme; });
  await page.addScriptTag({ url: `${base}/theme-builder.js?again=1` });
  await new Promise((r) => setTimeout(r, 200));
  const locked = await page.evaluate((before) => {
    const icons = document.querySelectorAll(".sai-ico[data-sai-nav]").length;
    const held = window.SAITheme == null && window.__SAI_THEME_LOCK === "theme-builder";
    window.SAITheme = window.__stashTheme;
    return { held, icons, before };
  }, beforeSecondScript);
  check("run-once lock ignores a second script", locked.held && locked.icons === locked.before, JSON.stringify(locked));
  const beforeLegacy = await page.evaluate(() => document.querySelectorAll(".sai-ico[data-sai-nav]").length);
  await page.addScriptTag({ url: `${base}/sai-theme-saassuite.js?project=bsrdbqgpafipcbbqxvte` });
  await new Promise((r) => setTimeout(r, 500));
  const both = await page.evaluate((before) => ({
    deferred: window.__SAI_OLD_DEFERRED === true,
    owner: window.__SAI_THEME_ICON_OWNER,
    icons: [...document.querySelectorAll("#sidebar-v2 a[id^='sb_']")].map((a) => {
      const host = a.parentElement && a.parentElement.classList.contains("sb-row") ? a.parentElement : a;
      return host.querySelectorAll(".sai-ico[data-sai-nav]").length;
    }),
    before,
  }), beforeLegacy);
  check("old build defers when the new runtime already owns the page", both.deferred && both.owner === "theme-builder" && both.icons.every((n) => n === 1) && both.icons.length === both.before, JSON.stringify(both));
  await page.evaluate(() => { document.querySelector("#sidebar-v2").style.width = "72px"; });
  await new Promise((r) => setTimeout(r, 300));
  const collapsed = await page.evaluate(() => {
    const trigger = document.querySelector(".sai-tb-trigger").getBoundingClientRect();
    const label = getComputedStyle(document.querySelector(".sai-tb-label"));
    const search = document.querySelector(".sidebar-search").getBoundingClientRect();
    const overlapX = Math.min(trigger.right, search.right) - Math.max(trigger.left, search.left);
    const overlapY = Math.min(trigger.bottom, search.bottom) - Math.max(trigger.top, search.top);
    const slot = document.querySelector("#sidebar-v2 img.sai-logo-slot");
    const logoNode = slot && getComputedStyle(slot).opacity !== "0" ? slot : document.getElementById("hl-logo");
    const logo = logoNode.getBoundingClientRect();
    const side = document.querySelector("#sidebar-v2").getBoundingClientRect();
    return {
      flag: document.documentElement.classList.contains("sai-sb-collapsed"),
      width: trigger.width,
      label: label.display,
      search: getComputedStyle(document.querySelector(".sidebar-search")).display,
      overlap: overlapX > 0 && overlapY > 0 ? Math.min(overlapX, overlapY) : 0,
      logoH: Math.round(logo.height),
      logoW: Math.round(logo.width),
      sideW: Math.round(side.width),
    };
  });
  check("collapsed sidebar is icon-only and hides search", collapsed.flag && collapsed.width > 20 && collapsed.width < 48 && collapsed.label === "none" && collapsed.search === "none" && collapsed.overlap < 2, JSON.stringify(collapsed));
  check("collapsed sidebar keeps the logo inside the rail", collapsed.logoH <= 34 && collapsed.logoH >= 8 && collapsed.logoW <= collapsed.sideW && collapsed.logoW <= 64, JSON.stringify(collapsed));
  const collapsedIcons = await page.evaluate(() => {
    const sb = document.querySelector("#sidebar-v2");
    const trigger = document.querySelector(".sai-tb-trigger");
    const open = document.querySelector(".sai-tb-open");
    const ico = document.querySelector("#sidebar-v2 .sai-ico[data-sai-nav]");
    const rows = [...document.querySelectorAll("#sidebar-v2 a[id^='sb_']")].map((a) => {
      const host = a.parentElement && a.parentElement.classList.contains("sb-row") ? a.parentElement : a;
      const natives = [...host.querySelectorAll("svg, i, img, .hl-mask-icon")].filter((n) => !n.closest(".sai-ico"));
      const title = a.querySelector(".nav-title");
      return {
        custom: host.querySelectorAll(".sai-ico[data-sai-nav]").length,
        nativeHidden: natives.length > 0 && natives.every((n) => getComputedStyle(n).display === "none"),
        title: title ? getComputedStyle(title).display : "none",
      };
    });
    return {
      rows,
      opener: getComputedStyle(document.getElementById("globalSearchOpener")).display,
      shortcut: getComputedStyle(document.querySelector(".search-shortcut")).display,
      triggerBg: getComputedStyle(trigger).backgroundColor,
      triggerFg: getComputedStyle(open).webkitTextFillColor || getComputedStyle(open).color,
      iconBg: ico ? getComputedStyle(ico).backgroundColor : "",
      sidebarBg: getComputedStyle(sb).backgroundColor,
    };
  });
  const pinkSurface = rgb("#F9A8D4");
  const collapsedButton = contrast(rgb(collapsedIcons.triggerFg), pinkSurface);
  const collapsedIcon = contrast(rgb(collapsedIcons.iconBg), pinkSurface);
  check(
    "collapsed sidebar keeps one icon and readable contrast",
    collapsedIcons.rows.length === 8 &&
      collapsedIcons.rows.every((row) => row.custom === 1 && row.nativeHidden && row.title === "none") &&
      collapsedIcons.opener === "none" &&
      collapsedIcons.shortcut === "none" &&
      collapsedButton >= 4.5 &&
      collapsedIcon >= 4.5,
    JSON.stringify({ button: Number(collapsedButton.toFixed(2)), icon: Number(collapsedIcon.toFixed(2)), opener: collapsedIcons.opener, rows: collapsedIcons.rows.length, iconBg: collapsedIcons.iconBg, triggerFg: collapsedIcons.triggerFg, sidebarBg: collapsedIcons.sidebarBg }),
  );
  await shot(page, "sidebar-collapsed");
  const collapsedWide = await page.evaluate(() => {
    const link = document.createElement("link");
    link.rel = "apple-touch-icon";
    link.href = "https://cdn.example/mark.png";
    document.head.appendChild(link);
    const logo = document.getElementById("hl-logo");
    logo.setAttribute("width", "800");
    logo.setAttribute("height", "80");
    logo.removeAttribute("data-sai-full");
    logo.removeAttribute("data-sai-full-ratio");
    logo.removeAttribute("data-sai-mark");
    const sb = document.querySelector("#sidebar-v2");
    sb.style.width = "80px";
    return new Promise((resolve) => {
      setTimeout(() => {
        sb.style.width = "72px";
        setTimeout(() => {
          const node = document.getElementById("hl-logo");
          const rect = node.getBoundingClientRect();
          const side = sb.getBoundingClientRect();
          const result = {
            src: node.getAttribute("src") || "",
            h: Math.round(rect.height),
            w: Math.round(rect.width),
            sideW: Math.round(side.width),
          };
          node.setAttribute("src", "https://cdn.example/highlevel.png");
          node.setAttribute("width", "400");
          node.setAttribute("height", "400");
          node.removeAttribute("data-sai-full");
          node.removeAttribute("data-sai-full-ratio");
          node.removeAttribute("data-sai-mark");
          link.remove();
          sb.style.width = "73px";
          setTimeout(() => { sb.style.width = "72px"; resolve(result); }, 250);
        }, 300);
      }, 80);
    });
  });
  check(
    "collapsed wide logo uses a square mark inside the rail",
    collapsedWide.src.indexOf("mark.png") !== -1 && collapsedWide.h <= 34 && collapsedWide.w <= collapsedWide.sideW + 2 && collapsedWide.w <= 40,
    JSON.stringify(collapsedWide),
  );
  const collapsedSwitcher = await page.evaluate(() => {
    const nav = document.querySelector("#sidebar-v2 nav");
    const a = document.createElement("a");
    a.id = "location-switcher-sidbar-v2";
    const name = document.createElement("span");
    name.textContent = "Bekah";
    const city = document.createElement("span");
    city.textContent = "Lewisville, TX";
    a.appendChild(name);
    a.appendChild(city);
    nav.appendChild(a);
    const title = document.querySelector("#sb_dashboard .nav-title");
    const result = {
      fontSize: getComputedStyle(a).fontSize,
      nameSize: getComputedStyle(name).fontSize,
      nameDisplay: getComputedStyle(name).display,
      anchorDisplay: getComputedStyle(a).display,
      text: a.innerText || a.textContent || "",
      titleDisplay: title ? getComputedStyle(title).display : "",
    };
    a.remove();
    return result;
  });
  check(
    "collapsed location switcher keeps HighLevel's own text",
    parseFloat(collapsedSwitcher.fontSize) > 0 &&
      parseFloat(collapsedSwitcher.nameSize) > 0 &&
      collapsedSwitcher.nameDisplay !== "none" &&
      collapsedSwitcher.anchorDisplay !== "none" &&
      collapsedSwitcher.text.includes("Bekah") &&
      collapsedSwitcher.text.includes("Lewisville, TX") &&
      !collapsedSwitcher.text.includes("·") &&
      collapsedSwitcher.titleDisplay === "none",
    JSON.stringify(collapsedSwitcher),
  );
  const liveSwitcher = await page.evaluate(() => {
    const nav = document.querySelector("#sidebar-v2 nav");
    const a = document.createElement("a");
    a.id = "sb_location";
    a.innerHTML = '<div class="hl_location-text"><span class="hl_switcher-loc-name">Bekah</span><span class="hl_switcher-loc-city">Lewisville, TX</span></div>';
    nav.appendChild(a);
    const name = a.querySelector(".hl_switcher-loc-name");
    const city = a.querySelector(".hl_switcher-loc-city");
    const title = document.querySelector("#sb_dashboard .nav-title");
    const result = {
      fontSize: getComputedStyle(a).fontSize,
      nameSize: getComputedStyle(name).fontSize,
      citySize: getComputedStyle(city).fontSize,
      nameDisplay: getComputedStyle(name).display,
      cityDisplay: getComputedStyle(city).display,
      text: a.innerText || a.textContent || "",
      titleDisplay: title ? getComputedStyle(title).display : "",
    };
    a.remove();
    return result;
  });
  check(
    "collapsed switcher text shows when the anchor id is not location-switcher",
    parseFloat(liveSwitcher.fontSize) > 0 &&
      parseFloat(liveSwitcher.nameSize) > 0 &&
      parseFloat(liveSwitcher.citySize) > 0 &&
      liveSwitcher.nameDisplay !== "none" &&
      liveSwitcher.cityDisplay !== "none" &&
      liveSwitcher.text.includes("Bekah") &&
      liveSwitcher.text.includes("Lewisville, TX") &&
      !liveSwitcher.text.includes("·") &&
      liveSwitcher.titleDisplay === "none",
    JSON.stringify(liveSwitcher),
  );
  const activeIcon = await page.evaluate(() => {
    const a = document.getElementById("sb_launchpad");
    a.classList.add("active");
    a.setAttribute("aria-current", "page");
    return new Promise((resolve) => {
      setTimeout(() => {
        const ico = a.querySelector(".sai-ico[data-sai-nav]");
        const result = {
          icon: ico ? getComputedStyle(ico).backgroundColor : "",
          fill: getComputedStyle(a).backgroundColor,
          accentText: getComputedStyle(document.documentElement).getPropertyValue("--sai-accent-text").trim(),
        };
        a.classList.remove("active");
        a.removeAttribute("aria-current");
        resolve(result);
      }, 350);
    });
  });
  const activeContrast = contrast(rgb(activeIcon.icon), rgb(activeIcon.fill));
  check(
    "collapsed active item keeps a visible icon",
    !!activeIcon.icon && activeContrast >= 3 && rgb(activeIcon.icon) && rgb(activeIcon.fill),
    JSON.stringify({ contrast: Number(activeContrast.toFixed(2)), icon: activeIcon.icon, fill: activeIcon.fill, accentText: activeIcon.accentText }),
  );
  await page.evaluate(() => {
    const nav = document.querySelector("#sidebar-v2 nav");
    const emoji = document.createElement("a");
    emoji.id = "sb_custom_start";
    emoji.innerHTML = '<span class="nav-emoji">🚀</span><span class="nav-title">START HERE</span>';
    const image = document.createElement("a");
    image.id = "sb_custom_img";
    image.innerHTML = '<img alt="" src="https://cdn.example/start.png" width="18" height="18"><span class="nav-title">Guide</span>';
    nav.appendChild(emoji);
    nav.appendChild(image);
  });
  await new Promise((r) => setTimeout(r, 500));
  const customGlyphs = await page.evaluate(() => {
    function row(id) {
      const a = document.getElementById(id);
      const ico = a.querySelector(".sai-ico[data-sai-nav]");
      const img = a.querySelector("img");
      return {
        icon: ico ? getComputedStyle(ico).display : "missing",
        width: ico ? ico.getBoundingClientRect().width : 0,
        img: img ? getComputedStyle(img).display : "",
      };
    }
    const sw = document.getElementById("location-switcher");
    history.pushState({}, "", "/v2/location/felOQsKf0123456789ab/dashboard");
    sw.textContent = "felOQsKf0123456789ab";
    return { emoji: row("sb_custom_start"), image: row("sb_custom_img") };
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const scopeId = await page.evaluate(() => document.querySelector(".sai-tb-scope").textContent);
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  await page.evaluate(() => { document.getElementById("location-switcher").textContent = "Bekah\nfelOQsKf0123456789ab"; });
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const scopeName = await page.evaluate(() => document.querySelector(".sai-tb-scope").textContent);
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  check("collapsed custom image or emoji gets a fallback icon", customGlyphs.emoji.icon !== "none" && customGlyphs.emoji.icon !== "missing" && customGlyphs.emoji.width >= 12 && customGlyphs.image.icon !== "none" && customGlyphs.image.img === "none", JSON.stringify(customGlyphs));
  check("collapsed header uses the location name", scopeId === "For This sub-account" && scopeName === "For Bekah", JSON.stringify({ scopeId, scopeName }));
  await page.evaluate(() => {
    const sw = document.getElementById("location-switcher");
    sw.textContent = "";
    const name = document.createElement("span");
    name.textContent = "Bekah";
    const city = document.createElement("span");
    city.textContent = "Lewisville, TX";
    sw.appendChild(name);
    sw.appendChild(city);
  });
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const scopeCity = await page.evaluate(() => document.querySelector(".sai-tb-scope").textContent);
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  await page.evaluate(() => { document.getElementById("location-switcher").textContent = "BekahLewisville, TX"; });
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const scopeGlued = await page.evaluate(() => document.querySelector(".sai-tb-scope").textContent);
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  await page.evaluate(() => { document.getElementById("location-switcher").textContent = "Bekah Lewisville, TX"; });
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const scopeSpaced = await page.evaluate(() => document.querySelector(".sai-tb-scope").textContent);
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  await page.evaluate(() => { document.getElementById("location-switcher").textContent = "McAllen, TX"; });
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const scopeCityOnly = await page.evaluate(() => document.querySelector(".sai-tb-scope").textContent);
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  check(
    "collapsed header separates the account name from the city",
    scopeCity === "For Bekah · Lewisville, TX" && scopeGlued === "For Bekah · Lewisville, TX" && scopeSpaced === "For Bekah Lewisville, TX" && scopeCityOnly === "For McAllen, TX",
    JSON.stringify({ scopeCity, scopeGlued, scopeSpaced, scopeCityOnly }),
  );
  await page.evaluate(() => {
    document.getElementById("sb_custom_start")?.remove();
    document.getElementById("sb_custom_img")?.remove();
    document.querySelector('[data-act="close"]')?.click();
  });
  await page.evaluate((src) => {
    window.SAI_THEME_CONFIG = Object.assign({}, window.SAI_THEME_CONFIG, {
      agencyKey: "agency-switched",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, {
        sidebarBg: "#111827",
        sidebarBgEnd: "#111827",
        sidebarText: "auto",
        iconPack: "lucide",
        motion: false,
      }),
    });
    const s = document.createElement("script");
    s.src = src;
    s.setAttribute("data-agency-key", "agency-switched");
    s.setAttribute("data-user-type", "agency");
    s.setAttribute("data-user-role", "admin");
    s.setAttribute("data-user-email", "owner@lynkific.test");
    document.body.appendChild(s);
  }, `${base}/theme-builder.js?agency=switched`);
  await new Promise((r) => setTimeout(r, 700));
  const switched = await page.evaluate(() => ({
    lock: window.__SAI_THEME_LOCK,
    build: window.SAITheme && window.SAITheme.__build,
    pending: !!(window.SAITheme && window.SAITheme.__pending),
    bg: document.documentElement.style.getPropertyValue("--sai-sb-bg"),
    triggers: document.querySelectorAll(".sai-tb-trigger").length,
    icons: [...document.querySelectorAll("#sidebar-v2 a[id^='sb_']")].map((a) => {
      const host = a.parentElement && a.parentElement.classList.contains("sb-row") ? a.parentElement : a;
      return host.querySelectorAll(".sai-ico[data-sai-nav]").length;
    }),
  }));
  check(
    "agency switch re-inits the same runtime",
    switched.lock === "theme-builder" && switched.build === "theme-builder" && !switched.pending && switched.bg.toLowerCase() === "#111827" && switched.triggers === 1 && switched.icons.length === 8 && switched.icons.every((n) => n === 1),
    JSON.stringify(switched),
  );
  await page.evaluate(() => {
    history.pushState({}, "", "/v2/location/locSwitch/dashboard");
    const sb = document.querySelector("#sidebar-v2");
    sb.innerHTML = '<div id="location-switcher">Other account</div><nav><a id="sb_dashboard" href="/v2/location/locSwitch/dashboard"><svg class="hl-nav-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><span class="nav-title">Dashboard</span></a><a id="sb_payments" href="/v2/location/locSwitch/dashboard"><svg class="hl-nav-icon" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><span class="nav-title">Payments</span></a></nav>';
  });
  await new Promise((r) => setTimeout(r, 800));
  const moved = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#sidebar-v2 a[id^='sb_']")].map((a) => {
      const natives = [...a.querySelectorAll("svg, i, img")].filter((n) => !n.closest(".sai-ico"));
      return {
        id: a.id,
        custom: a.querySelectorAll(".sai-ico[data-sai-nav]").length,
        nativeHidden: natives.length > 0 && natives.every((n) => getComputedStyle(n).display === "none"),
        title: getComputedStyle(a.querySelector(".nav-title")).display,
      };
    });
    const ico = document.querySelector("#sidebar-v2 .sai-ico[data-sai-nav]");
    const sb = document.querySelector("#sidebar-v2");
    return {
      path: location.pathname,
      collapsed: document.documentElement.classList.contains("sai-sb-collapsed"),
      triggers: document.querySelectorAll(".sai-tb-trigger").length,
      rows,
      iconBg: ico ? getComputedStyle(ico).backgroundColor : "",
      sidebarBg: getComputedStyle(sb).backgroundColor,
      bg: document.documentElement.style.getPropertyValue("--sai-sb-bg"),
    };
  });
  const movedIcon = contrast(rgb(moved.iconBg), rgb("#111827"));
  check(
    "sub-account switch rebuilds one icon on the new sidebar",
    moved.path.endsWith("/locSwitch/dashboard") && moved.collapsed && moved.triggers === 1 && moved.bg.toLowerCase() === "#111827" && moved.rows.length === 2 && moved.rows.every((row) => row.custom === 1 && row.nativeHidden && row.title === "none") && movedIcon >= 4.5,
    JSON.stringify({ path: moved.path, icon: Number(movedIcon.toFixed(2)), rows: moved.rows, bg: moved.bg, sidebarBg: moved.sidebarBg }),
  );

  await page.goto(`${base}/v2/location/locKls/dashboard?sidebar=${encodeURIComponent("#F9A8D4")}&legacy=1`, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => window.__SAI_OLD_INJECT && window.__SAI_OLD_INJECT());
  const legacyFirst = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#sidebar-v2 a[id^='sb_']")].map((a) => {
      const host = a.parentElement && a.parentElement.classList.contains("sb-row") ? a.parentElement : a;
      const natives = [...host.querySelectorAll("svg, i, img, .hl-mask-icon")].filter((n) => !n.closest(".sai-ico"));
      return {
        id: a.id,
        custom: host.querySelectorAll(".sai-ico").length,
        marked: a.getAttribute("data-sai-icon"),
        nativeHidden: natives.length > 0 && natives.every((n) => getComputedStyle(n).display === "none"),
      };
    });
    return {
      ran: window.__SAI_OLD_RAN === true,
      lock: window.__SAI_THEME_LOCK,
      owner: window.__SAI_THEME_ICON_OWNER,
      build: window.SAITheme && window.SAITheme.__build,
      rows,
    };
  });
  check(
    "old and new scripts leave a single hidden original",
    legacyFirst.ran && legacyFirst.lock === "legacy" && legacyFirst.owner === "theme-builder" && legacyFirst.build === "legacy" && legacyFirst.rows.length === 8 && legacyFirst.rows.every((row) => row.custom === 1 && row.marked === "1" && row.nativeHidden),
    JSON.stringify(legacyFirst),
  );

  await page.goto(`${base}/v2/location/locKls/dashboard?sidebar=${encodeURIComponent("transparent")}`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    const sb = document.querySelector("#sidebar-v2");
    sb.style.background = "transparent";
    sb.style.border = "8px solid #6d28d9";
    const rail = document.createElement("div");
    rail.id = "purple-rail";
    const fill = document.createElement("div");
    fill.id = "pink-fill";
    sb.prepend(fill);
    sb.prepend(rail);
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      brandingVersion: "v1",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, {
        sidebarBg: "#0E1A3A",
        sidebarBgEnd: "#0E1A3A",
        sidebarText: "#F8FAFC",
        iconPack: "lucide",
        motion: false,
      }),
    }));
  });
  await new Promise((r) => setTimeout(r, 500));
  const rail = await page.evaluate(() => {
    const label = document.querySelector(".sai-tb-label");
    const input = document.querySelector("#sb-search");
    return {
      label: getComputedStyle(label).webkitTextFillColor || getComputedStyle(label).color,
      input: getComputedStyle(input).webkitTextFillColor || getComputedStyle(input).color,
    };
  });
  const railLabel = contrast(rgb(rail.label), rgb("#F9A8D4"));
  const railInput = contrast(rgb(rail.input), rgb("#F9A8D4"));
  check("pink fill with a purple rail keeps dark text", railLabel >= 4.5 && railInput >= 4.5, `label=${railLabel.toFixed(2)} ${rail.label} input=${railInput.toFixed(2)} ${rail.input}`);

  await page.goto(`${base}/v2/location/loc123/sites?sidebar=${encodeURIComponent("#ffffff")}`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  const decoyDuringSites = await page.evaluate(() => {
    const card = document.querySelector("#sb_decoy");
    if (!card) return { missing: true };
    return { shown: getComputedStyle(card).display !== "none", marked: card.className.includes("sai-"), icons: card.querySelectorAll(".sai-ico").length };
  });
  check("sites page does not restyle media cards", decoyDuringSites.shown && !decoyDuringSites.marked && decoyDuringSites.icons === 0, JSON.stringify(decoyDuringSites));
  const sitesBefore = await page.evaluate(() => window.SAITheme.stats());
  await page.evaluate(() => {
    window.__gridCount = 0;
    const grid = document.getElementById("grid");
    window.__churn = setInterval(() => {
      window.__gridCount++;
      const cell = document.createElement("div");
      cell.className = "media-cell";
      cell.textContent = String(window.__gridCount);
      grid.appendChild(cell);
      if (grid.childElementCount > 40) grid.firstElementChild.remove();
    }, 20);
  });
  await new Promise((r) => setTimeout(r, 3000));
  const sitesAfter = await page.evaluate(() => {
    clearInterval(window.__churn);
    const grid = document.getElementById("grid");
    return { stats: window.SAITheme.stats(), height: grid.getBoundingClientRect().height, shown: getComputedStyle(grid).display !== "none" };
  });
  check("sites page stays visible", sitesAfter.shown && sitesAfter.height > 20 && sitesAfter.stats.scans - sitesBefore.scans < 3 && sitesAfter.stats.decorates - sitesBefore.decorates < 4, `height=${sitesAfter.height} scans=${sitesAfter.stats.scans - sitesBefore.scans} decorates=${sitesAfter.stats.decorates - sitesBefore.decorates}`);

  await page.goto(`${base}/v2/location/loc123/settings?sidebar=${encodeURIComponent("#ffffff")}`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  const settingsBefore = await page.evaluate(() => window.SAITheme.stats());
  await page.evaluate(() => {
    const grid = document.getElementById("grid");
    window.__churn = setInterval(() => {
      const cell = document.createElement("div");
      cell.className = "media-card";
      cell.textContent = "settings-row";
      grid.appendChild(cell);
      if (grid.childElementCount > 40) grid.firstElementChild.remove();
    }, 20);
  });
  await new Promise((r) => setTimeout(r, 3000));
  const settingsAfter = await page.evaluate(() => {
    clearInterval(window.__churn);
    const grid = document.getElementById("grid");
    return { stats: window.SAITheme.stats(), height: grid.getBoundingClientRect().height, shown: getComputedStyle(grid).display !== "none" && getComputedStyle(grid).visibility !== "hidden" };
  });
  check("settings page stays visible", settingsAfter.shown && settingsAfter.height > 20 && settingsAfter.stats.scans - settingsBefore.scans < 3 && settingsAfter.stats.decorates - settingsBefore.decorates < 4, `height=${settingsAfter.height} scans=${settingsAfter.stats.scans - settingsBefore.scans} decorates=${settingsAfter.stats.decorates - settingsBefore.decorates}`);

  for (const sidebar of ["#ffffff", "#0E1A3A"]) {
    const label = sidebar === "#ffffff" ? "light" : "dark";
    await page.goto(`${base}/v2/location/loc123/dashboard?sidebar=${encodeURIComponent(sidebar)}`, { waitUntil: "load" });
    await page.waitForSelector(".sai-tb-open");
    await page.evaluate(() => history.pushState({}, "", "/v2/location/loc123/media-storage"));
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate(() => {
      window.__gridCount = 0;
      const grid = document.getElementById("grid");
      window.__churn = setInterval(() => {
        window.__gridCount++;
        const cell = document.createElement("div");
        cell.className = "media-cell";
        cell.textContent = String(window.__gridCount);
        grid.appendChild(cell);
        const extra = grid.querySelector("div.media-cell");
        if (grid.childElementCount > 80 && extra) extra.remove();
        cell.classList.toggle("on");
      }, 20);
    });
    const start = await page.evaluate(() => window.SAITheme.stats());
    await new Promise((r) => setTimeout(r, 10000));
    const end = await page.evaluate(() => ({ stats: window.SAITheme.stats(), grid: window.__gridCount, quiet: document.documentElement.classList.contains("sai-quiet-page") }));
    await page.evaluate(() => clearInterval(window.__churn));
    const decorates = end.stats.decorates - start.decorates;
    const scans = end.stats.scans - start.scans;
    const decoy = await page.evaluate(() => {
      const card = document.querySelector("#sb_decoy");
      if (!card) return { missing: true };
      return { shown: getComputedStyle(card).display !== "none", icons: card.querySelectorAll(".sai-ico").length, insideSidebar: !!card.closest("#sidebar-v2") };
    });
    check(`media-storage ${label} leaves the media grid alone`, decoy.shown && decoy.icons === 0 && decoy.insideSidebar === false, JSON.stringify(decoy));
    check(`media-storage ${label} stays quiet`, end.quiet && end.grid > 200 && decorates < 8 && scans < 3, `grid=${end.grid} decorates=${decorates} scans=${scans} mutations=${end.stats.mutations - start.mutations}`);
    const still = await readButton(page);
    const fg = rgb(still.color);
    const bg = rgb(still.sidebar && !/rgba?\(0,\s*0,\s*0,\s*0\)/.test(still.sidebar) ? still.sidebar : (still.background || still.token));
    const ratio = fg && bg ? contrast(fg, bg) : 0;
    check(`media-storage ${label} button`, still.contrast === (label === "light" ? "light" : "dark") && ratio >= 4.5, `mode=${still.contrast} ratio=${ratio.toFixed(2)}`);
    await shot(page, `media-storage-${label}`);
  }

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/v2/location/bekah/dashboard?sidebar=${encodeURIComponent("#ffffff")}`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  const bekahStart = await page.evaluate(() => window.SAITheme.stats());
  check("old install still edits and keys Bekah", bekahStart.canEdit === true && bekahStart.access === "all" && bekahStart.route === "bekah" && !bekahStart.user.type, JSON.stringify({ route: bekahStart.route, access: bekahStart.access, user: bekahStart.user }));
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  const bekahNote = await page.evaluate(() => ({
    hidden: document.querySelector(".sai-tb-install").hidden,
    text: document.querySelector(".sai-tb-install").textContent,
  }));
  check("old install tells agency editors to update Design", bekahNote.hidden === false && bekahNote.text === "Update your install script in SaaSSuite > Design", bekahNote.text);
  await page.evaluate(() => document.querySelector('[data-act="close"]').click());
  await setLogo("https://cdn.example/bekah.png");
  const bekahLogo = await readLogos();
  check("Bekah logo stays on Bekah", bekahLogo.route === "bekah" && bekahLogo.slot === "https://cdn.example/bekah.png" && bekahLogo.hl === "https://cdn.example/highlevel.png" && bekahLogo.posts.some((p) => p.locationId === "bekah") && !bekahLogo.posts.some((p) => p.locationId === "agency"), JSON.stringify({ route: bekahLogo.route, slot: bekahLogo.slot, posts: bekahLogo.posts }));
  const bekahBlobs = await page.evaluate(() => {
    const hits = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key) || "";
      if (val.indexOf("bekah.png") !== -1) hits.push(key);
    }
    return hits;
  });
  check("Bekah's logo is not inside a shared theme blob", bekahBlobs.length > 0 && bekahBlobs.every((key) => key.endsWith(":bekah") && key.indexOf("sai_theme_v1:") !== 0), JSON.stringify(bekahBlobs));
  await page.evaluate(() => history.pushState({}, "", "/v2/location/second/dashboard"));
  await new Promise((r) => setTimeout(r, 300));
  const secondBefore = await readLogos();
  check("second sub-account does not take Bekah's logo", secondBefore.route === "second" && secondBefore.slot !== "https://cdn.example/bekah.png" && secondBefore.hl === "https://cdn.example/highlevel.png", JSON.stringify(secondBefore));
  await page.evaluate(() => history.pushState({}, "", "/agency_dashboard"));
  await new Promise((r) => setTimeout(r, 300));
  const agencyBekah = await readLogos();
  check("agency view does not take Bekah's logo", agencyBekah.route === "agency" && agencyBekah.slot !== "https://cdn.example/bekah.png" && agencyBekah.hl === "https://cdn.example/highlevel.png", JSON.stringify(agencyBekah));
  await setLogo("https://cdn.example/lynkific-agency.png");
  await page.evaluate(() => history.pushState({}, "", "/v2/location/second/dashboard"));
  await new Promise((r) => setTimeout(r, 300));
  const secondInherits = await readLogos();
  const secondSlot = Object.entries(secondInherits.slots).find(([key]) => key.endsWith(":second"));
  check("second sub-account inherits the agency logo", secondInherits.slot === "https://cdn.example/lynkific-agency.png" && !secondSlot, secondInherits.slot);
  await page.evaluate(() => history.pushState({}, "", "/v2/location/bekah/dashboard"));
  await new Promise((r) => setTimeout(r, 300));
  const bekahKeeps = await readLogos();
  check("Bekah keeps its own logo after the agency upload", bekahKeeps.slot === "https://cdn.example/bekah.png" && bekahKeeps.hl === "https://cdn.example/highlevel.png", bekahKeeps.slot);
  await page.evaluate(() => document.querySelector(".sai-tb-open").click());
  await page.waitForSelector(".sai-tb.open");
  await page.evaluate(() => document.querySelector('[data-act="removelogo"]').click());
  await new Promise((r) => setTimeout(r, 350));
  const bekahCleared = await readLogos();
  check("clearing Bekah's logo inherits the agency logo", bekahCleared.slot === "https://cdn.example/lynkific-agency.png" && bekahCleared.hl === "https://cdn.example/highlevel.png", bekahCleared.slot);
  await page.evaluate(() => { window.__calls = []; });
  await page.evaluate(() => {
    const field = document.querySelector('[data-hex="sidebarBg"]');
    field.value = "#334455";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => document.querySelector('[data-act="save"]').click());
  await new Promise((r) => setTimeout(r, 400));
  const bekahColor = await page.evaluate(() => ({
    status: document.querySelector(".sai-tb-status")?.textContent || "",
    themePosts: window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("location-theme") !== -1).map((c) => c.body),
    logoPosts: window.__calls.filter((c) => c.method === "POST" && c.url.indexOf("theme-logo") !== -1).map((c) => JSON.parse(c.body)),
  }));
  check("old install keeps a Bekah color in this browser only", /this browser only/i.test(bekahColor.status) && bekahColor.themePosts.length === 0 && !bekahColor.logoPosts.some((p) => p.locationId === "agency"), bekahColor.status);
  await page.evaluate(() => history.pushState({}, "", "/v2/location/second/dashboard"));
  await new Promise((r) => setTimeout(r, 900));
  const secondColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sai-sb-bg").trim());
  check("second sub-account does not take Bekah's color", secondColor.toLowerCase() !== "#334455" && secondColor.toLowerCase() !== "rgb(51, 68, 85)", secondColor);
  await page.evaluate(() => history.pushState({}, "", "/agency_dashboard"));
  await new Promise((r) => setTimeout(r, 900));
  const agencyColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sai-sb-bg").trim());
  check("agency view does not take Bekah's color", agencyColor.toLowerCase() !== "#334455" && agencyColor.toLowerCase() !== "rgb(51, 68, 85)", agencyColor);

  await page.goto(`${base}/v2/location/locOnly/dashboard?sidebar=${encodeURIComponent("#ffffff")}`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    const cfg = window.SAI_THEME_CONFIG;
    const prefix = "sai_theme_v1:" + cfg.agencyKey + ":" + cfg.brandingVersion + ":" + JSON.stringify(cfg.agencyTheme || {}) + ":";
    localStorage.setItem(prefix + cfg.agencyKey, JSON.stringify(Object.assign({ logoUrl: "https://cdn.example/poison.png" }, cfg.agencyTheme)));
    localStorage.setItem(prefix + "locOnly", JSON.stringify(Object.assign({ logoUrl: "https://cdn.example/loc-only.png" }, cfg.agencyTheme)));
    window.SAITheme.configure(Object.assign({}, cfg, { builderAccess: "all" }));
  });
  await new Promise((r) => setTimeout(r, 400));
  const locOnly = await readLogos();
  check("a location still shows a logo that was saved only in its own theme blob", locOnly.route === "locOnly" && locOnly.slot === "https://cdn.example/loc-only.png" && locOnly.hl === "https://cdn.example/highlevel.png", JSON.stringify({ route: locOnly.route, slot: locOnly.slot, hl: locOnly.hl }));
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locOther/dashboard"));
  await new Promise((r) => setTimeout(r, 400));
  const locOther = await readLogos();
  check("an agency theme blob logo does not spread to another sub-account", locOther.route === "locOther" && locOther.slot !== "https://cdn.example/poison.png" && locOther.slot !== "https://cdn.example/loc-only.png" && locOther.hl === "https://cdn.example/highlevel.png", JSON.stringify({ route: locOther.route, slot: locOther.slot, hl: locOther.hl, slots: locOther.slots }));
  await page.evaluate(() => history.pushState({}, "", "/agency_dashboard"));
  await new Promise((r) => setTimeout(r, 400));
  const agencyPoison = await readLogos();
  const poisonKeys = await page.evaluate(() => {
    const hits = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key) || "";
      if (val.indexOf("poison.png") !== -1) hits.push(key);
    }
    return hits;
  });
  check("the agency view still shows a logo that lives only in the agency theme blob", agencyPoison.route === "agency" && agencyPoison.slot === "https://cdn.example/poison.png" && agencyPoison.hl === "https://cdn.example/highlevel.png" && poisonKeys.length === 1 && poisonKeys[0].indexOf("sai_theme_v1:") === 0 && poisonKeys[0].endsWith("agency-demo") && poisonKeys[0].indexOf("sai_logo_slot") === -1, JSON.stringify({ slot: agencyPoison.slot, hl: agencyPoison.hl, poisonKeys }));

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${base}/design-install`, { waitUntil: "load" });
  const designInstall = await page.evaluate(() => {
    const banner = document.querySelector(".banner");
    const note = document.getElementById("note");
    const snippet = document.getElementById("snippet");
    const copy = document.getElementById("copy");
    const steps = document.querySelectorAll("ol li").length;
    const box = banner ? banner.getBoundingClientRect() : { width: 0, height: 0 };
    return {
      visible: !!banner && box.height > 40 && getComputedStyle(banner).display !== "none",
      note: note ? note.textContent : "",
      snippet: snippet ? snippet.textContent : "",
      copy: copy ? copy.textContent : "",
      steps,
    };
  });
  check("Design shows the update banner, steps, script, and copy button", designInstall.visible && designInstall.steps === 3 && designInstall.copy.trim() === "Copy" && designInstall.note.includes("The old tag still runs") && designInstall.note.includes("A logo saved in one sub-account stays on that sub-account either way") && designInstall.snippet.includes('data-user-type="{{user.type}}"') && designInstall.snippet.includes('data-company-id="{{user.companyId}}"') && designInstall.snippet.includes("agency_id=saassuite"), JSON.stringify({ steps: designInstall.steps, copy: designInstall.copy, note: designInstall.note }));
  await shot(page, "design-install-notice");

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${base}/design-warning`, { waitUntil: "load" });
  const blocked = await page.evaluate(() => ({
    warning: document.getElementById("warning").textContent,
    disabled: document.getElementById("save").disabled,
  }));
  check("dark sidebar blocks save until confirmed", blocked.disabled && blocked.warning === LIGHT_TO_DARK, blocked.warning);
  await shot(page, "design-warning-unchecked");
  await page.click("#confirm");
  const allowed = await page.evaluate(() => document.getElementById("save").disabled === false);
  check("checking the warning enables save", allowed, String(allowed));
  await shot(page, "design-warning-checked");
  await page.goto(`${base}/design-warning?dir=reverse`, { waitUntil: "load" });
  const reverse = await page.evaluate(() => document.getElementById("warning").textContent);
  check("light sidebar over a dark setup uses the reverse warning", reverse === DARK_TO_LIGHT, reverse);
  await shot(page, "design-warning-reverse");

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${base}/v2/location/locSet/settings/company?sidebar=${encodeURIComponent("#ffffff")}&nav=settings&header=1`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open", { timeout: 5000 });
  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      builderAccess: "all",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, { iconPack: "lucide", sidebarBg: "#FFFFFF", sidebarBgEnd: "#FFFFFF", sidebarText: "auto" }),
    }));
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => {
    const link = [...document.querySelectorAll("#sidebar-v2 nav a")].find((a) => /billing/i.test(a.textContent || ""));
    const icon = document.createElement("span");
    icon.className = "sai-ico";
    icon.setAttribute("data-sai-nav", "1");
    link.setAttribute("data-sai-icon", "1");
    link.insertBefore(icon, link.firstChild);
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { builderAccess: "all" }));
  });
  await new Promise((r) => setTimeout(r, 400));
  const settingsNav = await page.evaluate(() => {
    const sb = document.querySelector("#sidebar-v2");
    const trigger = document.querySelector(".sai-tb-trigger");
    const help = document.getElementById("support-widget-launcher-host");
    const header = document.querySelector(".hl_header");
    const rows = [...sb.querySelectorAll("nav a, .settings-section, .go-back, .settings-heading")].map((el) => ({
      text: (el.innerText || "").replace(/\s+/g, " ").trim(),
      icons: el.querySelectorAll(".sai-ico[data-sai-nav]").length,
      marked: el.getAttribute("data-sai-icon"),
    }));
    const tr = trigger.getBoundingClientRect();
    const hr = help.getBoundingClientRect();
    const headerBox = header.getBoundingClientRect();
    const icons = [...document.querySelectorAll("#right-controls .ghl-icon")].map((el) => el.getBoundingClientRect());
    function hit(a, b) {
      const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return x > 1 && y > 1;
    }
    const chip = trigger.querySelector(".sai-tb-chip");
    return {
      rows,
      inSidebar: sb.contains(trigger),
      inHeader: header.contains(trigger),
      gap: Math.round(hr.left - tr.right),
      heightDelta: Math.round(Math.abs(tr.height - hr.height)),
      centerDelta: Math.round(Math.abs((tr.top + tr.height / 2) - (hr.top + hr.height / 2))),
      hitHelp: hit(tr, hr),
      hitIcon: icons.some((box) => hit(tr, box)),
      insideHeader: tr.left >= headerBox.left - 1 && tr.right <= headerBox.right + 1,
      label: trigger.querySelector(".sai-tb-label").textContent,
      beta: chip ? chip.textContent : "",
      betaShown: chip ? getComputedStyle(chip).display !== "none" : false,
      contrast: trigger.getAttribute("data-sai-contrast"),
      color: getComputedStyle(trigger).color,
      headerBg: getComputedStyle(header).backgroundColor,
    };
  });
  check(
    "settings nav keeps every item free of injected icons",
    settingsNav.rows.length >= 16 && settingsNav.rows.every((row) => row.icons === 0 && row.marked !== "1") && settingsNav.rows.some((row) => row.text === "Go Back") && settingsNav.rows.some((row) => row.text === "Settings") && settingsNav.rows.some((row) => /Business Services/i.test(row.text)) && settingsNav.rows.some((row) => /Other Settings/i.test(row.text)) && settingsNav.rows.some((row) => /Opportunities/.test(row.text)) && settingsNav.rows.some((row) => row.text === "Billing") && settingsNav.rows.some((row) => row.text === "Calendars"),
    JSON.stringify(settingsNav.rows),
  );
  check(
    "customize theme sits in the top bar left of Help & Support",
    !settingsNav.inSidebar && settingsNav.inHeader && settingsNav.gap >= 4 && settingsNav.gap <= 16 && settingsNav.heightDelta <= 2 && settingsNav.centerDelta <= 4 && !settingsNav.hitHelp && !settingsNav.hitIcon && settingsNav.insideHeader && settingsNav.label === "Customize theme" && settingsNav.beta === "Beta" && settingsNav.betaShown && settingsNav.contrast === "light",
    JSON.stringify(settingsNav),
  );
  const settingsRatio = contrast(rgb(settingsNav.color), rgb(settingsNav.headerBg));
  check("light top bar keeps the customize button readable", settingsRatio >= 4.5, `ratio=${settingsRatio.toFixed(2)} color=${settingsNav.color} header=${settingsNav.headerBg}`);
  await shot(page, "settings-nav-icons-after");
  await shot(page, "customize-theme-topbar-1440");

  async function frameTopBar(width, collapsed, name) {
    await page.setViewport({ width, height: 900 });
    await page.evaluate((narrow) => {
      const sb = document.querySelector("#sidebar-v2");
      const header = document.querySelector(".hl_header");
      sb.style.width = narrow ? "64px" : "248px";
      header.style.left = narrow ? "64px" : "248px";
    }, collapsed);
    await page.waitForFunction((narrow) => document.documentElement.classList.contains("sai-sb-collapsed") === narrow, { timeout: 2000 }, collapsed);
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await new Promise((r) => setTimeout(r, 80));
    const box = await page.evaluate(() => {
      const trigger = document.querySelector(".sai-tb-trigger");
      const help = document.getElementById("support-widget-launcher-host");
      const header = document.querySelector(".hl_header");
      const tr = trigger.getBoundingClientRect();
      const hr = help.getBoundingClientRect();
      const hb = header.getBoundingClientRect();
      const icons = [...document.querySelectorAll("#right-controls .ghl-icon")].map((el) => el.getBoundingClientRect());
      const left = document.getElementById("left-controls").getBoundingClientRect();
      function hit(a, b) {
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return x > 1 && y > 1;
      }
      return {
        gap: Math.round(hr.left - tr.right),
        hitHelp: hit(tr, hr),
        hitIcon: icons.some((box) => hit(tr, box)),
        hitLeft: hit(tr, left),
        inside: tr.left >= hb.left - 1 && tr.right <= hb.right + 1 && tr.top >= hb.top - 1 && tr.bottom <= hb.bottom + 1,
        label: getComputedStyle(trigger.querySelector(".sai-tb-label")).display,
        collapsed: document.documentElement.classList.contains("sai-sb-collapsed"),
      };
    });
    check(
      name,
      box.gap >= 4 && box.gap <= 16 && !box.hitHelp && !box.hitIcon && !box.hitLeft && box.inside && box.label !== "none" && box.collapsed === collapsed,
      JSON.stringify(box),
    );
    await shot(page, name);
  }
  await frameTopBar(1280, false, "customize-theme-topbar-1280");
  await frameTopBar(1280, true, "customize-theme-topbar-1280-collapsed");
  await frameTopBar(1440, false, "customize-theme-topbar-1440-expanded");
  await frameTopBar(1440, true, "customize-theme-topbar-1440-collapsed");
  await frameTopBar(1920, false, "customize-theme-topbar-1920");
  await frameTopBar(1920, true, "customize-theme-topbar-1920-collapsed");

  await page.goto(`${base}/v2/location/locNeighbor/dashboard?sidebar=${encodeURIComponent("#ffffff")}&header=1&neighbor=1`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  async function frameNeighbor(width, iconMode) {
    await page.setViewport({ width, height: 800 });
    await page.evaluate((narrow) => {
      const sb = document.querySelector("#sidebar-v2");
      const header = document.querySelector(".hl_header");
      sb.style.width = narrow ? "0px" : "248px";
      header.style.left = narrow ? "0px" : "248px";
    }, width < 768);
    await page.evaluate(() => window.dispatchEvent(new Event("resize")));
    await new Promise((r) => setTimeout(r, 80));
    if (iconMode) {
      const hidden = await page.evaluate(() => {
        const trigger = document.querySelector(".sai-tb-trigger");
        const ids = ["ghl-alerts", "support-widget-launcher-host", "ghl-bell"];
        const read = () => Object.fromEntries(ids.map((id) => {
          const r = document.getElementById(id).getBoundingClientRect();
          return [id, { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width) }];
        }));
        const on = read();
        const style = trigger ? trigger.getAttribute("style") || "" : "";
        const display = trigger ? getComputedStyle(trigger).display : "missing";
        const reserved = [...document.querySelectorAll("[data-sai-theme-reserve]")].map((el) => el.id || el.className);
        document.querySelectorAll("[data-sai-theme-reserve]").forEach((el) => {
          el.style.removeProperty(el.getAttribute("data-sai-theme-reserve") || "margin-left");
          el.removeAttribute("data-sai-theme-reserve");
        });
        if (trigger) trigger.style.setProperty("display", "none", "important");
        const off = read();
        const alerts = document.getElementById("ghl-alerts").getBoundingClientRect();
        const hit = document.elementFromPoint(alerts.left + alerts.width / 2, alerts.top + alerts.height / 2);
        window.dispatchEvent(new Event("resize"));
        return {
          display,
          left: trigger ? trigger.style.left : "",
          negative: /(?:^|;)\s*left:\s*-/.test(style),
          reserved,
          deltas: ids.map((id) => ({ id, dx: on[id].x - off[id].x, dy: on[id].y - off[id].y })),
          alertsCovered: !!(hit && trigger && trigger.contains(hit)),
        };
      });
      check(
        "customize theme hides on a narrow bar and leaves Alerts unmoved at " + width,
        hidden.display === "none" && !hidden.negative && hidden.left === "" && hidden.reserved.length === 0 && !hidden.alertsCovered && hidden.deltas.every((d) => Math.abs(d.dx) <= 1 && Math.abs(d.dy) <= 1),
        JSON.stringify(hidden),
      );
      await shot(page, "customize-theme-neighbor-" + width);
      return;
    }
    const box = await page.evaluate(() => {
      const trigger = document.querySelector(".sai-tb-trigger");
      const help = document.getElementById("support-widget-launcher-host");
      const alerts = document.getElementById("ghl-alerts");
      const bell = document.getElementById("ghl-bell");
      const chip = trigger.querySelector(".sai-tb-chip");
      const tr = trigger.getBoundingClientRect();
      const hr = help.getBoundingClientRect();
      const ar = alerts.getBoundingClientRect();
      const br = bell.getBoundingClientRect();
      const cr = chip.getBoundingClientRect();
      function hit(a, b) {
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return x > 1 && y > 1;
      }
      const alertsHit = document.elementFromPoint(ar.left + ar.width / 2, ar.top + ar.height / 2);
      const chipShown = getComputedStyle(chip).display !== "none" && cr.width > 4 && cr.height > 4 && cr.left >= tr.left - 1 && cr.right <= tr.right + 1;
      return {
        gapHelp: Math.round(hr.left - tr.right),
        gapAlerts: Math.round(tr.left - ar.right),
        hitHelp: hit(tr, hr),
        hitAlerts: hit(tr, ar),
        hitBell: hit(tr, br),
        alertsCovered: !!(alertsHit && trigger.contains(alertsHit)),
        chipShown,
        compact: trigger.getAttribute("data-compact"),
        beta: chip.textContent,
      };
    });
    check(
      iconMode ? "customize theme icon mode leaves Alerts uncovered at " + width : "customize theme keeps Beta visible beside Alerts at " + width,
      box.gapHelp >= 4 && box.gapHelp <= 16 && box.gapAlerts >= 4 && !box.hitHelp && !box.hitAlerts && !box.hitBell && !box.alertsCovered && box.beta === "Beta" && (iconMode ? box.compact === "1" && !box.chipShown : box.compact !== "1" && box.chipShown),
      JSON.stringify(box),
    );
    await shot(page, iconMode ? "customize-theme-neighbor-375" : "customize-theme-neighbor-" + width);
  }
  await frameNeighbor(768, false);
  await frameNeighbor(1280, false);
  await frameNeighbor(1440, false);
  await frameNeighbor(1920, false);
  await frameNeighbor(375, true);

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${base}/v2/location/locSet/settings/company?sidebar=${encodeURIComponent("#0E1A3A")}&nav=settings&header=1&top=dark`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      builderAccess: "all",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, { iconPack: "lucide", sidebarBg: "#0E1A3A", sidebarBgEnd: "#0E1A3A", headerBg: "#101828", sidebarText: "auto" }),
    }));
  });
  await new Promise((r) => setTimeout(r, 400));
  const darkTop = await page.evaluate(() => {
    const trigger = document.querySelector(".sai-tb-trigger");
    const header = document.querySelector(".hl_header");
    const rows = [...document.querySelectorAll("#sidebar-v2 nav a")].map((a) => a.querySelectorAll(".sai-ico[data-sai-nav]").length);
    return {
      contrast: trigger.getAttribute("data-sai-contrast"),
      color: getComputedStyle(trigger).color,
      headerBg: getComputedStyle(header).backgroundColor,
      icons: rows.reduce((sum, n) => sum + n, 0),
      inSidebar: document.querySelector("#sidebar-v2").contains(trigger),
    };
  });
  const darkRatio = contrast(rgb(darkTop.color), rgb(darkTop.headerBg));
  check("dark top bar keeps the customize button readable and settings icons off", darkTop.contrast === "dark" && darkRatio >= 4.5 && darkTop.icons === 0 && !darkTop.inSidebar, `ratio=${darkRatio.toFixed(2)} ${JSON.stringify(darkTop)}`);
  await shot(page, "customize-theme-topbar-dark");

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${base}/v2/location/locHead/dashboard?sidebar=${encodeURIComponent("#ffffff")}&header=1`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      builderAccess: "all",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, { iconPack: "lucide", sidebarBg: "#FFFFFF", sidebarBgEnd: "#FFFFFF", sidebarText: "auto" }),
    }));
  });
  await new Promise((r) => setTimeout(r, 500));
  const mainNav = await page.evaluate(() => {
    const sb = document.querySelector("#sidebar-v2");
    const trigger = document.querySelector(".sai-tb-trigger");
    const rows = [...sb.querySelectorAll("a[id^='sb_']")].map((a) => {
      const host = a.parentElement && a.parentElement.classList.contains("sb-row") ? a.parentElement : a;
      return host.querySelectorAll(".sai-ico[data-sai-nav]").length;
    });
    return { count: rows.length, icons: rows.every((n) => n === 1), inSidebar: sb.contains(trigger), inHeader: !!trigger.closest(".hl_header") };
  });
  check("main sidebar still gets one icon per item while the button stays in the header", mainNav.count === 8 && mainNav.icons && !mainNav.inSidebar && mainNav.inHeader, JSON.stringify(mainNav));

  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { builderAccess: "admins", user: { type: "", role: "", email: "", id: "" } }));
  });
  await new Promise((r) => setTimeout(r, 300));
  const hidden = await page.evaluate(() => document.querySelectorAll(".sai-tb-trigger").length);
  check("customize theme stays hidden for the same non-editors", hidden === 0, String(hidden));
  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, { builderAccess: "admins", user: { type: "account", role: "admin", email: "admin@example.com", id: "user-1" } }));
  });
  await new Promise((r) => setTimeout(r, 400));
  const editor = await page.evaluate(() => {
    const trigger = document.querySelector(".sai-tb-trigger");
    return { count: document.querySelectorAll(".sai-tb-trigger").length, inHeader: !!(trigger && trigger.closest(".hl_header")), inSidebar: !!(trigger && document.querySelector("#sidebar-v2").contains(trigger)) };
  });
  check("an admin still sees customize theme in the top bar", editor.count === 1 && editor.inHeader && !editor.inSidebar, JSON.stringify(editor));

  await page.goto(`${base}/v2/location/locRaw/settings/billing?sidebar=${encodeURIComponent("#ffffff")}&nav=settings-raw&header=1`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    const billing = document.getElementById("sb_billing");
    const planted = document.createElement("span");
    planted.className = "sai-ico";
    planted.setAttribute("data-sai-nav", "1");
    billing.prepend(planted);
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      builderAccess: "all",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, { iconPack: "lucide", sidebarBg: "#ffffff", sidebarBgEnd: "#ffffff", sidebarText: "auto" }),
    }));
  });
  await new Promise((r) => setTimeout(r, 250));
  const rawSettings = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#sidebar-v2 nav a")].map((a) => ({
      text: (a.textContent || "").replace(/\s+/g, " ").trim(),
      id: a.id,
      icons: a.querySelectorAll(".sai-ico[data-sai-nav]").length,
      src: (a.querySelector(".sai-ico[data-sai-nav]") || {}).getAttribute ? (a.querySelector(".sai-ico[data-sai-nav]").getAttribute("data-src") || "") : "",
    }));
    const trigger = document.querySelector(".sai-tb-trigger");
    return {
      rows,
      icons: document.querySelectorAll("#sidebar-v2 .sai-ico[data-sai-nav]").length,
      inHeader: !!(trigger && trigger.closest(".hl_header")),
      inSidebar: !!(trigger && trigger.closest("#sidebar-v2")),
      label: trigger ? trigger.querySelector(".sai-tb-label").textContent : "",
      beta: trigger ? trigger.querySelector(".sai-tb-chip").textContent : "",
    };
  });
  check(
    "settings route injects no icons on Billing, Calendars, or Opportunities",
    rawSettings.icons === 0 && rawSettings.rows.some((row) => row.text === "Billing" && row.icons === 0) && rawSettings.rows.some((row) => row.text === "Calendars" && row.icons === 0) && rawSettings.rows.some((row) => /Opportunities/.test(row.text) && row.icons === 0) && rawSettings.rows.every((row) => row.icons === 0),
    JSON.stringify(rawSettings.rows),
  );
  check(
    "customize theme stays in the top bar on the settings route",
    rawSettings.inHeader && !rawSettings.inSidebar && rawSettings.label === "Customize theme" && rawSettings.beta === "Beta",
    JSON.stringify(rawSettings),
  );
  await page.evaluate(() => {
    const nav = document.querySelector("#sidebar-v2 nav");
    const late = document.createElement("a");
    late.id = "sb_calendars_late";
    late.innerHTML = '<span class="sai-ico" data-sai-nav="1" data-src="https://cdn.example/icons/lucide/calendar-days.svg"></span><span class="nav-title">Calendars</span>';
    nav.appendChild(late);
  });
  await new Promise((r) => setTimeout(r, 300));
  const afterMutation = await page.evaluate(() => document.querySelectorAll("#sidebar-v2 .sai-ico[data-sai-nav]").length);
  check("settings observer removes icons instead of re-adding them", afterMutation === 0, String(afterMutation));

  await page.goto(`${base}/v2/location/locLive/dashboard?sidebar=${encodeURIComponent("#111827")}&header=1`, { waitUntil: "load" });
  await page.waitForSelector(".sai-tb-open");
  await page.evaluate(() => {
    window.SAITheme.configure(Object.assign({}, window.SAI_THEME_CONFIG, {
      builderAccess: "all",
      agencyTheme: Object.assign({}, window.SAI_THEME_CONFIG.agencyTheme, { iconPack: "lucide", sidebarBg: "#111827", sidebarBgEnd: "#111827", sidebarText: "auto" }),
    }));
  });
  await new Promise((r) => setTimeout(r, 250));
  const mainBefore = await page.evaluate(() => ({
    dashboard: document.querySelectorAll("#sb_dashboard .sai-ico[data-sai-nav]").length,
    settingsLink: document.querySelectorAll("#sb_settings .sai-ico[data-sai-nav]").length,
  }));
  check("main sidebar still icons the Settings shortcut", mainBefore.dashboard === 1 && mainBefore.settingsLink === 1, JSON.stringify(mainBefore));
  await page.evaluate(() => {
    const box = document.createElement("div");
    box.className = "hl_settings--sidebar";
    box.innerHTML = '<a id="sb_billing" href="/v2/location/locLive/billing"><span class="nav-title">Billing</span></a><a id="sb_calendars" href="/v2/location/locLive/calendars"><span class="nav-title">Calendars</span></a><a id="sb_opportunities" href="/v2/location/locLive/opportunities"><span class="nav-title">Opportunities & Pipelines</span></a>';
    document.getElementById("sidebar-v2").appendChild(box);
  });
  await new Promise((r) => setTimeout(r, 400));
  const boxed = await page.evaluate(() => ({
    box: document.querySelectorAll(".hl_settings--sidebar .sai-ico[data-sai-nav]").length,
    dashboard: document.querySelectorAll("#sb_dashboard .sai-ico[data-sai-nav]").length,
    settingsLink: document.querySelectorAll(".hl_nav-settings #sb_settings .sai-ico[data-sai-nav]").length,
  }));
  check(
    "settings sidebar container stays free of icons while the main menu keeps them",
    boxed.box === 0 && boxed.dashboard === 1 && boxed.settingsLink === 1,
    JSON.stringify(boxed),
  );
  await page.evaluate(() => {
    document.querySelector(".hl_settings--sidebar").remove();
    const nav = document.querySelector("#sidebar-v2 nav");
    nav.innerHTML = '<a id="sb_billing" href="/v2/location/locLive/billing"><span class="nav-title">Billing</span></a><a id="sb_calendars" href="/v2/location/locLive/calendars"><span class="nav-title">Calendars</span></a><a id="sb_opportunities" href="/v2/location/locLive/opportunities"><span class="nav-title">Opportunities & Pipelines</span></a><a href="/v2/location/locLive/users"><span class="nav-title">Users</span></a>';
  });
  await new Promise((r) => setTimeout(r, 400));
  const swappedOnDashboard = await page.evaluate(() => ({
    billing: document.querySelectorAll("#sb_billing .sai-ico[data-sai-nav]").length,
    calendars: document.querySelectorAll("#sb_calendars .sai-ico[data-sai-nav]").length,
    opportunities: document.querySelectorAll("#sb_opportunities .sai-ico[data-sai-nav]").length,
  }));
  check(
    "those labels still get icons when they are the main menu",
    swappedOnDashboard.billing === 1 && swappedOnDashboard.calendars === 1 && swappedOnDashboard.opportunities === 1,
    JSON.stringify(swappedOnDashboard),
  );
  await page.evaluate(() => history.pushState({}, "", "/v2/location/locLive/settings/company"));
  await new Promise((r) => setTimeout(r, 400));
  const enteredSettings = await page.evaluate(() => document.querySelectorAll("#sidebar-v2 .sai-ico[data-sai-nav]").length);
  check("navigating into settings removes icons already painted", enteredSettings === 0, String(enteredSettings));
  await page.evaluate(() => {
    const nav = document.querySelector("#sidebar-v2 nav");
    const late = document.createElement("a");
    late.id = "sb_billing_late";
    late.innerHTML = '<span class="sai-ico" data-sai-nav="1" data-src="https://cdn.example/icons/lucide/receipt.svg"></span><span class="nav-title">Billing</span>';
    nav.appendChild(late);
  });
  await new Promise((r) => setTimeout(r, 300));
  const stayedClean = await page.evaluate(() => ({
    icons: document.querySelectorAll("#sidebar-v2 .sai-ico[data-sai-nav]").length,
    trigger: !!document.querySelector(".hl_header .sai-tb-trigger .sai-tb-chip"),
  }));
  check("a later settings redraw does not bring the icons back", stayedClean.icons === 0 && stayedClean.trigger, JSON.stringify(stayedClean));

  await runHeaderFit(page, "chromium");

  const { webkit } = await import("playwright");
  const wk = await webkit.launch({ headless: true });
  try {
    const wkContext = await wk.newContext({ viewport: { width: 1280, height: 800 } });
    const wkPage = await wkContext.newPage();
    await runHeaderFit(wkPage, "webkit");
  } finally {
    await wk.close();
  }

  check("mocked pages throw no script errors", pageErrors.length === 0, pageErrors.join(" | "));
} finally {
  await browser.close();
  server.close();
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("theme customizer checks passed");
