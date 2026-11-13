import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SupportChatViewport } from "@/components/support/SupportChatViewport";
import { toast } from "sonner";
import { Headset, Send, RefreshCw, ArrowLeft, Clock } from "lucide-react";

interface RepMessage {
  id: string;
  client_email: string;
  agency_id: string | null;
  sender_role: string;
  sender_name: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string;
  owner_email: string | null;
  agency_name: string | null;
  full_name: string | null;
}

interface RepThread {
  client_email: string;
  agency_id: string | null;
  agency_name: string | null;
  owner_email: string | null;
  contact: string;
  messages: RepMessage[];
  lastAt: string;
  needsReply: boolean;
}

const formatTime = (value: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
};

const AgencySupportMessagesPanel = () => {
  const [rows, setRows] = useState<RepMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_agency_support_messages" as any, {
        p_limit: 1000,
      });
      if (error) throw error;
      setRows((data || []) as RepMessage[]);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Failed to load agency support messages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-agency-support-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agency_support_messages" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threads = useMemo<RepThread[]>(() => {
    const map = new Map<string, RepMessage[]>();
    rows.forEach((m) => {
      const key = m.client_email.toLowerCase();
      const list = map.get(key) || [];
      list.push(m);
      map.set(key, list);
    });
    const out: RepThread[] = [];
    map.forEach((list, key) => {
      const ordered = [...list].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const last = ordered[ordered.length - 1];
      out.push({
        client_email: key,
        agency_id: last.agency_id,
        agency_name: last.agency_name,
        owner_email: last.owner_email,
        contact: ordered.find((m) => m.sender_role === "client")?.sender_name || key,
        messages: ordered,
        lastAt: last.created_at,
        needsReply: last.sender_role === "client",
      });
    });
    return out.sort((a, b) => {
      if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });
  }, [rows]);

  const selected = threads.find((t) => t.client_email === selectedEmail) || null;
  const needsReplyCount = threads.filter((t) => t.needsReply).length;

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    const outgoing = reply.trim();
    setSending(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try {
      const { error } = await supabase
        .rpc("admin_send_agency_support_message" as any, {
          p_client_email: selected.client_email,
          p_body: outgoing,
          p_sender_name: "SaaSSuite Support",
        })
        .abortSignal(controller.signal);
      if (error) throw error;
      // Email the customer through the same automation the AI chat replies use.
      void supabase.functions
        .invoke("notify-team-reply", {
          body: {
            source: "agency_support",
            client_email: selected.client_email,
            agency_id: selected.agency_id,
            our_message: outgoing,
          },
          timeout: 10000,
        })
        .catch((e) => console.error("notify-team-reply (agency_support) failed:", e));
      setReply("");
      toast.success("Reply sent");
      void load();

    } catch (e: any) {
      console.error(e);
      toast.error(
        controller.signal.aborted
          ? "Supabase did not respond within 8 seconds. Please retry."
          : e?.message || "Failed to send reply",
      );
    } finally {
      window.clearTimeout(timer);
      setSending(false);
    }
  };

  return (
    <Card className={needsReplyCount > 0 ? "border-brand/40" : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Headset className="w-4 h-4 text-brand" />
          Agency support messages
          {needsReplyCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{needsReplyCount}</Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 px-2"
            onClick={load}
            aria-label="Refresh agency support messages"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading messages…</p>
        ) : threads.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No agency support messages yet.</p>
        ) : selected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setSelectedEmail(null)}>
                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
              </Button>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{selected.contact}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {selected.client_email}
                  {selected.agency_name ? ` · ${selected.agency_name}` : ""}
                  {selected.agency_id ? ` · ${selected.agency_id}` : ""}
                </p>
              </div>
            </div>
            <SupportChatViewport className="h-[320px] pr-2">
              <div className="space-y-3">
                {selected.messages.map((m) => {
                  const isClient = m.sender_role === "client";
                  return (
                    <div key={m.id} className={`flex min-w-0 ${isClient ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`min-w-0 max-w-[85%] rounded-lg border p-3 text-sm ${
                          isClient ? "bg-muted/40" : "bg-primary/5 border-primary/30"
                        }`}
                        style={isClient ? { borderLeft: `3px solid ${senderColor(m.sender_name || selected.contact || "Customer", false)}` } : undefined}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {(() => {
                            const label = isClient ? (m.sender_name || selected.contact || "Customer") : "SaaS Suite";
                            const c = senderColor(label, !isClient);
                            return (
                              <span className="text-xs font-semibold" style={{ color: c }}>
                                {label}
                              </span>
                            );
                          })()}
                          <span className="text-xs text-muted-foreground">{formatTime(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>
                        {m.attachment_url && (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 block text-xs underline"
                          >
                            View attachment
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SupportChatViewport>
            <div className="flex gap-2 border-t pt-3">
              <Input
                className="min-w-0 flex-1"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type a reply…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendReply();
                  }
                }}
              />
              <Button onClick={sendReply} disabled={sending || !reply.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-2">
            <div className="space-y-2">
              {threads.map((t) => (
                <button
                  key={t.client_email}
                  onClick={() => setSelectedEmail(t.client_email)}
                  className="w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{t.contact}</p>
                        {t.needsReply && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Needs reply</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{t.client_email}</p>
                      {(t.agency_name || t.agency_id) && (
                        <p className="text-xs font-semibold mt-0.5 truncate">
                          {t.agency_name || t.agency_id}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {t.messages[t.messages.length - 1].body}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatTime(t.lastAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default AgencySupportMessagesPanel;

// Distinct, high-contrast colour per sender name. Uses golden-angle hue spacing so
// any number of names stay visually distinct; dark lightness keeps text readable.
const senderColorCache = new Map<string, string>();
function senderColor(name: string, isTeam: boolean): string {
  if (isTeam) return "hsl(var(--primary))";
  const key = name.trim().toLowerCase();
  const hit = senderColorCache.get(key);
  if (hit) return hit;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const hue = Math.round(((h % 360) + senderColorCache.size * 137.508) % 360);
  // Yellows/greens are naturally bright — darken them more for contrast.
  const light = hue > 40 && hue < 170 ? 28 : 36;
  const color = `hsl(${hue} 75% ${light}%)`;
  senderColorCache.set(key, color);
  return color;
}
