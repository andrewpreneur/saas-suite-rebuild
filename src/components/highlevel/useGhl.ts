import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { ghl } from "./ghlApi";
import { loadGhlSnapshot } from "./loadGhlSnapshot";
import { ghlStillLoading, withDeadline } from "@/lib/loadSettle";
import { toast } from "sonner";

export type GhlLocation = { location_id: string; name: string | null; email: string | null; phone: string | null; company_name: string | null };
export type GhlMenu = { menu_id: string; title: string | null; url: string | null; all_locations: boolean | null; location_ids: string[] | null };

const cache = new Map<string, { connected: boolean; locations: GhlLocation[]; at: number }>();

/** HighLevel connection state for the account on screen (or a given agency ID). */
export function useGhl(agencyIdProp?: string | null, opts: { menus?: boolean } = {}) {
  const { email } = useUser();
  const [agencyId, setAgencyId] = useState<string | null>(agencyIdProp ?? null);
  const [agencyLookupDone, setAgencyLookupDone] = useState(Boolean(agencyIdProp) || !email);
  const [snapshotSettled, setSnapshotSettled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(() =>
    ghlStillLoading({
      email: email ?? null,
      agencyLookupDone: Boolean(agencyIdProp) || !email,
      agencyId: agencyIdProp ?? null,
      snapshotSettled: false,
    }),
  );
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<GhlLocation[]>([]);
  const [menus, setMenus] = useState<GhlMenu[]>([]);
  const loadGeneration = useRef(0);

  useEffect(() => {
    if (agencyIdProp) {
      setAgencyId(agencyIdProp);
      setAgencyLookupDone(true);
      return;
    }
    if (!email) {
      setAgencyId(null);
      setAgencyLookupDone(true);
      setSnapshotSettled(true);
      setConnected(false);
      setError(null);
      setLoading(false);
      return;
    }
    let cancel = false;
    setAgencyLookupDone(false);
    setSnapshotSettled(false);
    const lookup = withDeadline(
      supabase.from("saas_suite_users").select("agency_id").ilike("email", email.trim().toLowerCase()).maybeSingle(),
    ).then(({ data, error: lookupError }) => {
      if (cancel) return;
      if (lookupError) {
        setAgencyId(null);
        setError(lookupError.message || "Couldn't look up this agency.");
      } else {
        setError(null);
        setAgencyId((data as { agency_id?: string | null } | null)?.agency_id ?? null);
      }
      setAgencyLookupDone(true);
    }).catch((lookupError: unknown) => {
      if (cancel) return;
      setAgencyId(null);
      setAgencyLookupDone(true);
      setError(lookupError instanceof Error ? lookupError.message : "Couldn't look up this agency.");
    });
    void lookup;
    return () => { cancel = true; };
  }, [agencyIdProp, email]);

  const load = useCallback(async (force = false) => {
    if (!agencyLookupDone) return;
    const generation = ++loadGeneration.current;
    if (!agencyId) {
      setConnected(false);
      setLocations([]);
      setMenus([]);
      setSnapshotSettled(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hit = cache.get(agencyId);
      if (!force && !opts.menus && hit && Date.now() - hit.at < 60_000) {
        setConnected(hit.connected); setLocations(hit.locations);
      } else {
        const snapshot = await withDeadline(loadGhlSnapshot(ghl, agencyId, force, !!opts.menus));
        if (generation !== loadGeneration.current) return;
        cache.set(agencyId, { connected: snapshot.connected, locations: snapshot.locations, at: Date.now() });
        setConnected(snapshot.connected); setLocations(snapshot.locations);
        if (opts.menus) setMenus(snapshot.menus);
      }
      setSnapshotSettled(true);
    } catch (loadError) {
      if (generation !== loadGeneration.current) return;
      setSnapshotSettled(true);
      setConnected(false);
      const message = loadError instanceof Error ? loadError.message : "Couldn't reach HighLevel.";
      setError(message);
      if (force) toast.error(message);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, [agencyId, agencyLookupDone, opts.menus]);

  useEffect(() => {
    void load();
    return () => { loadGeneration.current += 1; };
  }, [load]);

  return { agencyId, connected, loading, error, locations, menus, reload: load };
}
