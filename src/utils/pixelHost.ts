/**
 * The Meta Pixel may only run on our own production domains. Lovable previews,
 * *.lovableproject.com and embedded installs on partner domains are refused, so
 * their traffic never pollutes advertising data.
 *
 * index.html applies the same rule before the pixel bootstrap; this mirrors it
 * for app code (so no server-side CAPI copy is sent from a disallowed host).
 */
const PIXEL_ALLOWED_HOSTS = ["saassuite.ai", "gofreesaas.com"];

export function pixelAllowedHere(): boolean {
  if (typeof window === "undefined") return false;
  const h = (window.location.hostname || "").toLowerCase().replace(/^www\./, "");
  return PIXEL_ALLOWED_HOSTS.some((d) => h === d || h.endsWith("." + d));
}
