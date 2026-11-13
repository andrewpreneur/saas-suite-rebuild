/**
 * GHL inbound contact fields compare the strings "yes" and "no".
 * `wwu-no-ghl` checks `wwu_has_highlevel` Is `no`. A boolean or the
 * string "false" does not match. Storage stays boolean; call this
 * at the POST boundary only.
 */
export function ghlYesNo(value: unknown): "yes" | "no" {
  if (value === true) return "yes";
  if (typeof value === "string" && value.trim().toLowerCase() === "yes") return "yes";
  return "no";
}
