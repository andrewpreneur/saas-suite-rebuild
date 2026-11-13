// Meta events may only ever come from our own production domains. Mirrors the
// browser-side guard in index.html so closing the pixel on preview/embedded
// hosts doesn't leave the server-side Conversions API path leaking.

export const PIXEL_ALLOWED_HOSTS = ["saassuite.ai", "gofreesaas.com"];

export function hostAllowed(hostname?: string | null): boolean {
  if (!hostname) return false;
  const h = hostname.toLowerCase().replace(/^www\./, "");
  return PIXEL_ALLOWED_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

export function hostOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Allowed when we can resolve an allowed host, or when there is no host at all
 *  (purely server-triggered events such as Stripe fulfillment). */
export function urlAllowed(...urls: (string | null | undefined)[]): boolean {
  const hosts = urls.map(hostOf).filter(Boolean) as string[];
  if (!hosts.length) return true;
  return hosts.every(hostAllowed);
}
