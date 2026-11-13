import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Clock, Gauge, MessageSquare, Send, Timer, Trophy } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import { supabase } from "@/integrations/supabase/client";

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-rep-portal`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const TOKEN_KEY = "support_rep_token";

type Metrics = {
  total_cases: number;
  answered: number;
  missed: number;
  pending: number;
  avg_response_minutes: number;
  fastest_response_minutes: number;
  pct_within_10_min: number;
  pct_within_12_hours: number;
  grammar_score: number;
  tone_score: number;
  accuracy_score: number;
  honesty_score: number;
  speed_score: number;
  quality_score: number;
  final_score: number;
  meets_standard: boolean;
};

type CaseRow = {
  id: string;
  question: string;
  mode: string;
  status: string;
  scheduled_at: string;
  delivered_at: string | null;
  first_response_at: string | null;
  response_minutes: number | null;
  score: number | null;
  grade: { summary?: string; suggestions?: string[] } | null;
};

type Overview = {
  applicant: {
    name: string | null;
    email: string;
    status: string;
    training_starts_at: string;
    training_ends_at: string;
    final_score: number | null;
    final_report: { narrative?: string } | null;
  };
  metrics: Metrics;
  training_complete: boolean;
  upcoming: number;
  cases: CaseRow[];
  standards: string[];
};

type Message = { id: string; role: string; content: string; created_at: string; grade: Record<string, unknown> | null };

async function callPortal<T>(token: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON, Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data as T;
}

function Metric({ label, value, suffix = "" }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">
        {value}
        <span className="text-base font-medium text-muted-foreground">{suffix}</span>
      </p>
    </div>
  );
}

export default function SupportRepPortal() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) || "");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [activeCase, setActiveCase] = useState<{ case: CaseRow; messages: Message[] } | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setOverview(null);
    setActiveCase(null);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await callPortal<Overview>(token, { action: "overview" });
      setOverview(data);
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
      signOut();
    }
  }, [token, signOut]);

  useEffect(() => {
    void load();
  }, [load]);

  const requestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("support-rep-auth", {
      body: { action: "request", email: email.trim().toLowerCase() },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast.error(data?.error || "We couldn't find a training account for that email.");
      return;
    }
    setCodeSent(true);
    toast.success("Check your email for your six-digit code.");
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("support-rep-auth", {
      body: { action: "verify", email: email.trim().toLowerCase(), code: code.trim() },
    });
    setBusy(false);
    if (error || !data?.token) {
      toast.error(data?.error || "That code isn't valid.");
      return;
    }
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
  };

  const openCase = async (id: string) => {
    try {
      const data = await callPortal<{ case: CaseRow; messages: Message[] }>(token, { action: "case", case_id: id });
      setActiveCase(data);
      setReply("");
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    }
  };

  const sendReply = async () => {
    if (!activeCase || reply.trim().length < 2) return;
    setSending(true);
    try {
      const res = await callPortal<{ grade: { summary?: string } | null; resolved: boolean }>(token, {
        action: "reply",
        case_id: activeCase.case.id,
        content: reply.trim(),
      });
      toast.success(res.resolved ? "Case closed and graded." : "Reply sent — the customer wrote back.");
      if (res.grade?.summary) toast.message("Coach feedback", { description: res.grade.summary });
      await openCase(activeCase.case.id);
      await load();
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setSending(false);
    }
  };

  const finalize = async () => {
    try {
      await callPortal(token, { action: "finalize" });
      toast.success("Your final score is ready.");
      await load();
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    }
  };

  /* --------------------------------------------------------------- login */
  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <PageSEO title="Support Rep Portal" description="Private training portal." path="/support-rep/portal" noindex />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Support training portal</CardTitle>
            <CardDescription>
              {codeSent ? "Enter the six-digit code we emailed you." : "Sign in with the email you applied with."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!codeSent ? (
              <form onSubmit={requestCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="portal-email">Email</Label>
                  <Input
                    id="portal-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Sending…" : "Email me a code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="portal-code">Six-digit code</Label>
                  <Input
                    id="portal-code"
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Checking…" : "Sign in"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setCodeSent(false)}>
                  Use a different email
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!overview) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  /* ------------------------------------------------------ single case view */
  if (activeCase) {
    const c = activeCase.case;
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setActiveCase(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to my queue
          </Button>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={c.status === "completed" ? "secondary" : "default"}>{c.status}</Badge>
                {c.mode === "roleplay" && <Badge variant="outline">live conversation</Badge>}
                {c.response_minutes != null && (
                  <Badge variant="outline">
                    <Timer className="mr-1 h-3 w-3" />
                    {c.response_minutes} min to first reply
                  </Badge>
                )}
                {c.score != null && <Badge variant="outline">scored {c.score}/100</Badge>}
              </div>
              <CardDescription>
                Arrived {new Date(c.delivered_at || c.scheduled_at).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeCase.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg p-4 ${
                    m.role === "rep" ? "ml-6 bg-primary/10" : "mr-6 bg-muted"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.role === "rep" ? "You" : "Customer"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{m.content}</p>
                  {m.grade ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Grammar {String((m.grade as Record<string, unknown>).grammar_score)} · Tone{" "}
                      {String((m.grade as Record<string, unknown>).tone_score)} · Accuracy{" "}
                      {String((m.grade as Record<string, unknown>).accuracy_score)} —{" "}
                      {String((m.grade as Record<string, unknown>).summary || "")}
                    </p>
                  ) : null}
                </div>
              ))}

              {c.status !== "completed" && c.status !== "missed" && (
                <div className="space-y-3 border-t border-border pt-4">
                  <Label htmlFor="rep-reply">Your reply</Label>
                  <Textarea
                    id="rep-reply"
                    rows={6}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Write exactly what you would send this customer."
                  />
                  <Button onClick={sendReply} disabled={sending || reply.trim().length < 2}>
                    <Send className="mr-2 h-4 w-4" />
                    {sending ? "Sending…" : "Send reply"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  /* --------------------------------------------------------------- overview */
  const m = overview.metrics;
  const start = new Date(overview.applicant.training_starts_at).getTime();
  const end = new Date(overview.applicant.training_ends_at).getTime();
  const progress = Math.max(0, Math.min(100, ((Date.now() - start) / (end - start)) * 100));

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <PageSEO title="Support Rep Portal" description="Private training portal." path="/support-rep/portal" noindex />
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {overview.applicant.name || overview.applicant.email}
            </h1>
            <p className="text-sm text-muted-foreground">
              Two-week trial · ends {new Date(overview.applicant.training_ends_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>
            Sign out
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" /> Trial progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">
              {m.answered} answered · {m.pending} waiting on you · {m.missed} missed · {overview.upcoming} still to come
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Answered in 10 min" value={m.pct_within_10_min} suffix="%" />
          <Metric label="Answered in 12 hrs" value={m.pct_within_12_hours} suffix="%" />
          <Metric label="Average reply time" value={m.avg_response_minutes} suffix=" min" />
          <Metric label="Grammar accuracy" value={m.grammar_score} suffix="%" />
          <Metric label="Tone and kindness" value={m.tone_score} suffix="%" />
          <Metric label="Answer accuracy" value={m.accuracy_score} suffix="%" />
          <Metric label="Escalation honesty" value={m.honesty_score} suffix="%" />
          <Metric label="Running score" value={m.final_score} suffix="/100" />
        </div>

        {overview.training_complete && (
          <Card className={m.meets_standard ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" /> Final result
              </CardTitle>
              <CardDescription>
                {overview.applicant.final_score != null
                  ? `Final score ${overview.applicant.final_score}/100 — ${
                      m.meets_standard ? "meets our standard" : "below our standard"
                    }`
                  : "Your two weeks are up. Generate your final score."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.applicant.final_report?.narrative && (
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {overview.applicant.final_report.narrative}
                </p>
              )}
              {overview.applicant.final_score == null && <Button onClick={finalize}>Generate my final score</Button>}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5 text-primary" /> Your support requests
            </CardTitle>
            <CardDescription>Real questions our customers have asked. Answer them like the real thing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.cases.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nothing yet. Requests arrive at random times, mostly between 8:00am and 9:00pm Central.
              </p>
            )}
            {overview.cases.map((c) => (
              <button
                key={c.id}
                onClick={() => openCase(c.id)}
                className="w-full rounded-lg border border-border p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      c.status === "completed" ? "secondary" : c.status === "missed" ? "destructive" : "default"
                    }
                  >
                    {c.status === "delivered" ? "waiting on you" : c.status}
                  </Badge>
                  {c.mode === "roleplay" && <Badge variant="outline">live conversation</Badge>}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(c.delivered_at || c.scheduled_at).toLocaleString()}
                  </span>
                  {c.response_minutes != null && (
                    <span className="text-xs text-muted-foreground">{c.response_minutes} min reply</span>
                  )}
                  {c.score != null && <span className="text-xs text-muted-foreground">scored {c.score}/100</span>}
                </div>
                <p className="line-clamp-2 text-sm text-foreground">{c.question}</p>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">The standards you're measured on</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
              {overview.standards.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
