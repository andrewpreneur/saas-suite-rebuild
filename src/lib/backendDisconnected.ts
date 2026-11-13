/**
 * This repository is a UI rebuild copy. It is disconnected from every live
 * service: the Supabase client is always the local mock (see
 * src/integrations/supabase/client.ts) and nothing here may call the live app.
 *
 * DISCONNECTED_BACKEND replaces every hard-coded backend address. The
 * `.invalid` top-level domain is reserved and never resolves, so a request
 * that slips past the mock goes nowhere.
 */
export const DISCONNECTED_BACKEND = "https://backend-disconnected.invalid";

/** Live hosts this copy must never contact: the real backend, hub and trackers. */
const BLOCKED_HOST_PATTERNS: RegExp[] = [
  /(^|\.)supabase\.co$/,
  /(^|\.)supabase\.in$/,
  /^auth\.saassuite\.ai$/,
  /(^|\.)yoursoftwareonboarding\.com$/,
  /(^|\.)lspxl\.com$/,
  /(^|\.)googletagmanager\.com$/,
  /(^|\.)google-analytics\.com$/,
  /(^|\.)facebook\.com$/,
  /(^|\.)facebook\.net$/,
  /(^|\.)posthog\.com$/,
  /(^|\.)leadconnectorhq\.com$/,
  /(^|\.)msgsndr\.com$/,
  /(^|\.)invalid$/,
];

export function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

function hostOf(input: unknown): string | null {
  try {
    const raw =
      typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request)?.url;
    if (!raw) return null;
    return new URL(raw, window.location.href).hostname;
  } catch {
    return null;
  }
}

let installed = false;

/**
 * Second line of defence behind the mock client: refuses fetch, beacon, XHR and
 * WebSocket traffic to live hosts, so a missed call fails locally instead of
 * reaching real customer data or real analytics.
 */
export function installBackendGuard(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const host = hostOf(input);
    if (host && isBlockedHost(host)) {
      return Promise.reject(new TypeError(`Blocked in the rebuild copy: ${host} is a live service.`));
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;

  if (navigator.sendBeacon) {
    const originalBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      const host = hostOf(url);
      if (host && isBlockedHost(host)) return false;
      return originalBeacon(url, data);
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    const host = hostOf(url);
    if (host && isBlockedHost(host)) {
      throw new TypeError(`Blocked in the rebuild copy: ${host} is a live service.`);
    }
    return (originalOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = function (url: string | URL, protocols?: string | string[]) {
    const host = hostOf(String(url).replace(/^ws/, "http"));
    if (host && isBlockedHost(host)) {
      throw new TypeError(`Blocked in the rebuild copy: ${host} is a live service.`);
    }
    return new OriginalWebSocket(url, protocols);
  } as unknown as typeof WebSocket;
  window.WebSocket.prototype = OriginalWebSocket.prototype;
}
