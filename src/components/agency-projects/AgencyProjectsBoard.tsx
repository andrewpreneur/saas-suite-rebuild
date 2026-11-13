import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SectionCard } from "@/components/premium/SectionCard";
import { cn } from "@/lib/utils";
import {
  Building2,
  Clock,
  Kanban,
  GripVertical,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  User as UserIcon,
} from "lucide-react";

export const PROJECT_STAGES = ["Draft", "Requested", "In Progress", "In Revision", "Closed"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

const STAGE_STYLES: Record<ProjectStage, { dot: string; ring: string; drop: string; head: string }> = {
  Draft: { dot: "bg-muted-foreground", ring: "ring-muted-foreground/40", drop: "border-muted-foreground/40", head: "text-muted-foreground" },
  Requested: { dot: "bg-info", ring: "ring-info/50", drop: "border-info/50", head: "text-info" },
  "In Progress": { dot: "bg-warning", ring: "ring-warning/50", drop: "border-warning/50", head: "text-warning" },
  "In Revision": { dot: "bg-brand", ring: "ring-brand/50", drop: "border-brand/50", head: "text-brand" },
  Closed: { dot: "bg-success", ring: "ring-success/50", drop: "border-success/50", head: "text-success" },
};

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
type Priority = (typeof PRIORITIES)[number];

const PRIORITY_TONES: Record<Priority, "neutral" | "info" | "warning" | "danger"> = {
  low: "neutral",
  normal: "info",
  high: "warning",
  urgent: "danger",
};

const CHIP = "h-5 px-2 py-0 text-[11px] font-medium capitalize";

export interface ProjectClientOption {
  email?: string | null;
  name?: string | null;
  company?: string | null;
  locationId?: string | null;
}

export interface AgencyProject {
  id: string;
  owner_email: string;
  title: string;
  details: string | null;
  stage: ProjectStage;
  priority: Priority;
  position: number;
  client_email: string | null;
  client_name: string | null;
  client_company: string | null;
  location_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectMessage {
  id: string;
  project_id: string;
  sender_role: "owner" | "admin";
  sender_email: string | null;
  sender_name: string | null;
  message: string;
  created_at: string;
}

interface Props {
  ownerEmail: string;
  /** Renders as our internal admin view (replies show as the SaaSSuite team). */
  isAdmin?: boolean;
  agencyId?: string | null;
  clients?: ProjectClientOption[];
  title?: string;
  description?: string;
}

const NO_CLIENT = "__none__";

const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export default function AgencyProjectsBoard({
  ownerEmail,
  isAdmin = false,
  agencyId = null,
  clients = [],
  title = "Requests & Projects",
  description = "Submit a request, tag the client it's for, and drag it through each stage.",
}: Props) {
  const { email: authEmail, effectiveEmail } = useUser();
  const myEmail = (effectiveEmail || authEmail || "").toLowerCase();

  const [projects, setProjects] = useState<AgencyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverStage, setHoverStage] = useState<ProjectStage | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AgencyProject | null>(null);
  const [form, setForm] = useState({
    title: "",
    details: "",
    stage: "Draft" as ProjectStage,
    priority: "normal" as Priority,
    client: NO_CLIENT,
  });
  const [saving, setSaving] = useState(false);

  const [openCard, setOpenCard] = useState<AgencyProject | null>(null);
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [messageDraft, setMessageDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const threadRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!ownerEmail) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("agency_projects")
      .select("*")
      .ilike("owner_email", ownerEmail)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Could not load your projects");
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as unknown as AgencyProject[];
    setProjects(rows);
    setLoading(false);

    if (rows.length) {
      const { data: msgs } = await supabase
        .from("agency_project_messages")
        .select("project_id")
        .in("project_id", rows.map((r) => r.id));
      const map: Record<string, number> = {};
      for (const m of (msgs ?? []) as { project_id: string }[]) {
        map[m.project_id] = (map[m.project_id] || 0) + 1;
      }
      setCounts(map);
    } else {
      setCounts({});
    }
  }, [ownerEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates so admin + owner see the same board.
  useEffect(() => {
    if (!ownerEmail) return;
    const channel = supabase
      .channel(`agency-projects-${ownerEmail}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "agency_projects" }, () => {
        void load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ownerEmail, load]);

  const loadMessages = useCallback(async (projectId: string) => {
    const { data } = await supabase
      .from("agency_project_messages")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as unknown as ProjectMessage[]);
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    if (!openCard) return;
    void loadMessages(openCard.id);
    const channel = supabase
      .channel(`agency-project-msgs-${openCard.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "agency_project_messages", filter: `project_id=eq.${openCard.id}` },
        () => void loadMessages(openCard.id),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [openCard, loadMessages]);

  const grouped = useMemo(() => {
    const map: Record<ProjectStage, AgencyProject[]> = {
      Draft: [],
      Requested: [],
      "In Progress": [],
      "In Revision": [],
      Closed: [],
    };
    for (const p of projects) {
      (map[p.stage] ?? map.Draft).push(p);
    }
    return map;
  }, [projects]);

  const openNew = (stage: ProjectStage = "Draft") => {
    setEditing(null);
    setForm({ title: "", details: "", stage, priority: "normal", client: NO_CLIENT });
    setFormOpen(true);
  };

  const openEdit = (p: AgencyProject) => {
    setEditing(p);
    setForm({
      title: p.title,
      details: p.details ?? "",
      stage: p.stage,
      priority: p.priority,
      client: p.client_email || p.client_company || NO_CLIENT,
    });
    setFormOpen(true);
  };

  const resolveClient = (key: string): Partial<AgencyProject> => {
    if (key === NO_CLIENT) {
      return { client_email: null, client_name: null, client_company: null, location_id: null };
    }
    const match = clients.find((c) => (c.email || c.company) === key);
    return {
      client_email: match?.email ?? (key.includes("@") ? key : null),
      client_name: match?.name ?? null,
      client_company: match?.company ?? (key.includes("@") ? null : key),
      location_id: match?.locationId ?? null,
    };
  };

  const saveProject = async () => {
    if (!form.title.trim()) {
      toast.error("Give the project a title");
      return;
    }
    setSaving(true);
    const payload = {
      owner_email: ownerEmail.toLowerCase(),
      agency_id: agencyId,
      title: form.title.trim(),
      details: form.details.trim() || null,
      stage: form.stage,
      priority: form.priority,
      created_by: myEmail || null,
      ...resolveClient(form.client),
    };
    const { error } = editing
      ? await supabase.from("agency_projects").update(payload as never).eq("id", editing.id)
      : await supabase
          .from("agency_projects")
          .insert({ ...payload, position: (grouped[form.stage]?.length ?? 0) } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save the project");
      return;
    }
    toast.success(editing ? "Project updated" : "Project added");
    setFormOpen(false);
    void load();
  };

  const moveToStage = async (project: AgencyProject, stage: ProjectStage) => {
    if (project.stage === stage) return;
    const previous = projects;
    setProjects((cur) => cur.map((p) => (p.id === project.id ? { ...p, stage } : p)));
    const { error } = await supabase
      .from("agency_projects")
      .update({ stage, position: grouped[stage]?.length ?? 0 } as never)
      .eq("id", project.id);
    if (error) {
      setProjects(previous);
      toast.error("Could not move that card");
      return;
    }
  };

  const removeProject = async (project: AgencyProject) => {
    const previous = projects;
    setProjects((cur) => cur.filter((p) => p.id !== project.id));
    setOpenCard(null);
    const { error } = await supabase.from("agency_projects").delete().eq("id", project.id);
    if (error) {
      setProjects(previous);
      toast.error("Could not delete that card");
    }
  };

  const sendMessage = async () => {
    if (!openCard || !messageDraft.trim()) return;
    setSending(true);
    const { error } = await supabase.from("agency_project_messages").insert({
      project_id: openCard.id,
      sender_role: isAdmin ? "admin" : "owner",
      sender_email: myEmail || null,
      message: messageDraft.trim(),
    } as never);
    setSending(false);
    if (error) {
      toast.error("Message didn't send");
      return;
    }
    setMessageDraft("");
    setCounts((c) => ({ ...c, [openCard.id]: (c[openCard.id] || 0) + 1 }));
    void loadMessages(openCard.id);
  };

  const clientLabel = (p: AgencyProject) =>
    p.client_company || p.client_name || p.client_email || null;

  return (
    <SectionCard
      icon={<Kanban />}
      title={title}
      description={description}
      actions={
        <>
          <Button
            variant="outline"
            size="icon"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh projects"
            title="Refresh projects"
          >
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
          <Button onClick={() => openNew()}>
            <Plus /> New request
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {PROJECT_STAGES.map((stage) => {
          const style = STAGE_STYLES[stage];
          const cards = grouped[stage];
          const isHover = hoverStage === stage && dragId !== null;
          return (
            <div
              key={stage}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverStage(stage);
              }}
              onDragLeave={() => setHoverStage((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                const project = projects.find((p) => p.id === id);
                setHoverStage(null);
                setDragId(null);
                if (project) void moveToStage(project, stage);
              }}
              className={cn(
                "min-w-0 rounded-lg bg-muted/60 transition-shadow duration-200",
                isHover ? `ring-2 ${style.ring}` : "ring-0",
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`size-2 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
                  <span className="truncate text-sm font-semibold text-foreground">{stage}</span>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{cards.length}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openNew(stage)}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  title={`Add to ${stage}`}
                  aria-label={`Add to ${stage}`}
                >
                  <Plus className="size-4" />
                </button>
              </div>

              <div className="p-2 space-y-2 min-h-[120px]">
                <AnimatePresence initial={false}>
                  {cards.map((p) => (
                    <motion.div
                      key={p.id}
                      layout
                      layoutId={p.id}
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{
                        opacity: dragId === p.id ? 0.4 : 1,
                        y: 0,
                        scale: dragId === p.id ? 1.03 : 1,
                        rotate: dragId === p.id ? -1.5 : 0,
                      }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      draggable
                      onDragStart={(e) => {
                        const ev = e as unknown as React.DragEvent;
                        ev.dataTransfer?.setData("text/plain", p.id);
                        setDragId(p.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setHoverStage(null);
                      }}
                      onClick={() => setOpenCard(p)}
                      whileHover={{ y: -2 }}
                      className="group cursor-grab rounded-md bg-card p-3 shadow-card transition-shadow hover:shadow-raised active:cursor-grabbing"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/60 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium leading-snug text-foreground">{p.title}</p>
                          {p.details && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.details}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <Badge variant={PRIORITY_TONES[p.priority]} className={CHIP}>
                              {p.priority}
                            </Badge>
                            {clientLabel(p) && (
                              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                <Building2 className="size-3 shrink-0" /> <span className="truncate">{clientLabel(p)}</span>
                              </span>
                            )}
                            {counts[p.id] ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-brand-subtle px-2 py-0.5 text-[11px] font-medium text-brand">
                                <MessageSquare className="size-3" /> {counts[p.id]}
                              </span>
                            ) : null}
                            <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock className="w-3 h-3" /> {relTime(p.updated_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isHover && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 52 }}
                    exit={{ opacity: 0, height: 0 }}
                    className={`rounded-md border-2 border-dashed ${style.drop} bg-card/60`}
                  />
                )}

                {!cards.length && !isHover && (
                  <p className="py-6 text-center text-xs text-muted-foreground">Drop cards here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit request" : "New request"}</DialogTitle>
            <DialogDescription>Tell us what you need and who it's for.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Build the onboarding funnel for..."
                className="mt-1"
              />
            </div>
            <div>
              <Label>Details</Label>
              <Textarea
                value={form.details}
                onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                placeholder="Everything we need to know to get started"
                rows={4}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Stage</Label>
                <Select
                  value={form.stage}
                  onValueChange={(v) => setForm((f) => ({ ...f, stage: v as ProjectStage }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm((f) => ({ ...f, priority: v as Priority }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={form.client} onValueChange={(v) => setForm((f) => ({ ...f, client: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT}>No specific client</SelectItem>
                  {clients
                    .filter((c) => c.email || c.company)
                    .map((c) => {
                      const key = (c.email || c.company) as string;
                      return (
                        <SelectItem key={key} value={key}>
                          {c.company || c.name || c.email}
                          {c.company && c.name ? ` — ${c.name}` : ""}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={() => void saveProject()} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              {editing ? "Save changes" : "Add request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card detail + thread */}
      <Dialog open={!!openCard} onOpenChange={(o) => !o && setOpenCard(null)}>
        <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto">
          {openCard && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-start gap-2 pr-6">
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${STAGE_STYLES[openCard.stage].dot}`} aria-hidden="true" />
                  <span className="break-words">{openCard.title}</span>
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-medium ${STAGE_STYLES[openCard.stage].head}`}>
                    {openCard.stage}
                  </span>
                  <Badge variant={PRIORITY_TONES[openCard.priority]} className={CHIP}>
                    {openCard.priority}
                  </Badge>
                  {clientLabel(openCard) && (
                    <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {clientLabel(openCard)}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              {openCard.details && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{openCard.details}</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={openCard.stage}
                  onValueChange={(v) => {
                    void moveToStage(openCard, v as ProjectStage);
                    setOpenCard({ ...openCard, stage: v as ProjectStage });
                  }}
                >
                  <SelectTrigger className="w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={() => openEdit(openCard)}>
                  Edit details
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void removeProject(openCard)}
                >
                  <Trash2 /> Delete
                </Button>
              </div>

              <div className="rounded-lg border border-border">
                <div className="flex items-center gap-1.5 border-b border-border px-3 py-2 text-sm font-semibold text-foreground">
                  <MessageSquare className="size-4 text-muted-foreground" /> Conversation
                </div>
                <div ref={threadRef} className="max-h-64 overflow-y-auto p-3 space-y-2">
                  {!messages.length && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No messages yet. Send the first one.
                    </p>
                  )}
                  <AnimatePresence initial={false}>
                    {messages.map((m) => {
                      const mine = isAdmin ? m.sender_role === "admin" : m.sender_role === "owner";
                      return (
                        <motion.div
                          key={m.id}
                          layout
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`flex ${mine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                              mine ? "bg-brand text-brand-foreground" : "bg-muted text-foreground"
                            }`}
                          >
                            <div className="text-[10px] opacity-70 flex items-center gap-1 mb-0.5">
                              <UserIcon className="w-3 h-3" />
                              {m.sender_role === "admin" ? "SaaSSuite team" : m.sender_email || "Agency"}
                              <span>· {relTime(m.created_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap break-words">{m.message}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <div className="flex items-end gap-2 border-t border-border p-2">
                  <Textarea
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder="Write a message…"
                    rows={2}
                    className="text-sm"
                  />
                  <Button
                    size="icon"
                    variant="accent"
                    aria-label="Send message"
                    onClick={() => void sendMessage()}
                    disabled={sending || !messageDraft.trim()}
                  >
                    {sending ? <Loader2 className="animate-spin" /> : <Send />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
