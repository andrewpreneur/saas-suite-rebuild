import { useEffect, useState } from "react";
import { Check, ChevronDown, LogIn, ClipboardCheck, MessageSquare, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
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
  const [examplesOpen, setExamplesOpen] = useState(false);
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
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6" data-testid="agents-page">
      <PageHeader
        eyebrow="AI agents"
        title="AI agents that work inside HighLevel"
        subtitle={AGENTS_CORE_MESSAGE}
      />

      <Reveal className="space-y-6">
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

        <RevealItem>
          <section aria-labelledby="agents-how" className="px-surface p-4 sm:p-6">
            <h2 id="agents-how" className="text-base font-semibold text-foreground">
              How it works
            </h2>
            <p className="mt-0.5 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{AGENTS_AUDIENCE}</p>
            <ol className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
              {AGENTS_STEPS.map((step, index) => {
                const Icon = STEP_ICONS[index] ?? Sparkles;
                return (
                  <li key={step.title} className="flex min-w-0 items-start gap-3">
                    <span className="px-icon-chip size-9 shrink-0" aria-hidden="true">
                      <Icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        <span className="sr-only">Step {index + 1}: </span>
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </RevealItem>

        <RevealItem>
          <Collapsible open={examplesOpen} onOpenChange={setExamplesOpen} asChild>
            <section aria-labelledby="agents-use-cases" className="px-surface overflow-hidden">
              <CollapsibleTrigger className="group flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-6">
                <span className="min-w-0 flex-1">
                  <span id="agents-use-cases" className="block text-base font-semibold text-foreground">
                    Work agents have already done
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {AGENTS_USE_CASES.length} real tasks inside HighLevel agencies and sub-accounts.
                  </span>
                </span>
                <span className="hidden shrink-0 text-sm font-medium text-muted-foreground group-hover:text-foreground sm:inline">
                  {examplesOpen ? "Hide examples" : "Show examples"}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none",
                    examplesOpen && "rotate-180",
                  )}
                  aria-hidden="true"
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="divide-y divide-border/70 border-t border-border/70">
                  {AGENTS_USE_CASES.map((item) => (
                    <li key={item.title} className="flex min-w-0 items-start gap-3 px-4 py-3.5 sm:px-6">
                      <span
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
                        aria-hidden="true"
                      >
                        <Check className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold leading-snug text-foreground">{item.title}</h3>
                        <p className="mt-1 max-w-[75ch] text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </section>
          </Collapsible>
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
