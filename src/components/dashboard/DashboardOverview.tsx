import PortalInviteBar from "@/components/highlevel/PortalInviteBar";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowUp,
  ArrowDown,
  CalendarIcon,
  GraduationCap,
  LifeBuoy,
  Rocket,
  Sparkles,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Save,
  Trash2,
  Users,
  X,
  ArrowUpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DateRange } from "react-day-picker";
import { useDayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";
import { StatStrip } from "@/components/premium/StatStrip";
import { WorkspaceFolders } from "@/components/premium/dashboard/WorkspaceFolders";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import AnnouncementsCard from "@/components/dashboard/AnnouncementsCard";
import { supabase } from "@/integrations/supabase/client";
import { moduleCompletionUserIds } from "../../../supabase/functions/_shared/moduleCompletionIds.ts";
import { useUser } from "@/contexts/UserContext";
import { motion } from "framer-motion";
import { Banner } from "@/components/ui/banner";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { SectionCard } from "@/components/premium/SectionCard";
import AnimatedTabs from "@/components/premium/21st/animated-tabs";
import { EmptyState } from "@/components/premium/21st/empty-state";
import { NextStepCard, type NextStep } from "@/components/premium/dashboard/NextStepCard";
import SetupHelpPopup from "@/components/dashboard/SetupHelpPopup";
import { chartColors } from "@/lib/chart-colors";
import { checkInstallStatus } from "@/lib/installStatus";
import { EASE_OUT } from "@/lib/motion";
import UserActivityDialog from "./UserActivityDialog";
import { dashboardVideoTotal } from "./videoTotal";

type Metric = "all" | "users" | "logins" | "onboarding";

interface AgencyUser {
  id: string;
  agency_id?: string;
  email: string | null;
  name: string | null;
  created_at: string;
  last_accessed: string | null;
  completed: number;
  total: number;
}

interface DayPoint {
  date: string;
  label: string;
  users: number;
  logins: number;
  onboarding: number;
  activeNames: string[];
  users_t?: number;
  logins_t?: number;
  onboarding_t?: number;
}

const DAYS = 30;
const ROWS_PER_PAGE = 30;

const dayKey = (iso: string) => new Date(iso).toISOString().slice(0, 10);

const SERIES: Record<
  Exclude<Metric, "all">,
  { key: "users" | "logins" | "onboarding"; label: string; color: string }
> = {
  users: { key: "users", label: "New users", color: chartColors.categorical[0] },
  logins: { key: "logins", label: "Logins", color: chartColors.categorical[2] },
  onboarding: { key: "onboarding", label: "Onboarding completions", color: chartColors.categorical[3] },
};

/** Custom month caption that renders <  Month Year  > in a single centered row. */
function MonthCaptionWithNav({
  calendarMonth,
  className,
  ...divProps
}: {
  calendarMonth: { date: Date };
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  const { previousMonth, nextMonth, goToMonth } = useDayPicker();
  return (
    <div
      className={cn("flex h-9 w-full items-center justify-center gap-3", className)}
      {...divProps}
    >
      <button
        type="button"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-brand-subtle hover:text-brand"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="select-none text-sm font-semibold">
        {format(calendarMonth.date, "MMMM yyyy")}
      </span>
      <button
        type="button"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-brand-subtle hover:text-brand"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/** `hubCard` is the Client Hub URL card; the page shell passes it so it sits beside the next step. */
export default function DashboardOverview({ hubCard }: { hubCard?: ReactNode }) {
  const { email, plan } = useUser();
  const isAdvanced = (plan || "ADVANCED") === "ADVANCED";

  const [users, setUsers] = useState<AgencyUser[]>([]);
  const [activityUser, setActivityUser] = useState<AgencyUser | null>(null);
  const [activityAgencyIds, setActivityAgencyIds] = useState<string[]>([]);
  const [tickets, setTickets] = useState<{ status: string }[]>([]);
  const [chatThreads, setChatThreads] = useState(0);
  const [completionEvents, setCompletionEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("all");
  // The dashboard shows one thing at a time under the numbers: where to go, who the clients are, or the charts.
  const [dashTab, setDashTab] = useState<"workspace" | "clients" | "insights">("workspace");

  const [range, setRange] = useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (DAYS - 1));
    return { from, to };
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AgencyUser | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Same account-wide install check the hub card uses; drives the "next step" card.
  const [installed, setInstalled] = useState<boolean | null>(null);
  useEffect(() => {
    if (!email) return;
    let active = true;
    checkInstallStatus(email)
      .then((ok) => active && setInstalled(ok))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [email]);

  // "Edit Clients" from a limit warning scrolls here and highlights the list.
  const clientsRef = useRef<HTMLDivElement | null>(null);
  const [limitHintOpen, setLimitHintOpen] = useState(false);
  useEffect(() => {
    const onHighlight = () => {
      setLimitHintOpen(true);
      // Wait a frame so the callout is in the DOM before scrolling to it.
      requestAnimationFrame(() => {
        clientsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    window.addEventListener("highlight-client-list", onHighlight);
    return () => window.removeEventListener("highlight-client-list", onHighlight);
  }, []);

  useEffect(() => {
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    if (!email) {
      stop();
      setLoading(false);
      setLoadError(null);
      return;
    }

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { data: me } = await supabase
          .from("saas_suite_users")
          .select(
            "agency_id, agency_id_basic, agency_id_advanced, agency_id_elite, original_agency_id, original_agency_id_basic, original_agency_id_advanced, original_agency_id_elite, agency_name",
          )
          .eq("email", email)
          .maybeSingle();

        const agencyIds = Array.from(new Set(Object.values(me || {}).filter(Boolean) as string[]));
        if (agencyIds.length === 0) {
          if (alive) setUsers([]);
          return;
        }
        if (alive) setActivityAgencyIds(agencyIds);

        const [{ data: progress }, { data: checklistItems }, ticketsRes, threadsRes, customVideosRes] =
          await Promise.all([
            supabase
              .from("user_progress")
              .select("id, email, name, agency_id, created_at, last_accessed")
              .in("agency_id", agencyIds),
            supabase.from("agency_onboarding_checklist").select("id").in("agency_id", agencyIds),
            supabase.rpc("get_agency_tickets", { user_email: email }),
            supabase.from("chat_threads").select("id").in("agency_id", agencyIds),
            supabase
              .from("custom_onboarding_videos")
              .select("id", { count: "exact", head: true })
              .in("agency_id", agencyIds),
          ]);
        if (customVideosRes.error) throw customVideosRes.error;
        const totalVideos = dashboardVideoTotal(customVideosRes.count ?? 0);

        const ids = moduleCompletionUserIds((progress || []).map((p) => p.id));
        const [{ data: completions }, { data: checklistCompletions }] = await Promise.all([
          ids.length
            ? supabase.from("module_completion").select("user_id, completed_at").in("user_id", ids)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("user_onboarding_checklist_completion")
            .select("user_identifier, checklist_item_id, completed_at, agency_id")
            .in("agency_id", agencyIds),
        ]);

        // Only count completions for items still on the current checklist, so
        // deleted or reordered items can't push progress past 100%.
        const checklistItemIds = new Set((checklistItems || []).map((i: { id: string }) => i.id));
        const validChecklistCompletions = (checklistCompletions || []).filter(
          (c: { checklist_item_id: string | null }) =>
            !c.checklist_item_id || checklistItemIds.has(c.checklist_item_id),
        );

        const v1Emails = new Set(
          (progress || []).map((p) => (p.email || "").toLowerCase()).filter(Boolean),
        );

        const moduleCounts = new Map<string, number>();
        (completions || []).forEach((c) =>
          moduleCounts.set(c.user_id, (moduleCounts.get(c.user_id) || 0) + 1),
        );

        const checklistCounts = new Map<string, number>();
        (validChecklistCompletions || []).forEach((c) => {
          const key = (c.user_identifier || "").toLowerCase();
          checklistCounts.set(key, (checklistCounts.get(key) || 0) + 1);
        });

        const totalChecklist = (checklistItems || []).length || 1;

        const rows: AgencyUser[] = (progress || []).map((p) => {
          const modules = moduleCounts.get(p.id) || 0;
          const checklist = checklistCounts.get((p.email || "").toLowerCase()) || 0;
          const useChecklist = modules === 0 && checklist > 0;
          return {
            id: p.id,
            agency_id: p.agency_id,
            email: p.email,
            name: p.name,
            created_at: p.created_at,
            last_accessed: p.last_accessed,
            completed: useChecklist ? checklist : modules,
            total: useChecklist ? totalChecklist : totalVideos,
          };
        });

        // V2-only users (checklist completions without a user_progress row)
        checklistCounts.forEach((count, identifier) => {
          if (v1Emails.has(identifier)) return;
          rows.push({
            id: identifier,
            agency_id: validChecklistCompletions.find(
              (c) => c.user_identifier.toLowerCase() === identifier,
            )?.agency_id,
            email: identifier,
            name: null,
            created_at: new Date().toISOString(),
            last_accessed: null,
            completed: count,
            total: totalChecklist,
          });
        });

        const events = [
          ...(completions || []).map((c) => c.completed_at),
          ...(validChecklistCompletions || []).map((c) => c.completed_at),
        ].filter(Boolean) as string[];

        if (alive) {
          setUsers(rows);
          setTickets(((ticketsRes.data as any[]) || []).map((t) => ({ status: t.status })));
          setChatThreads((threadsRes.data || []).length);
          setCompletionEvents(events);
          setLoadError(null);
        }
      } catch (error) {
        if (alive) setLoadError(loadErrorText(error, "Couldn't load the dashboard."));
      } finally {
        stop();
        if (alive) setLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
      stop();
    };
  }, [email, reloadKey]);

  const series = useMemo<DayPoint[]>(() => {
    const days: DayPoint[] = [];
    const end = range?.to ?? new Date();
    const start =
      range?.from ??
      (() => {
        const s = new Date(end);
        s.setDate(end.getDate() - (DAYS - 1));
        return s;
      })();
    const spanDays = Math.max(
      1,
      Math.round((end.setHours(0, 0, 0, 0) - new Date(start).setHours(0, 0, 0, 0)) / 86400000) + 1,
    );
    for (let i = spanDays - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(new Date(end).getDate() - i);
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        users: 0,
        logins: 0,
        onboarding: 0,
        activeNames: [],
      });
    }
    const index = new Map(days.map((d) => [d.date, d]));

    users.forEach((u) => {
      const created = index.get(dayKey(u.created_at));
      if (created) created.users += 1;
      if (u.last_accessed) {
        const hit = index.get(dayKey(u.last_accessed));
        if (hit) {
          hit.logins += 1;
          hit.activeNames.push(u.name || u.email || "Unknown user");
        }
      }
    });

    completionEvents.forEach((iso) => {
      const hit = index.get(dayKey(iso));
      if (hit) hit.onboarding += 1;
    });

    // Cumulative (running total) values for the chart, including everything
    // that happened before the visible window so the lines only ever grow.
    const startKey = days[0]?.date ?? "";
    let cu = users.filter((u) => dayKey(u.created_at) < startKey).length;
    let cl = users.filter((u) => !!u.last_accessed && dayKey(u.last_accessed!) < startKey).length;
    let co = completionEvents.filter((iso) => dayKey(iso) < startKey).length;

    return days.map((d) => {
      cu += d.users;
      cl += d.logins;
      co += d.onboarding;
      return { ...d, users_t: cu, logins_t: cl, onboarding_t: co };
    });
  }, [users, completionEvents, range]);

  const activeMetrics = useMemo(
    () => (metric === "all" ? (["users", "logins", "onboarding"] as const) : ([metric] as const)),
    [metric],
  );

  const maxValue = useMemo(
    () =>
      series.reduce(
        (max, d) =>
          Math.max(max, ...activeMetrics.map((m) => (d as any)[`${SERIES[m].key}_t`] ?? 0)),
        0,
      ),
    [series, activeMetrics],
  );

  const headline = useMemo(() => {
    const sum = (from: number, to: number, key: "users" | "logins" | "onboarding") =>
      series.slice(from, to).reduce((s, d) => s + d[key], 0);
    const keys = activeMetrics;
    const mid = Math.ceil(series.length / 2);
    const curr = keys.reduce((s, k) => s + sum(mid, series.length, k), 0);
    const prior = keys.reduce((s, k) => s + sum(0, mid, k), 0);
    const change = prior === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prior) / prior) * 100);
    return { curr, prior, change, diff: curr - prior };
  }, [series, activeMetrics]);

  const stats = useMemo(() => {
    const now = Date.now();
    const within = (iso: string | null, days: number) =>
      !!iso && now - new Date(iso).getTime() <= days * 86400000;

    const active7 = users.filter((u) => within(u.last_accessed, 7)).length;
    const active14 = users.filter((u) => within(u.last_accessed, 14)).length;
    const active30 = users.filter((u) => within(u.last_accessed, 30)).length;
    const inactive = users.filter((u) => !within(u.last_accessed, 14)).length;
    const avgCompletion = users.length
      ? Math.round(
          (users.reduce((s, u) => s + Math.min(u.completed / u.total, 1), 0) / users.length) * 100,
        )
      : 0;

    const normalizedStatus = (t: { status: string }) => (t.status || "").toLowerCase();
    const openTickets = tickets.filter((t) => normalizedStatus(t) !== "completed").length;
    const waitingOnCustomer = tickets.filter((t) => normalizedStatus(t) === "responded").length;
    const closedTickets = tickets.filter((t) => normalizedStatus(t) === "completed").length;

    return {
      total: users.length,
      active7,
      active14,
      active30,
      inactive,
      avgCompletion,
      openTickets,
      waitingOnCustomer,
      closedTickets,
    };
  }, [users, tickets]);

  const tableRows = useMemo(
    () =>
      [...users].sort((a, b) => {
        const at = a.last_accessed ? new Date(a.last_accessed).getTime() : 0;
        const bt = b.last_accessed ? new Date(b.last_accessed).getTime() : 0;
        return bt - at;
      }),
    [users],
  );

  const totalPages = Math.max(1, Math.ceil(tableRows.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = tableRows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  const startEdit = (u: AgencyUser) => {
    setEditingId(u.id);
    setEditName(u.name || "");
    setEditEmail(u.email || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await supabase.rpc("update_agency_client", {
      p_user_id: editingId,
      p_name: editName || null,
      p_email: editEmail ? editEmail.trim().toLowerCase() : null,
    });
    setEditingId(null);
    toast.success("User updated");
    setReloadKey((k) => k + 1);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await supabase.rpc("delete_agency_client", { p_user_id: deleteTarget.id });
    setDeleteTarget(null);
    toast.success("User removed");
    setReloadKey((k) => k + 1);
  };

  const toggleSel = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const confirmBulkDelete = async () => {
    setBulkBusy(true);
    const ids = [...selectedIds];
    let failed = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc("delete_agency_client", { p_user_id: id });
      if (error) failed++;
    }
    setBulkBusy(false);
    setBulkOpen(false);
    setSelectedIds(new Set());
    failed
      ? toast.error(`${ids.length - failed} removed, ${failed} failed`)
      : toast.success(`${ids.length} users removed`);
    setReloadKey((k) => k + 1);
  };

  if (loadError) return <LoadNotice error={loadError} onRetry={() => setReloadKey((key) => key + 1)} />;
  if (loading) return <OverviewSkeleton />;

  const up = headline.change >= 0;
  const isAll = metric === "all";
  const headlineLabel = isAll ? "Total clients" : SERIES[metric as Exclude<Metric, "all">].label;
  const headlineValue = isAll ? stats.total : headline.curr;
  const headlineDiff = headline.diff;
  const headlinePct = headline.change;

  const openTool = (tool: string) =>
    window.dispatchEvent(new CustomEvent("tipbot-select-tool", { detail: { tool } }));
  const scrollToClients = () => {
    setDashTab("clients");
    window.setTimeout(() => clientsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const newInRange = series.reduce((sum, d) => sum + d.users, 0);
  const active7Pct = stats.total ? Math.round((stats.active7 / stats.total) * 100) : 0;

  // One next step, picked from what the numbers say. The rest become quiet links.
  const candidates: Array<NextStep & { short: string; when: boolean }> = [
    {
      when: installed === false,
      short: "Finish installing your Client Hub",
      title: "Finish installing your Client Hub",
      description:
        "Your clients can't see the hub inside HighLevel yet. Add the menu link and you are live.",
      actionLabel: "Open Client Hub setup",
      onAction: () => openTool("client-hub"),
      icon: <Rocket />,
    },
    {
      when: stats.total === 0,
      short: "Invite your first client",
      title: "Invite your first client",
      description:
        "Share your Client Hub link. Once someone logs in, their progress shows up on this page.",
      actionLabel: "See how to invite clients",
      onAction: scrollToClients,
      icon: <UserPlus />,
    },
    {
      when: stats.openTickets > 0,
      short: `Reply to ${stats.openTickets} open ${stats.openTickets === 1 ? "ticket" : "tickets"}`,
      title: `Reply to ${stats.openTickets} open support ${stats.openTickets === 1 ? "ticket" : "tickets"}`,
      description:
        "Fast answers keep clients subscribed. Write a reply and we email them a polished update.",
      actionLabel: "Open Client Support",
      onAction: () => openTool("support"),
      icon: <LifeBuoy />,
    },
    {
      when: stats.inactive > 0,
      short: `Check in with ${stats.inactive} quiet ${stats.inactive === 1 ? "client" : "clients"}`,
      title: `Check in with ${stats.inactive} quiet ${stats.inactive === 1 ? "client" : "clients"}`,
      description: "They have not logged in for 14 days or more. A short message now can save the account.",
      actionLabel: "Review clients",
      onAction: scrollToClients,
      icon: <Users />,
    },
  ];
  const due = candidates.filter((c) => c.when);
  const nextStep: NextStep = due[0] ?? {
    title: "Make the hub feel like your own",
    description: "Everything is on track. Polish your colors, logo and menu so the hub matches your brand.",
    actionLabel: "Open Branding",
    onAction: () => openTool("branding"),
    icon: <Sparkles />,
  };
  const alsoDue = due.slice(1, 3).map((c) => ({ label: c.short, onClick: c.onAction }));

  return (
    <div className="space-y-4 sm:space-y-6">
      <Reveal className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <RevealItem className="lg:col-span-2">
          <NextStepCard step={nextStep} also={alsoDue} />
        </RevealItem>
        <RevealItem>
          {hubCard}
        </RevealItem>

        <RevealItem className="lg:col-span-3">
          <StatStrip
            stats={[
              { label: "Clients", value: stats.total.toLocaleString(), hint: `+${newInRange.toLocaleString()} this period`, onClick: () => setDashTab("clients") },
              { label: "Active this week", value: stats.active7.toLocaleString(), hint: `${active7Pct}%`, onClick: () => setDashTab("insights") },
              { label: "Lesson completion", value: `${stats.avgCompletion}%`, hint: "average", onClick: () => setDashTab("insights") },
              { label: "Open tickets", value: stats.openTickets.toLocaleString(), hint: `${stats.waitingOnCustomer} waiting`, onClick: () => openTool("support") },
            ]}
          />
        </RevealItem>

        <RevealItem className="lg:col-span-3">
          <AnimatedTabs
            variant="segment"
            activeTab={dashTab}
            onChange={(id) => setDashTab(id as typeof dashTab)}
            tabs={[
              { id: "workspace", label: "Workspace" },
              { id: "clients", label: "Clients" },
              { id: "insights", label: "Insights" },
            ]}
          />
        </RevealItem>

        {dashTab === "workspace" ? (
          <RevealItem className="lg:col-span-3">
            <WorkspaceFolders />
          </RevealItem>
        ) : null}

        {dashTab === "insights" ? (
        <>
        {/* Main chart */}
        <RevealItem className="lg:col-span-2">
          <section className="px-surface h-full p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">Growth</h2>
                <p className="mt-0.5 text-small text-muted-foreground">
                  Running totals for the dates you pick
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="px-eyebrow">{headlineLabel}</p>
                <div className="mt-1 flex items-baseline gap-2 sm:justify-end">
                  <span className="text-h3 font-semibold tabular-nums leading-none text-foreground">
                    {headlineValue.toLocaleString()}
                  </span>
                  <span
                    className={
                      "inline-flex items-center gap-0.5 text-small font-medium tabular-nums " +
                      (up ? "!text-success" : "!text-destructive")
                    }
                  >
                    {up ? (
                      <ArrowUp className="size-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowDown className="size-3.5" aria-hidden="true" />
                    )}
                    {headlineDiff >= 0 ? "+" : "-"}
                    {Math.abs(headlineDiff).toLocaleString()} ({headlinePct >= 0 ? "+" : "-"}
                    {Math.abs(headlinePct)}%)
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="max-w-full overflow-x-auto">
                <AnimatedTabs
                  variant="segment"
                  activeTab={metric}
                  onChange={(id) => setMetric(id as Metric)}
                  tabs={[
                    { id: "all", label: "All" },
                    { id: "users", label: "Users" },
                    { id: "logins", label: "Logins" },
                    { id: "onboarding", label: "Onboarding" },
                  ]}
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 gap-2 font-medium sm:h-9">
                    <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                    {range?.from
                      ? `${format(range.from, "MMM d")} – ${format(range.to ?? range.from, "MMM d, yyyy")}`
                      : "Select date range"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto max-w-[95vw] overflow-x-auto rounded-xl p-0"
                  align="start"
                >
                  <Calendar
                    mode="range"
                    numberOfMonths={1}
                    selected={range}
                    hideNavigation
                    components={{ MonthCaption: MonthCaptionWithNav }}
                    onSelect={(next, selectedDay) => {
                      // If a complete range is already selected, start a new one
                      if (range?.from && range?.to) {
                        setRange({ from: selectedDay, to: undefined });
                        return;
                      }
                      setRange(next);
                    }}
                    defaultMonth={range?.from}
                    initialFocus
                    className="pointer-events-auto p-4"
                    formatters={{
                      formatWeekdayName: (day) => format(day, "EEEEE"),
                    }}
                    classNames={{
                      months: "flex flex-col gap-3",
                      month: "flex w-full flex-col gap-2",
                      month_caption: "flex w-full items-center justify-center",
                      month_grid: "w-full border-collapse",
                      weekdays: "flex w-full",
                      weekday:
                        "flex h-[2.25rem] w-[2.25rem] items-center justify-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                      week: "mt-1 flex w-full",
                      day: "h-[2.25rem] w-[2.25rem] p-0 text-center align-middle",
                      day_button:
                        "h-[2.25rem] w-[2.25rem] flex items-center justify-center rounded-md p-0 text-sm font-normal hover:bg-muted data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-brand-subtle data-[range-middle=true]:text-foreground data-[range-start=true]:rounded-md data-[range-start=true]:bg-brand data-[range-start=true]:text-brand-foreground data-[range-start=true]:hover:bg-brand data-[range-end=true]:rounded-md data-[range-end=true]:bg-brand data-[range-end=true]:text-brand-foreground data-[range-end=true]:hover:bg-brand data-[selected-single=true]:rounded-md data-[selected-single=true]:bg-brand data-[selected-single=true]:text-brand-foreground",
                      range_start: "bg-transparent",
                      range_end: "bg-transparent",
                      range_middle: "bg-transparent",
                      today: "font-semibold",
                      outside: "text-muted-foreground/50",
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="-ml-2 mt-4 h-[260px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {Object.values(SERIES).map((s) => (
                      <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12, fill: chartColors.axis }}
                    interval={Math.max(0, Math.ceil(series.length / 8) - 1)}
                    minTickGap={4}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={38}
                    domain={[0, Math.max(1, maxValue)]}
                    tick={{ fontSize: 12, fill: chartColors.axis }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip metric={metric} />}
                    cursor={{ stroke: chartColors.axis, strokeDasharray: "3 3" }}
                  />
                  {activeMetrics.map((m) => (
                    <Area
                      key={m}
                      type="monotone"
                      dataKey={`${SERIES[m].key}_t`}
                      name={SERIES[m].label}
                      stroke={SERIES[m].color}
                      strokeWidth={2}
                      fill={`url(#fill-${SERIES[m].key})`}
                      activeDot={{ r: 4, strokeWidth: 2 }}
                      animationDuration={500}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              {activeMetrics.map((m) => (
                <div key={m} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: SERIES[m].color }}
                    aria-hidden="true"
                  />
                  <span className="text-caption text-muted-foreground">{SERIES[m].label}</span>
                </div>
              ))}
            </div>
          </section>
        </RevealItem>

        {/* Engagement: who is active, who has gone quiet */}
        <RevealItem>
          <SectionCard
            className="flex h-full flex-col"
            bodyClassName="flex flex-1 flex-col justify-between gap-6"
            icon={<Activity />}
            title="Engagement"
            description="Clients who logged in recently"
          >
            <div className="space-y-4">
              {[
                { label: "Last 7 days", value: stats.active7 },
                { label: "Last 14 days", value: stats.active14 },
                { label: "Last 30 days", value: stats.active30 },
              ].map((row) => {
                const pct = stats.total ? Math.round((row.value / stats.total) * 100) : 0;
                return (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between gap-3 text-small">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {row.value}{" "}
                        <span className="font-normal text-muted-foreground">({pct}%)</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="px-brand-fill h-full rounded-full !shadow-none"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.2 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={scrollToClients}
                className="rounded-md p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <dt className="text-caption text-muted-foreground">Quiet for 14+ days</dt>
                <dd
                  className={
                    "mt-1 text-h4 font-semibold tabular-nums " +
                    (stats.inactive > 0 ? "!text-destructive" : "")
                  }
                >
                  {stats.inactive.toLocaleString()}
                </dd>
              </button>
              <button
                type="button"
                onClick={() => openTool("support")}
                className="rounded-md p-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <dt className="text-caption text-muted-foreground">AI support chats</dt>
                <dd className="mt-1 text-h4 font-semibold tabular-nums text-foreground">
                  {chatThreads.toLocaleString()}
                </dd>
              </button>
            </dl>
          </SectionCard>
        </RevealItem>

        </>
        ) : null}

        <RevealItem className="lg:col-span-3">
          <SetupHelpPopup />
        </RevealItem>
      </Reveal>

      {/* Clients table */}
      {dashTab === "clients" ? (
      <section
        ref={clientsRef}
        className={cn(
          "px-surface scroll-mt-24 transition-shadow duration-300",
          limitHintOpen && "ring-2 ring-warning ring-offset-2 ring-offset-background",
        )}
      >
        {limitHintOpen && (
          <Banner
            tone="warning"
            className="m-4 mb-0"
            title="You're at your client limit"
            onDismiss={() => setLimitHintOpen(false)}
            action={
              <Button
                size="sm"
                onClick={() =>
                  window.open("https://billing.stripe.com/p/login/bIY04697i9jzghy4gg", "_blank")
                }
              >
                <ArrowUpCircle className="mr-1.5 h-4 w-4" />
                Show me my options
              </Button>
            }
          >
            Edit or remove clients below to stay under your limit. Use the pencil to rename a client
            or the trash icon to remove one. Prefer to keep everyone? Upgrade for more seats.
          </Banner>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-6 sm:pt-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
              <Users />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">
                Clients{" "}
                <span className="font-normal tabular-nums text-muted-foreground">
                  {stats.total.toLocaleString()}
                </span>
              </h2>
              <p className="text-small text-muted-foreground">
                Status, onboarding progress{isAdvanced ? " and last activity" : ""}
              </p>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-small text-muted-foreground">{selectedIds.size} selected</span>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkOpen(true)}>
                Remove
              </Button>
            </div>
          )}
        </div>
        <div className="sm:px-1">
          <PortalInviteBar />
        </div>
        {tableRows.length === 0 ? (
          <EmptyState
            icon={
              <span className="px-icon-chip">
                <UserPlus className="size-5" />
              </span>
            }
            title="No clients yet"
            description="Once people log into your onboarding they will show up here."
          />
        ) : (
          <div className="px-2 pb-2 sm:px-4 sm:pb-4">
            <div className="max-h-[540px] overflow-x-auto overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        aria-label="Select all on this page"
                        checked={
                          pagedRows.length > 0 && pagedRows.every((r) => selectedIds.has(r.id))
                        }
                        onCheckedChange={(v) =>
                          setSelectedIds((prev) => {
                            const n = new Set(prev);
                            pagedRows.forEach((r) => (v ? n.add(r.id) : n.delete(r.id)));
                            return n;
                          })
                        }
                      />
                    </TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    {isAdvanced && <TableHead>Last active</TableHead>}
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((u) => {
                    const pct = Math.min(100, Math.round((u.completed / u.total) * 100));
                    const days = u.last_accessed
                      ? Math.floor((Date.now() - new Date(u.last_accessed).getTime()) / 86400000)
                      : null;
                    const status =
                      days === null || days >= 14
                        ? { label: "Inactive", variant: "danger" as const }
                        : days >= 7
                          ? { label: "At risk", variant: "warning" as const }
                          : { label: "Active", variant: "success" as const };
                    const display = u.name || u.email || "Unknown";
                    return (
                      <TableRow key={u.id} className="transition-colors hover:bg-brand-subtle/50">
                        <TableCell className="w-10">
                          <Checkbox
                            aria-label="Select user"
                            checked={selectedIds.has(u.id)}
                            onCheckedChange={() => toggleSel(u.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {editingId === u.id ? (
                            <div className="flex min-w-[180px] flex-col gap-1.5">
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="h-9"
                                placeholder="Name"
                                aria-label="Name"
                              />
                              <Input
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="h-9"
                                placeholder="Email"
                                aria-label="Email"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span
                                className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-subtle text-caption font-semibold text-brand"
                                aria-hidden="true"
                              >
                                {initials(display)}
                              </span>
                              <div className="min-w-0">
                                <Button
                                  variant="link"
                                  onClick={() => setActivityUser(u)}
                                  aria-label={`View activity for ${u.name || u.email || "user"}`}
                                  className="h-auto max-w-[220px] justify-start p-0 text-small font-medium text-foreground"
                                >
                                  <span className="truncate">{display}</span>
                                </Button>
                                {u.name && u.email && (
                                  <div className="max-w-[220px] truncate text-caption font-normal text-muted-foreground">
                                    {u.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className="whitespace-nowrap">
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-brand"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="whitespace-nowrap text-caption tabular-nums text-muted-foreground">
                              {u.completed}/{u.total}
                            </span>
                          </div>
                        </TableCell>
                        {isAdvanced && (
                          <TableCell className="whitespace-nowrap text-small text-muted-foreground">
                            {days === null
                              ? "Never"
                              : days === 0
                                ? "Today"
                                : days === 1
                                  ? "1 day ago"
                                  : `${days} days ago`}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          {editingId === u.id ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={saveEdit}
                                aria-label="Save changes"
                                className="size-9"
                              >
                                <Save className="size-4 text-success" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                                aria-label="Cancel edit"
                                className="size-9"
                              >
                                <X className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => startEdit(u)}
                                aria-label={`Edit ${u.name || u.email || "user"}`}
                                className="size-9 text-muted-foreground hover:text-foreground"
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeleteTarget(u)}
                                aria-label={`Remove ${u.name || u.email || "user"}`}
                                className="size-9 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {tableRows.length > ROWS_PER_PAGE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-4 sm:px-6">
            <p className="text-small text-muted-foreground">
              Showing {(currentPage - 1) * ROWS_PER_PAGE + 1}–
              {Math.min(currentPage * ROWS_PER_PAGE, tableRows.length)} of {tableRows.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-small tabular-nums text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-9"
                disabled={currentPage === totalPages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </section>
      ) : null}

      {dashTab === "workspace" ? <AnnouncementsCard /> : null}

      {activityUser && (
        <UserActivityDialog
          key={activityUser.id}
          user={activityUser}
          agencyIds={activityAgencyIds}
          onClose={() => setActivityUser(null)}
        />
      )}

      <AlertDialog open={bulkOpen} onOpenChange={(o) => !bulkBusy && setBulkOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedIds.size} users</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose their onboarding progress and checklist completions. They can still log
              in later, but will start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmBulkDelete();
              }}
              disabled={bulkBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkBusy ? "Removing…" : "Remove all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove user</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              {deleteTarget?.name || deleteTarget?.email || "this user"}? They will lose their
              onboarding progress and checklist completions. They can still log in later, but will
              start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Loading placeholder in the shape of the real page, so nothing jumps on arrival. */
function OverviewSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your dashboard</span>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="px-skeleton h-36 lg:col-span-2" />
        <div className="px-skeleton h-36" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-skeleton h-28" />
        ))}
      </div>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <div className="px-skeleton h-96 lg:col-span-2" />
        <div className="px-skeleton h-96" />
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, metric }: any) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as DayPoint;
  const showNames = metric === "logins" || metric === "all";
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 shadow-popover">
      <p className="text-xs font-medium text-foreground">{point.label}</p>
      <div className="mt-1 space-y-0.5">
        {payload.map((p: any) => {
          const rawKey = String(p.dataKey).replace(/_s$/, "") as keyof DayPoint;
          const raw = (point as any)[rawKey] ?? p.value;
          return (
            <p key={p.dataKey} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: p.stroke }} aria-hidden="true" />
              {p.name}
              <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">{raw}</span>
            </p>
          );
        })}
      </div>
      {showNames && point.activeNames.length > 0 && (
        <ul className="mt-1 max-w-[220px] space-y-0.5 border-t border-border pt-1">
          {point.activeNames.slice(0, 5).map((name) => (
            <li key={name} className="truncate text-xs text-muted-foreground">
              {name}
            </li>
          ))}
          {point.activeNames.length > 5 && (
            <li className="text-xs text-muted-foreground">+{point.activeNames.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
