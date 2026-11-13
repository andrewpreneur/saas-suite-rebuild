import { EmptyState } from "@/components/premium/21st/empty-state";
import { Crown, Medal, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GiveawayLeader } from "@/constants/giveaway";
import { useChallengeFinale } from "@/hooks/useChallengeFinale";

interface Props {
  leaders: GiveawayLeader[];
  myName?: string | null;
  className?: string;
  limit?: number;
}

const TIER: Record<number, { row: string; badge: string; icon: typeof Crown; bar: string }> = {
  1: {
    row: "bg-gradient-to-r from-amber-300/20 via-amber-200/5 to-transparent",
    badge: "bg-amber-400 text-amber-950",
    icon: Crown,
    bar: "bg-gradient-to-r from-amber-400 to-amber-300",
  },
  2: {
    row: "bg-gradient-to-r from-slate-300/20 via-slate-200/5 to-transparent",
    badge: "bg-slate-300 text-slate-900",
    icon: Medal,
    bar: "bg-gradient-to-r from-slate-400 to-slate-300",
  },
  3: {
    row: "bg-gradient-to-r from-orange-400/20 via-orange-300/5 to-transparent",
    badge: "bg-orange-400 text-orange-950",
    icon: Medal,
    bar: "bg-gradient-to-r from-orange-400 to-orange-300",
  },
};

/** Live standings — display names only, never emails. */
const GiveawayLeaderboard = ({ leaders, myName, className, limit = 25 }: Props) => {
  const { ended } = useChallengeFinale();
  const rows = leaders.slice(0, limit);
  const top = rows[0]?.points ?? 0;

  return (
    <section className={cn("px-surface overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-6">
        <h2 className="flex items-center gap-3 text-base font-semibold text-foreground">
          <span className="px-icon-chip shrink-0" aria-hidden="true">
            <Trophy className="size-5" />
          </span>
          {ended ? "Final standings" : "Live leaderboard"}
        </h2>
        {ended ? (
          <span className="text-xs font-medium text-muted-foreground">Challenge ended</span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:hidden" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Updating live
          </span>
        )}
      </div>
      <div>
        {rows.length === 0 ? (
          <EmptyState
            icon={
              <span className="px-icon-chip">
                <Trophy className="size-5" />
              </span>
            }
            title="No entries yet"
            description="Be the first on the board."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => {
              const isMe = !!myName && row.display_name === myName;
              const tier = TIER[row.rank];
              const Icon = tier?.icon;
              const width = top > 0 ? Math.max(4, (row.points / top) * 100) : 0;
              return (
                <li
                  key={`${row.rank}-${row.display_name}`}
                  className={cn(
                    "px-4 py-3 md:px-6",
                    tier?.row,
                    isMe && "bg-brand-subtle ring-1 ring-inset ring-brand/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          tier?.badge ?? "bg-muted text-muted-foreground",
                        )}
                      >
                        {Icon ? <Icon className="h-4 w-4" /> : row.rank}
                      </span>
                      <span className="truncate text-sm font-semibold text-foreground">
                        {row.display_name}
                        {isMe && <span className="ml-2 text-xs font-medium text-brand">You</span>}
                        {ended && tier && <span className="ml-2 text-xs font-medium text-muted-foreground">Winner</span>}
                      </span>
                    </div>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                      {row.points.toLocaleString()} pts
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-700",
                        tier?.bar ?? "bg-brand",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default GiveawayLeaderboard;
