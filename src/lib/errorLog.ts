import { supabase } from "@/integrations/supabase/client";

const recent = new Map<string, number>();

const text = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (v instanceof Error) return v.message;
  return "";
};

/** Persist an app error (red pop-up, crash) so it can be reviewed later. Never throws. */
export function logClientError(source: string, title: unknown, message?: unknown) {
  try {
    const t = text(title).slice(0, 500);
    const m = text(message).slice(0, 4000);
    if (!t && !m) return;
    const key = `${source}|${t}|${m}`;
    const now = Date.now();
    if ((recent.get(key) ?? 0) > now - 10_000) return;
    recent.set(key, now);
    console.error(`[${source}]`, t, m);
    void supabase.auth.getSession().then(({ data }) =>
      supabase.from("client_error_logs" as any).insert({
        source,
        title: t || null,
        message: m || null,
        page_path: window.location.pathname + window.location.search,
        user_email: data.session?.user?.email?.toLowerCase() ?? null,
        user_agent: navigator.userAgent.slice(0, 500),
      }),
    ).catch(() => undefined);
  } catch {
    /* ignore */
  }
}

let installed = false;
export function installGlobalErrorLogging() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => logClientError("window_error", e.message, e.error?.stack));
  window.addEventListener("unhandledrejection", (e) =>
    logClientError("unhandled_rejection", text(e.reason) || "Unhandled promise rejection", (e.reason as any)?.stack),
  );
}
