import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Users, PlayCircle, ListChecks, CalendarCheck, Slack, Rocket, ArrowRight } from "lucide-react";
import { GIVEAWAY_NAME } from "@/constants/giveaway";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the "make sure SaaSSuite is installed" CTA sends the user. */
  installHref?: string;
}

const STEPS = [
  {
    title: "Points for real growth",
    blurb: "Every point you score comes from work you're already doing inside SaaSSuite. No forms, no screenshots.",
    accent: "from-brand/20 via-brand/10 to-transparent",
    items: [
      { icon: Users, label: "Onboard a net-new end user", points: "1 pt each" },
      { icon: PlayCircle, label: "End user completes a training video", points: "1 pt each" },
    ],
  },
  {
    title: "Keep them active",
    blurb: "Retention scores too — the more your users show up and finish things, the higher you climb.",
    accent: "from-emerald-500/20 via-teal-500/10 to-transparent",
    items: [
      { icon: ListChecks, label: "End user finishes an onboarding checklist", points: "1 pt each" },
      { icon: CalendarCheck, label: "End-user login days", points: "1 pt / user / day" },
      { icon: Slack, label: "Install the SaaSSuite Slack app", points: "20 pts" },
    ],
  },
  {
    title: "Make sure SaaSSuite is installed",
    blurb:
      "Your points only track once SaaSSuite is live in your HighLevel agency. Run the installation guide now — it takes about 10 minutes.",
    accent: "from-amber-500/20 via-orange-500/10 to-transparent",
    items: [],
  },
] as const;

/** 3-step gamified explainer shown right after someone enters the challenge. */
const GiveawayPointsTour = ({ open, onOpenChange, installHref = "/app/walkthrough" }: Props) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setStep(0);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <div className={`-mx-6 -mt-6 bg-gradient-to-br ${current.accent} px-6 pb-5 pt-6`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Trophy className="h-4 w-4" /> You're in · {GIVEAWAY_NAME}
          </div>
          <h2 className="mt-2 text-xl font-extrabold text-foreground">{current.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{current.blurb}</p>
        </div>

        {current.items.length > 0 ? (
          <ul className="space-y-2">
            {current.items.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-transform hover:-translate-y-0.5"
              >
                <span className="flex min-w-0 items-center gap-2.5 text-sm text-foreground">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-4 w-4 text-primary" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                  {item.points}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
            <Rocket className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-2 text-sm font-semibold text-foreground">
              Install SaaSSuite to start scoring
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              The guided walkthrough gets your menu link, branding and onboarding live.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.title}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button asChild>
                <a href={installHref}>
                  Make sure SaaSSuite is installed <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GiveawayPointsTour;
