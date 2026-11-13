import { useCallback, useEffect, useState } from "react";
import { Check, Gift, MessageSquare, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type LockInStep = "free_trial" | "text_us" | "free_bonus";
const STEPS: LockInStep[] = ["free_trial", "text_us", "free_bonus"];

export const FREE_BONUS_URL = "https://gofreesaas.com/ai-studio-sales-video";
const SMS_NUMBER = "+13372270501";
const SMS_MESSAGE =
  "Hey Andrew, I want to sign up for SaaS Suite with the discount code. I am currently on this HighLevel plan: [YOUR PLAN] and have [NUMBER] customers.";

const storageKey = (email: string) => `ss_webinar_lockin_${email || "anon"}`;

/** Tracks which of the 3 lock-in steps a registrant has clicked (local + database). */
export function useLockInSteps(email: string, firstName: string) {
  const [done, setDone] = useState<LockInStep[]>([]);
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(storageKey(email)) || "[]"));
    } catch {
      /* ignore */
    }
  }, [email]);

  const complete = useCallback(
    (step: LockInStep) => {
      setDone((prev) => {
        const next = prev.includes(step) ? prev : [...prev, step];
        try {
          localStorage.setItem(storageKey(email), JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void (supabase as any)
        .from("webinar_confirmation_steps")
        .insert({
          step,
          email: email || null,
          first_name: firstName && firstName !== "friend" ? firstName : null,
          page: window.location.pathname,
        })
        .then(({ error }: { error: unknown }) => error && console.warn("lock-in step save failed", error));
    },
    [email, firstName],
  );
  return { done, complete };
}

export function LockInProgressBar({ done }: { done: LockInStep[] }) {
  const count = STEPS.filter((s) => done.includes(s)).length;
  const finished = count === STEPS.length;
  const pct = Math.max(12, Math.round(((count + 1) / (STEPS.length + 1)) * 100));
  return (
    <div className="w-full border-b bg-card px-4 py-3">
      <div className="mx-auto max-w-xl">
        <p className="text-base font-bold text-foreground">
          {finished ? (
            "✅ All done — your training seat is locked in!"
          ) : (
            <>
              <span className="text-[hsl(var(--wc-danger))]">⚠️ Not finished yet:</span> complete {STEPS.length - count} more step
              {STEPS.length - count === 1 ? "" : "s"} below to lock in your seat.
            </>
          )}
        </p>
        <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              finished ? "bg-[hsl(var(--wc-success))]" : "animate-pulse bg-[hsl(var(--wc-danger))]"
            }`}
            style={{ width: `${finished ? 100 : pct}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Step {Math.min(count + 1, STEPS.length)} of {STEPS.length} · {count} completed
        </p>
      </div>
    </div>
  );
}

export function LockInSteps({
  done,
  complete,
  onStartTrial,
}: {
  done: LockInStep[];
  complete: (s: LockInStep) => void;
  onStartTrial: () => void;
}) {
  const items: {
    key: LockInStep;
    icon: typeof Rocket;
    title: string;
    body: React.ReactNode;
    cta: string;
    action: () => void;
  }[] = [
    {
      key: "free_trial",
      icon: Rocket,
      title: "Start your free 14-day Advanced trial",
      body: "Follow along live in your own SaaSSuite account. Cancel anytime before day 14.",
      cta: "Start My 14-Day Free Trial",
      action: () => {
        complete("free_trial");
        onStartTrial();
      },
    },
    {
      key: "text_us",
      icon: MessageSquare,
      title: "Text us for a SaaS Suite discount code",
      body: (
        <>
          We'll open a pre-written text. <strong className="text-foreground">Before sending, replace [YOUR PLAN] with your HighLevel plan and [NUMBER] with how many customers you have.</strong>
        </>
      ),
      cta: "Text Us for a Discount Code",
      action: () => {
        complete("text_us");
        window.location.href = `sms:${SMS_NUMBER}?&body=${encodeURIComponent(SMS_MESSAGE)}`;
      },
    },
    {
      key: "free_bonus",
      icon: Gift,
      title: "Claim your free bonus",
      body: "Grab the AI Studio white-label sales video — ready to sell to your clients under your brand.",
      cta: "Claim My Free Bonus",
      action: () => {
        complete("free_bonus");
        window.location.href = FREE_BONUS_URL;
      },
    },
  ];

  return (
    <section id="lock-in" className="scroll-mt-20 rounded-2xl border-2 border-[hsl(var(--wc-danger))] bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--wc-danger))]">Don't leave yet</p>
      <h2 className="mt-2 text-2xl font-extrabold text-foreground">3 steps to lock in your training seat</h2>
      <ol className="mt-4 space-y-4">
        {items.map((it, i) => {
          const isDone = done.includes(it.key);
          const Icon = it.icon;
          return (
            <li
              key={it.key}
              className={`rounded-xl border p-4 transition-colors ${
                isDone ? "border-[hsl(var(--wc-success))] bg-[hsl(var(--wc-success)/0.08)]" : "border-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isDone
                      ? "bg-[hsl(var(--wc-success))] text-primary-foreground"
                      : "bg-[hsl(var(--webinar2-accent))] text-[hsl(var(--webinar2-accent-foreground))]"
                  }`}
                >
                  {isDone ? <Check className="h-5 w-5" /> : i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <Icon className="h-5 w-5 shrink-0 text-[hsl(var(--webinar2-accent))]" aria-hidden="true" />
                    {it.title}
                  </h3>
                  <p className="mt-1 text-base text-muted-foreground">{it.body}</p>
                  <button
                    type="button"
                    onClick={it.action}
                    className={`mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-base font-bold hover:opacity-90 ${
                      isDone
                        ? "border-2 border-[hsl(var(--wc-success))] bg-card text-[hsl(var(--wc-success))]"
                        : "bg-[hsl(var(--webinar2-accent))] text-[hsl(var(--webinar2-accent-foreground))]"
                    }`}
                  >
                    {isDone ? `✓ Done — ${it.cta}` : it.cta}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
