import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Bot,
  CircleAlert,
  CircleCheck,
  MessageSquare,
  Search,
  Send,
  Ticket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useUiSounds } from "@/hooks/useUiSounds";
import { deleteOwnerMessage } from "@/lib/deleteOwnerMessage";
import { renderMessageContent } from "@/lib/renderChatContent";
import { uploadChatAttachment } from "@/lib/chatAttachment";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import AssignUserButton from "@/components/support/AssignUserButton";
import OpenTicketFromChatDialog from "@/components/support/OpenTicketFromChatDialog";
import { filesToDropFiles, type DropFile } from "@/components/support/MultiAttachmentDropzone";
import {
  ChatAttachButton,
  ChatAttachmentPreview,
  type ChatAttachmentValue,
} from "@/components/support/ChatAttachButton";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
import { AnimatedListItem } from "@/components/premium/21st/animated-list";
import { FilterChips } from "./FilterChips";
import { PersonAvatar } from "./PersonAvatar";

interface ChatContact {
  agency_id: string;
  user_identifier: string;
  display_name: string;
  last_message_at: string;
  last_message?: string | null;
  message_count: number;
  plan_label: string;
  is_pending_handover?: boolean;
  in_human_queue?: boolean;
}

interface ChatMessage {
  id: string;
  content: string;
  role: string;
  created_at: string;
  sender_type?: string;
}

export interface SupportInboxProps {
  agencyVersions: {
    base_id?: string | null;
    basic_id: string | null;
    advanced_id: string | null;
    elite_id: string | null;
  };
  /** Reports chat totals so the page can show them in its KPI row. */
  onStats?: (s: { total: number; open: number; responded: number }) => void;
  /** Bump to reload the conversation list (the page owns the one Refresh button). */
  refreshKey?: number;
}

// Resolved handovers stay flagged "Replied" for this long, so the team keeps a
// checklist of everyone recently helped.
const HANDOVER_GRACE_HOURS = 48;

type ListFilter = "all" | "needs" | "mine" | "unassigned";

const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

function ThreadStatus({ contact }: { contact: ChatContact }) {
  if (contact.is_pending_handover)
    return (
      <Tag tone="danger">
        <CircleAlert aria-hidden="true" /> Needs reply
      </Tag>
    );
  if (contact.in_human_queue)
    return (
      <Tag tone="success">
        <CircleCheck aria-hidden="true" /> Replied
      </Tag>
    );
  return (
    <Tag tone="neutral" className="border-border bg-muted text-muted-foreground">
      <Bot aria-hidden="true" /> AI handled
    </Tag>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y divide-border" aria-label="Loading conversations" role="status">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-4">
          <div className="px-skeleton size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="px-skeleton h-3.5 w-2/5 rounded-sm" />
            <div className="px-skeleton h-3 w-4/5 rounded-sm" />
          </div>
          <div className="px-skeleton h-3 w-10 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

/**
 * The Client Support inbox: conversation list on the left, the open conversation
 * on the right. On phones it is one pane at a time with a Back button.
 */
export default function SupportInbox({ agencyVersions, onStats, refreshKey = 0 }: SupportInboxProps) {
  const { email } = useUser();
  const access = useTeamAccess();
  const team = access.team;
  const canEditChats = access.level("support_chats") === "edit";
  const [assignments, setAssignments] = useState<Map<string, string | null>>(new Map());
  const [dropFiles, setDropFiles] = useState<DropFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachmentValue | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [search, setSearch] = useState("");
  const messagesBoxRef = useRef<HTMLDivElement>(null);
  const { playReceive } = useUiSounds();
  const seenMsgIdsRef = useRef<Set<string>>(new Set());
  const autoSelectedRef = useRef(false);

  const allAgencyIds = Array.from(
    new Set(
      [
        agencyVersions.base_id,
        agencyVersions.basic_id,
        agencyVersions.advanced_id,
        agencyVersions.elite_id,
      ].filter(Boolean) as string[],
    ),
  );

  const getPlanLabel = (agencyId: string) => {
    if (agencyId === agencyVersions.basic_id) return "Basic";
    if (agencyId === agencyVersions.base_id) return "Primary";
    if (agencyId === agencyVersions.advanced_id) return "Advanced";
    if (agencyId === agencyVersions.elite_id) return "Elite";
    return "Agency";
  };

  const threadKey = (c: ChatContact) => `${c.agency_id}::${c.user_identifier.trim().toLowerCase()}`;

  const handleAssign = async (value: string | null, target?: ChatContact) => {
    const contact = target ?? selectedContact;
    if (!contact) return;
    const assignee = value;
    const key = threadKey(contact);
    const prev = new Map(assignments);
    setAssignments(new Map(assignments).set(key, assignee));
    const { data: existing } = await (supabase as any)
      .from("support_chat_assignments")
      .select("id")
      .eq("agency_id", contact.agency_id)
      .ilike("user_identifier", contact.user_identifier)
      .maybeSingle();
    const payload = {
      assigned_to_email: assignee,
      assigned_by: email?.trim().toLowerCase() || null,
    };
    const { error } = existing
      ? await (supabase as any).from("support_chat_assignments").update(payload).eq("id", existing.id)
      : await (supabase as any).from("support_chat_assignments").insert({
          agency_id: contact.agency_id,
          user_identifier: contact.user_identifier,
          ...payload,
        });
    if (error) {
      setAssignments(prev);
      toast.error("Couldn't assign the chat. Try again.");
    } else {
      toast.success(
        assignee
          ? `Chat assigned to ${team.find((t) => t.email === assignee)?.name || assignee}`
          : "Chat unassigned",
      );
    }
  };

  useEffect(() => {
    const box = messagesBoxRef.current;
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Conversations are the unique agency + user pairs in ai_chat_messages.
  const loadContacts = async () => {
    if (allAgencyIds.length === 0) {
      setIsLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("ai_chat_messages")
        .select("agency_id, user_identifier, created_at, content")
        .in("agency_id", allAgencyIds)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const contactMap = new Map<
        string,
        {
          agency_id: string;
          user_identifier: string;
          last_message_at: string;
          last_message: string | null;
          message_count: number;
        }
      >();
      (data as any[] | null)?.forEach((msg) => {
        const key = `${msg.agency_id}::${msg.user_identifier.trim().toLowerCase()}`;
        const existing = contactMap.get(key);
        if (existing) {
          existing.message_count++;
          // Rows are newest first on the server; keep the newest even if they are not.
          if (new Date(msg.created_at).getTime() > new Date(existing.last_message_at).getTime()) {
            existing.last_message_at = msg.created_at;
            existing.last_message = msg.content ?? null;
          }
        } else {
          contactMap.set(key, {
            agency_id: msg.agency_id,
            user_identifier: msg.user_identifier,
            last_message_at: msg.created_at,
            last_message: msg.content ?? null,
            message_count: 1,
          });
        }
      });

      const contactList: ChatContact[] = Array.from(contactMap.values()).map((c) => ({
        ...c,
        display_name: c.user_identifier,
        plan_label: getPlanLabel(c.agency_id),
      }));
      contactList.sort(
        (a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime(),
      );

      const { data: threads } = await supabase
        .from("chat_threads")
        .select("agency_id, user_identifier, handover_requested_at, handover_resolved_at")
        .in("agency_id", allAgencyIds)
        .not("handover_requested_at", "is", null);

      const graceCutoff = Date.now() - HANDOVER_GRACE_HOURS * 60 * 60 * 1000;
      const humanQueueKeys = new Set<string>();
      const pendingKeys = new Set<string>();
      (threads || []).forEach((t: any) => {
        const key = `${t.agency_id}::${String(t.user_identifier || "").trim().toLowerCase()}`;
        const resolved = t.handover_resolved_at ? new Date(t.handover_resolved_at).getTime() : null;
        if (!resolved) {
          humanQueueKeys.add(key);
          pendingKeys.add(key);
        } else if (resolved >= graceCutoff) {
          humanQueueKeys.add(key);
        }
      });

      const finalList = contactList.map((c) => ({
        ...c,
        is_pending_handover: pendingKeys.has(threadKey(c)),
        in_human_queue: humanQueueKeys.has(threadKey(c)),
      }));
      setContacts(finalList);
      onStats?.({
        total: contactList.length,
        open: pendingKeys.size,
        responded: Math.max(0, humanQueueKeys.size - pendingKeys.size),
      });

      const { data: assignRows } = await (supabase as any)
        .from("support_chat_assignments")
        .select("agency_id, user_identifier, assigned_to_email")
        .in("agency_id", allAgencyIds);
      const assignMap = new Map<string, string | null>(
        (assignRows || []).map((a: any) => [
          `${a.agency_id}::${String(a.user_identifier).trim().toLowerCase()}`,
          a.assigned_to_email,
        ]),
      );
      setAssignments(assignMap);
      if (access.restrictChats) {
        setContacts(
          finalList.filter(
            (c) => String(assignMap.get(threadKey(c)) || "").toLowerCase() === access.me,
          ),
        );
      }
    } catch (error) {
      console.error("Error loading contacts:", error);
      toast.error("Couldn't load conversations. Use Refresh to try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadContacts();
  }, [agencyVersions, access.restrictChats, access.me, refreshKey]);

  const loadMessages = async (contact: ChatContact) => {
    try {
      const { data: aiMessages, error: aiError } = await supabase
        .from("ai_chat_messages")
        .select("id, content, role, created_at")
        .eq("agency_id", contact.agency_id)
        .ilike("user_identifier", contact.user_identifier)
        .order("created_at", { ascending: true });
      if (aiError) throw aiError;

      const { data: ownerMessages, error: ownerError } = await supabase
        .from("agency_owner_messages")
        .select("id, content, created_at, sender_type")
        .eq("agency_id", contact.agency_id)
        .ilike("user_identifier", contact.user_identifier)
        .order("created_at", { ascending: true });
      if (ownerError) throw ownerError;

      const allMessages: ChatMessage[] = [
        ...((aiMessages as any[]) || []).map((m) => ({ ...m, sender_type: m.role })),
        ...((ownerMessages as any[]) || []).map((m) => ({ ...m, role: "agency_owner" })),
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      setMessages(allMessages);
    } catch (error) {
      console.error("Error loading messages:", error);
      toast.error("Couldn't load this conversation. Select it again to retry.");
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (selectedContact) loadMessages(selectedContact);
  }, [selectedContact]);

  // On a wide screen the right pane should never sit empty: open the first conversation once.
  useEffect(() => {
    if (autoSelectedRef.current || selectedContact || contacts.length === 0) return;
    if (typeof window === "undefined" || !window.matchMedia("(min-width: 1024px)").matches) return;
    autoSelectedRef.current = true;
    setMessagesLoading(true);
    setSelectedContact(contacts[0]);
  }, [contacts, selectedContact]);

  // Realtime: live updates and a sound on incoming client messages.
  useEffect(() => {
    if (allAgencyIds.length === 0) return;
    const sameThread = (row: any) =>
      selectedContact &&
      row.agency_id === selectedContact.agency_id &&
      String(row.user_identifier || "").toLowerCase() ===
        selectedContact.user_identifier.toLowerCase();
    const channel = supabase
      .channel(`agency-chat-inbox-${allAgencyIds.join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_chat_messages" },
        (payload: any) => {
          const row: any = payload.new;
          if (!row || !allAgencyIds.includes(row.agency_id)) return;
          if (row.role === "user" && !seenMsgIdsRef.current.has(row.id)) {
            seenMsgIdsRef.current.add(row.id);
            playReceive();
          }
          loadContacts();
          if (sameThread(row)) loadMessages(selectedContact!);
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agency_owner_messages" },
        (payload: any) => {
          const row: any = payload.new;
          if (!row || !allAgencyIds.includes(row.agency_id)) return;
          loadContacts();
          if (sameThread(row)) loadMessages(selectedContact!);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_threads" },
        (payload: any) => {
          const row: any = payload.new || payload.old;
          if (!row || !allAgencyIds.includes(row.agency_id)) return;
          loadContacts();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    allAgencyIds.join("-"),
    selectedContact?.agency_id,
    selectedContact?.user_identifier,
    playReceive,
  ]);

  const handleSelectContact = (contact: ChatContact) => {
    if (selectedContact && threadKey(selectedContact) === threadKey(contact)) return;
    setSelectedContact(contact);
    setMessages([]);
    setMessagesLoading(true);
    setNewMessage("");
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
    setMessages([]);
    setNewMessage("");
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Delete this message? The customer will no longer see it.")) return;
    const prev = messages;
    setMessages((ms) => ms.filter((m) => m.id !== messageId));
    try {
      await deleteOwnerMessage(messageId);
      toast.success("Message deleted");
    } catch (error: any) {
      setMessages(prev);
      toast.error(error?.message || "Couldn't delete the message. Try again.");
    }
  };

  const canSend = !!newMessage.trim() || !!attachment || dropFiles.length > 0;

  const handleSendMessage = async () => {
    if (!canSend || !selectedContact || allAgencyIds.length === 0) return;
    setIsSending(true);
    try {
      let body = newMessage.trim();
      const folder = `${selectedContact.agency_id}-${selectedContact.user_identifier}`;
      if (attachment) {
        const url = await uploadChatAttachment(folder, attachment.file);
        body = body ? `${body}\n${url}` : url;
      }
      for (const f of dropFiles) {
        const url = await uploadChatAttachment(folder, f.file);
        body = body ? `${body}\n${url}` : url;
      }

      const { error } = await supabase.from("agency_owner_messages").insert({
        agency_id: selectedContact.agency_id,
        user_identifier: selectedContact.user_identifier,
        content: body,
        sender_type: "agency_owner",
        sender_email: access.me || null,
        sender_name: team.find((m) => m.email === access.me)?.name?.replace(/ \(owner\)$/, "") || null,
      } as any);
      if (error) throw error;

      // Team-reply webhook, best effort.
      supabase.functions
        .invoke("notify-team-reply", {
          body: {
            agency_id: selectedContact.agency_id,
            user_identifier: selectedContact.user_identifier,
            our_message: body,
            responder_email: access.me || null,
          },
        })
        .catch((e: unknown) => console.error("notify-team-reply failed:", e));

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          content: body,
          role: "agency_owner",
          created_at: new Date().toISOString(),
          sender_type: "agency_owner",
        },
      ]);
      setNewMessage("");
      setAttachment(null);
      setDropFiles([]);
      toast.success("Message sent");
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast.error(error?.message || "Couldn't send the message. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const counts = useMemo(() => {
    const assigned = (c: ChatContact) => (assignments.get(threadKey(c)) || "").toLowerCase();
    return {
      all: contacts.length,
      needs: contacts.filter((c) => c.is_pending_handover).length,
      mine: contacts.filter((c) => assigned(c) === access.me).length,
      unassigned: contacts.filter((c) => !assigned(c)).length,
    };
  }, [contacts, assignments, access.me]);

  const visibleContacts = contacts.filter((c) => {
    const a = (assignments.get(threadKey(c)) || "").toLowerCase();
    if (listFilter === "needs" && !c.is_pending_handover) return false;
    if (listFilter === "mine" && a !== access.me) return false;
    if (listFilter === "unassigned" && a) return false;
    const q = search.trim().toLowerCase();
    return !q || c.display_name.toLowerCase().includes(q);
  });

  if (allAgencyIds.length === 0 && !isLoading) {
    return (
      <div className="px-surface">
        <EmptyState
          icon={
            <EmptyStateIllustration>
              <MessageSquare className="size-6" aria-hidden="true" />
            </EmptyStateIllustration>
          }
          title="No Client Hub yet"
          description="Create a Client Hub page and client chats will arrive here."
          action={
            <Button variant="accent" asChild>
              <Link to="/app/client-hub">Create a hub page</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const selectedKey = selectedContact ? threadKey(selectedContact) : null;

  return (
    <div className="px-surface grid overflow-hidden p-0 lg:h-[600px] lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* List pane */}
      <div
        className={cn(
          "min-h-0 min-w-0 flex-col border-border lg:flex lg:border-r",
          selectedContact ? "hidden" : "flex",
        )}
      >
        <div className="space-y-3 border-b border-border p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
              className="pl-9"
            />
          </div>
          <FilterChips
            label="Filter conversations"
            value={listFilter}
            onChange={(v) => setListFilter(v as ListFilter)}
            options={[
              { id: "all", label: "All", count: counts.all },
              { id: "needs", label: "Needs reply", count: counts.needs },
              { id: "mine", label: "Mine", count: counts.mine },
              { id: "unassigned", label: "Unassigned", count: counts.unassigned },
            ]}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <ListSkeleton />
          ) : contacts.length === 0 ? (
            <EmptyState
              icon={
                <EmptyStateIllustration>
                  <MessageSquare className="size-6" aria-hidden="true" />
                </EmptyStateIllustration>
              }
              title="No conversations yet"
              description="When a client chats with your AI assistant, the conversation lands here."
              action={
                <Button variant="outline" asChild>
                  <Link to="/app/client-hub?support=1">Set up client chat</Link>
                </Button>
              }
            />
          ) : visibleContacts.length === 0 ? (
            <EmptyState
              title="Nothing matches"
              description="No conversation fits this filter or search."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setListFilter("all");
                    setSearch("");
                  }}
                >
                  Show all conversations
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {visibleContacts.map((contact) => {
                  const key = threadKey(contact);
                  const active = key === selectedKey;
                  return (
                    <li key={key}>
                      <AnimatedListItem>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-current={active ? "true" : undefined}
                          onClick={() => handleSelectContact(contact)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSelectContact(contact);
                            }
                          }}
                          className={cn(
                            "relative flex min-h-[72px] cursor-pointer items-start gap-3 px-4 py-3 text-left outline-none transition-colors",
                            "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                            active && "bg-brand-subtle hover:bg-brand-subtle",
                          )}
                        >
                          {active ? (
                            <span
                              className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand"
                              aria-hidden="true"
                            />
                          ) : null}
                          <PersonAvatar name={contact.display_name} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p
                                className={cn(
                                  "truncate text-sm text-foreground",
                                  contact.is_pending_handover ? "font-semibold" : "font-medium",
                                )}
                              >
                                {contact.display_name}
                              </p>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatTime(contact.last_message_at)}
                              </span>
                            </div>
                            {contact.last_message ? (
                              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                                {contact.last_message}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <ThreadStatus contact={contact} />
                              <span className="text-xs text-muted-foreground">
                                {contact.plan_label} · {contact.message_count} message
                                {contact.message_count !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </div>
                          <div className="-mr-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <AssignUserButton
                              team={team}
                              assignedEmail={assignments.get(key)}
                              onAssign={(e) => handleAssign(e, contact)}
                              disabled={!canEditChats}
                              showLabel={false}
                            />
                          </div>
                        </div>
                      </AnimatedListItem>
                    </li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>

      {/* Conversation pane */}
      <div className={cn("min-h-0 min-w-0 flex-col lg:flex", selectedContact ? "flex" : "hidden")}>
        {!selectedContact ? (
          <div className="flex flex-1 items-center justify-center">
            {isLoading ? null : (
              <EmptyState
                icon={
                  <EmptyStateIllustration>
                    <MessageSquare className="size-6" aria-hidden="true" />
                  </EmptyStateIllustration>
                }
                title="Pick a conversation"
                description="Choose a client on the left to read the chat and reply."
              />
            )}
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 lg:hidden"
                onClick={handleBackToContacts}
                aria-label="Back to conversations"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
              <PersonAvatar name={selectedContact.display_name} />
              <div className="min-w-[8rem] flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {selectedContact.display_name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedContact.plan_label} plan · {selectedContact.message_count} messages
                </p>
              </div>
              <ThreadStatus contact={selectedContact} />
              <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
                <AssignUserButton
                  team={team}
                  assignedEmail={assignments.get(threadKey(selectedContact))}
                  onAssign={(e) => handleAssign(e)}
                  disabled={!canEditChats}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={access.level("support_tickets") !== "edit"}
                  onClick={() => setTicketOpen(true)}
                >
                  <Ticket aria-hidden="true" /> Create Ticket
                </Button>
              </div>
            </header>
            <OpenTicketFromChatDialog
              open={ticketOpen}
              onOpenChange={setTicketOpen}
              agencyId={selectedContact.agency_id}
              userIdentifier={selectedContact.user_identifier}
              messages={messages}
            />

            <div
              ref={messagesBoxRef}
              className="h-[52vh] min-h-0 space-y-4 overflow-y-auto bg-muted/30 px-4 py-4 lg:h-auto lg:flex-1"
            >
              {messagesLoading && messages.length === 0 ? (
                <div className="space-y-4" role="status" aria-label="Loading conversation">
                  <div className="px-skeleton h-12 w-3/5 rounded-lg" />
                  <div className="px-skeleton h-16 w-2/3 rounded-lg" />
                  <div className="px-skeleton ml-auto h-12 w-1/2 rounded-lg" />
                </div>
              ) : (
                messages.map((message) => {
                  const isUser = message.role === "user";
                  const isOwner =
                    message.role === "agency_owner" || message.sender_type === "agency_owner";
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: DURATION.base, ease: EASE_OUT }}
                      className={cn("flex gap-2", isOwner && "justify-end")}
                    >
                      {!isOwner ? (
                        isUser ? (
                          <PersonAvatar name={selectedContact.display_name} size="sm" />
                        ) : (
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand"
                            aria-hidden="true"
                          >
                            <Bot className="size-4" />
                          </span>
                        )
                      ) : null}
                      <div className={cn("max-w-[82%] sm:max-w-[70%]", isOwner && "text-right")}>
                        <div
                          className={cn(
                            "inline-block rounded-lg px-3 py-2 text-left text-sm [overflow-wrap:anywhere]",
                            isOwner
                              ? "px-brand-fill text-white"
                              : isUser
                                ? "border border-border bg-card text-foreground"
                                : "bg-brand-subtle text-foreground",
                          )}
                        >
                          {renderMessageContent(message.content)}
                        </div>
                        <div
                          className={cn(
                            "mt-1 flex items-center gap-1.5 text-xs text-muted-foreground",
                            isOwner && "justify-end",
                          )}
                        >
                          <span>
                            {isOwner ? "You" : isUser ? "Client" : "AI assistant"} ·{" "}
                            {formatTime(message.created_at)}
                          </span>
                          {isOwner ? (
                            <button
                              type="button"
                              title="Delete this message"
                              aria-label="Delete this message"
                              onClick={() => handleDeleteMessage(message.id)}
                              className="rounded-sm p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <div
              className={cn(
                "border-t border-border p-3 transition-colors sm:p-4",
                dragOver && "bg-brand-subtle",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                setDropFiles((prev) =>
                  [...prev, ...filesToDropFiles(e.dataTransfer.files)].slice(0, 10),
                );
              }}
            >
              {dragOver ? <p className="mb-2 text-xs text-brand">Drop images to attach them</p> : null}
              {dropFiles.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {dropFiles.map((f, i) => (
                    <div key={f.previewUrl} className="relative">
                      <img
                        src={f.previewUrl}
                        alt={f.file.name}
                        className="size-14 rounded-sm border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setDropFiles((p) => p.filter((_, j) => j !== i))}
                        className="absolute -right-2 -top-2 rounded-full border border-border bg-background px-1 text-[10px] shadow-card"
                        aria-label="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <ChatAttachmentPreview
                value={attachment}
                onRemove={() => setAttachment(null)}
                disabled={isSending}
              />
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={canEditChats ? "Write a reply" : "You have view-only access to chats"}
                  aria-label="Reply to this client"
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <ChatAttachButton value={attachment} onChange={setAttachment} disabled={isSending} />
                <Button
                  variant="accent"
                  onClick={handleSendMessage}
                  disabled={!canEditChats || isSending || !canSend}
                >
                  <Send aria-hidden="true" />
                  <span className="hidden sm:inline">Send reply</span>
                  <span className="sr-only sm:hidden">Send reply</span>
                </Button>
              </div>
              <p className="mt-2 hidden text-xs text-muted-foreground sm:block">
                Your reply appears in the client's chat. Press Enter to send, or drop images here.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
