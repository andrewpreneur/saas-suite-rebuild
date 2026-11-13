import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Eye, Users, MousePointerClick, Timer, Play, BarChart3, Layers } from "lucide-react";

interface PageStat {
  path: string;
  views: number;
  visitors: number;
  clicks: number;
  videos: number;
  avg_time_ms: number;
  avg_scroll: number;
}
interface ClickPoint { x: number; y: number; vw: number; vh: number }
interface Milestone { milestone: number; sessions: number }
interface SectionRow { section: string; sessions: number; avg_ms: number }
interface PlanRow { plan: string; pageviews: number; clicks: number; sessions: number }
interface VisitorRow {
  key: string;
  ip: string | null;
  views: number;
  clicks: number;
  videos: number;
  pages: string[];
  country: string | null;
  device: string | null;
  email: string | null;
  plan: string | null;
  source: string | null;
  last: string;
}
interface RecentEvent {
  id: string;
  created_at: string;
  path: string;
  event_type: string;
  label: string | null;
  plan_type: string | null;
  ip_address: string | null;
}
interface Summary {
  totals: { views: number; visitors: number; clicks: number; avg_time_ms: number };
  pages: PageStat[];
  heatmap: number[][];
  click_points: ClickPoint[];
  video: { plays: number; milestones: Milestone[] };
  sections: SectionRow[];
  plans: PlanRow[];
  visitors: VisitorRow[];
  recent_events: RecentEvent[];
}

const RANGES = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const fmtDuration = (ms: number) => {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

const PageAnalyticsPanel = () => {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  // All aggregation happens in the database (page_analytics_summary) — pulling
  // every raw row stalled the panel once traffic grew past ~100k events.
  const load = async (nextDays = days, nextPath = selectedPath) => {
    setLoading(true);
    const { data, error } = await (supabase.rpc as any)("page_analytics_summary", {
      p_days: nextDays,
      p_path: nextPath,
    });
    if (error) console.error("[PageAnalytics] summary failed", error);
    setSummary(error ? null : (data as Summary) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, selectedPath]);

  const totals = summary?.totals ?? { views: 0, visitors: 0, clicks: 0, avg_time_ms: 0 };
  const pageStats = summary?.pages ?? [];
  const heatmapGrid = summary?.heatmap ?? DAYS.map(() => HOURS.map(() => 0));
  const heatmapMax = Math.max(1, ...heatmapGrid.flat());
  const clickHeatmap = (summary?.click_points ?? []).map((pt) => ({
    x: Number(pt.x),
    y: Number(pt.y),
    viewport: { width: Number(pt.vw) || 0, height: Number(pt.vh) || 0 },
  }));
  const videoPlays = summary?.video.plays ?? 0;
  const videoRetention = (summary?.video.milestones ?? []).map((m) => ({
    milestone: `${m.milestone}%`,
    count: m.sessions,
    rate: videoPlays ? Math.round((m.sessions / videoPlays) * 100) : 0,
  }));
  const sectionTime = summary?.sections ?? [];
  const planBreakdown = summary?.plans ?? [];
  const visitors = summary?.visitors ?? [];
  const events = summary?.recent_events ?? [];

  const kpis = [
    { label: "Pageviews", value: totals.views.toLocaleString(), icon: Eye },
    { label: "Unique visitors", value: totals.visitors.toLocaleString(), icon: Users },
    { label: "Clicks tracked", value: totals.clicks.toLocaleString(), icon: MousePointerClick },
    { label: "Avg. time on page", value: fmtDuration(totals.avg_time_ms), icon: Timer },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Page Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Marketing + app page engagement — views, clicks, scroll depth, video retention, click heatmaps and plan segmentation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.days}
              size="sm"
              variant={days === r.days ? "default" : "outline"}
              onClick={() => setDays(r.days)}
            >
              {r.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-bold">{k.value}</p>
                </div>
                <k.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">By page</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="clicks">Click map</TabsTrigger>
          <TabsTrigger value="video">Video retention</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="visitors">Visitors / IPs</TabsTrigger>
          <TabsTrigger value="events">Raw events</TabsTrigger>
        </TabsList>

        <TabsContent value="pages">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page-by-page performance</CardTitle>
              <CardDescription>Click a row to filter the tabs below to that page.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Page</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Visitors</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Videos</TableHead>
                      <TableHead>Avg. scroll</TableHead>
                      <TableHead>Avg. time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageStats.map((p) => (
                      <TableRow
                        key={p.path}
                        className={
                          "cursor-pointer " + (selectedPath === p.path ? "bg-muted" : "")
                        }
                        onClick={() => setSelectedPath(selectedPath === p.path ? null : p.path)}
                      >
                        <TableCell className="font-medium">{p.path}</TableCell>
                        <TableCell>{p.views}</TableCell>
                        <TableCell>{p.visitors}</TableCell>
                        <TableCell>{p.clicks}</TableCell>
                        <TableCell>{p.videos}</TableCell>
                        <TableCell>{p.avg_scroll ? `${Math.round(p.avg_scroll)}%` : "—"}</TableCell>
                        <TableCell>{fmtDuration(p.avg_time_ms)}</TableCell>
                      </TableRow>
                    ))}
                    {!pageStats.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          {loading ? "Loading…" : "No page data yet for this range."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Engagement heatmap {selectedPath ? `— ${selectedPath}` : "— all pages"}
              </CardTitle>
              <CardDescription>Pageviews by day of week and hour (local time).</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="flex gap-1 pl-10 mb-1">
                  {HOURS.map((h) => (
                    <div key={h} className="w-6 text-center text-[10px] text-muted-foreground">
                      {h}
                    </div>
                  ))}
                </div>
                {heatmapGrid.map((row, di) => (
                  <div key={di} className="flex items-center gap-1 mb-1">
                    <div className="w-10 text-xs text-muted-foreground">{DAYS[di]}</div>
                    {row.map((count, hi) => (
                      <div
                        key={hi}
                        title={`${DAYS[di]} ${hi}:00 — ${count} views`}
                        className="w-6 h-6 rounded-sm border border-border/40 transition-transform hover:scale-110"
                        style={{
                          backgroundColor:
                            count === 0
                              ? "hsl(var(--muted))"
                              : `hsl(var(--primary) / ${0.15 + 0.85 * (count / heatmapMax)})`,
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clicks">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Click heatmap {selectedPath ? `— ${selectedPath}` : "— all pages"}
              </CardTitle>
              <CardDescription>
                Dots show where users clicked. Data is normalized to a 400×300 grid.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative w-full max-w-[800px] aspect-[4/3] border rounded-lg bg-muted/30 overflow-hidden mx-auto">
                {clickHeatmap.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                    {loading ? "Loading…" : "No click coordinates yet."}
                  </div>
                )}
                {clickHeatmap.map((pt, i) => {
                  const left = pt.viewport.width ? (pt.x / pt.viewport.width) * 100 : 0;
                  const top = pt.viewport.height ? (pt.y / pt.viewport.height) * 100 : 0;
                  return (
                    <div
                      key={i}
                      className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-primary/60 hover:bg-primary"
                      style={{ left: `${left}%`, top: `${top}%` }}
                      title={`x: ${Math.round(pt.x)}, y: ${Math.round(pt.y)}`}
                    />
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {clickHeatmap.length} clicks recorded
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="video">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Play className="inline h-4 w-4 mr-1" />
                Hero video retention {selectedPath ? `— ${selectedPath}` : "— all pages"}
              </CardTitle>
              <CardDescription>Percentage of plays that reached each milestone.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-4">
                {videoRetention.map((m) => (
                  <Card key={m.milestone}>
                    <CardContent className="pt-6 text-center">
                      <p className="text-3xl font-bold">{m.rate}%</p>
                      <p className="text-xs text-muted-foreground">{m.milestone}</p>
                      <p className="text-xs text-muted-foreground">{m.count} sessions</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Layers className="inline h-4 w-4 mr-1" />
                Time on section {selectedPath ? `— ${selectedPath}` : "— all pages"}
              </CardTitle>
              <CardDescription>Average visible time for tracked page sections.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Section</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Avg. visible time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectionTime.map((s) => (
                      <TableRow key={s.section}>
                        <TableCell className="font-medium">{s.section}</TableCell>
                        <TableCell>{s.sessions}</TableCell>
                        <TableCell>{fmtDuration(s.avg_ms)}</TableCell>
                      </TableRow>
                    ))}
                    {!sectionTime.length && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          {loading ? "Loading…" : "No section visibility data yet."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <BarChart3 className="inline h-4 w-4 mr-1" />
                Engagement by plan
              </CardTitle>
              <CardDescription>Pageviews, clicks and sessions grouped by subscription plan.</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Pageviews</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Sessions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planBreakdown.map((p) => (
                      <TableRow key={p.plan}>
                        <TableCell className="font-medium">
                          <Badge variant="outline">{p.plan}</Badge>
                        </TableCell>
                        <TableCell>{p.pageviews}</TableCell>
                        <TableCell>{p.clicks}</TableCell>
                        <TableCell>{p.sessions}</TableCell>
                      </TableRow>
                    ))}
                    {!planBreakdown.length && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          {loading ? "Loading…" : "No plan-identified traffic yet."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visitors">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visitor-level engagement</CardTitle>
              <CardDescription>
                Top visitors with pages seen, clicks, video plays and whether they converted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Pages</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Videos</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Identified</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visitors.map((v) => (
                      <TableRow key={v.key}>
                        <TableCell className="font-mono text-xs">{v.ip ?? "—"}</TableCell>
                        <TableCell>{v.country ?? "—"}</TableCell>
                        <TableCell>{v.device ?? "—"}</TableCell>
                        <TableCell className="max-w-[240px] truncate text-xs">
                          {v.pages.join(", ")}
                        </TableCell>
                        <TableCell>{v.views}</TableCell>
                        <TableCell>{v.clicks}</TableCell>
                        <TableCell>{v.videos}</TableCell>
                        <TableCell className="text-xs">{v.source ?? "direct"}</TableCell>
                        <TableCell>
                          {v.email ? (
                            <Badge variant="default" className="text-xs">{v.email}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">anonymous</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {v.plan ? <Badge variant="outline" className="text-xs">{v.plan}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {new Date(v.last).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!visitors.length && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground">
                          {loading ? "Loading…" : "No visitor data yet."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Latest events</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[520px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(e.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{e.path}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{e.event_type}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs">
                          {e.label ?? "—"}
                        </TableCell>
                        <TableCell>
                          {e.plan_type ? <Badge variant="secondary" className="text-xs">{e.plan_type}</Badge> : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.ip_address ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PageAnalyticsPanel;
