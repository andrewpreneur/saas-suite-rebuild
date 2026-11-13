/**
 * QA visits. The browser sends is_test and/or a ss_test cookie.
 * Stripe metadata stores the same flag as the string "true".
 * When the flag is set, Meta CAPI is skipped unless META_TEST_EVENT_CODE is set.
 */

export function valueIsTest(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function readCookieValue(cookie: string | null | undefined, name: string): string | null {
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return trimmed.slice(eq + 1);
    }
  }
  return null;
}

export function cookieIsTest(cookieHeader: string | null | undefined): boolean {
  return readCookieValue(cookieHeader, "ss_test") === "1";
}

/** Body field, nested tracking.is_test, or nested meta.is_test. */
export function objectIsTest(body: unknown): boolean {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  if (valueIsTest(record.is_test)) return true;
  const tracking = record.tracking;
  if (tracking && typeof tracking === "object" && valueIsTest((tracking as Record<string, unknown>).is_test)) {
    return true;
  }
  const meta = record.meta;
  if (meta && typeof meta === "object" && valueIsTest((meta as Record<string, unknown>).is_test)) {
    return true;
  }
  return false;
}

export function metadataIsTest(metadata: Record<string, unknown> | null | undefined): boolean {
  if (!metadata) return false;
  return valueIsTest(metadata.is_test);
}

export function requestIsTest(input: {
  body?: unknown;
  cookieHeader?: string | null;
  metadata?: Record<string, unknown> | null;
}): boolean {
  return objectIsTest(input.body) || cookieIsTest(input.cookieHeader) || metadataIsTest(input.metadata ?? null);
}

export function metaTestEventCode(raw: string | null | undefined): string | null {
  const code = raw?.trim() ?? "";
  return code || null;
}

/**
 * Live traffic always sends. Test traffic sends only when a test event code is
 * configured; otherwise the Graph call is skipped.
 */
export function metaSendPlan(
  isTest: boolean,
  testEventCode: string | null,
): { send: boolean; testEventCode?: string } {
  if (!isTest) return { send: true };
  if (testEventCode) return { send: true, testEventCode };
  return { send: false };
}

export function missingIsTestColumn(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "PGRST204" || error.code === "42703" || /is_test|schema cache/i.test(message);
}
