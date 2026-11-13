import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Agg {
  signups: number;
  paid: number;
  returned: number;
  namedAgency: number;
  onboardingCompleted: number;
  installed: number;
  viewedHub: number;
  hubVisitors: number;
  attributed: number;
}

interface UserRow {
  email: string;
  name: string | null;
  createdAt: string;
  plan: string | null;
  paid: boolean;
  loginCount: number;
  returned: boolean;
  agencyName: string | null;
  namedAgency: boolean;
  onboardingCompleted: boolean;
  installed: boolean;
  hubVisitors: number;
  viewedHub: boolean;
  source: string;
  landingPage: string | null;
  recent: boolean;
}

interface StatsPayload {
  meta: { days: number; since: string; cutoff: string; generated_at: string };
  totals: Agg;
  before: Agg;
  after: Agg;
  daily: { day: string; signups: number; paid: number; returned: number }[];
  bySource: (Agg & { source: string })[];
  byLandingPage: (Agg & { landingPage: string })[];
  users: UserRow[];
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 1000) / 10}%` : "—");

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold text-foreground mt-1">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default function SignupStatsPanel() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StatsPayload | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("signup-stats", {
        body: { days: 30 },
      });
      if (error) throw error;
      if ((res as { error?: string })?.error) throw new Error((res as { error: string }).error);
      setData(res as StatsPayload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load signup stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data.users;
    return data.users.filter((u) =>
      [u.email, u.name, u.agencyName, u.source, u.landingPage]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term)),
    );
  }, [data, q]);

  const exportCsv = () => {
    if (!data) return;
    const head = [
      "email", "name", "signed_up", "plan", "paid", "logins", "returned",
      "agency_name", "onboarding_completed", "installed", "hub_visitors", "source", "landing_page",
    ];
    const lines = data.users.map((u) =>
      [
        u.email, u.name ?? "", u.createdAt, u.plan ?? "", u.paid, u.loginCount, u.returned,
        u.agencyName ?? "", u.onboardingCompleted, u.installed, u.hubVisitors, u.source, u.landingPage ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `signups-30d-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const t = data?.totals;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Last 30 Days — Signup Performance</h2>
          <p className="text-sm text-muted-foreground">
            Attribution, paid conversion, return logins, and whether their onboarding hub ever got visitors.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {!data && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Crunching the last 30 days…
        </div>
      )}

      {t && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatTile label="Signups" value={t.signups} sub={`${t.attributed} with a UTM source`} />
            <StatTile label="Became paid" value={t.paid} sub={`${pct(t.paid, t.signups)} of signups`} />
            <StatTile label="Logged back in" value={t.returned} sub={`${pct(t.returned, t.signups)} returned`} />
            <StatTile label="Named their agency" value={t.namedAgency} sub={`${pct(t.namedAgency, t.signups)}`} />
            <StatTile label="Finished onboarding" value={t.onboardingCompleted} sub={pct(t.onboardingCompleted, t.signups)} />
            <StatTile label="Confirmed install" value={t.installed} sub={pct(t.installed, t.signups)} />
            <StatTile label="Hubs with visitors" value={t.viewedHub} sub={`${t.hubVisitors} onboarding-page users total`} />
            <StatTile
              label="Since cutoff"
              value={data.after.signups}
              sub={`${data.meta.cutoff.slice(0, 10)} → now`}
            />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Daily signups vs paid conversions</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="signups" name="Signups" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="returned" name="Returned later" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="paid" name="Paid" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Before vs after the onboarding-first changes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead className="text-right">Before {data.meta.cutoff.slice(5, 10)}</TableHead>
                      <TableHead className="text-right">Since</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {([
                      ["Signups", "signups"],
                      ["Paid", "paid"],
                      ["Returned", "returned"],
                      ["Named agency", "namedAgency"],
                      ["Finished onboarding", "onboardingCompleted"],
                      ["Confirmed install", "installed"],
                      ["Hubs with visitors", "viewedHub"],
                    ] as [string, keyof Agg][]).map(([label, key]) => (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell className="text-right">
                          {data.before[key]}{" "}
                          <span className="text-xs text-muted-foreground">
                            {key !== "signups" ? pct(data.before[key], data.before.signups) : ""}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {data.after[key]}{" "}
                          <span className="text-xs text-muted-foreground">
                            {key !== "signups" ? pct(data.after[key], data.after.signups) : ""}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By source (organic vs paid)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Signups</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Returned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.bySource.map((s) => (
                      <TableRow key={s.source}>
                        <TableCell className="font-medium">{s.source}</TableCell>
                        <TableCell className="text-right">{s.signups}</TableCell>
                        <TableCell className="text-right">
                          {s.paid} <span className="text-xs text-muted-foreground">{pct(s.paid, s.signups)}</span>
                        </TableCell>
                        <TableCell className="text-right">{s.returned}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By landing page</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Landing page</TableHead>
                    <TableHead className="text-right">Signups</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Hubs w/ visitors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byLandingPage.map((s) => (
                    <TableRow key={s.landingPage}>
                      <TableCell className="font-medium break-all">{s.landingPage}</TableCell>
                      <TableCell className="text-right">{s.signups}</TableCell>
                      <TableCell className="text-right">{s.paid}</TableCell>
                      <TableCell className="text-right">{s.returned}</TableCell>
                      <TableCell className="text-right">{s.viewedHub}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">All {t.signups} signups</CardTitle>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search email, agency, source…"
                className="max-w-xs"
              />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Signed up</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Logins</TableHead>
                    <TableHead>Agency</TableHead>
                    <TableHead>Onboarding</TableHead>
                    <TableHead className="text-right">Hub visitors</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => (
                    <TableRow key={u.email}>
                      <TableCell className="font-medium break-all">
                        {u.email}
                        {u.recent && <Badge variant="secondary" className="ml-2">new</Badge>}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.paid ? "default" : "outline"}>{u.plan || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{u.loginCount}</TableCell>
                      <TableCell>{u.agencyName || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs">
                        {u.onboardingCompleted ? "done" : "incomplete"}
                        {u.installed ? " · installed" : ""}
                      </TableCell>
                      <TableCell className="text-right">{u.hubVisitors}</TableCell>
                      <TableCell className="text-xs">{u.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
