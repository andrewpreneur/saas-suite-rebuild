import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Download, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";

interface FunnelRow {
  email: string;
  full_name: string | null;
  plan: string | null;
  approval: string | null;
  phone: string | null;
  created_at: string | null;
  last_accessed: string | null;
  login_count: number;
  onboarding_intent: string | null;
  onboarding_skipped: boolean;
  onboarding_step: number;
  onboarding_completed: boolean;
  onboarding_completed_at: string | null;
  reached_app: boolean;
  initial_questions_completed: boolean;
  agency_named: boolean;
  branding_configured: boolean;
  hub_configured: boolean;
  menu_link_installed: boolean;
  client_count: number;
  stage: number;
  stage_label: string;
}

const STAGES = [
  { stage: 0, label: "Signed up only" },
  { stage: 1, label: "Reached app" },
  { stage: 2, label: "Answered questions" },
  { stage: 3, label: "Named agency" },
  { stage: 4, label: "Branded / hub set up" },
  { stage: 5, label: "Installed in GHL" },
  { stage: 6, label: "Onboarding completed" },
  { stage: 7, label: "Live with clients" },
];

/**
 * Cumulative funnel: each step counts everyone who DID that step, regardless of
 * how far they later got. The old stage cards only counted where people
 * *stopped*, which made real steps look like 0.
 */
const STEPS: { key: string; label: string; test: (r: FunnelRow) => boolean }[] = [
  { key: "signed_up", label: "Signed up", test: () => true },
  { key: "reached_app", label: "Logged into app", test: (r) => r.reached_app },
  { key: "questions", label: "Answered questions", test: (r) => r.initial_questions_completed },
  { key: "named", label: "Named agency", test: (r) => r.agency_named },
  { key: "branded", label: "Branded / hub set up", test: (r) => r.branding_configured || r.hub_configured },
  { key: "installed", label: "Installed in GHL", test: (r) => r.menu_link_installed },
  { key: "completed", label: "Completed onboarding", test: (r) => r.onboarding_completed },
  { key: "clients", label: "Live with clients", test: (r) => r.client_count > 0 },
];

const Flag = ({ on }: { on: boolean }) =>
  on ? (
    <Check className="w-4 h-4 text-emerald-500 mx-auto" />
  ) : (
    <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
  );

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

export default function OnboardingFunnelPanel() {
  const [rows, setRows] = useState<FunnelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<number | null>(null);
  const [planFilter, setPlanFilter] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_onboarding_funnel");
    if (error) {
      toast.error(`Could not load funnel: ${error.message}`);
      setRows([]);
    } else {
      setRows(((data as unknown as FunnelRow[]) || []).sort((a, b) => b.stage - a.stage));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const r of rows) map.set(r.stage, (map.get(r.stage) || 0) + 1);
    return map;
  }, [rows]);

  const stepCounts = useMemo(
    () =>
      STEPS.map((s, i) => {
        const count = rows.filter(s.test).length;
        const prev = i === 0 ? count : rows.filter(STEPS[i - 1].test).length;
        return {
          ...s,
          count,
          pctOfAll: rows.length ? Math.round((count / rows.length) * 100) : 0,
          dropoff: Math.max(0, prev - count),
          dropoffPct: prev ? Math.round(((prev - count) / prev) * 100) : 0,
        };
      }),
    [rows]
  );

  const [stepFilter, setStepFilter] = useState<string | null>(null);

  const plans = useMemo(
    () => Array.from(new Set(rows.map((r) => r.plan).filter(Boolean))) as string[],
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (stageFilter !== null && r.stage !== stageFilter) return false;
      if (stepFilter) {
        const step = STEPS.find((s) => s.key === stepFilter);
        if (step && !step.test(r)) return false;
      }
      if (planFilter && r.plan !== planFilter) return false;
      if (!q) return true;
      return (
        r.email?.toLowerCase().includes(q) ||
        (r.full_name || "").toLowerCase().includes(q) ||
        (r.onboarding_intent || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, stageFilter, planFilter, stepFilter]);

  const exportCsv = () => {
    const headers = [
      "email","name","plan","approval","phone","signed_up","last_active","logins","intent","skipped",
      "reached_app","questions","named_agency","branding","hub","menu_installed","completed","clients","stage","stage_label",
    ];
    const lines = filtered.map((r) =>
      [
        r.email, r.full_name || "", r.plan || "", r.approval || "", r.phone || "",
        r.created_at || "", r.last_accessed || "", r.login_count, r.onboarding_intent || "",
        r.onboarding_skipped, r.reached_app, r.initial_questions_completed, r.agency_named,
        r.branding_configured, r.hub_configured, r.menu_link_installed, r.onboarding_completed,
        r.client_count, r.stage, r.stage_label,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `onboarding-funnel-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Onboarding Funnel</h2>
          <p className="text-sm text-muted-foreground">
            How far each user actually got — reached the app, answered questions, branded, installed, completed, live with clients.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Cumulative funnel — click a step to segment everyone who reached it */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-foreground">
          Cumulative funnel <span className="font-normal text-muted-foreground">— everyone who reached each step</span>
        </div>
        {stepCounts.map((s, i) => {
          const active = stepFilter === s.key;
          const width = stepCounts[0].count ? (s.count / stepCounts[0].count) * 100 : 0;
          return (
            <button
              key={s.key}
              onClick={() => setStepFilter(active ? null : s.key)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${
                active ? "border-primary bg-primary/5" : "hover:border-primary/40"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-foreground">
                  {i + 1}. {s.label}
                </span>
                <span className="text-sm text-muted-foreground">
                  <span className="text-lg font-bold text-foreground">{s.count}</span> · {s.pctOfAll}%
                  {i > 0 && s.dropoff > 0 && (
                    <span className="ml-2 text-destructive">−{s.dropoff} ({s.dropoffPct}% drop)</span>
                  )}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${width}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Where users are currently stalled — click to segment */}
      <div className="text-sm font-semibold text-foreground pt-2">Currently stalled at</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAGES.slice().reverse().map((s) => {
          const count = counts.get(s.stage) || 0;
          const pct = rows.length ? Math.round((count / rows.length) * 100) : 0;
          const active = stageFilter === s.stage;
          return (
            <Card
              key={s.stage}
              onClick={() => setStageFilter(active ? null : s.stage)}
              className={`p-3 cursor-pointer transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
            >
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground">{pct}% of all users</div>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {stepFilter && (
          <Button size="sm" variant="ghost" onClick={() => setStepFilter(null)}>
            Clear step filter
          </Button>
        )}
        <Input
          placeholder="Search email, name, or intent…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs h-9"
        />
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Button
          size="sm"
          variant={planFilter === null ? "default" : "outline"}
          onClick={() => setPlanFilter(null)}
        >
          All plans
        </Button>
        {plans.map((p) => (
          <Button
            key={p}
            size="sm"
            variant={planFilter === p ? "default" : "outline"}
            onClick={() => setPlanFilter(planFilter === p ? null : p)}
          >
            {p}
          </Button>
        ))}
        {stageFilter !== null && (
          <Button size="sm" variant="ghost" onClick={() => setStageFilter(null)}>
            Clear stage filter
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} users</span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-center">App</TableHead>
              <TableHead className="text-center">Qs</TableHead>
              <TableHead className="text-center">Agency</TableHead>
              <TableHead className="text-center">Brand</TableHead>
              <TableHead className="text-center">Hub</TableHead>
              <TableHead className="text-center">Installed</TableHead>
              <TableHead className="text-center">Done</TableHead>
              <TableHead className="text-center">Clients</TableHead>
              <TableHead className="text-center">Logins</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Signed up</TableHead>
              <TableHead>Last active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center py-10 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center py-10 text-muted-foreground">
                  No users match these filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.email}>
                  <TableCell className="whitespace-nowrap">
                    <div className="font-medium text-foreground">{r.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                    {r.onboarding_skipped && (
                      <Badge variant="outline" className="mt-1 text-[10px]">skipped onboarding</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{r.plan || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="secondary" className="text-[10px]">{r.stage}. {r.stage_label}</Badge>
                  </TableCell>
                  <TableCell><Flag on={r.reached_app} /></TableCell>
                  <TableCell><Flag on={r.initial_questions_completed} /></TableCell>
                  <TableCell><Flag on={r.agency_named} /></TableCell>
                  <TableCell><Flag on={r.branding_configured} /></TableCell>
                  <TableCell><Flag on={r.hub_configured} /></TableCell>
                  <TableCell><Flag on={r.menu_link_installed} /></TableCell>
                  <TableCell><Flag on={r.onboarding_completed} /></TableCell>
                  <TableCell className="text-center text-sm">{r.client_count}</TableCell>
                  <TableCell className="text-center text-sm">{r.login_count}</TableCell>
                  <TableCell className="text-xs">{r.phone || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmt(r.created_at)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{fmt(r.last_accessed)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}