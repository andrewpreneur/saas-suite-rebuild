import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import AssignUserButton from "@/components/support/AssignUserButton";
import { useTeamAccess } from "@/hooks/useTeamAccess";
import { useUser } from "@/contexts/UserContext";
import { MessageSquare, Send, User, Bot, ArrowLeft, RefreshCw, Trash2, Ticket, UserPlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { filesToDropFiles, type DropFile } from "@/components/support/MultiAttachmentDropzone";
import OpenTicketFromChatDialog from "@/components/support/OpenTicketFromChatDialog";
import { deleteOwnerMessage } from "@/lib/deleteOwnerMessage";
import { toast } from "sonner";
import { useUiSounds } from "@/hooks/useUiSounds";
import { renderMessageContent } from "@/lib/renderChatContent";
import { ChatAttachButton, ChatAttachmentPreview, type ChatAttachmentValue } from "@/components/support/ChatAttachButton";
import { uploadChatAttachment } from "@/lib/chatAttachment";

interface ChatContact {
  agency_id: string;
  user_identifier: string;
  display_name: string;
  last_message_at: string;
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

interface ChatInterventionPanelProps {
  agencyVersions: {
    base_id?: string | null;
    basic_id: string | null;
    advanced_id: string | null;
    elite_id: string | null;
  };
  filterMode?: 'all' | 'handover';
  /** Reports chat totals so the dashboard can show chat stats. */
  onStats?: (s: { total: number; open: number; responded: number }) => void;
}

interface TeamMember { email: string; name: string }

// Keep resolved handovers visible in the "Requires Human" tab for this many hours
// after the owner replies, so admins retain a checklist of everyone recently helped.
const HANDOVER_GRACE_HOURS = 48;

const ChatInterventionPanel = ({ agencyVersions, filterMode = 'all', onStats }: ChatInterventionPanelProps) => {
  const { email } = useUser();
  const access = useTeamAccess();
  const team: TeamMember[] = access.team;
  const canEditChats = access.level('support_chats') === 'edit';
  const [assignments, setAssignments] = useState<Map<string, string | null>>(new Map());
  const [dropFiles, setDropFiles] = useState<DropFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [attachment, setAttachment] = useState<ChatAttachmentValue | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { playReceive } = useUiSounds();
  const seenMsgIdsRef = useRef<Set<string>>(new Set());

  // Get all agency IDs to fetch messages from all plans
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

  const [listFilter, setListFilter] = useState<'all' | 'needs' | 'mine' | 'unassigned'>('all');

  const handleAssign = async (value: string | null, target?: ChatContact) => {
    const contact = target ?? selectedContact;
    if (!contact) return;
    const assignee = value;
    const key = threadKey(contact);
    const prev = new Map(assignments);
    setAssignments(new Map(assignments).set(key, assignee));
    const { data: existing } = await (supabase as any)
      .from('support_chat_assignments')
      .select('id')
      .eq('agency_id', contact.agency_id)
      .ilike('user_identifier', contact.user_identifier)
      .maybeSingle();
    const payload = { assigned_to_email: assignee, assigned_by: email?.trim().toLowerCase() || null };
    const { error } = existing
      ? await (supabase as any).from('support_chat_assignments').update(payload).eq('id', existing.id)
      : await (supabase as any).from('support_chat_assignments').insert({
          agency_id: contact.agency_id,
          user_identifier: contact.user_identifier,
          ...payload,
        });
    if (error) {
      setAssignments(prev);
      toast.error('Failed to assign chat');
    } else {
      toast.success(assignee ? `Chat assigned to ${team.find((t) => t.email === assignee)?.name || assignee}` : 'Chat unassigned');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load contacts (unique user_identifiers from ai_chat_messages)
  const loadContacts = async () => {
    if (allAgencyIds.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Get all messages and group by agency_id + user_identifier so the same email
      // can have separate conversations under different agency accounts.
      const { data, error } = await supabase
        .from('ai_chat_messages')
        .select('agency_id, user_identifier, created_at')
        .in('agency_id', allAgencyIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group messages by agency_id + normalized user_identifier
      const contactMap = new Map<string, { agency_id: string; user_identifier: string; last_message_at: string; message_count: number }>();
      
      data?.forEach(msg => {
        const normalizedIdentifier = msg.user_identifier.trim().toLowerCase();
        const threadKey = `${msg.agency_id}::${normalizedIdentifier}`;
        const existing = contactMap.get(threadKey);
        if (existing) {
          existing.message_count++;
        } else {
          contactMap.set(threadKey, {
            agency_id: msg.agency_id,
            user_identifier: msg.user_identifier,
            last_message_at: msg.created_at,
            message_count: 1
          });
        }
      });

      // Convert to array and create display names
      const contactList: ChatContact[] = Array.from(contactMap.values()).map((data) => {
        // Prioritize name, then email, then identifier
        const isEmail = data.user_identifier.includes('@');
        const displayName = isEmail ? data.user_identifier : (data.user_identifier.includes('Guest') ? data.user_identifier : data.user_identifier);
        
        return {
          agency_id: data.agency_id,
          user_identifier: data.user_identifier,
          display_name: displayName,
          last_message_at: data.last_message_at,
          message_count: data.message_count,
          plan_label: getPlanLabel(data.agency_id)
        };
      });

      // Sort by most recent message
      contactList.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

      // Load handover state for classification (both filters need it).
      const { data: threads } = await supabase
        .from('chat_threads')
        .select('agency_id, user_identifier, handover_requested_at, handover_resolved_at')
        .in('agency_id', allAgencyIds)
        .not('handover_requested_at', 'is', null);

      const graceCutoff = Date.now() - HANDOVER_GRACE_HOURS * 60 * 60 * 1000;
      const humanQueueKeys = new Set<string>();
      const pendingKeys = new Set<string>();
      (threads || []).forEach((t: any) => {
        const key = `${t.agency_id}::${String(t.user_identifier || '').trim().toLowerCase()}`;
        const resolved = t.handover_resolved_at ? new Date(t.handover_resolved_at).getTime() : null;
        if (!resolved) {
          humanQueueKeys.add(key);
          pendingKeys.add(key);
        } else if (resolved >= graceCutoff) {
          humanQueueKeys.add(key);
        }
      });

      const decorate = (c: ChatContact) => {
        const key = `${c.agency_id}::${c.user_identifier.trim().toLowerCase()}`;
        return { ...c, is_pending_handover: pendingKeys.has(key), in_human_queue: humanQueueKeys.has(key) };
      };

      let finalList: ChatContact[];
      if (filterMode === 'handover') {
        finalList = contactList
          .filter((c) => humanQueueKeys.has(`${c.agency_id}::${c.user_identifier.trim().toLowerCase()}`))
          .map(decorate);
      } else {
        // AI Chats tab: exclude conversations that live in the human queue so they
        // don't appear twice — they belong under "Requires Human" until the grace
        // window elapses.
        // Single Inbox: every conversation, with handovers flagged "Needs response".
        finalList = contactList.map(decorate);
      }
      setContacts(finalList);
      onStats?.({
        total: contactList.length,
        open: pendingKeys.size,
        responded: Math.max(0, humanQueueKeys.size - pendingKeys.size),
      });

      const { data: assignRows } = await (supabase as any)
        .from('support_chat_assignments')
        .select('agency_id, user_identifier, assigned_to_email')
        .in('agency_id', allAgencyIds);
      const assignMap = new Map<string, string | null>((assignRows || []).map((a: any) => [
        `${a.agency_id}::${String(a.user_identifier).trim().toLowerCase()}`, a.assigned_to_email,
      ]));
      setAssignments(assignMap);
      if (access.restrictChats) {
        setContacts(finalList.filter((c) =>
          String(assignMap.get(`${c.agency_id}::${c.user_identifier.trim().toLowerCase()}`) || '').toLowerCase() === access.me));
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      toast.error('Failed to load chat contacts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, [agencyVersions, filterMode, access.restrictChats, access.me]);

  // Load messages for selected contact
  const loadMessages = async (contact: ChatContact) => {
    try {
      // Fetch AI chat messages
      const { data: aiMessages, error: aiError } = await supabase
        .from('ai_chat_messages')
        .select('id, content, role, created_at')
        .eq('agency_id', contact.agency_id)
        .ilike('user_identifier', contact.user_identifier)
        .order('created_at', { ascending: true });

      if (aiError) throw aiError;

      // Fetch agency owner messages
      const { data: ownerMessages, error: ownerError } = await supabase
        .from('agency_owner_messages')
        .select('id, content, created_at, sender_type')
        .eq('agency_id', contact.agency_id)
        .ilike('user_identifier', contact.user_identifier)
        .order('created_at', { ascending: true });

      if (ownerError) throw ownerError;

      // Combine and sort messages
      const allMessages: ChatMessage[] = [
        ...(aiMessages || []).map(m => ({ ...m, sender_type: m.role })),
        ...(ownerMessages || []).map(m => ({ ...m, role: 'agency_owner' }))
      ].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setMessages(allMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load messages');
    }
  };

  useEffect(() => {
    if (selectedContact) {
      loadMessages(selectedContact);
    }
  }, [selectedContact]);

  // Realtime: live updates + ding on incoming user/AI messages.
  useEffect(() => {
    if (allAgencyIds.length === 0) return;
    const channel = supabase
      .channel(`agency-chat-inbox-${allAgencyIds.join("-")}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_chat_messages" },
        (payload) => {
          const row: any = payload.new;
          if (!row || !allAgencyIds.includes(row.agency_id)) return;
          if (row.role === "user" && !seenMsgIdsRef.current.has(row.id)) {
            seenMsgIdsRef.current.add(row.id);
            playReceive();
          }
          loadContacts();
          if (
            selectedContact &&
            row.agency_id === selectedContact.agency_id &&
            String(row.user_identifier || "").toLowerCase() ===
              selectedContact.user_identifier.toLowerCase()
          ) {
            loadMessages(selectedContact);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agency_owner_messages" },
        (payload) => {
          const row: any = payload.new;
          if (!row || !allAgencyIds.includes(row.agency_id)) return;
          loadContacts();
          if (
            selectedContact &&
            row.agency_id === selectedContact.agency_id &&
            String(row.user_identifier || "").toLowerCase() ===
              selectedContact.user_identifier.toLowerCase()
          ) {
            loadMessages(selectedContact);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_threads" },
        (payload) => {
          const row: any = payload.new || payload.old;
          if (!row || !allAgencyIds.includes(row.agency_id)) return;
          loadContacts();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [allAgencyIds.join("-"), selectedContact?.agency_id, selectedContact?.user_identifier, playReceive]);

  const handleSelectContact = (contact: ChatContact) => {
    setSelectedContact(contact);
    setMessages([]);
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
      toast.error(error?.message || "Failed to delete message");
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment && dropFiles.length === 0) || !selectedContact || allAgencyIds.length === 0) return;

    setIsSending(true);
    try {
      let body = newMessage.trim();
      if (attachment) {
        const url = await uploadChatAttachment(
          `${selectedContact.agency_id}-${selectedContact.user_identifier}`,
          attachment.file,
        );
        body = body ? `${body}\n${url}` : url;
      }
      for (const f of dropFiles) {
        const url = await uploadChatAttachment(
          `${selectedContact.agency_id}-${selectedContact.user_identifier}`,
          f.file,
        );
        body = body ? `${body}\n${url}` : url;
      }

      // Insert into the selected agency thread only.
      const { error } = await supabase
        .from('agency_owner_messages')
        .insert({
          agency_id: selectedContact.agency_id,
          user_identifier: selectedContact.user_identifier,
          content: body,
          sender_type: 'agency_owner',
          sender_email: access.me || null,
          sender_name: team.find((m) => m.email === access.me)?.name?.replace(/ \(owner\)$/, '') || null,
        } as any);

      if (error) throw error;

      // Fire team-reply webhook (best-effort)
      supabase.functions
        .invoke("notify-team-reply", {
          body: {
            agency_id: selectedContact.agency_id,
            user_identifier: selectedContact.user_identifier,
            our_message: body,
            responder_email: access.me || null,
          },
        })
        .catch((e) => console.error("notify-team-reply failed:", e));

      // Add message to local state
      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        content: body,
        role: 'agency_owner',
        created_at: new Date().toISOString(),
        sender_type: 'agency_owner'
      };
      setMessages(prev => [...prev, newMsg]);
      setNewMessage("");
      setAttachment(null);
      setDropFiles([]);
      toast.success("Message sent!");
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (allAgencyIds.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No Client Hub URLs created</p>
        <p className="text-sm">Create at least one plan URL to view chat conversations</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
      </div>
    );
  }

  // Contact List View
  if (!selectedContact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground hidden sm:block">
            View and respond to Native AI chat conversations with your clients
          </p>
          <Button variant="outline" size="sm" onClick={loadContacts} className="ml-auto">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {([
            ['all', `All (${contacts.length})`],
            ['needs', `Needs response (${contacts.filter((c) => c.is_pending_handover).length})`],
            ['mine', `Assigned to me (${contacts.filter((c) => (assignments.get(threadKey(c)) || '').toLowerCase() === access.me).length})`],
            ['unassigned', `Unassigned (${contacts.filter((c) => !assignments.get(threadKey(c))).length})`],
          ] as const).map(([k, label]) => (
            <Button key={k} size="sm" variant={listFilter === k ? 'default' : 'outline'} className="h-8 shrink-0 text-xs" onClick={() => setListFilter(k)}>
              {label}
            </Button>
          ))}
        </div>

        {contacts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No chat conversations yet</p>
            <p className="text-sm">Conversations from Native AI chat will appear here</p>
          </div>
        ) : (
          <ScrollArea className="h-[60vh] md:h-[400px]">
            <div className="space-y-2">
              {contacts
                .filter((c) => {
                  const a = (assignments.get(threadKey(c)) || '').toLowerCase();
                  if (listFilter === 'needs') return !!c.is_pending_handover;
                  if (listFilter === 'mine') return a === access.me;
                  if (listFilter === 'unassigned') return !a;
                  return true;
                })
                .map((contact) => (
                <div
                  key={`${contact.agency_id}::${contact.user_identifier}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectContact(contact)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSelectContact(contact); }}
                  className="w-full p-3 md:p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-subtle hidden sm:flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{contact.display_name}</p>
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatTime(contact.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{contact.plan_label}</Badge>
                        {contact.is_pending_handover && (
                          <Badge className="text-[10px] px-1 py-0 h-4 bg-destructive text-destructive-foreground">Needs response</Badge>
                        )}
                        {contact.in_human_queue && !contact.is_pending_handover && filterMode === 'handover' && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">Responded</Badge>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {contact.message_count} message{contact.message_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <AssignUserButton
                        team={team}
                        assignedEmail={assignments.get(threadKey(contact))}
                        onAssign={(e) => handleAssign(e, contact)}
                        disabled={!canEditChats}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <p className="text-xs text-muted-foreground">
          Conversations are separated by agency account, so the same client email can appear in multiple agency threads.
        </p>
      </div>
    );
  }

  // Conversation View
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <Button variant="ghost" size="sm" onClick={handleBackToContacts}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-10 h-10 rounded-full bg-brand-subtle flex items-center justify-center">
          <User className="w-5 h-5 text-brand" />
        </div>
        <div>
          <p className="font-medium">{selectedContact.display_name}</p>
          <p className="text-xs text-muted-foreground">{selectedContact.plan_label} · {selectedContact.message_count} messages</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
          <AssignUserButton team={team} assignedEmail={assignments.get(threadKey(selectedContact))} onAssign={(e) => handleAssign(e)} disabled={!canEditChats} />
          <Button size="sm" variant="outline" disabled={access.level("support_tickets") !== "edit"} onClick={() => setTicketOpen(true)}>
            <Ticket className="w-4 h-4 mr-1" /> Create Ticket
          </Button>
        </div>
      </div>
      <OpenTicketFromChatDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        agencyId={selectedContact.agency_id}
        userIdentifier={selectedContact.user_identifier}
        messages={messages}
      />

      {/* Messages */}
      <ScrollArea className="h-[350px] pr-4">
        <div className="space-y-4">
          {messages.map((message) => {
            const isUser = message.role === 'user';
            const isOwner = message.role === 'agency_owner' || message.sender_type === 'agency_owner';
            const isAI = message.role === 'assistant';

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwner ? 'justify-end' : ''}`}
              >
                {!isOwner && (
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isUser ? 'bg-muted' : 'bg-cyan-500/10'
                  }`}>
                    {isUser ? (
                      <User className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Bot className="w-4 h-4 text-cyan-500" />
                    )}
                  </div>
                )}
                <div className={`max-w-[70%] ${isOwner ? 'text-right' : ''}`}>
                  <div className={`rounded-lg px-3 py-2 text-sm ${
                    isOwner
                      ? 'bg-brand text-brand-foreground'
                      : isUser
                        ? 'bg-muted'
                        : 'bg-cyan-500/10 border border-cyan-500/20'
                  }`}>
                    {renderMessageContent(message.content)}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.created_at)}
                    </span>
                    {isOwner && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">You</Badge>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        title="Delete this message"
                        onClick={() => handleDeleteMessage(message.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isAI && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-cyan-500/50 text-cyan-600">AI</Badge>
                    )}
                  </div>
                </div>
                {isOwner && (
                  <div className="w-8 h-8 rounded-full bg-brand-subtle flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-brand" />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Send Message */}
      <div
        className={`pt-3 border-t rounded-md transition-colors ${dragOver ? 'bg-brand-subtle ring-2 ring-brand/40' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          setDropFiles((prev) => [...prev, ...filesToDropFiles(e.dataTransfer.files)].slice(0, 10));
        }}
      >
        {dragOver && <p className="text-xs text-brand mb-2">Drop images to attach</p>}
        {dropFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {dropFiles.map((f, i) => (
              <div key={f.previewUrl} className="relative">
                <img src={f.previewUrl} alt={f.file.name} className="h-14 w-14 object-cover rounded border border-border" />
                <button
                  type="button"
                  onClick={() => setDropFiles((p) => p.filter((_, j) => j !== i))}
                  className="absolute -top-2 -right-2 bg-background border border-border rounded-full px-1 text-[10px] shadow-sm"
                  aria-label="Remove attachment"
                >×</button>
              </div>
            ))}
          </div>
        )}
        <ChatAttachmentPreview value={attachment} onRemove={() => setAttachment(null)} disabled={isSending} />
        <div className="flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message… (drag & drop images here)"
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
        />
        <ChatAttachButton value={attachment} onChange={setAttachment} disabled={isSending} />
        <Button onClick={handleSendMessage} disabled={!canEditChats || isSending || (!newMessage.trim() && !attachment && dropFiles.length === 0)}>
          <Send className="w-4 h-4" />
        </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterventionPanel;
