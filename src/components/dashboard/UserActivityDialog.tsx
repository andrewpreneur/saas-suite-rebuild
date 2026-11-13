import { useEffect, useMemo, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, Circle, Clock3, MessageSquare, PlayCircle, Ticket, UserRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { loadUserActivity, type ActivityUser, type UserActivityData } from "./userActivityData";

const CHART = { videos: "hsl(var(--foreground))", checklist: "hsl(var(--success))", tickets: "hsl(var(--offer))", muted: "hsl(var(--muted))" };
const dateTime = (date?: string | null) => {
  if (!date || Number.isNaN(new Date(date).getTime())) return "Not recorded";
  return new Date(date).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
};

function Count({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) { setCount(value); return; }
    const animation = animate(0, value, { duration: 0.85, onUpdate: n => setCount(Math.round(n)) });
    return () => animation.stop();
  }, [value, reduced]);
  return <>{count.toLocaleString()}</>;
}

function StatCard({ title, icon, children, dark = false }: { title: string; icon: ReactNode; children: ReactNode; dark?: boolean }) {
  return <Card className={`h-full rounded-2xl ${dark ? "border-0 bg-foreground text-background" : "border-border/60 bg-card"}`}>
    <CardContent className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{title}</h3>{icon}</div>
      {children}
    </CardContent>
  </Card>;
}

export default function UserActivityDialog({ user, agencyIds, onClose }: { user: ActivityUser; agencyIds: string[]; onClose: () => void }) {
  const [data, setData] = useState<UserActivityData | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const access = useTeamAccess();
  const reduced = useReducedMotion();
  const chatsAllowed = access.loaded && access.level("support_chats") !== "none";
  const ticketsAllowed = access.loaded && access.level("support_tickets") !== "none";
  const scopeKey = agencyIds.join("|");
  useEffect(() => {
    if (!access.loaded) return;
    let alive = true;
    setData(null); setError("");
    loadUserActivity(user, scopeKey.split("|").filter(Boolean), chatsAllowed, ticketsAllowed)
      .then(result => { if (alive) setData(result); })
      .catch(() => { if (alive) setError("We couldn't load this user's activity. Please try again."); });
    return () => { alive = false; };
  }, [user, scopeKey, chatsAllowed, ticketsAllowed, access.loaded, retry]);

  const timeline = useMemo(() => {
    if (!data) return [];
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - 29 + i);
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), videos: 0, checklist: 0, tickets: 0 };
    });
    for (const [key, records] of [
      ["videos", data.videos.map(v => v.completed_at)],
      ["checklist", data.checklist.map(i => i.completedAt)],
      ["tickets", data.tickets.map(t => t.created_at)],
    ] as const) records.forEach(at => { const day = days.find(d => d.key === at?.slice(0, 10)); if (day) day[key] += 1; });
    return days;
  }, [data]);
  const done = data?.checklist.filter(i => i.completedAt).length || 0;
  const total = data?.checklist.length || 0;
  const pct = total ? Math.round(done / total * 100) : 0;
  const openTickets = data?.tickets.filter(t => ["open", "in_progress"].includes(t.status.toLowerCase())).length || 0;
  const container = { hidden: {}, visible: { transition: { staggerChildren: reduced ? 0 : 0.06 } } };
  const reveal = { hidden: { opacity: 0, y: reduced ? 0 : 14 }, visible: { opacity: 1, y: 0 } };

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="user-activity-dialog max-h-[90dvh] w-[calc(100%-1.5rem)] max-w-5xl overflow-y-auto rounded-2xl border-border/60 p-5 sm:p-7">
      <DialogHeader className="pr-6 text-left">
        <div className="mb-1 flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background"><UserRound className="h-5 w-5" /></div>
          <div className="min-w-0"><DialogTitle className="break-words text-xl font-bold tracking-normal">{user.name || user.email || "User activity"}</DialogTitle>
            <DialogDescription className="mt-1 break-all">{user.email || "User activity"}</DialogDescription></div>
        </div>
      </DialogHeader>
      {error ? <div role="alert" className="py-10 text-center"><p className="mb-4 text-muted-foreground">{error}</p><Button variant="outline" onClick={() => setRetry(r => r + 1)}>Try again</Button></div>
        : !data ? <div aria-label="Loading user activity" role="status" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}</div>
        : <motion.div variants={container} initial="hidden" animate="visible" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <motion.div variants={reveal}><StatCard title="Last login / hub access" icon={<Clock3 className="h-4 w-4 text-muted-foreground" />}>
            <p className="text-lg font-bold">{dateTime(data.progress?.last_accessed || user.last_accessed)}</p>
            <dl className="mt-4 space-y-2 text-xs text-muted-foreground"><div><dt>First recorded access</dt><dd className="mt-1 text-foreground">{dateTime(data.progress?.created_at)}</dd></div>{data.progress?.phone && <div><dt>Phone</dt><dd className="mt-1 text-foreground">{data.progress.phone}</dd></div>}</dl>
          </StatCard></motion.div>
          <motion.div variants={reveal}><StatCard title="Videos watched" icon={<PlayCircle className="h-4 w-4 opacity-60" />} dark>
            <p className="text-4xl font-bold tabular-nums"><Count value={data.videos.length} /></p>
            <p className="mt-1 text-xs opacity-60">Recorded video completions</p>
            <p className="mt-4 text-sm font-semibold">{data.videos[0]?.title || "No videos recorded"}</p>
            {data.videos[0] && <p className="mt-1 text-xs opacity-60">{dateTime(data.videos[0].completed_at)}</p>}
          </StatCard></motion.div>
          <motion.div variants={reveal}><StatCard title="Onboarding checklist" icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}>
            <div className="flex items-center gap-4">
              <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`${pct}% checklist complete`}>
                <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ value: done }, { value: Math.max(total - done, total ? 0 : 1) }]} dataKey="value" innerRadius={42} outerRadius={52} startAngle={90} endAngle={-270} stroke="none" isAnimationActive={!reduced} animationDuration={1000}><Cell fill={CHART.checklist} /><Cell fill={CHART.muted} /></Pie></PieChart></ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl font-bold tabular-nums"><Count value={pct} />%</div>
              </div>
              <div><p className="text-xl font-bold tabular-nums"><Count value={done} /> / {total}</p><p className="mt-1 text-xs text-muted-foreground">{total ? "Items completed" : "No checklist configured"}</p></div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{data.finishedAt ? `Completed ${dateTime(data.finishedAt)}` : total ? "Not yet complete" : "Completion date unavailable"}</p>
          </StatCard></motion.div>
          <motion.div variants={reveal} className="sm:col-span-2"><StatCard title="Activity · past 30 days" icon={<Clock3 className="h-4 w-4 text-muted-foreground" />}>
            <div className="h-48 min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={timeline} margin={{ left: -20, right: 4, top: 8 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={6} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="rounded-lg border border-border bg-popover p-3 text-xs shadow-elevated"><p className="mb-2 font-semibold">{label}</p>{payload.map(p => <p key={String(p.dataKey)}>{p.name}: {p.value}</p>)}</div> : null} />
              <Area dataKey="videos" name="Videos" stroke={CHART.videos} fill={CHART.videos} fillOpacity={0.08} strokeWidth={2} isAnimationActive={!reduced} />
              <Area dataKey="checklist" name="Checklist items" stroke={CHART.checklist} fill={CHART.checklist} fillOpacity={0.08} strokeWidth={2} isAnimationActive={!reduced} />
              {ticketsAllowed && <Area dataKey="tickets" name="Tickets" stroke={CHART.tickets} fill={CHART.tickets} fillOpacity={0.08} strokeWidth={2} isAnimationActive={!reduced} />}
            </AreaChart></ResponsiveContainer></div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>Videos</span><span>Checklist items</span>{ticketsAllowed && <span>Tickets</span>}</div>
          </StatCard></motion.div>
          <motion.div variants={reveal}><StatCard title="Support tickets" icon={<Ticket className="h-4 w-4 text-muted-foreground" />}>
            {ticketsAllowed ? <><p className="text-4xl font-bold tabular-nums"><Count value={data.tickets.length} /></p><p className="mt-2 text-xs text-muted-foreground">{openTickets} awaiting reply · {data.tickets.length - openTickets} done</p></> : <p className="text-sm text-muted-foreground">Support ticket access is restricted.</p>}
          </StatCard></motion.div>
          <motion.div variants={reveal} className="sm:col-span-2 lg:col-span-3"><StatCard title="Last support message" icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}>
            {data.lastMessage ? <><p className="mb-3 text-xs text-muted-foreground">{data.lastMessage.sender} · {dateTime(data.lastMessage.at)}</p><p className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed">{data.lastMessage.content}</p></> : <p className="text-sm text-muted-foreground">{chatsAllowed || ticketsAllowed ? "No support messages recorded in your accessible conversations." : "Support access is restricted."}</p>}
          </StatCard></motion.div>
          <motion.div variants={reveal}><StatCard title="Checklist progress" icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}>
            <ul className="max-h-72 space-y-4 overflow-y-auto">{data.checklist.map(i => <li key={i.id} className="flex items-start gap-2">{i.completedAt ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-foreground" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}<div className="min-w-0"><p className="break-words text-sm">{i.title}</p><p className="mt-1 text-xs text-muted-foreground">{i.completedAt ? dateTime(i.completedAt) : "Not completed"}</p></div></li>)}</ul>
            {!total && <p className="text-sm text-muted-foreground">No checklist configured.</p>}
          </StatCard></motion.div>
          <motion.div variants={reveal}><StatCard title="Video history" icon={<PlayCircle className="h-4 w-4 text-muted-foreground" />}>
            <ul className="max-h-72 space-y-4 overflow-y-auto">{data.videos.map(v => <li key={v.id}><p className="break-words text-sm font-medium">{v.title}</p><p className="mt-1 text-xs text-muted-foreground">{dateTime(v.completed_at)}</p></li>)}</ul>
            {!data.videos.length && <p className="text-sm text-muted-foreground">No video completions recorded.</p>}
          </StatCard></motion.div>
          <motion.div variants={reveal}><StatCard title="All support tickets" icon={<Ticket className="h-4 w-4 text-muted-foreground" />}>
            {ticketsAllowed ? <><div className="max-h-72 space-y-4 overflow-y-auto">{data.tickets.map(t => <details key={t.id} className="border-b border-border/60 pb-3"><summary className="cursor-pointer text-sm"><span className="font-medium">#{t.ticket_number} · {t.issue_category}</span><Badge variant="outline" className="ml-2 mt-1">{t.status.replace(/_/g, " ")}</Badge><span className="mt-2 block text-xs text-muted-foreground">{dateTime(t.created_at)}</span></summary><p className="mt-3 whitespace-pre-wrap break-words text-sm">{t.request_text}</p>{t.admin_response && <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted-foreground">{t.admin_response}</p>}</details>)}</div>{!data.tickets.length && <p className="text-sm text-muted-foreground">No support tickets recorded.</p>}</> : <p className="text-sm text-muted-foreground">Support ticket access is restricted.</p>}
          </StatCard></motion.div>
        </motion.div>}
    </DialogContent>
  </Dialog>;
}