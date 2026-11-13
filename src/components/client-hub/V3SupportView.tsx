import { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import ColorPicker from "@/components/ColorPicker";
import { TicketAttachmentField, type TicketAttachmentValue } from "@/components/support/TicketAttachmentField";
import { uploadTicketAttachment } from "@/lib/ticketAttachment";
import SupportUpdatesWebhookPanel from "@/components/support/SupportUpdatesWebhookPanel";
import CustomerRepliesWebhookPanel from "@/components/support/CustomerRepliesWebhookPanel";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Bot,
  Plus,
  Sparkles,
  Check,
  Upload,
  MoreVertical,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw,
  Save,
  Webhook,
  Ticket,
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Copy,
  Play,
  Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DEFAULT_AI_PROMPT_PERSONALITY,
  DEFAULT_AI_PROMPT_GOALS,
  DEFAULT_AI_PROMPT_INSTRUCTIONS,
} from "@/constants/aiPromptDefaults";
import ChatInterventionPanel from "@/components/client-hub/ChatInterventionPanel";
import VoiceAISupportPanel from "@/components/client-hub/VoiceAISupportPanel";
import { PreviewHeaderHost } from "@/components/client-hub/PreviewHeaderSlot";

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
}

interface V3SupportViewProps {
  // Welcome / headline
  supportHeadline: string;
  setSupportHeadline: (v: string) => void;
  supportSubheadline: string;
  setSupportSubheadline: (v: string) => void;

  // Support links (3 slots)
  supportButton1Text: string;
  setSupportButton1Text: (v: string) => void;
  supportButton1Url: string;
  setSupportButton1Url: (v: string) => void;
  supportButton1Color: string;
  setSupportButton1Color: (v: string) => void;
  supportButton1OpenAsPopup: boolean;
  setSupportButton1OpenAsPopup: (v: boolean) => void;
  supportButton2Text: string;
  setSupportButton2Text: (v: string) => void;
  supportButton2Url: string;
  setSupportButton2Url: (v: string) => void;
  supportButton2Color: string;
  setSupportButton2Color: (v: string) => void;
  supportButton2OpenAsPopup: boolean;
  setSupportButton2OpenAsPopup: (v: boolean) => void;
  supportButton3Text: string;
  setSupportButton3Text: (v: string) => void;
  supportButton3Url: string;
  setSupportButton3Url: (v: string) => void;
  supportButton3Color: string;
  setSupportButton3Color: (v: string) => void;
  supportButton3OpenAsPopup: boolean;
  setSupportButton3OpenAsPopup: (v: boolean) => void;

  // AI chat
  aiChatName: string;
  setAiChatName: (v: string) => void;
  aiChatIconUrl: string;
  setAiChatIconUrl: (v: string) => void;
  promptPersonality: string;
  setPromptPersonality: (v: string) => void;
  promptGoals: string;
  setPromptGoals: (v: string) => void;
  promptAdditionalInstructions: string;
  setPromptAdditionalInstructions: (v: string) => void;
  promptTrainingDoc: string;
  setPromptTrainingDoc: (v: string) => void;

  // Save handler (saves all support + ai)
  saveSupportSettings: () => Promise<void> | void;
  isSaving: boolean;

  // Tickets
  ticketingEnabled: boolean;
  toggleTicketing: (enabled: boolean) => Promise<void> | void;
  tickets: SupportTicket[];
  handleStatusChange: (ticketId: string, newStatus: string) => Promise<void> | void;
  onTicketResponseSent?: (ticketId: string, responseText: string) => void;

  // Webhook
  webhookUrl: string;
  tempWebhookUrl: string;
  setTempWebhookUrl: (v: string) => void;
  saveWebhookUrl: () => Promise<void> | void;
  isSavingWebhook: boolean;

  // Branded support upgrade
  hasBrandedSupport: boolean;

  agencyVersions: any;

  // For onboarding doc URL + transcribe button
  selectedPlanAgencyId: string | null;
  tier: string;

  // AI Chat widget enable/disable
  aiChatEnabled: boolean;
  toggleAiChat: (enabled: boolean) => Promise<void> | void;

  // Test webhook
  testWebhook: () => Promise<void> | void;
  isTestingWebhook: boolean;

  // Plan gating
  isAdvancedPlan?: boolean;
  hasAiSupportAccess?: boolean;
  chatModeSettings: ReactNode;
}

const BRANDED_PAYMENT_LINK = "https://link.saassuite.ai/payment-link/6931fbc4d8c1a8dff7043087";
const REP_PAYMENT_LINK = BRANDED_PAYMENT_LINK; // placeholder - reuse same link until a dedicated one is provided

const V3SupportView = ({
  supportHeadline,
  setSupportHeadline,
  supportSubheadline,
  setSupportSubheadline,
  supportButton1Text,
  setSupportButton1Text,
  supportButton1Url,
  setSupportButton1Url,
  supportButton1Color,
  setSupportButton1Color,
  supportButton1OpenAsPopup,
  setSupportButton1OpenAsPopup,
  supportButton2Text,
  setSupportButton2Text,
  supportButton2Url,
  setSupportButton2Url,
  supportButton2Color,
  setSupportButton2Color,
  supportButton2OpenAsPopup,
  setSupportButton2OpenAsPopup,
  supportButton3Text,
  setSupportButton3Text,
  supportButton3Url,
  setSupportButton3Url,
  supportButton3Color,
  setSupportButton3Color,
  supportButton3OpenAsPopup,
  setSupportButton3OpenAsPopup,
  aiChatName,
  setAiChatName,
  aiChatIconUrl,
  setAiChatIconUrl,
  promptPersonality,
  setPromptPersonality,
  promptGoals,
  setPromptGoals,
  promptAdditionalInstructions,
  setPromptAdditionalInstructions,
  promptTrainingDoc,
  setPromptTrainingDoc,
  saveSupportSettings,
  isSaving,
  ticketingEnabled,
  toggleTicketing,
  tickets,
  handleStatusChange,
  onTicketResponseSent,
  webhookUrl,
  tempWebhookUrl,
  setTempWebhookUrl,
  saveWebhookUrl,
  isSavingWebhook,
  hasBrandedSupport,
  agencyVersions,
  selectedPlanAgencyId,
  tier,
  aiChatEnabled,
  toggleAiChat,
  testWebhook,
  isTestingWebhook,
  isAdvancedPlan = true,
  hasAiSupportAccess,
  chatModeSettings,
}: V3SupportViewProps) => {
  const aiAccess = hasAiSupportAccess ?? isAdvancedPlan;
  const [editingHeadline, setEditingHeadline] = useState(false);
  const [editingSub, setEditingSub] = useState(false);
  const [editingChatName, setEditingChatName] = useState(false);

  // Image upload dialog for AI icon
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
  const [tempIconUrl, setTempIconUrl] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconFileInputRef = useRef<HTMLInputElement>(null);

  // Import default prompts confirm dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Rep upgrade dialog
  const [repDialogOpen, setRepDialogOpen] = useState(false);

  // Conversations vs Tickets view toggle
  const [view, setView] = useState<"tickets" | "conversations">("tickets");
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketResponse, setTicketResponse] = useState("");
  const [isSendingTicketResponse, setIsSendingTicketResponse] = useState(false);
  const [ticketAttachment, setTicketAttachment] = useState<TicketAttachmentValue | null>(null);

  const openIconDialog = () => {
    setTempIconUrl(aiChatIconUrl || "");
    setIconDialogOpen(true);
  };

  const handleIconUpload = async (file: File) => {
    setUploadingIcon(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `ai-icon-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, {
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("logos").getPublicUrl(path);
      setTempIconUrl(data.publicUrl);
    } catch (e) {
      console.error(e);
      toast.error("Failed to upload icon");
    } finally {
      setUploadingIcon(false);
    }
  };

  const saveIcon = () => {
    setAiChatIconUrl(tempIconUrl);
    setIconDialogOpen(false);
    toast.success("Icon updated. Click Save to persist.");
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
      onTicketResponseSent?.(selectedTicket.id, ticketResponse.trim());
      setSelectedTicket(null);
      setTicketResponse("");
      setTicketAttachment(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to send response");
    } finally {
      setIsSendingTicketResponse(false);
    }
  };

  const importDefaultPrompts = () => {
    if (confirmText.trim().toUpperCase() !== "CONFIRM") {
      toast.error('Type "CONFIRM" to proceed');
      return;
    }
    setPromptPersonality(DEFAULT_AI_PROMPT_PERSONALITY);
    setPromptGoals(DEFAULT_AI_PROMPT_GOALS);
    setPromptAdditionalInstructions(DEFAULT_AI_PROMPT_INSTRUCTIONS);
    setImportDialogOpen(false);
    setConfirmText("");
    toast.success("Default prompts imported. Click Save to persist.");
  };

  const linkSlots = [
    {
      idx: 1 as const,
      text: supportButton1Text,
      setText: setSupportButton1Text,
      url: supportButton1Url,
      setUrl: setSupportButton1Url,
      color: supportButton1Color,
      setColor: setSupportButton1Color,
      openAsPopup: supportButton1OpenAsPopup,
      setOpenAsPopup: setSupportButton1OpenAsPopup,
    },
    {
      idx: 2 as const,
      text: supportButton2Text,
      setText: setSupportButton2Text,
      url: supportButton2Url,
      setUrl: setSupportButton2Url,
      color: supportButton2Color,
      setColor: setSupportButton2Color,
      openAsPopup: supportButton2OpenAsPopup,
      setOpenAsPopup: setSupportButton2OpenAsPopup,
    },
    {
      idx: 3 as const,
      text: supportButton3Text,
      setText: setSupportButton3Text,
      url: supportButton3Url,
      setUrl: setSupportButton3Url,
      color: supportButton3Color,
      setColor: setSupportButton3Color,
      openAsPopup: supportButton3OpenAsPopup,
      setOpenAsPopup: setSupportButton3OpenAsPopup,
    },
  ];
  const filledLinks = linkSlots.filter((l) => l.text || l.url);
  const emptyLink = linkSlots.find((l) => !l.text && !l.url);

  const addSupportLink = () => {
    if (!emptyLink) {
      toast.error("Maximum 3 links");
      return;
    }
    emptyLink.setText("New Link");
  };

  const deleteLink = (idx: 1 | 2 | 3) => {
    if (idx === 1) {
      setSupportButton1Text("");
      setSupportButton1Url("");
    } else if (idx === 2) {
      setSupportButton2Text("");
      setSupportButton2Url("");
    } else {
      setSupportButton3Text("");
      setSupportButton3Url("");
    }
  };

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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="border rounded-lg bg-background">
      <div className="px-4 py-3 border-b shadow-sm flex items-center justify-between">
        <PreviewHeaderHost />
        <Button
          size="sm"
          variant="outline"
          className="bg-gradient-to-r from-primary to-purple-500 text-white border-0 hover:opacity-90"
          onClick={() => setRepDialogOpen(true)}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Purchase a Customer Support Representative
        </Button>
      </div>

      <div className="p-6 space-y-6">
        {/* ===== Welcome text ===== */}
        <div className="rounded-lg border p-5">
          <div className="text-center space-y-2 flex flex-col items-center">
            {editingHeadline ? (
              <Input
                autoFocus
                value={supportHeadline}
                onChange={(e) => setSupportHeadline(e.target.value)}
                onBlur={() => setEditingHeadline(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingHeadline(false)}
                className="text-xl font-bold text-center"
                placeholder="How can we help?"
              />
            ) : (
              <h2
                onClick={() => setEditingHeadline(true)}
                className="text-xl font-bold cursor-text rounded px-2 py-0.5 hover:bg-muted/50 transition block"
                title="Click to edit"
              >
                {supportHeadline || "Click to add headline"}
              </h2>
            )}
            {editingSub ? (
              <Textarea
                autoFocus
                value={supportSubheadline}
                onChange={(e) => setSupportSubheadline(e.target.value)}
                onBlur={() => setEditingSub(false)}
                rows={2}
                className="text-sm text-center"
                placeholder="Subheadline"
              />
            ) : (
              <p
                onClick={() => setEditingSub(true)}
                className="text-sm text-muted-foreground cursor-text rounded px-2 py-0.5 hover:bg-muted/50 transition block"
                title="Click to edit"
              >
                {supportSubheadline || "Click to add subheadline"}
              </p>
            )}
          </div>
        </div>

        {/* ===== Support Links ===== */}
        <div className="space-y-3">
          {filledLinks.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {filledLinks.map((l) => (
                <div key={l.idx} className="rounded-lg border p-3 space-y-2 relative">
                  <div className="absolute top-1 right-1">
                    <Button
                      variant="ghost"
                      size="icon" aria-label="Delete"
                      className="h-6 w-6"
                      onClick={() => deleteLink(l.idx)}
                    >
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                  <Input
                    value={l.text}
                    onChange={(e) => l.setText(e.target.value)}
                    placeholder="Button text"
                    className="text-sm"
                  />
                  <Input
                    value={l.url}
                    onChange={(e) => l.setUrl(e.target.value)}
                    placeholder="https://..."
                    className="text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Color</span>
                    <ColorPicker label="" color={l.color} onChange={l.setColor} />
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t">
                    <Label htmlFor={`popup-toggle-${l.idx}`} className="text-xs text-muted-foreground cursor-pointer">
                      {l.openAsPopup ? "Opens as popup iframe" : "Opens in new tab"}
                    </Label>
                    <Switch
                      id={`popup-toggle-${l.idx}`}
                      checked={l.openAsPopup}
                      onCheckedChange={l.setOpenAsPopup}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
          {emptyLink && (
            <button
              onClick={addSupportLink}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed text-sm text-primary hover:bg-primary/5"
            >
              <Plus className="w-4 h-4" /> Add Support Link
            </button>
          )}
        </div>

        <div className="rounded-lg border p-5">
          <h3 className="font-semibold text-base mb-4">Chat Availability</h3>
          {chatModeSettings}
        </div>

        {/* ===== AI Chat ===== */}
        {aiAccess && (
        <div className="rounded-lg border p-5" data-tip-target="v3-support-ai-chat">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-base">AI Chat Support</h3>
              <div className="flex items-center gap-2 ml-3 pl-3 border-l">
                <Label htmlFor="ai-chat-toggle-v3" className="text-xs text-muted-foreground">
                  {aiChatEnabled ? "Enabled" : "Disabled"}
                </Label>
                <Switch
                  id="ai-chat-toggle-v3"
                  checked={aiChatEnabled}
                  onCheckedChange={toggleAiChat}
                />
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportDialogOpen(true)}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" />
              Import Default Prompts
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6">
            {/* LEFT: prompts */}
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Personality</Label>
                <Textarea
                  value={promptPersonality}
                  onChange={(e) => setPromptPersonality(e.target.value)}
                  placeholder="Describe how the assistant should sound and behave..."
                  rows={4}
                  className="text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Goals</Label>
                <Textarea
                  value={promptGoals}
                  onChange={(e) => setPromptGoals(e.target.value)}
                  placeholder="What should the assistant accomplish?"
                  rows={4}
                  className="text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Additional Instructions</Label>
                <Textarea
                  value={promptAdditionalInstructions}
                  onChange={(e) => setPromptAdditionalInstructions(e.target.value)}
                  placeholder="Any extra rules or guardrails..."
                  rows={3}
                  className="text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">
                  Training Doc URL <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  value={promptTrainingDoc}
                  onChange={(e) => setPromptTrainingDoc(e.target.value)}
                  placeholder="https://docs.example.com/help"
                  className="text-sm mt-1"
                />
              </div>

              {selectedPlanAgencyId && (
                <div>
                  <Label className="text-xs font-medium">Onboarding Doc URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      readOnly
                      value={`${window.location.origin}/${selectedPlanAgencyId}/training-doc/${tier}`}
                      className="text-sm bg-muted/50"
                    />
                    <Button
                      variant="outline"
                      size="icon" aria-label="Copy"
                      onClick={() => {
                        const url = `${window.location.origin}/${selectedPlanAgencyId}/training-doc/${tier}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Onboarding doc URL copied!");
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Public page with video transcriptions for this plan
                  </p>
                </div>
              )}

              
            </div>

            {/* RIGHT: phone preview */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-[200px] h-[360px] rounded-[28px] border-4 border-foreground/80 bg-background shadow-lg overflow-hidden flex flex-col">
                <div className="h-5 bg-foreground/80 flex items-center justify-center">
                  <div className="w-12 h-1 rounded-full bg-background/40" />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3 bg-muted/30">
                  <button
                    type="button"
                    onClick={openIconDialog}
                    className="w-16 h-16 rounded-full overflow-hidden border-2 border-dashed border-primary/40 bg-background flex items-center justify-center hover:bg-muted transition"
                    title="Click to change icon"
                  >
                    {aiChatIconUrl ? (
                      <img
                        src={aiChatIconUrl}
                        alt="AI"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Bot className="w-8 h-8 text-primary" />
                    )}
                  </button>
                  {editingChatName ? (
                    <Input
                      autoFocus
                      value={aiChatName}
                      onChange={(e) => setAiChatName(e.target.value)}
                      onBlur={() => setEditingChatName(false)}
                      onKeyDown={(e) => e.key === "Enter" && setEditingChatName(false)}
                      className="text-xs text-center h-7"
                      placeholder="Assistant name"
                    />
                  ) : (
                    <p
                      onClick={() => setEditingChatName(true)}
                      className="text-xs font-medium text-center cursor-text rounded px-2 py-0.5 hover:bg-muted/60"
                      title="Click to rename"
                    >
                      {aiChatName || "AI Support Assistant"}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground text-center">
                    Tap to start chatting
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Click the bot icon to upload your own
              </p>
            </div>
          </div>
        </div>
        )}

        {/* ===== Save button ===== */}
        <div className="flex justify-end">
          <Button onClick={() => saveSupportSettings()} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "Saving..." : "Save Support Settings"}
          </Button>
        </div>

        {/* ===== Tickets / Conversations ===== */}
        <div
          className="rounded-lg border p-5 space-y-3 bg-gradient-to-br from-primary/5 to-transparent"
          data-tip-target="v3-support-ticketing"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-md bg-primary/10">
              <Ticket className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base">Looking for tickets and chats?</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Support tickets and AI chat conversations now live in the dedicated Support tab —
                with dashboards for open, waiting-on-customer, and closed tickets, plus a separate
                "Requires Human" queue.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="ticketing-toggle-v3" className="text-xs">
                Enable/Disable Support Ticketing
              </Label>
              <Switch
                id="ticketing-toggle-v3"
                checked={ticketingEnabled}
                onCheckedChange={toggleTicketing}
              />
            </div>
            <Button
              size="sm"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("tipbot-select-tool", { detail: { tool: "support" } }),
                )
              }
            >
              <Ticket className="w-4 h-4 mr-2" />
              Go to Support tab
            </Button>
          </div>
        </div>

        {/* ===== Inbound webhook ===== */}
        <div className="rounded-lg border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Webhook className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold text-base">Inbound Webhook URL (Support Tickets)</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Receive notifications when tickets are created or status changes. Useful for GoHighLevel or Zapier automations.
          </p>
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://hooks.example.com/webhook..."
              value={tempWebhookUrl}
              onChange={(e) => setTempWebhookUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={() => saveWebhookUrl()}
              disabled={isSavingWebhook || tempWebhookUrl === webhookUrl}
            >
              {isSavingWebhook ? "Saving..." : "Save"}
            </Button>
            <Button
              variant="outline"
              onClick={() => testWebhook()}
              disabled={isTestingWebhook || !webhookUrl}
              title="Send a test payload to verify your webhook"
            >
              <Play className="w-4 h-4 mr-1" />
              {isTestingWebhook ? "Testing..." : "Test"}
            </Button>
          </div>
          {webhookUrl && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" /> Webhook configured
            </p>
          )}
        </div>

        {/* ===== Second inbound webhook: ticket updates ===== */}
        <SupportUpdatesWebhookPanel />
        <CustomerRepliesWebhookPanel />


        {/* ===== Voice AI Support (external API access) ===== */}
        {isAdvancedPlan && (
          <VoiceAISupportPanel agencyId={selectedPlanAgencyId} />
        )}
      </div>

      {/* ===== Icon dialog ===== */}
      <Dialog open={iconDialogOpen} onOpenChange={setIconDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Set AI Chat Icon</DialogTitle>
            <DialogDescription>Upload an image or paste a URL.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-24 h-24 rounded-full overflow-hidden border bg-muted/40 flex items-center justify-center">
                {tempIconUrl ? (
                  <img src={tempIconUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Bot className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Image URL</Label>
              <Input
                value={tempIconUrl}
                onChange={(e) => setTempIconUrl(e.target.value)}
                placeholder="https://..."
                className="text-sm mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={iconFileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleIconUpload(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => iconFileInputRef.current?.click()}
                disabled={uploadingIcon}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadingIcon ? "Uploading..." : "Upload Image"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIconDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveIcon}>Use this icon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Import default prompts confirm ===== */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(o) => {
          setImportDialogOpen(o);
          if (!o) setConfirmText("");
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Overwrite existing prompts?
            </DialogTitle>
            <DialogDescription>
              Importing default prompts will replace your current Personality, Goals,
              and Additional Instructions. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">
              Type <span className="font-mono font-bold">CONFIRM</span> to proceed
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CONFIRM"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={importDefaultPrompts}
              disabled={confirmText.trim().toUpperCase() !== "CONFIRM"}
            >
              Overwrite Prompts
            </Button>
          </DialogFooter>
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
                  {isSendingTicketResponse ? "Sending…" : "Send response"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Customer Support Rep upgrade dialog ===== */}
      <Dialog open={repDialogOpen} onOpenChange={setRepDialogOpen}>
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
            <DialogTitle className="text-xl">
              Purchase a Customer Support Representative
            </DialogTitle>
            <DialogDescription>
              Get a dedicated human teammate to back you up.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  A dedicated rep available in Slack to ask questions and get help with your GHL account
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Hands-on assistance with workflows, automations, and onboarding setup
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Help troubleshooting client issues and escalations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Priority response times during business hours
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Ongoing optimization recommendations for your software
                </span>
              </li>
            </ul>
            <Button
              className="w-full bg-gradient-to-r from-primary to-purple-500 hover:opacity-90 text-white"
              onClick={() => window.open(REP_PAYMENT_LINK, "_blank")}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Get a Dedicated Rep
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default V3SupportView;