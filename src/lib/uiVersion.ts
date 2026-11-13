/**
 * Rebuild copy: there is one UI. The old UI and the admin switch were removed.
 * `newUi` stays exported (always true) only so older conditionals keep compiling
 * until each screen is rewritten; do not add new uses of it.
 */
export const newUi = true as boolean;

if (typeof document !== "undefined") {
  // Scopes the design-system tokens in index.css.
  document.documentElement.classList.add("ds-ui");
}
