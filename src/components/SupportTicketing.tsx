import { useState, useEffect } from "react";
import TicketRepliesThread from "@/components/support/TicketRepliesThread";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { toast } from "sonner";
import { Ticket, AlertCircle, CheckCircle2, Clock, Sparkles, Mail } from "lucide-react";
import { TicketAttachmentField, type TicketAttachmentValue } from "@/components/support/TicketAttachmentField";
import { uploadTicketAttachment } from "@/lib/ticketAttachment";
import { TicketAutoAssignRules } from "@/components/support/TicketAutoAssignRules";
import { TicketTypesCard } from "@/components/support/TicketTypesCard";
import { useAgencyTicketCategories, useOwnerAgencyId } from "@/hooks/useAgencyTicketCategories";
import { mergeTicketCategoryOptions } from "@/lib/ticketCategories";

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
}

interface TeamMember { email: string; name: string }

const SupportTicketing = () => {
  const { email } = useUser();
  const { data: agencyId = null } = useOwnerAgencyId(email);
  const { categories: agencyCategories } = useAgencyTicketCategories(agencyId);
  const [ticketingEnabled, setTicketingEnabled] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [responseText, setResponseText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState<TicketAttachmentValue | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);

  // Fetch ticketing enabled status and tickets
  useEffect(() => {
    const fetchData = async () => {
      if (!email) return;

      setIsLoading(true);
      try {
        // Fetch ticketing enabled status
        const { data: userData, error: userError } = await supabase
          .from('saas_suite_users')
          .select('support_ticketing_enabled')
          .ilike('email', email)
          .maybeSingle();

        if (userError) {
          console.error('Error fetching ticketing status:', userError);
        } else {
          setTicketingEnabled(userData?.support_ticketing_enabled || false);
        }

        // Fetch tickets using the RPC function
        const { data: ticketsData, error: ticketsError } = await supabase
          .rpc('get_agency_tickets', { user_email: email });

        if (ticketsError) {
          console.error('Error fetching tickets:', ticketsError);
        } else {
          const list: SupportTicket[] = ticketsData || [];
          if (list.length) {
            const { data: assigns } = await (supabase as any).rpc('get_ticket_assignments', { ticket_ids: list.map(t => t.id) });
            const map = new Map<string, string | null>((assigns || []).map((a: any) => [a.id, a.assigned_to]));
            list.forEach(t => { t.assigned_to = map.get(t.id) ?? null; });
          }
          setTickets(list);
        }

        const { data: admins } = await supabase
          .from('account_admins')
          .select('admin_email, admin_name, status')
          .ilike('owner_email', email);
        const members = [
          { email: email.trim().toLowerCase(), name: 'Me (owner)' },
          ...((admins || []) as any[])
            .filter(a => a.status !== 'revoked' && a.status !== 'removed')
            .map(a => ({ email: String(a.admin_email).toLowerCase(), name: a.admin_name || a.admin_email })),
        ];
        setTeam(Array.from(new Map(members.map(m => [m.email, m])).values()));
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [email]);

  const handleToggleTicketing = async (enabled: boolean) => {
    if (!email) return;

    setTicketingEnabled(enabled);

    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ support_ticketing_enabled: enabled })
        .ilike('email', email);

      if (error) {
        console.error('Error updating ticketing status:', error);
        toast.error('Failed to update ticketing status');
        setTicketingEnabled(!enabled);
      } else {
        toast.success(enabled ? 'Support ticketing enabled' : 'Support ticketing disabled');
      }
    } catch (error) {
      console.error('Error updating ticketing status:', error);
      toast.error('Failed to update ticketing status');
      setTicketingEnabled(!enabled);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (error) {
        console.error('Error updating ticket status:', error);
        toast.error('Failed to update ticket status');
        return;
      }

      // Update local state
      setTickets(prev => prev.map(ticket => 
        ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
      ));
      toast.success(`Ticket status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast.error('Failed to update ticket status');
    }
  };

  const categoryOptions = mergeTicketCategoryOptions(
    agencyCategories.map((category) => category.label),
    tickets.map((ticket) => ticket.issue_category),
  );

  const handleCategoryChange = async (ticketId: string, value: string) => {
    let category = value;
    if (value === '__new__') {
      const typed = window.prompt('New category name');
      if (!typed || !typed.trim()) return;
      category = typed.trim();
    }
    const { error } = await supabase.from('support_tickets').update({ issue_category: category }).eq('id', ticketId);
    if (error) {
      console.error('Error updating category:', error);
      toast.error('Failed to update category');
      return;
    }
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, issue_category: category } : t));
    setSelectedTicket(prev => prev && prev.id === ticketId ? { ...prev, issue_category: category } : prev);
    toast.success(`Category changed to ${category}`);
  };

  const CategorySelect = ({ ticket }: { ticket: SupportTicket }) => (
    <Select value={ticket.issue_category || 'General'} onValueChange={(v) => handleCategoryChange(ticket.id, v)}>
      <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {Array.from(new Set([ticket.issue_category || 'General', ...categoryOptions])).map(c => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
        <SelectItem value="__new__">+ New category…</SelectItem>
      </SelectContent>
    </Select>
  );

  const handleAssign = async (ticketId: string, value: string) => {
    const assigned_to = value === 'unassigned' ? null : value;
    const { error } = await supabase
      .from('support_tickets')
      .update({ assigned_to, assigned_at: assigned_to ? new Date().toISOString() : null } as any)
      .eq('id', ticketId);
    if (error) {
      console.error('Error assigning ticket:', error);
      toast.error('Failed to assign ticket');
      return;
    }
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, assigned_to } : t));
    const who = team.find(m => m.email === assigned_to)?.name;
    toast.success(assigned_to ? `Assigned to ${who || assigned_to}` : 'Ticket unassigned');
  };

  const handleSendResponse = async () => {
    if (!selectedTicket || !responseText.trim()) return;
    setIsSending(true);
    try {
      let attachment_url: string | null = null;
      if (attachment) {
        attachment_url = await uploadTicketAttachment(selectedTicket.id, attachment.file);
      }
      const { error } = await supabase.functions.invoke("respond-to-ticket", {
        body: { ticket_id: selectedTicket.id, response_text: responseText.trim(), attachment_url },
      });
      if (error) throw error;
      toast.success("Response sent — customer will receive an email shortly.");
      setTickets(prev => prev.map(t => t.id === selectedTicket.id
        ? { ...t, status: "responded", admin_response: responseText.trim(), responded_at: new Date().toISOString(), admin_response_attachment_url: attachment_url }
        : t));
      setSelectedTicket(null);
      setResponseText("");
      setAttachment(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to send response");
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return <Badge variant="destructive" className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Open</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="flex items-center gap-1 bg-green-600 text-white"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>;
      case 'in_progress':
        return <Badge className="flex items-center gap-1 bg-amber-500"><Clock className="w-3 h-3" /> In Progress</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Support Ticketing System</CardTitle>
              <CardDescription>
                Enable support ticketing to allow your customers to submit support requests
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="ticketing-enabled"
                checked={ticketingEnabled}
                onCheckedChange={handleToggleTicketing}
              />
              <Label htmlFor="ticketing-enabled" className="text-sm font-medium">
                {ticketingEnabled ? 'Enabled' : 'Disabled'}
              </Label>
            </div>
          </div>
        </CardHeader>
      </Card>

      {email && <TicketTypesCard ownerEmail={email} />}

      {email && (
        <TicketAutoAssignRules
          email={email}
          team={team}
          categories={categoryOptions}
        />
      )}


      {/* Tickets Table */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="w-5 h-5" />
            Support Tickets
          </CardTitle>
          <CardDescription>
            View and manage support tickets from your customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No support tickets yet</p>
              <p className="text-sm mt-1">Tickets will appear here when customers submit them</p>
            </div>
          ) : (
            <div className="rounded-md border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-24">Ticket #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="max-w-xs">Request</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => { setSelectedTicket(ticket); setResponseText(""); setAttachment(null); }}
                    >
                      <TableCell className="font-mono font-medium">
                        #{ticket.ticket_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{ticket.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{ticket.customer_email}</p>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <CategorySelect ticket={ticket} />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate" title={ticket.request_text}>
                          {ticket.request_text}
                        </p>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={ticket.assigned_to || 'unassigned'}
                          onValueChange={(value) => handleAssign(ticket.id, value)}
                        >
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {ticket.assigned_to && !team.some(m => m.email === ticket.assigned_to) && (
                              <SelectItem value={ticket.assigned_to}>{ticket.assigned_to}</SelectItem>
                            )}
                            {team.map(m => (
                              <SelectItem key={m.email} value={m.email}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={ticket.status}
                          onValueChange={(value) => handleStatusChange(ticket.id, value)}
                        >
                          <SelectTrigger className="w-[130px] h-8 p-0 border-0 bg-transparent">
                            <SelectValue>{getStatusBadge(ticket.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">
                              <div className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-destructive" /> Open
                              </div>
                            </SelectItem>
                            <SelectItem value="in_progress">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-500" /> In Progress
                              </div>
                            </SelectItem>
                            <SelectItem value="completed">
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-green-600" /> Completed
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(ticket.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(o) => { if (!o) { setSelectedTicket(null); setResponseText(""); setAttachment(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Ticket className="w-4 h-4" />
                  Ticket #{selectedTicket.ticket_number}
                  <CategorySelect ticket={selectedTicket} />
                </DialogTitle>
                <DialogDescription>
                  From <span className="font-medium">{selectedTicket.customer_name}</span> ({selectedTicket.customer_email})
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                  {selectedTicket.request_text}
                  {selectedTicket.attachment_url && (
                    <a href={selectedTicket.attachment_url} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                      <img src={selectedTicket.attachment_url} alt="Customer attachment" className="max-h-48 rounded border" />
                    </a>
                  )}
                </div>
                {selectedTicket.admin_response && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                    <div className="text-xs font-medium text-emerald-700 mb-1">
                      Previous response {selectedTicket.responded_at ? `· ${formatDate(selectedTicket.responded_at)}` : ""}
                    </div>
                    <div className="whitespace-pre-wrap">{selectedTicket.admin_response}</div>
                    {selectedTicket.admin_response_attachment_url && (
                      <a href={selectedTicket.admin_response_attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                        <img src={selectedTicket.admin_response_attachment_url} alt="Response attachment" className="max-h-48 rounded border border-emerald-500/30" />
                      </a>
                    )}
                  </div>
                )}
                <TicketRepliesThread ticketId={selectedTicket.id} />
                <div>
                  <Label className="text-sm font-medium mb-1 block">Your response</Label>
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write the key points of your response. Our AI will turn this into a friendly email."
                    rows={6}
                  />
                </div>
                <TicketAttachmentField value={attachment} onChange={setAttachment} disabled={isSending} />
                <div className="flex items-start gap-2 rounded-md bg-cyan-500/10 border border-cyan-500/20 p-3 text-xs text-cyan-900 dark:text-cyan-200">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-600" />
                  <span>
                    Our AI will email <span className="font-medium">{selectedTicket.customer_email}</span> with their ticket update — including any attached image. The ticket will be marked as responded.
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setSelectedTicket(null); setResponseText(""); setAttachment(null); }} disabled={isSending}>
                  Cancel
                </Button>
                <Button onClick={handleSendResponse} disabled={isSending || !responseText.trim()}>
                  <Mail className="w-4 h-4 mr-1" />
                  {isSending ? "Sending…" : "Send response"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportTicketing;
