import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client Hub links are theme-specific: /v<ui_version>/<agencyId>.
 * The version comes from agency_ui_versions (one row per onboarding link);
 * no row = V2 (The Client Hub).
 */
export const HUB_ORIGIN = "https://yoursoftwareonboarding.com";
export const DEFAULT_HUB_VERSION = 2;
export const HUB_THEME_EVENT = "hub-theme-changed";

const cache = new Map<string, number>();
const inflight = new Map<string, Promise<number>>();

export const buildHubUrl = (id: string | null | undefined, version?: number, placeholder = "your-agency-id") =>
  `${HUB_ORIGIN}/v${version || DEFAULT_HUB_VERSION}/${id || placeholder}`;

export async function fetchHubVersion(id: string): Promise<number> {
  if (cache.has(id)) return cache.get(id)!;
  if (!inflight.has(id)) {
    inflight.set(
      id,
      (async () => {
        const { data } = await (supabase as any)
          .from("agency_ui_versions")
          .select("ui_version")
          .eq("agency_id", id)
          .maybeSingle();
        const v = Number(data?.ui_version) || DEFAULT_HUB_VERSION;
        cache.set(id, v);
        inflight.delete(id);
        return v;
      })().catch(() => {
        inflight.delete(id);
        return DEFAULT_HUB_VERSION;
      })
    );
  }
  return inflight.get(id)!;
}

/** Call after saving a theme so every link on screen updates. */
export function notifyHubThemeChanged(id: string, version: number) {
  cache.set(id, version);
  window.dispatchEvent(new CustomEvent(HUB_THEME_EVENT, { detail: { id, version } }));
}

/** Returns a builder that yields the theme-correct hub URL for any of the given ids. */
export function useHubUrls(ids: Array<string | null | undefined>) {
  const key = ids.filter(Boolean).join("|");
  const [versions, setVersions] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const list = key ? key.split("|") : [];
    Promise.all(list.map(async (id) => [id, await fetchHubVersion(id)] as const)).then((pairs) => {
      if (active) setVersions((prev) => ({ ...prev, ...Object.fromEntries(pairs) }));
    });
    const onChange = (e: Event) => {
      const { id, version } = (e as CustomEvent).detail || {};
      if (id) setVersions((prev) => ({ ...prev, [id]: version }));
    };
    window.addEventListener(HUB_THEME_EVENT, onChange);
    return () => {
      active = false;
      window.removeEventListener(HUB_THEME_EVENT, onChange);
    };
  }, [key]);

  return useCallback(
    (id: string | null | undefined, placeholder?: string) =>
      buildHubUrl(id, id ? versions[id] ?? cache.get(id) : undefined, placeholder),
    [versions]
  );
}
