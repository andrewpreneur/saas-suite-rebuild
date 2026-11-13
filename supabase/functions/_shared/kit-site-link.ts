import { isSiteAnalyticsSessionId } from "./kit-events.ts";

export function buyerEmailForSiteLink(email: string | null | undefined): string | null {
  const clean = (email ?? "").trim().toLowerCase();
  if (!clean.includes("@") || clean.length > 320) return null;
  return clean;
}

/**
 * Match site_analytics_events.session_id only. visitor_key is an IP hash and
 * must not be used to attach a buyer to someone else's browsing.
 */
export function siteAnalyticsEmailFilter(
  sessionId: string | null | undefined,
  email: string | null | undefined,
): { sessionId: string; email: string } | null {
  const id = typeof sessionId === "string" ? sessionId.trim() : "";
  const clean = buyerEmailForSiteLink(email);
  if (!isSiteAnalyticsSessionId(id) || !clean) return null;
  return { sessionId: id, email: clean };
}

type SiteEmailWrite = {
  update: (row: { user_email: string }) => {
    eq: (column: string, value: string) => {
      is: (column: string, value: null) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

/** Set user_email on rows for this analytics session that do not have one yet. */
export async function linkSiteAnalyticsEmail(
  db: { from: (table: string) => SiteEmailWrite },
  sessionId: string | null | undefined,
  email: string | null | undefined,
): Promise<"linked" | "skipped"> {
  const filter = siteAnalyticsEmailFilter(sessionId, email);
  if (!filter) return "skipped";
  const { error } = await db
    .from("site_analytics_events")
    .update({ user_email: filter.email })
    .eq("session_id", filter.sessionId)
    .is("user_email", null);
  if (error) throw new Error(error.message || "site session link failed");
  return "linked";
}
