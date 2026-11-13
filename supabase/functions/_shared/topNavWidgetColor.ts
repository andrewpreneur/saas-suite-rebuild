// Help & Support color modes. Design stores primary / secondary / tertiary / custom.
// A missing tertiary used to fall through to primary, so an icon set to Color 3
// painted the button color (Keystone: red on red) while Design showed the sidebar
// white. Missing tertiary uses secondary, then white.

const HEX = /^#[0-9a-f]{3,8}$/i;

export function pickHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return HEX.test(text) ? text : null;
}

export function resolveTopNavWidgetColor(
  mode: string | null | undefined,
  custom: string | null | undefined,
  palette: { primary?: string | null; secondary?: string | null; tertiary?: string | null },
  fallback: string,
): string {
  const primary = pickHex(palette.primary);
  const secondary = pickHex(palette.secondary);
  const tertiary = pickHex(palette.tertiary);
  const customHex = pickHex(custom);
  if (mode === "custom" && customHex) return customHex;
  if (mode === "secondary") return secondary || primary || fallback;
  if (mode === "tertiary") return tertiary || secondary || "#ffffff";
  return primary || fallback;
}
