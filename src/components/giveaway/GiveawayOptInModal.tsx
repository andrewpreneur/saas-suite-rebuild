import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Gift, Check } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import GiveawayPointsTour from "@/components/giveaway/GiveawayPointsTour";
import {
  GIVEAWAY_NAME,
  GIVEAWAY_START_SHORT,
  GIVEAWAY_END_SHORT,
  GIVEAWAY_END_LABEL,
  GIVEAWAY_WINNERS_LABEL,
  GIVEAWAY_LEVELUP_URL,
  GIVEAWAY_POINT_RULES,
  GIVEAWAY_PRIZES,
  GIVEAWAY_FAIR_START_RULE,
  GIVEAWAY_RULES_PATH,
} from "@/constants/giveaway";

const DISMISS_KEY = "giveaway_optin_dismissed_v1";

interface Props {
  /** Controlled open state — when provided the auto-prompt is bypassed. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Whether the signed-in user has already entered. */
  isEntered: boolean;
  isOptingIn: boolean;
  onOptIn: (displayName?: string, acceptRules?: boolean) => Promise<{ ok: boolean; error?: string }>;
  /** Auto-prompt once per browser for users who haven't entered. */
  autoPrompt?: boolean;
}

/**
 * Opt-in modal for the $10,000 giveaway. Only the display name is public —
 * emails and account details are never shown on the leaderboard.
 */
const GiveawayOptInModal = ({
  open,
  onOpenChange,
  isEntered,
  isOptingIn,
  onOptIn,
  autoPrompt = false,
}: Props) => {
  const { email } = useUser();
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? !!open : internalOpen;

  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
    if (!next && autoPrompt) {
      try {
        localStorage.setItem(DISMISS_KEY, "1");
      } catch {
        /* private mode */
      }
    }
  };

  // Never interrupt a brand-new account: the challenge prompt stays quiet for
  // the first 24 hours so first-time setup stays focused.
  useEffect(() => {
    if (!autoPrompt || isControlled || isEntered || !email) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (dismissed) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const { data } = await supabase
        .from("saas_suite_users")
        .select("created_at")
        .ilike("email", email)
        .maybeSingle();
      if (cancelled) return;
      if (data?.created_at) {
        const ageMs = Date.now() - new Date(data.created_at).getTime();
        if (ageMs < 24 * 60 * 60 * 1000) return;
      }
      timer = setTimeout(() => {
        if (!cancelled) setInternalOpen(true);
      }, 1200);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [autoPrompt, isControlled, isEntered, email]);

  const handleOptIn = async () => {
    if (!name.trim()) {
      toast.error("Enter your full legal name to continue");
      return;
    }
    if (!accepted) {
      toast.error("You must agree to the Official Rules to enter");
      return;
    }
    const res = await onOptIn(name, true);
    if (res.ok) {
      toast.success("You're in! Points start tracking from right now.");
      setOpen(false);
      setTourOpen(true);
    } else {
      toast.error(res.error || "Could not enter the giveaway");
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle>$10,000 {GIVEAWAY_NAME}</DialogTitle>
          <DialogDescription>
            {GIVEAWAY_PRIZES.map((p) => `${p.place}: $${p.amount.toLocaleString()}`).join(" · ")}.
            Runs {GIVEAWAY_START_SHORT} → {GIVEAWAY_END_SHORT} — earn points for real growth inside
            the platform.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            Official dates: {GIVEAWAY_START_SHORT} → {GIVEAWAY_END_SHORT}.
          </span>{" "}
          Winners are announced {GIVEAWAY_WINNERS_LABEL}. The challenge ends {GIVEAWAY_END_LABEL}.{" "}
          <span className="block mt-1">
            Bonus: whoever sits in 1st, 2nd or 3rd when the challenge ends gets a chance at winning
            a free LevelUp ticket (Dallas, TX) — not guaranteed.
          </span>
          <a
            href={GIVEAWAY_LEVELUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline"
          >
            Learn more at summit.gohighlevel.com
          </a>
        </div>

        {isEntered ? (
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            You're already entered. Your standings update live on the dashboard.
          </div>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2">
              {GIVEAWAY_POINT_RULES.map((rule) => (
                <li key={rule.key} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{rule.label}</span> — {rule.points}
                    <span className="block text-xs">{rule.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <p className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              {GIVEAWAY_FAIR_START_RULE}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="giveaway-name">Full legal name</Label>
              <Input
                id="giveaway-name"
                value={name}
                maxLength={80}
                placeholder="Your full legal name (shown on the public leaderboard)"
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex items-start gap-2">
              <Checkbox
                id="giveaway-rules"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="giveaway-rules" className="text-xs font-normal leading-relaxed text-muted-foreground">
                I have read and agree to the{" "}
                <a
                  href={GIVEAWAY_RULES_PATH}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline"
                >
                  Official Rules
                </a>
                . No purchase necessary. 18+, U.S. residents only.
              </Label>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {isEntered ? "Close" : "Maybe later"}
          </Button>
          {!isEntered && (
            <Button onClick={handleOptIn} disabled={isOptingIn || !accepted || !name.trim()}>
              {isOptingIn ? "Entering…" : "Enter the Challenge"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <GiveawayPointsTour open={tourOpen} onOpenChange={setTourOpen} />
    </>
  );
};

export default GiveawayOptInModal;
