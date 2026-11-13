import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { useEffect, useMemo, useRef, useState } from "react";
import TicketRepliesThread from "@/components/support/TicketRepliesThread";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag } from "@/components/ui/tag";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Ticket,
  CircleAlert,
  Clock,
  CircleCheck,
  Mail,
  MessageSquare,
  Sparkles,
  Inbox,
  Bell,
  RefreshCw,
  Settings,
  Plus,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  MultiAttachmentDropzone,
  type DropFile,
} from "@/components/support/MultiAttachmentDropzone";
import { uploadTicketAttachment } from "@/lib/ticketAttachment";
import WeeklySlackReportCard from "@/components/support/WeeklySlackReportCard";
import NotificationChannelsCard from "@/components/support/NotificationChannelsCard";
import DefaultAssignmentCard from "@/components/support/DefaultAssignmentCard";
import { TicketTypesCard } from "@/components/support/TicketTypesCard";
import CustomerUpdatesWebhookCard from "@/components/support/CustomerUpdatesWebhookCard";
import AssignUserButton from "@/components/support/AssignUserButton";
import { useTeamAccess, type TeamMember } from "@/hooks/useTeamAccess";
import OpenTicketFromChatDialog from "@/components/support/OpenTicketFromChatDialog";
import { ticketAgencyChoices } from "@/lib/ticketAgencyChoices";
import { TicketListPreview } from "@/components/support/TicketListPreview";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
import SupportInbox from "@/components/premium/support/SupportInbox";
import { FilterChips } from "@/components/premium/support/FilterChips";
import { KpiCard } from "@/components/premium/support/KpiCard";
import { PersonAvatar } from "@/components/premium/support/PersonAvatar";

interface SupportTicket {
  id: string;
  ticket_number: number;
  agency_id: string;
  customer_name: string;
  customer_email: string;
  issue_category: string;
  request_text: string;
  status: string;
  created_at: string;
  admin_response?: string | null;
  responded_at?: string | null;
  admin_response_attachment_url?: string | null;
  attachment_url?: string | null;
  assigned_to?: string | null;
  /** Present only when the list payload already includes the first customer message. */
  first_customer_message?: string | null;
}

interface AgencyVersions {
  base_id: string | null;
  basic_id: string | null;
  advanced_id: string | null;
  elite_id: string | null;
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// Status is always an icon plus a word; the tone only reinforces it.
const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "open":
      return (
        <Tag tone="danger">
          <CircleAlert aria-hidden="true" /> Open
        </Tag>
      );
    case "completed":
      return (
        <Tag tone="success">
          <CircleCheck aria-hidden="true" /> Completed
        </Tag>
      );
    case "in_progress":
      return (
        <Tag tone="warning">
          <Clock aria-hidden="true" /> In progress
        </Tag>
      );
    case "responded":
      return (
        <Tag tone="info">
          <Mail aria-hidden="true" /> Responded
        </Tag>
      );
    default:
      return <Tag tone="neutral">{status}</Tag>;
  }
};

export function TicketsTable({
  tickets,
  onSelect,
  onStatusChange,
  emptyLabel,
  emptyAction,
  isLoading,
  team,
  onAssign,
  canEdit = true,
}: {
  team: TeamMember[];
  onAssign: (id: string, email: string | null) => void;
  canEdit?: boolean;
  tickets: SupportTicket[];
  onSelect: (t: SupportTicket) => void;
  onStatusChange: (id: string, status: string) => void;
  emptyLabel: string;
  /** The one action offered when the list is empty. */
  emptyAction?: React.ReactNode;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="px-surface divide-y divide-border" role="status" aria-label="Loading tickets">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4">
            <div className="px-skeleton size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="px-skeleton h-3.5 w-40 max-w-full" />
              <div className="px-skeleton h-3 w-72 max-w-full" />
            </div>
            <div className="px-skeleton hidden h-6 w-24 rounded-full sm:block" />
          </div>
        ))}
      </div>
    );
  }
  if (tickets.length === 0) {
    return (
      <div className="px-surface">
        <EmptyState
          icon={
            <EmptyStateIllustration>
              <Ticket className="size-6" aria-hidden="true" />
            </EmptyStateIllustration>
          }
          title={emptyLabel}
          action={emptyAction}
        />
      </div>
    );
  }
  const controls = (t: SupportTicket) => (
    <>
      <AssignUserButton
        team={team}
        assignedEmail={t.assigned_to}
        onAssign={(e) => onAssign(t.id, e)}
        disabled={!canEdit}
      />
      <Select value={t.status} onValueChange={(v) => onStatusChange(t.id, v)} disabled={!canEdit}>
        <SelectTrigger
          className="h-9 w-auto gap-1 border-0 bg-transparent px-1 shadow-none"
          aria-label={`Status of ticket ${t.ticket_number}`}
        >
          <SelectValue>{getStatusBadge(t.status)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="in_progress">In progress</SelectItem>
          <SelectItem value="responded">Responded</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
  const heading = (t: SupportTicket) => (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <p className="truncate text-sm font-semibold text-foreground">{t.customer_name}</p>
      <span className="text-xs tabular-nums text-muted-foreground">
        #{t.ticket_number} · {formatDate(t.created_at)}
      </span>
    </div>
  );
  const category = (t: SupportTicket) => (
    <p className="mt-2 inline-flex h-6 items-center rounded-full bg-muted px-2.5 text-xs font-medium text-muted-foreground">
      {t.issue_category}
    </p>
  );
  return (
    <>
      {/* Phones and tablets: one card per ticket */}
      <div className="px-surface divide-y divide-border overflow-hidden lg:hidden">
        {tickets.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(t)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(t);
              }
            }}
            className="cursor-pointer space-y-3 p-4 outline-none transition-colors active:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="flex min-w-0 items-start gap-3">
              <PersonAvatar name={t.customer_name || t.customer_email} />
              <div className="min-w-0 flex-1">
                {heading(t)}
                <TicketListPreview
                  ticket={t}
                  className="mt-0.5 line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]"
                />
                {category(t)}
              </div>
            </div>
            <div
              className="flex flex-wrap items-center justify-between gap-2 pl-[52px]"
              onClick={(e) => e.stopPropagation()}
            >
              {controls(t)}
            </div>
          </div>
        ))}
      </div>
      {/* Desktop: the same rows as a table, so columns line up */}
      <div className="px-surface hidden overflow-hidden lg:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead className="sr-only">
            <tr>
              <th scope="col">Ticket</th>
              <th scope="col">Assigned to and status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {tickets.map((t) => (
              <tr
                key={t.id}
                tabIndex={0}
                onClick={() => onSelect(t)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter") onSelect(t);
                }}
                className="cursor-pointer outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
              >
                <td className="p-4 align-middle">
                  <div className="flex min-w-0 items-start gap-3">
                    <PersonAvatar name={t.customer_name || t.customer_email} />
                    <div className="min-w-0 flex-1">
                      {heading(t)}
                      <TicketListPreview ticket={t} />
                      {category(t)}
                    </div>
                  </div>
                </td>
                <td className="w-[22rem] p-4 align-middle" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">{controls(t)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type TicketFilter = "open" | "mine" | "unassigned" | "responded" | "closed" | "all";

export default function SupportDashboard() {
  const navigate = useNavigate();
  const { email } = useUser();
  const access = useTeamAccess();
  const canEditTickets = access.level("support_tickets") === "edit";
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [agencyVersions, setAgencyVersions] = useState<AgencyVersions>({
    base_id: null,
    basic_id: null,
    advanced_id: null,
    elite_id: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketResponse, setTicketResponse] = useState("");
  const [ticketFiles, setTicketFiles] = useState<DropFile[]>([]);
  const [chatStats, setChatStats] = useState({ total: 0, open: 0, responded: 0 });
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"tickets" | "ai-chats" | "slack">("ai-chats");
  const [handoverPendingCount, setHandoverPendingCount] = useState(0);
  const [handoverQueueCount, setHandoverQueueCount] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("open");
  const filterChosenRef = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const agencyChoices = ticketAgencyChoices(agencyVersions);
  const primaryAgencyId = agencyChoices[0]?.id || "";

  const loadAll = async () => {
    if (!email) {
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    setIsLoading(true);
    setLoadError(null);
    const stop = armLoadDeadline(() => {
      setIsLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    try {
      const [{ data: ticketsData }, { data: versions }] = await Promise.all([
        supabase.rpc("get_agency_tickets", { user_email: email }),
        supabase.rpc("get_user_agency_versions", { user_email: email }),
      ]);
      const list = ((ticketsData as SupportTicket[]) || []).map((t) => ({ ...t }));
      if (list.length) {
        const { data: assigns } = await (supabase as any).rpc("get_ticket_assignments", {
          ticket_ids: list.map((t) => t.id),
        });
        const map = new Map<string, string | null>(
          (assigns || []).map((a: any) => [a.id, a.assigned_to]),
        );
        list.forEach((t) => {
          t.assigned_to = map.get(t.id) ?? null;
        });
      }
      setTickets(list);
      setLoadError(null);
      if (versions && Array.isArray(versions) && versions[0]) {
        const v = versions[0] as any;
        setAgencyVersions({
          base_id: v.base_id ?? null,
          basic_id: v.basic_id ?? null,
          advanced_id: v.advanced_id ?? null,
          elite_id: v.elite_id ?? null,
        });
      }
    } catch (e) {
      console.error(e);
      setLoadError(loadErrorText(e, "Couldn't load support."));
    } finally {
      stop();
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [email, loadAttempt]);

  // Track handover queue counts (pending unresolved + resolved-within-48h)
  useEffect(() => {
    const ids = Array.from(
      new Set(
        [
          agencyVersions.base_id,
          agencyVersions.basic_id,
          agencyVersions.advanced_id,
          agencyVersions.elite_id,
        ].filter(Boolean) as string[],
      ),
    );
    if (ids.length === 0) {
      setHandoverPendingCount(0);
      setHandoverQueueCount(0);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("chat_threads")
        .select("handover_requested_at, handover_resolved_at")
        .in("agency_id", ids)
        .not("handover_requested_at", "is", null);
      const cutoff = Date.now() - 48 * 60 * 60 * 1000;
      let pending = 0;
      let queue = 0;
      (data || []).forEach((t: any) => {
        if (!t.handover_resolved_at) {
          pending++;
          queue++;
        } else if (new Date(t.handover_resolved_at).getTime() >= cutoff) {
          queue++;
        }
      });
      setHandoverPendingCount(pending);
      setHandoverQueueCount(queue);
    };
    load();
    const channel = supabase
      .channel(`support-dash-threads-${ids.join("-")}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_threads" },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (row && ids.includes(row.agency_id)) load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    agencyVersions.base_id,
    agencyVersions.basic_id,
    agencyVersions.advanced_id,
    agencyVersions.elite_id,
  ]);

  // Realtime: refresh tickets on changes
  useEffect(() => {
    if (!email) return;
    const channel = supabase
      .channel(`support-dashboard-${email}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => {
        loadAll();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [email]);

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    const prev = tickets;
    setTickets((ts) => ts.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)));
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);
    if (error) {
      setTickets(prev);
      toast.error("Couldn't update the status. Try again.");
    } else {
      toast.success("Status updated");
    }
  };

  const handleAssign = async (ticketId: string, assigned: string | null) => {
    const prev = tickets;
    setTickets((ts) => ts.map((t) => (t.id === ticketId ? { ...t, assigned_to: assigned } : t)));
    const { error } = await supabase
      .from("support_tickets")
      .update({
        assigned_to: assigned,
        assigned_at: assigned ? new Date().toISOString() : null,
      } as any)
      .eq("id", ticketId);
    if (error) {
      setTickets(prev);
      toast.error("Couldn't assign the ticket. Try again.");
      return;
    }
    const who = access.team.find((m) => m.email === assigned)?.name || assigned;
    toast.success(assigned ? `Assigned to ${who}` : "Ticket unassigned");
  };

  const handleSendResponse = async () => {
    if (!selectedTicket || !ticketResponse.trim()) return;
    setIsSending(true);
    try {
      const urls: string[] = [];
      for (const f of ticketFiles)
        urls.push(await uploadTicketAttachment(selectedTicket.id, f.file));
      const attachment_url: string | null = urls[0] ?? null;
      const { error } = await supabase.functions.invoke("respond-to-ticket", {
        body: {
          ticket_id: selectedTicket.id,
          response_text: ticketResponse.trim(),
          attachment_url,
        },
      });
      if (error) throw error;
      if (urls.length > 1) {
        await (supabase as any)
          .from("support_tickets")
          .update({ attachment_urls: urls })
          .eq("id", selectedTicket.id);
      }
      toast.success("Response sent. The client gets an email shortly.");
      setTickets((ts) =>
        ts.map((t) =>
          t.id === selectedTicket.id
            ? {
                ...t,
                admin_response: ticketResponse.trim(),
                responded_at: new Date().toISOString(),
                admin_response_attachment_url: attachment_url,
                status: "responded",
              }
            : t,
        ),
      );
      setSelectedTicket(null);
      setTicketResponse("");
      setTicketFiles([]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Couldn't send the response. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const counts = useMemo(() => {
    const s = { open: 0, in_progress: 0, responded: 0, completed: 0 };
    tickets.forEach((t) => {
      const key = t.status.toLowerCase();
      if (key in s) (s as any)[key] += 1;
    });
    return s;
  }, [tickets]);

  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const respondedTickets = tickets.filter((t) => t.status === "responded");
  const closedTickets = tickets.filter((t) => t.status === "completed");
  const mineTickets = tickets.filter(
    (t) => (t.assigned_to || "").toLowerCase() === access.me && t.status !== "completed",
  );
  const unassignedTickets = tickets.filter((t) => !t.assigned_to && t.status !== "completed");

  // Start on "Open" when there is something to do, otherwise show everything.
  useEffect(() => {
    if (isLoading || filterChosenRef.current) return;
    setTicketFilter(openTickets.length > 0 ? "open" : "all");
  }, [isLoading, openTickets.length]);

  const ticketViews: Record<TicketFilter, { list: SupportTicket[]; empty: string }> = {
    open: { list: openTickets, empty: "No open tickets. You're all caught up." },
    mine: { list: mineTickets, empty: "No open tickets are assigned to you." },
    unassigned: { list: unassignedTickets, empty: "Every open ticket has an owner." },
    responded: { list: respondedTickets, empty: "No tickets are waiting on a client reply." },
    closed: { list: closedTickets, empty: "No completed tickets yet." },
    all: { list: tickets, empty: "No tickets yet." },
  };
  const view = ticketViews[ticketFilter];
  const openCount = counts.open + counts.in_progress;
  const closeTicket = () => {
    setSelectedTicket(null);
    setTicketResponse("");
    setTicketFiles([]);
  };
  const refresh = () => {
    setLoadAttempt((attempt) => attempt + 1);
    setRefreshKey((k) => k + 1);
  };
  const createTicketButton = canEditTickets ? (
    <Button variant="accent" onClick={() => setCreateOpen(true)} disabled={!primaryAgencyId}>
      <Plus aria-hidden="true" />
      Create Ticket
    </Button>
  ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client Support"
        subtitle="Every client chat and ticket in one place. Assign one and your teammate is notified."
        actions={
          <>
            <Button variant="ghost" onClick={refresh} disabled={isLoading}>
              <RefreshCw className={isLoading ? "animate-spin" : ""} aria-hidden="true" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/app/client-hub?support=1")}>
              <Settings aria-hidden="true" />
              Customize Support
            </Button>
          </>
        }
      />
      {loadError && <LoadNotice error={loadError} onRetry={refresh} />}

      <Reveal className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <RevealItem>
          <KpiCard
            icon={<MessageSquare />}
            label="Chats needing a reply"
            value={chatStats.open}
            hint={chatStats.open > 0 ? "A client asked for a person" : "No one is waiting on you"}
            className="h-full"
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            icon={<Ticket />}
            label="Open tickets"
            value={openCount}
            loading={isLoading}
            hint={`${counts.in_progress} in progress`}
            className="h-full"
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            icon={<Mail />}
            label="Replied, waiting on client"
            value={counts.responded + chatStats.responded}
            loading={isLoading}
            hint={`${counts.responded} ${counts.responded === 1 ? "ticket" : "tickets"} · ${chatStats.responded} ${chatStats.responded === 1 ? "chat" : "chats"} in 48h`}
            className="h-full"
          />
        </RevealItem>
        <RevealItem>
          <KpiCard
            icon={<CircleCheck />}
            label="Tickets completed"
            value={counts.completed}
            loading={isLoading}
            hint={`${tickets.length} tickets · ${chatStats.total} chats in total`}
            className="h-full"
          />
        </RevealItem>
      </Reveal>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div data-tip-target="support-tabs">
          <TabsList>
            <TabsTrigger value="ai-chats">
              <Inbox className="mr-1.5 size-4" aria-hidden="true" />
              Inbox
              {chatStats.open > 0 && (
                <span className="ml-2 min-w-5 rounded-full bg-brand px-1.5 text-center text-xs font-semibold leading-5 text-white">
                  {chatStats.open}
                  <span className="sr-only"> need a reply</span>
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <Ticket className="mr-1.5 size-4" aria-hidden="true" />
              Tickets
              {openCount > 0 && (
                <span className="ml-2 min-w-5 rounded-full bg-muted px-1.5 text-center text-xs font-semibold leading-5 text-muted-foreground">
                  {openCount}
                  <span className="sr-only"> open</span>
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="slack">
              <Bell className="mr-1.5 size-4" aria-hidden="true" />
              Notifications
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="ai-chats" className="mt-4">
          <SupportInbox
            agencyVersions={agencyVersions}
            onStats={setChatStats}
            refreshKey={refreshKey}
          />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterChips
              label="Filter tickets"
              data-tip-target="support-ticket-filters"
              className="min-w-0 max-w-full"
              value={ticketFilter}
              onChange={(v) => {
                filterChosenRef.current = true;
                setTicketFilter(v as TicketFilter);
              }}
              options={[
                { id: "open", label: "Open", count: openTickets.length },
                { id: "mine", label: "Assigned to me", count: mineTickets.length },
                { id: "unassigned", label: "Unassigned", count: unassignedTickets.length },
                { id: "responded", label: "Waiting on client", count: respondedTickets.length },
                { id: "closed", label: "Completed", count: closedTickets.length },
                { id: "all", label: "All", count: tickets.length },
              ]}
            />
            {createTicketButton}
          </div>
          <TicketsTable
            team={access.team}
            onAssign={handleAssign}
            canEdit={canEditTickets}
            tickets={view.list}
            isLoading={isLoading}
            onSelect={(t) => {
              setSelectedTicket(t);
              setTicketResponse("");
              setTicketFiles([]);
            }}
            onStatusChange={handleStatusChange}
            emptyLabel={view.empty}
            emptyAction={
              ticketFilter !== "all" && tickets.length > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    filterChosenRef.current = true;
                    setTicketFilter("all");
                  }}
                >
                  Show all tickets
                </Button>
              ) : canEditTickets ? (
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(true)}
                  disabled={!primaryAgencyId}
                >
                  <Plus aria-hidden="true" />
                  Create Ticket
                </Button>
              ) : undefined
            }
          />
          <p className="text-sm text-muted-foreground">
            A ticket you create here uses the same types and alerts as one opened from a chat.
          </p>
        </TabsContent>

        <TabsContent value="slack" className="mt-4 space-y-4">
          <NotificationChannelsCard />
          {email && <TicketTypesCard ownerEmail={email} />}
          <DefaultAssignmentCard />
          <CustomerUpdatesWebhookCard />
          <WeeklySlackReportCard />
        </TabsContent>
      </Tabs>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="w-full sm:w-auto">Want us to do it for you?</span>
        <Link
          to="/app/onboarding-calls"
          className="inline-flex min-h-11 items-center gap-1 font-medium text-brand hover:underline sm:min-h-0"
        >
          Onboarding calls <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
        <Link
          to="/app/agency-support"
          className="inline-flex min-h-11 items-center gap-1 font-medium text-brand hover:underline sm:min-h-0"
        >
          Agency support <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </p>

      <OpenTicketFromChatDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agencyId={primaryAgencyId}
        agencyChoices={agencyChoices}
        source="agency_manual"
        onCreated={() => {
          void loadAll();
        }}
      />

      {/* Ticket conversation and reply */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => {
          if (!open) closeTicket();
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  Ticket #{selectedTicket.ticket_number}
                  {getStatusBadge(
                    tickets.find((t) => t.id === selectedTicket.id)?.status ?? selectedTicket.status,
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedTicket.issue_category} · from{" "}
                  <span className="font-medium text-foreground">{selectedTicket.customer_name}</span>{" "}
                  ({selectedTicket.customer_email})
                </DialogDescription>
                <div className="-ml-2 pt-1">
                  <AssignUserButton
                    team={access.team}
                    assignedEmail={tickets.find((t) => t.id === selectedTicket.id)?.assigned_to}
                    onAssign={(e) => handleAssign(selectedTicket.id, e)}
                    disabled={!canEditTickets}
                  />
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <PersonAvatar
                    name={selectedTicket.customer_name || selectedTicket.customer_email}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1 whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-sm [overflow-wrap:anywhere]">
                    {selectedTicket.request_text}
                    {selectedTicket.attachment_url && (
                      <a
                        href={selectedTicket.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 block"
                      >
                        <img
                          src={selectedTicket.attachment_url}
                          alt="Customer attachment"
                          className="max-h-48 rounded-sm border border-border"
                        />
                      </a>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>
                </div>
                <TicketRepliesThread
                  ticketId={selectedTicket.id}
                  latestResponse={selectedTicket.admin_response}
                  latestResponseAt={selectedTicket.responded_at}
                  latestResponseAttachmentUrl={selectedTicket.admin_response_attachment_url}
                />
                <div>
                  <Label htmlFor="ticket-response" className="mb-1 block text-sm font-medium">
                    Your response
                  </Label>
                  <Textarea
                    id="ticket-response"
                    value={ticketResponse}
                    onChange={(e) => setTicketResponse(e.target.value)}
                    placeholder="Write the key points. We turn them into a friendly email."
                    rows={5}
                  />
                </div>
                <MultiAttachmentDropzone
                  value={ticketFiles}
                  onChange={setTicketFiles}
                  disabled={isSending}
                />
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>
                    We email{" "}
                    <span className="font-medium text-foreground">
                      {selectedTicket.customer_email}
                    </span>{" "}
                    your update with any attached image, and mark the ticket as responded.
                  </span>
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeTicket} disabled={isSending}>
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  onClick={handleSendResponse}
                  disabled={isSending || !ticketResponse.trim() || !canEditTickets}
                >
                  {isSending ? "Sending…" : "Send response"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
