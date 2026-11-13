/**
 * Old UI vs new UI (design system v0.1 + rebuilt navigation).
 *
 * Old is the default for everyone, so shipping this never changes what
 * customers see. Platform admins get a switch (UiVersionSwitch) that stores the
 * choice in this browser and reloads. It is read once at load because the
 * shared components pick their old or new styles when the page starts.
 */
export const UI_VERSION_STORAGE_KEY = "ss_ui_version";

function readNewUi(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(UI_VERSION_STORAGE_KEY) === "new";
  } catch {
    return false;
  }
}

export const newUi: boolean = readNewUi();

if (newUi && typeof document !== "undefined") {
  // Scopes the new color tokens, radius scale and brand-color mapping in index.css.
  document.documentElement.classList.add("ds-ui");
}

/** Saves the choice and reloads so every component starts in the chosen UI. */
export function setUiVersion(version: "old" | "new"): void {
  try {
    if (version === "new") window.localStorage.setItem(UI_VERSION_STORAGE_KEY, "new");
    else window.localStorage.removeItem(UI_VERSION_STORAGE_KEY);
  } catch {
    return;
  }
  window.location.reload();
}
