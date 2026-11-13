import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Check, Search, Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GhlLocation } from "./useGhl";

interface Props {
  locations: GhlLocation[];
  value: string | null;
  onSelect: (loc: GhlLocation) => void;
  maxHeight?: string;
  /** Multi-select: decide which rows show as selected. */
  isActive?: (loc: GhlLocation) => boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** Searchable, animated list of every sub-account in the connected HighLevel agency. */
export default function LocationList({ locations, value, onSelect, maxHeight = "16rem", isActive, onRefresh, refreshing }: Props) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return locations;
    return locations.filter((l) =>
      [l.name, l.email, l.company_name, l.location_id].some((v) => (v || "").toLowerCase().includes(s)),
    );
  }, [locations, q]);

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none">
      <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${locations.length} sub-accounts by name, email or ID`}
          className="pl-9"
          aria-label="Search sub-accounts"
        />
      </div>
      {onRefresh && <Button type="button" variant="outline" size="icon" disabled={refreshing} onClick={onRefresh} aria-label="Refresh sub-accounts" title="Refresh sub-accounts"><RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} /></Button>}
      </div>
      <div className="rounded-lg border divide-y overflow-y-auto" style={{ maxHeight }} role="listbox" aria-label="Sub-accounts">
        {list.map((l, i) => {
          const active = isActive ? isActive(l) : value === l.location_id;
          return (
            <button
              key={l.location_id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(l)}
              style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors animate-in fade-in slide-in-from-left-1 duration-300 fill-mode-both motion-reduce:animate-none",
                active ? "bg-primary/10" : "hover:bg-muted",
              )}
            >
              <span className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {active ? <Check className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{l.name || "Unnamed sub-account"}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  {l.email || "No email"} · <span className="font-mono">{l.location_id}</span>
                </span>
              </span>
            </button>
          );
        })}
        {list.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No sub-accounts match “{q}”.</p>}
      </div>
    </div>
  );
}
