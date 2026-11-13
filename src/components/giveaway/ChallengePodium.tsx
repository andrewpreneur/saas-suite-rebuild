import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { GIVEAWAY_PRIZES, type GiveawayLeader, type GiveawayMe } from "@/constants/giveaway";
import {
  PODIUM_SLOT_ORDER,
  PODIUM_TIERS,
  type PodiumTier,
} from "@/components/giveaway/podiumTiers";
import { challengePlaceStatus, initialsOf } from "@/lib/challengePlace";

/**
 * Extra padding inside the card, not a negative margin, so 1st is tallest
 * while the whole step stays inside the podium row.
 */
const STEP: Record<PodiumTier, string> = {
  gold: "pb-10 sm:pb-14",
  silver: "pb-4 sm:pb-6",
  bronze: "pb-1.5 sm:pb-2",
};

/**
 * In-app podium. Same gold / silver / bronze blocks as the public /challenge
 * page, filled with the live top three instead of prize cards alone.
 */
const ChallengePodium = ({ leaders, me }: { leaders: GiveawayLeader[]; me: GiveawayMe | null }) => {
  const myAvatarUrl = useMyAvatar();
  const status = challengePlaceStatus(me, leaders);
  const myRank = me?.rank == null ? null : Number(me.rank);

  return (
    <section className="py-6 sm:py-8" aria-label="Podium">
      <div className="mx-auto w-full max-w-[680px]">
        {status.kind === "podium" ? (
          <div
            role="status"
            className={cn(
              "rounded-lg border px-3 py-2 text-center",
              status.rank === 1 &&
                "border-amber-400/70 bg-gradient-to-r from-amber-300/30 via-amber-200/10 to-transparent",
              status.rank === 2 &&
                "border-slate-300/80 bg-gradient-to-r from-slate-300/40 via-slate-200/10 to-transparent",
              status.rank === 3 &&
                "border-orange-400/60 bg-gradient-to-r from-orange-400/25 via-orange-300/10 to-transparent",
            )}
          >
            <p className="text-sm font-extrabold text-foreground sm:text-base">{status.banner}</p>
          </div>
        ) : status.kind === "chasing" ? (
          <div
            role="status"
            className="rounded-lg border border-border bg-card px-3 py-2 text-center"
          >
            <p className="text-sm font-semibold text-foreground">{status.rankLabel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{status.gapLabel}</p>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">{status.message}</p>
        )}

        <div className="podium-grid mt-6 grid grid-cols-3 items-end gap-4 sm:mt-8 sm:gap-6">
          {PODIUM_SLOT_ORDER.map((slot) => {
            const leader = leaders.find((row) => Number(row.rank) === slot.rank);
            const prize = GIVEAWAY_PRIZES[slot.prizeIndex];
            const isMe = myRank === slot.rank;
            return (
              <PodiumSlot
                key={slot.rank}
                tier={slot.tier}
                place={prize.place}
                amount={prize.amount}
                name={leader?.display_name}
                points={leader?.points}
                isMe={isMe}
                avatarUrl={isMe ? myAvatarUrl : null}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
};

const PodiumSlot = ({
  tier,
  place,
  amount,
  name,
  points,
  isMe,
  avatarUrl,
}: {
  tier: PodiumTier;
  place: string;
  amount: number;
  name?: string;
  points?: number;
  isMe: boolean;
  avatarUrl?: string | null;
}) => {
  const tone = PODIUM_TIERS[tier];
  const isGold = tier === "gold";
  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-lg border bg-gradient-to-b text-center shadow-sm",
        tone.ring,
        tone.bg,
        isMe && "ring-2 ring-primary/60 shadow-[0_0_16px_-6px_hsl(var(--primary)/0.55)]",
      )}
    >
      <div className={cn("px-1.5 pt-2 sm:px-3 sm:pt-3", STEP[tier])}>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide sm:px-2 sm:text-[10px]",
            tone.chip,
          )}
        >
          <Trophy className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
          {tone.place}
          <span className="hidden sm:inline">· {tone.label}</span>
        </span>

        <Avatar className={cn("mx-auto mt-2 h-7 w-7 border sm:h-9 sm:w-9", tone.ring)}>
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className={cn("text-[10px] font-bold sm:text-xs", tone.chip)}>
            {name ? initialsOf(name) : "?"}
          </AvatarFallback>
        </Avatar>

        <p className="mt-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold leading-tight text-foreground sm:text-xs">
          <span className="truncate">{name || "Open spot"}</span>
          {isMe && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-primary">
              You
            </span>
          )}
        </p>
        <p
          className={cn(
            "mt-1 font-extrabold tabular-nums leading-none text-foreground",
            isGold ? "text-lg sm:text-2xl" : "text-base sm:text-xl",
          )}
        >
          {points == null ? "—" : points.toLocaleString()}
        </p>
        <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">
          pts
        </p>
        <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
          {place}
          <span className="mt-0.5 block whitespace-nowrap font-semibold text-foreground">
            ${amount.toLocaleString()}
          </span>
        </p>
      </div>
    </Card>
  );
};

/** Community photo for the signed-in user, shown only on their own podium. */
function useMyAvatar() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("community_profiles")
        .select("avatar_url")
        .eq("id", uid)
        .maybeSingle();
      if (active) setUrl(data?.avatar_url ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);
  return url;
}

export default ChallengePodium;
