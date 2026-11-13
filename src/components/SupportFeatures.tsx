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
import { ChevronDown, Bot, Sparkles, Check, Info, Code, Ticket, AlertCircle, CheckCircle2, Clock, HelpCircle, Webhook, ExternalLink, Mail } from "lucide-react";
import { toast } from "sonner";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { PageHeader } from "@/components/platform/PageHeader";
import { SectionCard } from "@/components/premium/SectionCard";
import { SettingRow } from "@/components/premium/support/SettingRow";
import { Tag } from "@/components/ui/tag";
import { Banner } from "@/components/ui/banner";
import { TicketsTable } from "@/components/SupportDashboard";
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
      toast.success("Response sent. The client gets an email shortly.");
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
        <PageHeader
          title="Customize Support"
          subtitle="Choose how clients reach you, then answer their tickets below."
        />

        <SectionCard
          icon={<Ticket />}
          title="Tickets"
          description="Let clients send a request you can track, assign and answer by email."
          bodyClassName="divide-y divide-border"
        >
          <SettingRow
            htmlFor="ticketing-toggle"
            title="Support ticketing"
            description={
              ticketingEnabled
                ? "On. Clients can open a ticket from their hub, and every ticket shows in the list below."
                : "Off. Clients can't open tickets. Turn it on to add a request form to their hub."
            }
            control={
              <Switch
                id="ticketing-toggle"
                checked={ticketingEnabled}
                onCheckedChange={toggleTicketing}
                disabled={isSaving}
              />
            }
          />
          {ticketingEnabled && (
            <SettingRow
              htmlFor="webhook-url"
              title="Send ticket events to a webhook"
              description="We post to this URL when a ticket is created or its status changes. Useful for HighLevel or Zapier automations."
            >
              <div className="flex flex-col gap-2 sm:flex-row">
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
                >
                  {isSavingWebhook ? "Saving…" : "Save webhook"}
                </Button>
              </div>
              {webhookUrl && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
                  Webhook saved. Ticket events are being sent.
                </p>
              )}
            </SettingRow>
          )}
          {ticketingEnabled && (
            <details className="group py-4 last:pb-0">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span>
                  Advanced: reply webhooks and email setup
                  <span className="mt-0.5 block font-normal text-muted-foreground">
                    Send ticket updates from your own CRM and bring client email replies back in.
                  </span>
                </span>
                <ChevronDown
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="mt-4 space-y-4">
                <SupportUpdatesWebhookPanel compact />
                <CustomerRepliesWebhookPanel compact />
              </div>
            </details>
          )}
        </SectionCard>

        <SectionCard
          icon={<Bot />}
          title="AI chat"
          description="An assistant in your clients' accounts that answers questions around the clock."
          bodyClassName="divide-y divide-border"
        >
          <SettingRow
            htmlFor="chat-widget-toggle"
            title="AI chat support"
            description={
              showChatWidget
                ? "On. Clients see the chat bubble and can ask the assistant anything."
                : "Off. The chat bubble is hidden from your clients."
            }
            control={
              <Switch
                id="chat-widget-toggle"
                checked={showChatWidget}
                onCheckedChange={toggleChatWidget}
              />
            }
          />
          <div className="py-4 last:pb-0">
            <ChatModeSettings />
          </div>
          <SettingRow
            title={
              <span className="flex flex-wrap items-center gap-2">
                Branded AI support
                {hasBrandedSupport && (
                  <Tag tone="success">
                    <Check aria-hidden="true" /> Active
                  </Tag>
                )}
              </span>
            }
            description="A fully customized chat with your colors, your prompts and human handover."
            control={
              hasBrandedSupport ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setTempEmbedCode(embedCode);
                    setShowEmbedCodePopup(true);
                  }}
                >
                  <Code aria-hidden="true" />
                  View embed code
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setShowUpgradePopup(true)}>
                  <Sparkles aria-hidden="true" />
                  See the upgrade
                </Button>
              )
            }
          />
        </SectionCard>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tickets from your clients</h2>
            <p className="text-sm text-muted-foreground">
              Select a ticket to read it and send a response.
            </p>
          </div>
          <TicketsTable
            team={access.team}
            onAssign={handleAssign}
            canEdit={canEditTickets}
            tickets={tickets}
            onSelect={(ticket) => {
              setSelectedTicket(ticket as SupportTicket);
              setTicketResponse("");
              setTicketAttachment(null);
            }}
            onStatusChange={handleStatusChange}
            emptyLabel={
              ticketingEnabled
                ? "No tickets yet. They appear here when a client sends one."
                : "No tickets yet. Turn on support ticketing above to start receiving them."
            }
          />
        </section>

        {/* Upgrade Popup */}
        <Dialog open={showUpgradePopup} onOpenChange={setShowUpgradePopup}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="mb-2 flex items-center gap-3">
                <span className="px-icon-chip [&_svg]:size-5" aria-hidden="true">
                  <Sparkles />
                </span>
                <Tag tone="brand">Premium</Tag>
              </div>
              <DialogTitle className="text-xl">Branded AI Support Agent</DialogTitle>
              <DialogDescription>
                Fully customized AI chat support with your branding
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Custom brand colors and styling</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">15-minute setup/implementation call included</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Custom prompting for your business</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Human handover capability</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                  <span className="text-sm text-muted-foreground">Custom actions (SMS, email, internal notifications)</span>
                </li>
              </ul>
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-bold text-foreground">$20</span>
                  <span className="text-sm text-muted-foreground">/month per customer</span>
                </div>
                <Button
                  variant="accent"
                  className="w-full"
                  onClick={() => window.open(brandedPaymentLink, "_blank")}
                >
                  <Sparkles aria-hidden="true" />
                  Upgrade to branded AI support
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
                      <div className="mb-1 text-xs font-medium text-brand">
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
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    <span>
                      Our AI will email <span className="font-medium">{selectedTicket.customer_email}</span> with their ticket update — including any attached image. The ticket will be marked as responded.
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setSelectedTicket(null); setTicketResponse(""); setTicketAttachment(null); }} disabled={isSendingTicketResponse}>
                    Cancel
                  </Button>
                  <Button variant="accent" onClick={handleSendTicketResponse} disabled={isSendingTicketResponse || !ticketResponse.trim()}>
                    <Mail aria-hidden="true" />
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
              <Banner tone="info" title="To install:">
                paste this code at the agency level under Company, White Label, Custom CSS.
              </Banner>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEmbedCodePopup(false)}>
                  Cancel
                </Button>
                <Button variant="accent" onClick={saveEmbedCode} disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save embed code"}
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