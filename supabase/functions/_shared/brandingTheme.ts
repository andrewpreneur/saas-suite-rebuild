import { THEME_GRANT_REFRESH_MARGIN_SECONDS, themeSaveTokenForScript } from "./themeSaveAuth.ts";
import { cleanSwitchyardColors, type SwitchyardColors } from "./switchyardTheme.ts";

export type BrandingVersion = "v1" | "v2" | "v3" | "switchyard";
export interface BrandingThemeOptions {
  version: BrandingVersion;
  motion: boolean;
  iconPack: string;
  font: string;
  sidebarBg: string;
  accent: string;
  customizerEnabled?: boolean;
  switchyard?: SwitchyardColors;
}
export function brandingThemeMarker(options: BrandingThemeOptions): string {
  return `/* SS-THEME:${JSON.stringify(options)} */`;
}
export function readBrandingTheme(css: string): BrandingThemeOptions | null {
  const match = css.match(/\/\* SS-THEME:(\{[^\n]*\}) \*\//);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]);
    if (!["v1", "v2", "v3", "switchyard"].includes(value.version)) return null;
    if (!/^#[0-9a-f]{6}$/i.test(value.sidebarBg) || !/^#[0-9a-f]{6}$/i.test(value.accent)) return null;
    return { ...value, ...(value.version === "switchyard" ? { switchyard: cleanSwitchyardColors(value.switchyard), customizerEnabled: value.customizerEnabled !== false } : {}), font: String(value.font).replace(/[^a-zA-Z0-9 -]/g, "").slice(0, 60),
      iconPack: ["default", "lucide", "phosphor", "tabler", "phosphor-duotone"].includes(value.iconPack) ? value.iconPack : "default", motion: value.motion === true };
  } catch { return null; }
}
/** First statement of dynamic-styles JS. Reads the install tag before anything else runs. */
export function themeUserCaptureJS(): string {
  return `window.__SS_THEME_USER=(function(){var me=document.currentScript;if(!me||!me.getAttribute){var list=document.getElementsByTagName("script");for(var i=list.length-1;i>=0;i--){var s=list[i];if(s.src&&s.src.indexOf("dynamic-styles")>-1){me=s;break;}}}function at(n){if(!me||!me.getAttribute)return "";var v=me.getAttribute(n)||"";return v.indexOf("{{")>-1?"":String(v).trim();}return {type:at("data-user-type"),role:at("data-user-role"),email:at("data-user-email"),name:at("data-user-name"),id:at("data-user-id"),companyId:at("data-company-id")};})();`;
}

function channel(hex: string, index: number): number {
  const value = parseInt(hex.substr(index, 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}
function relLum(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}
function contrast(a: string, b: string): number {
  const left = relLum(a);
  const right = relLum(b);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}
export function accentInk(accent: string): string {
  return contrast(accent, "#FFFFFF") >= contrast(accent, "#111827") ? "#FFFFFF" : "#111827";
}

/** Bumped when theme-builder.js or the injected theme config changes so dynamic-styles will not keep an older runtime. */
export const THEME_RUNTIME_REV = "20261112-switchyard";

const EMBEDDED_GRANT = /"saveToken":"([A-Za-z0-9_-]{10,400}\.[A-Za-z0-9_-]{10,200})"/;

export function embeddedThemeGrantExpiry(js: string): number | null {
  const match = String(js || "").match(EMBEDDED_GRANT);
  if (!match) return null;
  try {
    const body = match[1].slice(0, match[1].indexOf("."));
    const pad = body.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((body.length + 3) % 4);
    const claims = JSON.parse(atob(pad)) as { exp?: unknown };
    return typeof claims.exp === "number" && Number.isFinite(claims.exp) ? claims.exp : null;
  } catch {
    return null;
  }
}

// A theme runtime with no grant, or a grant inside the refresh margin, must be
// rebuilt before it is served. Other cached scripts stay on the normal path.
export function cachedThemeScriptNeedsFreshGrant(js: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (!String(js || "").includes("theme-builder.js?v=")) return false;
  const exp = embeddedThemeGrantExpiry(js);
  if (exp == null) return true;
  return exp < nowSeconds + THEME_GRANT_REFRESH_MARGIN_SECONDS;
}

/** Lucide lightning bolt. Bare "zap" 404s in Phosphor and Tabler. */
export const KEYSTONE_LAUNCHPAD_ICON = "lucide:zap";

// HighLevel company LWQoHTpjYvZD7t9LEd1u (admin@digitalaspect.io).
// dynamic-styles is requested with the hub slug, which resolves to keystone or keystone-3.
const KEYSTONE_AGENCY_IDS = new Set([
  "keystone",
  "keystone-2",
  "keystone-3",
  "lwqohtpjyvzd7t9led1u",
  "lwqohtpjyvzd7t9led1u-2",
  "lwqohtpjyvzd7t9led1u-3",
]);

export function keystoneLaunchpadIcon(agencyId: string): string | null {
  const id = String(agencyId ?? "").trim().toLowerCase().replace(/^agency-/, "");
  return KEYSTONE_AGENCY_IDS.has(id) ? KEYSTONE_LAUNCHPAD_ICON : null;
}

export function buildBrandingThemeJS(css: string, agencyId: string, saveToken = ""): string {
  const options = readBrandingTheme(css);
  if (!options || options.customizerEnabled === false) return "";
  const token = themeSaveTokenForScript(saveToken);
  const launchpad = keystoneLaunchpadIcon(agencyId);
  const config = { brandingVersion: options.version, motion: options.motion, agencyKey: `agency-${agencyId}`,
    ...(options.version === "switchyard" ? { selectors: { sidebar: "#switchyard-primary-navigation", navLinks: ".switchyard-nav-item,.switchyard-group-toggle,.switchyard-directory-row", active: '.is-active,.is-current,[aria-current="page"],[aria-expanded="true"]' } } : {}),
    themeEndpoint: "https://auth.saassuite.ai/functions/v1/location-theme",
    ...(token ? { saveToken: token } : {}),
    agencyTheme: { ...options, sidebarBgEnd: options.sidebarBg, sidebarText: "auto", fontScope: "sidebar", appAccent: false, icons: launchpad ? { launchpad } : {}, logoUrl: "", logoHeight: 40, radius: 10, accentText: accentInk(options.accent), ...(options.version === "switchyard" ? cleanSwitchyardColors(options.switchyard) : {}) } };
  return `(function(){ var u = window.__SS_THEME_USER || {}; function field(v){ v = v == null ? "" : String(v); return v.indexOf("{{") > -1 ? "" : v.trim(); } var user = { type: field(u.type), role: field(u.role), email: field(u.email), name: field(u.name), id: field(u.id), companyId: field(u.companyId) }; var identified = !!(user.type || user.role || user.email || user.name || user.id); window.SAI_THEME_CONFIG = Object.assign({}, window.SAI_THEME_CONFIG || {}, ${JSON.stringify(config)}, { user: user, builderAccess: identified ? "admins" : "all" }); if (window.SAITheme) { if (window.SAITheme.configure) window.SAITheme.configure(window.SAI_THEME_CONFIG); return; } if (document.querySelector('script[data-ss-theme-runtime]')) return; var s = document.createElement('script'); s.src = 'https://saassuite.ai/theme-builder.js?v=${THEME_RUNTIME_REV}'; s.setAttribute('data-ss-theme-runtime','on'); s.setAttribute('data-gocsm','off'); s.onerror = function(){ s.remove(); }; document.head.appendChild(s); })();`;
}