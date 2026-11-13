import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { SmoothInput, SmoothTextarea } from "@/components/ui/smooth-input";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  ChevronUp,
  ExternalLink,
  Lightbulb,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
import { relativeTime } from "./shared";
import type { CommunityProfile } from "@/hooks/useCommunityProfile";

type Idea = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  status: string | null;
  upvotes: number | null;
  created_at: string | null;
  implemented_date: string | null;
  live_url: string | null;
};

type IdeaComment = {
  id: string;
  feature_id: string;
  user_name: string;
  comment_text: string;
  created_at: string;
  updated_at?: string | null;
};

const CATEGORIES = [
  "Client Hub",
  "Onboarding",
  "AI Support",
  "Branding",
  "Automations",
  "Reporting",
  "Other",
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  planned: "bg-brand/15 text-brand",
  // In development → purple
  in_progress: "bg-[hsl(270_85%_60%/0.15)] text-[hsl(270_85%_65%)]",
  // Live → green
  implemented: "bg-emerald-500/15 text-emerald-500",
};

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Development" },
  { value: "implemented", label: "Live" },
];

// Full-card treatment per status: colored border + light tinted background
const CARD_STYLES: Record<string, string> = {
  pending: "border-border bg-muted/20",
  planned: "border-brand/50 bg-brand/[0.06]",
  in_progress: "border-[hsl(270_85%_60%/0.5)] bg-[hsl(270_85%_60%/0.07)]",
  implemented: "border-emerald-500/50 bg-emerald-500/[0.07]",
};

function canonicalStatus(status?: string | null) {
  const normalized = (status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["live", "implemented", "complete", "completed", "done"].includes(normalized)) {
    return "implemented";
  }
  if (["in_development", "in_progress", "development"].includes(normalized)) {
    return "in_progress";
  }
  if (normalized === "planned") return "planned";
  return "pending";
}

function normalizeIdea(idea: Idea): Idea {
  return { ...idea, status: canonicalStatus(idea.status) };
}

function cardStyle(status?: string | null) {
  return CARD_STYLES[canonicalStatus(status)];
}

function statusLabel(status?: string | null) {
  return STATUS_OPTIONS.find((option) => option.value === canonicalStatus(status))?.label || "Pending";
}

export default function CommunityIdeas({
  profile,
  isStaff = false,
}: {
  profile: CommunityProfile | null;
  isStaff?: boolean;
}) {
  const { toast } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [openIdea, setOpenIdea] = useState<Idea | null>(null);
  const [comments, setComments] = useState<IdeaComment[]>([]);
  const [comment, setComment] = useState("");
  const [editIdea, setEditIdea] = useState<Idea | null>(null);
  const [editStatus, setEditStatus] = useState("pending");
  const [editLiveUrl, setEditLiveUrl] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");

  const voterId = profile?.id ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("feature_requests")
      .select("id, title, description, category, status, upvotes, created_at, implemented_date, live_url")
      .order("upvotes", { ascending: false })
      .limit(200);
    setIdeas(((data || []) as Idea[]).map(normalizeIdea));
    if (voterId) {
      const { data: votes } = await supabase
        .from("feature_upvotes")
        .select("feature_id")
        .eq("user_identifier", voterId);
      setMyVotes(new Set((votes || []).map((v: any) => v.feature_id)));
    }
    setLoading(false);
  }, [voterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadComments = useCallback(async (ideaId: string) => {
    const { data } = await supabase
      .from("feature_comments")
      .select("*")
      .eq("feature_id", ideaId)
      .order("created_at");
    setComments((data || []) as IdeaComment[]);
  }, []);

  const ownsComment = (c: IdeaComment) =>
    !!profile?.display_name && c.user_name === profile.display_name;

  const saveCommentEdit = async (c: IdeaComment) => {
    if (!editCommentText.trim()) return;
    const updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("feature_comments")
      .update({ comment_text: editCommentText.trim(), updated_at })
      .eq("id", c.id);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setComments((prev) =>
      prev.map((x) =>
        x.id === c.id ? { ...x, comment_text: editCommentText.trim(), updated_at } : x,
      ),
    );
    setEditingComment(null);
    setEditCommentText("");
  };

  const deleteIdeaComment = async (c: IdeaComment) => {
    const { error } = await supabase.from("feature_comments").delete().eq("id", c.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    setComments((prev) => prev.filter((x) => x.id !== c.id));
  };

  useEffect(() => {
    if (openIdea) void loadComments(openIdea.id);
  }, [openIdea, loadComments]);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(ideas.map((i) => i.category).filter(Boolean)))],
    [ideas],
  );

  const visible = ideas.filter((i) => filter === "all" || i.category === filter);

  const openEditor = (idea: Idea) => {
    setEditIdea(idea);
    setEditStatus(canonicalStatus(idea.status));
    setEditLiveUrl(idea.live_url || "");
  };

  const saveEdit = async () => {
    if (!editIdea) return;
    setSavingEdit(true);
    const patch = {
      status: canonicalStatus(editStatus),
      live_url: editLiveUrl.trim() || null,
      implemented_date:
        editStatus === "implemented"
          ? editIdea.implemented_date || new Date().toISOString()
          : null,
    };
    const { error } = await supabase.from("feature_requests").update(patch).eq("id", editIdea.id);
    setSavingEdit(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    setIdeas((prev) => prev.map((i) => (i.id === editIdea.id ? { ...i, ...patch } : i)));
    setOpenIdea((prev) => (prev && prev.id === editIdea.id ? { ...prev, ...patch } : prev));
    setEditIdea(null);
    toast({ title: "Idea updated" });
  };

  const renderEditor = () => (
    <Dialog open={!!editIdea} onOpenChange={(o) => !o && setEditIdea(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update idea</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{editIdea?.title}</p>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Link to the post (for live features)</Label>
            <SmoothInput
              value={editLiveUrl}
              onChange={(e) => setEditLiveUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEditIdea(null)}>
            Cancel
          </Button>
          <Button disabled={savingEdit} onClick={saveEdit}>
            {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const toggleVote = async (idea: Idea) => {
    if (!voterId) return;
    const voted = myVotes.has(idea.id);
    setMyVotes((prev) => {
      const next = new Set(prev);
      voted ? next.delete(idea.id) : next.add(idea.id);
      return next;
    });
    setIdeas((prev) =>
      prev.map((i) =>
        i.id === idea.id ? { ...i, upvotes: Math.max(0, (i.upvotes || 0) + (voted ? -1 : 1)) } : i,
      ),
    );
    // Keep the open detail view in sync so its count updates immediately too.
    setOpenIdea((prev) =>
      prev && prev.id === idea.id ? { ...prev, upvotes: Math.max(0, (prev.upvotes || 0) + (voted ? -1 : 1)) } : prev,
    );
    // The upvote total on the idea is kept in sync by the database.
    if (voted) {
      await supabase
        .from("feature_upvotes")
        .delete()
        .eq("feature_id", idea.id)
        .eq("user_identifier", voterId);
    } else {
      await supabase
        .from("feature_upvotes")
        .insert({ feature_id: idea.id, user_identifier: voterId });
    }
  };

  const submitIdea = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("feature_requests").insert({
      title: title.trim(),
      description: description.trim() || null,
      category,
      status: "pending",
      upvotes: 0,
      created_by: profile?.display_name ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not submit", description: error.message, variant: "destructive" });
      return;
    }
    setTitle("");
    setDescription("");
    setDialogOpen(false);
    toast({ title: "Idea submitted", description: "Thanks — the team reviews these weekly." });
    void load();
  };

  const addComment = async () => {
    if (!openIdea || !comment.trim()) return;
    const { error } = await supabase.from("feature_comments").insert({
      feature_id: openIdea.id,
      user_name: profile?.display_name || "Member",
      comment_text: comment.trim(),
    });
    if (error) {
      toast({ title: "Could not comment", description: error.message, variant: "destructive" });
      return;
    }
    setComment("");
    void loadComments(openIdea.id);
  };

  if (openIdea) {
    const editorDialog = renderEditor();
    return (
      <motion.div
        className="space-y-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => setOpenIdea(null)}>
          <ArrowLeft className="h-4 w-4" /> All ideas
        </Button>
        <Card className={cardStyle(openIdea.status)}>
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {openIdea.category}
              </Badge>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  STATUS_STYLES[canonicalStatus(openIdea.status)]
                }`}
              >
                {statusLabel(openIdea.status)}
              </span>
              {openIdea.created_at && (
                <span className="text-xs text-muted-foreground">{relativeTime(openIdea.created_at)}</span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-foreground">{openIdea.title}</h2>
            {openIdea.description && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{openIdea.description}</p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={myVotes.has(openIdea.id) ? "default" : "outline"}
                className="gap-1.5"
                onClick={() => toggleVote(openIdea)}
              >
                <ChevronUp className="h-4 w-4" /> {openIdea.upvotes || 0} upvotes
              </Button>
              {canonicalStatus(openIdea.status) === "implemented" && openIdea.live_url && (
                <Button size="sm" variant="outline" className="gap-1.5" asChild>
                  <a href={openIdea.live_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> View the post
                  </a>
                </Button>
              )}
              {isStaff && (
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openEditor(openIdea)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit status
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <SmoothTextarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add your thoughts..."
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={!comment.trim()} onClick={addComment}>
                  Comment
                </Button>
              </div>
            </div>
            <AnimatePresence initial={false}>
              {comments.map((c) => (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="rounded-lg bg-muted/40 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{c.user_name}</span>
                    <span className="text-xs text-muted-foreground">{relativeTime(c.created_at)}</span>
                  </div>
                  {editingComment === c.id ? (
                    <div className="mt-2 space-y-2">
                      <SmoothTextarea
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditingComment(null)}>
                          Cancel
                        </Button>
                        <Button variant="accent"
                          size="sm"
                          disabled={!editCommentText.trim()}
                          onClick={() => void saveCommentEdit(c)}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                      {c.comment_text}
                      {c.updated_at && c.updated_at !== c.created_at && (
                        <span className="ml-1.5 text-[11px] text-muted-foreground">(edited)</span>
                      )}
                    </p>
                  )}
                  {(ownsComment(c) || isStaff) && editingComment !== c.id && (
                    <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => {
                          setEditingComment(c.id);
                          setEditCommentText(c.comment_text);
                        }}
                      >
                        <Pencil className="h-3 w-3" /> Edit
                      </button>
                      <button
                        className="flex items-center gap-1 hover:text-destructive"
                        onClick={() => void deleteIdeaComment(c)}
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </CardContent>
        </Card>
        {editorDialog}
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={filter === cat ? "default" : "outline"}
              className="capitalize"
              onClick={() => setFilter(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="accent" className="h-11 gap-2 sm:h-9" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Submit idea
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="px-surface">
          <EmptyState
            icon={
              <EmptyStateIllustration className="rounded-lg border-border bg-muted text-muted-foreground">
                <Plus className="size-7" aria-hidden="true" />
              </EmptyStateIllustration>
            }
            title="No ideas here yet"
            description="Tell us what would make SaaSSuite better. Other agencies can vote your idea up."
            action={
              <Button variant="accent" onClick={() => setDialogOpen(true)}>
                <Plus /> Submit an idea
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((idea, i) => {
            const voted = myVotes.has(idea.id);
            return (
              <motion.div
                key={idea.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3) }}
              >
                <Card
                  className={`cursor-pointer transition-colors hover:brightness-105 ${cardStyle(idea.status)}`}
                  onClick={() => setOpenIdea(idea)}
                >
                  <CardContent className="flex items-start gap-3 py-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleVote(idea);
                      }}
                      className={`flex w-12 flex-col items-center rounded-md border py-1.5 transition-colors ${
                        voted
                          ? "border-brand/50 bg-brand-subtle text-brand"
                          : "border-border text-muted-foreground hover:border-brand/40"
                      }`}
                    >
                      <ChevronUp className="h-4 w-4" />
                      <span className="text-xs font-semibold">{idea.upvotes || 0}</span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="truncate text-sm font-medium text-foreground">{idea.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            STATUS_STYLES[canonicalStatus(idea.status)]
                          }`}
                        >
                          {statusLabel(idea.status)}
                        </span>
                      </div>
                      {idea.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{idea.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="capitalize">{idea.category}</span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> Discuss
                        </span>
                        {canonicalStatus(idea.status) === "implemented" && idea.live_url && (
                          <a
                            href={idea.live_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1 text-emerald-500 hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" /> View the post
                          </a>
                        )}
                        {isStaff && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditor(idea);
                            }}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit an idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <SmoothInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What should we build?"
              />
            </div>
            <div className="space-y-2">
              <Label>Details</Label>
              <SmoothTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="What problem does this solve for your agency?"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!title.trim() || submitting} onClick={submitIdea}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderEditor()}
    </div>
  );
}