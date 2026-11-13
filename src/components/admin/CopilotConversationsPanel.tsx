import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Search,
  MessageSquare,
  Send,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Copy,
  ArrowLeft,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUiSounds } from "@/hooks/useUiSounds";
import { renderMessageContent } from "@/lib/renderChatContent";
import { ChatAttachButton, ChatAttachmentPreview, type ChatAttachmentValue } from "@/components/support/ChatAttachButton";
import { uploadChatAttachment } from "@/lib/chatAttachment";
import { Download } from "lucide-react";
import CopilotPromptEditsCard from "./CopilotPromptEditsCard";
import { buildChatsCsv, downloadCsv } from "./copilotExport";

interface CopilotMessage {
  id: string;
  owner_email: string;
  role: string;
  content: string;
  actions: any;
  attachments?: any;
  created_at: string;
}

interface ConversationSummary {
  email: string;
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
}

interface SuggestionTheme {
  title: string;
  problem: string;
  evidence_count?: number;
  prompt_snippet: string;
  severity?: string;
}

interface SuggestionResult {
  themes: SuggestionTheme[];
  keep_doing: string[];
  summary: string;
  counts?: { down: number; up: number };
}

export default function CopilotConversationsPanel() {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachmentValue | null>(null);
  const { playReceive } = useUiSounds();
  const dingSeenRef = useRef<Set<string>>(new Set());
  const dingReadyRef = useRef(false);

  const [adminEmail, setAdminEmail] = useState("");
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [savingRating, setSavingRating] = useState(false);
  const [draft, setDraft] = useState<{
    messageId: string;
    ownerEmail: string;
    question: string;
    answer: string;
    corrected: string;
    notes: string;
  } | null>(null);

  const [suggestions, setSuggestions] = useState<SuggestionResult | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminEmail(data.user?.email?.toLowerCase() || ""));
  }, []);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: rated }] = await Promise.all([
      supabase
        .from("copilot_chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("copilot_message_ratings").select("message_id, rating").limit(5000),
    ]);
    if (!error && data) setMessages(data as CopilotMessage[]);
    const map: Record<string, string> = {};
    (rated || []).forEach((r: any) => {
      map[r.message_id] = r.rating;
    });
    setRatings(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // After the initial load, mark existing messages as seen so we only ding
  // on genuinely new inserts (not the historical backfill).
  useEffect(() => {
    if (!loading && !dingReadyRef.current) {
      messages.forEach((m) => dingSeenRef.current.add(m.id));
      dingReadyRef.current = true;
    }
  }, [loading, messages]);

  // Realtime: pick up new messages (including admin replies) automatically
  useEffect(() => {
    const channel = supabase
      .channel("admin-copilot-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "copilot_chat_messages" },
        (payload) => {
          const row = payload.new as CopilotMessage;
          setMessages((prev) => [row, ...prev]);
          if (
            dingReadyRef.current &&
            row.role === "user" &&
            !dingSeenRef.current.has(row.id)
          ) {
            dingSeenRef.current.add(row.id);
            playReceive();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [playReceive]);

  const sendReply = async () => {
    if (!selectedEmail || (!reply.trim() && !attachment)) return;
    const outgoing = reply.trim();
    setSending(true);
    try {
      let attachments: any[] | null = null;
      if (attachment) {
        const url = await uploadChatAttachment(selectedEmail, attachment.file);
        attachments = [{ url, name: attachment.file.name, type: attachment.file.type }];
      }
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 8000);
      try {
        const { error } = await supabase
          .from("copilot_chat_messages")
          .insert({
            owner_email: selectedEmail,
            role: "assistant",
            content: outgoing,
            attachments,
            actions: [{ tool: "admin_reply", args: {}, message: "Reply from admin" }],
          })
          .abortSignal(controller.signal);
        if (error) throw error;
      } finally {
        window.clearTimeout(timer);
      }
      setReply("");
      setAttachment(null);
      toast.success("Reply sent");
      void supabase.functions
        .invoke("notify-team-reply", {
          body: { source: "copilot", owner_email: selectedEmail, our_message: outgoing },
          timeout: 10000,
        })
        .catch((e) => console.error("notify-team-reply (copilot) failed:", e));
    } catch (e: any) {
      toast.error(e?.name === "AbortError" ? "Supabase did not respond within 8 seconds. Please retry." : e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const conversations = useMemo<ConversationSummary[]>(() => {
    const map = new Map<string, ConversationSummary>();
    for (const m of messages) {
      const key = (m.owner_email || "").toLowerCase();
      if (!key) continue;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          email: key,
          messageCount: 1,
          lastMessageAt: m.created_at,
          lastMessagePreview: m.content?.slice(0, 100) || "",
        });
      } else {
        existing.messageCount++;
        if (new Date(m.created_at) > new Date(existing.lastMessageAt)) {
          existing.lastMessageAt = m.created_at;
          existing.lastMessagePreview = m.content?.slice(0, 100) || "";
        }
      }
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    const q = search.trim().toLowerCase();
    return q ? arr.filter((c) => c.email.includes(q) || c.lastMessagePreview.toLowerCase().includes(q)) : arr;
  }, [messages, search]);

  const conversationMessages = useMemo(() => {
    if (!selectedEmail) return [];
    return messages
      .filter((m) => (m.owner_email || "").toLowerCase() === selectedEmail)
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [messages, selectedEmail]);

  const precedingQuestion = (messageId: string) => {
    const idx = conversationMessages.findIndex((x) => x.id === messageId);
    if (idx < 0) return "";
    return (
      [...conversationMessages.slice(0, idx)].reverse().find((x) => x.role === "user")?.content || ""
    );
  };

  const rateUp = async (m: CopilotMessage) => {
    const prev = ratings[m.id];
    setRatings((r) => ({ ...r, [m.id]: "up" }));
    const { error } = await supabase.from("copilot_message_ratings").upsert(
      {
        message_id: m.id,
        owner_email: m.owner_email,
        rating: "up",
        question_text: precedingQuestion(m.id),
        answer_text: m.content,
        rated_by: adminEmail || "",
      },
      { onConflict: "message_id,rated_by" },
    );
    if (error) {
      console.error(error);
      toast.error("Failed to save rating");
      setRatings((r) => {
        const next = { ...r };
        if (prev) next[m.id] = prev;
        else delete next[m.id];
        return next;
      });
      return;
    }
    toast.success("Marked as a good CoPilot answer");
  };

  const openDownDraft = (m: CopilotMessage) => {
    setDraft({
      messageId: m.id,
      ownerEmail: m.owner_email,
      question: precedingQuestion(m.id),
      answer: m.content || "",
      corrected: "",
      notes: "",
    });
  };

  const saveDownRating = async () => {
    if (!draft || !draft.corrected.trim()) return;
    setSavingRating(true);
    const { error } = await supabase.from("copilot_message_ratings").upsert(
      {
        message_id: draft.messageId,
        owner_email: draft.ownerEmail,
        rating: "down",
        question_text: draft.question.trim() || null,
        answer_text: draft.answer || null,
        corrected_answer: draft.corrected.trim(),
        notes: draft.notes.trim() || null,
        rated_by: adminEmail || "",
      },
      { onConflict: "message_id,rated_by" },
    );
    setSavingRating(false);
    if (error) {
      console.error(error);
      toast.error(error.message || "Failed to save correction");
      return;
    }
    setRatings((r) => ({ ...r, [draft.messageId]: "down" }));
    setDraft(null);
    toast.success("Correction saved — it will feed the prompt suggestions");
  };

  const loadSuggestions = async () => {
    setSuggestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("copilot-prompt-suggestions", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSuggestions(data as SuggestionResult);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to generate suggestions");
    } finally {
      setSuggestLoading(false);
    }
  };

  const copySnippet = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Prompt snippet copied"),
      () => toast.error("Copy failed"),
    );
  };

  const severityClass = (s?: string) =>
    s === "high"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : s === "low"
      ? "bg-muted text-muted-foreground"
      : "bg-primary/15 text-primary border-primary/30";

  return (
    <div className="space-y-4">
      {/* Prompt modification suggestions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Sparkles className="w-5 h-5 flex-shrink-0" /> Prompt Modification Suggestions
              </CardTitle>
              <CardDescription>
                Generated from your thumbs up/down ratings and corrections below.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={loadSuggestions}
              disabled={suggestLoading}
              className="w-full sm:w-auto flex-shrink-0"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${suggestLoading ? "animate-spin" : ""}`} />
              {suggestions ? "Regenerate" : "Analyze ratings"}
            </Button>
          </div>
        </CardHeader>
        {suggestions && (
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{suggestions.counts?.down ?? 0} thumbs down</Badge>
              <Badge variant="outline">{suggestions.counts?.up ?? 0} thumbs up</Badge>
            </div>
            {suggestions.summary && (
              <p className="text-sm text-muted-foreground break-words">{suggestions.summary}</p>
            )}
            {suggestions.themes.map((t, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm break-words">{t.title}</span>
                  {t.severity && (
                    <Badge variant="outline" className={`text-xs ${severityClass(t.severity)}`}>
                      {t.severity}
                    </Badge>
                  )}
                  {typeof t.evidence_count === "number" && (
                    <Badge variant="secondary" className="text-xs">
                      {t.evidence_count} examples
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground break-words">{t.problem}</p>
                <div className="rounded-md bg-muted p-2">
                  <pre className="whitespace-pre-wrap break-words text-xs font-mono">
                    {t.prompt_snippet}
                  </pre>
                </div>
                <Button variant="outline" size="sm" onClick={() => copySnippet(t.prompt_snippet)}>
                  <Copy className="w-3.5 h-3.5 mr-2" /> Copy snippet
                </Button>
              </div>
            ))}
            {suggestions.keep_doing?.length > 0 && (
              <div className="rounded-lg border p-3">
                <div className="text-sm font-medium mb-1">Keep doing</div>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {suggestions.keep_doing.map((k, i) => (
                    <li key={i} className="break-words">
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <CopilotPromptEditsCard />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <MessageSquare className="w-5 h-5 flex-shrink-0" /> AI CoPilot Conversations
              </CardTitle>
              <CardDescription>
                Browse transcripts, then rate answers to tune the CoPilot prompt.
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    `copilot-chats-${new Date().toISOString().slice(0, 10)}.csv`,
                    buildChatsCsv(messages, ratings),
                  )
                }
                disabled={messages.length === 0}
              >
                <Download className="w-4 h-4 mr-2" /> Export chats
              </Button>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Conversation list: hidden on mobile once a thread is open */}
            <div className={`md:col-span-1 min-w-0 space-y-2 ${selectedEmail ? "hidden md:block" : ""}`}>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search by email or message"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <ScrollArea className="h-[420px] md:h-[600px] border rounded-md">
                <div className="divide-y">
                  {conversations.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">No conversations yet.</div>
                  )}
                  {conversations.map((c) => (
                    <button
                      key={c.email}
                      onClick={() => setSelectedEmail(c.email)}
                      className={`w-full text-left p-3 hover:bg-muted/50 transition-colors ${
                        selectedEmail === c.email ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate min-w-0">{c.email}</span>
                        <Badge variant="secondary" className="flex-shrink-0">
                          {c.messageCount}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        {c.lastMessagePreview}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(c.lastMessageAt).toLocaleString()}
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className={`md:col-span-2 min-w-0 ${selectedEmail ? "" : "hidden md:block"}`}>
              {selectedEmail && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden mb-2 -ml-2"
                  onClick={() => setSelectedEmail(null)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> All conversations
                </Button>
              )}
              <ScrollArea className="h-[460px] md:h-[600px] border rounded-md">
                <div className="p-3 sm:p-4">
                  {!selectedEmail && (
                    <div className="text-sm text-muted-foreground text-center mt-20">
                      Select a conversation to view its transcript.
                    </div>
                  )}
                  {selectedEmail && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b">
                        <div className="text-sm font-medium break-all min-w-0">{selectedEmail}</div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            downloadCsv(
                              `copilot-chat-${selectedEmail}.csv`,
                              buildChatsCsv(conversationMessages, ratings),
                            )
                          }
                        >
                          <Download className="w-4 h-4 mr-2" /> Export chat
                        </Button>
                      </div>
                      {conversationMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`min-w-0 p-3 rounded-lg text-sm ${
                            m.role === "user"
                              ? "bg-primary/10 ml-3 sm:ml-8"
                              : m.role === "assistant"
                              ? "bg-muted mr-3 sm:mr-8"
                              : "bg-yellow-500/10"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {m.role}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(m.created_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm break-words [overflow-wrap:anywhere] [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_img]:max-w-full [&_a]:break-all">
                            {renderMessageContent(m.content, { attachments: m.attachments })}
                          </div>
                          {Array.isArray(m.actions) && m.actions.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                              <strong>Actions:</strong>
                              <pre className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-xs mt-1">
                                {JSON.stringify(m.actions, null, 2)}
                              </pre>
                            </div>
                          )}
                          {m.role === "assistant" && (
                            <div className="mt-2 flex items-center gap-2 border-t pt-2">
                              <Button
                                variant={ratings[m.id] === "up" ? "default" : "outline"}
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => rateUp(m)}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant={ratings[m.id] === "down" ? "destructive" : "outline"}
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => openDownDraft(m)}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </Button>
                              {ratings[m.id] === "down" && (
                                <span className="text-xs text-muted-foreground">Correction saved</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
              {selectedEmail && (
                <div className="mt-3">
                  <ChatAttachmentPreview
                    value={attachment}
                    onRemove={() => setAttachment(null)}
                    disabled={sending}
                  />
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                    <Textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={`Reply to ${selectedEmail}...`}
                      className="min-h-[60px] flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendReply();
                        }
                      }}
                    />
                    <div className="flex gap-2">
                      <ChatAttachButton value={attachment} onChange={setAttachment} disabled={sending} />
                      <Button
                        onClick={sendReply}
                        disabled={(!reply.trim() && !attachment) || sending}
                        className="flex-1 sm:flex-none sm:h-[60px]"
                      >
                        <Send className="w-4 h-4 mr-2" /> Send
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thumbs-down correction dialog */}
      <Dialog
        open={!!draft}
        onOpenChange={(o) => {
          if (!o) setDraft(null);
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>What should the CoPilot have said?</DialogTitle>
            <DialogDescription>
              Your correction is stored with this message and feeds the prompt suggestions.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">User asked</Label>
                <Textarea
                  value={draft.question}
                  onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                  className="min-h-[70px] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CoPilot answered (bad)</Label>
                <Textarea
                  value={draft.answer}
                  readOnly
                  className="min-h-[80px] text-sm bg-muted"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Correct answer</Label>
                <Textarea
                  value={draft.corrected}
                  onChange={(e) => setDraft({ ...draft, corrected: e.target.value })}
                  placeholder="Write the reply the CoPilot should have given..."
                  className="min-h-[110px] text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes for prompt tuning (optional)</Label>
                <Textarea
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="e.g. it must never promise refunds"
                  className="min-h-[60px] text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground break-all">Source: {draft.ownerEmail}</p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDraft(null)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              onClick={saveDownRating}
              disabled={savingRating || !draft?.corrected.trim()}
              className="w-full sm:w-auto"
            >
              {savingRating ? "Saving..." : "Save correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
