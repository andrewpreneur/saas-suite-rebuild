import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/platform/PageHeader";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { SectionCard } from "@/components/premium/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Gift, Star } from "lucide-react";
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
    <div className="space-y-6">
      <PageHeader
        eyebrow={GIVEAWAY_RANGE_SHORT}
        title={GIVEAWAY_NAME}
        subtitle={
          ended
            ? "The challenge has ended. Here are the final standings."
            : "Earn points as your clients onboard. The top three agencies win."
        }
        actions={
          <>
            <Badge variant={ended ? "neutral" : "success"} className="shrink-0 gap-1.5">
              <span className="relative flex size-1.5" aria-hidden>
                {!ended && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:hidden" />
                )}
                <span className={"relative inline-flex size-1.5 rounded-full " + (ended ? "bg-muted-foreground" : "bg-success")} />
              </span>
              {ended ? "Ended" : "Live"}
            </Badge>
            {!ended && !isLoading && !isEntered && (
              <Button variant="accent" className="h-11 sm:h-10" onClick={() => setOptInOpen(true)}>
                <Gift className="mr-1.5 h-4 w-4" />
                Enter the challenge
              </Button>
            )}
          </>
        }
      />

      <Reveal className="space-y-4 sm:space-y-6">
        <RevealItem className="space-y-4 empty:hidden sm:space-y-6">
          <ChallengeFinale leaders={leaders} me={me} refresh={refresh} />
          <ChallengePointReview />
        </RevealItem>

        <RevealItem>
          {isLoading ? (
            <div className="px-surface space-y-3 p-4 sm:p-6" aria-busy="true">
              <span className="sr-only">Loading live standings…</span>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="px-skeleton h-12" />
              ))}
            </div>
          ) : (
            <GiveawayLeaderboard leaders={leaders} myName={me?.display_name} limit={50} />
          )}
        </RevealItem>

        {/* Once the challenge ends the winners card above already shows the podium. */}
        {!isLoading && !ended && (
          <RevealItem>
            <ChallengePodium leaders={leaders} me={me} />
          </RevealItem>
        )}

        <RevealItem>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <SectionCard
              icon={<Star />}
              title="How to earn points"
              description={
                me
                  ? `You have ${me.points.toLocaleString()} pts${me.rank ? ` · ${ordinal(Number(me.rank))} place` : ""}`
                  : "Every action below adds to your score"
              }
            >
              <ul className="divide-y divide-border">
                {GIVEAWAY_POINT_RULES.map((rule) => {
                  const earned = me ? pointsForRule(rule.key, me.breakdown) : null;
                  return (
                    <li key={rule.key} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{rule.label}</p>
                        <p className="shrink-0 text-xs font-semibold tabular-nums text-brand">
                          {earned != null && earned > 0 ? `+${earned.toLocaleString()} · ` : ""}
                          {rule.points}
                        </p>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{rule.detail}</p>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>

            <SectionCard icon={<CalendarDays />} title="Dates and rules" description="All times are Central Time">
              <dl className="divide-y divide-border text-sm">
                {[
                  ["Starts", GIVEAWAY_START_LABEL],
                  ["Ends", GIVEAWAY_END_LABEL],
                  ["Winners announced", GIVEAWAY_WINNERS_LABEL],
                ].map(([term, value]) => (
                  <div key={term} className="flex flex-col gap-0.5 py-3 first:pt-0 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="text-muted-foreground">{term}</dt>
                    <dd className="font-medium text-foreground sm:text-right">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-xs text-muted-foreground">{GIVEAWAY_TICKET_NOTE}</p>
              <Button asChild variant="outline" size="sm" className="mt-4 h-11 sm:h-9">
                <Link to={GIVEAWAY_RULES_PATH}>Read the official rules</Link>
              </Button>
            </SectionCard>
          </div>
        </RevealItem>
      </Reveal>

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
