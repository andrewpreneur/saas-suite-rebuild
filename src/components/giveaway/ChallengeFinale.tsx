import { useEffect } from "react";
import confetti from "canvas-confetti";
import { Crown, Medal, PartyPopper, Timer, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GIVEAWAY_PRIZES, type GiveawayLeader, type GiveawayMe } from "@/constants/giveaway";
import { useChallengeFinale } from "@/hooks/useChallengeFinale";
import { challengeWinners, CHALLENGE_PAYOUT_BUSINESS_DAYS } from "@/lib/challengeFinale";
import { ordinal } from "@/lib/challengePlace";

export default function ChallengeFinale({ leaders, me, refresh }: {
  leaders: GiveawayLeader[];
  me: GiveawayMe | null;
  refresh: () => Promise<void>;
}) {
  const { visible, ended, secondsRemaining } = useChallengeFinale();
  const winners = challengeWinners(leaders);
  const myWinner = winners.find(winner => winner.display_name === me?.display_name && Number(winner.rank) === Number(me?.rank));

  useEffect(() => {
    if (ended) void refresh();
  }, [ended, refresh]);

  useEffect(() => {
    if (!ended || winners.length === 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const key = "challenge-finale-celebrated-2026";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    const burst = () => confetti({ particleCount: 140, spread: 120, origin: { y: 0.35 }, disableForReducedMotion: true });
    burst();
    const timer = window.setTimeout(burst, 650);
    return () => window.clearTimeout(timer);
  }, [ended, winners.length]);

  if (!visible) return null;
  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  return <section aria-label={ended ? "Challenge celebration" : "Final hour countdown"}
    className="border-y border-primary/30 bg-accent/40 px-4 py-8 text-center sm:px-8 sm:py-12">
    {ended ? <>
      <PartyPopper aria-hidden className="mx-auto h-12 w-12 text-primary" />
      <p className="mt-3 text-sm font-semibold uppercase text-muted-foreground">Move Your SaaS Challenge · 2026</p>
      <h2 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">Congratulations to our winners!</h2>
      <p role="status" className="mt-3 text-sm text-muted-foreground">The challenge has ended. Thank you to every agency that took part.</p>
      {myWinner && <p className="mt-5 text-xl font-bold text-primary">You’re a {ordinal(Number(myWinner.rank))} place winner!</p>}
      {winners.length ? <div className="mx-auto mt-7 grid max-w-4xl gap-4 sm:grid-cols-3">
        {winners.map(winner => {
          const rank = Number(winner.rank);
          const prize = GIVEAWAY_PRIZES[rank - 1];
          const Icon = rank === 1 ? Crown : Medal;
          return <article key={rank} className="min-w-0 rounded-lg border border-primary/30 bg-background p-5">
            <Icon aria-hidden className="mx-auto h-9 w-9 text-primary" />
            <Badge variant="secondary" className="mt-3">{ordinal(rank)} place winner</Badge>
            <h3 className="mt-3 break-words text-xl font-bold text-foreground">{winner.display_name}</h3>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">${prize?.amount.toLocaleString()}</p>
            <p className="mt-2 text-sm tabular-nums text-muted-foreground">{winner.points.toLocaleString()} points</p>
          </article>;
        })}
      </div> : <p className="mt-6 text-muted-foreground">Winner standings are loading…</p>}
      <div className="mx-auto mt-7 max-w-2xl space-y-2">
        <p className="text-base font-semibold text-foreground">Payments will be arranged personally and facilitated by Stripe.</p>
        <p className="text-sm text-muted-foreground">Processing will finish in {CHALLENGE_PAYOUT_BUSINESS_DAYS.min}–{CHALLENGE_PAYOUT_BUSINESS_DAYS.max} business days after payout arrangements are completed.</p>
        <p className="text-xs text-muted-foreground">Standings and prize eligibility are subject to the final review under the Official Rules.</p>
      </div>
    </> : <>
      <Timer aria-hidden className="mx-auto h-8 w-8 text-primary" />
      <h2 className="mt-3 text-2xl font-bold text-foreground">The final hour</h2>
      <p className="mt-2 text-sm text-muted-foreground">Countdown to midnight · Central Time (Chicago)</p>
      <div role="timer" aria-label="Time remaining until midnight Central" className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
        {[[hours, "Hours"], [minutes, "Minutes"], [seconds, "Seconds"]].map(([value, label]) =>
          <div key={label} className="min-w-0 border-b-2 border-primary/40 pb-3">
            <span className="block text-5xl font-extrabold tabular-nums text-foreground">{String(value).padStart(2, "0")}</span>
            <span className="mt-2 block text-xs font-medium uppercase text-muted-foreground">{label}</span>
          </div>)}
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Trophy aria-hidden className="h-4 w-4 text-primary" />$10,000 · Three winners</p>
    </>}
  </section>;
}