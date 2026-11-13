import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { useEffect, useMemo, useState } from "react";
import TicketRepliesThread from "@/components/support/TicketRepliesThread";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertCircle,
  Clock,
  CheckCircle2,
  Mail,
  MessageSquare,
  Sparkles,
  Bot,
  RefreshCw,
  Settings,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import ChatInterventionPanel from "@/components/client-hub/ChatInterventionPanel";
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

const getStatusBadge = (status: string) => {
  switch (status.toLowerCase()) {
    case "open":
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> Open
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="secondary" className="flex items-center gap-1 bg-green-600 text-white">
          <CheckCircle2 className="w-3 h-3" /> Completed
        </Badge>
      );
    case "in_progress":
      return (
        <Badge className="flex items-center gap-1 bg-amber-500">
          <Clock className="w-3 h-3" /> In Progress
        </Badge>
      );
    case "responded":
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Mail className="w-3 h-3" /> Responded
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export function TicketsTable({
  tickets,
  onSelect,
  onStatusChange,
  emptyLabel,
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
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-md border divide-y">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3">
            <Skeleton className="h-4 w-10" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    );
  }
  if (tickets.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-md">
        <Ticket className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }
  const statusSelect = (t: SupportTicket) => (
    <Select value={t.status} onValueChange={(v) => onStatusChange(t.id, v)} disabled={!canEdit}>
      <SelectTrigger className="w-[130px] h-8 p-0 border-0 bg-transparent">
        <SelectValue>{getStatusBadge(t.status)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="open">Open</SelectItem>
        <SelectItem value="in_progress">In Progress</SelectItem>
        <SelectItem value="responded">Responded</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
      </SelectContent>
    </Select>
  );
  return (
    <>
      <div className="xl:hidden space-y-2">
        {tickets.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(t)}
            className="rounded-lg border bg-card p-3 space-y-2 cursor-pointer active:bg-muted/40"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">
                  <span className="font-mono text-muted-foreground mr-1.5">#{t.ticket_number}</span>
                  {t.customer_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">{t.customer_email}</p>
                <TicketListPreview
                  ticket={t}
                  className="mt-1 text-sm text-muted-foreground line-clamp-2 break-words [overflow-wrap:anywhere]"
                />
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDate(t.created_at)}
              </span>
            </div>
            <div
              className="flex items-center justify-between gap-2 flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <Badge variant="outline">{t.issue_category}</Badge>
              <div className="flex items-center gap-1">
                <AssignUserButton
                  team={team}
                  assignedEmail={t.assigned_to}
                  onAssign={(e) => onAssign(t.id, e)}
                  disabled={!canEdit}
                />
                {statusSelect(t)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-md border hidden xl:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-20">#</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="max-w-xs">Request</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((t) => (
              <TableRow
                key={t.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => onSelect(t)}
              >
                <TableCell className="font-mono">#{t.ticket_number}</TableCell>
                <TableCell className="min-w-0 max-w-[16rem]">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{t.customer_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.customer_email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{t.issue_category}</Badge>
                </TableCell>
                <TableCell className="max-w-xs min-w-0">
                  <TicketListPreview ticket={t} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <AssignUserButton
                    team={team}
                    assignedEmail={t.assigned_to}
                    onAssign={(e) => onAssign(t.id, e)}
                    disabled={!canEdit}
                  />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>{statusSelect(t)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(t.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

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
      toast.error("Failed to update status");
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
      toast.error("Failed to assign ticket");
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
      toast.success("Response sent — customer will receive an email shortly.");
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
      toast.error(e?.message || "Failed to send response");
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <PageHeader
            title="Client Support"
            subtitle="Tickets and AI chats from your clients. Assign one to a teammate and they get notified."
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setLoadAttempt((attempt) => attempt + 1)} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      {loadError && <LoadNotice error={loadError} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />}

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Onboarding calls and agency support are available when you go looking for them.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/onboarding-calls">Onboarding calls</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/agency-support">Agency support</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
              <AlertCircle className="w-3.5 h-3.5" /> Open
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <p className="text-2xl font-bold">{chatStats.open}</p>
                <p className="text-[11px] text-muted-foreground">Open Chats</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.open + counts.in_progress}</p>
                <p className="text-[11px] text-muted-foreground">Open Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
              <Mail className="w-3.5 h-3.5" /> Responded
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <p className="text-2xl font-bold">{counts.responded}</p>
                <p className="text-[11px] text-muted-foreground">Tickets responded</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{chatStats.responded}</p>
                <p className="text-[11px] text-muted-foreground">Chats responded (48h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5" /> Closed
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <p className="text-2xl font-bold">{counts.completed}</p>
                <p className="text-[11px] text-muted-foreground">Tickets closed</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {Math.max(0, chatStats.total - chatStats.open - chatStats.responded)}
                </p>
                <p className="text-[11px] text-muted-foreground">Chats without open requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
              <Ticket className="w-3.5 h-3.5" /> Total
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <div>
                <p className="text-2xl font-bold">{tickets.length}</p>
                <p className="text-[11px] text-muted-foreground">Total Tickets</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{chatStats.total}</p>
                <p className="text-[11px] text-muted-foreground">Chat Engagements</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <div
          className="flex items-center justify-between gap-2 overflow-x-auto"
          data-tip-target="support-tabs"
        >
          <TabsList className="justify-start shrink-0">
            <TabsTrigger value="ai-chats">
              <Bot className="w-4 h-4 mr-1.5" />
              Inbox
              {chatStats.open > 0 && (
                <Badge className="ml-2 h-5 min-w-5 px-1.5 bg-destructive text-destructive-foreground">
                  {chatStats.open}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="tickets">
              <Ticket className="w-4 h-4 mr-1.5" />
              Tickets
              {counts.open + counts.in_progress > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 min-w-5 px-1.5">
                  {counts.open + counts.in_progress}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="slack">Notifications</TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => navigate("/app/client-hub?support=1")}
          >
            <Settings className="w-4 h-4 mr-2" />
            Customize Support
          </Button>
        </div>

        <TabsContent value="slack" className="mt-4 space-y-4">
          <NotificationChannelsCard />
          {email && <TicketTypesCard ownerEmail={email} />}
          <DefaultAssignmentCard />
          <CustomerUpdatesWebhookCard />
          <WeeklySlackReportCard />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Open a ticket for a client from this queue. It uses the same types and alerts as a ticket opened from chat.
            </p>
            {canEditTickets && (
              <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!primaryAgencyId}>
                <Plus className="w-4 h-4 mr-1" />
                Create Ticket
              </Button>
            )}
          </div>
          <Tabs
            key={openTickets.length > 0 ? "has-open" : "no-open"}
            defaultValue={openTickets.length > 0 ? "open" : "all"}
            className="w-full"
          >
            <TabsList
              className="h-auto p-1 w-full justify-start overflow-x-auto md:w-auto"
              data-tip-target="support-ticket-filters"
            >
              <TabsTrigger value="open">Open ({openTickets.length})</TabsTrigger>
              <TabsTrigger value="mine">Assigned to me ({mineTickets.length})</TabsTrigger>
              <TabsTrigger value="unassigned">Unassigned ({unassignedTickets.length})</TabsTrigger>
              <TabsTrigger value="responded">
                Responded / Waiting ({respondedTickets.length})
              </TabsTrigger>
              <TabsTrigger value="closed">Closed ({closedTickets.length})</TabsTrigger>
              <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="open" className="mt-4">
              <TicketsTable
                team={access.team}
                onAssign={handleAssign}
                canEdit={canEditTickets}
                tickets={openTickets}
                isLoading={isLoading}
                onSelect={(t) => {
                  setSelectedTicket(t);
                  setTicketResponse("");
                  setTicketFiles([]);
                }}
                onStatusChange={handleStatusChange}
                emptyLabel="No open tickets — you're all caught up!"
              />
            </TabsContent>
            <TabsContent value="mine" className="mt-4">
              <TicketsTable
                team={access.team}
                onAssign={handleAssign}
                canEdit={canEditTickets}
                tickets={mineTickets}
                isLoading={isLoading}
                onSelect={(t) => {
                  setSelectedTicket(t);
                  setTicketResponse("");
                  setTicketFiles([]);
                }}
                onStatusChange={handleStatusChange}
                emptyLabel="No open tickets assigned to you."
              />
            </TabsContent>
            <TabsContent value="unassigned" className="mt-4">
              <TicketsTable
                team={access.team}
                onAssign={handleAssign}
                canEdit={canEditTickets}
                tickets={unassignedTickets}
                isLoading={isLoading}
                onSelect={(t) => {
                  setSelectedTicket(t);
                  setTicketResponse("");
                  setTicketFiles([]);
                }}
                onStatusChange={handleStatusChange}
                emptyLabel="Every open ticket has someone assigned."
              />
            </TabsContent>
            <TabsContent value="responded" className="mt-4">
              <TicketsTable
                team={access.team}
                onAssign={handleAssign}
                canEdit={canEditTickets}
                tickets={respondedTickets}
                isLoading={isLoading}
                onSelect={(t) => {
                  setSelectedTicket(t);
                  setTicketResponse("");
                  setTicketFiles([]);
                }}
                onStatusChange={handleStatusChange}
                emptyLabel="No tickets waiting on customer replies."
              />
            </TabsContent>
            <TabsContent value="closed" className="mt-4">
              <TicketsTable
                team={access.team}
                onAssign={handleAssign}
                canEdit={canEditTickets}
                tickets={closedTickets}
                isLoading={isLoading}
                onSelect={(t) => {
                  setSelectedTicket(t);
                  setTicketResponse("");
                  setTicketFiles([]);
                }}
                onStatusChange={handleStatusChange}
                emptyLabel="No closed tickets yet."
              />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <TicketsTable
                team={access.team}
                onAssign={handleAssign}
                canEdit={canEditTickets}
                tickets={tickets}
                isLoading={isLoading}
                onSelect={(t) => {
                  setSelectedTicket(t);
                  setTicketResponse("");
                  setTicketFiles([]);
                }}
                onStatusChange={handleStatusChange}
                emptyLabel="No support tickets yet."
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="ai-chats" className="mt-4">
          <div className="rounded-lg border p-0 md:p-4">
            <ChatInterventionPanel
              agencyVersions={agencyVersions}
              filterMode="all"
              onStats={setChatStats}
            />
          </div>
        </TabsContent>
      </Tabs>

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

      {/* Response dialog */}
      <Dialog
        open={!!selectedTicket}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTicket(null);
            setTicketResponse("");
            setTicketFiles([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Ticket #{selectedTicket.ticket_number} — {selectedTicket.issue_category}
                </DialogTitle>
                <DialogDescription>
                  From <span className="font-medium">{selectedTicket.customer_name}</span> (
                  {selectedTicket.customer_email})
                </DialogDescription>
                <div className="pt-1">
                  <AssignUserButton
                    team={access.team}
                    assignedEmail={tickets.find((t) => t.id === selectedTicket.id)?.assigned_to}
                    onAssign={(e) => handleAssign(selectedTicket.id, e)}
                    disabled={!canEditTickets}
                  />
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
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
                        className="max-h-48 rounded border"
                      />
                    </a>
                  )}
                </div>
                <TicketRepliesThread
                  ticketId={selectedTicket.id}
                  latestResponse={selectedTicket.admin_response}
                  latestResponseAt={selectedTicket.responded_at}
                  latestResponseAttachmentUrl={selectedTicket.admin_response_attachment_url}
                />
                <div>
                  <Label className="text-sm font-medium mb-1 block">Your response</Label>
                  <Textarea
                    value={ticketResponse}
                    onChange={(e) => setTicketResponse(e.target.value)}
                    placeholder="Write the key points of your response. Our AI will turn this into a friendly email."
                    rows={6}
                  />
                </div>
                <MultiAttachmentDropzone
                  value={ticketFiles}
                  onChange={setTicketFiles}
                  disabled={isSending}
                />
                <div className="flex items-start gap-2 rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                  <span>
                    Our AI will email{" "}
                    <span className="font-medium">{selectedTicket.customer_email}</span> with their
                    ticket update — including any attached image. The ticket will be marked as
                    responded.
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedTicket(null);
                    setTicketResponse("");
                    setTicketFiles([]);
                  }}
                  disabled={isSending}
                >
                  Cancel
                </Button>
                <Button
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
