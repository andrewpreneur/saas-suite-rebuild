import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { SmoothInput, SmoothTextarea } from "@/components/ui/smooth-input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Inbox, Loader2, Lock, Plus, Send } from "lucide-react";
import { AuthorLine, MemberAvatar, relativeTime } from "./shared";
import type { CommunityProfile } from "@/hooks/useCommunityProfile";
import { cn } from "@/lib/utils";

type Thread = {
  id: string;
  user_id: string;
  assigned_to: string | null;
  subject: string;
  status: "open" | "answered" | "closed";
  is_private: boolean;
  created_at: string;
};

type Message = {
  id: string;
  thread_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type AuthorMap = Record<
  string,
  { display_name: string; avatar_url: string | null; role: string; handle?: string | null; is_verified?: boolean | null }
>;

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  open: "outline",
  answered: "secondary",
  closed: "default",
};

export default function CommunityAsk({
  profile,
  isPaid,
  isStaff,
}: {
  profile: CommunityProfile | null;
  isPaid: boolean;
  isStaff: boolean;
}) {
  const { toast } = useToast();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [authors, setAuthors] = useState<AuthorMap>({});
  const [loading, setLoading] = useState(true);
  const [openThread, setOpenThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadAuthors = useCallback(async (ids: string[]) => {
    const unique = Array.from(new Set(ids)).filter(Boolean);
    if (unique.length === 0) return;
    const { data } = await supabase
      .from("community_profiles")
      .select("id, display_name, avatar_url, role, handle, is_verified")
      .in("id", unique);
    if (data) {
      setAuthors((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => {
          next[p.id] = {
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            role: p.role,
            handle: p.handle,
            is_verified: p.is_verified,
          };
        });
        return next;
      });
    }
  }, []);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_threads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = (data || []) as Thread[];
    setThreads(rows);
    await loadAuthors(rows.map((t) => t.user_id));
    setLoading(false);
  }, [loadAuthors]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const loadMessages = useCallback(
    async (thread: Thread) => {
      const { data } = await supabase
        .from("community_thread_messages")
        .select("*")
        .eq("thread_id", thread.id)
        .order("created_at");
      const rows = (data || []) as Message[];
      setMessages(rows);
      await loadAuthors(rows.map((m) => m.author_id));
    },
    [loadAuthors],
  );

  useEffect(() => {
    if (openThread) void loadMessages(openThread);
  }, [openThread, loadMessages]);

  // Live updates so DMs feel instant for both sides.
  useEffect(() => {
    if (!openThread) return;
    const channel = supabase
      .channel(`community-dm-${openThread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "community_thread_messages",
          filter: `thread_id=eq.${openThread.id}`,
        },
        () => {
          void loadMessages(openThread);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [openThread, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const createThread = async () => {
    if (!profile || !subject.trim() || !body.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("community_threads")
      .insert({
        user_id: profile.id,
        subject: subject.trim(),
        is_private: true,
      })
      .select()
      .maybeSingle();
    if (error || !data) {
      setCreating(false);
      toast({
        title: "Could not start conversation",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }
    await supabase
      .from("community_thread_messages")
      .insert({ thread_id: (data as Thread).id, author_id: profile.id, body: body.trim() });
    setCreating(false);
    setDialogOpen(false);
    setSubject("");
    setBody("");
    await loadThreads();
    setOpenThread(data as Thread);
  };

  const sendMessage = async () => {
    if (!profile || !openThread || !reply.trim()) return;
    const { error } = await supabase
      .from("community_thread_messages")
      .insert({ thread_id: openThread.id, author_id: profile.id, body: reply.trim() });
    if (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
      return;
    }
    setReply("");
    await loadMessages(openThread);
    await loadThreads();
  };

  const threadList = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Inbox className="h-4 w-4 text-primary" />
          {isStaff ? "All conversations" : "My conversations"}
        </div>
        <Button size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No conversations yet — start one and the team will reply here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map((thread) => {
              const author = authors[thread.user_id];
              const active = openThread?.id === thread.id;
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => setOpenThread(thread)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-3 text-left transition-colors",
                      active ? "bg-primary/10" : "hover:bg-muted/60",
                    )}
                  >
                    <MemberAvatar
                      name={author?.display_name}
                      avatarUrl={author?.avatar_url}
                      authorId={thread.user_id}
                      className="h-8 w-8 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {isStaff ? author?.display_name || "Member" : "SaaSSuite Team"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{thread.subject}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {relativeTime(thread.created_at)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const member = openThread ? authors[openThread.user_id] : undefined;

  const conversation = openThread ? (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <Button
          variant="ghost"
          size="icon" aria-label="Go back"
          className="h-8 w-8 md:hidden"
          onClick={() => setOpenThread(null)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{openThread.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {isStaff
              ? `${member?.display_name || "Member"}${member?.handle ? ` @${member.handle}` : ""}`
              : "Private line to the SaaSSuite team"}
          </p>
        </div>
        <Badge variant={statusVariant[openThread.status]} className="capitalize">
          {openThread.status}
        </Badge>
        <Badge variant="outline" className="hidden gap-1 sm:flex">
          <Lock className="h-3 w-3" /> Private
        </Badge>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.map((message) => {
          const author = authors[message.author_id];
          const mine = message.author_id === profile?.id;
          const isTeam = author?.role === "team" || author?.role === "admin";
          return (
            <div key={message.id} className={cn("flex items-end gap-2", mine && "flex-row-reverse")}>
              <MemberAvatar
                name={author?.display_name}
                avatarUrl={author?.avatar_url}
                authorId={message.author_id}
                className="h-7 w-7 shrink-0"
              />
              <div
                className={cn(
                  "flex min-w-0 max-w-[78%] flex-col gap-1",
                  mine ? "items-end text-right" : "items-start",
                )}
              >
                <div className={cn("flex", mine && "justify-end")}>
                  <AuthorLine
                    name={
                      mine
                        ? "You"
                        : isTeam
                          ? author?.display_name || "SaaSSuite Team"
                          : author?.display_name
                    }
                    handle={mine ? null : author?.handle}
                    verified={author?.is_verified || isTeam}
                    role={author?.role}
                    when={message.created_at}
                  />
                </div>
                <p
                  className={cn(
                    "w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-left text-sm",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {message.body}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {(openThread.user_id === profile?.id || isStaff) && (
        <div className="flex items-end gap-2 border-t border-border p-3">
          <div className="flex-1">
            <SmoothTextarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder="Write a message..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
          </div>
          <Button size="sm" className="gap-2" disabled={!reply.trim()} onClick={sendMessage}>
            <Send className="h-3.5 w-3.5" /> Send
          </Button>
        </div>
      )}
    </div>
  ) : (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-6 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {isStaff
          ? "Pick a conversation to reply to a member."
          : "Select a conversation or start a new message to the SaaSSuite team."}
      </p>
      <Button size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> New message
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[300px_1fr]">
            <div
              className={cn(
                "border-border md:block md:border-r",
                openThread ? "hidden" : "block",
              )}
            >
              {threadList}
            </div>
            <div className={cn(openThread ? "block" : "hidden md:block")}>{conversation}</div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message the SaaSSuite team</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <SmoothInput
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <SmoothTextarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Describe what you need help with..."
              />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Private thread — visible only to you and the SaaSSuite team.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!subject.trim() || !body.trim() || creating} onClick={createThread}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}