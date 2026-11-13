import { Card, CardContent } from "@/components/ui/card";
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
    <Card className={cn("overflow-hidden border-border", className)}>
      <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-violet-500/10 via-emerald-500/10 to-transparent px-4 py-3 md:px-6">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Trophy className="h-4 w-4 text-primary" />
          {ended ? "Challenge standings" : "Live Leaderboard"}
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {ended ? "Challenge ended" : "Updating live"}
        </span>
      </div>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No entries yet — be the first on the board.
          </p>
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
                    "px-4 py-3 transition-colors hover:bg-muted/50 md:px-6",
                    tier?.row,
                    isMe && "bg-primary/5 ring-1 ring-inset ring-primary/30",
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
                        {isMe && <span className="ml-2 text-xs text-primary">(you)</span>}
                        {ended && tier && <span className="ml-2 text-xs font-bold text-primary">Winner</span>}
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
                        tier?.bar ?? "bg-gradient-to-r from-violet-500 to-emerald-500",
                      )}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default GiveawayLeaderboard;
