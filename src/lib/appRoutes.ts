/** Canonical Client Hub Design URL. Edit Pages stays on `/app/client-hub`. */
export const DESIGN_PATH = "/app/client-hub/design";

export const DESIGN_TOOL = "branding";

/** Sidebar and in-app tool changes. Design lives under Client Hub. */
export function pathForAppTool(tool: string): string {
  if (tool === DESIGN_TOOL) return DESIGN_PATH;
  return `/app/${tool}`;
}

/**
 * Which tool a URL renders.
 * `/app/client-hub/design` is Design. Every other Client Hub path stays Edit Pages.
 */
export function resolveAppTool(tool: string | undefined, subTab?: string): string | null {
  const urlTool = tool?.toLowerCase();
  if (!urlTool) return null;
  if (urlTool === "client-hub" && subTab?.toLowerCase() === "design") return DESIGN_TOOL;
  return urlTool;
}
