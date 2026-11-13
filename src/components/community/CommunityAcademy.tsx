import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Reorder, motion, useDragControls, type DragControls } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,

  Circle,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  FileText,
  GripVertical,
  Library,
  Loader2,
  Lock,
  Pencil,
  PlayCircle,
  Plus,
  Sparkles,
  Upload,
  Wrench,
} from "lucide-react";
import type { CommunityProfile } from "@/hooks/useCommunityProfile";
import { STAGES, STAGE_STYLES, type Stage } from "@/constants/academyContent";
import {
  resolveAcademyImageUrl,
  resolveAcademyImageUrls,
  preloadImages,


  resolveAcademyUrl,
  downloadAcademyFile,
  STORAGE_PREFIX,
  useAcademyContent,
  type AcademyKind,
  type AcademyRow,
} from "@/hooks/useAcademyContent";
import AcademyItemEditor from "./AcademyItemEditor";
import { useEditMode } from "@/hooks/useEditMode";

type SectionId = "lessons" | "prompts" | "skills" | "tech";

const SECTIONS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "lessons", label: "Lessons", icon: PlayCircle },
  { id: "prompts", label: "Prompts", icon: Sparkles },
  { id: "skills", label: "Skills", icon: Wrench },
  { id: "tech", label: "Tech Library", icon: Library },
];

const SECTION_KIND: Record<SectionId, AcademyKind> = {
  lessons: "lesson",
  prompts: "prompt",
  skills: "skill",
  tech: "tech",
};

const STORAGE_KEY = "community-academy-completed";
const SKILL_PACK_BUCKET = "community-skill-packs";
/** The original Claude + GHL skill pack is still served from its own bucket. */
const LEGACY_PACK_SLUG = "claude-ghl-skill";

type StoredSkillPack = {
  name: string;
  updated_at?: string | null;
};

function youtubeThumb(videoUrl: string | null): string | null {
  if (!videoUrl) return null;
  const match = videoUrl.match(/(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match ? `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg` : null;
}

function StageTag({ stage }: { stage: Stage | null }) {
  if (!stage) return null;
  const label = STAGES.find((s) => s.id === stage)?.label ?? stage;
  return (
    <Badge variant="outline" className={`text-[10px] uppercase tracking-wide ${STAGE_STYLES[stage]}`}>
      {label}
    </Badge>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function FadeCard({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

/** Small pencil overlay shown to the owner on every card. */
function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      size="icon"
      variant="secondary"
      className="absolute right-2 top-2 z-10 h-7 w-7 shadow"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label="Edit item"
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}

/** Grip handle the owner drags to reorder a card. */
function DragHandle({ controls }: { controls: DragControls }) {
  return (
    <button
      type="button"
      aria-label="Drag to reorder"
      className="absolute left-2 top-2 z-10 flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-md bg-secondary text-secondary-foreground shadow active:cursor-grabbing"
      onPointerDown={(event) => {
        event.preventDefault();
        controls.start(event);
      }}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
}

/** A card that becomes a drag-sortable item when `sortable` (owner, unfiltered view). */
function SortableCard({
  id,
  index,
  sortable,
  onDrop,
  children,
}: {
  id: string;
  index: number;
  sortable: boolean;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  const controls = useDragControls();
  if (!sortable) return <FadeCard index={index}>{children}</FadeCard>;
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDrop}
      className="relative h-full"
    >
      <FadeCard index={index}>{children}</FadeCard>
      <DragHandle controls={controls} />
    </Reorder.Item>
  );
}

/** Grid that switches to a Reorder.Group while sorting is active. */
function SortableGrid({
  sortable,
  ids,
  onReorder,
  children,
}: {
  sortable: boolean;
  ids: string[];
  onReorder: (ids: string[]) => void;
  children: React.ReactNode;
}) {
  if (!sortable) return <Grid>{children}</Grid>;
  return (
    <Reorder.Group
      as="div"
      values={ids}
      onReorder={onReorder}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {children}
    </Reorder.Group>
  );
}

export default function CommunityAcademy({
  profile,
  isPaid,
  isOwner = false,
  initialSection,
  onSectionChange,
}: {
  profile: CommunityProfile | null;
  isPaid: boolean;
  isOwner?: boolean;
  initialSection?: SectionId;
  onSectionChange?: (section: SectionId) => void;
}) {
  const [section, setSection] = useState<SectionId>(initialSection ?? "lessons");

  // Follow deep links like /app/community/prompts when the URL changes.
  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  // Skill landing pages deep-link here with ?skill=<slug> — spotlight that card.
  const location = useLocation();
  const highlightSkill = useMemo(
    () => new URLSearchParams(location.search).get("skill"),
    [location.search],
  );
  const [stage, setStage] = useState<Stage | "all">("all");
  const [openLesson, setOpenLesson] = useState<AcademyRow | null>(null);
  const [lessonSrc, setLessonSrc] = useState<string | null>(null);
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [skillPack, setSkillPack] = useState<StoredSkillPack | null>(null);
  const [skillPackBusy, setSkillPackBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AcademyRow | null>(null);
  const [notifyRequested, setNotifyRequested] = useState<Set<string>>(new Set());
  const [notifyBusy, setNotifyBusy] = useState<string | null>(null);

  // Remember which "coming soon" lessons this user already asked to be pinged about.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from("academy_notify_requests").select("item_id");
      if (cancelled || !data) return;
      setNotifyRequested(new Set(data.map((r: { item_id: string }) => r.item_id)));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestNotify = useCallback(async (lesson: AcademyRow) => {
    const key = lesson.slug || lesson.id;
    setNotifyBusy(key);
    const { error } = await supabase.functions.invoke("academy-notify-request", {
      body: { item_id: key, item_title: lesson.title },
    });
    setNotifyBusy(null);
    if (error) {
      toast({ title: "Could not save that", description: error.message, variant: "destructive" });
      return;
    }
    setNotifyRequested((prev) => new Set(prev).add(key));
    toast({ title: "You're on the list", description: `We'll ping you when "${lesson.title}" drops.` });
  }, []);


  // Owner-only presentation switch: hides pencils/grips when edit mode is off.
  const { editMode } = useEditMode();
  const canEdit = isOwner && editMode;

  const { rows, isLoading, refetch } = useAcademyContent(canEdit);

  // Owner drag-to-reorder: local draft order until the drop persists.
  const [draftOrder, setDraftOrder] = useState<Partial<Record<AcademyKind, AcademyRow[]>>>({});

  const listFor = useCallback(
    (kind: AcademyKind) => draftOrder[kind] ?? rows.filter((r) => r.kind === kind),
    [draftOrder, rows],
  );

  const applyReorder = useCallback(
    (kind: AcademyKind, ids: string[]) => {
      const full = rows.filter((r) => r.kind === kind);
      const byId = new Map(full.map((r) => [r.id, r]));
      const next = ids.map((id) => byId.get(id)).filter((r): r is AcademyRow => Boolean(r));
      setDraftOrder((prev) => ({ ...prev, [kind]: next }));
    },
    [rows],
  );

  const persistOrder = useCallback(
    async (kind: AcademyKind) => {
      const list = draftOrder[kind];
      if (!list) return;
      const results = await Promise.all(
        list.map((row, index) =>
          supabase
            .from("academy_content")
            .update({ sort_order: (index + 1) * 10 })
            .eq("id", row.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        toast({ title: "Could not save order", description: failed.error.message, variant: "destructive" });
      }
      setDraftOrder((prev) => ({ ...prev, [kind]: undefined }));
      await refetch();
    },
    [draftOrder, refetch],
  );

  const openEditor = (item: AcademyRow | null) => {
    setEditing(item);
    setEditorOpen(true);
  };

  const loadSkillPack = useCallback(async () => {
    try {
      const bucket = supabase.storage.from(SKILL_PACK_BUCKET);
      if (typeof bucket.list !== "function") {
        setSkillPack(null);
        return;
      }
      const { data, error } = await bucket.list("", {
        limit: 100,
        sortBy: { column: "updated_at", order: "desc" },
      });
      if (error || !Array.isArray(data)) {
        setSkillPack(null);
        return;
      }
      const file = data.find((item) => item.name !== ".emptyFolderPlaceholder");
      setSkillPack(file ? { name: file.name, updated_at: file.updated_at } : null);
    } catch {
      setSkillPack(null);
    }
  }, []);

  useEffect(() => {
    void loadSkillPack();
  }, [loadSkillPack]);

  // Resolve any uploaded (private-storage) lesson video into a playable URL.
  useEffect(() => {
    let cancelled = false;
    if (!openLesson) {
      setLessonSrc(null);
      return;
    }
    void (async () => {
      const url = await resolveAcademyUrl(openLesson.video_url);
      if (!cancelled) setLessonSrc(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [openLesson]);

  const uploadSkillPack = async (file: File) => {
    if (!canEdit) return;
    setSkillPackBusy(true);
    try {
      const { data: existing, error: listError } = await supabase.storage
        .from(SKILL_PACK_BUCKET)
        .list("", { limit: 100 });
      if (listError) throw listError;

      const { error: uploadError } = await supabase.storage
        .from(SKILL_PACK_BUCKET)
        .upload(file.name, file, { contentType: file.type || "application/octet-stream", upsert: true });
      if (uploadError) throw uploadError;

      const oldFiles = (existing || [])
        .filter((item) => item.name !== file.name && item.name !== ".emptyFolderPlaceholder")
        .map((item) => item.name);
      if (oldFiles.length) {
        const { error: removeError } = await supabase.storage.from(SKILL_PACK_BUCKET).remove(oldFiles);
        if (removeError) throw removeError;
      }

      setSkillPack({ name: file.name, updated_at: new Date().toISOString() });
      toast({ title: "Skill pack uploaded", description: `${file.name} is now the live download.` });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSkillPackBusy(false);
    }
  };

  const downloadSkillPack = async () => {
    if (!skillPack) return;
    setSkillPackBusy(true);
    try {
      const { data, error } = await supabase.storage.from(SKILL_PACK_BUCKET).download(skillPack.name);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = skillPack.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSkillPackBusy(false);
    }
  };

  const downloadSkillFile = async (skill: AcademyRow) => {
    const ok = await downloadAcademyFile(skill.file_url, skill.file_label);
    if (!ok) toast({ title: "File unavailable", variant: "destructive" });
  };

  // Load saved completions from Supabase (falls back to any legacy local state).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return;
      const { data } = await supabase
        .from("community_academy_progress")
        .select("item_id")
        .eq("user_id", userId);
      if (cancelled) return;
      const remote = new Set((data || []).map((r: { item_id: string }) => r.item_id));

      // One-time migration of legacy localStorage progress.
      try {
        const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as string[];
        const missing = legacy.filter((id) => !remote.has(id));
        if (missing.length) {
          await supabase
            .from("community_academy_progress")
            .upsert(missing.map((item_id) => ({ user_id: userId, item_id })), {
              onConflict: "user_id,item_id",
            });
          missing.forEach((id) => remote.add(id));
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        /* ignore malformed legacy data */
      }
      if (!cancelled) setCompleted(remote);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleComplete = useCallback(
    async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) {
        toast({ title: "Sign in required", description: "Log in to save your progress.", variant: "destructive" });
        return;
      }
      const wasDone = completed.has(id);
      setCompleted((prev) => {
        const next = new Set(prev);
        if (wasDone) next.delete(id);
        else next.add(id);
        return next;
      });
      const { error } = wasDone
        ? await supabase
            .from("community_academy_progress")
            .delete()
            .eq("user_id", userId)
            .eq("item_id", id)
        : await supabase
            .from("community_academy_progress")
            .upsert({ user_id: userId, item_id: id }, { onConflict: "user_id,item_id" });
      if (error) {
        setCompleted((prev) => {
          const next = new Set(prev);
          if (wasDone) next.add(id);
          else next.delete(id);
          return next;
        });
        toast({ title: "Could not save progress", description: error.message, variant: "destructive" });
      }
    },
    [completed],
  );

  const byStage = (items: AcademyRow[]) =>
    stage === "all" ? items : items.filter((i) => i.stage === stage);

  const lessons = useMemo(() => byStage(listFor("lesson")), [listFor, stage]);
  const prompts = useMemo(() => byStage(listFor("prompt")), [listFor, stage]);
  const skills = useMemo(() => byStage(listFor("skill")), [listFor, stage]);

  // Bring the spotlighted skill into view once the grid has rendered.
  useEffect(() => {
    if (section !== "skills" || !highlightSkill || isLoading) return;
    const t = setTimeout(() => {
      document
        .getElementById(`skill-${highlightSkill}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 350);
    return () => clearTimeout(t);
  }, [section, highlightSkill, isLoading, skills.length]);
  const tech = useMemo(() => listFor("tech"), [listFor]);

  // Dragging only makes sense on the full, unfiltered list for a kind.
  const canSort = canEdit && (section === "tech" || stage === "all");

  // Thumbnails are signed in a single batched request (cached across mounts).
  // If a signed image still fails to load, we fall back to a blob download.
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [thumbsReady, setThumbsReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const refs = Array.from(
      new Set(
        rows
          .map((r) => r.thumbnail_url)
          .filter((u): u is string => Boolean(u) && u.startsWith(STORAGE_PREFIX)),
      ),
    );
    if (!refs.length) {
      if (rows.length) setThumbsReady(true);
      return;
    }
    // Never hold the grid hostage: show lessons after 1.5s even if images lag.
    const fallback = setTimeout(() => {
      if (!cancelled) setThumbsReady(true);
    }, 1500);
    void resolveAcademyImageUrls(refs)
      .then(async (map) => {
        if (cancelled) return;
        setThumbUrls((prev) => ({ ...prev, ...map }));
        // Wait for the images themselves so cards never flash a placeholder.
        await preloadImages(Object.values(map));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setThumbsReady(true);
      });
    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [rows]);

  const recoverThumb = useCallback(async (ref: string) => {
    const blob = await resolveAcademyImageUrl(ref);
    if (blob) setThumbUrls((prev) => ({ ...prev, [ref]: blob }));
  }, []);




  const copyPrompt = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "Prompt copied", description: "Paste it into your AI agent or workflow." });
  };

  /** Progress keys stay stable across edits by using the slug when present. */
  const progressKey = (item: AcademyRow) => item.slug || item.id;

  if (openLesson) {
    const done = completed.has(progressKey(openLesson));
    const isEmbeddable = !openLesson.external_url;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => setOpenLesson(null)}>
          <ArrowLeft className="h-4 w-4" /> All lessons
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">{openLesson.title}</h2>
          <StageTag stage={openLesson.stage} />
          {canEdit && (
            <Button size="sm" variant="outline" className="gap-2" onClick={() => openEditor(openLesson)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
        </div>
        {isEmbeddable ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
            {lessonSrc && lessonSrc.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
              <video src={lessonSrc} controls className="h-full w-full" />
            ) : (
              <iframe
                src={lessonSrc ?? undefined}
                title={openLesson.title}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-muted/40 p-6">
            <p className="text-sm text-muted-foreground">
              This session is hosted on our webinar platform and opens in a new tab.
            </p>
            <Button
              size="sm"
              className="gap-2"
              onClick={() => window.open(openLesson.external_url!, "_blank", "noopener,noreferrer")}
            >
              <PlayCircle className="h-3.5 w-3.5" /> Watch the replay
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {openLesson.duration_minutes ? `${openLesson.duration_minutes} min · ` : ""}
          {openLesson.format}
        </p>
        {openLesson.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{openLesson.description}</p>
        )}
        <Button
          size="sm"
          className="gap-2"
          variant={done ? "outline" : "default"}
          onClick={() => void toggleComplete(progressKey(openLesson))}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {done ? "Completed" : "Mark complete"}
        </Button>
        <AcademyItemEditor
          open={editorOpen}
          kind="lesson"
          item={editing}
          onClose={() => setEditorOpen(false)}
          onSaved={() => {
            setOpenLesson(null);
            void refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Button
              key={s.id}
              size="sm"
              variant={section === s.id ? "default" : "outline"}
              className="gap-2"
              onClick={() => { setSection(s.id); onSectionChange?.(s.id); }}
            >
              <Icon className="h-3.5 w-3.5" />
              {s.label}
            </Button>
          );
        })}
      </div>

      {section !== "tech" && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={stage === "all" ? "secondary" : "ghost"}
            className="h-7 rounded-full px-3 text-xs"
            onClick={() => setStage("all")}
          >
            All stages
          </Button>
          {STAGES.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={stage === s.id ? "secondary" : "ghost"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setStage(s.id)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-xs text-muted-foreground">
            Owner tools — add, edit, unpublish or delete anything here. Drag the grip handle (top-left of a card)
            to reorder; the new order saves when you drop.
          </p>
          <Button size="sm" className="gap-2" onClick={() => openEditor(null)}>
            <Plus className="h-3.5 w-3.5" /> Add {SECTION_KIND[section]}
          </Button>
        </div>
      )}

      {((isLoading && rows.length === 0) ||
        (section === "lessons" && lessons.length > 0 && !thumbsReady)) && (
        <Grid>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={`sk-${i}`} className="overflow-hidden">
              <div className="aspect-video w-full animate-pulse bg-muted" />
              <CardContent className="space-y-2 pt-4">
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </Grid>
      )}

      {section === "lessons" && (thumbsReady || lessons.length === 0) && (

        <SortableGrid
          sortable={canSort}
          ids={lessons.map((l) => l.id)}
          onReorder={(ids) => applyReorder("lesson", ids)}
        >
          {lessons.map((lesson, i) => {
            const done = completed.has(progressKey(lesson));
            const rawThumb = lesson.thumbnail_url;
            const isStoredThumb = Boolean(rawThumb?.startsWith(STORAGE_PREFIX));
            const resolvedThumb = rawThumb ? (isStoredThumb ? thumbUrls[rawThumb] : rawThumb) : null;
            // An uploaded thumbnail always wins — never fall back to YouTube's when one exists.
            const thumb = resolvedThumb || (rawThumb ? null : youtubeThumb(lesson.video_url));
            const thumbPending = Boolean(rawThumb) && !resolvedThumb;
            const comingSoon = !lesson.video_url && !lesson.external_url;
            const notified = notifyRequested.has(progressKey(lesson));
            return (
              <SortableCard key={lesson.id} id={lesson.id} index={i} sortable={canSort} onDrop={() => void persistOrder("lesson")}>
                <Card className="relative flex h-full flex-col transition-colors hover:border-primary/40">
                  {canEdit && <EditButton onClick={() => openEditor(lesson)} />}
                  {comingSoon ? (
                    thumb ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-t-lg bg-muted">
                        <img
                          src={thumb}
                          alt={`${lesson.title} thumbnail`}
                          decoding="async"
                          onError={() => {
                            if (rawThumb && isStoredThumb) void recoverThumb(rawThumb);
                          }}
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          <Clock className="h-3 w-3" /> Coming soon
                        </span>
                      </div>
                    ) : (
                      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-t-lg bg-gradient-to-br from-muted to-muted/40">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Video coming soon
                        </span>
                      </div>
                    )
                  ) : thumbPending ? (
                    <div className="aspect-video w-full animate-pulse rounded-t-lg bg-muted" />
                  ) : thumb ? (
                    <button
                      type="button"
                      onClick={() => setOpenLesson(lesson)}
                      className="group relative block aspect-video w-full overflow-hidden rounded-t-lg bg-muted"
                    >
                      <img
                        src={thumb}
                        alt={`${lesson.title} thumbnail`}
                        decoding="async"
                        onError={() => {
                          if (rawThumb && isStoredThumb) void recoverThumb(rawThumb);
                        }}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-background/20 opacity-0 transition-opacity group-hover:opacity-100">
                        <PlayCircle className="h-10 w-10 text-primary" />
                      </span>
                    </button>
                  ) : lesson.video_url && /\.(mp4|webm|mov)(\?|#|$)/i.test(lesson.video_url) ? (
                    <button
                      type="button"
                      onClick={() => setOpenLesson(lesson)}
                      className="group relative block aspect-video w-full overflow-hidden rounded-t-lg bg-muted"
                    >
                      <video
                        src={`${lesson.video_url.split("#")[0]}#t=0.1`}
                        preload="metadata"
                        muted
                        playsInline
                        aria-label={`${lesson.title} thumbnail`}
                        className="pointer-events-none h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-background/20">
                        <PlayCircle className="h-10 w-10 text-primary" />
                      </span>
                    </button>
                  ) : (

                    <button
                      type="button"
                      onClick={() => setOpenLesson(lesson)}
                      className="flex aspect-video w-full items-center justify-center rounded-t-lg bg-gradient-to-br from-primary/20 to-primary/5"
                    >
                      <PlayCircle className="h-10 w-10 text-primary" />
                    </button>
                  )}
                  <CardContent className="flex flex-1 flex-col pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StageTag stage={lesson.stage} />
                        {canEdit && !lesson.is_published && (
                          <Badge variant="secondary" className="gap-1 text-[10px]">
                            <EyeOff className="h-3 w-3" /> Draft
                          </Badge>
                        )}
                      </div>
                      {comingSoon ? null : done ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{lesson.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {comingSoon
                        ? "We're filming this one — get pinged the moment it goes live."
                        : `${lesson.duration_minutes ? `${lesson.duration_minutes} min · ` : ""}${lesson.format ?? ""}`}
                    </p>
                    <div className="mt-auto pt-4">
                      {comingSoon ? (
                        <Button
                          size="sm"
                          variant={notified ? "outline" : "default"}
                          className="w-full gap-2"
                          disabled={notified || notifyBusy === progressKey(lesson)}
                          onClick={() => void requestNotify(lesson)}
                        >
                          {notifyBusy === progressKey(lesson) ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : notified ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Bell className="h-3.5 w-3.5" />
                          )}
                          {notified ? "We'll notify you" : "Notify me when it drops"}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full gap-2" onClick={() => setOpenLesson(lesson)}>
                          <PlayCircle className="h-3.5 w-3.5" /> Watch lesson
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </SortableCard>
            );
          })}

        </SortableGrid>
      )}

      {section === "prompts" && (
        <SortableGrid
          sortable={canSort}
          ids={prompts.map((p) => p.id)}
          onReorder={(ids) => applyReorder("prompt", ids)}
        >
          {prompts.map((prompt, i) => {
            const expanded = openPrompt === prompt.id;
            return (
              <SortableCard key={prompt.id} id={prompt.id} index={i} sortable={canSort} onDrop={() => void persistOrder("prompt")}>
                <Card className="relative flex h-full flex-col transition-colors hover:border-primary/40">
                  {canEdit && <EditButton onClick={() => openEditor(prompt)} />}
                  <CardContent className="flex flex-1 flex-col pt-5">
                    <div className="flex flex-wrap items-center gap-2 pr-8">
                      <StageTag stage={prompt.stage} />
                      {prompt.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {prompt.category}
                        </Badge>
                      )}
                      {canEdit && !prompt.is_published && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <EyeOff className="h-3 w-3" /> Draft
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{prompt.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{prompt.description}</p>
                    {expanded && (
                      <motion.pre
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-[11px] leading-relaxed text-foreground"
                      >
                        {prompt.prompt_text}
                      </motion.pre>
                    )}
                    <div className="mt-auto flex gap-2 pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={() => setOpenPrompt(expanded ? null : prompt.id)}
                      >
                        <FileText className="h-3.5 w-3.5" /> {expanded ? "Hide" : "View"}
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={() => copyPrompt(prompt.prompt_text || "")}
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </SortableCard>
            );
          })}
        </SortableGrid>
      )}

      {section === "skills" && (
        <SortableGrid
          sortable={canSort}
          ids={skills.map((s) => s.id)}
          onReorder={(ids) => applyReorder("skill", ids)}
        >
          {skills.map((skill, i) => {
            const legacyPack = skill.slug === LEGACY_PACK_SLUG && !skill.file_url;
            const highlighted =
              !!highlightSkill && (skill.slug === highlightSkill || skill.id === highlightSkill);
            return (
              <SortableCard key={skill.id} id={skill.id} index={i} sortable={canSort} onDrop={() => void persistOrder("skill")}>
                <Card
                  id={skill.slug ? `skill-${skill.slug}` : undefined}
                  className={
                    highlighted
                      ? "relative flex h-full flex-col border-primary ring-2 ring-primary shadow-lg shadow-primary/20 transition-colors"
                      : skill.is_new
                      ? "relative flex h-full flex-col border-primary/60 ring-1 ring-primary/30 transition-colors hover:border-primary"
                      : "relative flex h-full flex-col transition-colors hover:border-primary/40"
                  }
                >
                  {canEdit && <EditButton onClick={() => openEditor(skill)} />}
                  <CardContent className="flex flex-1 flex-col pt-5">
                    <div className="flex flex-wrap items-center gap-2 pr-8">
                      <StageTag stage={skill.stage} />
                      {skill.is_new && (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                          New
                        </span>
                      )}
                      {canEdit && !skill.is_published && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <EyeOff className="h-3 w-3" /> Draft
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">{skill.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{skill.description}</p>
                    <div className="mt-auto pt-4">
                      {legacyPack ? (
                        <div className="space-y-2">
                          <Button
                            size="sm"
                            className="w-full gap-2"
                            disabled={!skillPack || skillPackBusy}
                            onClick={() => void downloadSkillPack()}
                          >
                            {skillPackBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            {skillPack ? "Download skill pack" : "Skill pack not uploaded"}
                          </Button>
                          {skillPack && (
                            <p className="break-all text-center text-[10px] text-muted-foreground">{skillPack.name}</p>
                          )}
                          {canEdit && (
                            <Button size="sm" variant="outline" className="w-full gap-2" asChild disabled={skillPackBusy}>
                              <label>
                                <Upload className="h-3.5 w-3.5" />
                                {skillPack ? "Replace skill pack" : "Upload skill pack"}
                                <input
                                  type="file"
                                  className="sr-only"
                                  disabled={skillPackBusy}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = "";
                                    if (file) void uploadSkillPack(file);
                                  }}
                                />
                              </label>
                            </Button>
                          )}
                        </div>
                      ) : skill.owner_only && !isOwner ? (
                        <Button size="sm" variant="outline" className="w-full gap-2" disabled>
                          <Lock className="h-3.5 w-3.5" /> Locked
                        </Button>
                      ) : skill.external_url ? (
                        <Button
                          size="sm"
                          className="w-full gap-2"
                          onClick={() => {
                            // Full navigation so in-app browsers escape to the doc.
                            window.location.href = skill.external_url!;
                          }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open prompt/skill
                        </Button>
                      ) : skill.file_url ? (
                        <Button size="sm" className="w-full gap-2" onClick={() => void downloadSkillFile(skill)}>
                          <Download className="h-3.5 w-3.5" /> Download skill pack
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full" disabled>
                          File coming soon
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </SortableCard>
            );
          })}
        </SortableGrid>
      )}

      {section === "tech" && (
        <SortableGrid
          sortable={canSort}
          ids={tech.map((t) => t.id)}
          onReorder={(ids) => applyReorder("tech", ids)}
        >
          {tech.map((tool, i) => (
            <SortableCard key={tool.id} id={tool.id} index={i} sortable={canSort} onDrop={() => void persistOrder("tech")}>
              <Card className="relative flex h-full flex-col transition-colors hover:border-primary/40">
                {canEdit && <EditButton onClick={() => openEditor(tool)} />}
                <CardContent className="flex flex-1 flex-col pt-5">
                  <h3 className="pr-8 text-sm font-semibold text-foreground">{tool.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
                  <div className="mt-auto pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2"
                      disabled={!tool.external_url}
                      onClick={() => window.open(tool.external_url!, "_blank", "noopener,noreferrer")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open tool
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </SortableCard>
          ))}
        </SortableGrid>
      )}

      {canEdit && (
        <AcademyItemEditor
          open={editorOpen}
          kind={SECTION_KIND[section]}
          item={editing}
          onClose={() => setEditorOpen(false)}
          onSaved={() => void refetch()}
        />
      )}
    </div>
  );
}
