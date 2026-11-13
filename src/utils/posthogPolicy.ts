/** Keep auth tokens, email addresses and arbitrary query values out of analytics. */
export function analyticsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function websiteTrackingAllowed(optedOut: boolean, token: string | undefined): boolean {
  return !optedOut && Boolean(token);
}

export function websiteEventProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ["token", "distinct_id", "$device_id", "$session_id", "$window_id", "$lib", "$lib_version", "$browser", "$browser_version", "$os", "$os_version", "$device_type", "$screen_height", "$screen_width", "$viewport_height", "$viewport_width", "$host", "$pathname", "$referring_domain", "$is_identified"]) {
    if (properties[key] !== undefined) result[key] = properties[key];
  }
  for (const key of ["$current_url", "$referrer"]) {
    if (properties[key]) result[key] = analyticsUrl(properties[key]);
  }
  return result;
}