import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Link2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GhlMenu } from "./useGhl";
import { isCurrentInstallationMenu } from "@/lib/installationMenu";

interface Props {
  menus: GhlMenu[];
  value: string;
  agencyId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => Promise<void>;
  startOnPick?: boolean;
}

/** "I've installed it" → fetch custom menu links from HighLevel → pick one. */
export default function MenuLinkPicker({ menus, value, agencyId, onSelect, onRefresh, startOnPick }: Props) {
  const [phase, setPhase] = useState<"install" | "loading" | "pick">(value || startOnPick ? "pick" : "install");

  const refresh = async () => {
    setPhase("loading");
    await onRefresh();
    setPhase("pick");
  };

  if (phase === "install") {
    return (
      <Button variant="accent" className="w-full animate-in fade-in duration-300 motion-reduce:animate-none sm:w-auto" onClick={refresh}>
        <Check /> I've installed it
      </Button>
    );
  }
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground animate-in fade-in duration-300">
        <Loader2 className="w-4 h-4 animate-spin" /> Getting your menu links from HighLevel…
      </div>
    );
  }

  // Links pointing at this agency's hub come first.
  const sorted = [...menus].sort((a, b) => {
    const am = isCurrentInstallationMenu(a, agencyId) ? 0 : 1;
    const bm = isCurrentInstallationMenu(b, agencyId) ? 0 : 1;
    return am - bm;
  });

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Which one is your onboarding link?</p>
        <Button variant="ghost" size="sm" onClick={refresh}><RefreshCw /> Refresh</Button>
      </div>
      {sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">No custom menu links found yet. Save it in HighLevel, then press Refresh.</p>
      ) : (
        <div className="rounded-lg border border-border divide-y divide-border max-h-72 overflow-y-auto" role="listbox" aria-label="Custom menu links">
          {sorted.map((m, i) => {
            const active = value === m.menu_id;
            const ours = isCurrentInstallationMenu(m, agencyId);
            return (
              <button
                key={m.menu_id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(m.menu_id)}
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors animate-in fade-in slide-in-from-left-1 duration-300 fill-mode-both motion-reduce:animate-none",
                  active ? "bg-brand-subtle" : "hover:bg-muted",
                )}
              >
                <span className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", active ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground")}>
                  {active ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {m.title || "Untitled link"}
                    {ours && <span className="rounded-full bg-brand-subtle px-2 py-0.5 text-[11px] font-medium text-brand">Your onboarding URL</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">{m.url}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
