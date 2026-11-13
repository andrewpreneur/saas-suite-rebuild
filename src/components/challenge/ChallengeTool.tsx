import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift } from "lucide-react";
import GiveawayLeaderboard from "@/components/giveaway/GiveawayLeaderboard";
import GiveawayOptInModal from "@/components/giveaway/GiveawayOptInModal";
import ChallengePodium from "@/components/giveaway/ChallengePodium";
import ChallengeFinale from "@/components/giveaway/ChallengeFinale";
import ChallengePointReview from "@/components/challenge/ChallengePointReview";
import { useChallengeFinale } from "@/hooks/useChallengeFinale";
import { useGiveaway } from "@/hooks/useGiveaway";
import { ordinal, pointsForRule } from "@/lib/challengePlace";
import {
  GIVEAWAY_END_LABEL,
  GIVEAWAY_NAME,
  GIVEAWAY_POINT_RULES,
  GIVEAWAY_RANGE_SHORT,
  GIVEAWAY_RULES_PATH,
  GIVEAWAY_START_LABEL,
  GIVEAWAY_TICKET_NOTE,
  GIVEAWAY_WINNERS_LABEL,
} from "@/constants/giveaway";

/**
 * Dedicated in-app Challenge tab. The live leaderboard is the first block;
 * the podium replaces the old prize list.
 */
const ChallengeTool = () => {
  const { stats, leaders, isLoading, isEntered, isOptingIn, optIn, refresh } = useGiveaway();
  const { ended } = useChallengeFinale();
  const [optInOpen, setOptInOpen] = useState(false);
  const me = stats?.me ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{GIVEAWAY_NAME}</h1>
          <Badge variant="secondary" className="shrink-0 gap-1.5">
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {ended ? "Ended" : "Live"}
          </Badge>
        </div>
        {!ended && !isLoading && !isEntered && (
          <Button size="sm" onClick={() => setOptInOpen(true)}>
            <Gift className="mr-1.5 h-4 w-4" />
            Enter the challenge
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{GIVEAWAY_RANGE_SHORT}</p>
      <ChallengeFinale leaders={leaders} me={me} refresh={refresh} />
      <ChallengePointReview />

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Loading live standings…
          </CardContent>
        </Card>
      ) : (
        <GiveawayLeaderboard leaders={leaders} myName={me?.display_name} limit={50} />
      )}

      {!isLoading && <ChallengePodium leaders={leaders} me={me} />}

      <p className="text-xs text-muted-foreground">{GIVEAWAY_TICKET_NOTE}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">How to earn points</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {me && (
              <p className="text-xs font-semibold text-foreground">
                You have {me.points.toLocaleString()} pts
                {me.rank ? ` · ${ordinal(Number(me.rank))} place` : ""}
              </p>
            )}
            {GIVEAWAY_POINT_RULES.map((rule) => {
              const earned = me ? pointsForRule(rule.key, me.breakdown) : null;
              return (
                <div key={rule.key} className="rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">{rule.label}</p>
                    <p className="shrink-0 text-xs font-semibold text-primary">
                      {earned != null && earned > 0 ? `+${earned.toLocaleString()} · ` : ""}
                      {rule.points}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{rule.detail}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dates and rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Starts:</strong> {GIVEAWAY_START_LABEL}
            </p>
            <p>
              <strong className="text-foreground">Ends:</strong> {GIVEAWAY_END_LABEL}
            </p>
            <p>
              <strong className="text-foreground">Winners announced:</strong>{" "}
              {GIVEAWAY_WINNERS_LABEL}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-2">
              <Link to={GIVEAWAY_RULES_PATH}>Read the official rules</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <GiveawayOptInModal
        open={optInOpen}
        onOpenChange={setOptInOpen}
        isEntered={isEntered}
        isOptingIn={isOptingIn}
        onOptIn={optIn}
      />
    </div>
  );
};

export default ChallengeTool;
