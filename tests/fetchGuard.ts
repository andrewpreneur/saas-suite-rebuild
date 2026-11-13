/**
 * Test-only fetch guard. Any host other than localhost throws before the network.
 * Production code is not wrapped; unit tests install this so a stub-less call cannot
 * reach Stape, Meta, Stripe, Supabase, GoHighLevel, or Slack.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function installFetchGuard(): () => void {
  const original = globalThis.fetch;
  const guarded = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    let host = "";
    try {
      host = new URL(raw).hostname;
    } catch {
      host = "";
    }
    if (!LOCAL_HOSTS.has(host)) {
      throw new Error(`blocked live fetch ${host || raw}`);
    }
    return original(input, init);
  };
  globalThis.fetch = guarded as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}
