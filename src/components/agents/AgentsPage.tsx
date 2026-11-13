import { useEffect, useState } from "react";
import { Bot, Check, LogIn, ClipboardCheck, MessageSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="bg-gradient-to-br from-sidebar-accent to-card px-5 py-8 sm:px-8 sm:py-10">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Bot className="h-5 w-5" aria-hidden="true" />
          </div>
          <Badge variant="secondary" className="mb-3">
            AI agents
          </Badge>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            AI agents that work inside HighLevel
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground sm:text-lg">
            {AGENTS_CORE_MESSAGE}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {AGENTS_AUDIENCE}
          </p>
        </div>
      </section>

      <section aria-labelledby="agents-use-cases">
        <h2 id="agents-use-cases" className="text-xl font-semibold tracking-tight text-foreground">
          Work agents have already done
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Real tasks inside HighLevel agencies and sub-accounts.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS_USE_CASES.map((item) => (
            <Card key={item.title} className="min-w-0 shadow-sm">
              <CardContent className="p-5">
                <h3 className="text-base font-semibold leading-snug text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="agents-how">
        <h2 id="agents-how" className="text-xl font-semibold tracking-tight text-foreground">
          How it works
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? Sparkles;
            return (
              <li key={step.title} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-primary">
                    {index + 1}
                  </span>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </div>
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="agents-upgrade">
        <Card
          className="min-w-0 overflow-hidden border-sidebar-primary/20 shadow-sm"
          data-testid="agents-upgrade"
        >
          <CardContent className="flex flex-col gap-6 p-5 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 max-w-xl">
              <p className="text-sm font-medium text-sidebar-primary">{AGENTS_PLAN_NAME}</p>
              <h2
                id="agents-upgrade"
                className="mt-1 text-2xl font-semibold tracking-tight text-foreground"
              >
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
                <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
                  ${AGENTS_PLAN_PRICE}
                  <span className="text-base font-normal text-muted-foreground">/month</span>
                </p>
              )}
            </div>
            <div className="w-full shrink-0 lg:w-auto">
              {planState === "checking" ? (
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto"
                  disabled
                  aria-busy="true"
                >
                  Checking your plan…
                </Button>
              ) : included ? (
                <div
                  role="status"
                  data-testid="agents-included"
                  className="flex items-start gap-3 rounded-lg border bg-secondary px-4 py-3"
                >
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
                  <div>
                    <p className="font-medium text-foreground">Included in your plan</p>
                    <p className="text-sm text-muted-foreground">
                      You're on {AGENTS_PLAN_NAME}. AI agents are part of this plan.
                    </p>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="w-full sm:w-auto"
                  data-testid="agents-upgrade-cta"
                  onClick={() => setCheckoutOpen(true)}
                >
                  Upgrade to {AGENTS_PLAN_NAME}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

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
