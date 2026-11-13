import { useEffect, useMemo, useRef, useState } from "react";
import OpenTicketFromChatDialog from "@/components/support/OpenTicketFromChatDialog";
import TicketRepliesThread from "@/components/support/TicketRepliesThread";
import { SupportChatViewport } from "@/components/support/SupportChatViewport";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useUiSounds } from "@/hooks/useUiSounds";
import { renderMessageContent } from "@/lib/renderChatContent";
import {
  MessageSquare,
  AlertCircle,
  Bot,
  User,
  Send,
  ArrowLeft,
  Clock,
  RefreshCw,
  Inbox,
  CheckCheck,
  XCircle,
  Ticket as TicketIcon,
  Mail,
  Sparkles,
  Play,
  SkipForward,
  Check,
  ThumbsUp,
  ThumbsDown,
  ListChecks,
  BookOpen,
  Trash2,
} from "lucide-react";
import { deleteOwnerMessage } from "@/lib/deleteOwnerMessage";
import {
  TicketAttachmentField,
  type TicketAttachmentValue,
} from "@/components/support/TicketAttachmentField";
import { uploadTicketAttachment } from "@/lib/ticketAttachment";
import {
  ChatAttachButton,
  ChatAttachmentPreview,
  type ChatAttachmentValue,
} from "@/components/support/ChatAttachButton";
import { uploadChatAttachment } from "@/lib/chatAttachment";
import { queueReplyNotification, saveSupportReply } from "@/lib/supportSend";
import { refreshSupportInbox } from "@/lib/refreshSupportInbox";
import {
  INBOX_POLL_MS,
  OPEN_CONVERSATION_POLL_MS,
  applyIncomingChatMessage,
  mergeChatMessages,
  realtimeEventType,
  realtimeRow,
  realtimeStatusNeedsReconnect,
  removeById,
  removeChatMessage,
  rowMatchesThread,
  upsertById,
  bindAdminSupportRealtime,
} from "@/lib/adminSupportRealtime";
import CreditWalletsWidget from "@/components/admin/CreditWalletsWidget";
import OnboardingCallRecorder from "@/components/onboarding/OnboardingCallRecorder";
import BuildRequestsWidget from "@/components/admin/BuildRequestsWidget";
import AgencySupportMessagesPanel from "@/components/admin/AgencySupportMessagesPanel";
import AgencySupportAccountsPanel from "@/components/admin/AgencySupportAccountsPanel";
import AgencyProjectsAdminPanel from "@/components/admin/AgencyProjectsAdminPanel";

const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting_on_customer",
  "responded",
  "completed",
  "closed",
];

interface ChatThread {
  id: string;
  agency_id: string;
  user_identifier: string;
  handover_requested_at: string | null;
  handover_resolved_at: string | null;
  last_user_message_at: string | null;
  last_owner_message_at: string | null;
  last_assistant_message_at: string | null;
  message_count: number;
  updated_at: string;
}

interface ChatMsg {
  id: string;
  content: string;
  role: string;
  created_at: string;
  sender_type?: string;
}

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
  admin_response: string | null;
  responded_at: string | null;
  responded_by: string | null;
  admin_response_attachment_url?: string | null;
  attachment_url?: string | null;
}

type Bucket = "needs_response" | "waiting" | "ai_support" | "tickets";

const PAGE_SIZE = 1000;

const classifyThread = (t: ChatThread): Bucket => {
  const handoverOpen = !!t.handover_requested_at && !t.handover_resolved_at;
  const userAfterOwner =
    t.last_user_message_at &&
    (!t.last_owner_message_at ||
      new Date(t.last_user_message_at) > new Date(t.last_owner_message_at));

  // Needs response only when the user's latest message is newer than our
  // latest owner reply (or we've never replied). Otherwise the ball is in
  // the customer's court → waiting.
  if (handoverOpen && userAfterOwner) return "needs_response";
  if (handoverOpen) return "waiting";
  return "ai_support";
};

const formatTime = (dateString: string | null) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

// Attachment and ticket operations still need a UI deadline. Chat message
// database writes use a real AbortController in saveSupportReply instead.
const withSendTimeout = <T,>(work: Promise<T>, ms = 20000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Sending timed out — check your connection and try again")),
      ms,
    );
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });

const AdminSupport = () => {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [aiSupportPage, setAiSupportPage] = useState(0);
  const [aiSupportLoaded, setAiSupportLoaded] = useState(false);
  const [, setOpenTicketsCount] = useState(0);
  // Agencies that handle their own support (human_chat_mode !== "managed") stay out of our inbox.
  // Owners on platform_support_excluded_agencies are hidden from this platform inbox by RLS, including when their mode is managed.
  const [selfHandledIds, setSelfHandledIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    (async () => {
      const ids = new Set<string>();
      const managed = new Set<string>();
      const cols =
        "human_chat_mode, agency_id, agency_id_basic, agency_id_advanced, agency_id_elite";
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("saas_suite_users")
          .select(cols as any)
          .range(from, from + 999);
        if (error) {
          console.error(error);
          return;
        }
        (data || []).forEach((u: any) => {
          const target = u.human_chat_mode === "managed" ? managed : ids;
          [u.agency_id, u.agency_id_basic, u.agency_id_advanced, u.agency_id_elite]
            .filter(Boolean)
            .forEach((id: string) => target.add(String(id).toLowerCase()));
        });
        if (!data || data.length < 1000) break;
      }
      managed.forEach((id) => ids.delete(id));
      setSelfHandledIds(ids);
    })();
  }, []);
  const isOurs = (agencyId: string | null | undefined) =>
    !selfHandledIds ||
    !selfHandledIds.has(
      String(agencyId || "")
        .replace(/NO$/i, "")
        .toLowerCase(),
    );
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoaded, setTicketsLoaded] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketResponse, setTicketResponse] = useState("");
  const [isRespondingToTicket, setIsRespondingToTicket] = useState(false);
  const [ticketAttachment, setTicketAttachment] = useState<TicketAttachmentValue | null>(null);
  const [chatAttachment, setChatAttachment] = useState<ChatAttachmentValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ChatThread | null>(null);
  const selectedRef = useRef<ChatThread | null>(null);
  selectedRef.current = selected;
  const selectedTicketRef = useRef<SupportTicket | null>(null);
  selectedTicketRef.current = selectedTicket;
  const [liveTicketReply, setLiveTicketReply] = useState<Record<string, unknown> | null>(null);
  const [chatTicketOpen, setChatTicketOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  const { playReceive } = useUiSounds();
  const seenIncomingRef = useRef<Set<string>>(new Set());
  const messageRefreshTimerRef = useRef<number | null>(null);
  const inboxRefreshTimerRef = useRef<number | null>(null);
  const loadMessagesRef = useRef<(thread: ChatThread, quiet?: boolean) => void>(() => {});
  const refreshInboxRef = useRef<() => void>(() => {});
  const tokenRef = useRef<string | null>(null);
  const playReceiveRef = useRef<() => void>(() => {});
  playReceiveRef.current = playReceive;
  const supportModeThreadRef = useRef<ChatThread | null>(null);
  const supportModeApplyRef = useRef<
    | ((table: "ai_chat_messages" | "agency_owner_messages", row: Record<string, unknown>) => void)
    | null
  >(null);
  const applyLiveRowRef = useRef<
    (
      table:
        | "ai_chat_messages"
        | "agency_owner_messages"
        | "chat_threads"
        | "support_tickets"
        | "support_ticket_replies",
      payload: {
        eventType?: string;
        event?: string;
        new?: Record<string, unknown> | null;
        old?: Record<string, unknown> | null;
      },
    ) => void
  >(() => {});
  const pendingReplyRef = useRef<{ key: string; id: string } | null>(null);
  // Support Mode
  const [supportModeOpen, setSupportModeOpen] = useState(false);
  const [supportQueue, setSupportQueue] = useState<
    Array<{ kind: "thread"; data: ChatThread } | { kind: "ticket"; data: SupportTicket }>
  >([]);
  const [supportIndex, setSupportIndex] = useState(0);

  // ---------- AI review / KB ----------
  const [adminEmail, setAdminEmail] = useState<string>("");
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [kbDraft, setKbDraft] = useState<{
    messageId: string;
    agencyId: string;
    userIdentifier: string;
    question: string;
    answer: string;
    notes: string;
  } | null>(null);
  const [savingKb, setSavingKb] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSort, setReviewSort] = useState<"recent" | "frustrated" | "volume">("recent");
  const [reviewRows, setReviewRows] = useState<
    Array<ChatThread & { frustration: number; frustrationHits: string[] }>
  >([]);

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => setAdminEmail(data.user?.email?.toLowerCase() || ""));
  }, []);

  const loadRatings = async (t: ChatThread) => {
    const { data } = await supabase
      .from("ai_support_message_ratings")
      .select("message_id, rating")
      .eq("agency_id", t.agency_id)
      .ilike("user_identifier", t.user_identifier);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => {
      map[r.message_id] = r.rating;
    });
    setRatings(map);
  };

  const handleDeleteOwnerMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message? The customer will no longer see it.")) return;
    const prev = messages;
    setMessages((ms) => ms.filter((m) => m.id !== messageId));
    try {
      await deleteOwnerMessage(messageId);
      toast.success("Message deleted");
    } catch (err: any) {
      setMessages(prev);
      toast.error(err?.message || "Failed to delete message");
    }
  };

  const rateMessage = async (m: ChatMsg, rating: "up" | "down") => {
    if (!selected) return;
    if (rating === "down") {
      const idx = messages.findIndex((x) => x.id === m.id);
      const prevUser = [...messages.slice(0, Math.max(idx, 0))]
        .reverse()
        .find((x) => x.role === "user");
      setKbDraft({
        messageId: m.id,
        agencyId: selected.agency_id,
        userIdentifier: selected.user_identifier,
        question: prevUser?.content || "",
        answer: m.content || "",
        notes: "",
      });
      return;
    }
    setRatings((prev) => ({ ...prev, [m.id]: "up" }));
    const { error } = await supabase.from("ai_support_message_ratings").upsert(
      {
        message_id: m.id,
        agency_id: selected.agency_id,
        user_identifier: selected.user_identifier,
        rating: "up",
        answer_text: m.content,
        rated_by: adminEmail || null,
      },
      { onConflict: "message_id,rated_by" },
    );
    if (error) {
      console.error(error);
      toast.error("Failed to save rating");
      setRatings((prev) => {
        const next = { ...prev };
        delete next[m.id];
        return next;
      });
      return;
    }
    toast.success("Marked as a good answer");
  };

  const saveKbEntry = async () => {
    if (!kbDraft || !kbDraft.question.trim() || !kbDraft.answer.trim()) return;
    setSavingKb(true);
    try {
      const { data: kb, error } = await supabase
        .from("ai_support_kb")
        .insert({
          question: kbDraft.question.trim(),
          answer: kbDraft.answer.trim(),
          notes: kbDraft.notes.trim() || null,
          source_agency_id: kbDraft.agencyId,
          source_user_identifier: kbDraft.userIdentifier,
          source_message_id: kbDraft.messageId,
          created_by: adminEmail || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: rErr } = await supabase.from("ai_support_message_ratings").upsert(
        {
          message_id: kbDraft.messageId,
          agency_id: kbDraft.agencyId,
          user_identifier: kbDraft.userIdentifier,
          rating: "down",
          question_text: kbDraft.question.trim(),
          answer_text: kbDraft.answer.trim(),
          kb_entry_id: kb.id,
          rated_by: adminEmail || null,
        },
        { onConflict: "message_id,rated_by" },
      );
      if (rErr) throw rErr;
      setRatings((prev) => ({ ...prev, [kbDraft.messageId]: "down" }));
      toast.success("Saved to the platform AI knowledge base");
      setKbDraft(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to save KB entry");
    } finally {
      setSavingKb(false);
    }
  };

  const FRUSTRATION_TERMS = [
    "not working",
    "doesn't work",
    "does not work",
    "broken",
    "still not",
    "useless",
    "frustrat",
    "angry",
    "terrible",
    "wtf",
    "stupid",
    "cancel",
    "refund",
    "no one",
    "nobody",
    "human",
    "real person",
    "speak to someone",
    "help me",
    "urgent",
    "asap",
    "again",
    "wrong",
    "!!!",
  ];

  const beginReviewing = async () => {
    setReviewOpen(true);
    setReviewLoading(true);
    try {
      const { data: threadRows, error } = await supabase
        .from("chat_threads")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const list = (threadRows || []) as ChatThread[];

      const { data: msgRows } = await supabase
        .from("ai_chat_messages")
        .select("agency_id, user_identifier, content, role, created_at")
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(4000);

      const scores = new Map<string, { score: number; hits: Set<string> }>();
      (msgRows || []).forEach((m: any) => {
        const key = `${String(m.agency_id).toLowerCase()}|${String(m.user_identifier || "").toLowerCase()}`;
        const text = String(m.content || "").toLowerCase();
        const entry = scores.get(key) || { score: 0, hits: new Set<string>() };
        FRUSTRATION_TERMS.forEach((term) => {
          if (text.includes(term)) {
            entry.score += 1;
            entry.hits.add(term);
          }
        });
        scores.set(key, entry);
      });

      const enriched = list.map((t) => {
        const key = `${t.agency_id.toLowerCase()}|${t.user_identifier.toLowerCase()}`;
        const s = scores.get(key);
        const handoverBoost = t.handover_requested_at ? 3 : 0;
        return {
          ...t,
          frustration: (s?.score || 0) + handoverBoost,
          frustrationHits: Array.from(s?.hits || []),
        };
      });
      setReviewRows(enriched);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to load AI chats for review");
    } finally {
      setReviewLoading(false);
    }
  };

  const sortedReviewRows = useMemo(() => {
    const rows = [...reviewRows];
    if (reviewSort === "frustrated")
      rows.sort((a, b) => b.frustration - a.frustration || b.message_count - a.message_count);
    else if (reviewSort === "volume")
      rows.sort(
        (a, b) =>
          (b.message_count || 0) - (a.message_count || 0) ||
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
    else
      rows.sort(
        (a, b) =>
          new Date(b.last_user_message_at || b.updated_at).getTime() -
          new Date(a.last_user_message_at || a.updated_at).getTime(),
      );
    return rows;
  }, [reviewRows, reviewSort]);

  const fetchThreads = async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [needsRes, waitingRes, ticketsRes] = await Promise.all([
        // Needs response: handover open OR user replied after owner
        supabase
          .from("chat_threads")
          .select("*")
          .not("handover_requested_at", "is", null)
          .order("last_user_message_at", { ascending: false, nullsFirst: false }),
        // Waiting & failures bucket: same query covers both; classify client-side
        supabase
          .from("chat_threads")
          .select("id")
          .not("handover_requested_at", "is", null)
          .is("handover_resolved_at", null)
          .lt("handover_requested_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from("support_tickets")
          .select("id", { count: "exact", head: true })
          .eq("status", "open"),
      ]);
      if (needsRes.error) throw needsRes.error;
      setThreads((prev) => {
        const existing = new Map(prev.map((t) => [t.id, t]));
        (needsRes.data || []).forEach((t) => existing.set(t.id, t as ChatThread));
        return Array.from(existing.values());
      });
      setOpenTicketsCount(ticketsRes.count ?? 0);
    } catch (err) {
      console.error(err);
      if (!quiet) toast.error("Failed to load support threads");
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const loadAiSupport = async (page: number, quiet = false) => {
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from("chat_threads")
        .select("*")
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      setThreads((prev) => {
        const existing = new Map(prev.map((t) => [t.id, t]));
        (data || []).forEach((t) => existing.set(t.id, t as ChatThread));
        return Array.from(existing.values());
      });
      setAiSupportPage(page);
      setAiSupportLoaded(true);
    } catch (err) {
      console.error(err);
      if (!quiet) toast.error("Failed to load AI conversations");
    }
  };

  // Load everything once the sign-in session is restored. On a freshly reopened
  // tab the queries used to fire before the session was ready and came back empty.
  useEffect(() => {
    const reloadAll = (quiet: boolean) => {
      void fetchThreads(quiet);
      void loadAiSupport(0, quiet);
      void loadTickets(quiet);
      const open = selectedRef.current;
      if (open) void loadMessagesRef.current(open, true);
    };
    let lastToken: string | null = null;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const token = session?.access_token ?? null;
      tokenRef.current = token;
      if (!token || token === lastToken) return;
      const firstLoad = lastToken === null;
      lastToken = token;
      if (firstLoad || event === "SIGNED_IN") setTimeout(() => reloadAll(false), 0);
    });
    // Catch up after the tab was hidden/asleep (realtime events may have been missed).
    const onVisible = () => {
      if (document.visibilityState === "visible" && lastToken) reloadAll(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTickets = async (quiet = false) => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
      setTicketsLoaded(true);
    } catch (err) {
      console.error(err);
      if (!quiet) toast.error("Failed to load tickets");
    }
  };

  const refreshInbox = (quiet = false) =>
    refreshSupportInbox(
      () => fetchThreads(quiet),
      () => loadTickets(quiet),
    );
  refreshInboxRef.current = () => {
    void refreshInbox(true);
  };

  const handleRespondToTicket = async () => {
    if (!selectedTicket || !ticketResponse.trim()) return;
    setIsRespondingToTicket(true);
    try {
      let attachment_url: string | null = null;
      if (ticketAttachment) {
        attachment_url = await withSendTimeout(
          uploadTicketAttachment(selectedTicket.id, ticketAttachment.file),
        );
      }
      const { error } = await withSendTimeout(
        supabase.functions.invoke("respond-to-ticket", {
          body: {
            ticket_id: selectedTicket.id,
            response_text: ticketResponse.trim(),
            attachment_url,
          },
        }),
        30000,
      );
      if (error) throw error;
      toast.success("Response sent — the customer will be emailed shortly.");
      const respondedId = selectedTicket.id;
      const respondedText = ticketResponse.trim();
      setTickets(
        (ts) =>
          ts.map((t) =>
            t.id === respondedId
              ? {
                  ...t,
                  admin_response: respondedText,
                  admin_response_attachment_url: attachment_url,
                  responded_at: new Date().toISOString(),
                  status: "responded",
                }
              : t,
          ) as SupportTicket[],
      );
      setSelectedTicket(null);
      setTicketResponse("");
      setTicketAttachment(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to send response");
    } finally {
      setIsRespondingToTicket(false);
    }
  };

  const buckets = useMemo(() => {
    const out: Record<Bucket, ChatThread[]> = {
      needs_response: [],
      waiting: [],
      ai_support: [],
      tickets: [],
    };
    threads.forEach((t) => {
      if (!isOurs(t.agency_id)) return;
      out[classifyThread(t)].push(t);
    });
    const filterFn = (t: ChatThread) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.user_identifier.toLowerCase().includes(q) || t.agency_id.toLowerCase().includes(q);
    };
    out.needs_response = out.needs_response
      .filter(filterFn)
      .sort(
        (a, b) =>
          new Date(b.last_user_message_at || b.handover_requested_at || b.updated_at).getTime() -
          new Date(a.last_user_message_at || a.handover_requested_at || a.updated_at).getTime(),
      );
    out.waiting = out.waiting
      .filter(filterFn)
      .sort(
        (a, b) =>
          new Date(b.last_owner_message_at || b.updated_at).getTime() -
          new Date(a.last_owner_message_at || a.updated_at).getTime(),
      );
    out.ai_support = out.ai_support
      .filter(filterFn)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, search, selfHandledIds]);

  const allAiConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    return threads
      .filter((t) => {
        if (!isOurs(t.agency_id)) return false;
        if (!q) return true;
        return t.user_identifier.toLowerCase().includes(q) || t.agency_id.toLowerCase().includes(q);
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threads, search, selfHandledIds]);

  // Tickets: open/in-progress first, then newest. Searchable across number,
  // name, email, agency id, category and the request body.
  const visibleTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rank = (status: string) => {
      const s = (status || "").toLowerCase();
      if (s === "open") return 0;
      if (s === "in_progress") return 1;
      if (s === "waiting_on_customer") return 2;
      if (s === "responded") return 3;
      return 4;
    };
    return tickets
      .filter((t) => {
        if (!isOurs(t.agency_id)) return false;
        if (!q) return true;
        return [
          String(t.ticket_number),
          `#${t.ticket_number}`,
          t.customer_name,
          t.customer_email,
          t.agency_id,
          t.issue_category,
          t.request_text,
          t.status,
        ]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q));
      })
      .sort(
        (a, b) =>
          rank(a.status) - rank(b.status) ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets, search, selfHandledIds]);

  const OPEN_STATUSES = ["open", "in_progress", "waiting_on_customer"];
  const openTickets = useMemo(
    () => visibleTickets.filter((t) => OPEN_STATUSES.includes((t.status || "").toLowerCase())),
    [visibleTickets],
  );
  const closedTickets = useMemo(
    () => visibleTickets.filter((t) => !OPEN_STATUSES.includes((t.status || "").toLowerCase())),
    [visibleTickets],
  );

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    const prev = tickets.find((t) => t.id === ticketId)?.status;
    setTickets((list) => list.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)));
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: newStatus })
      .eq("id", ticketId);
    if (error) {
      console.error(error);
      toast.error("Failed to update ticket status");
      if (prev)
        setTickets((list) => list.map((t) => (t.id === ticketId ? { ...t, status: prev } : t)));
      return;
    }
    setSelectedTicket((s) => (s && s.id === ticketId ? { ...s, status: newStatus } : s));
    toast.success(`Ticket set to ${newStatus.replace("_", " ")}`);
  };

  const stats = useMemo(() => {
    const needsResponse = buckets.needs_response.length;
    const aiChats = allAiConversations.length;
    const failures = threads.filter((t) => {
      if (!t.handover_requested_at || t.handover_resolved_at) return false;
      return Date.now() - new Date(t.handover_requested_at).getTime() > 24 * 60 * 60 * 1000;
    }).length;
    return { needsResponse, aiChats, failures };
  }, [allAiConversations.length, buckets, threads]);

  const buildSupportQueue = async () => {
    const [threadsRes, ticketsRes] = await Promise.all([
      supabase
        .from("chat_threads")
        .select("*")
        .not("handover_requested_at", "is", null)
        .is("handover_resolved_at", null)
        .order("handover_requested_at", { ascending: true }),
      supabase
        .from("support_tickets")
        .select("*")
        .eq("status", "open")
        .is("admin_response", null)
        .order("created_at", { ascending: true }),
    ]);
    const rawThreads = (threadsRes.data || []) as ChatThread[];
    const needsResponse: ChatThread[] = [];
    const stale: ChatThread[] = [];
    rawThreads.forEach((t) => {
      const userAfterOwner =
        t.last_user_message_at &&
        (!t.last_owner_message_at ||
          new Date(t.last_user_message_at) > new Date(t.last_owner_message_at));
      if (userAfterOwner) needsResponse.push(t);
      else if (
        t.handover_requested_at &&
        Date.now() - new Date(t.handover_requested_at).getTime() > 24 * 60 * 60 * 1000
      )
        stale.push(t);
    });
    const items: typeof supportQueue = [
      ...needsResponse.map((t) => ({ kind: "thread" as const, data: t })),
      ...stale.map((t) => ({ kind: "thread" as const, data: t })),
      ...((ticketsRes.data || []) as SupportTicket[]).map((t) => ({
        kind: "ticket" as const,
        data: t,
      })),
    ];
    return items;
  };

  const launchSupportMode = async () => {
    const q = await buildSupportQueue();
    setSupportQueue(q);
    setSupportIndex(0);
    setSupportModeOpen(true);
    if (q.length === 0) {
      toast.success("You're all caught up — nothing needs attention.");
    }
  };

  const refreshSupportQueue = async () => {
    const q = await buildSupportQueue();
    setSupportQueue(q);
    setSupportIndex(0);
  };

  const supportAdvance = () => {
    setSupportIndex((i) => Math.min(i + 1, supportQueue.length));
  };

  const currentSupportItem = supportQueue[supportIndex];

  // Load messages in pages of 10 (newest first) so big chats stay fast.
  const MSG_PAGE = 10;

  const fetchMessagePage = async (t: ChatThread, before?: string) => {
    const buildQuery = (table: "ai_chat_messages" | "agency_owner_messages", cols: string) => {
      let q = (supabase.from(table) as any)
        .select(cols)
        .eq("agency_id", t.agency_id)
        .ilike("user_identifier", t.user_identifier)
        .order("created_at", { ascending: false })
        .limit(MSG_PAGE);
      if (before) q = q.lt("created_at", before);
      return q;
    };
    const [aiRes, ownerRes] = await Promise.all([
      buildQuery("ai_chat_messages", "id, content, role, created_at"),
      buildQuery("agency_owner_messages", "id, content, created_at, sender_type"),
    ]);
    if (aiRes.error) throw aiRes.error;
    if (ownerRes.error) throw ownerRes.error;
    const merged: ChatMsg[] = [
      ...(aiRes.data || []).map((m: any) => ({ ...m, sender_type: m.role })),
      ...(ownerRes.data || []).map((m: any) => ({ ...m, role: "agency_owner" })),
    ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return {
      page: merged.slice(-MSG_PAGE),
      exhausted: (aiRes.data?.length || 0) < MSG_PAGE && (ownerRes.data?.length || 0) < MSG_PAGE,
    };
  };

  const threadKey = (t: ChatThread | null) =>
    t ? `${t.agency_id.toLowerCase()}|${t.user_identifier.toLowerCase()}` : "";
  const openThreadKeyRef = useRef("");
  openThreadKeyRef.current = threadKey(selected);

  const loadMessages = async (t: ChatThread, quiet = false) => {
    try {
      const { page, exhausted } = await fetchMessagePage(t);
      // Drop results that arrive after the admin switched to another chat.
      if (openThreadKeyRef.current !== threadKey(t)) return;
      setMessages((prev) => mergeChatMessages(prev, page));
      if (!quiet) setHasMoreMessages(!exhausted);
    } catch (err) {
      console.error(err);
      if (!quiet) toast.error("Failed to load messages");
    }
  };
  loadMessagesRef.current = loadMessages;

  const loadOlderMessages = async () => {
    if (!selected || loadingOlder || !hasMoreMessages || messages.length === 0) return;
    setLoadingOlder(true);
    const viewport = viewportRef.current;
    const prevHeight = viewport?.scrollHeight || 0;
    const prevTop = viewport?.scrollTop || 0;
    try {
      const { page, exhausted } = await fetchMessagePage(selected, messages[0].created_at);
      if (openThreadKeyRef.current !== threadKey(selected)) return;
      setMessages((prev) => mergeChatMessages(prev, page));
      setHasMoreMessages(!exhausted);
      // Keep the scroll position steady so the prepended messages don't jump.
      requestAnimationFrame(() => {
        if (viewport) viewport.scrollTop = prevTop + (viewport.scrollHeight - prevHeight);
      });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load earlier messages");
    } finally {
      setLoadingOlder(false);
    }
  };

  const scheduleMessageRefresh = (thread: ChatThread) => {
    if (messageRefreshTimerRef.current !== null)
      window.clearTimeout(messageRefreshTimerRef.current);
    messageRefreshTimerRef.current = window.setTimeout(() => {
      messageRefreshTimerRef.current = null;
      void loadMessages(thread, true);
    }, 250);
  };

  const scheduleInboxRefresh = () => {
    if (inboxRefreshTimerRef.current !== null) window.clearTimeout(inboxRefreshTimerRef.current);
    inboxRefreshTimerRef.current = window.setTimeout(() => {
      inboxRefreshTimerRef.current = null;
      void refreshInbox(true);
    }, 400);
  };

  useEffect(() => {
    if (selected) {
      setMessages([]);
      setHasMoreMessages(false);
      lastMessageIdRef.current = null;
      loadMessages(selected);
      loadRatings(selected);
    }
  }, [selected]);

  const applyLiveRow = (
    table:
      | "ai_chat_messages"
      | "agency_owner_messages"
      | "chat_threads"
      | "support_tickets"
      | "support_ticket_replies",
    payload: {
      eventType?: string;
      event?: string;
      new?: Record<string, unknown> | null;
      old?: Record<string, unknown> | null;
    },
  ) => {
    const eventType = realtimeEventType(payload);
    const row = realtimeRow(payload);
    if (!row) return;
    if (table === "ai_chat_messages" || table === "agency_owner_messages") {
      if (
        table === "ai_chat_messages" &&
        eventType === "INSERT" &&
        row.role === "user" &&
        row.id &&
        !seenIncomingRef.current.has(String(row.id))
      ) {
        seenIncomingRef.current.add(String(row.id));
        playReceiveRef.current();
      }
      const open = selectedRef.current;
      if (eventType === "DELETE") {
        if (open) setMessages((prev) => removeChatMessage(prev, row, open));
      } else if (open && rowMatchesThread(row, open)) {
        setMessages((prev) => applyIncomingChatMessage(prev, table, row, open));
        scheduleMessageRefresh(open);
      }
      const modeThread = supportModeThreadRef.current;
      if (modeThread && eventType !== "DELETE" && rowMatchesThread(row, modeThread)) {
        supportModeApplyRef.current?.(table, row);
      }
      if (eventType === "INSERT") scheduleInboxRefresh();
      return;
    }
    if (table === "chat_threads") {
      const id = String(row.id || "");
      if (!id) return;
      if (eventType === "DELETE") setThreads((prev) => removeById(prev, id));
      else setThreads((prev) => upsertById(prev, { ...(row as unknown as ChatThread), id }));
      const open = selectedRef.current;
      if (open && open.id === id && eventType !== "DELETE") scheduleMessageRefresh(open);
      scheduleInboxRefresh();
      return;
    }
    if (table === "support_tickets") {
      const id = String(row.id || "");
      if (!id) return;
      if (eventType === "DELETE") {
        setTickets((prev) => removeById(prev, id));
        setSelectedTicket((prev) => (prev?.id === id ? null : prev));
      } else {
        setTickets((prev) => upsertById(prev, { ...(row as unknown as SupportTicket), id }));
        setSelectedTicket((prev) =>
          prev && prev.id === id ? { ...prev, ...(row as unknown as SupportTicket), id } : prev,
        );
      }
      scheduleInboxRefresh();
      return;
    }
    if (row.id) {
      setLiveTicketReply(row);
      scheduleInboxRefresh();
    }
  };
  applyLiveRowRef.current = applyLiveRow;

  // One channel for the whole visit. Opening a conversation must not tear it down.
  useEffect(() => {
    let bound: { unsubscribe: () => void } | null = null;
    const ensure = () => {
      const token = tokenRef.current;
      if (!token) return;
      if (bound) {
        void supabase.realtime.setAuth(token);
        return;
      }
      bound = bindAdminSupportRealtime(supabase, {
        getAccessToken: () => tokenRef.current || "",
        onPayload: (table, payload) => applyLiveRowRef.current(table, payload),
        onStatus: (status) => {
          if (!realtimeStatusNeedsReconnect(status)) return;
          if (document.visibilityState !== "visible") return;
          refreshInboxRef.current();
          const open = selectedRef.current;
          if (open) void loadMessagesRef.current(open, true);
        },
      });
    };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token ?? null;
      if (!tokenRef.current) {
        bound?.unsubscribe();
        bound = null;
        return;
      }
      ensure();
    });
    void supabase.auth.getSession().then(({ data }) => {
      tokenRef.current = data.session?.access_token ?? tokenRef.current;
      ensure();
    });
    const openTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const open = selectedRef.current;
      if (open) void loadMessagesRef.current(open, true);
    }, OPEN_CONVERSATION_POLL_MS);
    const inboxTimer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      refreshInboxRef.current();
    }, INBOX_POLL_MS);
    return () => {
      window.clearInterval(openTimer);
      window.clearInterval(inboxTimer);
      if (messageRefreshTimerRef.current !== null)
        window.clearTimeout(messageRefreshTimerRef.current);
      if (inboxRefreshTimerRef.current !== null) window.clearTimeout(inboxRefreshTimerRef.current);
      bound?.unsubscribe();
      sub.subscription.unsubscribe();
    };
    // The handlers read refs so the socket stays up while the open chat changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll only when a new message arrives at the bottom — not when
  // older messages are prepended at the top.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = last.id;
      const viewport = viewportRef.current;
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if ((!newMessage.trim() && !chatAttachment) || !selected) return;
    setIsSending(true);
    try {
      let body = newMessage.trim();
      if (chatAttachment) {
        const url = await withSendTimeout(
          uploadChatAttachment(
            `${selected.agency_id}-${selected.user_identifier}`,
            chatAttachment.file,
          ),
        );
        body = body ? `${body}\n${url}` : url;
      }
      const sendKey = `${selected.agency_id}|${selected.user_identifier.toLowerCase()}|${body}`;
      const messageId =
        pendingReplyRef.current?.key === sendKey ? pendingReplyRef.current.id : crypto.randomUUID();
      pendingReplyRef.current = { key: sendKey, id: messageId };
      await saveSupportReply({
        id: messageId,
        agencyId: selected.agency_id,
        userIdentifier: selected.user_identifier,
        content: body,
      });
      pendingReplyRef.current = null;
      queueReplyNotification({
        agencyId: selected.agency_id,
        userIdentifier: selected.user_identifier,
        content: body,
      });
      setMessages((prev) =>
        prev.some((message) => message.id === messageId)
          ? prev
          : [
              ...prev,
              {
                id: messageId,
                content: body,
                role: "agency_owner",
                sender_type: "agency_owner",
                created_at: new Date().toISOString(),
              },
            ],
      );
      setNewMessage("");
      setChatAttachment(null);
      toast.success("Reply sent");
      // refresh thread state
      scheduleInboxRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // ---------- Conversation Panel (right side) ----------
  const conversationPanel = selected ? (
    <Card className="flex flex-col h-[75dvh] min-h-0 min-w-0 overflow-hidden">
      <CardHeader className="shrink-0 border-b p-3 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg truncate">{selected.user_identifier}</CardTitle>
            <p className="text-sm font-bold text-foreground mt-1 [overflow-wrap:anywhere]">
              Agency: {selected.agency_id}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setChatTicketOpen(true)}>
              <TicketIcon className="w-4 h-4 mr-1" /> Create Ticket
            </Button>
            <Badge
              variant={
                selected.handover_requested_at && !selected.handover_resolved_at
                  ? "destructive"
                  : "secondary"
              }
            >
              {selected.handover_requested_at && !selected.handover_resolved_at
                ? "Handover open"
                : selected.handover_requested_at
                  ? "Handover active"
                  : "AI only"}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              <XCircle className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col min-h-0 min-w-0">
        <SupportChatViewport
          ref={viewportRef}
          className="flex-1 p-3 sm:p-4"
          onScroll={(e) => {
            if (e.currentTarget.scrollTop < 40) void loadOlderMessages();
          }}
        >
          <div className="space-y-4">
            {hasMoreMessages && (
              <div className="flex justify-center pb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={loadingOlder}
                  onClick={() => void loadOlderMessages()}
                >
                  {loadingOlder ? "Loading…" : "Load earlier messages"}
                </Button>
              </div>
            )}
            {messages.map((m) => {
              const isUser = m.role === "user";
              const isOwner = m.role === "agency_owner" || m.sender_type === "agency_owner";
              const isAI = m.role === "assistant";
              return (
                <div key={m.id} className={`flex gap-3 min-w-0 ${isOwner ? "justify-end" : ""}`}>
                  {!isOwner && (
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isUser ? "bg-muted" : "bg-cyan-500/10"}`}
                    >
                      {isUser ? (
                        <User className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Bot className="w-4 h-4 text-cyan-500" />
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[calc(100%-2.75rem)] sm:max-w-[70%] min-w-0 ${isOwner ? "text-right" : ""}`}
                  >
                    <div
                      className={`rounded-lg px-3 py-2 text-sm text-left [overflow-wrap:anywhere] ${isOwner ? "bg-primary text-primary-foreground" : isUser ? "bg-muted" : "bg-cyan-500/10 border border-cyan-500/20"}`}
                    >
                      {renderMessageContent(m.content)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 mt-1 justify-end">
                      {isAI && (
                        <>
                          <button
                            type="button"
                            title="Good answer"
                            onClick={() => rateMessage(m, "up")}
                            className={`p-1 rounded hover:bg-muted transition-colors ${ratings[m.id] === "up" ? "text-emerald-600" : "text-muted-foreground"}`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Bad answer — fix and save to KB"
                            onClick={() => rateMessage(m, "down")}
                            className={`p-1 rounded hover:bg-muted transition-colors ${ratings[m.id] === "down" ? "text-rose-600" : "text-muted-foreground"}`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatTime(m.created_at)}
                      </span>
                      {isAI && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 border-cyan-500/50 text-cyan-600"
                        >
                          AI
                        </Badge>
                      )}
                      {isOwner && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          Admin
                        </Badge>
                      )}
                      {isOwner && (
                        <button
                          type="button"
                          title="Delete this message"
                          onClick={() => handleDeleteOwnerMessage(m.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {isOwner && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
              );
            })}
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
            )}
          </div>
        </SupportChatViewport>
        <div className="shrink-0 min-w-0 border-t p-3">
          <ChatAttachmentPreview
            value={chatAttachment}
            onRemove={() => setChatAttachment(null)}
            disabled={isSending}
          />
          <div className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a reply..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <ChatAttachButton
              value={chatAttachment}
              onChange={setChatAttachment}
              disabled={isSending}
            />
            <Button
              onClick={handleSend}
              disabled={isSending || (!newMessage.trim() && !chatAttachment)}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : (
    <Card className="flex flex-col items-center justify-center h-[75vh] text-muted-foreground">
      <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
      <p className="text-sm">Select a conversation to view messages</p>
    </Card>
  );

  // ---------- Dashboard rows ----------
  const renderTicketRow = (t: SupportTicket) => (
    <div
      key={t.id}
      role="button"
      tabIndex={0}
      onClick={() => {
        setSelectedTicket(t);
        setTicketResponse("");
        setTicketAttachment(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          setSelectedTicket(t);
          setTicketResponse("");
          setTicketAttachment(null);
        }
      }}
      className="w-full p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left cursor-pointer"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TicketIcon className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="font-medium text-sm">
              #{t.ticket_number} · {t.issue_category}
            </p>
            <Badge
              variant={
                t.status === "open"
                  ? "destructive"
                  : t.status === "responded"
                    ? "default"
                    : "secondary"
              }
              className="text-[10px] px-1.5 py-0"
            >
              {t.status}
            </Badge>
            <span onClick={(e) => e.stopPropagation()}>
              <Select value={t.status} onValueChange={(v) => updateTicketStatus(t.id, v)}>
                <SelectTrigger className="h-7 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {t.customer_name} · {t.customer_email}
          </p>
          <p className="text-xs font-semibold mt-0.5">Agency: {t.agency_id}</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.request_text}</p>
        </div>
        <div className="text-xs text-muted-foreground flex-shrink-0">
          {formatTime(t.created_at)}
        </div>
      </div>
    </div>
  );

  const renderRow = (t: ChatThread) => (
    <button
      key={t.id}
      onClick={() => setSelected(t)}
      className={`w-full p-4 rounded-lg border transition-colors text-left ${selected?.id === t.id ? "bg-muted border-primary" : "bg-card hover:bg-muted/50"}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{t.user_identifier}</p>
          <p className="font-bold text-sm mt-0.5">Agency: {t.agency_id}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <MessageSquare className="w-3 h-3" />
            <span>{t.message_count} msg</span>
            <span>·</span>
            <Clock className="w-3 h-3" />
            <span>{formatTime(t.last_user_message_at || t.updated_at)}</span>
          </div>
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/admin" className="text-sm text-muted-foreground hover:underline">
                ← Back to admin
              </Link>
              <Link
                to="/admin/setup-tracker"
                className="text-sm text-muted-foreground hover:underline"
              >
                AI Studio Setup Tracker
              </Link>
            </div>
            <h1 className="text-3xl font-bold mt-1">Support Inbox</h1>
            <p className="text-muted-foreground text-sm">
              Support tickets, AI chats, and handovers for all active agencies.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={launchSupportMode}>
              <Play className="w-4 h-4 mr-1" /> Launch Support Mode
            </Button>
            <Button variant="secondary" size="sm" onClick={beginReviewing}>
              <ListChecks className="w-4 h-4 mr-1" /> Begin reviewing
            </Button>

            <Button variant="outline" size="sm" onClick={() => void refreshInbox()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Inbox className="w-6 h-6 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">
                  {
                    tickets.filter(
                      (t) => (t.status || "").toLowerCase() === "open" && isOurs(t.agency_id),
                    ).length
                  }
                </div>
                <p className="text-xs text-muted-foreground">Open support tickets</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <div>
                <div className="text-2xl font-bold">{stats.needsResponse}</div>
                <p className="text-xs text-muted-foreground">Unresponded handovers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <Bot className="w-6 h-6 text-cyan-500" />
              <div>
                <div className="text-2xl font-bold">{stats.aiChats}</div>
                <p className="text-xs text-muted-foreground">AI chats loaded</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-3">
              <XCircle className="w-6 h-6 text-rose-500" />
              <div>
                <div className="text-2xl font-bold">{stats.failures}</div>
                <p className="text-xs text-muted-foreground">Stale (&gt;24h) handovers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Input
          placeholder="Search by email, name, agency id, or ticket #..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6 items-start">
          <div className="space-y-6">
            {/* Open tickets — top priority */}
            <Card className="border-orange-500/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-orange-500" />
                  Open tickets
                  {openTickets.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {openTickets.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!ticketsLoaded ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Loading tickets…</p>
                ) : openTickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No open tickets</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[340px] pr-2">
                    <div className="space-y-2">{openTickets.map(renderTicketRow)}</div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Messages sent to an account rep (agency support) */}
            <AgencySupportMessagesPanel />

            {/* Agency support customers and their sub-accounts */}
            <AgencySupportAccountsPanel compact />

            {/* Agency requests & projects board */}
            <AgencyProjectsAdminPanel />

            {/* Handovers needing a reply */}
            <Card className="border-red-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  Handovers needing response
                  {stats.needsResponse > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {stats.needsResponse}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
                ) : buckets.needs_response.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">All caught up</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-2">{buckets.needs_response.map(renderRow)}</div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Waiting on customer */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Waiting on customer
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {buckets.waiting.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {buckets.waiting.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nothing waiting.</p>
                ) : (
                  <ScrollArea className="h-[260px] pr-2">
                    <div className="space-y-2">{buckets.waiting.map(renderRow)}</div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Everything else in tickets */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TicketIcon className="w-4 h-4 text-muted-foreground" />
                  Answered &amp; closed tickets
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {closedTickets.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {closedTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    {search.trim() ? "No tickets match your search." : "Nothing here yet."}
                  </p>
                ) : (
                  <ScrollArea className="h-[300px] pr-2">
                    <div className="space-y-2">{closedTickets.map(renderTicketRow)}</div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* All AI conversations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-500" />
                  All AI support conversations
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {allAiConversations.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!aiSupportLoaded ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Loading AI conversations…
                  </p>
                ) : allAiConversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    No AI conversations found.
                  </p>
                ) : (
                  <>
                    <ScrollArea className="h-[300px] pr-2">
                      <div className="space-y-2">{allAiConversations.map(renderRow)}</div>
                    </ScrollArea>
                    <div className="flex justify-center pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadAiSupport(aiSupportPage + 1)}
                      >
                        Load more
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {conversationPanel}
            <CreditWalletsWidget />
            <OnboardingCallRecorder title="Onboarding Calls — Record & Consume" />
            <BuildRequestsWidget />
          </div>
        </div>
      </div>

      <Dialog
        open={!!selectedTicket}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedTicket(null);
            setTicketResponse("");
            setTicketAttachment(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TicketIcon className="w-4 h-4" />
                  Ticket #{selectedTicket.ticket_number} — {selectedTicket.issue_category}
                </DialogTitle>
                <DialogDescription>
                  From <span className="font-medium">{selectedTicket.customer_name}</span> (
                  {selectedTicket.customer_email}) · Agency {selectedTicket.agency_id}
                </DialogDescription>
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
                  key={selectedTicket.id}
                  ticketId={selectedTicket.id}
                  latestResponse={selectedTicket.admin_response}
                  latestResponseAt={selectedTicket.responded_at}
                  latestResponseAttachmentUrl={selectedTicket.admin_response_attachment_url}
                  liveReply={liveTicketReply}
                />
                <div>
                  <label className="text-sm font-medium mb-1 block">Your response</label>
                  <Textarea
                    value={ticketResponse}
                    onChange={(e) => setTicketResponse(e.target.value)}
                    placeholder="Write the key points of your response. Our AI will turn this into a friendly email."
                    rows={6}
                  />
                </div>
                <TicketAttachmentField
                  value={ticketAttachment}
                  onChange={setTicketAttachment}
                  disabled={isRespondingToTicket}
                />
                <div className="flex items-start gap-2 rounded-md bg-cyan-500/10 border border-cyan-500/20 p-3 text-xs text-cyan-900 dark:text-cyan-200">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-cyan-600" />
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
                    setTicketAttachment(null);
                  }}
                  disabled={isRespondingToTicket}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRespondToTicket}
                  disabled={isRespondingToTicket || !ticketResponse.trim()}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  {isRespondingToTicket ? "Sending…" : "Send response"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Thumbs-down → edit Q/A → save to platform KB */}
      <Dialog
        open={!!kbDraft}
        onOpenChange={(o) => {
          if (!o) setKbDraft(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Fix this answer & teach the AI
            </DialogTitle>
            <DialogDescription>
              Edit the customer's question and the correct answer. Saving adds it to the
              platform-wide AI support knowledge base used by every agency's AI.
            </DialogDescription>
          </DialogHeader>
          {kbDraft && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Customer question</label>
                <Textarea
                  rows={4}
                  value={kbDraft.question}
                  onChange={(e) => setKbDraft({ ...kbDraft, question: e.target.value })}
                  placeholder="What the customer asked (edit for clarity)"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Correct answer</label>
                <Textarea
                  rows={7}
                  value={kbDraft.answer}
                  onChange={(e) => setKbDraft({ ...kbDraft, answer: e.target.value })}
                  placeholder="The answer the AI should have given"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Internal note (optional)</label>
                <Input
                  value={kbDraft.notes}
                  onChange={(e) => setKbDraft({ ...kbDraft, notes: e.target.value })}
                  placeholder="Why the original answer was wrong"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Source: agency {kbDraft.agencyId} · {kbDraft.userIdentifier}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setKbDraft(null)} disabled={savingKb}>
              Cancel
            </Button>
            <Button
              onClick={saveKbEntry}
              disabled={savingKb || !kbDraft?.question.trim() || !kbDraft?.answer.trim()}
            >
              <Check className="w-4 h-4 mr-1" />{" "}
              {savingKb ? "Saving…" : "Save to AI knowledge base"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selected && (
        <OpenTicketFromChatDialog
          open={chatTicketOpen}
          onOpenChange={setChatTicketOpen}
          agencyId={selected.agency_id}
          userIdentifier={selected.user_identifier}
          messages={messages}
          onCreated={() => {
            void loadTickets();
          }}
        />
      )}
      {/* Begin reviewing — AI chat review queue */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-4 h-4" /> Review AI conversations
            </DialogTitle>
            <DialogDescription>
              Work through AI chats and thumbs up/down the answers. Sort by what you want to audit
              first.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Select value={reviewSort} onValueChange={(v) => setReviewSort(v as any)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Most recent</SelectItem>
                <SelectItem value="frustrated">Most frustrated</SelectItem>
                <SelectItem value="volume">Most volume</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={beginReviewing} disabled={reviewLoading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${reviewLoading ? "animate-spin" : ""}`} /> Reload
            </Button>
            <span className="text-xs text-muted-foreground ml-auto">
              {sortedReviewRows.length} conversations
            </span>
          </div>

          <div className="space-y-2 mt-2">
            {reviewLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading AI chats…</p>
            ) : sortedReviewRows.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No AI conversations found.</p>
            ) : (
              sortedReviewRows.slice(0, 100).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelected(t);
                    setReviewOpen(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.user_identifier}</p>
                      <p className="text-xs font-semibold">Agency: {t.agency_id}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                        <MessageSquare className="w-3 h-3" />
                        <span>{t.message_count} msg</span>
                        <span>·</span>
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(t.last_user_message_at || t.updated_at)}</span>
                        {t.frustrationHits.length > 0 && (
                          <span className="truncate">
                            · “{t.frustrationHits.slice(0, 3).join("”, “")}”
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {t.handover_requested_at && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          Handover
                        </Badge>
                      )}
                      <Badge
                        variant={
                          t.frustration >= 5
                            ? "destructive"
                            : t.frustration >= 2
                              ? "default"
                              : "secondary"
                        }
                        className="text-[10px] px-1.5 py-0"
                      >
                        Frustration {t.frustration}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={supportModeOpen} onOpenChange={setSupportModeOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Support Mode
            </DialogTitle>
            <DialogDescription>
              {supportQueue.length === 0
                ? "Nothing needs attention right now."
                : `Item ${Math.min(supportIndex + 1, supportQueue.length)} of ${supportQueue.length} — work through unresponded handovers and open tickets.`}
            </DialogDescription>
          </DialogHeader>

          {supportQueue.length === 0 || supportIndex >= supportQueue.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">You're all caught up!</p>
              <p className="text-sm">No open handovers or tickets waiting on a response.</p>
            </div>
          ) : currentSupportItem?.kind === "thread" ? (
            <SupportModeThread
              thread={currentSupportItem.data}
              registerLive={(thread, apply) => {
                supportModeThreadRef.current = thread;
                supportModeApplyRef.current = apply;
              }}
              onSkip={supportAdvance}
              onHandled={async () => {
                await supabase
                  .from("chat_threads")
                  .update({ handover_resolved_at: new Date().toISOString() })
                  .eq("id", currentSupportItem.data.id);
                toast.success("Handover marked resolved");
                supportAdvance();
                fetchThreads();
              }}
            />
          ) : currentSupportItem?.kind === "ticket" ? (
            <SupportModeTicket
              ticket={currentSupportItem.data}
              onSkip={supportAdvance}
              onOpenTicket={() => {
                setSelectedTicket(currentSupportItem.data);
                setTicketResponse("");
                setTicketAttachment(null);
                supportAdvance();
              }}
            />
          ) : null}

          <DialogFooter className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={refreshSupportQueue}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh queue
            </Button>
            <Button variant="outline" onClick={() => setSupportModeOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ---------- Support Mode item panels ----------
const SupportModeThread = ({
  thread,
  registerLive,
  onSkip,
  onHandled,
}: {
  thread: ChatThread;
  registerLive: (
    thread: ChatThread | null,
    apply:
      | ((
          table: "ai_chat_messages" | "agency_owner_messages",
          row: Record<string, unknown>,
        ) => void)
      | null,
  ) => void;
  onSkip: () => void;
  onHandled: () => void;
}) => {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachmentValue | null>(null);
  const pendingReplyRef = useRef<{ key: string; id: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [aiRes, ownerRes] = await Promise.all([
        supabase
          .from("ai_chat_messages")
          .select("id, content, role, created_at")
          .eq("agency_id", thread.agency_id)
          .ilike("user_identifier", thread.user_identifier)
          .order("created_at", { ascending: true }),
        supabase
          .from("agency_owner_messages")
          .select("id, content, created_at, sender_type")
          .eq("agency_id", thread.agency_id)
          .ilike("user_identifier", thread.user_identifier)
          .order("created_at", { ascending: true }),
      ]);
      const all: ChatMsg[] = [
        ...((aiRes.data || []) as any[]).map((m) => ({ ...m, sender_type: m.role })),
        ...((ownerRes.data || []) as any[]).map((m) => ({ ...m, role: "agency_owner" })),
      ];
      if (!cancelled) setMsgs((prev) => mergeChatMessages(prev, all));
    };
    registerLive(thread, (table, row) => {
      setMsgs((prev) => applyIncomingChatMessage(prev, table, row, thread));
    });
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, OPEN_CONVERSATION_POLL_MS);
    return () => {
      cancelled = true;
      registerLive(null, null);
      window.clearInterval(timer);
    };
    // registerLive writes refs; the thread id is the conversation identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id, thread.agency_id, thread.user_identifier]);

  const send = async () => {
    if (!reply.trim() && !attachment) return;
    setSending(true);
    try {
      let body = reply.trim();
      if (attachment) {
        const url = await withSendTimeout(
          uploadChatAttachment(`${thread.agency_id}-${thread.user_identifier}`, attachment.file),
        );
        body = body ? `${body}\n${url}` : url;
      }
      const sendKey = `${thread.agency_id}|${thread.user_identifier.toLowerCase()}|${body}`;
      const messageId =
        pendingReplyRef.current?.key === sendKey ? pendingReplyRef.current.id : crypto.randomUUID();
      pendingReplyRef.current = { key: sendKey, id: messageId };
      await saveSupportReply({
        id: messageId,
        agencyId: thread.agency_id,
        userIdentifier: thread.user_identifier,
        content: body,
      });
      pendingReplyRef.current = null;
      queueReplyNotification({
        agencyId: thread.agency_id,
        userIdentifier: thread.user_identifier,
        content: body,
      });
      toast.success("Reply sent");
      setReply("");
      setAttachment(null);
      onHandled();
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm [overflow-wrap:anywhere]">
        <Badge variant="destructive">Handover</Badge>
        <span className="font-medium">{thread.user_identifier}</span>
        <span className="text-muted-foreground">· Agency {thread.agency_id}</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => setTicketOpen(true)}>
        <TicketIcon className="w-4 h-4 mr-1" /> Create Ticket
      </Button>
      <OpenTicketFromChatDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        agencyId={thread.agency_id}
        userIdentifier={thread.user_identifier}
        messages={msgs}
      />
      <SupportChatViewport className="h-[45dvh] rounded-md border p-3">
        <div className="space-y-3">
          {msgs.map((m) => {
            const isOwner = m.role === "agency_owner" || m.sender_type === "agency_owner";
            const isUser = m.role === "user";
            return (
              <div
                key={m.id}
                className={`group flex min-w-0 items-center gap-2 ${isOwner ? "justify-end" : ""}`}
              >
                <div
                  className={`min-w-0 max-w-[85%] sm:max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    isOwner
                      ? "bg-primary text-primary-foreground"
                      : isUser
                        ? "bg-muted"
                        : "bg-cyan-500/10 border border-cyan-500/20"
                  }`}
                >
                  {renderMessageContent(m.content)}
                </div>
                {isOwner && (
                  <button
                    type="button"
                    title="Delete this message"
                    onClick={async () => {
                      if (
                        !window.confirm("Delete this message? The customer will no longer see it.")
                      )
                        return;
                      const prev = msgs;
                      setMsgs((ms) => ms.filter((x) => x.id !== m.id));
                      try {
                        await deleteOwnerMessage(m.id);
                        toast.success("Message deleted");
                      } catch (e: any) {
                        setMsgs(prev);
                        toast.error(e?.message || "Failed to delete message");
                      }
                    }}
                    className="p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          {msgs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>
          )}
        </div>
      </SupportChatViewport>
      <ChatAttachmentPreview
        value={attachment}
        onRemove={() => setAttachment(null)}
        disabled={sending}
      />
      <div className="flex gap-2">
        <Input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Type a reply…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <ChatAttachButton value={attachment} onChange={setAttachment} disabled={sending} />
        <Button onClick={send} disabled={sending || (!reply.trim() && !attachment)}>
          <Send className="w-4 h-4 mr-1" /> Send & resolve
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          <SkipForward className="w-4 h-4 mr-1" /> Skip
        </Button>
        <Button variant="secondary" size="sm" onClick={onHandled}>
          <Check className="w-4 h-4 mr-1" /> Mark handled
        </Button>
      </div>
    </div>
  );
};

const SupportModeTicket = ({
  ticket,
  onSkip,
  onOpenTicket,
}: {
  ticket: SupportTicket;
  onSkip: () => void;
  onOpenTicket: () => void;
}) => {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm [overflow-wrap:anywhere]">
        <Badge variant="destructive">Ticket</Badge>
        <span className="font-medium">
          #{ticket.ticket_number} · {ticket.issue_category}
        </span>
        <span className="text-muted-foreground">
          · {ticket.customer_name} ({ticket.customer_email}) · Agency {ticket.agency_id}
        </span>
      </div>
      <div className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap max-h-[45vh] overflow-y-auto">
        {ticket.request_text}
        {ticket.attachment_url && (
          <a
            href={ticket.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 block"
          >
            <img
              src={ticket.attachment_url}
              alt="Customer attachment"
              className="max-h-48 rounded border"
            />
          </a>
        )}
      </div>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          <SkipForward className="w-4 h-4 mr-1" /> Skip
        </Button>
        <Button onClick={onOpenTicket}>
          <Mail className="w-4 h-4 mr-1" /> Open & respond
        </Button>
      </div>
    </div>
  );
};

export default AdminSupport;
