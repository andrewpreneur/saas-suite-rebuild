export const SWITCHYARD_DEFAULTS = {
 sidebarBg: "#11171f", sidebarBgEnd: "#17202b", sidebarText: "#e8ecf1", accent: "#175993", accentText: "#ffffff", headerBg: "#11171f", railColor: "#0b0f14", iconColor: "#ffbe58", hoverColor: "#153f63", inputColor: "#17202b", mutedText: "#9aa3ad", outlineColor: "#ffffff",
};
export type SwitchyardColors = typeof SWITCHYARD_DEFAULTS;
export const SWITCHYARD_FIELDS: [keyof SwitchyardColors, string][] = [
 ["sidebarBg","Panel background"],["sidebarBgEnd","Panel background, bottom"],["railColor","Account rail"],["sidebarText","Navigation text"],["iconColor","Icons"],["accent","Selected highlight"],["hoverColor","Hover highlight"],["accentText","Text on highlight"],["headerBg","Top bar"],["inputColor","Search fields"],["mutedText","Secondary text"],["outlineColor","Hover outline"],
];
export function cleanSwitchyardColors(value: unknown): SwitchyardColors {
 const result = { ...SWITCHYARD_DEFAULTS };
 const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
 for (const key of Object.keys(result) as (keyof SwitchyardColors)[]) {
   if (typeof input[key] === "string" && /^#[0-9a-f]{6}$/i.test(input[key])) result[key] = input[key];
 }
 return result;
}
const TEMPLATE = `




#switchyard-primary-navigation,
.switchyard-flyout,
.switchyard-topbar {
  --gray-50: var(--ss-sw-hover) !important;
  --gray-100: var(--ss-sw-hover) !important;
  --bg-hover: var(--ss-sw-hover) !important;
  --bg-subtle: var(--ss-sw-panel) !important;
  --bg-selected: var(--ss-sw-blue) !important;
  --switchyard-surface: var(--ss-sw-panel) !important;
  --switchyard-rail-bg: var(--ss-sw-rail) !important;
  --switchyard-bg-hover: var(--ss-sw-hover) !important;
  --switchyard-bg-subtle: var(--ss-sw-panel) !important;
  --switchyard-bg-selected: var(--ss-sw-blue) !important;
  --switchyard-directory-bg: var(--ss-sw-panel) !important;
  --switchyard-directory-hover: var(--ss-sw-hover) !important;
  --switchyard-directory-active: var(--ss-sw-blue) !important;
  --switchyard-rail-current-bg: var(--ss-sw-blue) !important;
  --switchyard-rail-current-ring: var(--ss-sw-gold) !important;
  --switchyard-rail-disc: var(--ss-sw-raised) !important;
  --switchyard-rail-label: var(--ss-sw-text) !important;
  --switchyard-rail-label-current: var(--ss-sw-white) !important;
  --switchyard-rail-label-muted: var(--ss-sw-muted) !important;
  --switchyard-border-subtle: var(--ss-sw-line) !important;
  --switchyard-border-strong: var(--ss-sw-line) !important;
  --switchyard-text-primary: var(--ss-sw-text) !important;
  --switchyard-text-secondary: var(--ss-sw-text) !important;
  --switchyard-text-tertiary: var(--ss-sw-muted) !important;
  --switchyard-icon: var(--ss-sw-gold) !important;
  --switchyard-nav-icon: var(--ss-sw-gold) !important;
  --switchyard-nav-ink: var(--ss-sw-text) !important;
  --switchyard-nav-selected: var(--ss-sw-white) !important;
  --switchyard-key-fg: var(--ss-sw-text) !important;
  --switchyard-edit-nav-bg: var(--ss-sw-panel) !important;
  --switchyard-edit-nav-text: var(--ss-sw-white) !important;
  --switchyard-edit-nav-border: var(--ss-sw-line) !important;
  --switchyard-edit-nav-accent: var(--ss-sw-gold) !important;
  --switchyard-skeleton-bg: var(--ss-sw-raised) !important;
  --switchyard-badge-new-bg: transparent !important;
  --switchyard-badge-new-text: var(--ss-sw-gold) !important;
  --switchyard-badge-beta-bg: transparent !important;
  --switchyard-badge-beta-text: var(--ss-sw-gold) !important;
}


#switchyard-primary-navigation .hr-button,
.switchyard-flyout .hr-button,
.switchyard-topbar .hr-button {
  --n-color: transparent !important;
  --n-color-hover: var(--ss-sw-hover) !important;
  --n-color-pressed: var(--ss-sw-blue) !important;
  --n-color-focus: var(--ss-sw-hover) !important;
  --n-text-color: var(--ss-sw-text) !important;
  --n-text-color-hover: var(--ss-sw-white) !important;
  --n-text-color-pressed: var(--ss-sw-white) !important;
  --n-text-color-focus: var(--ss-sw-white) !important;
  --n-icon-color-static: var(--ss-sw-gold) !important;
  --n-ripple-color: transparent !important;
  --n-wave-opacity: 0 !important;
  --n-box-shadow: none !important;
  --n-outline-focus: none !important;
}


#switchyard-primary-navigation :is(.hr-base-wave, .hr-button__border, .hr-button__state-border),
.switchyard-flyout :is(.hr-base-wave, .hr-button__border, .hr-button__state-border),
.switchyard-topbar :is(.hr-base-wave, .hr-button__border, .hr-button__state-border) {
  display: none !important;
}
#switchyard-primary-navigation *,
.switchyard-flyout *,
.switchyard-topbar * {
  -webkit-backdrop-filter: none !important;
  backdrop-filter: none !important;
}


#switchyard-primary-navigation,
#switchyard-primary-navigation :is(
  .switchyard-sidebar, .switchyard-sidebar-face, .switchyard-sidebar-face-stage,
  .switchyard-workspace-header, .switchyard-navigation-region, .switchyard-navigation-stage,
  .switchyard-navigation-list, .switchyard-navigation-hover-scope, .switchyard-nav-footer-actions,
  .switchyard-accounts-directory, .switchyard-accounts-directory-head,
  .switchyard-accounts-directory-list, .switchyard-accounts-section
),
.switchyard-flyout,
.switchyard-flyout :is(.switchyard-flyout-header, .switchyard-flyout-list),
.switchyard-topbar,
.switchyard-topbar :is(.switchyard-breadcrumb, .switchyard-top-actions) {
  background: linear-gradient(180deg,var(--ss-sw-panel),var(--ss-sw-panel-end)) !important;
  color: var(--ss-sw-text) !important;
}

#switchyard-primary-navigation :is(
  .switchyard-account-rail, .switchyard-account-rail-slot, .switchyard-accounts-fill.is-compact,
  .switchyard-accounts-directory.is-compact, .switchyard-accounts-directory-head.is-compact
) {
  background: var(--ss-sw-rail) !important;
}
#switchyard-primary-navigation .switchyard-account-rail {
  border-right: 1px solid var(--ss-sw-line) !important;
}
.switchyard-flyout {
  border-right: 1px solid var(--ss-sw-line) !important;
  box-shadow: 8px 0 24px rgba(0,0,0,.4) !important;
}
.switchyard-flyout .switchyard-flyout-header,
.switchyard-topbar {
  border-bottom: 1px solid var(--ss-sw-line) !important;
}
.switchyard-flyout .switchyard-flyout-inline-children {
  margin-left: 14px !important;
  border-left: 1px solid var(--ss-sw-line) !important;
}


#switchyard-primary-navigation :is(
  .hr-text, .switchyard-nav-label, .switchyard-recent-label, .switchyard-directory-name,
  .switchyard-directory-create-label, .switchyard-workspace-label
),
.switchyard-flyout :is(.hr-text, .switchyard-flyout-title, strong),
.switchyard-topbar :is(.hr-text, .switchyard-breadcrumb-label-text) {
  color: var(--ss-sw-text) !important;
}
#switchyard-primary-navigation :is(.switchyard-directory-agency-name, .switchyard-workspace-label),
.switchyard-flyout h2 {
  color: var(--ss-sw-white) !important;
  font-weight: 700 !important;
}
#switchyard-primary-navigation :is([data-switchyard-recent-heading], .switchyard-recent-view-all-label) {
  color: var(--ss-sw-muted) !important;
}


#switchyard-primary-navigation :is(
  .switchyard-managed-row, .switchyard-nav-group, .switchyard-group-action-host,
  .switchyard-group-disclosure-host, .switchyard-recent, .switchyard-recent-items
) {
  background: transparent !important;
}
#switchyard-primary-navigation :is(
  .switchyard-nav-item, .switchyard-group-toggle, .switchyard-nav-group.is-actionable,
  .switchyard-recent-item, .switchyard-directory-row, .switchyard-directory-agency-row,
  .switchyard-directory-create
),
.switchyard-flyout .switchyard-flyout-row {
  border-radius: var(--ss-sw-radius) !important;
  transition: background-color .15s ease, box-shadow .15s ease;
}


html body #switchyard-primary-navigation :is(
  .switchyard-nav-item:not(.switchyard-group-action),
  .switchyard-group-toggle,
  .switchyard-nav-group.is-actionable,
  .switchyard-recent-item,
  .switchyard-directory-row,
  button.switchyard-directory-agency-row,
  .switchyard-directory-create
):hover,
html body .switchyard-flyout .switchyard-flyout-row:hover,
html body .switchyard-topbar .hr-button:hover {
  background: var(--ss-sw-hover) !important;
  background-color: var(--ss-sw-hover) !important;
  background-image: none !important;
  filter: none !important;
  mix-blend-mode: normal !important;
  opacity: 1 !important;
  box-shadow: inset 0 0 0 1px var(--ss-sw-ring) !important;
}

html body #switchyard-primary-navigation :is(
  .switchyard-nav-item:not(.switchyard-group-action),
  .switchyard-group-toggle, .switchyard-nav-group.is-actionable, .switchyard-recent-item,
  .switchyard-directory-row, button.switchyard-directory-agency-row, .switchyard-directory-create
):hover :is(.hr-text, .switchyard-nav-label, .switchyard-recent-label, .switchyard-directory-name,
  .switchyard-directory-agency-name, .switchyard-directory-create-label),
html body .switchyard-flyout .switchyard-flyout-row:hover :is(.hr-text, strong, .switchyard-flyout-title),
html body .switchyard-topbar .hr-button:hover :is(.hr-text, .switchyard-breadcrumb-label-text) {
  color: var(--ss-sw-white) !important;
}

#switchyard-primary-navigation :is(.switchyard-nav-item, .switchyard-group-toggle, .switchyard-recent-item, .switchyard-directory-row)::before,
#switchyard-primary-navigation :is(.switchyard-nav-item, .switchyard-group-toggle, .switchyard-recent-item, .switchyard-directory-row)::after,
.switchyard-flyout .switchyard-flyout-row::before,
.switchyard-flyout .switchyard-flyout-row::after {
  background: transparent !important;
  background-image: none !important;
  opacity: 0 !important;
}


html body #switchyard-primary-navigation :is(
  .switchyard-nav-item[aria-current="page"],
  .switchyard-nav-item.is-active,
  .switchyard-group-toggle[aria-expanded="true"],
  .switchyard-nav-group.is-visually-active > .switchyard-group-toggle,
  .switchyard-nav-group.is-actionable:has(.switchyard-group-disclosure[aria-expanded="true"]),
  .switchyard-directory-row.is-active,
  .switchyard-directory-row.is-current,
  .switchyard-directory-agency-row.is-current
),
html body .switchyard-flyout .switchyard-flyout-row:has([aria-current="page"]),
html body .switchyard-flyout .switchyard-flyout-row:has(.router-link-active) {
  background: var(--ss-sw-blue) !important;
  background-color: var(--ss-sw-blue) !important;
  background-image: none !important;
  box-shadow: none !important;
}
html body #switchyard-primary-navigation :is(
  .switchyard-nav-item[aria-current="page"], .switchyard-nav-item.is-active,
  .switchyard-group-toggle[aria-expanded="true"],
  .switchyard-nav-group.is-visually-active > .switchyard-group-toggle,
  .switchyard-nav-group.is-actionable:has(.switchyard-group-disclosure[aria-expanded="true"]),
  .switchyard-directory-row.is-active, .switchyard-directory-row.is-current,
  .switchyard-directory-agency-row.is-current
) :is(.hr-text, .switchyard-nav-label, .switchyard-directory-name, .switchyard-directory-agency-name) {
  color: var(--ss-sw-white) !important;
  font-weight: 600 !important;
}

html body #switchyard-primary-navigation :is(
  .switchyard-nav-item[aria-current="page"], .switchyard-group-toggle[aria-expanded="true"],
  .switchyard-directory-row.is-active, .switchyard-directory-row.is-current
):hover {
  background: var(--ss-sw-blue) !important;
  box-shadow: inset 0 0 0 1px var(--ss-sw-ring) !important;
}


html body #switchyard-primary-navigation :is(
  .switchyard-group-action, .switchyard-group-disclosure, .switchyard-recent-activate,
  .switchyard-recent-pin, .switchyard-directory-select, .switchyard-directory-pin,
  .switchyard-directory-close
),
html body #switchyard-primary-navigation :is(
  .switchyard-group-action, .switchyard-group-disclosure, .switchyard-recent-activate,
  .switchyard-recent-pin, .switchyard-directory-select, .switchyard-directory-pin,
  .switchyard-directory-close
):is(:hover, :focus, :focus-visible, [aria-expanded="true"]),
html body .switchyard-flyout :is(
  .switchyard-flyout-item, .switchyard-flyout-page-disclosure,
  .switchyard-flyout-pin, .switchyard-item-menu-trigger
),
html body .switchyard-flyout :is(
  .switchyard-flyout-item, .switchyard-flyout-page-disclosure,
  .switchyard-flyout-pin, .switchyard-item-menu-trigger
):is(:hover, :focus-visible) {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
  --n-color: transparent !important;
  --n-color-hover: transparent !important;
  --n-color-pressed: transparent !important;
  --n-color-focus: transparent !important;
}


#switchyard-primary-navigation :is(.switchyard-icon, svg),
.switchyard-flyout :is(.switchyard-icon, svg),
.switchyard-topbar :is(.switchyard-icon, svg),
.switchyard-topbar .switchyard-breadcrumb-caret path {
  color: var(--ss-sw-gold) !important;
  stroke: var(--ss-sw-gold) !important;
}
.switchyard-topbar .switchyard-breadcrumb-caret path { fill: var(--ss-sw-gold) !important; }
.switchyard-topbar :is(.switchyard-breadcrumb-separator, .switchyard-breadcrumb-separator svg) {
  color: var(--ss-sw-muted) !important;
  stroke: var(--ss-sw-muted) !important;
}


#switchyard-primary-navigation .switchyard-sidebar-collapse {
  background: transparent !important;
  border: none !important;
  border-radius: var(--ss-sw-radius) !important;
}
#switchyard-primary-navigation .switchyard-sidebar-collapse:hover {
  background: var(--ss-sw-hover) !important;
  box-shadow: inset 0 0 0 1px var(--ss-sw-ring) !important;
}
#switchyard-primary-navigation .switchyard-accounts-directory-search {
  background: var(--ss-sw-raised) !important;
  border: 1px solid var(--ss-sw-line) !important;
  border-radius: 10px !important;
}
#switchyard-primary-navigation .switchyard-accounts-directory-search:focus-within {
  border-color: var(--ss-sw-gold) !important;
  box-shadow: 0 0 0 2px color-mix(in srgb,var(--ss-sw-gold) 25%,transparent) !important;
}
#switchyard-primary-navigation .switchyard-directory-search-input {
  background: transparent !important;
  color: var(--ss-sw-text) !important;
  border: none !important;
  outline: none !important;
}
#switchyard-primary-navigation .switchyard-directory-search-input::placeholder {
  color: var(--ss-sw-muted) !important;
}


.switchyard-flyout h2,
.switchyard-flyout [data-switchyard-flyout-title] { color: var(--ss-sw-white) !important; }
.switchyard-flyout .switchyard-flyout-close {
  background: transparent !important;
  border: 1px solid var(--ss-sw-gold) !important;
  border-radius: var(--ss-sw-radius) !important;
}


.switchyard-topbar .switchyard-breadcrumb-label,
.switchyard-topbar .switchyard-breadcrumb-label:hover,
.switchyard-topbar .switchyard-breadcrumb-label:focus-visible,
.switchyard-topbar button[aria-label*="Ask AI"],
.switchyard-topbar button[aria-label*="Ask AI"]:hover {
  border-radius: 50px !important;   
}
.switchyard-topbar .switchyard-breadcrumb-label.is-current {
  background: transparent !important;
  box-shadow: none !important;
}
.switchyard-topbar .switchyard-breadcrumb-label.is-current .switchyard-breadcrumb-label-text {
  color: var(--ss-sw-white) !important;
  font-weight: 600 !important;
}
.switchyard-topbar .switchyard-top-divider { background: var(--ss-sw-line) !important; }
.switchyard-topbar .switchyard-top-search {
  background: var(--ss-sw-raised) !important;
  border: 1px solid var(--ss-sw-line) !important;
  border-radius: 10px !important;
}
.switchyard-topbar kbd {
  background: linear-gradient(180deg,var(--ss-sw-panel),var(--ss-sw-panel-end)) !important;
  color: var(--ss-sw-text) !important;
  border: 1px solid var(--ss-sw-line) !important;
  border-radius: 6px !important;
}
.switchyard-topbar .switchyard-user-avatar-image {
  box-shadow: 0 0 0 2px color-mix(in srgb,var(--ss-sw-gold) 55%,transparent) !important;
}


html body #switchyard-primary-navigation .switchyard-nav-action-pill {
  background: var(--ss-sw-rail) !important;
  color: var(--ss-sw-gold) !important;
  border: 1px solid var(--ss-sw-gold) !important;
  border-radius: 50px !important;
  font-weight: 600 !important;
  box-shadow: none !important;
  transition: background-color .2s ease, color .2s ease, transform .2s ease, box-shadow .2s ease;
}
html body #switchyard-primary-navigation .switchyard-nav-action-pill:hover {
  background: var(--ss-sw-gold) !important;
  color: var(--ss-sw-rail) !important;
  border-radius: 50px !important;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb,var(--ss-sw-gold) 30%,transparent) !important;
}
html body #switchyard-primary-navigation .switchyard-nav-action-pill :is(*, svg) {
  color: inherit !important;
  stroke: currentColor !important;
  background: transparent !important;
}


[class*="switchyard"][class*="badge"][class*="new"],
[class*="switchyard"][class*="badge"][class*="beta"] {
  background: transparent !important;
  color: var(--ss-sw-gold) !important;
  border: 1px solid var(--ss-sw-gold) !important;
  border-radius: 50px !important;
  padding: 1px 8px !important;
  font-weight: 600 !important;
}


.switchyard-accounts-fill-backdrop,
.switchyard-accounts-fill-backdrop:hover,
.switchyard-accounts-fill-backdrop:focus,
.switchyard-accounts-fill-backdrop:focus-visible {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  outline: none !important;
}


#switchyard-primary-navigation *,
.switchyard-flyout * {
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,.2) transparent;
}
#switchyard-primary-navigation :is(a, button):focus-visible,
.switchyard-flyout :is(a, button):focus-visible,
.switchyard-topbar button:focus-visible {
  outline: 2px solid var(--ss-sw-gold) !important;
  outline-offset: 2px;
}



html body [role="menu"] {
  background: linear-gradient(180deg,var(--ss-sw-panel),var(--ss-sw-panel-end)) !important;
  color: var(--ss-sw-text) !important;
  border: 1px solid var(--ss-sw-line) !important;
  border-radius: 10px !important;
  box-shadow: 0 12px 32px rgba(0,0,0,.55) !important;
}


html body [role="menu"] [role="menuitem"] {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  border-radius: var(--ss-sw-radius) !important;
  box-shadow: none !important;
  opacity: 1 !important;
}
html body [role="menu"] [role="menuitem"] *:not(svg):not(path) {
  color: var(--ss-sw-text) !important;
  opacity: 1 !important;
}


html body [role="menu"] [role="menuitem"]:hover,
html body [role="menu"] [role="menuitem"]:focus,
html body [role="menu"] [role="menuitem"]:focus-visible,
html body [role="menu"] [role="menuitem"][aria-expanded="true"],
html body [role="menu"] [role="menuitem"][data-highlighted],
html body [role="menu"] [role="menuitem"][data-state="open"] {
  background: var(--ss-sw-hover) !important;
  background-color: var(--ss-sw-hover) !important;
  background-image: none !important;
  box-shadow: inset 0 0 0 1px var(--ss-sw-ring) !important;
  outline: none !important;
}
html body [role="menu"] [role="menuitem"]:hover *:not(svg):not(path),
html body [role="menu"] [role="menuitem"]:focus *:not(svg):not(path),
html body [role="menu"] [role="menuitem"]:focus-visible *:not(svg):not(path),
html body [role="menu"] [role="menuitem"][aria-expanded="true"] *:not(svg):not(path),
html body [role="menu"] [role="menuitem"][data-highlighted] *:not(svg):not(path),
html body [role="menu"] [role="menuitem"][data-state="open"] *:not(svg):not(path) {
  color: var(--ss-sw-white) !important;
}


html body [role="menu"] [role="menuitem"][aria-current],
html body [role="menu"] [role="menuitem"][aria-checked="true"] {
  background: var(--ss-sw-blue) !important;
}
html body [role="menu"] [role="menuitem"][aria-current] *:not(svg):not(path),
html body [role="menu"] [role="menuitem"][aria-checked="true"] *:not(svg):not(path) {
  color: var(--ss-sw-white) !important;
  font-weight: 600 !important;
}


html body [role="menu"] svg,
html body [role="menu"] svg path {
  color: var(--ss-sw-gold) !important;
  stroke: var(--ss-sw-gold) !important;
}
.switchyard-topbar { background: var(--ss-sw-header) !important; }
@media(prefers-reduced-motion:reduce){ * { transition:none !important; transform:none !important; }}`;
export function buildSwitchyardCSS(value: unknown): string {
 const c = cleanSwitchyardColors(value);
 const vars = { gold:c.iconColor, blue:c.accent, hover:c.hoverColor, rail:c.railColor, panel:c.sidebarBg, "panel-end":c.sidebarBgEnd, raised:c.inputColor, text:c.sidebarText, muted:c.mutedText, white:c.accentText, ring:c.outlineColor, header:c.headerBg };
 const declarations = Object.entries(vars).map(([key,color])=>`--ss-sw-${key}:${color};`).join("");
 return `html:has(#switchyard-primary-navigation):not(.sai-switchyard-off) { ${declarations} --ss-sw-line:color-mix(in srgb,var(--ss-sw-text) 12%,transparent); --ss-sw-radius:8px; ${TEMPLATE.replace(/html body/g, "body")} }`;
}
