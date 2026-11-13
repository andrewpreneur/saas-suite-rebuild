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
import { SectionCard } from "@/components/premium/SectionCard";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { HubSection } from "@/components/premium/hub/HubSection";
import { AddRowButton, OnOffSwitch } from "@/components/premium/hub/HubBits";
import { CopyButton } from "@/components/premium/hub/CopyButton";
import { HaloDropzone } from "@/components/premium/21st/halo-dropzone";
import { ArrowRight, ChevronDown, Link as LinkIcon, MessageSquareText } from "lucide-react";

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
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="warning" className="flex items-center gap-1">
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

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAiAdvanced, setShowAiAdvanced] = useState(false);

  return (
    <div className="min-w-0">
      <Reveal className="space-y-4">
        <RevealItem className="space-y-4">
          {/* ===== Welcome text ===== */}
          <SectionCard
            icon={<MessageSquareText />}
            title="Page text"
            description="The headline and line of text at the top of your Support page."
          >
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="support-headline">Headline</Label>
                <Input
                  id="support-headline"
                  value={supportHeadline}
                  onChange={(e) => setSupportHeadline(e.target.value)}
                  className="font-semibold"
                  placeholder="How can we help?"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="support-subheadline">Subheadline</Label>
                <Textarea
                  id="support-subheadline"
                  value={supportSubheadline}
                  onChange={(e) => setSupportSubheadline(e.target.value)}
                  rows={2}
                  placeholder="Subheadline"
                />
              </div>
            </div>
          </SectionCard>

          {/* ===== Support Links ===== */}
          <SectionCard
            icon={<LinkIcon />}
            title="Support links"
            description="Up to three buttons: book a call, open your help desk, anything with a link."
            actions={
              <span className="text-xs tabular-nums text-muted-foreground">{filledLinks.length} of 3</span>
            }
          >
            <div className="space-y-3">
              {filledLinks.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {filledLinks.map((l) => (
                    <div key={l.idx} className="space-y-2 rounded-md border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Input
                          value={l.text}
                          onChange={(e) => l.setText(e.target.value)}
                          placeholder="Button text"
                          aria-label="Button text"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete"
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteLink(l.idx)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      <Input
                        value={l.url}
                        onChange={(e) => l.setUrl(e.target.value)}
                        placeholder="https://..."
                        aria-label="Button link"
                      />
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Color</span>
                        <ColorPicker label="" color={l.color} onChange={l.setColor} />
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
                        <Label
                          htmlFor={`popup-toggle-${l.idx}`}
                          className="cursor-pointer text-sm font-normal text-muted-foreground"
                        >
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
              {emptyLink && <AddRowButton onClick={addSupportLink}>Add a support link</AddRowButton>}
            </div>
          </SectionCard>

          <SectionCard
            icon={<Clock />}
            title="Chat availability"
            description="When clients can reach a person, and what they see when you are away."
          >
            {chatModeSettings}
          </SectionCard>

          {/* ===== AI Chat ===== */}
          {aiAccess && (
            <HubSection
              data-tip-target="v3-support-ai-chat"
              icon={<Bot />}
              title="AI assistant"
              description="Answers client questions instantly, in your voice."
              off={!aiChatEnabled}
              actions={
                <OnOffSwitch
                  id="ai-chat-toggle-v3"
                  label="Turn the AI assistant on or off"
                  checked={aiChatEnabled}
                  onCheckedChange={toggleAiChat}
                />
              }
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
                {/* LEFT: prompts */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-personality">Personality</Label>
                    <Textarea
                      id="ai-personality"
                      value={promptPersonality}
                      onChange={(e) => setPromptPersonality(e.target.value)}
                      placeholder="Describe how the assistant should sound and behave..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-goals">Goals</Label>
                    <Textarea
                      id="ai-goals"
                      value={promptGoals}
                      onChange={(e) => setPromptGoals(e.target.value)}
                      placeholder="What should the assistant accomplish?"
                      rows={4}
                    />
                  </div>

                  <button
                    type="button"
                    aria-expanded={showAiAdvanced}
                    onClick={() => setShowAiAdvanced((v) => !v)}
                    className="flex min-h-9 items-center gap-1.5 rounded-sm text-sm font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown
                      className={`size-4 transition-transform duration-200 ${showAiAdvanced ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                    {showAiAdvanced ? "Hide advanced options" : "Advanced options"}
                  </button>

                  {showAiAdvanced && (
                    <div className="space-y-4 rounded-md border border-border bg-muted/30 p-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-extra">Additional instructions</Label>
                        <Textarea
                          id="ai-extra"
                          value={promptAdditionalInstructions}
                          onChange={(e) => setPromptAdditionalInstructions(e.target.value)}
                          placeholder="Any extra rules or guardrails..."
                          rows={3}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-training-doc">
                          Training doc link <span className="font-normal text-muted-foreground">(optional)</span>
                        </Label>
                        <Input
                          id="ai-training-doc"
                          value={promptTrainingDoc}
                          onChange={(e) => setPromptTrainingDoc(e.target.value)}
                          placeholder="https://docs.example.com/help"
                        />
                      </div>

                      {selectedPlanAgencyId && (
                        <div className="space-y-1.5">
                          <Label htmlFor="ai-onboarding-doc">Onboarding doc link</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="ai-onboarding-doc"
                              readOnly
                              value={`${window.location.origin}/${selectedPlanAgencyId}/training-doc/${tier}`}
                              className="bg-muted/50 font-mono text-xs"
                            />
                            <CopyButton
                              label="Copy"
                              onCopy={() => {
                                const url = `${window.location.origin}/${selectedPlanAgencyId}/training-doc/${tier}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Onboarding doc URL copied!");
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Public page with video transcriptions for this plan.
                          </p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                        <p className="min-w-0 flex-1 basis-48 text-sm text-muted-foreground">
                          Start over with our recommended personality and goals.
                        </p>
                        <Button size="sm" variant="outline" onClick={() => setImportDialogOpen(true)}>
                          <RefreshCw className="size-3.5" />
                          Import default prompts
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: phone preview */}
                <div className="flex flex-col items-center gap-3">
                  <p className="px-eyebrow self-start md:self-center">Preview</p>
                  <div className="relative flex h-[360px] w-[200px] flex-col overflow-hidden rounded-xl border-4 border-foreground/80 bg-background shadow-raised">
                    <div className="flex h-5 items-center justify-center bg-foreground/80">
                      <div className="h-1 w-12 rounded-full bg-background/40" />
                    </div>
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/30 p-4">
                      <button
                        type="button"
                        onClick={openIconDialog}
                        className="flex size-16 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-brand/40 bg-background transition-colors hover:bg-brand-subtle"
                        title="Click to change icon"
                        aria-label="Change the assistant icon"
                      >
                        {aiChatIconUrl ? (
                          <img src={aiChatIconUrl} alt="AI" className="h-full w-full object-cover" />
                        ) : (
                          <Bot className="size-8 text-brand" />
                        )}
                      </button>
                      {editingChatName ? (
                        <Input
                          autoFocus
                          value={aiChatName}
                          onChange={(e) => setAiChatName(e.target.value)}
                          onBlur={() => setEditingChatName(false)}
                          onKeyDown={(e) => e.key === "Enter" && setEditingChatName(false)}
                          className="h-8 text-center text-xs"
                          placeholder="Assistant name"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingChatName(true)}
                          className="cursor-text rounded-sm px-2 py-0.5 text-center text-xs font-medium hover:bg-muted/60"
                          title="Click to rename"
                        >
                          {aiChatName || "AI Support Assistant"}
                        </button>
                      )}
                      <p className="text-center text-[10px] text-muted-foreground">Tap to start chatting</p>
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Click the icon or the name to change it.
                  </p>
                </div>
              </div>
            </HubSection>
          )}
        </RevealItem>

        <RevealItem className="space-y-4">
          {/* ===== Tickets / Conversations ===== */}
          <HubSection
            data-tip-target="v3-support-ticketing"
            icon={<Ticket />}
            title="Support tickets"
            description="Let clients open tickets from the hub. You answer them, and AI chats, in Client Support."
            actions={
              <>
                <OnOffSwitch
                  id="ticketing-toggle-v3"
                  label="Enable/Disable Support Ticketing"
                  checked={ticketingEnabled}
                  onCheckedChange={toggleTicketing}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("tipbot-select-tool", { detail: { tool: "support" } }),
                    )
                  }
                >
                  Open Client Support
                  <ArrowRight className="size-4" />
                </Button>
              </>
            }
          />

          {/* ===== Advanced: webhooks and voice ===== */}
          <section className="px-surface min-w-0">
            <button
              type="button"
              aria-expanded={showAdvanced}
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center gap-3 rounded-lg p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
            >
              <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
                <Webhook />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-foreground">Automations and voice</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Send ticket events to HighLevel or Zapier{isAdvancedPlan ? ", and connect Voice AI" : ""}.
                  {webhookUrl ? " A webhook is connected." : ""}
                </span>
              </span>
              <ChevronDown
                className={`size-5 shrink-0 text-muted-foreground transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {showAdvanced && (
              <div className="space-y-6 border-t border-border p-4 sm:p-6">
                {/* ===== Inbound webhook ===== */}
                <div className="space-y-2">
                  <Label htmlFor="support-ticket-webhook">Webhook for new tickets and status changes</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="support-ticket-webhook"
                      type="url"
                      placeholder="https://hooks.example.com/webhook..."
                      value={tempWebhookUrl}
                      onChange={(e) => setTempWebhookUrl(e.target.value)}
                      className="flex-1"
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 sm:flex-none"
                        onClick={() => saveWebhookUrl()}
                        disabled={isSavingWebhook || tempWebhookUrl === webhookUrl}
                      >
                        {isSavingWebhook ? "Saving..." : "Save webhook"}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 sm:flex-none"
                        onClick={() => testWebhook()}
                        disabled={isTestingWebhook || !webhookUrl}
                        title="Send a test payload to verify your webhook"
                      >
                        <Play className="size-4" />
                        {isTestingWebhook ? "Testing..." : "Send test"}
                      </Button>
                    </div>
                  </div>
                  {webhookUrl ? (
                    <p className="flex items-center gap-1.5 text-sm text-success">
                      <CheckCircle2 className="size-4" /> Webhook connected
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      We post here whenever a ticket is created or its status changes.
                    </p>
                  )}
                </div>

                {/* ===== Second inbound webhook: ticket updates ===== */}
                <SupportUpdatesWebhookPanel />
                <CustomerRepliesWebhookPanel />

                {/* ===== Voice AI Support (external API access) ===== */}
                {isAdvancedPlan && <VoiceAISupportPanel agencyId={selectedPlanAgencyId} />}
              </div>
            )}
          </section>

          {/* Done-for-you support */}
          <div className="px-brand-wash flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/20 p-4 sm:p-6">
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-base font-semibold text-foreground">Rather have a person answer for you?</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Add a trained customer support representative who replies to your clients under your brand.
              </p>
            </div>
            <Button variant="outline" onClick={() => setRepDialogOpen(true)}>
              <Sparkles className="size-4" />
              See support rep plans
            </Button>
          </div>
        </RevealItem>
      </Reveal>

      {/* ===== Save button: the one primary action of the Support page ===== */}
      <div className="px-glass sticky bottom-3 z-10 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 shadow-raised">
        <p className="min-w-0 flex-1 basis-48 text-sm text-muted-foreground">
          Saves the page text, support links and AI assistant for this plan.
        </p>
        <Button variant="accent" onClick={() => saveSupportSettings()} disabled={isSaving}>
          <Save className="size-4" />
          {isSaving ? "Saving…" : "Save Support page"}
        </Button>
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
              <HaloDropzone
                className="flex-1"
                accept="image/*"
                disabled={uploadingIcon}
                emptyLabel={uploadingIcon ? "Uploading…" : "Drop an image, or click to choose"}
                formatHint="Square PNG or JPG works best"
                successLabel="Icon added"
                showSuccessThumbnails={false}
                successResetMs={1800}
                onFiles={(files) => {
                  if (files[0]) handleIconUpload(files[0]);
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIconDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={saveIcon}>Use this icon</Button>
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
              <AlertCircle className="w-5 h-5 text-warning" />
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
              <Badge variant="brand">
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
                <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  A dedicated rep available in Slack to ask questions and get help with your GHL account
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Hands-on assistance with workflows, automations, and onboarding setup
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Help troubleshooting client issues and escalations
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Priority response times during business hours
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">
                  Ongoing optimization recommendations for your software
                </span>
              </li>
            </ul>
            <Button
              variant="accent" className="w-full"
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