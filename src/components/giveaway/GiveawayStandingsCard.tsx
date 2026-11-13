import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Trophy, Users } from "lucide-react";
import { useGiveaway } from "@/hooks/useGiveaway";
import GiveawayLeaderboard from "@/components/giveaway/GiveawayLeaderboard";
import {
  GIVEAWAY_NAME,
  GIVEAWAY_PRIZES,
  GIVEAWAY_RULES_PATH,
  GIVEAWAY_END_SHORT,
  GIVEAWAY_END_LABEL,
  GIVEAWAY_START_SHORT,
  GIVEAWAY_WINNERS_LABEL,
  GIVEAWAY_LEVELUP_URL,
  GIVEAWAY_POINT_RULES,
} from "@/constants/giveaway";
import { useState } from "react";

/**
 * In-app live giveaway strip. `banner` is the slim dashboard version that links
 * into the dedicated Challenge tab; `full` is everything (breakdown + board).
 */
const GiveawayStandingsCard = ({
  onEnter,
  variant = "full",
  onViewChallenge,
}: {
  onEnter?: () => void;
  variant?: "banner" | "full";
  onViewChallenge?: () => void;
}) => {
  const { stats, leaders, isLoading } = useGiveaway();
  const [showBoard, setShowBoard] = useState(false);

  if (isLoading || !stats) return null;

  const me = stats.me;
  const topPoints = leaders[0]?.points ?? 0;
  const progress = topPoints > 0 && me ? Math.min(100, (me.points / topPoints) * 100) : 0;

  if (variant === "banner") {
    return (
      <Card
        className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card"
        data-tip-target="giveaway-standings"
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 shrink-0 text-primary" />
              <h2 className="truncate text-base font-bold text-foreground">
                $10,000 {GIVEAWAY_NAME}
              </h2>
              <Badge className="shrink-0">Live</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {GIVEAWAY_START_SHORT} → {GIVEAWAY_END_SHORT} ·{" "}
              {me
                ? `You're ${me.rank ? `#${me.rank}` : "unranked"} with ${me.points.toLocaleString()} pts`
                : `${stats.entrants.toLocaleString()} agencies already entered`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!me && <Button onClick={onEnter}>Enter the challenge</Button>}
            <Button variant={me ? "default" : "outline"} onClick={onViewChallenge}>
              <Trophy className="mr-1.5 h-4 w-4" />
              View challenge
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-tip-target="giveaway-standings">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Gift className="h-5 w-5 shrink-0 text-primary" />
                <h2 className="truncate text-base font-bold text-foreground md:text-lg">
                  $10,000 {GIVEAWAY_NAME}
                </h2>
                <Badge className="shrink-0">Live</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {GIVEAWAY_PRIZES.map((p) => `${p.place} $${p.amount.toLocaleString()}`).join(" · ")}
              </p>
              <p className="mt-1 text-xs font-semibold text-foreground">
                Official dates: {GIVEAWAY_START_SHORT} → {GIVEAWAY_END_SHORT}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Winners announced {GIVEAWAY_WINNERS_LABEL}. The challenge ends {GIVEAWAY_END_LABEL}.{" "}
                <a
                  href={GIVEAWAY_LEVELUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline"
                >
                  LevelUp
                </a>
                {" "}· Free to enter ·{" "}
                <Link to={GIVEAWAY_RULES_PATH} className="font-medium text-primary underline">
                  Official Rules
                </Link>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Bonus: top 3 when the challenge ends get a chance at a free LevelUp ticket (Dallas,
                TX) — ticket not guaranteed.
              </p>
            </div>

            {me ? (
              <div className="grid grid-cols-2 gap-3">
                <Stat icon={Trophy} label="Your rank" value={me.rank ? `#${me.rank}` : "—"} />
                <Stat icon={Users} label="Your points" value={me.points.toLocaleString()} />
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xl font-bold text-foreground">
                    {stats.entrants.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">already entered</p>
                </div>
                <Button onClick={onEnter}>Enter the challenge</Button>
              </div>
            )}
          </div>

          {me && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Your points vs. the current leader</span>
                <span className="tabular-nums">
                  {me.points.toLocaleString()} / {topPoints.toLocaleString()} pts
                </span>
              </div>
              <Progress value={progress} className="h-2" />

              {/* Live per-category breakdown so every way to earn is visible */}
              <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-3 lg:grid-cols-5">
                {GIVEAWAY_POINT_RULES.map((rule) => {
                  const b = me.breakdown ?? {};
                  const earned =
                    rule.key === "slack_connected"
                      ? (b.slack_points ?? (b.slack_connected ? 20 : 0))
                      : rule.key === "users_onboarded"
                        ? (b.users_onboarded_points ?? 0)
                        : rule.key === "module_completions"
                          ? (b.module_completion_points ?? 0)
                          : rule.key === "checklist_completions"
                            ? (b.checklist_completion_points ?? 0)
                            : (b.login_day_points ?? 0);
                  return (
                    <div
                      key={rule.key}
                      className={`rounded-lg border px-2.5 py-2 ${
                        earned > 0 ? "border-primary/40 bg-primary/5" : "border-border bg-card"
                      }`}
                    >
                      <p className="text-[11px] leading-tight text-muted-foreground">{rule.label}</p>
                      <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                        +{earned.toLocaleString()} pts
                      </p>
                      <p className="text-[10px] text-muted-foreground">{rule.points}</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-xs text-muted-foreground">
                  {stats.entrants.toLocaleString()} entrants · {stats.total_points.toLocaleString()} points earned so far
                </p>
                <Button variant="ghost" size="sm" onClick={() => setShowBoard((v) => !v)}>
                  {showBoard ? "Hide leaderboard" : "See full leaderboard"}
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to={GIVEAWAY_RULES_PATH}>How points work</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showBoard && <GiveawayLeaderboard leaders={leaders} myName={me?.display_name} />}
    </div>
  );
};

const Stat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) => (
  <div className="rounded-lg border border-border bg-card px-3 py-2">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      <span className="truncate">{label}</span>
    </div>
    <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{value}</p>
  </div>
);

export default GiveawayStandingsCard;
