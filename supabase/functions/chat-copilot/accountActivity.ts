/** Navigation is a hint, never permission or proof of installation. Strip query secrets. */
export function copilotSourcePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.split(/[?#]/)[0];
  return /^\/(app(?:\/|$)|v2-onboarding(?:\/|$)|initial-questions(?:\/|$))[a-zA-Z0-9/_-]*$/.test(path)
    ? path.slice(0, 200) : null;
}

/** Keep navigation/action identifiers only, never arbitrary labels or metadata. */
export function recentAccountActivity(sessions: Array<{ events?: unknown }>) {
  return sessions.flatMap((session) => Array.isArray(session.events) ? session.events : [])
    .filter((event) => event && typeof event.type === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(event.type) && typeof event.timestamp === "string" && Number.isFinite(Date.parse(event.timestamp)))
    .map((event) => ({ action: event.type, at: event.timestamp, page: copilotSourcePath(event.metadata?.path) }))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 15);
}