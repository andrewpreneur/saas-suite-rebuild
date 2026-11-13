import { useState } from "react";
import { Link } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Trophy,
  Users,
  ArrowRight,
  Sparkles,
  CalendarDays,
  Ticket,
  PlayCircle,
  ListChecks,
  CalendarCheck,
  Slack,
  Flame,
} from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useGiveaway } from "@/hooks/useGiveaway";
import GiveawayLeaderboard from "@/components/giveaway/GiveawayLeaderboard";
import ChallengeFinale from "@/components/giveaway/ChallengeFinale";
import { useChallengeFinale } from "@/hooks/useChallengeFinale";
import GiveawayOptInModal from "@/components/giveaway/GiveawayOptInModal";
import { navigateWithParams } from "@/utils/preserveParams";
import {
  GIVEAWAY_NAME,
  GIVEAWAY_POINT_RULES,
  GIVEAWAY_PRIZES,
  GIVEAWAY_FAIR_START_RULE,
  GIVEAWAY_TOTAL,
  GIVEAWAY_START_LABEL,
  GIVEAWAY_START_SHORT,
  GIVEAWAY_START_ISO,
  GIVEAWAY_WINNERS_LABEL,
  GIVEAWAY_LEVELUP_URL,
  GIVEAWAY_END_LABEL,
  GIVEAWAY_END_SHORT,
  GIVEAWAY_END_ISO,
  GIVEAWAY_RULES_PATH,
  GIVEAWAY_PATH,
} from "@/constants/giveaway";
import { PODIUM_TIERS as TIERS } from "@/components/giveaway/podiumTiers";

/** Signup destination: skips onboarding and lands on the dashboard entry form. */
const SIGNUP_HREF = "/signup?next=%2Fapp%2Fdashboard%3Fchallenge%3D1";

const blurIn = (delay: number) => ({
  animation: `fadeInFromBlur 0.7s ease-out ${delay}s forwards`,
});

const POINT_ICONS = {
  users_onboarded: Users,
  module_completions: PlayCircle,
  checklist_completions: ListChecks,
  login_days: CalendarCheck,
  slack_connected: Slack,
} as const;

const POINT_ACCENTS: Record<string, string> = {
  users_onboarded: "from-violet-500/15 via-violet-500/5 text-violet-600 dark:text-violet-300",
  module_completions:
    "from-emerald-500/15 via-emerald-500/5 text-emerald-600 dark:text-emerald-300",
  checklist_completions: "from-teal-500/15 via-teal-500/5 text-teal-600 dark:text-teal-300",
  login_days: "from-fuchsia-500/15 via-fuchsia-500/5 text-fuchsia-600 dark:text-fuchsia-300",
  slack_connected: "from-amber-500/15 via-amber-500/5 text-amber-600 dark:text-amber-300",
};

const Giveaway = () => {
  const { email } = useUser();
  const { stats, leaders, isEntered, isOptingIn, optIn, refresh } = useGiveaway();
  const { ended } = useChallengeFinale();
  const [optInOpen, setOptInOpen] = useState(false);

  const entrants = stats?.entrants ?? 0;
  const totalPoints = stats?.total_points ?? 0;

  const JoinCTA = ({ size = "lg" as const, className = "" }) => (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {ended ? <Button asChild size={size}><a href="#challenge-finale">See the winners <Trophy className="ml-2 h-4 w-4" /></a></Button> : email ? (
        isEntered ? (
          <Button asChild size={size} className="rounded-full px-8">
            <Link to="/app/dashboard">
              See your standings <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button
            size={size}
            onClick={() => setOptInOpen(true)}
            className="rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 px-8 text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:from-violet-700 hover:to-emerald-600"
          >
            Join the Challenge <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )
      ) : (
        <Button
          asChild
          size={size}
          className="rounded-full bg-gradient-to-r from-violet-600 to-emerald-500 px-8 text-white shadow-lg transition-transform hover:-translate-y-0.5 hover:from-violet-700 hover:to-emerald-600"
        >
          <a href={navigateWithParams(SIGNUP_HREF)}>
            Join the Challenge <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      )}
      {!ended && <p className="text-sm text-muted-foreground">Create a free SaaSSuite account to join</p>}
    </div>
  );

  return (
    <MarketingLayout>
      <PageSEO
        title="$10,000 Move Your SaaS Challenge | SaaSSuite"
        description="Join the free $10,000 Move Your SaaS Challenge. Compete against other SaaS agencies for 1st, 2nd and 3rd place. Starts August 17, 2026 and ends October 25, 2026."
        path={GIVEAWAY_PATH}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: `$${GIVEAWAY_TOTAL.toLocaleString()} ${GIVEAWAY_NAME}`,
          description: `A challenge for SaaSSuite agencies running August 17 – October 25, 2026. Earn points for real platform growth and compete for $10,000 in prizes. The challenge ends ${GIVEAWAY_END_LABEL}. Winners announced ${GIVEAWAY_WINNERS_LABEL}.`,
          startDate: GIVEAWAY_START_ISO,
          endDate: GIVEAWAY_END_ISO,
          eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
          organizer: { "@type": "Organization", name: "SaaSSuite", url: "https://saassuite.ai" },
        }}
      />

      <div id="challenge-finale"><ChallengeFinale leaders={leaders} me={stats?.me ?? null} refresh={refresh} /></div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-violet-500/10 via-emerald-500/5 to-background">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-violet-500/20 blur-3xl"
        />
        <div className="relative mx-auto max-w-4xl px-6 py-16 text-center md:py-24">
          <div className="opacity-0" style={blurIn(0.1)}>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              <Sparkles className="h-3.5 w-3.5" />
              GHL Agencies: Introducing…
            </span>
          </div>

          <h1
            className="mt-6 text-4xl font-extrabold leading-tight text-foreground opacity-0 md:text-6xl"
            style={blurIn(0.3)}
          >
            The 2026 “Move Your SaaS” Challenge
          </h1>

          <p
            className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground opacity-0 md:text-lg"
            style={blurIn(0.5)}
          >
            Compete against other SaaS agencies to win 1st, 2nd, or 3rd place — $
            {GIVEAWAY_TOTAL.toLocaleString()} in cash prizes for the agencies who actually move
            their SaaS forward.
          </p>

          <div className="mt-8 opacity-0" style={blurIn(0.7)}>
            <JoinCTA />
          </div>

          <div
            className="mt-10 flex flex-wrap items-center justify-center gap-8 opacity-0"
            style={blurIn(0.9)}
          >
            <LiveStat icon={Users} value={entrants.toLocaleString()} label="agencies entered" />
            <LiveStat icon={Flame} value={totalPoints.toLocaleString()} label="points earned" />
            <LiveStat
              icon={Trophy}
              value={`$${GIVEAWAY_TOTAL.toLocaleString()}`}
              label="in cash prizes"
            />
          </div>
        </div>
      </section>

      {/* Podium */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">The podium</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
          Three winners. One leaderboard. Every point earned from real platform growth.
        </p>

        <div className="mt-12 grid items-end gap-4 md:grid-cols-3">
          <PodiumCard prize={GIVEAWAY_PRIZES[1]} tier="silver" className="md:order-1" />
          <PodiumCard prize={GIVEAWAY_PRIZES[0]} tier="gold" className="md:order-2" />
          <PodiumCard prize={GIVEAWAY_PRIZES[2]} tier="bronze" className="md:order-3" />
        </div>

        {/* Bonus */}
        <Card className="mt-10 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-violet-500/5 to-transparent">
          <CardContent className="flex flex-col gap-3 p-6 md:flex-row md:items-center">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
              <Ticket className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Bonus · LevelUp ticket
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Whoever is sitting in{" "}
                <strong className="text-foreground">1st, 2nd or 3rd place</strong> when the
                challenge ends{" "}
                <strong className="text-foreground">{GIVEAWAY_END_LABEL}</strong> also
                gets a chance at winning a free ticket to{" "}
                <a
                  href={GIVEAWAY_LEVELUP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-primary underline"
                >
                  LevelUp
                </a>
                , HighLevel's annual summit in Dallas, TX. A free ticket is not guaranteed.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Official dates */}
      <section className="border-y bg-gradient-to-b from-violet-500/5 to-background">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="flex items-center justify-center gap-2 text-center">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">Official dates</h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <DateCard label="Starts" value={GIVEAWAY_START_SHORT} detail={GIVEAWAY_START_LABEL} />
            <DateCard label="Ends" value={GIVEAWAY_END_SHORT} detail={GIVEAWAY_END_LABEL} />
            <DateCard
              label="Winners announced"
              value={GIVEAWAY_WINNERS_LABEL}
              detail="The day after the challenge closes."
            />
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            The challenge ends <strong className="text-foreground">{GIVEAWAY_END_LABEL}</strong>.
            Winners are announced{" "}
            <strong className="text-foreground">{GIVEAWAY_WINNERS_LABEL}</strong>.{" "}
            <a
              href={GIVEAWAY_LEVELUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary underline"
            >
              LevelUp
            </a>{" "}
            is HighLevel's annual summit — a free ticket is not guaranteed. Entry is free — no
            purchase necessary. 18+, U.S. residents only.{" "}
            <Link to={GIVEAWAY_RULES_PATH} className="font-medium text-primary underline">
              Official Rules
            </Link>
            .
          </p>
          <div className="mt-8">
            <JoinCTA />
          </div>
        </div>
      </section>

      {/* Points */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <Badge className="mb-3 bg-violet-600 text-white hover:bg-violet-600">
          Scoreboard rules
        </Badge>
        <h2 className="text-2xl font-bold text-foreground md:text-3xl">How you earn points</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every point comes from activity we already track in your platform — no forms, no
          screenshots. Scores update automatically, live.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {GIVEAWAY_POINT_RULES.map((rule, i) => {
            const Icon = POINT_ICONS[rule.key as keyof typeof POINT_ICONS] ?? Trophy;
            const accent = POINT_ACCENTS[rule.key] ?? "from-primary/15 via-primary/5 text-primary";
            return (
              <Card
                key={rule.key}
                className={`group overflow-hidden border-border bg-gradient-to-br to-transparent opacity-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${accent}`}
                style={blurIn(0.1 + i * 0.08)}
              >
                <CardContent className="flex items-start gap-4 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/70 shadow-sm transition-transform group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{rule.label}</p>
                      <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-xs font-bold shadow-sm">
                        {rule.points}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{rule.detail}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent">
            <CardContent className="flex items-start gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/70 shadow-sm">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
              </span>
              <div>
                <p className="font-semibold text-foreground">Fair start</p>
                <p className="mt-1 text-sm text-muted-foreground">{GIVEAWAY_FAIR_START_RULE}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Login points are capped at one point per end user per calendar day. Full scoring detail
          lives in the{" "}
          <Link to={GIVEAWAY_RULES_PATH} className="font-medium text-primary underline">
            Official Rules
          </Link>
          .
        </p>

        <div className="mt-10">
          <JoinCTA />
        </div>
      </section>

      {/* Live leaderboard */}
      <section className="border-t bg-gradient-to-b from-background via-violet-500/5 to-background">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <div className="mb-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live standings
            </span>
            <h2 className="mt-4 text-2xl font-bold text-foreground md:text-3xl">
              Who's winning right now
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Updates the moment someone joins or earns points. Names only — no emails or account
              details are ever shown.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
              <Badge variant="secondary">{entrants.toLocaleString()} entered</Badge>
              <Badge variant="secondary">{totalPoints.toLocaleString()} points scored</Badge>
            </div>
          </div>
          <GiveawayLeaderboard leaders={leaders} myName={stats?.me?.display_name} limit={25} />
          <div className="mt-10">
            <JoinCTA />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t bg-gradient-to-br from-violet-600/10 via-emerald-500/10 to-background">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <Trophy className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-4 text-2xl font-bold text-foreground md:text-3xl">
            {GIVEAWAY_START_SHORT} → {GIVEAWAY_END_SHORT}. Move your SaaS.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Join, grow your accounts, and climb the board. First place walks away with $5,000.
            The challenge ends {GIVEAWAY_END_LABEL}. Winners are announced{" "}
            <strong className="text-foreground">{GIVEAWAY_WINNERS_LABEL}</strong>.
          </p>
          <div className="mt-8">
            <JoinCTA />
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            No purchase or payment of any kind is necessary to enter or win. Skill-based contest —
            winners are determined by measured performance, not by chance. Void where prohibited.{" "}
            <Link to={GIVEAWAY_RULES_PATH} className="font-medium text-primary underline">
              Official Rules
            </Link>
            . Sponsor: DNA Media Consulting LLC.
          </p>
        </div>
      </section>

      <GiveawayOptInModal
        open={optInOpen}
        onOpenChange={setOptInOpen}
        isEntered={isEntered}
        isOptingIn={isOptingIn}
        onOptIn={optIn}
      />
    </MarketingLayout>
  );
};

const PodiumCard = ({
  prize,
  tier,
  className = "",
}: {
  prize: { place: string; amount: number; note: string };
  tier: keyof typeof TIERS;
  className?: string;
}) => {
  const t = TIERS[tier];
  const isGold = tier === "gold";
  return (
    <Card
      className={`relative overflow-hidden border-2 bg-gradient-to-b text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${t.ring} ${t.bg} ${t.height} ${className}`}
    >
      <CardContent className={`p-6 ${isGold ? "pt-9" : ""}`}>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${t.chip}`}
        >
          <Trophy className="h-3.5 w-3.5" />
          {t.label}
        </span>
        <p className="mt-4 text-sm font-medium text-muted-foreground">{prize.place}</p>
        <p
          className={`font-extrabold text-foreground ${isGold ? "text-5xl md:text-6xl" : "text-4xl"}`}
        >
          ${prize.amount.toLocaleString()}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">{prize.note}</p>
      </CardContent>
    </Card>
  );
};

const DateCard = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <Card className="border-border bg-card/80">
    <CardContent className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </CardContent>
  </Card>
);

const LiveStat = ({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: string;
  label: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-emerald-500/20">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div className="text-left">
      <p className="text-xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

export default Giveaway;
