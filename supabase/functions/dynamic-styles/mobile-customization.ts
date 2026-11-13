import { xxiAdditionalCSS, xxiAdditionalJS } from "./xxidesigns-additions.ts";

export function buildMobileJS(zoomEnabled: unknown = true): string {
  // Gate only zoom tools and their reserved space, preserving menu and swipes.
  return zoomEnabled === false
    ? xxiAdditionalJS.replace("const active = mobile.matches &&", "const active = false && mobile.matches &&")
    : xxiAdditionalJS;
}

export function buildMobileCSS(color: unknown): string {
  const widgetColor = /^#[0-9a-f]{6}$/i.test(String(color ?? "")) ? String(color) : "#3b82f6";
  // Keep native or independently applied sidebar colors. Only the menu widget
  // receives a custom color; layout/scroll/zoom improvements are unchanged.
  return xxiAdditionalCSS
    // Use independent V2 branding when present, otherwise inherit HighLevel's
    // existing sidebar surface. Keep the zero-size anchor's native background.
    .replace(/background: var\(--color-sidebar-bg, #fff\)/g, "background: var(--color-sidebar-bg, inherit)")
    .replace("height: 100dvh !important;\n    background: var(--color-sidebar-bg, inherit) !important;", "height: 100dvh !important;")
    .replace("height: 0 !important;\n    background: transparent !important;", "height: 0 !important;")
    .replace(/background: var\(--color-sidebar-active, #e05800\)/g, `background: ${widgetColor}`)
    .replace(/#e05800/gi, "currentColor")
    .replace(/#173e5c/gi, "currentColor")
    .replace(/color: var\(--color-sidebar_text, #030403\) !important;/g, "/* Preserve native link and icon colors. */");
}