import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import {
  SITES_TOP_NAV_ITEMS,
  SITES_TOP_NAV_PRESET,
  sitesTopNavHiddenLinks,
} from "@/lib/sitesTopNav";

async function refreshLiveStyles(agencyId: string) {
  const base = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dynamic-styles?agency_id=${encodeURIComponent(agencyId)}&force=1`;
  await Promise.all(["css", "js"].map((type) => fetch(`${base}&type=${type}`, { cache: "no-store" }).catch(() => {})));
}

function readHiddenIds(rows: { hidden_links: unknown; is_active: boolean }[]): string[] {
  const ids = rows
    .filter((row) => row.is_active)
    .flatMap((row) => (Array.isArray(row.hidden_links) ? row.hidden_links : []))
    .filter((id): id is string => typeof id === "string");
  return sitesTopNavHiddenLinks(ids);
}

/**
 * Advanced Sites top-navigation hides. One global menu_link_rules row per agency.
 * Nothing is hidden until a toggle is turned on.
 */
export function SitesTopNavOptions({ agencyId }: { agencyId: string | null }) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const hiddenRef = useRef<string[]>([]);
  const writeChain = useRef(Promise.resolve());

  useEffect(() => {
    let alive = true;
    setReady(false);
    setLoadFailed(false);
    setHidden([]);
    hiddenRef.current = [];
    if (!agencyId) {
      setReady(true);
      return;
    }
    supabase
      .from("menu_link_rules")
      .select("hidden_links, is_active")
      .eq("agency_id", agencyId)
      .eq("preset_name", SITES_TOP_NAV_PRESET)
      .is("sub_account_id", null)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          console.error("Error loading Sites top navigation hides:", error);
          toast.error("Couldn't load Sites navigation options");
          setLoadFailed(true);
        } else {
          const ids = readHiddenIds(data ?? []);
          hiddenRef.current = ids;
          setHidden(ids);
        }
        setReady(true);
      });
    return () => {
      alive = false;
    };
  }, [agencyId]);

  const persist = (next: string[], previous: string[]) => {
    if (!agencyId) return;
    writeChain.current = writeChain.current.then(async () => {
      if (hiddenRef.current !== next && sitesTopNavHiddenLinks(hiddenRef.current).join() !== next.join()) return;
      const ids = sitesTopNavHiddenLinks(next);
      const { data: rows, error: readError } = await supabase
        .from("menu_link_rules")
        .select("id")
        .eq("agency_id", agencyId)
        .eq("preset_name", SITES_TOP_NAV_PRESET)
        .is("sub_account_id", null);
      if (readError) throw readError;
      const existing = rows ?? [];
      if (ids.length === 0) {
        if (existing.length) {
          const { error } = await supabase.from("menu_link_rules").delete().in("id", existing.map((row) => row.id));
          if (error) throw error;
        }
      } else if (existing.length === 0) {
        const { error } = await supabase.from("menu_link_rules").insert({
          agency_id: agencyId,
          sub_account_id: null,
          preset_name: SITES_TOP_NAV_PRESET,
          hidden_links: ids,
          is_active: true,
        });
        if (error) throw error;
      } else {
        const [keep, ...extras] = existing;
        const { error } = await supabase
          .from("menu_link_rules")
          .update({ hidden_links: ids, is_active: true, preset_name: SITES_TOP_NAV_PRESET, sub_account_id: null, updated_at: new Date().toISOString() })
          .eq("id", keep.id);
        if (error) throw error;
        if (extras.length) {
          const { error: deleteError } = await supabase.from("menu_link_rules").delete().in("id", extras.map((row) => row.id));
          if (deleteError) throw deleteError;
        }
      }
      await refreshLiveStyles(agencyId);
    }).catch((error) => {
      console.error("Error saving Sites top navigation hides:", error);
      toast.error("Couldn't save Sites navigation options");
      if (hiddenRef.current === next) {
        hiddenRef.current = previous;
        setHidden(previous);
      }
    });
  };

  const toggle = (id: string, hide: boolean) => {
    const previous = hiddenRef.current;
    const next = sitesTopNavHiddenLinks(hide ? [...previous, id] : previous.filter((item) => item !== id));
    hiddenRef.current = next;
    setHidden(next);
    persist(next, previous);
  };

  const hiddenSet = new Set(hidden);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!agencyId} aria-expanded={open}>
          More options
          <ChevronDown className="h-3.5 w-3.5" />
          {hidden.length > 0 && (
            <Badge variant="secondary" className="px-1.5 py-0">{hidden.length}</Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2">
          <p className="text-sm font-semibold">Advanced</p>
          <p className="text-xs text-muted-foreground">Hide GoHighLevel Sites items in the top navigation. Off leaves them visible.</p>
        </div>
        {loadFailed && <p className="px-3 py-2 text-xs text-destructive">Couldn't load saved hides. Refresh and try again.</p>}
        <ul className="max-h-[70vh] overflow-y-auto py-1" aria-label="Sites top navigation">
          {SITES_TOP_NAV_ITEMS.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-1.5">
              <label htmlFor={`sites-nav-${item.id.slice(1)}`} className="text-sm">{item.label}</label>
              <Switch
                id={`sites-nav-${item.id.slice(1)}`}
                checked={hiddenSet.has(item.id)}
                disabled={!ready || loadFailed || !agencyId}
                onCheckedChange={(checked) => toggle(item.id, checked)}
                aria-label={`Hide ${item.label}`}
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
