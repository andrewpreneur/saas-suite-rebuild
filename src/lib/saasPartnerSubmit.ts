export type WaitlistInvokeResult = {
  ok: boolean;
  error?: string;
  field?: string;
  fields?: Record<string, string>;
};

const FALLBACK = "We couldn't add you to the waitlist. Please try again.";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readPayload(value: unknown): WaitlistInvokeResult | null {
  const body = asRecord(value);
  if (!body) return null;
  if (body.ok === true) return { ok: true };
  if (typeof body.error === "string" && body.error.trim()) {
    const fields = asRecord(body.fields);
    const fieldMap: Record<string, string> = {};
    if (fields) {
      for (const [key, message] of Object.entries(fields)) {
        if (typeof message === "string") fieldMap[key] = message;
      }
    }
    return {
      ok: false,
      error: body.error,
      field: typeof body.field === "string" ? body.field : undefined,
      fields: Object.keys(fieldMap).length ? fieldMap : undefined,
    };
  }
  return null;
}

export async function readWaitlistInvoke(result: {
  data: unknown;
  error: { message?: string; context?: { json?: () => Promise<unknown> } } | null;
}): Promise<WaitlistInvokeResult> {
  const direct = readPayload(result.data);
  if (direct) return direct;
  const context = result.error?.context;
  if (context && typeof context.json === "function") {
    try {
      const parsed = readPayload(await context.json());
      if (parsed) return parsed;
    } catch {
      /* The function body was not JSON. */
    }
  }
  return { ok: false, error: FALLBACK };
}
