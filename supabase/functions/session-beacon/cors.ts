/**
 * navigator.sendBeacon always uses credentials: "include".
 * A wildcard Access-Control-Allow-Origin is rejected for that mode, so the
 * beacon never leaves the browser. Echo the request origin instead.
 */
export function sessionBeaconCors(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const allowed = safeOrigin(origin);
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
    headers["Access-Control-Allow-Credentials"] = "true";
    return headers;
  }
  headers["Access-Control-Allow-Origin"] = "*";
  return headers;
}

function safeOrigin(origin: string | null): string | null {
  if (!origin || origin === "null") return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
