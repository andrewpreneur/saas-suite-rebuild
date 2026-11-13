import { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Clock,
  Headphones,
  HelpCircle,
  ListChecks,
  MessageSquareQuote,
  Quote,
  Sparkles,
  ThumbsUp,
  Timer,
  Trophy,
} from "lucide-react";
import { useSupportWins, type SupportCase } from "@/hooks/useSupportWins";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Counts up to a number whenever it becomes visible again. */
const useCountUp = (target: number, active: boolean, duration = 900) => {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    if (target <= 0) {
      setValue(0);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active, duration]);
  return value;
};

const CountBubble = ({
  value,
  label,
  active,
  tone = "purple",
}: {
  value: number;
  label: string;
  active: boolean;
  tone?: "purple" | "blue" | "green";
}) => {
  const shown = useCountUp(value, active);
  const tones = {
    purple: "bg-brand",
    blue: "bg-info",
    green: "bg-success",
  } as const;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md ${tones[tone]} text-lg font-bold text-white`}
        aria-hidden="true"
      >
        {shown}
      </span>
      <span className="text-xs font-medium leading-snug text-muted-foreground">{label}</span>
    </div>
  );
};

const Stat = ({ icon: Icon, value, label }: { icon: typeof Clock; value: string; label: string }) => (
  <div className="rounded-lg border border-border bg-card p-5 text-center shadow-card">
    <Icon className="mx-auto mb-2 h-6 w-6 text-brand" aria-hidden="true" />
    <div className="text-h3 text-foreground">{value}</div>
    <div className="mt-1 text-sm text-muted-foreground">{label}</div>
  </div>
);

const ChannelBadge = ({ channel }: { channel: SupportCase["channel"] }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
      channel === "ai" ? "bg-blue-50 text-info" : "bg-brand-subtle text-brand"
    }`}
  >
    {channel === "ai" ? <Bot className="h-3 w-3" aria-hidden="true" /> : <Headphones className="h-3 w-3" aria-hidden="true" />}
    {channel === "ai" ? "AI support" : "Human support"}
  </span>
);

const CaseCard = ({ item, onOpen }: { item: SupportCase; onOpen: () => void }) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex h-full w-full flex-col rounded-lg border border-border bg-card p-6 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
  >
    <div className="flex items-center gap-3">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${
          item.channel === "ai" ? "bg-info" : "bg-brand"
        }`}
        aria-hidden="true"
      >
        {item.initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{item.headline}</p>
        <ChannelBadge channel={item.channel} />
      </div>
    </div>

    <blockquote className="mt-4 flex flex-1 gap-2 text-[15px] italic leading-relaxed text-foreground">
      <Quote className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
      <span>{item.quote}</span>
    </blockquote>

    <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-medium text-success">
        <ThumbsUp className="h-3 w-3" aria-hidden="true" /> {item.satisfaction}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
        <Timer className="h-3 w-3" aria-hidden="true" /> {item.time_to_result}
      </span>
      <span className="ml-auto font-medium text-brand">Walk through the case →</span>
    </div>
  </button>
);

type TabKey = "questions" | "summary" | "solution" | "outcome";

const TABS: { key: TabKey; label: string; icon: typeof HelpCircle }[] = [
  { key: "questions", label: "What they asked", icon: HelpCircle },
  { key: "summary", label: "What happened", icon: MessageSquareQuote },
  { key: "solution", label: "How we helped", icon: ListChecks },
  { key: "outcome", label: "The outcome", icon: Trophy },
];

const CaseDialog = ({ item, onClose }: { item: SupportCase | null; onClose: () => void }) => {
  const [tab, setTab] = useState<TabKey>("questions");
  const enteredRef = useRef(0);

  useEffect(() => {
    if (item) setTab("questions");
  }, [item]);

  useEffect(() => {
    enteredRef.current += 1;
  }, [tab, item]);

  return (
    <Dialog open={!!item} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-0 bg-card p-0 sm:max-w-5xl">
        {item ? (
          <>
            <DialogHeader className="relative overflow-hidden px-brand-fill shadow-none px-6 pb-6 pt-8 text-left sm:px-8">
              <span className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl animate-pulse" aria-hidden="true" />
              <div className="animate-fade-in">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Real support case study
                </span>
                <DialogTitle className="mt-3 pr-8 text-h3 text-white">{item.headline}</DialogTitle>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-medium text-white">
                    {item.channel === "ai" ? <Bot className="h-3 w-3" aria-hidden="true" /> : <Headphones className="h-3 w-3" aria-hidden="true" />}
                    {item.channel === "ai" ? "AI support" : "Human support"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-white">
                    <Timer className="h-3 w-3" aria-hidden="true" /> Resolved in {item.time_to_result}
                  </span>
                  {item.tags.map((t) => (
                    <span key={t} className="rounded-full bg-white/15 px-2 py-0.5 font-medium text-white">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 border-b border-border bg-muted px-6 py-5 sm:grid-cols-4 sm:px-8">
              <CountBubble value={item.questions.length} label="questions asked and answered" active={!!item} tone="purple" />
              <CountBubble value={item.solution.length} label="steps taken to fix it" active={!!item} tone="blue" />
              <CountBubble value={item.screenshots?.length ?? 0} label="screenshots walked through" active={!!item} tone="green" />
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-card">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-warning" aria-hidden="true">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </span>
                <span className="text-xs font-medium leading-snug text-muted-foreground">{item.satisfaction}</span>
              </div>
            </div>

            <div className="grid gap-0 sm:grid-cols-[240px_1fr]">
              <nav
                aria-label="Case study sections"
                className="flex gap-2 overflow-x-auto border-b border-border bg-muted p-3 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:p-4"
              >
                {TABS.map(({ key, label, icon: Icon }, i) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    aria-current={tab === key}
                    className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-all duration-300 sm:w-full ${
                      tab === key
                        ? "scale-[1.02] bg-card text-brand shadow-raised ring-1 ring-brand/20"
                        : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold transition ${
                        tab === key ? "bg-brand text-white" : "bg-card text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    >
                      {i + 1}
                    </span>
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="whitespace-nowrap">{label}</span>
                  </button>
                ))}
              </nav>

              <div key={`${item.id}-${tab}`} className="min-h-[320px] animate-fade-in px-6 py-6 sm:px-8">
                {tab === "questions" ? (
                  item.questions.length ? (
                    <ul className="space-y-3 text-sm text-foreground">
                      {item.questions.map((q, i) => (
                        <li
                          key={q}
                          className="flex gap-3 rounded-md border border-border bg-muted/40 p-4 leading-relaxed opacity-0 animate-fade-in"
                          style={{ animationDelay: `${i * 70}ms`, animationFillMode: "forwards" }}
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white" aria-hidden="true">
                            {i + 1}
                          </span>
                          <span>“{q}”</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{item.summary}</p>
                  )
                ) : null}

                {tab === "summary" ? (
                  <div className="space-y-5">
                    <p className="rounded-md bg-muted p-4 text-[15px] leading-relaxed text-muted-foreground">{item.summary}</p>
                    {item.screenshots?.length ? (
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Screenshots shared during support</p>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {item.screenshots.map((src, index) => (
                            <div
                              key={src}
                              className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-muted opacity-0 animate-scale-in"
                              style={{ animationDelay: `${index * 80}ms`, animationFillMode: "forwards" }}
                            >
                              <img
                                src={src}
                                alt={`Privacy-blurred support screenshot ${index + 1}`}
                                loading="lazy"
                                className="h-full w-full scale-110 object-cover blur-xl"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-foreground/20 px-3 text-center text-xs font-semibold text-primary-foreground">
                                Privacy blurred
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {tab === "solution" ? (
                  item.solution.length ? (
                    <ol className="space-y-3 text-sm text-muted-foreground">
                      {item.solution.map((s, i) => (
                        <li
                          key={s}
                          className="flex gap-3 rounded-md border border-border bg-card p-4 shadow-card opacity-0 animate-fade-in"
                          style={{ animationDelay: `${i * 90}ms`, animationFillMode: "forwards" }}
                        >
                          <span
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info text-xs font-bold text-white"
                            aria-hidden="true"
                          >
                            {i + 1}
                          </span>
                          <span className="leading-relaxed">{s}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground">{item.summary}</p>
                  )
                ) : null}

                {tab === "outcome" ? (
                  <div className="space-y-4">
                    <blockquote className="flex gap-3 rounded-lg border border-success/30 bg-green-50 p-5 text-base italic leading-relaxed text-foreground">
                      <Quote className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>{item.quote}</span>
                    </blockquote>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-border p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Satisfaction
                        </div>
                        <p className="mt-1 text-base font-semibold text-foreground">{item.satisfaction}</p>
                      </div>
                      <div className="rounded-md border border-border p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Time to result
                        </div>
                        <p className="mt-1 text-base font-semibold text-foreground">{item.time_to_result}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Identifying details are removed. Customer shown as initials only ({item.initials}).
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

const SupportWinsSection = () => {
  const { data, loading, error } = useSupportWins(6);
  const [active, setActive] = useState<SupportCase | null>(null);

  if (error) return null;

  const s = data?.stats;
  const aiSpeed = s?.ai_median_response_seconds ? `${s.ai_median_response_seconds}s` : "—";
  const fastest =
    s?.human_fastest_minutes != null
      ? s.human_fastest_minutes < 60
        ? `${s.human_fastest_minutes} min`
        : `${Math.round(s.human_fastest_minutes / 60)} hrs`
      : "—";

  const cases = (data?.cases ?? []).slice(0, 6);

  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Real cases from our support desk
        </span>
        <h2 className="mt-4 text-h3 text-foreground sm:text-h2">Hear from our customers…</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          A few real case studies from our support desk — handled by our AI and our humans. Open any one to walk through
          what they asked, what happened, how we solved it and how it ended. All identifying details are removed.
        </p>
      </div>

      {s ? (
        <div className="mb-10 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <Stat icon={Clock} value={aiSpeed} label="Typical AI first reply" />
          <Stat icon={MessageSquareQuote} value={s.ai_questions_answered.toLocaleString()} label="Customer questions answered" />
          <Stat
            icon={ThumbsUp}
            value={s.ai_no_human_needed_pct != null ? `${s.ai_no_human_needed_pct}%` : "—"}
            label="Solved without needing a human"
          />
          <Stat icon={Headphones} value={fastest} label="Fastest human reply" />
        </div>
      ) : null}

      {loading ? (
        <p className="text-center text-muted-foreground">Loading real cases…</p>
      ) : cases.length === 0 ? null : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c) => (
            <CaseCard key={c.id} item={c} onOpen={() => setActive(c)} />
          ))}
        </div>
      )}

      <CaseDialog item={active} onClose={() => setActive(null)} />
    </section>
  );
};

export default SupportWinsSection;
