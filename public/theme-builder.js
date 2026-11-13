/* GHL Theme Builder: SaaS Suite shared build. Per-agency settings come from data-agency-id / data-agency-key on the script tag. */
/* Loads the agency's existing scripts that GHL's Custom JS box no longer accepts on save. */
(function () {
  var me = document.currentScript;
  if (!me) return;
  var a = function (n) { var v = me.getAttribute(n) || ""; return v.indexOf("{" + "{") > -1 ? "" : v.trim(); };
  var USER_ATTRS = ["data-user-type", "data-user-role", "data-user-email", "data-user-name", "data-user-id", "data-company-id"];
  function load(src, from) {
    if (document.querySelector('script[src="' + src + '"]')) return;
    var sc = document.createElement("script");
    sc.src = src;
    if (from) USER_ATTRS.forEach(function (n) { var v = from.getAttribute(n); if (v) sc.setAttribute(n, v); });
    document.head.appendChild(sc);
  }
  var aid = a("data-agency-id");
  if (me.getAttribute("data-saassuite") === "on" && aid) load("https://auth.saassuite.ai/functions/v1/dynamic-styles?agency_id=" + encodeURIComponent(aid) + "&type=js", me);
  if (me.getAttribute("data-gocsm") !== "off") {
    var e = a("data-user-email"), i = a("data-user-id"), c = a("data-company-id");
    if (e && i && c) load("https://csmapi.gocsm.io/api/v1/webhook/company_script/" + e + "/" + i + "/" + c);
  }
})();
window.SAI_THEME_CONFIG = Object.assign({
  supabase: { url: "https://barenihczxxnaspgbvqb.supabase.co", anonKey: "sb_publishable_WVAfeXMLUDTN9ZG4O-tjZQ_EwpR_JmS" },
  agencyKey: "agency-saassuite",
  builderAccess: "admins",
  onlyLocations: [],
  inheritAgencyTheme: true
}, window.SAI_THEME_CONFIG || {});
(function () {
  "use strict";
  // The install tag is only a bootstrap. Dynamic JS supplies authoritative
  // branding settings and loads this runtime without the bootstrap attribute.
  if (document.currentScript && document.currentScript.getAttribute("data-saassuite") === "on") return;
  // One icon owner per page. The same lock is what an older
  // sai-theme-saassuite.js (bsrdbqgpafipcbbqxvte) build checks before it injects.
  var BUILD = "theme-builder";
  function legacyScriptTag() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src || "";
      if (/sai-theme-saassuite\.js/i.test(src) || /bsrdbqgpafipcbbqxvte/i.test(src)) return scripts[i];
    }
    return null;
  }
  function legacyOwnsPage() {
    if (window.__SAI_THEME_LOCK && window.__SAI_THEME_LOCK !== BUILD) return true;
    if (window.__SAI_OLD_RAN) return true;
    if (window.SAITheme && window.SAITheme.__build !== BUILD) return true;
    if (legacyScriptTag() && window.SAITheme) return true;
    return false;
  }
  // A later Custom JS run (agency or sub-account switch) must reuse this
  // runtime. Creating a second one stacks icons. configure() reloads colors,
  // icons, and contrast for the new account. A deleted API stays deleted.
  function reconfigure() {
    if (!window.SAITheme || !window.SAITheme.configure || window.SAITheme.__pending) return;
    var next = Object.assign({}, window.SAI_THEME_CONFIG || {});
    var again = document.currentScript;
    if (again && again.getAttribute) {
      var at = function (n) { return again.getAttribute(n); };
      var field = function (n) {
        var v = at(n) || "";
        return v.indexOf("{" + "{") > -1 ? "" : v.trim();
      };
      if (at("data-agency-key")) next.agencyKey = field("data-agency-key");
      if (at("data-access")) { next.builderAccess = field("data-access"); next.accessExplicit = true; }
      if (again.hasAttribute("data-user-type") || again.hasAttribute("data-user-role") || again.hasAttribute("data-user-email") || again.hasAttribute("data-user-name") || again.hasAttribute("data-user-id") || again.hasAttribute("data-company-id")) {
        next.user = {
          type: field("data-user-type"),
          role: field("data-user-role"),
          email: field("data-user-email"),
          name: field("data-user-name"),
          id: field("data-user-id"),
          companyId: field("data-company-id")
        };
      }
    }
    window.SAITheme.configure(next);
  }
  if (window.__SAI_THEME_LOCK === BUILD || (window.SAITheme && window.SAITheme.__build === BUILD && !window.SAITheme.__pending)) {
    reconfigure();
    return;
  }
  var DEFER_TO_LEGACY = legacyOwnsPage();
  if (!DEFER_TO_LEGACY) {
    window.__SAI_THEME_LOCK = BUILD;
    window.__SAI_THEME_ICON_OWNER = BUILD;
    // A pending API makes an older build return at its own `if (window.SAITheme)` check.
    if (!window.SAITheme) window.SAITheme = { __build: BUILD, __pending: true };
  } else {
    window.__SAI_THEME_ICON_OWNER = BUILD;
  }

  /* ---------------- Config ---------------- */
  var ME = document.currentScript;
  var CFG = Object.assign({}, window.SAI_THEME_CONFIG || {});
  (function readTagSettings() {
    if (!ME || !ME.getAttribute) return;
    var at = function (n) { return ME.getAttribute(n); };
    var sbUrl = at("data-supabase-url");
    if (!sbUrl && ME.src) { var m = ME.src.match(/^(https:\/\/[a-z0-9-]+\.supabase\.co)\//i); if (m) sbUrl = m[1]; }
    if (at("data-anon-key")) CFG.supabase = { url: sbUrl || (CFG.supabase && CFG.supabase.url) || "", anonKey: at("data-anon-key") };
    if (ME.hasAttribute("data-user-type") || ME.hasAttribute("data-user-role") || ME.hasAttribute("data-user-email") || ME.hasAttribute("data-user-name") || ME.hasAttribute("data-user-id") || ME.hasAttribute("data-company-id")) {
      CFG.user = { type: at("data-user-type"), role: at("data-user-role"), email: at("data-user-email"), name: at("data-user-name"), id: at("data-user-id"), companyId: at("data-company-id") };
    }
    if (at("data-agency-key")) CFG.agencyKey = at("data-agency-key");
    if (at("data-access")) { CFG.builderAccess = at("data-access"); CFG.accessExplicit = true; }
    if (ME.hasAttribute("data-only-locations")) CFG.onlyLocations = at("data-only-locations").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    if (at("data-inherit-agency")) CFG.inheritAgencyTheme = at("data-inherit-agency") !== "false";
  })();
  (function fillInstallUser() {
    function blank(u) { return !u || !(u.type || u.role || u.email || u.name || u.id); }
    function field(v) { v = v == null ? "" : String(v); return v.indexOf("{" + "{") > -1 ? "" : v.trim(); }
    function fromTag(el) {
      if (!el || !el.getAttribute) return null;
      return {
        type: field(el.getAttribute("data-user-type")),
        role: field(el.getAttribute("data-user-role")),
        email: field(el.getAttribute("data-user-email")),
        name: field(el.getAttribute("data-user-name")),
        id: field(el.getAttribute("data-user-id")),
        companyId: field(el.getAttribute("data-company-id"))
      };
    }
    if (!blank(CFG.user)) return;
    var captured = fromTag(null);
    var live = window.__SS_THEME_USER;
    if (live && !blank(live)) CFG.user = { type: field(live.type), role: field(live.role), email: field(live.email), name: field(live.name), id: field(live.id), companyId: field(live.companyId) };
    if (!blank(CFG.user)) return;
    var list = document.getElementsByTagName("script");
    for (var i = list.length - 1; i >= 0; i--) {
      var src = list[i].src || "";
      if (src.indexOf("dynamic-styles") === -1) continue;
      captured = fromTag(list[i]);
      if (!blank(captured)) { CFG.user = captured; return; }
    }
  })();
  var SEL = CFG.selectors || {};
  var IS_SWITCHYARD = CFG.brandingVersion === "switchyard";
  var SB = SEL.sidebar || "#sidebar-v2";
  var SBX = SB.charAt(0) === "#" && !/[\s,.\[:>]/.test(SB) ? SB + SB : SB;
  var ACTIVE = SEL.active || '.active,.exact-active,.router-link-exact-active,[aria-current="page"]';
  var SWITCHER = SEL.switcher || '[id*="location-switcher"]';
  var NAV_LINKS = SEL.navLinks || "nav a, a[id^='sb_']";
  var LOGO_SELS = SEL.logo || [SB + " .agency-logo-container img", SB + " img.agency-logo", SB + " img[alt*='logo' i]"];
  var ICON_BASE = String(CFG.iconBaseUrl || "https://api.iconify.design").replace(/\/+$/, "");
  var SB_URL = CFG.supabase && CFG.supabase.url ? String(CFG.supabase.url).replace(/\/+$/, "") : "";
  var SB_KEY = (CFG.supabase && CFG.supabase.anonKey) || "";
  // HighLevel's browser identity is not a Supabase session. Never weaken the
  // protected shared-save RPC to make unauthenticated customer writes work.
  var HAS_SB = !!(SB_URL && SB_KEY) && !CFG.brandingVersion;
  var LS = "sai_theme_v1:" + (CFG.brandingVersion ? CFG.agencyKey + ":" + CFG.brandingVersion + ":" + JSON.stringify(CFG.agencyTheme || {}) + ":" : "");
  var PRESET_LS = "sai_theme_presets:" + String(CFG.agencyKey || "agency") + ":";

  /* ---------------- Theme data ---------------- */
  var FONTS = ["Inter", "Plus Jakarta Sans", "Manrope", "DM Sans", "Figtree", "Outfit", "Poppins", "Montserrat", "Sora", "Lexend", "Work Sans", "Nunito Sans", "Lato", "Roboto", "Open Sans", "Source Sans 3"];
  var COLOR_FIELDS = [
    ["sidebarBg", "Sidebar background"],
    ["sidebarBgEnd", "Sidebar background, bottom"],
    ["sidebarText", "Sidebar text and icons"],
    ["accent", "Highlight"],
    ["accentText", "Text on highlight"],
    ["headerBg", "Top bar"]
  ];
  var LEGACY_COLOR_FIELDS = COLOR_FIELDS;
  var SWITCHYARD_COLOR_FIELDS = [
    ["sidebarBg","Panel background"],["sidebarBgEnd","Panel background, bottom"],["railColor","Account rail"],["sidebarText","Navigation text"],["iconColor","Icons"],["accent","Selected highlight"],["hoverColor","Hover highlight"],["accentText","Text on highlight"],["headerBg","Top bar"],["inputColor","Search fields"],["mutedText","Secondary text"],["outlineColor","Hover outline"]
  ];
  if (IS_SWITCHYARD) COLOR_FIELDS = SWITCHYARD_COLOR_FIELDS;
  var VARS = { sidebarBg: "--sai-sb-bg", sidebarBgEnd: "--sai-sb-bg2", sidebarText: "--sai-sb-text", accent: "--sai-accent", accentText: "--sai-accent-text", headerBg: "--sai-header-bg" };
  var DEFAULT = {
    name: "Custom", sidebarBg: "#0E1A3A", sidebarBgEnd: "#1B2D5E", sidebarText: "#C9D3EA",
    accent: "#D4A72C", accentText: "#14203F", headerBg: "#FFFFFF",
    font: "Inter", fontScope: "app", iconPack: "lucide", icons: {},
    logoUrl: "", logoHeight: 40, radius: 10, appAccent: true
  };

  var PACKS = {
    lucide: { label: "Lucide (clean line)", prefix: "lucide", suffix: "", map: {
      launchpad: "rocket", dashboard: "layout-dashboard", conversations: "message-circle", calendars: "calendar-days",
      contacts: "users", opportunities: "kanban", payments: "credit-card", ai: "bot", marketing: "megaphone",
      automation: "workflow", sites: "globe", memberships: "graduation-cap", media: "image", reputation: "star",
      reporting: "chart-column", marketplace: "store", settings: "settings", accounts: "building-2", snapshots: "camera",
      reselling: "badge-dollar-sign", affiliate: "handshake", templates: "file-stack", partners: "handshake",
      university: "book-open", swag: "gift", ideas: "lightbulb", mobile: "smartphone", prospecting: "search",
      billing: "receipt", help: "life-buoy", saas: "sliders-horizontal", addons: "puzzle", desktop: "monitor", ask: "sparkles" } },
    phosphor: { label: "Phosphor (rounded)", prefix: "ph", suffix: "", map: {
      launchpad: "rocket-launch", dashboard: "squares-four", conversations: "chat-circle-dots", calendars: "calendar-blank",
      contacts: "users-three", opportunities: "kanban", payments: "credit-card", ai: "robot", marketing: "megaphone",
      automation: "flow-arrow", sites: "globe", memberships: "graduation-cap", media: "images", reputation: "star",
      reporting: "chart-bar", marketplace: "storefront", settings: "gear-six", accounts: "buildings", snapshots: "camera",
      reselling: "currency-circle-dollar", affiliate: "handshake", templates: "stack", partners: "handshake",
      university: "book-open", swag: "gift", ideas: "lightbulb", mobile: "device-mobile", prospecting: "magnifying-glass",
      billing: "receipt", help: "lifebuoy", saas: "sliders-horizontal", addons: "puzzle-piece", desktop: "desktop", ask: "sparkle" } },
    tabler: { label: "Tabler (technical)", prefix: "tabler", suffix: "", map: {
      launchpad: "rocket", dashboard: "layout-dashboard", conversations: "message-circle", calendars: "calendar",
      contacts: "users", opportunities: "layout-kanban", payments: "credit-card", ai: "robot", marketing: "speakerphone",
      automation: "route", sites: "world", memberships: "school", media: "photo", reputation: "star",
      reporting: "chart-bar", marketplace: "building-store", settings: "settings", accounts: "building", snapshots: "camera",
      reselling: "coin", affiliate: "heart-handshake", templates: "files", partners: "heart-handshake",
      university: "book", swag: "gift", ideas: "bulb", mobile: "device-mobile", prospecting: "search",
      billing: "receipt", help: "lifebuoy", saas: "adjustments-horizontal", addons: "puzzle", desktop: "device-desktop", ask: "sparkles" } }
  };
  PACKS["phosphor-duotone"] = { label: "Phosphor duotone", prefix: "ph", suffix: "-duotone", map: PACKS.phosphor.map };

  /* GHL menu ids (same in every language) */
  var ID_KEYS = {
    "launchpad": "launchpad", "dashboard": "dashboard", "agency-dashboard": "dashboard", "conversations": "conversations",
    "calendars": "calendars", "contacts": "contacts", "opportunities": "opportunities", "payments": "payments",
    "ai-agents": "ai", "ai-studio": "ai", "ask-ai": "ask", "email-marketing": "marketing", "marketing": "marketing",
    "automation": "automation", "sites": "sites", "memberships": "memberships", "app-media": "media", "media-storage": "media",
    "reputation": "reputation", "reporting": "reporting", "app-marketplace": "marketplace", "location-mobile-app": "mobile",
    "settings": "settings", "location-settings": "settings", "agency-settings": "settings", "prospecting": "prospecting",
    "agency-accounts": "accounts", "agency-account-snapshots": "snapshots", "agency-account-reselling": "reselling",
    "agency-marketplace": "addons", "agency-affiliate-portal": "affiliate", "agency-template-library": "templates",
    "agency-partners": "partners", "agency-university": "university", "saas-education": "university", "ghl-swag": "swag",
    "agency-ideas": "ideas", "mobile-app-customiser": "mobile", "agency-app-marketplace": "marketplace",
    "saas-configurator": "saas", "agency-billing": "billing"
  };
  /* Menu labels: English, French, Spanish */
  var LABELS = [
    [/ask ai|demander [Ã a] l.ia|preguntar a la ia/, "ask"],
    [/^launch ?pad|rampe de lancement|plataforma de lanzamiento/, "launchpad"],
    [/dashboard|tableau de bord|panel de control|^panel\b/, "dashboard"],
    [/^conversa/, "conversations"], [/^calend/, "calendars"], [/^contact/, "contacts"],
    [/^opportunit|^oportunidad/, "opportunities"], [/^payments?\b|^paiements?|^pagos?\b/, "payments"],
    [/^ai\b|^ia\b|ai agents?|ai employee|ai suite|ai studio|agents? (ia|d.ia)|agentes de ia/, "ai"],
    [/configurat|configurador/, "saas"],
    [/^(email )?marketing/, "marketing"], [/^automat|^workflows?\b/, "automation"],
    [/^sites?\b|^funnels?\b|^websites?\b|^sitios/, "sites"],
    [/^memberships?\b|^courses?\b|^adh[Ã©e]sions?|^membres[iÃ­]as?/, "memberships"],
    [/m[Ã©e]dia/, "media"], [/^r[Ã©e]putaci?on/, "reputation"],
    [/^reporting|^reports?\b|^rapports?|^informes?/, "reporting"],
    [/marketplace|mercado de ap/, "marketplace"],
    [/add-?ons?|compl[Ã©e]ment/, "addons"],
    [/^settings?\b|^param[eÃ¨]tres|^configuraci[oÃ³]n/, "settings"],
    [/sub-? ?accounts?|sous-comptes|subcuentas/, "accounts"], [/snapshot|instantan/, "snapshots"],
    [/resell|revente|reventa/, "reselling"], [/affili|afiliad/, "affiliate"],
    [/template|mod[eÃ¨]les|plantillas/, "templates"], [/^partners?\b|^partenaires|^socios/, "partners"],
    [/universit|education|formation|educaci/, "university"], [/swag|cadeau|regalo/, "swag"],
    [/^ideas?\b|^id[Ã©e]es/, "ideas"], [/desktop|de bureau|escritorio/, "desktop"],
    [/mobile|^application|m[oÃ³]vil/, "mobile"], [/prospect/, "prospecting"],
    [/billing|facturation|facturaci/, "billing"], [/^help\b|^aide\b|^ayuda/, "help"]
  ];

  /* ---------------- Utilities ---------------- */
  var HEX = /^#[0-9a-fA-F]{6}$/;
  function safeUrl(u) { return typeof u === "string" && u.length < 600 && /^https:\/\/[^\s"'()<>\\]+$/.test(u); }
  function safeIconRef(v) { return typeof v === "string" && (safeUrl(v) || /^[a-z0-9-]+:[a-z0-9-]+$/.test(v) || /^[a-z0-9-]+$/.test(v)); }
  function clamp(n, a, b, d) { n = Number(n); return isFinite(n) ? Math.min(b, Math.max(a, Math.round(n))) : d; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); }

  function lum(hex) {
    var f = function (i) { var c = parseInt(hex.substr(i, 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5);
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function worstContrast(bg, end, ink) {
    var score = contrast(bg, ink);
    if (HEX.test(end) && end !== bg) score = Math.min(score, contrast(end, ink));
    return score;
  }
  // Dark or light, whichever stays readable on both ends of the sidebar.
  function sidebarInk(bg, end) {
    var dark = "#111827", light = "#F8FAFC";
    var darkScore = worstContrast(bg, end, dark), lightScore = worstContrast(bg, end, light);
    if (Math.max(darkScore, lightScore) < 4.5) {
      return worstContrast(bg, end, "#FFFFFF") >= worstContrast(bg, end, "#000000") ? "#FFFFFF" : "#000000";
    }
    return darkScore >= lightScore ? dark : light;
  }
  function inkFor(t) {
    // Manual highlight choices are authoritative; contrast belongs to ink,
    // not to a replacement background color.
    return t.accent;
  }
  function clean(t, base) {
    var o = copy(base || DEFAULT);
    if (!t || typeof t !== "object") return o;
    COLOR_FIELDS.forEach(function (f) { if (HEX.test(t[f[0]])) o[f[0]] = t[f[0]].toUpperCase(); });
    if (typeof t.font === "string" && /^[a-zA-Z0-9 -]{1,60}$/.test(t.font)) o.font = t.font;
    if (["app", "sidebar", "none"].indexOf(t.fontScope) > -1) o.fontScope = t.fontScope;
    if (t.iconPack === "default" || PACKS[t.iconPack]) o.iconPack = t.iconPack;
    if (t.logoUrl === "" || safeUrl(t.logoUrl)) o.logoUrl = t.logoUrl;
    if (t.logoHeight != null) o.logoHeight = clamp(t.logoHeight, 20, 90, o.logoHeight);
    if (t.radius != null) o.radius = clamp(t.radius, 0, 20, o.radius);
    if (typeof t.appAccent === "boolean") o.appAccent = t.appAccent;
    if (typeof t.motion === "boolean") o.motion = t.motion;
    if (typeof t.customSurface === "boolean") o.customSurface = t.customSurface;
    if (!HEX.test(o.sidebarBg)) o.sidebarBg = DEFAULT.sidebarBg;
    if (!HEX.test(o.sidebarBgEnd)) o.sidebarBgEnd = o.sidebarBg;
    if (t.sidebarText === "auto" || !HEX.test(o.sidebarText)) {
      o.sidebarText = sidebarInk(o.sidebarBg, o.sidebarBgEnd);
    }
    if (t.icons && typeof t.icons === "object") {
      o.icons = {};
      Object.keys(t.icons).forEach(function (k) { if (/^[a-z0-9:-]{2,60}$/.test(k) && safeIconRef(t.icons[k])) o.icons[k] = t.icons[k]; });
    }
    if (typeof t.name === "string" && t.name.trim()) o.name = t.name.trim().slice(0, 40);
    // Contrast selects defaults only; a valid manual color is authoritative.
    if (HEX.test(o.accent) && !HEX.test(t.accentText)) {
      o.accentText = contrast(o.accent, "#FFFFFF") >= contrast(o.accent, "#111827") ? "#FFFFFF" : "#111827";
    }
    return o;
  }

  var PRESETS = [
    { name: "Midnight gold", sidebarBg: "#0E1A3A", sidebarBgEnd: "#1B2D5E", sidebarText: "#C9D3EA", accent: "#D4A72C", accentText: "#14203F", headerBg: "#FFFFFF", font: "Plus Jakarta Sans", iconPack: "lucide" },
    { name: "Evergreen", sidebarBg: "#0F3B2D", sidebarBgEnd: "#1B5A43", sidebarText: "#CFE6DA", accent: "#46B98A", accentText: "#062318", headerBg: "#FFFFFF", font: "Manrope", iconPack: "phosphor" },
    { name: "Linen and wine", sidebarBg: "#FFFFFF", sidebarBgEnd: "#F5EFEC", sidebarText: "#4B3A3F", accent: "#7A1F3D", accentText: "#FFFFFF", headerBg: "#FFFFFF", font: "DM Sans", iconPack: "tabler" },
    { name: "Clear sky", sidebarBg: "#EEF5FF", sidebarBgEnd: "#CFE2FA", sidebarText: "#1D3557", accent: "#2F6FED", accentText: "#FFFFFF", headerBg: "#FFFFFF", font: "Inter", iconPack: "lucide" },
    { name: "Graphite", sidebarBg: "#1D2026", sidebarBgEnd: "#2B3039", sidebarText: "#C7CCD4", accent: "#F1F2F4", accentText: "#1D2026", headerBg: "#FFFFFF", font: "Figtree", iconPack: "phosphor-duotone" },
    { name: "Harbor", sidebarBg: "#113847", sidebarBgEnd: "#1B5263", sidebarText: "#D2E5EA", accent: "#FF8F66", accentText: "#2B1206", headerBg: "#FFFFFF", font: "Outfit", iconPack: "phosphor-duotone" }
  ].map(function (p) { return clean(p, DEFAULT); });

  function store(k) { return k === "agency" ? String(CFG.agencyKey || "agency") : k; }
  function storageKey(k) { return k.indexOf("presets:") === 0 ? PRESET_LS + store(k) : LS + store(k); }
  function lsGet(k) { try { var v = localStorage.getItem(storageKey(k)); if (!v && k.indexOf("presets:") === 0) { v = localStorage.getItem(LS + store(k)); if (v) localStorage.setItem(storageKey(k), v); } return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v) localStorage.setItem(storageKey(k), JSON.stringify(v)); else localStorage.removeItem(storageKey(k)); } catch (e) { } }

  function mergeField(v) { v = v == null ? "" : String(v); return v.indexOf("{" + "{") > -1 ? "" : v; }
  function user() {
    var u = CFG.user || {};
    return {
      type: mergeField(u.type).toLowerCase(),
      role: mergeField(u.role).toLowerCase(),
      email: mergeField(u.email),
      id: mergeField(u.id),
      companyId: mergeField(u.companyId)
    };
  }
  function saveProof() {
    var u = user();
    return {
      saveToken: CFG.saveToken || "",
      userId: u.id || "",
      userEmail: u.email || "",
      userType: u.type || "",
      userRole: u.role || ""
    };
  }
  function agencyIdFromKey(key) {
    return String(key || "").trim().replace(/^agency-/i, "");
  }
  // The grant body is not a secret. The signature is checked on the server.
  function grantClaims(token) {
    var raw = String(token || "");
    var dot = raw.indexOf(".");
    if (dot < 10 || raw.indexOf(".", dot + 1) !== -1) return null;
    try {
      var body = raw.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/");
      while (body.length % 4) body += "=";
      var claims = JSON.parse(atob(body));
      if (!claims || claims.v !== 1 || typeof claims.a !== "string" || !isFinite(claims.exp)) return null;
      return claims;
    } catch (e) { return null; }
  }
  // ok: issued for this agency and still live. opaque: not a grant we can read
  // (sent through so the server can reject a forgery). stale/foreign are dropped.
  function grantState(token, agencyKey) {
    if (!String(token || "").trim()) return "missing";
    var claims = grantClaims(token);
    if (!claims) return "opaque";
    if (claims.exp <= Math.floor(Date.now() / 1000) + 60) return "stale";
    if (claims.a !== agencyIdFromKey(agencyKey)) return "foreign";
    return "ok";
  }
  function grantScriptUrl() {
    var id = agencyIdFromKey(CFG.agencyKey);
    if (!id) return "";
    return themeEndpoint().replace(/\/location-theme\/?$/, "/dynamic-styles") + "?agency_id=" + encodeURIComponent(id) + "&type=js&force=1";
  }
  function readGrantFromScript(js) {
    var match = String(js || "").match(/"saveToken":"([A-Za-z0-9_-]{10,400}\.[A-Za-z0-9_-]{10,200})"/);
    return match ? match[1] : "";
  }
  // A long-lived sub-account tab keeps the grant from when the script loaded.
  // Refetch only when that grant is missing, expired, or issued for another id.
  function refreshSaveGrant() {
    var state = grantState(CFG.saveToken, CFG.agencyKey);
    if (state === "ok" || state === "opaque") return Promise.resolve(CFG.saveToken || "");
    CFG.saveToken = "";
    var url = grantScriptUrl();
    if (!url) return Promise.resolve("");
    return fetch(url, { method: "GET", cache: "no-store" }).then(function (r) {
      if (!r.ok || typeof r.text !== "function") throw new Error("grant");
      return r.text();
    }).then(function (js) {
      var next = readGrantFromScript(js);
      if (grantState(next, CFG.agencyKey) !== "ok") return "";
      CFG.saveToken = next;
      if (window.SAI_THEME_CONFIG) window.SAI_THEME_CONFIG.saveToken = next;
      return next;
    }).catch(function () { return ""; });
  }
  function hasIdentity() {
    var u = user();
    return !!(u.type || u.role || u.email || u.id);
  }
  var userHunt = null, hunting = false, saveBusy = false;
  function mergeUser(src) {
    if (!src) return;
    var cur = CFG.user || {};
    function keep(next, prev) {
      next = next == null ? "" : String(next);
      if (!next || next.indexOf("{" + "{") > -1) return prev || "";
      return String(next).trim();
    }
    var next = {
      type: keep(src.type, cur.type),
      role: keep(src.role, cur.role),
      email: keep(src.email, cur.email),
      id: keep(src.id, cur.id),
      companyId: keep(src.companyId, cur.companyId)
    };
    var changed = next.type !== (cur.type || "") || next.role !== (cur.role || "") || next.email !== (cur.email || "") || next.id !== (cur.id || "") || next.companyId !== (cur.companyId || "");
    CFG.user = next;
    if (!changed) return;
    settleAccess();
    if (!canEdit()) {
      var ex = document.querySelector(".sai-tb-trigger");
      if (ex) ex.remove();
      if (!saveBusy && !logoBusy && ui && ui.classList.contains("open")) closeBuilder();
    } else noteSidebar();
  }
  function pageUser() {
    return new Promise(function (resolve) {
      var utils = window.AppUtils && window.AppUtils.Utilities;
      if (!utils || typeof utils.getCurrentUser !== "function") { resolve(null); return; }
      var finished = false;
      var timer = setTimeout(function () { if (!finished) { finished = true; resolve(null); } }, 1200);
      Promise.resolve().then(function () { return utils.getCurrentUser(); }).then(function (info) {
        if (!utils.getCompany) return { info: info, company: null };
        return Promise.resolve().then(function () { return utils.getCompany(); }).then(function (company) {
          return { info: info, company: company };
        });
      }).then(function (pack) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(pack || null);
      }).catch(function () {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(null);
      });
    });
  }
  function discoverUser() {
    if (user().id) return Promise.resolve(user());
    if (userHunt) return userHunt;
    userHunt = pageUser().then(function (pack) {
      userHunt = null;
      if (pack && pack.info) {
        mergeUser({
          id: pack.info.id,
          email: pack.info.email,
          type: pack.info.type,
          role: pack.info.role,
          companyId: pack.company && pack.company.id
        });
      }
      return user();
    }).catch(function () { userHunt = null; return user(); });
    return userHunt;
  }
  function huntUser() {
    if (hunting || user().id) return;
    hunting = true;
    var tries = 0;
    function again() {
      if (user().id || tries >= 8) { hunting = false; return; }
      tries++;
      discoverUser().then(function (found) {
        if (found.id || tries >= 8) { hunting = false; return; }
        setTimeout(again, tries < 4 ? 300 : 1000);
      });
    }
    again();
  }
  function settleAccess() {
    if (!hasIdentity() || CFG.accessExplicit) return;
    if (!CFG.builderAccess || CFG.builderAccess === "all") CFG.builderAccess = "admins";
  }
  settleAccess();
  function canEdit() {
    var a = CFG.builderAccess || "admins", u = user();
    if (a === "all") return true;
    if (a === "none") return false;
    if (a === "agency") return u.type === "agency";
    return u.type === "agency" || u.role === "admin";
  }
  var LOC_ID = /^[A-Za-z0-9_-]{3,80}$/;
  var LOC_SKIP = { location: 1, undefined: 1, null: 1, agency: 1, dashboard: 1, launchpad: 1 };
  function acceptLocationId(id) {
    id = String(id || "").trim();
    return LOC_ID.test(id) && !LOC_SKIP[id.toLowerCase()] ? id : "";
  }
  function locationIdFromText(text) {
    var re = /\/location\/([A-Za-z0-9_-]+)/g, found = "", m;
    while ((m = re.exec(String(text || "")))) {
      var id = acceptLocationId(m[1]);
      if (!id) continue;
      if (found && found !== id) return "";
      found = id;
    }
    return found;
  }
  function locationIdFromQuery(search) {
    var q = "";
    try {
      var params = new URLSearchParams(String(search || "").replace(/^[?#]/, ""));
      q = params.get("locationId") || params.get("location_id") || "";
    } catch (e) { q = ""; }
    return acceptLocationId(q);
  }
  function inLocationSidebar() {
    var sb = sidebar();
    var node = sb;
    while (node && node !== document.documentElement) {
      var cls = (node.getAttribute && node.getAttribute("class")) || "";
      if (/(^|\s)sidebar-v2-agency(\s|$)/.test(cls)) return false;
      if (/(^|\s)sidebar-v2-location(\s|$)/.test(cls)) return true;
      node = node.parentElement;
    }
    var rootCls = ((document.body && document.body.getAttribute("class")) || "");
    if (/(^|\s)sidebar-v2-agency(\s|$)/.test(rootCls)) return false;
    return /(^|\s)sidebar-v2-location(\s|$)/.test(rootCls);
  }
  function locationIdFromSidebar() {
    if (!inLocationSidebar()) return "";
    var sb = sidebar();
    if (!sb) return "";
    var ids = [];
    function add(id) {
      if (!id || ids.indexOf(id) !== -1) return;
      ids.push(id);
    }
    var marked = sb.querySelectorAll("[data-location-id],[data-locationid],[data-loc-id]");
    for (var a = 0; a < marked.length; a++) {
      add(acceptLocationId(marked[a].getAttribute("data-location-id") || marked[a].getAttribute("data-locationid") || marked[a].getAttribute("data-loc-id")));
    }
    var links = sb.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) add(locationIdFromText(links[i].getAttribute("href") || "") || locationIdFromQuery(links[i].getAttribute("href") || ""));
    return ids.length === 1 ? ids[0] : "";
  }
  // Sub-account id from the URL first. HighLevel also keeps the id in the hash
  // or only on the location sidebar. Never treat that view as the agency key.
  function routeKey() {
    var pathId = locationIdFromText(location.pathname || "");
    if (pathId) return pathId;
    var queryId = locationIdFromQuery(location.search || "");
    if (queryId) return queryId;
    var hash = location.hash || "";
    var hashQuery = hash.indexOf("?") > -1 ? hash.slice(hash.indexOf("?")) : "";
    var hashId = locationIdFromText(hash) || locationIdFromQuery(hashQuery);
    if (hashId) return hashId;
    var sideId = locationIdFromSidebar();
    if (sideId) return sideId;
    return "agency";
  }
  function blocksAgencyWrite() { return routeKey() === "agency" && inLocationSidebar(); }
  function allowed(k) { var l = CFG.onlyLocations; return !(Array.isArray(l) && l.length) || l.indexOf(k) > -1; }

  /* ---------------- Supabase ---------------- */
  function sbHeaders() {
    var h = { apikey: SB_KEY, "Content-Type": "application/json" };
    if (/^eyJ/.test(SB_KEY)) h.Authorization = "Bearer " + SB_KEY;
    return h;
  }
  function remoteLoad(keys) {
    var url = SB_URL + "/rest/v1/ghl_themes?select=location_id,theme&location_id=in.(" + keys.map(function (k) { return encodeURIComponent(store(k)); }).join(",") + ")";
    return fetch(url, { headers: sbHeaders() }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).then(function (rows) {
      var m = {};
      keys.forEach(function (k) { m[k] = false; });
      (rows || []).forEach(function (row) { keys.forEach(function (k) { if (store(k) === row.location_id) m[k] = row.theme || false; }); });
      return m;
    });
  }
  function remoteSave(key, theme) {
    return fetch(SB_URL + "/rest/v1/rpc/save_ghl_theme", {
      method: "POST", headers: sbHeaders(),
      body: JSON.stringify({ p_location_id: store(key), p_theme: theme, p_user: user().email || null })
    }).then(function (r) {
      if (r.ok) return;
      return r.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.message || "HTTP " + r.status); });
    });
  }

  /* ---------------- Resolve theme for current page ---------------- */
  var state = { key: null, remote: {}, theme: null, editing: false, names: {}, settings: null };
  function source(k) {
    var cfg = k === "agency" ? CFG.agencyTheme : (CFG.locationThemes || {})[k];
    if ((HAS_SB || state.shared) && state.remote[k] !== undefined) return state.remote[k] || cfg || null;
    return lsGet(k) || cfg || null;
  }
  function isDefault(x) { return !!(x && x.ghlDefault === true); }
  function isInherit(x) { return !!(x && x.inheritAgency === true); }
  function storedOverride(k) {
    var raw = (HAS_SB || state.shared) && state.remote[k] !== undefined ? state.remote[k] : lsGet(k);
    if (!raw || isDefault(raw) || isInherit(raw)) return null;
    return raw;
  }
  function resolve(k) {
    var agOverride = storedOverride("agency");
    var agFull = agOverride ? clean(agOverride, DEFAULT) : (CFG.agencyTheme ? clean(CFG.agencyTheme, DEFAULT) : null);
    // Location colors inherit the agency palette. The logo stays in its own slot
    // so a logo baked into the agency theme is not copied onto every location.
    var agColors = agFull ? copy(agFull) : null;
    if (agColors) agColors.logoUrl = "";
    var raw = (HAS_SB || state.shared) && state.remote[k] !== undefined ? state.remote[k] : lsGet(k);
    if (k === "agency") return isDefault(raw) ? null : agFull;
    if (isDefault(raw)) return null;
    var own = storedOverride(k);
    if (own) return clean(own, agColors || DEFAULT);
    return CFG.inheritAgencyTheme === false ? null : agColors;
  }

  /* ---------------- CSS ---------------- */
  function buildCss() {
    var S = "html.sai-on body " + SBX;
    var A = S + " :is(" + NAV_LINKS + ")";
    var M = "html.sai-motion body " + SBX;
    var NOT_OV = ":not(.sai-overlay):not(.sai-overlay *)";
    var AM = M + " :is(" + NAV_LINKS + ")";
    var NOFONT = ":not(i,code,pre,kbd,samp,[class*='fa-'],[class^='fa'],[class*='icon'],[class*='material'],.monaco-editor *,.CodeMirror *,.sai-tb,.sai-tb *)";
    return [
      "@property --sai-sb-bg{syntax:'<color>';inherits:true;initial-value:#0E1A3A}",
      "@property --sai-sb-bg2{syntax:'<color>';inherits:true;initial-value:#1B2D5E}",
      "@property --sai-sb-text{syntax:'<color>';inherits:true;initial-value:#C9D3EA}",
      "@property --sai-accent{syntax:'<color>';inherits:true;initial-value:#D4A72C}",
      "@property --sai-accent-text{syntax:'<color>';inherits:true;initial-value:#14203F}",
      "@property --sai-header-bg{syntax:'<color>';inherits:true;initial-value:#FFFFFF}",
      "@property --sai-ink{syntax:'<color>';inherits:true;initial-value:#2F6FED}",
      "@property --sai-ink-text{syntax:'<color>';inherits:true;initial-value:#FFFFFF}",
      ":root{--sai-ease:cubic-bezier(.22,.61,.36,1);--sai-radius:10px}",
      "html.sai-on{transition:--sai-sb-bg .6s var(--sai-ease),--sai-sb-bg2 .6s var(--sai-ease),--sai-sb-text .45s var(--sai-ease),--sai-accent .45s var(--sai-ease),--sai-accent-text .45s var(--sai-ease),--sai-header-bg .5s var(--sai-ease),--sai-ink .45s var(--sai-ease),--sai-ink-text .45s var(--sai-ease)}",

      /* Sidebar surface */
      S + "{background:linear-gradient(180deg,var(--sai-sb-bg) 0%,var(--sai-sb-bg2) 100%)!important;color:var(--sai-sb-text)!important}",
      S + " > div:not(.sai-footbg)," + S + " nav:not(.sai-footbg)," + S + " header:not(.sai-footbg)," + S + " aside:not(.sai-footbg){background:transparent!important}",
      S + " [class*='uppercase']:not(.sai-overlay *){color:color-mix(in srgb,var(--sai-sb-text) 62%,transparent)!important}",
      S + " :is(hr,[class*='border'])" + NOT_OV + "{border-color:color-mix(in srgb,var(--sai-sb-text) 14%,transparent)!important}",
      S + " :is(button,a):not(.sai-tb-trigger)" + NOT_OV + "{color:inherit}",
      S + " :is(input,textarea,#globalSearchOpener,.sidebar-search){background-color:color-mix(in srgb,var(--sai-sb-text) 12%,var(--sai-sb-bg))!important;background-image:none!important;color:var(--sai-search-fg,var(--sai-sb-text))!important;-webkit-text-fill-color:var(--sai-search-fg,var(--sai-sb-text))!important;border-color:color-mix(in srgb,var(--sai-sb-text) 28%,transparent)!important;box-shadow:none!important;filter:none!important;opacity:1!important}",
      S + " :is(input,textarea)::placeholder{color:var(--sai-search-fg,var(--sai-sb-text))!important;opacity:1!important;-webkit-text-fill-color:var(--sai-search-fg,var(--sai-sb-text))!important}",
      S + " :is(kbd,.search-shortcut,.search-placeholder){background:color-mix(in srgb,var(--sai-sb-text) 16%,var(--sai-sb-bg))!important;background-image:none!important;color:var(--sai-search-fg,var(--sai-sb-text))!important;-webkit-text-fill-color:var(--sai-search-fg,var(--sai-sb-text))!important;border:1px solid transparent!important;-webkit-text-stroke:0!important;text-shadow:none!important;box-shadow:none!important;filter:none!important;opacity:1!important;-webkit-mask:none!important;mask:none!important}",
      /* White boxes inside the sidebar (section labels, search, Go Back) take the sidebar color */
      S + " .sai-unwhite{background-color:color-mix(in srgb,var(--sai-sb-bg2) var(--sai-mix,50%),var(--sai-sb-bg))!important;color:var(--sai-sb-text)!important;border-color:color-mix(in srgb,var(--sai-sb-text) 16%,transparent)!important;box-shadow:none!important}",
      S + " .sai-unwhite.sai-field{background-color:color-mix(in srgb,var(--sai-sb-text) 12%,color-mix(in srgb,var(--sai-sb-bg2) var(--sai-mix,50%),var(--sai-sb-bg)))!important}",
      S + " .sai-unwhite *:not(.sai-ico):not(.sai-overlay):not(.sai-overlay *){color:inherit!important}",
      /* Dark text the theme didn't reach (e.g. the "Settings" heading) */
      S + " .sai-text{color:var(--sai-sb-text)!important}",
      /* Pinned areas keep a solid fill. No z-index: a raised footer was painting over Reporting. */
      S + " .sai-solid{background-color:color-mix(in srgb,var(--sai-sb-bg2) var(--sai-mix,100%),var(--sai-sb-bg))!important;box-shadow:none!important}",
      /* The pinned Settings row is HighLevel's sticky footer. A raised shadow read as a gradient between Mobile App and Settings. */
      "html body " + SBX + " .hl_nav-settings,html body " + SBX + " .hl_nav-settings::before,html body " + SBX + " .hl_nav-settings::after{box-shadow:none!important;background-image:none!important;filter:none!important}",
      S + " .sai-footbg{background:linear-gradient(180deg,var(--sai-sb-bg) 0%,var(--sai-sb-bg2) 100%)!important;z-index:auto!important}",
      S + " :is(a#sb_reporting,a#sb_settings,a#sb_location-settings,a#sb_agency-settings){position:relative!important;top:auto!important;bottom:auto!important;z-index:auto!important;transform:none!important}",
      /* Classic and Simple pin Reporting and Settings to the same bottom edge. Minimalist already keeps Settings in its own footer, so this stays off for v3. */
      "html.sai-pin-footer body " + SBX + "{display:flex!important;flex-direction:column!important;height:100vh!important;max-height:100vh!important}",
      "html.sai-pin-footer body " + SBX + " :is(.hl_nav-header,.hl_nav-header-without-footer){flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow-y:auto!important}",
      "html.sai-pin-footer body " + SBX + " .hl_nav-settings{position:relative!important;inset:auto!important;flex:0 0 auto!important;height:auto!important;width:100%!important;z-index:auto!important;min-height:0!important;margin-bottom:0!important;padding-bottom:8px!important}",
      /* Clear the legacy collapse-control spacer only in the single-link footer. */
      "html.sai-pin-footer body " + SBX + " .hl_nav-settings > nav{display:flex!important;flex-direction:column!important;height:auto!important;min-height:0!important;margin-bottom:0!important;padding-bottom:0!important}",
      "html.sai-pin-footer body " + SBX + " .hl_nav-settings a{position:relative!important;inset:auto!important;flex:0 0 auto!important;height:auto!important;min-height:40px!important;box-sizing:border-box!important}",
      "html.sai-pin-footer body " + SBX + ":has(.hl_nav-settings :is(#sb_settings,#sb_location-settings,#sb_agency-settings)) .hl_nav-settings{flex:0 0 auto!important;overflow:visible!important}",
      "html.sai-pin-footer body " + SBX + ":has(.hl_nav-settings :is(#sb_settings,#sb_location-settings,#sb_agency-settings)) :is(.hl_nav-header,.hl_nav-header-without-footer){flex:1 1 auto!important;overflow-y:auto!important}",
      /* Settings reuses .hl_nav-settings for the whole menu. The one-link footer rule above would leave a blank band under that list. */
      "html.sai-pin-footer body " + SBX + " .hl_nav-settings:is(:has(a ~ a),:has(> nav > :nth-child(2))):not(:has(:is(#sb_settings,#sb_location-settings,#sb_agency-settings))){flex:1 1 auto!important;min-height:0!important;height:auto!important;overflow-x:hidden!important;overflow-y:auto!important;padding-bottom:0!important}",
      "html.sai-pin-footer body " + SBX + ":has(.hl_nav-settings:is(:has(a ~ a),:has(> nav > :nth-child(2))):not(:has(:is(#sb_settings,#sb_location-settings,#sb_agency-settings)))) :is(.hl_nav-header,.hl_nav-header-without-footer){flex:0 0 auto!important;height:auto!important;min-height:0!important;padding-bottom:0!important;overflow:visible!important}",
      "html.sai-pin-footer body " + SBX + " :is(a#sb_reporting,a#sb_settings,a#sb_location-settings,a#sb_agency-settings){position:relative!important;inset:auto!important;margin-top:0!important;transform:none!important;z-index:auto!important}",
      /* Pop-up panels opened from the sidebar (account switcher list) keep GHL's light look */
      "html.sai-on .sai-overlay{color:#101828}",

      /* Account switcher */
      S + " " + SWITCHER + "{background:color-mix(in srgb,var(--sai-sb-text) 9%,transparent)!important;color:var(--sai-sb-text)!important;border:1px solid color-mix(in srgb,var(--sai-sb-text) 14%,transparent)!important;border-radius:var(--sai-radius)!important}",
      S + " " + SWITCHER + " *" + NOT_OV + "{color:inherit!important}",
      S + " " + SWITCHER + ":hover{background:color-mix(in srgb,var(--sai-accent) 18%,transparent)!important;border-color:color-mix(in srgb,var(--sai-accent) 60%,transparent)!important}",
      M + " " + SWITCHER + "{transition:background-color .3s var(--sai-ease),border-color .3s var(--sai-ease),box-shadow .35s var(--sai-ease)}",
      M + " " + SWITCHER + ":hover{box-shadow:0 10px 24px -14px var(--sai-glide,rgba(16,24,40,.45))}",

      /* Nav items: colors (theme) */
      A + "{color:var(--sai-sb-text)!important;background:transparent!important;border-radius:var(--sai-radius)!important}",
      A + " *:not(.sai-ico){color:inherit!important}",
      A + " svg{color:inherit!important}",
      A + ":is(" + ACTIVE + ",:hover){background:var(--sai-accent)!important;color:var(--sai-accent-text)!important;box-shadow:0 8px 20px -12px var(--sai-accent)}",
      A + ":is(" + ACTIVE + ",:hover) *:not(.sai-ico){color:var(--sai-accent-text)!important;-webkit-text-fill-color:var(--sai-accent-text)!important}",

      /* Nav items: motion (always on) */
      AM + "{transition:color .25s var(--sai-ease),background-color .3s var(--sai-ease),box-shadow .3s var(--sai-ease)}",
      AM + " > *{transition:transform .25s var(--sai-ease)}",
      AM + ":hover > *{transform:translateX(3px)}",
      AM + " :is(.sai-ico,img,svg){transition:transform .35s var(--sai-ease)}",
      AM + ":hover :is(.sai-ico,img,svg){transform:scale(1.12) rotate(-6deg)}",
      "@keyframes sai-fade{from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:none} }",
      "html.sai-motion.sai-sb-expanding body " + SBX + " :is(" + NAV_LINKS + ") :is(span,p):not(.sai-ico),html.sai-motion.sai-sb-expanding body " + SBX + " " + SWITCHER + " :is(span,p){animation:sai-fade .32s var(--sai-ease) both}",

      /* Sidebar open/close */
      "html.sai-motion body " + SBX + "{transition:width .38s var(--sai-ease),min-width .38s var(--sai-ease),max-width .38s var(--sai-ease),flex-basis .38s var(--sai-ease)}",
      "html.sai-motion body :is(.hl_wrapper,.hl_header){transition:padding-left .38s var(--sai-ease),margin-left .38s var(--sai-ease),left .38s var(--sai-ease),width .38s var(--sai-ease)}",

      /* Hover glider that slides between items */
      ".sai-glider{position:absolute;left:0;top:0;z-index:-1;pointer-events:none;border-radius:var(--sai-radius);background:color-mix(in srgb,var(--sai-glide,currentColor) 16%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--sai-glide,currentColor) 28%,transparent);opacity:0;transition:transform .34s var(--sai-ease),width .34s var(--sai-ease),height .34s var(--sai-ease),opacity .2s ease}",
      ".sai-glider.on{opacity:1}",
      M + " nav{isolation:isolate}",
      "html:not(.sai-motion) .sai-glider{display:none}",

      /* Icons (CSS mask so they take the theme color) */
      ".sai-ico{display:inline-block;width:18px;height:18px;flex:0 0 auto;background-color:currentColor;-webkit-mask:var(--sai-ico) center/contain no-repeat;mask:var(--sai-ico) center/contain no-repeat}",
      "html body " + SBX + " [data-sai-native='1']{display:none!important;visibility:hidden!important;background-image:none!important;-webkit-mask-image:none!important;mask-image:none!important}",

      /* Logo. The HighLevel image stays the company logo. A sibling shows a sub-account logo. Expanded logos cap at 40px inside a fixed box with 12px under the image. Collapsed, a wide logo may briefly use a square mark and the full image returns when the rail opens. */
      "html body " + SBX + " img.sai-logo-hidden{position:absolute!important;width:1px!important;height:1px!important;max-height:1px!important;margin:0!important;padding:0!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;transform:none!important}",
      "html body " + SBX + " .agency-logo-container{display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;align-self:stretch!important;box-sizing:border-box!important;width:100%!important;min-height:60px!important;max-height:60px!important;margin:0!important;padding:8px 12px 12px!important;overflow:hidden!important}",
      "html body " + SBX + " :is(img.sai-logo-slot,img.agency-logo,.agency-logo-container img):not(.sai-logo-hidden){display:block!important;box-sizing:border-box!important;flex:0 0 auto!important;align-self:center!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:min(40px,var(--sai-logo-h,40px))!important;margin:0 auto!important;object-fit:contain!important;object-position:center!important;transform:none!important}",
      "html.sai-sb-collapsed body " + SBX + " .agency-logo-container{min-height:36px!important;max-height:40px!important;padding:4px!important}",
      "html.sai-sb-collapsed body " + SBX + " :is(img.sai-logo-slot,img.agency-logo,.agency-logo-container img):not(.sai-logo-hidden){max-width:calc(100% - 4px)!important;max-height:32px!important}",
      /* Header logo slot. A wide custom upload was painting past the top-left mark. */
      "html body .hl_header :is(.agency-logo-container,.hl_header--logo,.hl-header-logo){display:flex!important;align-items:center!important;box-sizing:border-box!important;max-width:min(220px,42vw)!important;max-height:48px!important;overflow:hidden!important}",
      "html body .hl_header :is(img.agency-logo,img.company-logo,.agency-logo-container img,.hl_header--logo img,.hl-header-logo img){display:block!important;box-sizing:border-box!important;width:auto!important;height:auto!important;max-width:100%!important;max-height:40px!important;object-fit:contain!important;object-position:left center!important;transform:none!important}",

      /* Top bar */
      "html.sai-on body :is(.hl_header,.topmenu-nav,.hl_topbar-tabs){background:var(--sai-header-bg)!important;transition:background-color .4s var(--sai-ease)}",

      /* Reuse Top Button Customization's navigation style across every route.
         CSS-only coverage stays cheap even when heavy-page scans are paused. */
      "html.sai-app body .topmenu-navitem{padding:8px 12px!important;border:none!important;border-radius:4px!important}",
      "html.sai-app body :is(.topmenu-navitem.active,.topmenu-navitem.router-link-active,.topmenu-navitem.router-link-exact-active,.topmenu-navitem[aria-current='page'],.topmenu-navitem:hover,.topmenu-navitem a:hover){background:linear-gradient(270deg,var(--sai-accent) 0%,var(--sai-sb-bg) 100%)!important;color:var(--sai-accent-text)!important;-webkit-text-fill-color:var(--sai-accent-text)!important}",
      "html.sai-app body .topmenu-navitem:is(.active,.router-link-active,.router-link-exact-active,[aria-current='page'],:hover) :is(a,span,svg,i){color:var(--sai-accent-text)!important;-webkit-text-fill-color:var(--sai-accent-text)!important}",
      "html.sai-app body :is(.topmenu-navitem,.hr-tabs-tab,.n-tabs-tab,[role='tab']){transition:color .25s var(--sai-ease),border-color .25s var(--sai-ease)}",
      "html.sai-app body :is(.topmenu-navitem,.hr-tabs-tab,.n-tabs-tab,[role='tab']):hover{color:var(--sai-ink)!important;border-bottom-color:color-mix(in srgb,var(--sai-accent) 55%,transparent)!important}",
      "html.sai-app body :is(.topmenu-navitem.active,.topmenu-navitem.router-link-active,.topmenu-navitem.router-link-exact-active,.hr-tabs-tab--active,.n-tabs-tab--active,[role='tab'][aria-selected='true']){color:var(--sai-ink)!important;border-bottom-color:var(--sai-accent)!important;box-shadow:inset 0 -3px 0 var(--sai-accent)!important;background-color:color-mix(in srgb,var(--sai-accent) 10%,transparent)!important;border-radius:6px 6px 0 0}",
      "html.sai-app body :is(.hr-tabs-tab--active,.n-tabs-tab--active) *{color:inherit!important}",
      "html.sai-app body :is(.hr-tabs-bar,.n-tabs-bar){background-color:var(--sai-accent)!important;height:3px!important}",
      "html.sai-app body :is(.hr-button--primary-type,.n-button--primary-type,.btn-primary){--n-color:var(--sai-ink)!important;--n-color-hover:color-mix(in srgb,var(--sai-ink) 86%,#fff)!important;--n-color-pressed:color-mix(in srgb,var(--sai-ink) 86%,#000)!important;--n-color-focus:color-mix(in srgb,var(--sai-ink) 86%,#fff)!important;--n-border:1px solid var(--sai-ink)!important;--n-border-hover:1px solid color-mix(in srgb,var(--sai-ink) 86%,#fff)!important;--n-border-pressed:1px solid color-mix(in srgb,var(--sai-ink) 86%,#000)!important;--n-border-focus:1px solid color-mix(in srgb,var(--sai-ink) 86%,#fff)!important;--n-text-color:var(--sai-ink-text)!important;--n-text-color-hover:var(--sai-ink-text)!important;--n-text-color-pressed:var(--sai-ink-text)!important;--n-text-color-focus:var(--sai-ink-text)!important;background-color:var(--sai-ink)!important;border-color:var(--sai-ink)!important;color:var(--sai-ink-text)!important;transition:filter .2s ease,background-color .3s var(--sai-ease)}",
      "html.sai-app body :is(.hr-button--primary-type,.n-button--primary-type,.btn-primary):hover{filter:brightness(1.08)}",

      /* Fonts. The whole-app rule is skipped on Media Storage so a large grid is not restyled on every frame. */
      "html.sai-font-app:not(.sai-quiet-page) body{font-family:var(--sai-font)!important}",
      "html.sai-font-sidebar body " + SBX + ",html.sai-font-sidebar body " + SBX + " *" + NOFONT + "{font-family:var(--sai-font)!important}",

      /* Dropdowns open smoothly */
      "@keyframes sai-pop{from{opacity:0;transform:translateY(-6px) scale(.98)} to{opacity:1;transform:none} }",
      "html.sai-motion:not(.sai-quiet-page) :is(.n-dropdown-menu,.n-select-menu,.hr-dropdown-menu,.hr-select-menu){animation:sai-pop .2s var(--sai-ease)}",

      /* Builder trigger. Colors are set from the sidebar's computed background so a white HighLevel button rule cannot hide the label. */
      ".sai-tb-trigger{display:flex;align-items:center;position:relative;z-index:6;box-sizing:border-box;width:auto;max-width:100%;height:34px;flex:0 0 auto;align-self:stretch;margin:8px 10px;border-radius:var(--sai-radius);border:1px dashed var(--sai-tb-border, color-mix(in srgb, currentColor 55%, transparent));background:var(--sai-tb-bg, transparent)!important;color:var(--sai-tb-fg, inherit)!important;-webkit-text-fill-color:var(--sai-tb-fg, inherit)!important;overflow:hidden;transition:background-color .25s var(--sai-ease),border-color .25s var(--sai-ease),width .3s var(--sai-ease),margin .3s var(--sai-ease)}",
      "html body " + SBX + " .sai-tb-trigger{margin:8px 10px!important;width:auto!important;max-width:100%!important;flex:0 0 auto!important;align-self:stretch!important}",
      "html body " + SBX + " .sai-tb-trigger,html body " + SBX + " .sai-tb-trigger :is(.sai-tb-open,.sai-tb-label,.sai-tb-hide){color:var(--sai-tb-fg, inherit)!important;-webkit-text-fill-color:var(--sai-tb-fg, inherit)!important}",
      ".sai-tb-trigger:hover{border-style:solid;background:var(--sai-tb-bg, transparent)!important;filter:brightness(1.08)}",
      ".sai-tb-open{flex:1;display:flex;align-items:center;gap:8px;min-width:0;height:100%;padding:0 10px;border:0;background:transparent!important;color:inherit!important;-webkit-text-fill-color:inherit!important;font-size:12.5px;font-weight:600;line-height:1.2;white-space:nowrap;text-align:left;cursor:pointer}",
      ".sai-tb-open .sai-ico{width:16px;height:16px;background-color:currentColor!important}",
      ".sai-tb-label{overflow:hidden;text-overflow:ellipsis}",
      ".sai-tb-hide{flex:0 0 auto;display:grid;place-items:center;width:26px;height:26px;margin-right:4px;padding:0;border:0;border-radius:6px;background:transparent!important;color:inherit!important;opacity:.7;cursor:pointer;transition:opacity .2s ease,background-color .2s ease}",
      ".sai-tb-hide .sai-ico{width:14px;height:14px}",
      ".sai-tb-hide:hover{opacity:1;background:color-mix(in srgb,currentColor 14%,transparent)}",
      "html.sai-tb-min body " + SBX + " .sai-tb-trigger,html.sai-sb-collapsed body " + SBX + " .sai-tb-trigger{width:34px!important;min-width:34px!important;max-width:34px!important;margin:8px auto!important;flex:0 0 34px!important;align-self:center!important}",
      "html.sai-tb-min body " + SBX + " .sai-tb-open,html.sai-sb-collapsed body " + SBX + " .sai-tb-open{padding:0;justify-content:center}",
      "html.sai-tb-min body " + SBX + " :is(.sai-tb-label,.sai-tb-chip,.sai-tb-hide),html.sai-sb-collapsed body " + SBX + " :is(.sai-tb-label,.sai-tb-chip,.sai-tb-hide){display:none}",
      /* Header control. Collapsing the sidebar must not hide this label. */
      ".sai-tb-trigger.sai-tb-header{position:absolute;z-index:4;height:36px;margin:0!important;width:auto!important;max-width:240px!important;flex:0 0 auto;align-self:center;border-radius:980px;overflow:hidden}",
      ".sai-tb-trigger.sai-tb-header .sai-tb-hide{display:none!important}",
      ".sai-tb-trigger.sai-tb-header .sai-tb-open{height:100%;padding:0 12px 0 10px;gap:6px;font-size:14px;font-weight:600}",
      ".sai-tb-chip{flex:0 0 auto;font-size:10px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;line-height:1.2;padding:2px 5px;border:1px solid currentColor;border-radius:999px}",
      ".sai-tb-trigger.sai-tb-header[data-compact='1']{width:36px!important;min-width:36px!important;max-width:36px!important;border-radius:999px}",
      ".sai-tb-trigger.sai-tb-header[data-compact='1'] :is(.sai-tb-label,.sai-tb-chip,.sai-tb-hide){display:none!important}",
      ".sai-tb-trigger.sai-tb-header[data-compact='1'] .sai-tb-open{padding:0;justify-content:center}",
      "html.sai-sb-collapsed body " + SBX + " :is(input,textarea,kbd,#globalSearchOpener,.sidebar-search,.search-shortcut,.search-placeholder){display:none!important}",
      "html.sai-sb-collapsed body " + SBX + " [data-sai-collapsed-hide]{display:none!important}",
      "html.sai-sb-collapsed body " + SBX + " :is(nav a, a[id^='sb_']):not([id*='location-switcher']):not(:has(.hl_switcher-loc-name,.hl_switcher-loc-city,.hl_location-text)){justify-content:center!important;font-size:0!important;line-height:0!important}",
      "html.sai-sb-collapsed body " + SBX + " :is(nav a, a[id^='sb_']):not([id*='location-switcher']):not(:has(.hl_switcher-loc-name,.hl_switcher-loc-city,.hl_location-text)) :is(.nav-title,.hl_nav-title){display:none!important}",
      "html.sai-sb-collapsed body " + SBX + " [id*='location-switcher'],html.sai-sb-collapsed body " + SBX + " [id*='location-switcher'] :is(span,p,div,a,button),html.sai-sb-collapsed body " + SBX + " :is(.hl_switcher-loc-name,.hl_switcher-loc-city,.hl_location-text),html.sai-sb-collapsed body " + SBX + " :is(nav a, a[id^='sb_']):has(.hl_switcher-loc-name,.hl_switcher-loc-city,.hl_location-text){font-size:12px!important;line-height:1.25!important;color:var(--sai-sb-text)!important;-webkit-text-fill-color:var(--sai-sb-text)!important;white-space:normal!important;text-indent:0!important}",
      "html body " + SBX + " .sai-ico[data-sai-nav]{background-color:var(--sai-ico-fg, currentColor)!important;color:var(--sai-ico-fg, currentColor)!important}",
      "html body " + SBX + " :is(" + NAV_LINKS + "):is(" + ACTIVE + ",:hover) .sai-ico[data-sai-nav]{background-color:var(--sai-accent-text)!important;color:var(--sai-accent-text)!important}",
      "html.sai-sb-collapsed body " + SBX + " .sai-ico[data-sai-nav]{width:18px!important;height:18px!important;margin-left:0!important;margin-right:0!important}",
      ".sai-linkbtn{margin:6px 0 0;padding:0;border:0;background:none;color:#475467;font-size:12px;text-decoration:underline;text-underline-offset:2px;cursor:pointer}",
      ".sai-linkbtn:hover{color:#1B2230}",

      /* Builder panel */
      ".sai-tb{position:fixed;top:12px;right:12px;bottom:128px;width:min(372px,calc(100vw - 24px));display:flex;flex-direction:column;background:#fff;color:#1B2230;border-radius:16px;box-shadow:0 24px 60px -20px rgba(16,24,40,.35),0 0 0 1px rgba(16,24,40,.08);font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;z-index:2147483647;transform:translateX(calc(100% + 24px));visibility:hidden;transition:transform .45s cubic-bezier(.22,.61,.36,1),visibility 0s linear .45s}",
      ".sai-tb.open{transform:none;visibility:visible;transition:transform .45s cubic-bezier(.22,.61,.36,1),visibility 0s}",
      ".sai-tb *{box-sizing:border-box}",
      ".sai-tb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px 14px;border-bottom:1px solid #EEF0F3}",
      ".sai-tb-head h2{margin:0;font-size:17px;font-weight:650;letter-spacing:-.01em;color:#1B2230}",
      ".sai-tb-head p{margin:2px 0 0;color:#344054;font-size:12.5px}",
      ".sai-tb-beta{margin:6px 0 0;color:#B54708;font-size:12px;line-height:1.4}",
      ".sai-tb-install{margin:6px 0 0;color:#B54708;font-size:12px;line-height:1.4}",
      ".sai-tb-x{flex:0 0 auto;border:0;background:transparent;width:32px;height:32px;border-radius:8px;font-size:20px;line-height:1;color:#344054;cursor:pointer}",
      ".sai-tb-x:hover{background:#F2F4F7;color:#1B2230}",
      ".sai-tb-body{flex:1;overflow:auto;padding:4px 20px 16px}",
      ".sai-tb section,.sai-tb details.sai-fold{padding:12px 0;border-bottom:1px solid #F0F1F4}",
      ".sai-tb section:last-child,.sai-tb details.sai-fold:last-child{border-bottom:0}",
      ".sai-tb h3,.sai-tb details.sai-fold > summary{margin:0 0 10px;font-size:13px;font-weight:650;color:#1B2230}",
      ".sai-tb details.sai-fold > summary{cursor:pointer;margin:0}",
      ".sai-tb details.sai-fold[open] > summary{margin-bottom:10px}",
      ".sai-presets{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
      ".sai-preset{border:1px solid #E6E8EC;background:#fff;border-radius:12px;padding:6px;cursor:pointer;text-align:left;transition:border-color .2s,box-shadow .2s,transform .2s}",
      ".sai-preset:hover{transform:translateY(-1px);border-color:#C9CED6}",
      ".sai-preset[aria-pressed='true']{border-color:#1B2230;box-shadow:0 0 0 1px #1B2230}",
      ".sai-sw{display:block;height:40px;border-radius:8px;background:linear-gradient(180deg,var(--a),var(--b));position:relative;box-shadow:inset 0 0 0 1px rgba(16,24,40,.08)}",
      ".sai-sw::after{content:'';position:absolute;left:8px;right:18px;bottom:8px;height:8px;border-radius:4px;background:var(--c)}",
      ".sai-preset-name{display:block;margin-top:6px;font-size:11.5px;color:#1D2939;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".sai-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 0}",
      ".sai-row label,.sai-label{font-size:13px;color:#1B2230}",
      ".sai-color{display:flex;align-items:center;gap:6px}",
      ".sai-tb input[type=color]{width:32px;height:32px;padding:0;border:1px solid #E6E8EC;border-radius:8px;background:none;cursor:pointer}",
      ".sai-tb input[type=color]::-webkit-color-swatch-wrapper{padding:3px}",
      ".sai-tb input[type=color]::-webkit-color-swatch{border:0;border-radius:5px}",
      ".sai-tb input[type=text],.sai-tb input[type=url],.sai-tb select{height:32px;border:1px solid #E6E8EC;border-radius:8px;background:#F9FAFB;padding:0 10px;font-size:13px;color:#1B2230;outline:none;transition:border-color .2s,box-shadow .2s}",
      ".sai-tb [aria-invalid='true']{border-color:#F04438!important}",
      ".sai-hex{width:88px;font-variant-numeric:tabular-nums;text-transform:uppercase}",
      ".sai-tb :is(input,select,button,summary):focus-visible{border-color:#1B2230;box-shadow:0 0 0 3px rgba(27,34,48,.14);outline:none}",
      ".sai-full{width:100%}",
      ".sai-stack{display:grid;gap:8px}",
      ".sai-range{display:flex;align-items:center;gap:10px}",
      ".sai-range input{flex:1;accent-color:#1B2230}",
      ".sai-range output{min-width:40px;text-align:right;font-size:12px;color:#344054;font-variant-numeric:tabular-nums}",
      ".sai-icon-row{display:flex;justify-content:space-between;margin-top:10px;padding:12px 14px;border-radius:10px;background:linear-gradient(180deg,var(--sai-sb-bg),var(--sai-sb-bg2));color:var(--sai-sb-text)}",
      ".sai-icon-row .sai-ico{width:20px;height:20px}",
      ".sai-tb details{margin-top:12px}",
      ".sai-tb summary{cursor:pointer;font-size:12.5px;color:#1D2939;font-weight:650;border-radius:6px}",
      ".sai-ov{display:grid;grid-template-columns:1fr 168px;gap:6px 10px;align-items:center;margin-top:10px}",
      ".sai-ov span{font-size:12.5px;color:#344054;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".sai-ov input{width:100%;height:30px!important;font-size:12px!important}",
      ".sai-hint{font-size:12px;color:#1D2939;margin:6px 0 0}",
      ".sai-logo-drop{position:relative;min-height:96px;margin-top:2px;padding:12px;border:1.5px dashed #D0D5DD;border-radius:12px;background:#F9FAFB;display:flex;align-items:center;justify-content:center;text-align:center;cursor:pointer}",
      ".sai-logo-drop.sai-drag{border-color:#1B2230;background:#F2F4F7}",
      ".sai-logo-preview{max-width:100%;max-height:72px;object-fit:contain}",
      ".sai-logo-empty{margin:0;font-size:12.5px;color:#344054;line-height:1.4}",
      ".sai-logo-file{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}",
      ".sai-logo-actions{margin-top:8px}",
      ".sai-check{display:flex;align-items:flex-start;gap:8px;margin-top:10px;font-size:12.5px;color:#344054;line-height:1.4;cursor:pointer}",
      ".sai-check input{margin:2px 0 0;accent-color:#1B2230}",
      ".sai-tb-foot{border-top:1px solid #EEF0F3;padding:12px 20px 16px}",
      ".sai-tb-status{min-height:18px;margin:0 0 10px;font-size:12.5px;color:#344054}",
      ".sai-tb-status[data-tone='ok']{color:#067647}",
      ".sai-tb-status[data-tone='err']{color:#B42318}",
      ".sai-tb-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}",
      ".sai-btn{flex:0 0 auto;height:36px;padding:0 12px;border-radius:9px;border:1px solid #E6E8EC;background:#fff;color:#1B2230;font-size:13px;font-weight:550;white-space:nowrap;overflow:visible;text-overflow:clip;max-width:none;min-width:max-content;cursor:pointer;transition:background-color .2s,border-color .2s,opacity .2s}",
      ".sai-btn:hover{background:#F9FAFB}",
      ".sai-btn:disabled{opacity:.45;cursor:default}",
      ".sai-btn-primary{flex:1 0 100%;margin-left:0;background:#1B2230;border-color:#1B2230;color:#fff;text-align:center}",
      ".sai-btn-primary:hover{background:#2B3445}",

      "@media (prefers-reduced-motion: reduce){html.sai-motion,html.sai-motion *,.sai-tb,.sai-glider{transition-duration:.01ms!important;animation-duration:.01ms!important}}",
      CFG.extraCss || ""
    ].join("\n");
  }
  function injectCss() {
    var s = document.getElementById("sai-theme-css");
    if (!s) { s = document.createElement("style"); s.id = "sai-theme-css"; document.head.appendChild(s); }
    s.textContent = buildCss();
  }
  function loadFont(f) {
    var href = "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(f).replace(/%20/g, "+") + ":wght@400;500;600;700&display=swap";
    var l = document.getElementById("sai-font-link");
    if (!l) { l = document.createElement("link"); l.id = "sai-font-link"; l.rel = "stylesheet"; document.head.appendChild(l); }
    if (l.getAttribute("href") !== href) l.setAttribute("href", href);
  }

  /* ---------------- Apply / remove ---------------- */
  function apply(t) {
    state.theme = t;
    var r = document.documentElement;
    if (IS_SWITCHYARD) {
      r.classList.remove("sai-switchyard-off");
      var sw = {panel:t.sidebarBg,"panel-end":t.sidebarBgEnd,rail:t.railColor,text:t.sidebarText,gold:t.iconColor,blue:t.accent,hover:t.hoverColor,white:t.accentText,header:t.headerBg,raised:t.inputColor,muted:t.mutedText,ring:t.outlineColor};
      Object.keys(sw).forEach(function(k){if(HEX.test(sw[k]))r.style.setProperty("--ss-sw-"+k,sw[k]);});
    }
    Object.keys(VARS).forEach(function (k) { r.style.setProperty(VARS[k], t[k]); });
    r.style.setProperty("--sai-radius", t.radius + "px");
    var ink = inkFor(t);
    r.style.setProperty("--sai-ink", ink);
    r.style.setProperty("--sai-ico-fg", t.sidebarText);
    r.style.setProperty("--sai-ink-text", t.accentText);
    r.style.setProperty("--sai-glide", t.accent);
    r.classList.toggle("sai-app", t.appAccent !== false);
    r.style.setProperty("--sai-font", '"' + t.font + '", ui-sans-serif, system-ui, sans-serif');
    scanStamp++;
    r.classList.toggle("sai-on", !CFG.brandingVersion || CFG.brandingVersion === "v3" || t.customSurface === true);
    r.classList.toggle("sai-font-app", t.fontScope === "app");
    r.classList.toggle("sai-font-sidebar", t.fontScope === "sidebar");
    r.classList.toggle("sai-icons", t.iconPack !== "default" || Object.keys(t.icons || {}).length > 0);
    if (t.fontScope !== "none") loadFont(t.font);
    decorate();
  }
  function off() {
    state.theme = null;
    if (IS_SWITCHYARD) {
      document.documentElement.classList.add("sai-switchyard-off");
      ["panel","panel-end","rail","text","gold","blue","hover","white","header","raised","muted","ring"].forEach(function(k){document.documentElement.style.removeProperty("--ss-sw-"+k);});
    }
    document.documentElement.classList.remove("sai-on", "sai-font-app", "sai-font-sidebar", "sai-icons", "sai-app");
    document.documentElement.style.removeProperty("--sai-glide");
    document.querySelectorAll(".sai-ico[data-sai-nav]").forEach(function (e) { e.remove(); });
    document.querySelectorAll("[data-sai-icon]").forEach(function (e) { e.removeAttribute("data-sai-icon"); });
    document.querySelectorAll("[data-sai-native]").forEach(function (e) {
      e.classList.remove("sai-hide");
      e.style.removeProperty("display");
      e.removeAttribute("data-sai-native");
    });
    document.querySelectorAll(".sai-hide").forEach(function (e) { e.classList.remove("sai-hide"); e.style.removeProperty("display"); });
    document.querySelectorAll("[data-sai-pad]").forEach(function (e) { e.style.paddingBottom = e.getAttribute("data-sai-pad"); e.removeAttribute("data-sai-pad"); });
    document.querySelectorAll(".sai-unwhite,.sai-overlay,.sai-text,.sai-solid").forEach(function (e) { e.classList.remove("sai-unwhite", "sai-field", "sai-overlay", "sai-text", "sai-solid"); e.style.removeProperty("--sai-mix"); });
    scanStamp++;
    document.querySelectorAll("img.sai-logo-slot").forEach(function (e) { e.remove(); });
    document.querySelectorAll("img[data-sai-orig], img.sai-logo-hidden").forEach(releaseLogoNode);
    decorate();
  }

  /* ---------------- Sidebar decoration ---------------- */
  function sidebar() {
    var list = document.querySelectorAll(SB);
    var best = null, bestArea = -1, fallback = null;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if (el.closest && el.closest(".media-library, .media-card, [class*='asset-card']")) continue;
      if (el.querySelector(".media-library, .media-card, [class*='asset-card']")) continue;
      if (!fallback) fallback = el;
      var r = el.getBoundingClientRect();
      var area = r.width * r.height;
      if (r.width >= 8 && r.height >= 8 && area > bestArea) { best = el; bestArea = area; }
    }
    return best || fallback;
  }
  function navLinks() {
    var sb = sidebar();
    if (!sb) return [];
    return Array.prototype.slice.call(sb.querySelectorAll(NAV_LINKS)).filter(function (a) {
      if (!sb.contains(a)) return false;
      if (a.closest(SWITCHER) || a.closest(".sai-tb-trigger")) return false;
      if (a.closest(".media-library, .media-card, [class*='media-storage'], [class*='asset-card']")) return false;
      return true;
    });
  }
  function rawLabel(a) {
    var el = a.querySelector(".nav-title") || a;
    return (el.textContent || "").replace(/(^|\s)(new|beta|nouveau|nuevo)(?=\s|$)/gi, " ").replace(/\s+/g, " ").trim();
  }
  function keyFor(a) {
    var lab = rawLabel(a).toLowerCase(), id = (a.id || "").toLowerCase().replace(/^sb_/, "").replace(/[-_]+/g, " ");
    var extra = CFG.extraLabels || {}, rawId = (a.id || "").toLowerCase().replace(/^sb_/, "");
    if (extra[lab]) return extra[lab];
    if (ID_KEYS[rawId]) return ID_KEYS[rawId];
    for (var i = 0; i < LABELS.length; i++) if (LABELS[i][0].test(lab)) return LABELS[i][1];
    for (var j = 0; j < LABELS.length; j++) if (id && LABELS[j][0].test(id)) return LABELS[j][1];
    return "custom:" + (lab.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item");
  }
  function packUrl(pack, name) { return ICON_BASE + "/" + pack.prefix + "/" + name + (pack.suffix || "") + ".svg"; }
  function refUrl(ref, t) {
    if (safeUrl(ref)) return ref;
    var p = ref.split(":");
    if (p.length === 2) return ICON_BASE + "/" + p[0] + "/" + p[1] + ".svg";
    return packUrl(PACKS[t.iconPack] || PACKS.lucide, ref);
  }
  // Keystone only. The shared packs still map Launchpad to a rocket.
  // Keep the ids in sync with keystoneLaunchpadIcon in brandingTheme.ts.
  function keystoneAgency() {
    var company = String((CFG.user && CFG.user.companyId) || "").trim().toLowerCase();
    if (company === "lwqohtpjyvzd7t9led1u") return true;
    var key = String(CFG.agencyKey || "").trim().toLowerCase().replace(/^agency-/, "");
    return key === "keystone" || key === "keystone-2" || key === "keystone-3"
      || key === "lwqohtpjyvzd7t9led1u" || key === "lwqohtpjyvzd7t9led1u-2" || key === "lwqohtpjyvzd7t9led1u-3";
  }
  function iconUrl(t, k) {
    var ov = t.icons && t.icons[k];
    if (!ov && k === "launchpad" && keystoneAgency()) ov = "lucide:zap";
    if (ov) return refUrl(ov, t);
    var pack = PACKS[t.iconPack];
    if (!pack || !pack.map[k]) return null;
    return packUrl(pack, pack.map[k]);
  }
  function packRef(t, k) {
    var pack = PACKS[t.iconPack];
    return pack && pack.map[k] ? pack.prefix + ":" + pack.map[k] + (pack.suffix || "") : "";
  }

  function iconHost(a) {
    var p = a.parentElement;
    if (!p || p === sidebar()) return a;
    var tag = p.tagName;
    if (tag === "NAV" || tag === "UL" || tag === "OL") return a;
    if (p.closest && (p.closest(".sai-tb-trigger") || p.closest(".sai-tb"))) return a;
    var links = p.querySelectorAll("a");
    if (links.length === 1 && links[0] === a) return p;
    return a;
  }
  function isIconNode(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.classList.contains("sai-ico") || (n.closest && n.closest(".sai-ico, .sai-logo-slot, .sai-tb-trigger, .nav-title"))) return false;
    if (n.classList && n.classList.contains("nav-title")) return false;
    var tag = String(n.tagName || "").toUpperCase();
    if (tag === "PATH" || tag === "USE" || tag === "G" || tag === "DEFS" || tag === "CLIPPATH" || tag === "A" || tag === "NAV" || tag === "UL" || tag === "LI") return false;
    var structural = tag === "IMG" || tag === "SVG" || tag === "I";
    var cls = typeof n.className === "string" ? n.className : "";
    var named = /(?:^|[\s_])(?:[\w-]*icon[\w-]*)(?:$|[\s_])/i.test(cls) || n.hasAttribute("data-icon");
    var cs = getComputedStyle(n);
    var mask = String(cs.webkitMaskImage || cs.maskImage || "");
    var bg = String(cs.backgroundImage || "");
    var masked = !!(mask && mask !== "none");
    var painted = !!(bg && bg !== "none");
    if (!structural && !named && !masked && !painted) return false;
    var r = n.getBoundingClientRect();
    if (r.width <= 64 && r.height <= 64) return true;
    if (!structural) return false;
    // An SVG with no author size defaults to about 300 by 150. It is still the
    // nav glyph when it is the media inside the link.
    var link = n.closest && n.closest("a");
    return !!(link && r.height <= 180 && r.width <= 320 && link.querySelectorAll("svg, img, i").length <= 4);
  }
  function nativeIcons(a) {
    var host = iconHost(a);
    var all = host.querySelectorAll("img, svg, i, span, div");
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (isIconNode(all[i])) out.push(all[i]);
    }
    return out;
  }
  function replacementIcons(a) {
    return Array.prototype.slice.call(iconHost(a).querySelectorAll(".sai-ico")).filter(function (n) {
      return !n.closest(".sai-tb-trigger");
    });
  }
  function hideNative(n) {
    n.setAttribute("data-sai-native", "1");
    n.classList.add("sai-hide");
    n.style.setProperty("display", "none", "important");
    n.style.setProperty("visibility", "hidden", "important");
    n.style.setProperty("-webkit-mask-image", "none", "important");
    n.style.setProperty("mask-image", "none", "important");
    n.style.setProperty("background-image", "none", "important");
  }
  function showNative(n) {
    n.classList.remove("sai-hide");
    ["display", "visibility", "-webkit-mask-image", "mask-image", "background-image"].forEach(function (p) { n.style.removeProperty(p); });
    n.removeAttribute("data-sai-native");
  }
  function paintReplacement(ico, url) {
    ico.classList.add("sai-ico");
    if (ico.getAttribute("data-sai-nav") !== "1") ico.setAttribute("data-sai-nav", "1");
    if (!ico.getAttribute("aria-hidden")) ico.setAttribute("aria-hidden", "true");
    if (url && ico.getAttribute("data-src") !== url) {
      ico.style.setProperty("--sai-ico", 'url("' + url + '")');
      ico.setAttribute("data-src", url);
    }
  }
  function glyphKind(a) {
    var svgs = a.querySelectorAll("svg");
    if (svgs.length) return "";
    var imgs = a.querySelectorAll("img");
    var realImgs = 0;
    for (var i = 0; i < imgs.length; i++) {
      if (!imgs[i].classList.contains("sai-logo-slot") && !imgs[i].classList.contains("sai-logo-hidden")) realImgs++;
    }
    if (realImgs === 1) return "image";
    if (realImgs) return "";
    var extra = "";
    for (var n = a.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) extra += n.nodeValue || "";
      else if (n.nodeType === 1 && !n.classList.contains("nav-title") && !n.classList.contains("hl_nav-title") && !n.classList.contains("sai-ico")) extra += n.textContent || "";
    }
    extra = extra.replace(/\s+/g, "");
    if (extra && extra.length <= 8 && /\p{Extended_Pictographic}/u.test(extra)) return "emoji";
    return "";
  }
  // Keystone's native Launchpad glyph is smaller than the rest of its menu.
  // Match a visible neighboring glyph, not the native Launchpad dimensions.
  function matchKeystoneZapSize(a, ico, url) {
    if (!keystoneAgency() || keyFor(a) !== "launchpad" || !/\/lucide\/zap\.svg(?:\?|$)/.test(url || "")) {
      if (ico.hasAttribute("data-sai-peer-size")) {
        ico.style.removeProperty("width");
        ico.style.removeProperty("height");
        ico.removeAttribute("data-sai-peer-size");
      }
      return;
    }
    var links = navLinks(), size = 24;
    for (var i = 0; i < links.length; i++) {
      var peer = links[i];
      if (peer === a || inSettingsSidebar(peer) || !peer.getClientRects().length) continue;
      var nodes = replacementIcons(peer).concat(nativeIcons(peer));
      for (var j = 0; j < nodes.length; j++) {
        var cs = getComputedStyle(nodes[j]);
        var w = parseFloat(cs.width), h = parseFloat(cs.height);
        if (cs.display !== "none" && cs.visibility !== "hidden" && w >= 12 && w <= 32 && h >= 12 && h <= 32) {
          size = Math.max(w, h);
          i = links.length;
          break;
        }
      }
    }
    ico.setAttribute("data-sai-peer-size", "1");
    if (ico.style.width !== size + "px" || ico.style.getPropertyPriority("width") !== "important") ico.style.setProperty("width", size + "px", "important");
    if (ico.style.height !== size + "px" || ico.style.getPropertyPriority("height") !== "important") ico.style.setProperty("height", size + "px", "important");
  }
  // Settings replaces the main menu in the same sidebar, and several rows
  // (Billing, Calendars, Opportunities) share main-menu ids and labels.
  // Skip by route and container only. Never decide from the row label.
  var SETTINGS_SIDEBAR_SEL = "[data-settings-nav], .hl_settings-nav, .hl-settings-sidebar, .hl_settings--sidebar, .hl_settings--nav, .hl_settings-sidebar";
  function settingsRoute() {
    var text = String(location.pathname || "") + String(location.search || "") + String(location.hash || "");
    return /\/settings(?:\/|$|\?|#)/i.test(text);
  }
  function settingsSidebarRoots() {
    var roots = [], seen = [];
    function add(el) {
      if (!el || seen.indexOf(el) !== -1) return;
      seen.push(el);
      roots.push(el);
    }
    var known = document.querySelectorAll(SETTINGS_SIDEBAR_SEL);
    for (var i = 0; i < known.length; i++) add(known[i]);
    // The main menu keeps one Settings shortcut in .hl_nav-settings. The
    // settings sidebar reuses that class for the whole menu, so more than
    // one link means this is the settings container.
    var groups = document.querySelectorAll(".hl_nav-settings");
    for (var g = 0; g < groups.length; g++) {
      if (groups[g].querySelectorAll("a").length > 1) add(groups[g]);
    }
    if (settingsRoute()) add(sidebar());
    return roots;
  }
  function inSettingsSidebar(el) {
    if (!el) return false;
    var roots = settingsSidebarRoots();
    for (var i = 0; i < roots.length; i++) if (roots[i].contains(el)) return true;
    return false;
  }
  function releaseInjectedIcons(root) {
    if (!root) return;
    var icons = root.querySelectorAll(".sai-ico[data-sai-nav]");
    for (var i = 0; i < icons.length; i++) {
      if (icons[i].closest(".sai-tb-trigger") || icons[i].closest(".sai-tb")) continue;
      icons[i].remove();
    }
    var marked = root.querySelectorAll("[data-sai-icon]");
    for (var m = 0; m < marked.length; m++) marked[m].removeAttribute("data-sai-icon");
    var natives = root.querySelectorAll("[data-sai-native]");
    for (var n = 0; n < natives.length; n++) showNative(natives[n]);
  }
  function releaseSettingsIcons() {
    var roots = settingsSidebarRoots();
    for (var i = 0; i < roots.length; i++) releaseInjectedIcons(roots[i]);
  }
  function decorateIcons(t) {
    releaseSettingsIcons();
    if (settingsRoute()) return;
    var collapsed = collapsedNow(sidebar());
    navLinks().forEach(function (a) {
      if (inSettingsSidebar(a)) return;
      var url = iconUrl(t, keyFor(a));
      var icons = replacementIcons(a);
      var natives = nativeIcons(a);
      if (!url && collapsed && glyphKind(a)) url = ICON_BASE + "/lucide/arrow-up-right.svg";
      if (!url) {
        icons.forEach(function (ico) { ico.remove(); });
        natives.forEach(showNative);
        a.removeAttribute("data-sai-icon");
        return;
      }
      var ico = icons[0];
      for (var i = 1; i < icons.length; i++) icons[i].remove();
      if (!ico) {
        var orig = natives[0];
        a.setAttribute("data-sai-icon", "1");
        ico = document.createElement("span");
        ico.className = "sai-ico";
        ico.setAttribute("data-sai-nav", "1");
        ico.setAttribute("aria-hidden", "true");
        if (orig) {
          var cs = getComputedStyle(orig), w = orig.getBoundingClientRect().width;
          ico.style.marginLeft = cs.marginLeft;
          ico.style.marginRight = cs.marginRight;
          if (w >= 12 && w <= 28) { ico.style.width = w + "px"; ico.style.height = w + "px"; }
          orig.parentNode.insertBefore(ico, orig);
        } else {
          var title = a.querySelector(".nav-title, .hl_nav-title");
          if (title) title.parentNode.insertBefore(ico, title);
          else a.insertBefore(ico, a.firstChild);
        }
      }
      a.setAttribute("data-sai-icon", "1");
      natives.forEach(hideNative);
      paintReplacement(ico, url);
      matchKeystoneZapSize(a, ico, url);
    });
  }
  // The older runtime already inserted its icon. Keep that one icon, hide every
  // original glyph, and do not insert a second replacement.
  function normalizeIcons() {
    releaseSettingsIcons();
    if (settingsRoute()) return;
    navLinks().forEach(function (a) {
      if (inSettingsSidebar(a)) return;
      var icons = replacementIcons(a);
      if (!icons.length) return;
      var ico = icons[0];
      for (var i = 1; i < icons.length; i++) icons[i].remove();
      a.setAttribute("data-sai-icon", "1");
      paintReplacement(ico, ico.getAttribute("data-src") || "");
      nativeIcons(a).forEach(hideNative);
      matchKeystoneZapSize(a, ico, ico.getAttribute("data-src") || "");
    });
  }
  function reuseInjected() {
    var sb = sidebar();
    var triggers = document.querySelectorAll(".sai-tb-trigger");
    var keep = null;
    for (var i = 0; i < triggers.length; i++) {
      var node = triggers[i];
      var inHeader = node.classList.contains("sai-tb-header") || (node.closest && node.closest(".hl_header, .topmenu-nav"));
      if (inHeader) { keep = node; break; }
    }
    if (!keep && sb) {
      for (var j = 0; j < triggers.length; j++) {
        if (sb.contains(triggers[j])) { keep = triggers[j]; break; }
      }
    }
    for (var k = 0; k < triggers.length; k++) if (triggers[k] !== keep) triggers[k].remove();
    var gliders = document.querySelectorAll(".sai-glider");
    for (var g = 0; g < gliders.length; g++) {
      var glider = gliders[g];
      var nav = glider.parentElement;
      if (!nav || (sb && !sb.contains(nav))) { glider.remove(); continue; }
      if (nav.__saiGlider && nav.__saiGlider !== glider) glider.remove();
      else if (!nav.__saiGlider) nav.__saiGlider = glider;
    }
    var extras = document.querySelectorAll(".sai-ico[data-sai-nav]");
    for (var n = 0; n < extras.length; n++) {
      var ico = extras[n];
      if (ico.closest(".sai-tb-trigger") || ico.closest(".sai-tb")) continue;
      var link = ico.closest("a");
      if (!link && ico.parentElement && ico.parentElement.querySelector("a")) link = ico.parentElement.querySelector("a");
      if (!link || (sb && !sb.contains(link))) { ico.remove(); continue; }
      var host = iconHost(link);
      if (host.querySelector(".sai-ico[data-sai-nav], .sai-ico") !== ico) ico.remove();
    }
    if (!sb) return;
    var seen = [];
    var slots = sb.querySelectorAll("img.sai-logo-slot");
    for (var s = 0; s < slots.length; s++) {
      var parent = slots[s].parentNode;
      if (seen.indexOf(parent) !== -1) slots[s].remove();
      else seen.push(parent);
    }
  }

  function nativeLogoImgs(sb) {
    if (!sb) return [];
    var sels = [".agency-logo-container img", "img.agency-logo", "img[alt*='logo' i]"];
    var out = [];
    for (var i = 0; i < sels.length; i++) {
      var list = sb.querySelectorAll(sels[i]);
      for (var c = 0; c < list.length; c++) {
        var img = list[c];
        if (img.classList.contains("sai-logo-slot")) continue;
        if (img.closest("nav") || img.closest(SWITCHER) || img.closest(".sai-tb")) continue;
        if (out.indexOf(img) === -1) out.push(img);
      }
    }
    return out;
  }
  function findLogo() {
    var sb = sidebar();
    var imgs = nativeLogoImgs(sb);
    for (var i = 0; i < imgs.length; i++) {
      var r = imgs[i].getBoundingClientRect();
      if (r.width >= 8 && r.height >= 8) return imgs[i];
    }
    if (imgs[0]) return imgs[0];
    if (!sb) return null;
    var all = sb.querySelectorAll("img");
    for (var j = 0; j < all.length; j++) {
      if (all[j].classList.contains("sai-logo-slot")) continue;
      if (all[j].closest("nav") || all[j].closest(SWITCHER)) continue;
      if (all[j].classList.contains("sai-logo-hidden") || all[j].getBoundingClientRect().width >= 60) return all[j];
    }
    return null;
  }
  function clearLogoHide(img) {
    if (!img) return;
    img.classList.remove("sai-logo", "sai-logo-hidden");
    img.removeAttribute("data-sai-logo-hide");
    ["position", "width", "height", "margin", "opacity", "pointer-events", "overflow"].forEach(function (p) { img.style.removeProperty(p); });
  }
  function releaseLogoNode(img) {
    if (!img) return;
    var orig = img.getAttribute("data-sai-orig") || img.getAttribute("data-sai-full");
    if (orig && img.getAttribute("src") !== orig) img.setAttribute("src", orig);
    img.removeAttribute("data-sai-orig");
    img.removeAttribute("data-sai-full");
    img.removeAttribute("data-sai-full-ratio");
    img.removeAttribute("data-sai-mark");
    clearLogoHide(img);
  }
  function hideNativeLogo(img) {
    img.classList.add("sai-logo-hidden");
    img.setAttribute("data-sai-logo-hide", "1");
    img.style.setProperty("position", "absolute", "important");
    img.style.setProperty("width", "1px", "important");
    img.style.setProperty("height", "1px", "important");
    img.style.setProperty("margin", "0", "important");
    img.style.setProperty("opacity", "0", "important");
    img.style.setProperty("pointer-events", "none", "important");
    img.style.setProperty("overflow", "hidden", "important");
  }
  function logoCap(t) {
    var n = (t && t.logoHeight) || 40;
    return Math.max(20, Math.min(40, n));
  }
  function absHttps(value) {
    var raw = String(value || "").trim();
    if (!raw || raw.indexOf("data:") === 0) return "";
    try {
      var url = new URL(raw, location.href);
      if (url.protocol !== "https:") return "";
      return url.href;
    } catch (e) { return ""; }
  }
  function imageRatio(img) {
    var w = img.naturalWidth || Number(img.getAttribute("width")) || 0;
    var h = img.naturalHeight || Number(img.getAttribute("height")) || 0;
    if (w > 0 && h > 0) return w / h;
    return 0;
  }
  function collapsedSquareMark(wideUrl) {
    var wide = absHttps(wideUrl);
    var sb = sidebar();
    var native = sb && sb.querySelector("img.agency-logo, img.sai-logo-hidden");
    if (native && !native.classList.contains("sai-logo-slot")) {
      var src = absHttps(native.getAttribute("data-sai-full") || native.getAttribute("src"));
      var ratio = Number(native.getAttribute("data-sai-full-ratio")) || imageRatio(native);
      if (src && src !== wide && ratio > 0 && ratio < 1.6) return src;
    }
    var links = document.querySelectorAll('link[rel="apple-touch-icon"], link[rel="icon"], link[rel="shortcut icon"]');
    for (var i = 0; i < links.length; i++) {
      var href = absHttps(links[i].getAttribute("href") || links[i].href);
      if (href && href !== wide) return href;
    }
    return "";
  }
  var fittingLogos = false;
  function fitLogos(t) {
    if (fittingLogos) return;
    fittingLogos = true;
    try {
      var cap = logoCap(t);
      document.documentElement.style.setProperty("--sai-logo-h", cap + "px");
      var sb = sidebar();
      if (!sb) return;
      var collapsed = collapsedNow(sb);
      var rail = sb.getBoundingClientRect().width || 72;
      var inner = Math.max(28, Math.round(rail - 16));
      var nodes = sb.querySelectorAll("img.sai-logo-slot, img.agency-logo, .agency-logo-container img");
      for (var i = 0; i < nodes.length; i++) {
        var img = nodes[i];
        if (img.classList.contains("sai-logo-hidden")) continue;
        if (img.getAttribute("data-sai-fit") !== "1") {
          img.setAttribute("data-sai-fit", "1");
          img.addEventListener("load", function () { if (state.theme) fitLogos(state.theme); });
        }
        img.style.setProperty("display", "block", "important");
        img.style.setProperty("box-sizing", "border-box", "important");
        img.style.setProperty("flex", "0 0 auto", "important");
        img.style.setProperty("align-self", "center", "important");
        img.style.setProperty("width", "auto", "important");
        img.style.setProperty("height", "auto", "important");
        img.style.setProperty("margin", "0 auto", "important");
        img.style.setProperty("object-fit", "contain", "important");
        img.style.setProperty("object-position", "center", "important");
        img.style.setProperty("transform", "none", "important");
        if (collapsed) {
          var current = absHttps(img.getAttribute("src"));
          var storedFull = absHttps(img.getAttribute("data-sai-full"));
          var storedMark = absHttps(img.getAttribute("data-sai-mark"));
          var full = storedFull && (current === storedFull || (storedMark && current === storedMark)) ? storedFull : current;
          if (full !== storedFull) {
            img.removeAttribute("data-sai-full-ratio");
            if (full) img.setAttribute("data-sai-full", full);
            else img.removeAttribute("data-sai-full");
          }
          var ratio = Number(img.getAttribute("data-sai-full-ratio"));
          if (!(ratio > 0) && full && full === current) {
            ratio = imageRatio(img);
            if (ratio > 0) img.setAttribute("data-sai-full-ratio", String(Math.round(ratio * 1000) / 1000));
          }
          var mark = ratio >= 1.8 ? collapsedSquareMark(full) : "";
          var show = mark || full;
          if (show && current !== show) img.setAttribute("src", show);
          if (mark) img.setAttribute("data-sai-mark", mark);
          else img.removeAttribute("data-sai-mark");
          img.style.setProperty("max-width", (mark ? Math.min(32, inner) : inner) + "px", "important");
          img.style.setProperty("max-height", "32px", "important");
        } else {
          var restore = img.getAttribute("data-sai-full");
          if (restore && img.getAttribute("src") !== restore) img.setAttribute("src", restore);
          img.removeAttribute("data-sai-full");
          img.removeAttribute("data-sai-full-ratio");
          img.removeAttribute("data-sai-mark");
          img.style.setProperty("max-width", "100%", "important");
          img.style.setProperty("max-height", cap + "px", "important");
        }
      }
      var headerImgs = document.querySelectorAll(".hl_header img.agency-logo, .hl_header img.company-logo, .hl_header .agency-logo-container img, .hl_header .hl_header--logo img, .hl_header .hl-header-logo img");
      for (var h = 0; h < headerImgs.length; h++) {
        var headerImg = headerImgs[h];
        headerImg.style.setProperty("display", "block", "important");
        headerImg.style.setProperty("box-sizing", "border-box", "important");
        headerImg.style.setProperty("width", "auto", "important");
        headerImg.style.setProperty("height", "auto", "important");
        headerImg.style.setProperty("max-width", "100%", "important");
        headerImg.style.setProperty("max-height", cap + "px", "important");
        headerImg.style.setProperty("object-fit", "contain", "important");
        headerImg.style.setProperty("object-position", "left center", "important");
        headerImg.style.setProperty("transform", "none", "important");
      }
      var headerBoxes = document.querySelectorAll(".hl_header .agency-logo-container, .hl_header .hl_header--logo, .hl_header .hl-header-logo");
      for (var hb = 0; hb < headerBoxes.length; hb++) {
        var headerBox = headerBoxes[hb];
        headerBox.style.setProperty("display", "flex", "important");
        headerBox.style.setProperty("align-items", "center", "important");
        headerBox.style.setProperty("box-sizing", "border-box", "important");
        headerBox.style.setProperty("max-width", "min(220px, 42vw)", "important");
        headerBox.style.setProperty("max-height", "48px", "important");
        headerBox.style.setProperty("overflow", "hidden", "important");
      }
      var boxes = sb.querySelectorAll(".agency-logo-container");
      var boxH = cap + 20;
      for (var b = 0; b < boxes.length; b++) {
        var box = boxes[b];
        box.style.setProperty("display", "flex", "important");
        box.style.setProperty("align-items", "center", "important");
        box.style.setProperty("justify-content", "center", "important");
        box.style.setProperty("flex", "0 0 auto", "important");
        box.style.setProperty("align-self", "stretch", "important");
        box.style.setProperty("box-sizing", "border-box", "important");
        box.style.setProperty("width", "100%", "important");
        box.style.setProperty("min-height", (collapsed ? 36 : boxH) + "px", "important");
        box.style.setProperty("max-height", (collapsed ? 40 : boxH) + "px", "important");
        box.style.setProperty("margin", "0", "important");
        box.style.setProperty("padding", collapsed ? "4px" : "8px 12px 12px", "important");
        box.style.setProperty("overflow", "hidden", "important");
      }
      var slots = sb.querySelectorAll("img.sai-logo-slot[src]");
      if (slots.length) nativeLogoImgs(sb).forEach(hideNativeLogo);
    } finally {
      fittingLogos = false;
    }
  }
  function decorateLogo(t) {
    var sb = sidebar();
    var imgs = nativeLogoImgs(sb);
    var img = findLogo();
    var url = t && safeUrl(t.logoUrl) ? t.logoUrl : "";
    if (img && img.parentNode) {
      if (!url) {
        imgs.forEach(releaseLogoNode);
        if (sb) sb.querySelectorAll("img.sai-logo-slot").forEach(function (slot) { slot.remove(); });
      } else {
        imgs.forEach(function (node) { releaseLogoNode(node); hideNativeLogo(node); });
        var host = img.parentNode;
        var slot = host.querySelector(":scope > img.sai-logo-slot");
        if (!slot) {
          slot = document.createElement("img");
          slot.className = "sai-logo-slot sai-logo";
          slot.alt = "";
        }
        host.insertBefore(slot, img);
        if (slot.getAttribute("src") !== url) slot.setAttribute("src", url);
        slot.style.setProperty("--sai-logo-h", logoCap(t) + "px");
      }
    }
    fitLogos(t);
    if (url) imgs.forEach(hideNativeLogo);
  }

  function setupGliders() {
    var sb = sidebar();
    if (!sb) return;
    sb.querySelectorAll("nav").forEach(function (nav) {
      if (nav.__saiGlider && nav.contains(nav.__saiGlider)) return;
      if (getComputedStyle(nav).position === "static") nav.style.position = "relative";
      var g = document.createElement("div");
      g.className = "sai-glider";
      g.setAttribute("aria-hidden", "true");
      nav.appendChild(g);
      nav.__saiGlider = g;
      if (nav.__saiBound) return;
      nav.__saiBound = true;
      nav.addEventListener("mouseover", function (e) {
        var glider = nav.__saiGlider, a = e.target.closest && e.target.closest("a");
        if (!glider || !a || !nav.contains(a)) return;
        if (a.matches(ACTIVE)) { glider.classList.remove("on"); return; }
        var nr = nav.getBoundingClientRect(), ar = a.getBoundingClientRect();
        var x = ar.left - nr.left + nav.scrollLeft, y = ar.top - nr.top + nav.scrollTop;
        if (!glider.classList.contains("on")) { glider.style.transition = "none"; }
        glider.style.width = ar.width + "px";
        glider.style.height = ar.height + "px";
        glider.style.transform = "translate(" + x + "px," + y + "px)";
        if (glider.style.transition === "none") { void glider.offsetWidth; glider.style.transition = ""; }
        glider.classList.add("on");
      });
      nav.addEventListener("mouseleave", function () { if (nav.__saiGlider) nav.__saiGlider.classList.remove("on"); });
      nav.addEventListener("scroll", function () {
        if (nav.__saiGlider) nav.__saiGlider.classList.remove("on");
        if (state.theme) { scanStamp++; clearTimeout(nav.__saiScanT); nav.__saiScanT = setTimeout(scanSidebar, 120); }
      }, { passive: true });
    });
  }

  function isMin() { try { return localStorage.getItem("sai_tb_min") === "1"; } catch (e) { return false; } }
  function setMin(v) {
    try { if (v) localStorage.setItem("sai_tb_min", "1"); else localStorage.removeItem("sai_tb_min"); } catch (e) { }
    document.documentElement.classList.toggle("sai-tb-min", !!v);
    if (ui) renderMinToggle();
    placeTrigger();
  }
  function controlVisible(el) {
    if (!el || !el.getClientRects || !el.getClientRects().length) return false;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    var r = el.getBoundingClientRect();
    return r.width >= 16 && r.height >= 16 && r.bottom > 0 && r.top < 180;
  }
  function headerPlaceholder(el) {
    var node = el;
    while (node && node !== document.documentElement) {
      var cls = "";
      try { cls = String(node.className || ""); } catch (e) { cls = ""; }
      if (/placeholder|skeleton|shimmer|is-loading|hl-loader|app-loader/i.test(cls)) return true;
      node = node.parentElement;
    }
    return false;
  }
  function realHeaderControls(slot) {
    var kids = slot.children, count = 0;
    for (var i = 0; i < kids.length; i++) {
      var kid = kids[i];
      if (kid.classList && kid.classList.contains("sai-tb-trigger")) continue;
      if (!controlVisible(kid) || headerPlaceholder(kid)) continue;
      if (kid.matches && kid.matches("button, a, img")) { count++; continue; }
      if (kid.querySelector && kid.querySelector("button, a, img, svg")) count++;
    }
    return count;
  }
  function headerSlots() {
    return document.querySelectorAll(".hl_header .hl_header--controls, .topmenu-nav .hl_header--controls, header.hl_header .hl_header--controls");
  }
  function readyHeaderSlot() {
    var groups = headerSlots(), best = null, bestScore = -1;
    for (var n = 0; n < groups.length; n++) {
      var el = groups[n];
      if (!controlVisible(el) || headerPlaceholder(el) || realHeaderControls(el) < 1) continue;
      var rect = el.getBoundingClientRect();
      var score = rect.right * 1000 + rect.left;
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }
  function pendingHeader() {
    if (readyHeaderSlot()) return false;
    var groups = headerSlots();
    for (var i = 0; i < groups.length; i++) {
      if (controlVisible(groups[i]) || headerPlaceholder(groups[i])) return true;
    }
    return false;
  }
  function rectsOverlap(a, b) {
    var x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    var y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return x > 2 && y > 2;
  }
  function buildTrigger() {
    var b = document.createElement("div");
    b.className = "sai-tb-trigger";
    b.setAttribute("data-sai-theme-trigger", "1");
    b.innerHTML =
      '<button type="button" class="sai-tb-open" title="Customize theme" aria-label="Customize theme (Beta)"><span class="sai-ico" style="--sai-ico:url(\'' + ICON_BASE + '/lucide/palette.svg\')"></span><span class="sai-tb-label">Customize theme</span><span class="sai-tb-chip">Beta</span></button>' +
      '<button type="button" class="sai-tb-hide" title="Shrink to icon" aria-label="Shrink to icon"><span class="sai-ico" style="--sai-ico:url(\'' + ICON_BASE + '/lucide/chevrons-left.svg\')"></span></button>';
    b.querySelector(".sai-tb-open").addEventListener("click", openBuilder);
    b.querySelector(".sai-tb-hide").addEventListener("click", function (e) { e.stopPropagation(); setMin(true); });
    return b;
  }
  function clearThemeReserve() {
    var marked = document.querySelectorAll("[data-sai-theme-reserve]");
    for (var i = 0; i < marked.length; i++) {
      var prop = marked[i].getAttribute("data-sai-theme-reserve") || "margin-left";
      marked[i].style.removeProperty(prop);
      marked[i].removeAttribute("data-sai-theme-reserve");
    }
  }
  function reserveSpace(el, prop, px) {
    if (!el) return;
    el.setAttribute("data-sai-theme-reserve", prop);
    el.style.setProperty(prop, Math.ceil(px) + "px", "important");
  }
  function narrowHeader() { return window.innerWidth <= 640; }
  function viewportBox() {
    var width = window.innerWidth || 0;
    var left = 0;
    var vv = window.visualViewport;
    if (vv && vv.width) {
      width = Math.min(width, vv.width);
      if (isFinite(vv.offsetLeft)) left = vv.offsetLeft;
    }
    return { left: left, right: left + width };
  }
  function headerNatives(header) {
    var nodes = header.querySelectorAll("button, a, img, #support-widget-launcher-host");
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.closest && el.closest(".sai-tb-trigger")) continue;
      if (el.id !== "support-widget-launcher-host" && el.closest && el.closest("#support-widget-launcher-host")) continue;
      if (!controlVisible(el)) continue;
      out.push(el);
    }
    return out;
  }
  // The full trigger is only allowed when every native control, including the
  // rightmost account control, stays inside the viewport after its own space
  // is reserved. Otherwise hide it and leave HighLevel's bar untouched.
  function headerHasRoom(header, trigger) {
    var view = viewportBox();
    var natives = headerNatives(header);
    if (!natives.length) return false;
    var tr = trigger.getBoundingClientRect();
    if (tr.width < 8 || tr.left < view.left - 1 || tr.right > view.right + 1) return false;
    var rightmost = -Infinity;
    for (var i = 0; i < natives.length; i++) {
      var r = natives[i].getBoundingClientRect();
      if (r.left < view.left - 1 || r.right > view.right + 1) return false;
      if (rectsOverlap(tr, r)) return false;
      if (r.right > rightmost) rightmost = r.right;
    }
    return rightmost <= view.right + 1;
  }
  function hideHeaderTrigger(b) {
    clearThemeReserve();
    b.classList.add("sai-tb-header");
    b.setAttribute("data-compact", "0");
    b.style.setProperty("display", "none", "important");
    ["left", "top", "right", "bottom", "width", "min-width", "max-width", "height"].forEach(function (p) { b.style.removeProperty(p); });
    b.style.setProperty("position", "fixed", "important");
    b.style.setProperty("margin", "0", "important");
  }
  function placeInHeader(b, slot) {
    var header = (slot.closest && slot.closest(".hl_header, .topmenu-nav, header")) || slot;
    if (getComputedStyle(header).position === "static") header.style.position = "relative";
    clearThemeReserve();
    b.classList.add("sai-tb-header");
    ["margin-top", "margin-right", "margin-bottom", "margin-left", "width", "min-width", "max-width", "align-self", "flex", "height", "right", "bottom", "left", "top"].forEach(function (p) { b.style.removeProperty(p); });
    b.style.setProperty("margin", "0", "important");
    // Fixed to the viewport, anchored on Help's box. A header that still
    // starts at the desktop sidebar offset must not become the origin of left.
    b.style.setProperty("position", "fixed", "important");
    b.style.setProperty("z-index", "30", "important");
    if (b.parentNode !== header) header.appendChild(b);
    var help = document.getElementById("support-widget-launcher-host");
    var anchor = help && slot.contains(help) && controlVisible(help) ? help : null;
    if (!anchor) {
      var kids = slot.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] === b || !controlVisible(kids[i])) continue;
        anchor = kids[i];
        break;
      }
    }
    // At 640 and below the bar is already full. Above that, still hide when
    // reserving the trigger's own width would push a native control off-screen.
    if (!anchor || narrowHeader()) { hideHeaderTrigger(b); return; }
    b.style.removeProperty("display");
    b.setAttribute("data-compact", "0");
    b.style.setProperty("width", "auto", "important");
    b.style.removeProperty("min-width");
    b.style.setProperty("max-width", "240px", "important");
    var refH = anchor.getBoundingClientRect().height;
    if (refH >= 28 && refH <= 44) b.style.setProperty("height", Math.round(refH) + "px", "important");
    else b.style.setProperty("height", "36px", "important");
    var gap = 8;
    var slotStyle = getComputedStyle(slot);
    var slotGap = parseFloat(slotStyle.columnGap || slotStyle.gap);
    if (!isFinite(slotGap)) slotGap = 0;
    var width = b.getBoundingClientRect().width;
    // One gap, the trigger's own width, immediately left of Help. That is the
    // only shift native items are allowed to make, and only on a wide bar.
    reserveSpace(anchor, "margin-left", width + gap + Math.max(0, gap - slotGap));
    var ar = anchor.getBoundingClientRect();
    var br = b.getBoundingClientRect();
    var left = Math.round(ar.left - br.width - gap);
    var top = Math.round(ar.top + (ar.height - br.height) / 2);
    if (left < 0 || top < 0) { hideHeaderTrigger(b); return; }
    b.style.setProperty("left", left + "px", "important");
    b.style.setProperty("top", top + "px", "important");
    if (!headerHasRoom(header, b)) hideHeaderTrigger(b);
  }
  function placeInSidebar(b) {
    var sb = sidebar();
    if (!sb) return;
    clearThemeReserve();
    b.classList.remove("sai-tb-header");
    b.removeAttribute("data-compact");
    b.style.removeProperty("display");
    b.style.removeProperty("position");
    b.style.removeProperty("left");
    b.style.removeProperty("top");
    b.style.removeProperty("right");
    b.style.removeProperty("height");
    b.style.removeProperty("min-width");
    ["margin-top", "margin-right", "margin-bottom", "margin-left", "width", "align-self", "flex", "max-width"].forEach(function (p) { b.style.removeProperty(p); });
    if (!sb.contains(b)) {
      var sw0 = sb.querySelector(SWITCHER), nav = sb.querySelector("nav");
      if (sw0) sw0.insertAdjacentElement("afterend", b);
      else if (nav && nav.parentNode) nav.parentNode.insertBefore(b, nav);
      else sb.insertBefore(b, sb.firstChild);
    }
    if (document.documentElement.classList.contains("sai-sb-collapsed") || document.documentElement.classList.contains("sai-tb-min")) return;
    var sw = sb.querySelector(SWITCHER);
    var left = 10, right = 10;
    if (sw) {
      var sbRect = sb.getBoundingClientRect();
      var swRect = sw.getBoundingClientRect();
      if (swRect.width > 20 && sbRect.width > 0) {
        left = Math.max(0, Math.round(swRect.left - sbRect.left));
        right = Math.max(0, Math.round(sbRect.right - swRect.right));
      }
    }
    b.style.setProperty("margin-top", "8px", "important");
    b.style.setProperty("margin-bottom", "8px", "important");
    b.style.setProperty("margin-left", left + "px", "important");
    b.style.setProperty("margin-right", right + "px", "important");
    b.style.setProperty("width", "auto", "important");
    b.style.setProperty("max-width", "100%", "important");
    b.style.setProperty("align-self", "stretch", "important");
    b.style.setProperty("flex", "0 0 auto", "important");
  }
  function decorateTrigger() {
    var sb = sidebar();
    if (IS_SWITCHYARD) {
      var swTrigger = document.querySelector(".sai-tb-trigger");
      if (!sb || !canEdit() || !allowed(routeKey())) { if(swTrigger)swTrigger.remove(); return; }
      if (!swTrigger) swTrigger = buildTrigger();
      if (!swTrigger.isConnected) sb.appendChild(swTrigger);
      return;
    }
    var slot = readyHeaderSlot();
    var pending = !slot && pendingHeader();
    var ex = document.querySelector(".sai-tb-trigger");
    if ((!sb && !slot && !pending) || !canEdit() || !allowed(routeKey())) { if (ex) ex.remove(); return; }
    if (!ex) {
      ex = buildTrigger();
      if (document.body) document.body.appendChild(ex);
    }
    placeTrigger();
  }
  function placeTrigger() {
    if (IS_SWITCHYARD) return;
    if (placing) return;
    placing = true;
    try { placeTriggerNow(); }
    finally { placing = false; }
  }
  function placeTriggerNow() {
    watchHeader();
    var b = document.querySelector(".sai-tb-trigger");
    if (!b) return;
    var slot = readyHeaderSlot();
    if (slot) { placeInHeader(b, slot); return; }
    if (pendingHeader()) {
      clearThemeReserve();
      if (!b.isConnected && document.body) document.body.appendChild(b);
      b.classList.remove("sai-tb-header");
      b.style.setProperty("display", "none", "important");
      return;
    }
    placeInSidebar(b);
  }

  var roSidebar = null, ro = null;
  function collapsedNow(sb) {
    if (!sb) return false;
    var cls = (sb.className && String(sb.className)) || "";
    if (/(^|\s)(collapsed|sidebar-collapsed|sb-collapsed|hl-collapsed|menu-collapsed)(\s|$)/.test(cls)) return true;
    if (sb.getAttribute("data-collapsed") === "true" || sb.getAttribute("aria-expanded") === "false") return true;
    var w = sb.getBoundingClientRect().width;
    return w > 0 && w < 150;
  }
  function compactSearch(sb, collapsed) {
    var fields = sb.querySelectorAll("input, textarea, kbd, #globalSearchOpener, .sidebar-search, .search-shortcut, .search-placeholder");
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (el.closest(".sai-tb") || el.closest(".sai-tb-trigger") || el.closest(SWITCHER)) continue;
      var wrap = el.closest("[class*='search' i]") || el.closest("[class*='Search']");
      var target = wrap && sb.contains(wrap) && !wrap.querySelector("nav, a[id^='sb_']") ? wrap : el;
      if (target.closest(SWITCHER) || (target.querySelector && target.querySelector(SWITCHER))) target = el;
      if (collapsed) {
        if (target.getAttribute("data-sai-collapsed-hide") !== "1") {
          target.setAttribute("data-sai-collapsed-hide", "1");
          target.style.setProperty("display", "none", "important");
        }
      } else if (target.getAttribute("data-sai-collapsed-hide") === "1") {
        target.style.removeProperty("display");
        target.removeAttribute("data-sai-collapsed-hide");
      }
    }
  }
  function syncCollapsed() {
    var sb = sidebar();
    var h = document.documentElement;
    var was = h.classList.contains("sai-sb-collapsed");
    var now = collapsedNow(sb);
    if (was !== now) {
      h.classList.toggle("sai-sb-collapsed", now);
      if (state.theme) decorateIcons(state.theme);
      if (was && !now && h.classList.contains("sai-motion")) {
        h.classList.add("sai-sb-expanding");
        clearTimeout(h.__saiExp);
        h.__saiExp = setTimeout(function () { h.classList.remove("sai-sb-expanding"); }, 450);
      }
    }
    if (sb) compactSearch(sb, now);
    paintTrigger();
    placeTrigger();
    if (state.theme) fitLogos(state.theme);
  }
  function watchCollapse() {
    syncCollapsed();
    var sb = sidebar();
    if (!sb || !window.ResizeObserver) return;
    if (sb === roSidebar && ro) return;
    if (ro) ro.disconnect();
    roSidebar = sb;
    ro = new ResizeObserver(function () { syncCollapsed(); });
    ro.observe(sb);
  }
  var scanStamp = 0;
  function rgba(str) {
    var m = String(str).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function ownText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  }
  function bgBehind(el, sb) {
    for (var p = el.parentElement, i = 0; p && p !== sb && i < 4; p = p.parentElement, i++) {
      if (p.classList.contains("sai-unwhite") || p.classList.contains("sai-solid")) return false;
      var c = rgba(getComputedStyle(p).backgroundColor);
      if (c && c.a >= 0.5) return true;
    }
    return false;
  }
  function contrastRgb(c, hex) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var x = 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b), y = lum(hex);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function heavyPage() {
    var text = String(location.pathname || "") + String(location.search || "") + String(location.hash || "");
    return /(?:^|\/)(?:media-storage|sites|funnels|settings|contacts|conversations|automation|opportunities|calendars)(?:\/|$|\?|#)/i.test(text);
  }
  var scanTimer = null;
  function scheduleScan() {
    if (scanTimer || quietPage() || heavyPage()) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      if (!quietPage() && !heavyPage()) scanSidebar();
    }, 300);
  }
  function scanSidebar() {
    stats.scans++;
    if (quietPage() || heavyPage()) return;
    var sb = sidebar();
    if (!sb) return;
    sb.querySelectorAll("[data-sai-pad]").forEach(function (e) { e.style.paddingBottom = e.getAttribute("data-sai-pad"); e.removeAttribute("data-sai-pad"); });
    var sbr = sb.getBoundingClientRect();
    if (sbr.width < 10) return;
    var els = sb.querySelectorAll("*");
    if (els.length > 700) return;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.__saiScan === scanStamp) continue;
      el.__saiScan = scanStamp;
      if (el.closest(".sai-overlay")) continue;
      var tag = el.tagName;
      if (tag === "IMG" || tag === "svg" || tag === "path" || tag === "SVG") continue;
      if (el.closest(".sai-tb-trigger") || el.classList.contains("sai-glider") || el.classList.contains("sai-ico") || el.classList.contains("sai-footbg")) continue;
      if (el.closest("a#sb_reporting, a#sb_settings, a#sb_location-settings, a#sb_agency-settings")) continue;
      var r = el.getBoundingClientRect();
      if (r.width > sbr.width + 20) { el.classList.add("sai-overlay"); continue; }
      if (el.closest(NAV_LINKS) || el.matches(SWITCHER)) continue;
      var cs = getComputedStyle(el);
      var pinnedSettings = el.closest && el.closest(".hl_nav-settings");
      if (!pinnedSettings && !el.classList.contains("sai-solid") && /^(sticky|absolute|fixed)$/.test(cs.position) && r.width > sbr.width * 0.5 && r.height > 24) el.classList.add("sai-solid");
      var c = rgba(cs.backgroundColor), opaque = !!(c && c.a >= 0.5);
      if (!el.classList.contains("sai-unwhite") && opaque && (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255 >= 0.78) {
        el.classList.add("sai-unwhite");
        if (/^(BUTTON|INPUT|KBD|TEXTAREA)$/.test(tag) || el.querySelector("input,kbd")) el.classList.add("sai-field");
      }
      if (!opaque && !el.classList.contains("sai-unwhite") && !el.classList.contains("sai-text") && ownText(el) && !bgBehind(el, sb)) {
        var tc = rgba(cs.color);
        if (tc && (contrastRgb(tc, state.theme.sidebarBg) < 2.5 || contrastRgb(tc, state.theme.sidebarBgEnd) < 2.5)) el.classList.add("sai-text");
      }
      if (!el.classList.contains("sai-unwhite") && !el.classList.contains("sai-solid")) continue;
      var mid = r.height ? ((r.top + r.height / 2 - sbr.top) / sbr.height) * 100 : 50;
      el.style.setProperty("--sai-mix", Math.max(0, Math.min(100, Math.round(mid))) + "%");
    }
  }
  var FOOT_LINKS = "a#sb_reporting, a#sb_settings, a#sb_location-settings, a#sb_agency-settings";
  function releasePin(el) {
    if (!el) return;
    el.style.setProperty("position", "relative", "important");
    el.style.setProperty("top", "auto", "important");
    el.style.setProperty("right", "auto", "important");
    el.style.setProperty("bottom", "auto", "important");
    el.style.setProperty("left", "auto", "important");
    el.style.setProperty("margin-top", "0", "important");
    el.style.setProperty("transform", "none", "important");
    el.style.setProperty("z-index", "auto", "important");
  }
  function clearFootPad(root) {
    var marked = root.querySelectorAll("[data-sai-foot-pad]");
    for (var i = 0; i < marked.length; i++) {
      var el = marked[i];
      var prev = el.getAttribute("data-sai-foot-pad") || "";
      if (prev) el.style.setProperty("padding-bottom", prev, "important");
      else el.style.removeProperty("padding-bottom");
      el.removeAttribute("data-sai-foot-pad");
    }
  }
  /* Keep Reporting and Settings in normal flow. HighLevel pins both to the bottom of #sidebar-v2, so they share one row until the pin is cleared. */
  function separatePinnedFooter() {
    if (CFG.brandingVersion === "v3") return;
    var sb = sidebar();
    if (!sb) return;
    var bars = sb.querySelectorAll(".hl_nav-settings");
    for (var b = 0; b < bars.length; b++) releasePin(bars[b]);
    var links = sb.querySelectorAll(FOOT_LINKS);
    for (var i = 0; i < links.length; i++) releasePin(links[i]);
    var settingsMenu = settingsRoute();
    for (var g = 0; g < bars.length && !settingsMenu; g++) {
      if (bars[g].querySelectorAll("a").length > 1 && !bars[g].querySelector("#sb_settings, #sb_location-settings, #sb_agency-settings")) settingsMenu = true;
    }
    /* Settings drops the pinned footer. Padding saved for that row is the blank band under the list. */
    if (settingsMenu) { clearFootPad(sb); return; }
    var sbr = sb.getBoundingClientRect();
    if (sbr.width < 10 || sbr.height < 10) return;
    var reporting = sb.querySelector("a#sb_reporting");
    var settings = sb.querySelector("a#sb_settings, a#sb_location-settings, a#sb_agency-settings");
    if (!reporting || !settings) { clearFootPad(sb); return; }
    var rr = reporting.getBoundingClientRect();
    var sr = settings.getBoundingClientRect();
    var overlap = Math.min(rr.bottom, sr.bottom) - Math.max(rr.top, sr.top);
    var parent = reporting.parentElement;
    if (overlap > 4 && parent && parent !== settings.parentElement) {
      if (!parent.hasAttribute("data-sai-foot-pad")) parent.setAttribute("data-sai-foot-pad", parent.style.paddingBottom || "");
      parent.style.setProperty("padding-bottom", Math.ceil(sr.height) + "px", "important");
      return;
    }
    clearFootPad(sb);
  }
  function quietPage() { return /\/media-storage(?:\/|$)/i.test(location.pathname); }
  function relLum(r, g, b) {
    var f = function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function parseCssColor(str) {
    var hex = String(str || "").match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      var h = hex[1];
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    return rgba(str);
  }
  function opaqueBackground(el) {
    for (var p = el, i = 0; p && i < 6; p = p.parentElement, i++) {
      var cs = getComputedStyle(p);
      var c = parseCssColor(cs.backgroundColor);
      if (c && c.a >= 0.5) return c;
      var stops = String(cs.backgroundImage || "").match(/rgba?\([^)]+\)|#[0-9a-fA-F]{6}/g);
      if (stops && stops.length) {
        var first = parseCssColor(stops[0]);
        if (first && (first.a == null || first.a >= 0.5)) return first;
      }
    }
    return null;
  }
  function ghlDarkMode() {
    var nodes = [document.documentElement, document.body];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n) continue;
      var cls = (n.className && String(n.className)) || "";
      if (/(^|\s)(dark|dark-mode|dark-theme|theme-dark|hl-dark|n-dark)(\s|$)/.test(cls)) return true;
      var attr = String(n.getAttribute("data-theme") || n.getAttribute("data-color-mode") || n.getAttribute("data-mode") || "").toLowerCase();
      if (attr === "dark") return true;
    }
    return false;
  }
  function layerFill(el, pseudo) {
    if (!el || !el.tagName) return null;
    var cs;
    try { cs = pseudo ? getComputedStyle(el, pseudo) : getComputedStyle(el); } catch (e) { return null; }
    if (!pseudo) {
      var tag = el.tagName;
      if (/^(INPUT|TEXTAREA|BUTTON|KBD|A|SVG|IMG|I)$/.test(tag)) return null;
      if (el.closest && el.closest(".sai-tb-trigger, .sai-tb, .hl_nav-settings, .sidebar-search, #globalSearchOpener")) return null;
    } else {
      var content = String(cs.content || "none");
      if (content === "none" || content === "normal") return null;
      if (cs.position !== "absolute" && cs.position !== "fixed") return null;
    }
    var img = String(cs.backgroundImage || "");
    if (img && img !== "none") {
      var stops = img.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{6}/g);
      if (stops && stops.length) {
        var first = parseCssColor(stops[0]);
        if (first && (first.a == null || first.a >= 0.45)) return first;
      }
    }
    var solid = parseCssColor(cs.backgroundColor);
    if (solid && solid.a >= 0.45) return solid;
    return null;
  }
  function backgroundOf(el) { return layerFill(el); }
  // The visible sidebar is the largest fill, not a purple rail or border sampled at the left edge.
  function dominantFill(sb) {
    var own = layerFill(sb) || layerFill(sb, "::before") || layerFill(sb, "::after");
    if (own) return own;
    var best = null, bestArea = 0;
    var box = sb.getBoundingClientRect();
    var kids = sb.children;
    for (var i = 0; i < kids.length && i < 16; i++) {
      var child = kids[i];
      if (child.closest && child.closest(".sai-tb, .sai-tb-trigger")) continue;
      var kr = child.getBoundingClientRect();
      if (box.width && kr.width < box.width * 0.55) continue;
      var fill = layerFill(child) || layerFill(child, "::before");
      var area = kr.width * kr.height;
      if (fill && area > bestArea) { best = fill; bestArea = area; }
    }
    return best;
  }
  function sampleSidebar(sb) {
    var own = dominantFill(sb);
    var target = state.theme && HEX.test(state.theme.sidebarBg) ? parseCssColor(state.theme.sidebarBg) : null;
    if (own && target && document.documentElement.classList.contains("sai-on")) {
      var ownLum = relLum(own.r, own.g, own.b);
      var targetLum = relLum(target.r, target.g, target.b);
      // --sai-sb-bg fades in from its initial navy. A frame in the middle of
      // that fade is not the sidebar the agency picked, so the button uses the
      // chosen color until the paint catches up.
      if (Math.abs(ownLum - targetLum) > 0.08) return target;
    }
    if (own) return own;
    var r = sb.getBoundingClientRect();
    if (r.width >= 8 && r.height >= 8 && document.elementsFromPoint) {
      var x = Math.max(0, Math.min(window.innerWidth - 1, r.left + r.width / 2));
      var y = Math.max(0, Math.min(window.innerHeight - 1, r.top + Math.min(r.height / 2, 160)));
      var stack = document.elementsFromPoint(x, y);
      for (var i = 0; i < stack.length; i++) {
        var el = stack[i];
        if (el !== sb && !sb.contains(el)) break;
        var found = layerFill(el) || layerFill(el, "::before");
        if (found) return found;
      }
    }
    return opaqueBackground(sb);
  }
  function readableInk(c) {
    var lightInk = "#F8FAFC", darkInk = "#111827";
    if (!c) return ghlDarkMode() ? lightInk : darkInk;
    var lightScore = contrastRgb(c, lightInk), darkScore = contrastRgb(c, darkInk);
    var fg = lightScore >= darkScore ? lightInk : darkInk;
    if (Math.max(lightScore, darkScore) >= 4.5) return fg;
    var white = contrastRgb(c, "#FFFFFF"), black = contrastRgb(c, "#000000");
    return white >= black ? "#FFFFFF" : "#000000";
  }
  function fieldFill(c, fg) {
    if (!c) return "#F8FAFC";
    var lum = relLum(c.r, c.g, c.b);
    var toward = lum > 0.45 ? 0 : 255;
    var ch = function (v) { return Math.round(v + (toward - v) * 0.16); };
    var mixed = { r: ch(c.r), g: ch(c.g), b: ch(c.b) };
    var ink = fg || readableInk(c);
    if (contrastRgb(mixed, ink) >= 4.5) return "rgb(" + mixed.r + "," + mixed.g + "," + mixed.b + ")";
    return lum > 0.45 ? "#FFFFFF" : "#111827";
  }
  function paintInk(el, fg) {
    if (!el) return;
    el.style.setProperty("color", fg, "important");
    el.style.setProperty("-webkit-text-fill-color", fg, "important");
  }
  function paintSearch(sb, fg, c) {
    if (!sb) return;
    var field = fieldFill(c, fg);
    var lightInk = fg === "#F8FAFC" || fg === "#FFFFFF";
    document.documentElement.style.setProperty("--sai-search-fg", fg);
    var fields = sb.querySelectorAll("input, textarea, kbd, #globalSearchOpener, .sidebar-search, .search-shortcut, .search-placeholder");
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (el.closest(".sai-tb") || el.closest(".sai-tb-trigger") || el.getAttribute("data-sai-collapsed-hide") === "1") continue;
      paintInk(el, fg);
      el.style.setProperty("background-color", field, "important");
      el.style.setProperty("background-image", "none", "important");
      el.style.setProperty("border-color", lightInk ? "transparent" : field, "important");
      el.style.setProperty("-webkit-text-stroke", "0", "important");
      el.style.setProperty("text-shadow", "none", "important");
      el.style.setProperty("outline", "none", "important");
      el.style.setProperty("box-shadow", "none", "important");
      el.style.setProperty("filter", "none", "important");
      el.style.setProperty("opacity", "1", "important");
      el.style.setProperty("-webkit-mask", "none", "important");
      el.style.setProperty("mask", "none", "important");
    }
  }
  function sampleHeader(btn) {
    var header = (btn.closest && btn.closest(".hl_header, .topmenu-nav, header")) || btn.parentElement;
    var own = header && layerFill(header);
    var target = state.theme && HEX.test(state.theme.headerBg) ? parseCssColor(state.theme.headerBg) : null;
    // --sai-header-bg fades in. A frame in the middle is not the top bar the
    // agency picked, so the button uses the chosen color until the paint settles.
    if (own && target && Math.abs(relLum(own.r, own.g, own.b) - relLum(target.r, target.g, target.b)) > 0.08) return target;
    if (own) return own;
    if (target) return target;
    return { r: 255, g: 255, b: 255, a: 1 };
  }
  function paintTrigger() {
    var btn = document.querySelector(".sai-tb-trigger");
    if (!btn) return;
    var inHeader = btn.classList.contains("sai-tb-header");
    var sb = sidebar();
    if (!inHeader && !sb) return;
    var c = inHeader ? sampleHeader(btn) : sampleSidebar(sb);
    var fg = readableInk(c);
    var visible = inHeader ? c : dominantFill(sb);
    var settled = true;
    if (!inHeader && visible && state.theme && HEX.test(state.theme.sidebarBg) && document.documentElement.classList.contains("sai-on")) {
      var targetFill = parseCssColor(state.theme.sidebarBg);
      if (targetFill && Math.abs(relLum(visible.r, visible.g, visible.b) - relLum(targetFill.r, targetFill.g, targetFill.b)) > 0.08) settled = false;
    }
    // A purple rail can be the sampled color while the sidebar fill is pink.
    // Skip that correction while the theme color is still fading in.
    if (settled && visible && contrastRgb(visible, fg) < 4.5) {
      var alt = readableInk(visible);
      if (contrastRgb(visible, alt) > contrastRgb(visible, fg)) {
        c = visible;
        fg = alt;
      }
    }
    var dark = fg === "#F8FAFC" || fg === "#FFFFFF";
    var bg = c ? "rgb(" + Math.round(c.r) + "," + Math.round(c.g) + "," + Math.round(c.b) + ")" : (dark ? "#0F172A" : "#FFFFFF");
    var border = fg;
    btn.style.setProperty("--sai-tb-fg", fg);
    btn.style.setProperty("--sai-tb-bg", bg);
    btn.style.setProperty("--sai-tb-border", border);
    paintInk(btn, fg);
    btn.style.setProperty("background-color", bg, "important");
    btn.style.setProperty("border-color", border, "important");
    var open = btn.querySelector(".sai-tb-open");
    var hide = btn.querySelector(".sai-tb-hide");
    var label = btn.querySelector(".sai-tb-label");
    if (open) {
      paintInk(open, fg);
      open.style.setProperty("background-color", "transparent", "important");
    }
    if (label) paintInk(label, fg);
    var chip = btn.querySelector(".sai-tb-chip");
    if (chip) paintInk(chip, fg);
    if (hide) {
      paintInk(hide, fg);
      hide.style.setProperty("background-color", "transparent", "important");
    }
    btn.querySelectorAll(".sai-ico").forEach(function (el) { el.style.setProperty("background-color", fg, "important"); });
    var iconFg = state.theme && HEX.test(state.theme.sidebarText) ? state.theme.sidebarText : fg;
    document.documentElement.style.setProperty("--sai-ico-fg", iconFg);
    if (sb) sb.querySelectorAll(".sai-ico[data-sai-nav]").forEach(function (el) {
      // Let state selectors win immediately on hover/selection. Inline
      // important colors otherwise freeze the last sampled icon state.
      el.style.removeProperty("background-color");
      el.style.removeProperty("color");
    });
    btn.setAttribute("data-sai-contrast", dark ? "dark" : "light");
    if (!sb) return;
    if (!inHeader) { paintSearch(sb, fg, c); return; }
    var sc = sampleSidebar(sb);
    var sfg = readableInk(sc);
    var sVisible = dominantFill(sb);
    if (sVisible && contrastRgb(sVisible, sfg) < 4.5) {
      var sAlt = readableInk(sVisible);
      if (contrastRgb(sVisible, sAlt) > contrastRgb(sVisible, sfg)) { sc = sVisible; sfg = sAlt; }
    }
    paintSearch(sb, sfg, sc);
  }
  var stats = { mutations: 0, sidebarMutations: 0, decorates: 0, scans: 0 };
  function noteSidebar() {
    var sb = sidebar();
    if ((!sb && !readyHeaderSlot() && !pendingHeader()) || !canEdit() || !allowed(routeKey())) return;
    if (!document.querySelector(".sai-tb-trigger")) {
      decorateTrigger();
      paintTrigger();
    }
  }
  function decorate() {
    stats.decorates++;
    if (IS_SWITCHYARD) { decorateTrigger(); paintTrigger(); return; }
    document.documentElement.classList.toggle("sai-pin-footer", CFG.brandingVersion === "v1" || CFG.brandingVersion === "v2");
    var quiet = quietPage();
    var heavy = heavyPage();
    document.documentElement.classList.toggle("sai-quiet-page", quiet || heavy);
    var ok = allowed(routeKey());
    var motion = !!state.theme && ok && !heavy && state.theme.motion !== false;
    document.documentElement.classList.toggle("sai-motion", motion);
    reuseInjected();
    decorateTrigger();
    paintTrigger();
    watchCollapse();
    if (motion) setupGliders();
    if (ok) separatePinnedFooter();
    if (state.theme && ok && !heavy) {
      decorateIcons(state.theme);
      decorateLogo(state.theme);
      if (!CFG.brandingVersion || CFG.brandingVersion === "v3" || state.theme.customSurface) scheduleScan();
    } else if (state.theme && ok && heavy) {
      var sb = sidebar();
      if (sb && sb.__saiQuietPass !== scanStamp) {
        sb.__saiQuietPass = scanStamp;
        decorateIcons(state.theme);
        decorateLogo(state.theme);
      }
    }
  }

  /* ---------------- Shared logo hosting ---------------- */
  var logoBusy = false, sharedLogoUrl = "", logoPull = 0;
  var LOGO_MAX = 2 * 1024 * 1024;

  function logoEndpoint() {
    return String(CFG.logoEndpoint || "https://auth.saassuite.ai/functions/v1/theme-logo").replace(/\/+$/, "");
  }
  function logoScope(key) {
    var agencyKey = String(CFG.agencyKey || "").trim();
    if (!agencyKey) return null;
    return { agencyKey: agencyKey, locationId: key || routeKey() };
  }
  function scopeId(key) { return String(key || routeKey() || "agency"); }
  function logoSlotKey(key) { return "sai_logo_slot_v1:" + String(CFG.agencyKey || "agency") + ":" + scopeId(key); }
  function sharedMarkKey(key) { return "sai_shared_logo_v1:" + String(CFG.agencyKey || "agency") + ":" + scopeId(key); }
  function readSharedMark(key) { try { return localStorage.getItem(sharedMarkKey(key)) || ""; } catch (e) { return ""; } }
  function writeSharedMark(key, url) {
    if (scopeId(key) === routeKey()) sharedLogoUrl = url || "";
    try {
      if (url) localStorage.setItem(sharedMarkKey(key), url);
      else localStorage.removeItem(sharedMarkKey(key));
    } catch (e) { }
  }
  function readLogoSlot(key) {
    try {
      var raw = localStorage.getItem(logoSlotKey(key));
      if (raw == null) return null;
      var parsed = JSON.parse(raw);
      return typeof parsed === "string" ? parsed : "";
    } catch (e) { return null; }
  }
  function writeLogoSlot(key, url) {
    try { localStorage.setItem(logoSlotKey(key), JSON.stringify(url || "")); } catch (e) { }
  }
  // Logos belong in the per-key slot. A legacy theme blob may still show a
  // logo for that same key. An agency blob must not be inherited: store("agency")
  // is the agencyKey, so a logo saved while the route key was "agency" used to
  // ride along inside the theme and show on every sub-account. theme_logos can
  // be empty and that still happens. Design's agencyTheme logo is not used here.
  function agencyBlobLogo(extra) {
    if (extra && safeUrl(extra.logoUrl)) return extra.logoUrl;
    var agencySaved = lsGet("agency");
    return agencySaved && safeUrl(agencySaved.logoUrl) ? agencySaved.logoUrl : "";
  }
  function withoutStoredLogo(theme) {
    if (!theme || typeof theme !== "object" || theme.ghlDefault === true || theme.inheritAgency === true) return theme;
    if (!theme.logoUrl) return theme;
    var next = copy(theme);
    next.logoUrl = "";
    return next;
  }
  function keepLocationBlobLogo(key, theme, agencyUrl) {
    if (!theme || key === "agency" || !safeUrl(theme.logoUrl)) return;
    if (readLogoSlot(key) != null) return;
    var agencySlot = readLogoSlot("agency");
    if ((agencySlot && theme.logoUrl === agencySlot) || (agencyUrl && theme.logoUrl === agencyUrl)) return;
    writeLogoSlot(key, theme.logoUrl);
  }
  function themeOwnedLogo(key) {
    var slot = readLogoSlot(key);
    if (slot) return slot;
    if (slot === "") return "";
    var raw = lsGet(key);
    var url = raw && safeUrl(raw.logoUrl) ? raw.logoUrl : "";
    if (!url || key === "agency") return url;
    var agencySlot = readLogoSlot("agency");
    if ((agencySlot && url === agencySlot) || url === agencyBlobLogo()) return "";
    return url;
  }
  function displayLogo(key) {
    var own = themeOwnedLogo(key);
    if (own) return own;
    if (key !== "agency" && CFG.inheritAgencyTheme !== false) {
      var slot = readLogoSlot("agency");
      return slot || "";
    }
    return "";
  }
  function withDisplayLogo(theme, key) {
    if (!theme) return theme;
    var next = copy(theme);
    next.logoUrl = displayLogo(key);
    return next;
  }
  function ownedDraftLogo(key) {
    if (!draft || draftDefault) return "";
    var url = safeUrl(draft.logoUrl) ? draft.logoUrl : "";
    if (!url) return "";
    var own = themeOwnedLogo(key);
    if (own && url === own) return url;
    if (key !== "agency") {
      var slot = readLogoSlot("agency");
      if ((slot && url === slot) || url === agencyBlobLogo()) return own || "";
    }
    return url;
  }
  function logoSavedMessage(key, removed) {
    if (removed) {
      return key === "agency"
        ? "Agency logo removed. Sub-accounts without their own logo use the HighLevel logo."
        : "Logo removed for this sub-account. It now uses the agency logo.";
    }
    return key === "agency"
      ? "Logo saved as the agency default. Sub-accounts without their own logo use it."
      : "Logo saved for this sub-account only.";
  }
  function logoFileError(file) {
    if (!file) return "Choose an image file.";
    if (file.size > LOGO_MAX) return "That logo is over 2 MB.";
    var type = String(file.type || "").toLowerCase();
    var name = String(file.name || "").toLowerCase();
    var okType = type === "image/png" || type === "image/jpeg" || type === "image/jpg" || type === "image/webp" || type === "image/svg+xml";
    var okName = /\.(png|jpe?g|webp|svg)$/.test(name);
    if (type && !okType) return "Use a PNG, JPG, SVG, or WebP image.";
    if (!type && !okName) return "Use a PNG, JPG, SVG, or WebP image.";
    return "";
  }
  function sidebarLogoSrc() {
    var sb = sidebar();
    if (!sb) return "";
    var imgs = sb.querySelectorAll("img.sai-logo-slot, img.agency-logo, .agency-logo-container img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.classList.contains("sai-logo-hidden")) continue;
      var src = img.getAttribute("src");
      if (safeUrl(src)) return src;
    }
    return "";
  }
  function renderLogo() {
    if (!ui || !draft) return;
    var img = q(".sai-logo-preview"), empty = q(".sai-logo-empty");
    if (!img || !empty) return;
    // The drop zone edits the logo this screen owns. An inherited agency logo
    // is only a preview, so it stays out of the field that save writes.
    var owned = safeUrl(draft.logoUrl) ? draft.logoUrl : "";
    var shown = displayLogo(routeKey());
    var preview = owned || (safeUrl(shown) ? shown : "") || sidebarLogoSrc();
    if (preview) {
      if (img.getAttribute("src") !== preview) img.setAttribute("src", preview);
      img.hidden = false;
      empty.hidden = true;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
      empty.hidden = false;
    }
    var remove = q('[data-act="removelogo"]');
    if (remove) remove.disabled = !owned || logoBusy;
    var pick = q('[data-act="picklogo"]');
    if (pick) pick.disabled = logoBusy;
  }
  function quietDirty(v) {
    dirty = v;
    var btn = q('[data-act="discard"]');
    if (btn) btn.disabled = !v;
  }
  function commitLogo(url, message) {
    var key = routeKey();
    if (blocksAgencyWrite()) {
      status("This sub-account's location id wasn't found, so the logo was not saved onto the agency.", "err");
      return;
    }
    writeLogoSlot(key, url || "");
    draftDefault = false;
    var base = saved ? copy(saved) : clean(state.theme || CFG.agencyTheme || DEFAULT, DEFAULT);
    base.logoUrl = "";
    saved = clean(base, DEFAULT);
    lsSet(key, saved);
    if (HAS_SB || state.shared) state.remote[key] = saved;
    var view = copy(saved);
    view.logoUrl = url && safeUrl(url) ? url : displayLogo(key);
    draft.logoUrl = url || "";
    var logoField = q('[data-field="logoUrl"]');
    if (logoField) logoField.value = url || "";
    apply(view);
    render();
    quietDirty(JSON.stringify(clean(draft, DEFAULT)) !== JSON.stringify(clean(view, DEFAULT)));
    var saveBtn = q('[data-act="save"]');
    if (saveBtn) saveBtn.disabled = false;
    saveBusy = false;
    status(message, "ok");
  }
  function readLogoResponse(r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) throw new Error((j && j.error) || ("HTTP " + r.status));
      return j || {};
    });
  }
  function publishSharedLogo(url, force) {
    var scope = logoScope(routeKey());
    if (!scope) return Promise.reject(new Error("This install has no agency id, so a logo can't be shared yet."));
    if (!force && (url || "") === sharedLogoUrl) return Promise.resolve({ logoUrl: url || "" });
    var payload = Object.assign({ agencyKey: scope.agencyKey, locationId: scope.locationId }, saveProof());
    var req;
    if (url) {
      payload.logoUrl = url;
      req = fetch(logoEndpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } else {
      req = fetch(logoEndpoint(), { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    }
    return req.then(readLogoResponse).then(function (j) {
      var next = url ? (j.logoUrl || url) : "";
      if (next && !safeUrl(next)) throw new Error("The logo link was not a hosted https address.");
      writeSharedMark(routeKey(), next);
      return j;
    });
  }
  function uploadLogo(file) {
    if (logoBusy) return;
    var problem = logoFileError(file);
    if (problem) { status(problem, "err"); return; }
    if (blocksAgencyWrite()) { status("This sub-account's location id wasn't found, so the logo was not saved onto the agency.", "err"); return; }
    var scope = logoScope(routeKey());
    if (!scope) { status("This install has no agency id, so a logo can't be shared yet.", "err"); return; }
    logoBusy = true;
    logoPull++;
    renderLogo();
    status("Uploading logo…");
    discoverUser().then(function () { return refreshSaveGrant(); }).then(function () {
      var body = new FormData();
      body.append("agencyKey", scope.agencyKey);
      body.append("locationId", scope.locationId);
      var proof = saveProof();
      body.append("saveToken", proof.saveToken);
      body.append("userId", proof.userId);
      body.append("userEmail", proof.userEmail);
      body.append("userType", proof.userType);
      body.append("userRole", proof.userRole);
      body.append("file", file, file.name || "logo");
      return fetch(logoEndpoint(), { method: "POST", body: body });
    }).then(readLogoResponse).then(function (j) {
      if (!safeUrl(j.logoUrl)) throw new Error("The upload did not return a hosted image link.");
      writeSharedMark(routeKey(), j.logoUrl);
      commitLogo(j.logoUrl, logoSavedMessage(routeKey(), false));
    }).catch(function (err) {
      status((err && err.message) || "Couldn't upload that logo. Try again.", "err");
    }).then(function () {
      logoBusy = false;
      renderLogo();
    });
  }
  function removeLogo() {
    if (logoBusy) return;
    if (blocksAgencyWrite()) { status("This sub-account's location id wasn't found, so the agency logo was left unchanged.", "err"); return; }
    logoBusy = true;
    logoPull++;
    renderLogo();
    status("Removing logo…");
    discoverUser().then(function () { return refreshSaveGrant(); }).then(function () { return publishSharedLogo("", true); }).then(function () {
      commitLogo("", logoSavedMessage(routeKey(), true));
    }).catch(function (err) {
      status((err && err.message) || "Couldn't remove the shared logo. It is still showing.", "err");
    }).then(function () {
      logoBusy = false;
      renderLogo();
    });
  }
  function fetchLogoRow(key) {
    var scope = logoScope(key);
    if (!scope) return Promise.resolve({ key: key, unavailable: true });
    var endpoint = logoEndpoint() + "?agencyKey=" + encodeURIComponent(scope.agencyKey) + "&locationId=" + encodeURIComponent(scope.locationId);
    return fetch(endpoint, { method: "GET" }).then(function (r) {
      if (!r.ok) return { key: key, unavailable: true };
      return r.json().then(function (body) {
        var url = body && typeof body.logoUrl === "string" ? body.logoUrl : "";
        if (url && !safeUrl(url)) url = "";
        return { key: key, url: url };
      }).catch(function () { return { key: key, unavailable: true }; });
    }).catch(function () { return { key: key, unavailable: true }; });
  }
  function pullSharedLogo(key) {
    if (!logoScope(key)) return;
    var keys = key === "agency" ? ["agency"] : [key, "agency"];
    var ticket = ++logoPull;
    Promise.all(keys.map(fetchLogoRow)).then(function (rows) {
      if (ticket !== logoPull || state.key !== key) return;
      rows.forEach(function (row) {
        if (!row || row.unavailable) return;
        if (row.url) writeLogoSlot(row.key, row.url);
        else if (readSharedMark(row.key)) writeLogoSlot(row.key, "");
        writeSharedMark(row.key, row.url || "");
      });
      if (state.editing) return;
      var next = withDisplayLogo(state.theme || resolve(key), key);
      if (!next) return;
      if (JSON.stringify(next) !== JSON.stringify(state.theme)) apply(next);
      else decorateLogo(next);
    }).catch(function () { });
  }

  /* ---------------- Theme builder panel ---------------- */
  var ui = null, draft = null, saved = null, dirty = false, draftDefault = false, draftInherit = false;
  var PREVIEW_KEYS = ["dashboard", "conversations", "calendars", "contacts", "opportunities", "payments", "automation", "settings"];

  function looksLikeLocationId(value) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return true;
    if (text === routeKey()) return true;
    if (text.indexOf(" ") > -1) return false;
    return /^[A-Za-z0-9_-]{12,}$/.test(text);
  }
  function separatePlace(text) {
    return String(text || "").replace(/([A-Za-z0-9]{2,}?)([A-Z][a-zA-Z.'-]{2,},\s*[A-Z]{2})\b/g, function (all, name, city) {
      if (/^(Mc|Mac|De|La|Le|St|Van|Di)$/.test(name)) return all;
      return name + " · " + city;
    });
  }
  function tidyAccountName(value) {
    var text = separatePlace(String(value || "")).replace(/\s+/g, " ").trim();
    if (!text) return "";
    var kept = text.split(" ").filter(function (part) { return !looksLikeLocationId(part); }).join(" ").trim();
    if (!kept || looksLikeLocationId(kept)) return "";
    if (/^(agency view|location|sub-account|switch|highlevel)$/i.test(kept)) return "";
    return kept.slice(0, 80);
  }
  function joinedParts(nodes) {
    var parts = [];
    for (var i = 0; i < nodes.length; i++) {
      var bit = tidyAccountName(nodes[i]);
      if (bit && parts.indexOf(bit) === -1) parts.push(bit);
    }
    if (parts.length > 1) return parts.join(" · ").slice(0, 80);
    return parts[0] || "";
  }
  function accountName() {
    if (routeKey() === "agency") return "Agency view";
    var found = "";
    function take(value) { if (!found) found = tidyAccountName(value); }
    var sw = document.querySelector(SWITCHER);
    if (sw) {
      take(sw.getAttribute("data-location-name") || sw.getAttribute("data-name") || sw.getAttribute("aria-label") || sw.getAttribute("title"));
      var named = sw.querySelectorAll("[data-location-name],[data-name],.hl_location-text,.location-name,[class*='location-name'],[class*='loc-name']");
      for (var i = 0; i < named.length; i++) take(named[i].getAttribute("data-location-name") || named[i].getAttribute("data-name") || named[i].textContent);
      var childBits = [];
      var kids = sw.children || [];
      for (var c = 0; c < kids.length; c++) childBits.push(kids[c].innerText || kids[c].textContent || "");
      var fromKids = joinedParts(childBits);
      if (fromKids.indexOf(" · ") > -1) take(fromKids);
      var lines = (sw.innerText || sw.textContent || "").split("\n");
      take(joinedParts(lines));
    }
    var pageNamed = document.querySelectorAll("[data-location-name]");
    for (var k = 0; k < pageNamed.length; k++) {
      if (sw && sw.contains(pageNamed[k])) continue;
      take(pageNamed[k].getAttribute("data-location-name") || pageNamed[k].textContent);
    }
    if (found) return found;
    var cached = state.names && state.names[routeKey()];
    if (cached) return cached;
    return "This sub-account";
  }
  function q(s) { return ui.querySelector(s); }
  function qa(s) { return Array.prototype.slice.call(ui.querySelectorAll(s)); }

  function buildUi() {
    var presets = '<button type="button" class="sai-preset" data-preset="default" aria-pressed="false" style="--a:#FFFFFF;--b:#EEF2F6;--c:#155EEF"><span class="sai-sw"></span><span class="sai-preset-name">' + (CFG.brandingVersion ? "Agency branding" : "GHL default") + '</span></button>' + PRESETS.map(function (p, i) {
      return '<button type="button" class="sai-preset" data-preset="' + i + '" aria-pressed="false" style="--a:' + p.sidebarBg + ';--b:' + p.sidebarBgEnd + ';--c:' + p.accent + '"><span class="sai-sw"></span><span class="sai-preset-name">' + esc(p.name) + "</span></button>";
    }).join("");
    var colorsExtra = '<label class="sai-check"><input type="checkbox" data-field="appAccent"> Use the highlight color on top navigation, page tabs and main buttons</label>';
    var colors = COLOR_FIELDS.map(function (f) {
      return '<div class="sai-row"><label for="sai-c-' + f[0] + '">' + f[1] + '</label><div class="sai-color"><input type="color" id="sai-c-' + f[0] + '" data-color="' + f[0] + '"><input type="text" class="sai-hex" data-hex="' + f[0] + '" maxlength="7" spellcheck="false" aria-label="' + f[1] + ' hex code"></div></div>';
    }).join("");
    var fonts = FONTS.map(function (f) { return '<option value="' + f + '">' + f + "</option>"; }).join("");
    var packs = Object.keys(PACKS).map(function (k) { return '<option value="' + k + '">' + PACKS[k].label + "</option>"; }).join("") + '<option value="default">Keep default icons</option>';

    ui = document.createElement("aside");
    ui.className = "sai-tb";
    ui.setAttribute("role", "dialog");
    ui.setAttribute("aria-label", "Theme Customizer (Beta)");
    ui.innerHTML =
      '<header class="sai-tb-head"><div><h2>Theme Customizer (Beta)</h2><p class="sai-tb-beta">This is in beta and may have bugs. The full release is November 1st.</p><p class="sai-tb-install" hidden>Update your install script in SaaSSuite > Design</p><p class="sai-tb-scope"></p><button type="button" class="sai-linkbtn" data-act="togglemin"></button></div><button type="button" class="sai-tb-x" data-act="close" aria-label="Close theme customizer">&times;</button></header>' +
      '<div class="sai-tb-body">' +
        '<details class="sai-fold"><summary>Start from a preset</summary><div class="sai-presets">' + presets + "</div></details>" +
        '<details class="sai-fold" open><summary>Colors</summary>' + colors + colorsExtra + "</details>" +
        '<details class="sai-fold"><summary>Motion</summary><label class="sai-check"><input type="checkbox" data-field="motion"> Navigation animations</label></details>' +
        '<details class="sai-fold"><summary>Saved presets (this browser)</summary><input class="sai-full" aria-label="Saved preset name" data-preset-name placeholder="Preset name"><button type="button" class="sai-btn" data-act="savepreset">Save preset without applying</button><select class="sai-full" data-saved-presets aria-label="Saved browser presets"></select><button type="button" class="sai-btn" data-act="restorepreset">Preview saved preset</button></details>' +
        '<details class="sai-fold"><summary>Font</summary><div class="sai-stack"><select class="sai-full" data-field="font" aria-label="Font">' + fonts + '</select><select class="sai-full" data-field="fontScope" aria-label="Where the font applies"><option value="app">Use across the whole app</option><option value="sidebar">Use in the sidebar only</option><option value="none">Keep the GHL font</option></select></div></details>' +
        '<details class="sai-fold"><summary>Icons</summary><select class="sai-full" data-field="iconPack" aria-label="Icon set">' + packs + '</select><div class="sai-icon-row" aria-hidden="true"></div>' +
          '<details><summary>Change a single icon</summary><p class="sai-hint">Type an icon name from the set above, any icon as set:name (for example ph:house), or an https link to an SVG.</p><div class="sai-ov"></div></details></details>' +
        '<details class="sai-fold" data-logo-section><summary>Logo</summary><div class="sai-logo-drop" data-logo-drop><img class="sai-logo-preview" alt="Logo preview" hidden><p class="sai-logo-empty">Drop a PNG, JPG, SVG, or WebP here, or choose a file. 2 MB max.</p><input type="file" class="sai-logo-file" data-logo-file accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.svg,.webp" aria-label="Logo file"></div><div class="sai-tb-actions sai-logo-actions"><button type="button" class="sai-btn" data-act="picklogo">Upload logo</button><button type="button" class="sai-btn" data-act="removelogo">Remove</button></div><div class="sai-range"><span class="sai-label">Height</span><input type="range" min="20" max="90" step="1" data-field="logoHeight" aria-label="Logo height"><output data-out="logoHeight"></output></div><p class="sai-hint sai-logo-scope"></p><p class="sai-hint">Remove the logo to inherit the agency logo. A sub-account logo stays on that sub-account.</p></details>' +
        '<details class="sai-fold"><summary>Shape</summary><div class="sai-range"><span class="sai-label">Corner roundness</span><input type="range" min="0" max="20" step="1" data-field="radius" aria-label="Corner roundness"><output data-out="radius"></output></div></details>' +
      "</div>" +
      '<footer class="sai-tb-foot"><p class="sai-tb-status" aria-live="polite"></p><div class="sai-tb-actions"><button type="button" class="sai-btn" data-act="resetbrand">Reset to agency branding</button><button type="button" class="sai-btn" data-act="discard">Discard changes</button><button type="button" class="sai-btn" data-act="copy">Copy theme code</button><button type="button" class="sai-btn sai-btn-primary" data-act="save">Save theme</button></div></footer>';
    document.body.appendChild(ui);

    ui.addEventListener("input", onInput);
    ui.addEventListener("click", onClick);
    ui.addEventListener("change", function (e) {
      if (!e.target || !e.target.hasAttribute) return;
      if (!e.target.hasAttribute("data-logo-file")) { onInput(e); return; }
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (file) uploadLogo(file);
    });
    ui.addEventListener("dragover", function (e) {
      if (!e.target.closest || !e.target.closest("[data-logo-drop]")) return;
      e.preventDefault();
      q("[data-logo-drop]").classList.add("sai-drag");
    });
    ui.addEventListener("dragleave", function (e) {
      var zone = q("[data-logo-drop]");
      if (!zone || (e.relatedTarget && zone.contains(e.relatedTarget))) return;
      zone.classList.remove("sai-drag");
    });
    ui.addEventListener("drop", function (e) {
      if (!e.target.closest || !e.target.closest("[data-logo-drop]")) return;
      e.preventDefault();
      var zone = q("[data-logo-drop]");
      if (zone) zone.classList.remove("sai-drag");
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) uploadLogo(file);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ui.classList.contains("open")) closeBuilder(); });
  }

  function status(msg, tone) {
    var s = q(".sai-tb-status");
    s.textContent = msg || "";
    if (tone) s.setAttribute("data-tone", tone); else s.removeAttribute("data-tone");
  }
  function setDirty(v) {
    dirty = v;
    q('[data-act="discard"]').disabled = !v;
    if (v) status("Unsaved changes. Closing the panel discards them.");
  }

  function renderIconRow() {
    var row = q(".sai-icon-row");
    if (draftDefault) { row.innerHTML = '<span class="sai-hint" style="color:inherit;margin:0">Using the default icons</span>'; return; }
    row.innerHTML = PREVIEW_KEYS.map(function (k) {
      var u = iconUrl(draft, k);
      return u ? '<span class="sai-ico" style="--sai-ico:url(\'' + u + '\')"></span>' : "";
    }).join("") || '<span class="sai-hint" style="color:inherit;margin:0">Using the default icons</span>';
  }
  function renderOverrides() {
    var seen = {}, rows = [];
    navLinks().forEach(function (a) {
      var k = keyFor(a);
      if (seen[k]) return;
      seen[k] = true;
      rows.push('<span title="' + esc(rawLabel(a)) + '">' + esc(rawLabel(a) || k) + '</span><input type="text" data-icon="' + esc(k) + '" spellcheck="false" placeholder="' + esc(packRef(draft, k) || "default icon") + '" value="' + esc(draft.icons[k] || "") + '" aria-label="Icon for ' + esc(rawLabel(a)) + '">');
    });
    q(".sai-ov").innerHTML = rows.join("") || '<span>Open a page with the sidebar visible to list its items.</span>';
  }
  function renderPresets() {
    qa("[data-preset]").forEach(function (b) {
      var id = b.getAttribute("data-preset");
      if (id === "default") { b.setAttribute("aria-pressed", String(draftDefault || draftInherit)); return; }
      var p = PRESETS[+id];
      b.setAttribute("aria-pressed", String(!draftDefault && p.sidebarBg === draft.sidebarBg && p.accent === draft.accent && p.sidebarText === draft.sidebarText));
    });
  }
  function renderMinToggle() {
    q('[data-act="togglemin"]').textContent = isMin() ? "Show the full sidebar button" : "Shrink the sidebar button to an icon";
  }
  function renderSavedPresets() {
    var list = lsGet("presets:" + routeKey()) || [];
    q('[data-saved-presets]').innerHTML = list.map(function(p, i) { return '<option value="' + i + '">' + esc(p.name) + '</option>'; }).join("");
  }
  function render() {
    renderSavedPresets();
    q('[data-field="motion"]').checked = draft.motion !== false;
    renderMinToggle();
    q(".sai-tb-scope").textContent = "For " + accountName();
    COLOR_FIELDS.forEach(function (f) {
      q('[data-color="' + f[0] + '"]').value = draft[f[0]].toLowerCase();
      var h = q('[data-hex="' + f[0] + '"]');
      h.value = draft[f[0]];
      h.removeAttribute("aria-invalid");
    });
    q('[data-field="appAccent"]').checked = draft.appAccent !== false;
    ["font", "fontScope", "iconPack", "logoHeight", "radius"].forEach(function (k) {
      var el = q('[data-field="' + k + '"]');
      if (!el) return;
      el.value = draft[k];
      el.removeAttribute("aria-invalid");
    });
    q('[data-out="logoHeight"]').textContent = draft.logoHeight + "px";
    q('[data-out="radius"]').textContent = draft.radius + "px";
    renderPresets();
    renderIconRow();
    renderOverrides();
    renderLogo();
    var install = q(".sai-tb-install");
    if (install) install.hidden = hasIdentity() || !!String(CFG.saveToken || "").trim();
    var scope = q(".sai-logo-scope");
    if (scope) {
      var key = routeKey(), own = themeOwnedLogo(key);
      scope.textContent = key === "agency"
        ? "This logo is the agency default. Sub-accounts without their own logo use it."
        : (own ? "This logo is only for this sub-account." : "This sub-account is using the agency logo. A logo you save here does not change the agency or other sub-accounts.");
    }
  }

  function changed(full) {
    draftDefault = false;
    draftInherit = false;
    draft = clean(draft, DEFAULT);
    apply(draft);
    if (full) render(); else {
      renderPresets(); renderIconRow(); renderLogo();
      COLOR_FIELDS.forEach(function (f) {
        var hex = q('[data-hex="' + f[0] + '"]'), color = q('[data-color="' + f[0] + '"]');
        if (hex && HEX.test(draft[f[0]])) hex.value = draft[f[0]];
        if (color && HEX.test(draft[f[0]])) color.value = draft[f[0]].toLowerCase();
      });
    }
    setDirty(true);
  }

  function onInput(e) {
    var t = e.target, v;
    if (t.hasAttribute("data-color")) {
      draft.customSurface = true;
      var k = t.getAttribute("data-color");
      draft[k] = t.value.toUpperCase();
      q('[data-hex="' + k + '"]').value = draft[k];
      q('[data-hex="' + k + '"]').removeAttribute("aria-invalid");
    } else if (t.hasAttribute("data-hex")) {
      var hk = t.getAttribute("data-hex");
      draft.customSurface = true;
      v = t.value.trim();
      if (v && v.charAt(0) !== "#") v = "#" + v;
      if (!HEX.test(v)) { t.setAttribute("aria-invalid", "true"); return; }
      t.removeAttribute("aria-invalid");
      draft[hk] = v.toUpperCase();
      q('[data-color="' + hk + '"]').value = v.toLowerCase();
    } else if (t.hasAttribute("data-icon")) {
      var ik = t.getAttribute("data-icon");
      v = t.value.trim();
      if (!v) delete draft.icons[ik];
      else if (safeIconRef(v)) draft.icons[ik] = v;
      else { t.setAttribute("aria-invalid", "true"); return; }
      t.removeAttribute("aria-invalid");
    } else if (t.hasAttribute("data-field")) {
      var fk = t.getAttribute("data-field");
      v = t.type === "checkbox" ? t.checked : t.value;
      if (fk === "logoUrl") {
        v = v.trim();
        if (v && !safeUrl(v)) { t.setAttribute("aria-invalid", "true"); return; }
        t.removeAttribute("aria-invalid");
      }
      if (fk === "logoHeight" || fk === "radius") { v = +v; q('[data-out="' + fk + '"]').textContent = v + "px"; }
      draft[fk] = v;
      if (fk === "iconPack") { changed(false); renderOverrides(); return; }
    } else return;
    changed(false);
  }

  function onClick(e) {
    if (e.target.closest && e.target.closest("[data-logo-drop]")) {
      if (e.target.hasAttribute && e.target.hasAttribute("data-logo-file")) return;
      var logoInput = q("[data-logo-file]");
      if (logoInput && !logoBusy) logoInput.click();
      return;
    }
    var b = e.target.closest("button");
    if (!b || !ui.contains(b)) return;
    if (b.getAttribute("data-preset") === "default") {
      if (CFG.brandingVersion) {
        draftInherit = true;
        draftDefault = false;
        draft = clean(CFG.agencyTheme, DEFAULT);
        draft.logoUrl = themeOwnedLogo(routeKey());
        apply(withDisplayLogo(clean(CFG.agencyTheme, DEFAULT), routeKey()));
        render(); setDirty(true);
        status(routeKey() === "agency"
          ? "Previewing the branding from Design. Save to drop this browser's agency color override."
          : "Previewing agency branding. Save to clear this sub-account's color override so later Design changes show here.");
        return;
      }
      draftDefault = true;
      off();
      renderPresets(); renderIconRow();
      setDirty(!!saved);
      status(saved ? "Previewing GHL's standard look. Save to use it for everyone in this account." : "This account already uses GHL's standard look.");
      return;
    }
    if (b.hasAttribute("data-preset")) {
      draftInherit = false;
      var p = PRESETS[+b.getAttribute("data-preset")];
      draft = clean({ customSurface: true, logoUrl: draft.logoUrl, logoHeight: draft.logoHeight, icons: draft.icons, radius: draft.radius, fontScope: draft.fontScope, appAccent: draft.appAccent }, p);
      changed(true);
      return;
    }
    var act = b.getAttribute("data-act");
    if (act === "close") closeBuilder();
    else if (act === "discard") {
      draft = clean(saved || PRESETS[0], DEFAULT);
      draftDefault = !saved;
      if (saved) apply(saved); else off();
      render(); setDirty(false); status("");
    }
    else if (act === "copy") copyCode();
    else if (act === "togglemin") setMin(!isMin());
    else if (act === "savepreset") {
      var name = q('[data-preset-name]').value.trim();
      if (!name) { status("Name your preset first.", "err"); return; }
      var list = lsGet("presets:" + routeKey()) || [];
      list.push({ name: name, theme: clean(draft, DEFAULT) }); lsSet("presets:" + routeKey(), list);
      renderSavedPresets(); status("Preset saved in this browser. Live saved theme unchanged.", "ok");
    }
    else if (act === "restorepreset") {
      var list = lsGet("presets:" + routeKey()) || [], item = list[Number(q('[data-saved-presets]').value)];
      if (item) { draft = clean(item.theme, DEFAULT); changed(true); }
    }
    else if (act === "save") save();
    else if (act === "resetbrand") {
      if (!CFG.brandingVersion) { status("This install has no agency branding to reset to.", "err"); return; }
      draftInherit = true;
      draftDefault = false;
      draft = clean(CFG.agencyTheme || DEFAULT, DEFAULT);
      var resetKey = routeKey();
      var resetSub = resetKey !== "agency";
      draft.logoUrl = resetSub ? "" : themeOwnedLogo(resetKey);
      var preview = clean(CFG.agencyTheme || DEFAULT, DEFAULT);
      if (resetSub) {
        preview.logoUrl = readLogoSlot("agency") || "";
        apply(preview);
      } else apply(withDisplayLogo(preview, resetKey));
      render();
      setDirty(true);
      save();
    }
    else if (act === "picklogo") { var logoInput = q("[data-logo-file]"); if (logoInput) logoInput.click(); }
    else if (act === "removelogo") removeLogo();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (res, rej) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? res() : rej(new Error("copy blocked")); } catch (err) { rej(err); }
      ta.remove();
    });
  }
  function copyCode() {
    var key = routeKey(), json = draftDefault ? '{"ghlDefault":true}' : JSON.stringify(clean(draft, DEFAULT));
    var code = key === "agency" ? "agencyTheme: " + json + "," : '"' + key + '": ' + json + ",";
    copyText(code).then(function () {
      status(key === "agency" ? "Theme code copied. Paste it over agencyTheme in the agency Custom JS." : "Theme code copied. Paste it inside locationThemes in the agency Custom JS.", "ok");
    }).catch(function () {
      window.prompt("Copy this theme code:", code);
    });
  }

  function themeEndpoint() {
    return String(CFG.themeEndpoint || "https://auth.saassuite.ai/functions/v1/location-theme").replace(/\/+$/, "");
  }
  function sharedThemesOn() {
    if (!String(CFG.agencyKey || "").trim()) return false;
    if (hasIdentity()) return true;
    // Current Design tags often omit the user. The agency script still embeds a save token.
    return !!String(CFG.saveToken || "").trim();
  }
  var themePull = 0;
  function readThemeResponse(r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) {
        var err = new Error((j && j.error) || ("HTTP " + r.status));
        err.status = r.status;
        err.server = !!(j && j.error);
        throw err;
      }
      return j || {};
    });
  }
  function loadSharedTheme(key) {
    var url = themeEndpoint() + "?agencyKey=" + encodeURIComponent(String(CFG.agencyKey || "")) + "&locationId=" + encodeURIComponent(key);
    return fetch(url, { method: "GET" }).then(function (r) {
      if (r.status === 404) return { key: key, unavailable: true };
      if (!r.ok) return { key: key, unavailable: true };
      return r.json().then(function (j) {
        if (j && j.locationName) state.names[key] = String(j.locationName).slice(0, 80);
        return { key: key, theme: j && j.theme ? j.theme : null };
      }).catch(function () { return { key: key, unavailable: true }; });
    }).catch(function () { return { key: key, unavailable: true }; });
  }
  function pullSharedTheme(key) {
    if (!sharedThemesOn()) return;
    var keys = key === "agency" ? ["agency"] : [key, "agency"];
    var ticket = ++themePull;
    Promise.all(keys.map(loadSharedTheme)).then(function (rows) {
      if (ticket !== themePull || state.key !== key || state.editing) return;
      var any = false;
      var agencyUrl = agencyBlobLogo();
      rows.forEach(function (row) {
        if (row && row.key === "agency" && row.theme && safeUrl(row.theme.logoUrl)) agencyUrl = row.theme.logoUrl;
      });
      rows.forEach(function (row) {
        if (!row || row.unavailable) return;
        any = true;
        keepLocationBlobLogo(row.key, row.theme, agencyUrl);
        var theme = row.theme ? withoutStoredLogo(row.theme) : false;
        state.remote[row.key] = theme || false;
        if (theme) lsSet(row.key, theme);
      });
      if (!any) return;
      state.shared = true;
      var next = withDisplayLogo(resolve(key), key);
      if (JSON.stringify(next) !== JSON.stringify(state.theme)) { if (next) apply(next); else off(); }
    }).catch(function () { });
  }
  function publishSharedTheme(key, theme) {
    return fetch(themeEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({
        agencyKey: CFG.agencyKey,
        locationId: key,
        theme: theme
      }, saveProof()))
    }).then(readThemeResponse);
  }

  function save() {
    var key = routeKey();
    if (blocksAgencyWrite()) {
      status("This sub-account's location id wasn't found, so this theme was not saved onto the agency.", "err");
      return;
    }
    var btn = q('[data-act="save"]');
    btn.disabled = true;
    saveBusy = true;
    discoverUser().then(function () { return refreshSaveGrant(); }).then(function () {
    var previousLogo = themeOwnedLogo(key);
    var clearOwnLogo = !!(draftInherit && key !== "agency" && !(draft && safeUrl(draft.logoUrl)));
    if (clearOwnLogo) {
      writeLogoSlot(key, "");
      draft.logoUrl = "";
    }
    var logo = clearOwnLogo ? "" : ownedDraftLogo(key);
    var t = draftInherit ? { inheritAgency: true } : (draftDefault ? { ghlDefault: true } : clean(draft, DEFAULT));
    if (!draftDefault && !draftInherit) {
      t.logoUrl = "";
      if (logo !== previousLogo) writeLogoSlot(key, logo);
    }
    function restoreClearedLogo() {
      if (!clearOwnLogo) return;
      writeLogoSlot(key, previousLogo);
      if (draft) draft.logoUrl = previousLogo || "";
      var back = withDisplayLogo(resolve(key), key);
      if (back) apply(back); else off();
      render();
    }
    var done = function (msg) {
      saved = draftDefault || draftInherit ? null : t;
      lsSet(key, draftDefault ? null : t);
      if (HAS_SB || state.shared) state.remote[key] = draftDefault ? false : t;
      var view = withDisplayLogo(resolve(key), key);
      if (view) apply(view); else off();
      if (clearOwnLogo) {
        btn.disabled = false; saveBusy = false; setDirty(false); render(); status(msg, "ok");
        publishSharedLogo("", true).then(function () {
          status(msg, "ok");
        }).catch(function () {
          restoreClearedLogo();
          status(msg + " The sub-account logo could not be cleared.", "err");
        });
        return;
      }
      btn.disabled = false; saveBusy = false; setDirty(false); status(msg, "ok");
      if (draftDefault || draftInherit || logo === previousLogo) return;
      publishSharedLogo(logo, true).then(function () {
        status(msg, "ok");
      }).catch(function () {
        status(msg + " The shared logo link could not be updated. You can try Save theme again.", "err");
      });
    };
    if (sharedThemesOn()) {
      publishSharedTheme(key, t).then(function () {
        state.shared = true;
        state.remote[key] = t;
        done(draftInherit
          ? (key === "agency" ? "Reset. This view follows Design branding again." : "Reset. This sub-account follows agency branding again, including later Design changes.")
          : draftDefault
          ? (key === "agency" ? "Saved. Sub-accounts without their own theme now use the standard look." : "Saved. This sub-account now uses the standard look for everyone.")
          : (key === "agency" ? "Saved. Sub-accounts without their own theme now use this one." : "Saved. Everyone on this sub-account sees this theme, on any device."));
      }).catch(function (err) {
        var offline = !err || (!err.server && (err.status === 404 || /failed to fetch|networkerror|load failed|network request failed/i.test(String(err.message || ""))));
        if (offline) {
          done("Saved in this browser only. Shared themes aren't available until location-theme is deployed.");
          return;
        }
        restoreClearedLogo();
        btn.disabled = false;
        saveBusy = false;
        status("Couldn't save for everyone: " + err.message + ". Your changes are still showing in this browser.", "err");
      });
      return;
    }
    if (!HAS_SB) {
      done(CFG.brandingVersion ? "Saved in this browser only. Refresh HighLevel so this page can share the theme, then save again." : q('[data-act="copy"]').hidden
        ? "Saved in this browser only. Ask your agency to turn on shared saving so everyone in this account sees it."
        : "Saved in this browser only. Copy the theme code into the agency Custom JS so everyone sees it.");
      return;
    }
    remoteSave(key, t).then(function () {
      done(draftDefault
        ? (key === "agency" ? "Saved. Accounts without their own theme now use GHL's standard look." : "Saved. This account now uses GHL's standard look.")
        : (key === "agency" ? "Saved. Accounts without their own theme now use this one." : "Saved. Everyone in this account now sees this theme."));
    }).catch(function (err) {
      restoreClearedLogo();
      btn.disabled = false;
      saveBusy = false;
      status("Couldn't save: " + err.message + ". Your changes are still showing, so you can try again.", "err");
    });
    }).catch(function () {
      btn.disabled = false;
      saveBusy = false;
      status("Couldn't save for everyone. Your changes are still showing in this browser.", "err");
    });
  }

  function openBuilder() {
    if (!canEdit()) return;
    if (!ui) buildUi();
    saved = state.theme;
    var raw = (HAS_SB || state.shared) && state.remote[routeKey()] !== undefined ? state.remote[routeKey()] : lsGet(routeKey());
    draftInherit = isInherit(raw);
    draftDefault = !saved && !draftInherit;
    draft = clean(draftInherit ? (CFG.agencyTheme || saved || PRESETS[0]) : (saved || PRESETS[0]), DEFAULT);
    draft.logoUrl = themeOwnedLogo(routeKey());
    state.editing = true;
    render();
    setDirty(false);
    status(saved ? "" : "Using GHL's standard look. Pick a preset or change any setting to start a custom theme.");
    q('[data-act="copy"]').hidden = !!CFG.brandingVersion || !(user().type === "agency" || routeKey() === "agency");
    ui.classList.add("open");
    setTimeout(function () { var f = q(".sai-preset"); if (f) f.focus(); }, 60);
  }
  function closeBuilder() {
    if (!ui) return;
    ui.classList.remove("open");
    state.editing = false;
    if (dirty) { if (saved) apply(saved); else off(); }
    dirty = false;
  }

  /* ---------------- Routing ---------------- */
  function onRoute() {
    var key = routeKey();
    var quiet = quietPage();
    var settings = settingsRoute();
    if (key === state.key && quiet === state.quiet && settings === state.settings) return;
    var keyChanged = key !== state.key;
    state.quiet = quiet;
    state.settings = settings;
    document.documentElement.classList.toggle("sai-quiet-page", quiet || heavyPage());
    if (!keyChanged) { setObservers(); decorate(); return; }
    state.key = key;
    if (ui && ui.classList.contains("open")) closeBuilder();
    if (!allowed(key)) { off(); setObservers(); return; }
    sharedLogoUrl = readSharedMark(key);
    var t = withDisplayLogo(resolve(key), key);
    if (t) apply(t); else off();
    pullSharedLogo(key);
    if (sharedThemesOn()) pullSharedTheme(key);
    setObservers();
    if (!HAS_SB || sharedThemesOn()) return;
    remoteLoad(key === "agency" ? ["agency"] : [key, "agency"]).then(function (m) {
      var agencyUrl = agencyBlobLogo(m.agency);
      Object.keys(m).forEach(function (k) {
        var theme = m[k] || null;
        keepLocationBlobLogo(k, theme, agencyUrl);
        if (theme) theme = withoutStoredLogo(theme);
        state.remote[k] = theme || false;
        lsSet(k, theme);
      });
      if (state.key !== key || state.editing) return;
      var t2 = withDisplayLogo(resolve(key), key);
      if (JSON.stringify(t2) !== JSON.stringify(state.theme)) { if (t2) apply(t2); else off(); }
    }).catch(function (err) { console.warn("[Theme] Could not load saved theme:", err.message); });
  }

  var timer = null;
  function schedule() {
    if (timer) return;
    timer = setTimeout(function () {
      timer = null;
      if (routeKey() !== state.key || quietPage() !== state.quiet || settingsRoute() !== state.settings) onRoute(); else decorate();
    }, quietPage() ? 400 : 200);
  }

  var bodyObserver = null, sidebarObserver = null, observedSidebar = null, headerObserver = null, observedHeader = null, quietTimer = null, placing = false;
  function watchHeader() {
    var header = document.querySelector(".hl_header, .topmenu-nav");
    if (!header || header === observedHeader) return;
    if (headerObserver) headerObserver.disconnect();
    observedHeader = header;
    headerObserver = new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        if (mutationHitsHeader(list[i])) { placeTrigger(); return; }
      }
    });
    headerObserver.observe(header, { childList: true, subtree: true });
  }
  function oursNode(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.closest && (n.closest(".sai-tb") || n.closest(".sai-tb-trigger"))) return true;
    return /(^|\s)sai-/.test(n.getAttribute("class") || "");
  }
  function mutationHitsHeader(m) {
    var groups = [m.addedNodes, m.removedNodes];
    for (var g = 0; g < groups.length; g++) {
      var nodes = groups[g] || [];
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j].nodeType === 1 ? nodes[j] : null;
        if (!el || oursNode(el)) continue;
        if (el.id === "support-widget-launcher-host") return true;
        if (el.matches && el.matches(".hl_header, .hl_header--controls, .topmenu-nav, button, a, img")) return true;
        if (el.closest && el.closest(".hl_header, .topmenu-nav")) return true;
        if (el.querySelector && el.querySelector("#support-widget-launcher-host, .hl_header--controls, button, a")) return true;
      }
    }
    return false;
  }
  function mutationHitsSidebar(m) {
    var sb = sidebar();
    if (!sb) return false;
    if (m.type === "attributes") return !oursNode(m.target) && sb.contains(m.target);
    var nodes = Array.prototype.slice.call(m.addedNodes).concat(Array.prototype.slice.call(m.removedNodes));
    for (var j = 0; j < nodes.length; j++) {
      var el = nodes[j].nodeType === 1 ? nodes[j] : nodes[j].parentElement;
      if (!el || oursNode(el)) continue;
      if (el === sb || sb.contains(el)) return true;
    }
    return false;
  }
  function addedSidebar(list) {
    for (var i = 0; i < list.length; i++) {
      var nodes = list[i].addedNodes;
      for (var j = 0; j < nodes.length; j++) {
        var n = nodes[j];
        if (!n || n.nodeType !== 1) continue;
        if (n.matches && SB.charAt(0) === "#" && n.matches(SB)) return n;
        if (n.querySelector) {
          var inner = n.querySelector(SB);
          if (inner) return inner;
        }
      }
    }
    return null;
  }
  function watchSidebar(sb) {
    if (!sb || sb === observedSidebar) return;
    if (sidebarObserver) sidebarObserver.disconnect();
    observedSidebar = sb;
    sidebarObserver = new MutationObserver(function (list) {
      noteSidebar();
      // Settings is a heavy page. Strip icons here and do not schedule decorate,
      // or a menu redraw puts Billing, Calendars, and Opportunities icons back.
      if (settingsRoute()) { releaseSettingsIcons(); return; }
      if (quietPage() || heavyPage()) return;
      stats.mutations += list.length;
      for (var i = 0; i < list.length; i++) {
        if (mutationHitsSidebar(list[i])) { stats.sidebarMutations++; schedule(); return; }
      }
    });
    sidebarObserver.observe(sb, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  function setObservers() {
    watchHeader();
    var sb = sidebar();
    if (quietTimer) { clearInterval(quietTimer); quietTimer = null; }
    var heavy = quietPage() || heavyPage();
    if (heavy) {
      if (bodyObserver) { bodyObserver.disconnect(); bodyObserver = null; }
      if (sidebarObserver) { sidebarObserver.disconnect(); sidebarObserver = null; observedSidebar = null; }
      if (!document.querySelector(".sai-tb-trigger")) noteSidebar();
      if (settingsRoute()) {
        releaseSettingsIcons();
        watchSidebar(sidebar());
      }
      quietTimer = setInterval(function () {
        if (!(quietPage() || heavyPage())) { setObservers(); return; }
        if (settingsRoute()) releaseSettingsIcons();
        watchHeader();
        var ex = document.querySelector(".sai-tb-trigger");
        if (!ex) noteSidebar();
        else if (ex.classList.contains("sai-tb-header")) placeTrigger();
      }, 1500);
      return;
    }
    if (!bodyObserver && document.body) {
      bodyObserver = new MutationObserver(function (list) {
        var hit = addedSidebar(list);
        var heavy = quietPage() || heavyPage();
        if (heavy) {
          if (!hit) return;
          if (hit !== observedSidebar) watchSidebar(hit);
          noteSidebar();
          return;
        }
        stats.mutations += list.length;
        var found = hit || sidebar();
        if (found && found !== observedSidebar) watchSidebar(found);
        if (!document.querySelector(".sai-tb-trigger")) noteSidebar();
        for (var i = 0; i < list.length; i++) {
          if (mutationHitsSidebar(list[i]) || mutationHitsHeader(list[i])) { stats.sidebarMutations++; schedule(); return; }
        }
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });
    }
    if (sb) watchSidebar(sb);
    else noteSidebar();
  }

  var contrastTimer = null;
  function scheduleContrast() {
    if (contrastTimer) return;
    contrastTimer = setTimeout(function () { contrastTimer = null; paintTrigger(); }, 120);
  }

  function init() {
    injectCss();
    document.documentElement.classList.toggle("sai-tb-min", isMin());
    noteSidebar();
    onRoute();
    setObservers();
    if (!history.__saiThemePatched) {
      history.__saiThemePatched = true;
      ["pushState", "replaceState"].forEach(function (m) {
        var orig = history[m];
        history[m] = function () { var r = orig.apply(this, arguments); setTimeout(onRoute, 0); return r; };
      });
    }
    huntUser();
    window.addEventListener("resize", function () { placeTrigger(); paintTrigger(); });
    window.addEventListener("scroll", function () {
      var btn = document.querySelector(".sai-tb-trigger.sai-tb-header");
      if (btn) placeTrigger();
    }, true);
    window.addEventListener("popstate", function () { setTimeout(onRoute, 0); });
    ["routeLoaded", "routeChangeEvent"].forEach(function (ev) { window.addEventListener(ev, function () { setTimeout(onRoute, 0); }); });
    new MutationObserver(scheduleContrast).observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "data-color-mode", "data-mode"] });
    if (document.body) new MutationObserver(scheduleContrast).observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme", "data-color-mode", "data-mode"] });
  }

  if (DEFER_TO_LEGACY) {
    var repairTimer = null;
    function repairLegacy() {
      normalizeIcons();
      paintTrigger();
    }
    function scheduleRepair() {
      if (repairTimer) return;
      repairTimer = setTimeout(function () { repairTimer = null; repairLegacy(); }, 60);
    }
    if (document.body) {
      repairLegacy();
      new MutationObserver(scheduleRepair).observe(document.body, { childList: true, subtree: true });
    } else document.addEventListener("DOMContentLoaded", function () {
      repairLegacy();
      if (document.body) new MutationObserver(scheduleRepair).observe(document.body, { childList: true, subtree: true });
    });
    return;
  }

  window.SAITheme = {
    __build: "theme-builder",
    configure: function (config) {
      var prevId = agencyIdFromKey(CFG.agencyKey);
      var nextId = config && config.agencyKey ? agencyIdFromKey(config.agencyKey) : prevId;
      var suppliedToken = !!(config && Object.prototype.hasOwnProperty.call(config, "saveToken"));
      if (ui && ui.classList.contains("open")) closeBuilder();
      CFG = Object.assign({}, CFG, config);
      IS_SWITCHYARD = CFG.brandingVersion === "switchyard";
      COLOR_FIELDS = IS_SWITCHYARD ? SWITCHYARD_COLOR_FIELDS : LEGACY_COLOR_FIELDS;
      SEL = CFG.selectors || {};
      SB = IS_SWITCHYARD ? "#switchyard-primary-navigation" : (SEL.sidebar === "#switchyard-primary-navigation" ? "#sidebar-v2" : SEL.sidebar || "#sidebar-v2");
      SBX = SB.charAt(0) === "#" && !/[\s,.\[:>]/.test(SB) ? SB + SB : SB;
      NAV_LINKS = IS_SWITCHYARD ? ".switchyard-nav-item,.switchyard-group-toggle,.switchyard-directory-row" : "nav a, a[id^='sb_']";
      ACTIVE = IS_SWITCHYARD ? '.is-active,.is-current,[aria-current="page"],[aria-expanded="true"]' : '.active,.exact-active,.router-link-exact-active,[aria-current="page"]';
      var previousUI = document.querySelector(".sai-tb");
      if (previousUI) previousUI.remove();
      ui = null;
      document.querySelectorAll(".sai-tb-trigger").forEach(function(e){e.remove();});
      injectCss();
      if (prevId !== nextId && !suppliedToken) CFG.saveToken = "";
      var grant = grantState(CFG.saveToken, CFG.agencyKey);
      if (grant === "foreign" || grant === "stale") CFG.saveToken = "";
      if (config && config.accessExplicit) CFG.accessExplicit = true;
      settleAccess();
      if (!user().id) huntUser();
      LS = "sai_theme_v1:" + (CFG.brandingVersion ? CFG.agencyKey + ":" + CFG.brandingVersion + ":" + JSON.stringify(CFG.agencyTheme || {}) + ":" : "");
      PRESET_LS = "sai_theme_presets:" + String(CFG.agencyKey || "agency") + ":";
      state.key = null; state.quiet = null; onRoute();
    },
    open: function () { openBuilder(); },
    close: function () { closeBuilder(); },
    presets: PRESETS,
    current: function () { return state.theme; },
    debug: function () {
      var rows = navLinks().map(function (a) {
        return { id: a.id, label: rawLabel(a), key: keyFor(a), active: a.matches(ACTIVE), hasIcon: !!a.querySelector("img, svg, i") };
      });
      if (console.table) console.table(rows);
      console.log("[Theme] sidebar:", sidebar(), "\nlogo:", findLogo(), "\nswitcher:", document.querySelector(SWITCHER),
        "\nroute key:", routeKey(), "\nallowed:", allowed(routeKey()), "\nuser:", user(), "\ncan edit:", canEdit(), "\nsaving to:", sharedThemesOn() ? "shared location theme" : (HAS_SB ? "Supabase" : "this browser"));
      return rows;
    },
    stats: function () {
      return {
        mutations: stats.mutations,
        sidebarMutations: stats.sidebarMutations,
        decorates: stats.decorates,
        scans: stats.scans,
        canEdit: canEdit(),
        route: routeKey(),
        access: CFG.builderAccess,
        user: user(),
        quiet: quietPage()
      };
    }
  };

  if (document.body) init(); else document.addEventListener("DOMContentLoaded", init);
})();