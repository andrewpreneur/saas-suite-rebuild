import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Bot, Sparkles, Check, Info, Code, Ticket, AlertCircle, CheckCircle2, Clock, HelpCircle, Webhook, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { TicketAttachmentField, type TicketAttachmentValue } from "@/components/support/TicketAttachmentField";
import { uploadTicketAttachment } from "@/lib/ticketAttachment";
import ChatModeSettings from "@/components/support/ChatModeSettings";
import AssignUserButton from "@/components/support/AssignUserButton";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import SupportUpdatesWebhookPanel from "@/components/support/SupportUpdatesWebhookPanel";
import CustomerRepliesWebhookPanel from "@/components/support/CustomerRepliesWebhookPanel";
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
}

const SupportFeatures = () => {
  const { email } = useUser();
  const access = useTeamAccess();
  const canEditTickets = access.level("support_tickets") === "edit";
  const handleAssign = async (ticketId: string, assigned: string | null) => {
    const prev = tickets;
    setTickets((ts) => ts.map((t) => (t.id === ticketId ? { ...t, assigned_to: assigned } : t)));
    const { error } = await supabase
      .from("support_tickets")
      .update({ assigned_to: assigned, assigned_at: assigned ? new Date().toISOString() : null } as any)
      .eq("id", ticketId);
    if (error) { setTickets(prev); toast.error("Failed to assign ticket"); return; }
    const who = access.team.find((m) => m.email === assigned)?.name || assigned;
    toast.success(assigned ? `Assigned to ${who}` : "Ticket unassigned");
  };
  const brandedPaymentLink = "https://link.saassuite.ai/payment-link/6931fbc4d8c1a8dff7043087";
  
  // AI Chat Support state
  const [showChatWidget, setShowChatWidget] = useState(true);
  const [hasBrandedSupport, setHasBrandedSupport] = useState(false);
  const [showUpgradePopup, setShowUpgradePopup] = useState(false);
  const [showEmbedCodePopup, setShowEmbedCodePopup] = useState(false);
  const [embedCode, setEmbedCode] = useState("");
  const [tempEmbedCode, setTempEmbedCode] = useState("");
  
  // Support Ticketing state
  const [ticketingEnabled, setTicketingEnabled] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketResponse, setTicketResponse] = useState("");
  const [isSendingTicketResponse, setIsSendingTicketResponse] = useState(false);
  const [ticketAttachment, setTicketAttachment] = useState<TicketAttachmentValue | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [tempWebhookUrl, setTempWebhookUrl] = useState("");
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  
  // Shared state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Load all settings
  useEffect(() => {
    let alive = true;
    const stop = armLoadDeadline(() => {
      if (!alive) return;
      setIsLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });
    const loadSettings = async () => {
      if (!email) {
        stop();
        setIsLoading(false);
        setLoadError(null);
        return;
      }
      
      try {
        // Fetch user settings
        const { data: userData, error: userError } = await supabase
          .from('saas_suite_users')
          .select('show_chat_widget, branded_ai_support, ai_embed_code, support_ticketing_enabled, support_webhook_url')
          .eq('email', email)
          .maybeSingle();
        
        if (userError) {
          console.error('Error loading settings:', userError);
        } else if (userData) {
          setShowChatWidget(userData.show_chat_widget ?? true);
          setHasBrandedSupport((userData as any).branded_ai_support ?? false);
          setEmbedCode((userData as any).ai_embed_code ?? "");
          setTicketingEnabled(userData.support_ticketing_enabled || false);
          setWebhookUrl((userData as any).support_webhook_url ?? "");
          setTempWebhookUrl((userData as any).support_webhook_url ?? "");
        }

        // Fetch tickets
        const { data: ticketsData, error: ticketsError } = await supabase
          .rpc('get_agency_tickets', { user_email: email });

        if (ticketsError) {
          console.error('Error fetching tickets:', ticketsError);
        } else {
          const list = ((ticketsData || []) as SupportTicket[]).map((t) => ({ ...t }));
          if (list.length) {
            const { data: assigns } = await (supabase as any).rpc("get_ticket_assignments", { ticket_ids: list.map((t) => t.id) });
            const map = new Map<string, string | null>((assigns || []).map((a: any) => [a.id, a.assigned_to]));
            list.forEach((t) => { t.assigned_to = map.get(t.id) ?? null; });
          }
          setTickets(list);
        }
        if (alive) setLoadError(null);
      } catch (error) {
        console.error('Error loading settings:', error);
        if (alive) setLoadError(loadErrorText(error, "Couldn't load support features."));
      } finally {
        stop();
        if (alive) setIsLoading(false);
      }
    };

    loadSettings();
    return () => {
      alive = false;
      stop();
    };
  }, [email, loadAttempt]);

  const toggleChatWidget = async (enabled: boolean) => {
    if (!email) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ show_chat_widget: enabled } as any)
        .eq('email', email);

      if (error) {
        console.error('Error updating chat widget setting:', error);
        toast.error("Failed to update chat widget setting");
        return;
      }

      setShowChatWidget(enabled);
      toast.success(enabled ? "AI Chat Support enabled" : "AI Chat Support disabled");
    } catch (error) {
      console.error('Error updating chat widget:', error);
      toast.error("Failed to update chat widget setting");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTicketing = async (enabled: boolean) => {
    if (!email) return;

    setTicketingEnabled(enabled);

    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ support_ticketing_enabled: enabled })
        .eq('email', email);

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

  const saveWebhookUrl = async () => {
    if (!email) return;
    
    setIsSavingWebhook(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ support_webhook_url: tempWebhookUrl } as any)
        .eq('email', email);

      if (error) {
        console.error('Error saving webhook URL:', error);
        toast.error("Failed to save webhook URL");
        return;
      }

      setWebhookUrl(tempWebhookUrl);
      toast.success("Webhook URL saved!");
    } catch (error) {
      console.error('Error saving webhook URL:', error);
      toast.error("Failed to save webhook URL");
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const saveEmbedCode = async () => {
    if (!email) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('saas_suite_users')
        .update({ ai_embed_code: tempEmbedCode } as any)
        .eq('email', email);

      if (error) {
        console.error('Error saving embed code:', error);
        toast.error("Failed to save embed code");
        return;
      }

      setEmbedCode(tempEmbedCode);
      toast.success("Embed code saved!");
      setShowEmbedCodePopup(false);
    } catch (error) {
      console.error('Error saving embed code:', error);
      toast.error("Failed to save embed code");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    const previousStatus = ticket?.status;
    
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

      const updatedTicket = { ...ticket!, status: newStatus };
      
      setTickets(prev => prev.map(t => 
        t.id === ticketId ? updatedTicket : t
      ));
      toast.success(`Ticket status updated to ${newStatus.replace('_', ' ')}`);

      // The ticket-updates webhook is sent by a database trigger on every status change.
      void previousStatus;
    } catch (error) {
      console.error('Error updating ticket status:', error);
      toast.error('Failed to update ticket status');
    }
  };

  const handleSendTicketResponse = async () => {
    if (!selectedTicket || !ticketResponse.trim()) return;
    setIsSendingTicketResponse(true);
    try {
      let attachment_url: string | null = null;
      if (ticketAttachment) {
        attachment_url = await uploadTicketAttachment(selectedTicket.id, ticketAttachment.file);
      }
      const { error } = await supabase.functions.invoke("respond-to-ticket", {
        body: { ticket_id: selectedTicket.id, response_text: ticketResponse.trim(), attachment_url },
      });
      if (error) throw error;
      toast.success("Response sent — customer will receive an email shortly.");
      setTickets(prev => prev.map(ticket =>
        ticket.id === selectedTicket.id
          ? { ...ticket, status: "responded", admin_response: ticketResponse.trim(), responded_at: new Date().toISOString(), admin_response_attachment_url: attachment_url }
          : ticket,
      ));
      setSelectedTicket(null);
      setTicketResponse("");
      setTicketAttachment(null);
    } catch (error: any) {
      console.error('Error sending ticket response:', error);
      toast.error(error?.message || "Failed to send response");
    } finally {
      setIsSendingTicketResponse(false);
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
      case 'responded':
        return <Badge variant="secondary" className="flex items-center gap-1"><Mail className="w-3 h-3" /> Responded</Badge>;
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

  if (loadError || isLoading) {
    return (
      <LoadNotice
        loading={isLoading}
        error={loadError}
        label="Loading support features…"
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Feature Toggles Card */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-lg">Support Feature Settings</CardTitle>
            <CardDescription>
              Configure support features for your customers
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Support Ticketing Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-muted-foreground" />
                <div className="flex items-center gap-2">
                  <Label htmlFor="ticketing-toggle" className="font-medium">
                    Support Ticketing
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Enable a support ticket system where your customers can submit requests. You'll be able to track and manage all tickets from the table below.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              <Switch
                id="ticketing-toggle"
                checked={ticketingEnabled}
                onCheckedChange={toggleTicketing}
                disabled={isSaving}
              />
            </div>

            {/* Inbound Webhook URL */}
            {ticketingEnabled && (
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center gap-2">
                  <Webhook className="w-5 h-5 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <Label htmlFor="webhook-url" className="font-medium">
                      Inbound Webhook URL
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Enter a webhook URL to receive notifications when tickets are created or status changes. Useful for automations in GoHighLevel or Zapier.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="webhook-url"
                    type="url"
                    placeholder="https://hooks.example.com/webhook..."
                    value={tempWebhookUrl}
                    onChange={(e) => setTempWebhookUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={saveWebhookUrl}
                    disabled={isSavingWebhook || tempWebhookUrl === webhookUrl}
                    size="sm"
                  >
                    {isSavingWebhook ? "Saving..." : "Save"}
                  </Button>
                </div>
                {webhookUrl && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    Webhook configured - notifications will be sent for ticket events
                  </p>
                )}
              </div>
            )}
            {ticketingEnabled && (
              <div className="p-4 rounded-lg bg-muted/50">
                <SupportUpdatesWebhookPanel compact />
                <div className="mt-4"><CustomerRepliesWebhookPanel compact /></div>
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <Label htmlFor="chat-widget-toggle" className="font-medium">AI Chat Support</Label>
                <p className="text-xs text-muted-foreground">Turn the AI chat widget on or off for your clients.</p>
              </div>
              <Switch id="chat-widget-toggle" checked={showChatWidget} onCheckedChange={toggleChatWidget} />
            </div>

            <ChatModeSettings />

            {/* Branded AI Support Section */}
            <div className="flex items-center justify-between p-4 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Branded AI Support</span>
                    {hasBrandedSupport && (
                      <Badge className="bg-green-600 text-white">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fully customized AI chat with your branding
                  </p>
                </div>
              </div>
              {hasBrandedSupport ? (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTempEmbedCode(embedCode);
                    setShowEmbedCodePopup(true);
                  }}
                >
                  <Code className="w-4 h-4 mr-2" />
                  View Embed Code
                </Button>
              ) : (
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-primary to-purple-500 text-white border-0 hover:opacity-90"
                  onClick={() => setShowUpgradePopup(true)}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Upgrade
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Support Tickets Table */}
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
              <div className="rounded-md border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-24">Ticket #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="max-w-xs">Request</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className="cursor-pointer hover:bg-muted/40"
                       onClick={() => { setSelectedTicket(ticket); setTicketResponse(""); setTicketAttachment(null); }}
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
                        <TableCell>
                          <Badge variant="outline">{ticket.issue_category}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs min-w-0">
                          <TicketListPreview ticket={ticket} />
                          {ticket.attachment_url && (
                            <img
                              src={ticket.attachment_url}
                              alt="Customer attachment"
                              className="mt-2 max-h-24 rounded border"
                            />
                          )}
                          {ticket.admin_response ? (
                            <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mb-1">
                                Support Response{ticket.responded_at ? ` · ${formatDate(ticket.responded_at)}` : ""}
                              </p>
                              <p className="text-xs whitespace-pre-wrap">{ticket.admin_response}</p>
                              {ticket.admin_response_attachment_url && (
                                <img
                                  src={ticket.admin_response_attachment_url}
                                  alt="Response attachment"
                                  className="mt-1 max-h-24 rounded border border-primary/20"
                                />
                              )}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <AssignUserButton team={access.team} assignedEmail={ticket.assigned_to} onAssign={(e) => handleAssign(ticket.id, e)} disabled={!canEditTickets} />
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
                              <SelectItem value="responded">
                                <div className="flex items-center gap-1">
                                  <Mail className="w-3 h-3 text-primary" /> Responded
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

        {/* Upgrade Popup */}
        <Dialog open={showUpgradePopup} onOpenChange={setShowUpgradePopup}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <Badge className="bg-gradient-to-r from-primary to-purple-500 text-white border-0">
                  Premium
                </Badge>
              </div>
              <DialogTitle className="text-xl">Branded AI Support Agent</DialogTitle>
              <DialogDescription>
                Fully customized AI chat support with your branding
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Custom brand colors and styling</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">15-minute setup/implementation call included</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Custom prompting for your business</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Human handover capability</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">Custom actions (SMS, email, internal notifications)</span>
                </li>
              </ul>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold text-foreground">$20</span>
                  <span className="text-sm text-muted-foreground">/month per customer</span>
                </div>
                <Button 
                  className="w-full bg-gradient-to-r from-primary to-purple-500 hover:opacity-90 text-white"
                  onClick={() => window.open(brandedPaymentLink, "_blank")}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Upgrade to Branded Agent
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!selectedTicket} onOpenChange={(open) => { if (!open) { setSelectedTicket(null); setTicketResponse(""); setTicketAttachment(null); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Ticket className="w-4 h-4" />
                    Ticket #{selectedTicket.ticket_number} — {selectedTicket.issue_category}
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
                    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                      <div className="text-xs font-medium text-primary mb-1">
                        Previous response{selectedTicket.responded_at ? ` · ${formatDate(selectedTicket.responded_at)}` : ""}
                      </div>
                      <div className="whitespace-pre-wrap">{selectedTicket.admin_response}</div>
                      {selectedTicket.admin_response_attachment_url && (
                        <a href={selectedTicket.admin_response_attachment_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                          <img src={selectedTicket.admin_response_attachment_url} alt="Response attachment" className="max-h-48 rounded border" />
                        </a>
                      )}
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Your response</Label>
                    <Textarea
                      value={ticketResponse}
                      onChange={(e) => setTicketResponse(e.target.value)}
                      placeholder="Write the key points of your response. Our AI will turn this into a friendly email."
                      rows={6}
                    />
                  </div>
                  <TicketAttachmentField value={ticketAttachment} onChange={setTicketAttachment} disabled={isSendingTicketResponse} />
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground">
                    <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                    <span>
                      Our AI will email <span className="font-medium">{selectedTicket.customer_email}</span> with their ticket update — including any attached image. The ticket will be marked as responded.
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setSelectedTicket(null); setTicketResponse(""); setTicketAttachment(null); }} disabled={isSendingTicketResponse}>
                    Cancel
                  </Button>
                  <Button onClick={handleSendTicketResponse} disabled={isSendingTicketResponse || !ticketResponse.trim()}>
                    <Mail className="w-4 h-4 mr-1" />
                    {isSendingTicketResponse ? "Sending…" : "Send response"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Embed Code Popup */}
        <Dialog open={showEmbedCodePopup} onOpenChange={setShowEmbedCodePopup}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Embed Code</DialogTitle>
              <DialogDescription>
                Paste your custom AI chat widget embed code below. This will be saved for your reference.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                value={tempEmbedCode}
                onChange={(e) => setTempEmbedCode(e.target.value)}
                placeholder="Paste your embed code here..."
                className="min-h-[200px] font-mono text-sm"
              />
              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-500">
                  To install, paste this code at the agency level → Company → White Label → Custom CSS
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEmbedCodePopup(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEmbedCode} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default SupportFeatures;