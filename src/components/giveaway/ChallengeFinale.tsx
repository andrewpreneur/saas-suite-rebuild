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
    className="px-brand-wash rounded-xl px-4 py-8 text-center shadow-card ring-1 ring-inset ring-brand/10 sm:px-8 sm:py-12">
    {ended ? <>
      <span className="mx-auto grid size-12 place-items-center rounded-md bg-card text-brand shadow-card"><PartyPopper aria-hidden className="size-6" /></span>
      <p className="px-eyebrow mt-4">Move Your SaaS Challenge · 2026</p>
      <h2 className="mt-2 text-h3 tracking-tight text-foreground sm:text-h2">Congratulations to our winners</h2>
      <p role="status" className="mt-3 text-sm text-muted-foreground">The challenge has ended. Thank you to every agency that took part.</p>
      {myWinner && <p className="mt-4 inline-flex rounded-full bg-card px-4 py-1.5 text-sm font-semibold text-brand shadow-card">You’re a {ordinal(Number(myWinner.rank))} place winner</p>}
      {winners.length ? <div className="mx-auto mt-7 grid max-w-4xl gap-4 sm:grid-cols-3">
        {winners.map(winner => {
          const rank = Number(winner.rank);
          const prize = GIVEAWAY_PRIZES[rank - 1];
          const Icon = rank === 1 ? Crown : Medal;
          return <article key={rank} className="px-surface min-w-0 p-5">
            <span className="px-icon-chip mx-auto !grid"><Icon aria-hidden className="size-5" /></span>
            <div><Badge variant="brand" className="mt-3">{ordinal(rank)} place winner</Badge></div>
            <h3 className="mt-3 break-words text-base font-semibold text-foreground">{winner.display_name}</h3>
            <p className="mt-1 text-h2 tabular-nums tracking-tight text-foreground">${prize?.amount.toLocaleString()}</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">{winner.points.toLocaleString()} points</p>
          </article>;
        })}
      </div> : <p className="mt-6 text-muted-foreground">Winner standings are loading…</p>}
      <div className="mx-auto mt-7 max-w-2xl space-y-2">
        <p className="text-sm font-semibold text-foreground">Payments will be arranged personally and facilitated by Stripe.</p>
        <p className="text-sm text-muted-foreground">Processing will finish in {CHALLENGE_PAYOUT_BUSINESS_DAYS.min}–{CHALLENGE_PAYOUT_BUSINESS_DAYS.max} business days after payout arrangements are completed.</p>
        <p className="text-xs text-muted-foreground">Standings and prize eligibility are subject to the final review under the Official Rules.</p>
      </div>
    </> : <>
      <span className="mx-auto grid size-12 place-items-center rounded-md bg-card text-brand shadow-card"><Timer aria-hidden className="size-6" /></span>
      <h2 className="mt-4 text-h3 tracking-tight text-foreground">The final hour</h2>
      <p className="mt-2 text-sm text-muted-foreground">Countdown to midnight · Central Time (Chicago)</p>
      <div role="timer" aria-label="Time remaining until midnight Central" className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3">
        {[[hours, "Hours"], [minutes, "Minutes"], [seconds, "Seconds"]].map(([value, label]) =>
          <div key={label} className="px-surface min-w-0 py-4">
            <span className="block text-h1 tabular-nums text-foreground">{String(value).padStart(2, "0")}</span>
            <span className="px-eyebrow mt-1 block">{label}</span>
          </div>)}
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Trophy aria-hidden className="h-4 w-4 text-brand" />$10,000 · Three winners</p>
    </>}
  </section>;
}