import { useEffect, useState } from "react";
import { Bot, Check, LogIn, ClipboardCheck, MessageSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/platform/PageHeader";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { TextShimmer } from "@/components/premium/21st/text-shimmer";
import StripeEmbeddedCheckout from "@/components/StripeEmbeddedCheckout";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import {
  AGENTS_AUDIENCE,
  AGENTS_CHECKOUT_PLAN,
  AGENTS_CORE_MESSAGE,
  AGENTS_PLAN_NAME,
  AGENTS_PLAN_PRICE,
  AGENTS_STEPS,
  AGENTS_USE_CASES,
  agentsPlanStateFromRead,
  agentsWeeklyTokenLine,
  type AgentsAccount,
  type AgentsPlanState,
} from "@/lib/agentsOffer";

const STEP_ICONS = [MessageSquare, LogIn, Sparkles, ClipboardCheck] as const;

export default function AgentsPage() {
  const { email } = useUser();
  const [planState, setPlanState] = useState<AgentsPlanState | "checking">("checking");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const tokenLine = agentsWeeklyTokenLine();

  useEffect(() => {
    let active = true;
    if (!email) {
      setPlanState("upgrade");
      return;
    }
    setPlanState("checking");
    void supabase
      .from("saas_suite_users")
      .select("plan, premium_support")
      .ilike("email", email)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        const row = (data ?? null) as AgentsAccount | null;
        setPlanState(agentsPlanStateFromRead(row, Boolean(error)));
      });
    return () => {
      active = false;
    };
  }, [email]);

  const included = planState === "included";

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8" data-testid="agents-page">
      <PageHeader
        eyebrow="AI agents"
        title="AI agents that work inside HighLevel"
        subtitle={AGENTS_CORE_MESSAGE}
      />

      <Reveal className="space-y-8">
        <RevealItem>
          <section className="px-surface px-brand-wash flex items-start gap-3 p-4 sm:p-6">
            <span className="px-icon-chip shrink-0 bg-card" aria-hidden="true">
              <Bot className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Who it is for</h2>
              <p className="mt-0.5 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                {AGENTS_AUDIENCE}
              </p>
            </div>
          </section>
        </RevealItem>

        <RevealItem>
          <section aria-labelledby="agents-how">
            <h2 id="agents-how" className="text-h4 text-foreground">
              How it works
            </h2>
            <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {AGENTS_STEPS.map((step, index) => {
                const Icon = STEP_ICONS[index] ?? Sparkles;
                return (
                  <li key={step.title} className="px-surface min-w-0 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="px-icon-chip" aria-hidden="true">
                        <Icon className="size-5" />
                      </span>
                      <span className="px-eyebrow">Step {index + 1}</span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{step.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        </RevealItem>

        <RevealItem>
          <section aria-labelledby="agents-use-cases">
            <h2 id="agents-use-cases" className="text-h4 text-foreground">
              Work agents have already done
            </h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              Real tasks inside HighLevel agencies and sub-accounts.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {AGENTS_USE_CASES.map((item) => (
                <article key={item.title} className="px-surface min-w-0 p-4 sm:p-5">
                  <span className="mb-3 flex size-6 items-center justify-center rounded-full bg-success/10 text-success" aria-hidden="true">
                    <Check className="size-3.5" />
                  </span>
                  <h3 className="text-sm font-semibold leading-snug text-foreground">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              ))}
            </div>
          </section>
        </RevealItem>

        <RevealItem>
          <section aria-labelledby="agents-upgrade">
            <div
              className="px-surface flex min-w-0 flex-col gap-6 overflow-hidden p-4 sm:p-8 lg:flex-row lg:items-center lg:justify-between"
              data-testid="agents-upgrade"
            >
              <div className="min-w-0 max-w-xl">
                <p className="px-eyebrow text-brand">{AGENTS_PLAN_NAME}</p>
                <h2 id="agents-upgrade" className="mt-1 text-h4 text-foreground sm:text-h3">
                  {planState === "included"
                    ? "Included in your plan"
                    : planState === "checking"
                      ? "AI agents"
                      : "Add AI agents to your account"}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {planState === "included"
                    ? `${AGENTS_PLAN_NAME} includes AI agents for your agency and your customers.`
                    : planState === "checking"
                      ? "Checking whether AI agents are already on this account."
                      : `Upgrade to ${AGENTS_PLAN_NAME} to use AI agents. Your customers can request tasks too.`}
                </p>
                <p className="mt-3 text-sm text-foreground" data-testid="agents-token-line">
                  {tokenLine}
                </p>
                {planState === "upgrade" && AGENTS_PLAN_PRICE != null && (
                  <p className="mt-4 text-h2 tracking-tight text-foreground">
                    ${AGENTS_PLAN_PRICE}
                    <span className="text-base font-normal text-muted-foreground">/month</span>
                  </p>
                )}
              </div>
              <div className="w-full shrink-0 lg:w-auto">
                {planState === "checking" ? (
                  <div role="status" aria-busy="true" className="flex h-11 items-center">
                    <TextShimmer className="text-sm font-medium">Checking your plan…</TextShimmer>
                  </div>
                ) : included ? (
                  <div
                    role="status"
                    data-testid="agents-included"
                    className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3"
                  >
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground" aria-hidden="true">
                      <Check className="size-3.5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Included in your plan</p>
                      <p className="text-sm text-muted-foreground">
                        You're on {AGENTS_PLAN_NAME}. AI agents are part of this plan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="accent"
                    size="lg"
                    className="w-full sm:w-auto"
                    data-testid="agents-upgrade-cta"
                    onClick={() => setCheckoutOpen(true)}
                  >
                    Upgrade to {AGENTS_PLAN_NAME}
                  </Button>
                )}
              </div>
            </div>
          </section>
        </RevealItem>
      </Reveal>

      {planState === "upgrade" && (
        <StripeEmbeddedCheckout
          plan={AGENTS_CHECKOUT_PLAN}
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          email={email || undefined}
        />
      )}
    </div>
  );
}
