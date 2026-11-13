/** Sizing rules for the docked Copilot panel. Kept pure so they can be tested. */
export const COPILOT_DOCK_DEFAULT = 380;
export const COPILOT_DOCK_MIN = 320;
export const COPILOT_DOCK_MAX = 760;
/** Extra width the panel takes while its inline chat menu is open. */
export const COPILOT_DOCK_NAV = 224;
/** Space always left for the app's own sidebar and page. */
export const COPILOT_PAGE_RESERVE = 640;
export const COPILOT_DOCK_STEP = 24;
export const COPILOT_DOCK_STORAGE_KEY = "copilot_dock_width";

/** Keeps the panel between its minimum and what the window can spare. */
export function clampDockWidth(width: number, viewportWidth: number): number {
  const safe = Number.isFinite(width) ? width : COPILOT_DOCK_DEFAULT;
  const max = Math.max(
    COPILOT_DOCK_MIN,
    Math.min(COPILOT_DOCK_MAX, viewportWidth - COPILOT_PAGE_RESERVE),
  );
  return Math.round(Math.min(max, Math.max(COPILOT_DOCK_MIN, safe)));
}

export function readStoredDockWidth(value: string | null): number {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) && parsed > 0 ? parsed : COPILOT_DOCK_DEFAULT;
}

/** Total width the docked panel covers, including its chat menu when open. */
export function dockPanelWidth(width: number, viewportWidth: number, navOpen: boolean): number {
  const base = clampDockWidth(width, viewportWidth);
  if (!navOpen) return base;
  return Math.max(base, Math.min(base + COPILOT_DOCK_NAV, viewportWidth - COPILOT_DOCK_MIN));
}
