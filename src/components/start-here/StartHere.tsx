import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Check,
  Clapperboard,
  Compass,
  Layers,
  LayoutGrid,
  LifeBuoy,
  ListChecks,
  MessageSquareText,
  Palette,
  Play,
  Rocket,
  Search,
  SearchX,
  Sparkles,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tag } from "@/components/ui/tag";
import { Reveal, RevealItem } from "@/components/premium/Reveal";
import { SectionCard } from "@/components/premium/SectionCard";
import { FolderCard } from "@/components/premium/21st/folder-card";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
import { FilterChips } from "@/components/premium/learn/FilterChips";
import { TrainingCard } from "@/components/premium/learn/TrainingCard";
import { VideoPlayerDialog } from "@/components/premium/learn/VideoPlayerDialog";
import { useWatched } from "@/components/premium/learn/useWatched";
import { popIn } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/platform/PageHeader";
import { useUser } from "@/contexts/UserContext";
import { useTipsBot } from "@/components/tips-bot/TipsBotContext";
import {
  FREE_RESOURCES,
  MENU_REMOVAL_VIDEO,
  ONBOARDING_VIDEOS,
  SETUP_STEPS,
  WALKTHROUGH_LINKS,
  startHereDestination,
  type StartHereVideo,
} from "@/lib/startHere";
import { loadSetupProgress, type SetupProgress } from "@/lib/setupProgress";

const LESSONS: StartHereVideo[] = [
  ...ONBOARDING_VIDEOS,
  { ...MENU_REMOVAL_VIDEO, type: "video", category: "menu" },
  {
    id: "installation",
    title: "Installation",
    duration: "Lesson",
    src: "",
    poster: "",
    type: "lesson",
    category: "setup",
  },
  {
    id: "client-hub",
    title: "Client Hub",
    duration: "Lesson",
    src: "",
    poster: "",
    type: "lesson",
    category: "client-hub",
  },
  {
    id: "branding",
    title: "Design",
    duration: "Lesson",
    src: "",
    poster: "",
    type: "lesson",
    category: "branding",
  },
];

const LESSON_PATHS: Record<string, string> = {
  installation: "/app/client-hub?panel=installation-guide",
  "client-hub": "/app/client-hub",
  branding: "/app/client-hub/design",
  "menu-link-removal": "/app/streamline",
};

type Category = StartHereVideo["category"];
type TypeFilter = "all" | "video" | "lesson";
type CategoryFilter = "all" | Category;

const TOPICS: { id: Category; label: string; blurb: string; icon: LucideIcon }[] = [
  { id: "setup", label: "Setup", blurb: "Connect and install", icon: Rocket },
  { id: "client-hub", label: "Client Hub", blurb: "Build your clients' home", icon: LayoutGrid },
  { id: "branding", label: "Design", blurb: "Make it look like you", icon: Palette },
  { id: "menu", label: "Menu links", blurb: "Tidy the HighLevel menu", icon: Zap },
];

const GUIDE_ICONS: Record<string, LucideIcon> = {
  support: LifeBuoy,
  streamline: Zap,
  "success-call": CalendarCheck,
};

const RESOURCE_META: Record<string, { icon: LucideIcon; blurb: string }> = {
  prompts: { icon: MessageSquareText, blurb: "Copy-and-paste AI prompts" },
  skills: { icon: Sparkles, blurb: "Ready-made AI skills" },
  snapshots: { icon: Layers, blurb: "Import-ready HighLevel snapshots" },
  tech: { icon: Wrench, blurb: "The tools agencies run on" },
};

/** Minutes of video in a length label ("4:37", "20 minutes"); 0 when it is not a time. */
function minutesOf(length: string): number {
  const clock = length.match(/^(\d+):(\d{2})$/);
  if (clock) return Math.max(1, Math.round(Number(clock[1]) + Number(clock[2]) / 60));
  const words = length.match(/^(\d+)\s*min/i);
  return words ? Number(words[1]) : 0;
}

const lengthLabel = (lesson: StartHereVideo) =>
  lesson.type === "lesson" ? "Guided lesson" : minutesOf(lesson.duration) ? lesson.duration : "Video";

export default function StartHere() {
  const navigate = useNavigate();
  const { email, plan } = useUser();
  const { startWalkthrough } = useTipsBot();
  const [progress, setProgress] = useState<SetupProgress>({
    highlevel: false,
    install: false,
    hub: false,
  });
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [watching, setWatching] = useState<StartHereVideo | null>(null);
  const { watched, isWatched, setWatched } = useWatched(email);

  useEffect(() => {
    let active = true;
    void loadSetupProgress(email).then((next) => {
      if (active) setProgress(next);
    });
    return () => {
      active = false;
    };
  }, [email]);

  const done = (id: string) => progress[id as keyof SetupProgress];
  const finished = SETUP_STEPS.filter((step) => done(step.id)).length;
  const allDone = finished === SETUP_STEPS.length;
  const nextStep = SETUP_STEPS.find((step) => !done(step.id));

  const lessons = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LESSONS.filter((lesson) => {
      if (type !== "all" && lesson.type !== type) return false;
      if (category !== "all" && lesson.category !== category) return false;
      if (!q) return true;
      const topic = TOPICS.find((item) => item.id === lesson.category)?.label ?? "";
      return `${lesson.title} ${topic}`.toLowerCase().includes(q);
    });
  }, [query, type, category]);

  const groups = useMemo(
    () =>
      TOPICS.map((topic) => {
        const items = LESSONS.filter((lesson) => lesson.category === topic.id);
        const minutes = items.reduce((sum, lesson) => sum + minutesOf(lesson.duration), 0);
        return {
          ...topic,
          count: items.length,
          minutes,
          seen: items.filter((lesson) => watched.includes(lesson.id)).length,
        };
      }),
    [watched],
  );

  const open = (id: string, path: string) => {
    navigate(startHereDestination(id, path, plan));
  };

  const openLesson = (lesson: StartHereVideo) => {
    if (lesson.src) {
      setWatching(lesson);
      return;
    }
    setWatched(lesson.id, true);
    open(lesson.id, LESSON_PATHS[lesson.id] || "/app/learning");
  };

  const filtered = Boolean(query.trim()) || type !== "all" || category !== "all";
  const clearFilters = () => {
    setQuery("");
    setType("all");
    setCategory("all");
  };

  const videos = LESSONS.filter((lesson) => lesson.src);
  const upNext = watching
    ? videos[(videos.findIndex((video) => video.id === watching.id) + 1) % videos.length]
    : null;
  const topicLabel = (id: Category) => TOPICS.find((topic) => topic.id === id)?.label ?? "Training";

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-8">
      <PageHeader
        eyebrow="Learn"
        title="Learning Hub"
        subtitle="Finish the three setup steps, then pick up trainings and resources whenever you need them."
      />

      <Reveal className="space-y-8">
        <RevealItem>
          <section aria-label="Getting started with SaaSSuite" className="px-surface overflow-hidden">
            <div className="px-brand-wash flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="px-icon-chip shrink-0 bg-card [&_svg]:size-5" aria-hidden="true">
                  <ListChecks />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground">Getting started with SaaSSuite</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {allDone
                      ? "All three steps are done. Your hub is ready for clients."
                      : `Next: ${nextStep?.title ?? "finish setup"}.`}
                  </p>
                </div>
              </div>
              <div className="w-full shrink-0 sm:w-56">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    {finished} of {SETUP_STEPS.length} done
                  </span>
                  {allDone ? (
                    <Tag tone="success">
                      <Check aria-hidden="true" />
                      Complete
                    </Tag>
                  ) : (
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round((finished / SETUP_STEPS.length) * 100)}%
                    </span>
                  )}
                </div>
                <Progress
                  value={(finished / SETUP_STEPS.length) * 100}
                  aria-label={`${finished} of ${SETUP_STEPS.length} setup steps done`}
                  className="bg-card"
                />
              </div>
            </div>
            <ol className="divide-y divide-border border-t border-border">
              {SETUP_STEPS.map((step, index) => {
                const complete = done(step.id);
                const current = !complete && nextStep?.id === step.id;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => open(step.id, step.path)}
                      className="group flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-6"
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                          complete
                            ? "border-success bg-success text-success-foreground"
                            : current
                              ? "border-brand bg-brand-subtle text-brand"
                              : "border-border bg-card text-muted-foreground",
                        )}
                        aria-hidden="true"
                      >
                        <AnimatePresence mode="wait" initial={false}>
                          {complete ? (
                            <motion.span key="done" variants={popIn} initial="hidden" animate="show" exit="exit">
                              <Check className="size-4" />
                            </motion.span>
                          ) : (
                            <motion.span key="todo" variants={popIn} initial="hidden" animate="show" exit="exit">
                              {index + 1}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block text-sm font-semibold",
                            complete ? "text-muted-foreground" : "text-foreground",
                          )}
                        >
                          {step.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {complete ? "Done. Open it to make changes." : step.description}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "hidden shrink-0 text-sm font-medium sm:inline",
                          current ? "text-brand" : "text-muted-foreground",
                        )}
                      >
                        {complete ? "Review" : current ? "Continue" : "Open"}
                      </span>
                      <ArrowRight
                        className={cn(
                          "size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5",
                          current ? "text-brand" : "text-muted-foreground",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </RevealItem>

        <RevealItem>
          <SectionCard
            icon={<Compass />}
            title="Walkthroughs"
            description="Optional guides for everything past the three setup steps."
          >
            <div className="flex flex-col gap-3 rounded-lg border border-brand/30 bg-brand-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="px-brand-fill flex size-10 shrink-0 items-center justify-center rounded-md" aria-hidden="true">
                  <Sparkles className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Interactive walkthrough</p>
                  <p className="text-xs text-muted-foreground">
                    We point at each part of the app, one step at a time. About two minutes.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="accent"
                className="h-11 shrink-0 sm:h-10"
                onClick={() => startWalkthrough("nav")}
              >
                <Play />
                Start the interactive walkthrough
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <GuideTile
                icon={Clapperboard}
                title="Video walkthrough"
                onClick={() => navigate("/app/walkthrough")}
              />
              {WALKTHROUGH_LINKS.map((item) => (
                <GuideTile
                  key={item.id}
                  icon={GUIDE_ICONS[item.id] ?? BookOpen}
                  title={item.title}
                  onClick={() => open(item.id, item.path)}
                />
              ))}
            </div>
          </SectionCard>
        </RevealItem>

        <RevealItem>
          <section aria-label="Lessons" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-h4 text-foreground">Trainings</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {LESSONS.length} trainings in {TOPICS.length} groups. Pick a group or search.
                </p>
              </div>
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">
                  {LESSONS.filter((lesson) => watched.includes(lesson.id)).length}
                </span>{" "}
                of {LESSONS.length} watched
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {groups.map((group) => {
                const selected = category === group.id;
                const Icon = group.icon;
                return (
                  <FolderCard
                    key={group.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    aria-label={`${group.label}: ${group.count} trainings`}
                    onClick={() => setCategory(selected ? "all" : group.id)}
                    onKeyDown={(event: React.KeyboardEvent) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setCategory(selected ? "all" : group.id);
                      }
                    }}
                    icon={
                      <span className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "flex size-10 items-center justify-center rounded-md transition-colors duration-150",
                            selected ? "px-brand-fill" : "bg-brand-subtle text-brand",
                          )}
                        >
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        {group.seen === group.count ? (
                          <Tag tone="success">
                            <Check aria-hidden="true" />
                            Done
                          </Tag>
                        ) : (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {group.seen}/{group.count}
                          </span>
                        )}
                      </span>
                    }
                    title={group.label}
                    size={`${group.count} ${group.count === 1 ? "training" : "trainings"}${
                      group.minutes ? ` · ${group.minutes} min` : ` · ${group.blurb}`
                    }`}
                    className={cn(
                      "min-h-[132px] cursor-pointer rounded-lg bg-card bg-none shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      selected ? "border-brand ring-1 ring-brand" : "border-border hover:border-brand/40",
                    )}
                  />
                );
              })}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search lessons and videos"
                  className="h-11 pl-9 pr-10 sm:h-10"
                  aria-label="Search lessons and videos"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              <FilterChips<TypeFilter>
                label="Type"
                value={type}
                onChange={setType}
                options={[
                  { value: "all", label: "All" },
                  { value: "video", label: "Videos", icon: <Play /> },
                  { value: "lesson", label: "Lessons", icon: <BookOpen /> },
                ]}
              />
            </div>

            {lessons.length === 0 ? (
              <div className="px-surface">
                <EmptyState
                  icon={
                    <EmptyStateIllustration className="rounded-lg border-border bg-muted text-muted-foreground">
                      <SearchX className="size-7" aria-hidden="true" />
                    </EmptyStateIllustration>
                  }
                  title="No trainings match"
                  description="Try a different word, or clear the filters to see every training."
                  action={
                    <Button type="button" variant="outline" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {filtered
                    ? `Showing ${lessons.length} of ${LESSONS.length} trainings`
                    : "Showing every training"}
                  {filtered ? (
                    <>
                      {" · "}
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="font-medium text-brand underline-offset-4 hover:underline"
                      >
                        Clear filters
                      </button>
                    </>
                  ) : null}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
                  {lessons.map((lesson) => {
                    const topic = TOPICS.find((item) => item.id === lesson.category);
                    const Icon = topic?.icon ?? BookOpen;
                    return (
                      <TrainingCard
                        key={lesson.id}
                        title={lesson.title}
                        length={lengthLabel(lesson)}
                        topic={topic?.label ?? "Training"}
                        poster={lesson.poster || undefined}
                        icon={<Icon aria-hidden="true" />}
                        kind={lesson.src ? "video" : "lesson"}
                        watched={isWatched(lesson.id)}
                        onOpen={() => openLesson(lesson)}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </RevealItem>

        <RevealItem>
          <section aria-label="Free resources" className="space-y-4">
            <div>
              <h2 className="text-h4 text-foreground">Free resources</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Shared by other agencies in the community. Take what helps.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FREE_RESOURCES.map((item) => {
                const meta = RESOURCE_META[item.id];
                const Icon = meta?.icon ?? BookOpen;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="px-surface-interactive group flex min-h-[72px] items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span className="px-icon-chip shrink-0 [&_svg]:size-5" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                      {meta ? (
                        <span className="block text-xs text-muted-foreground">{meta.blurb}</span>
                      ) : null}
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </section>
        </RevealItem>
      </Reveal>

      <VideoPlayerDialog
        video={watching}
        topic={watching ? topicLabel(watching.category) : undefined}
        watched={watching ? isWatched(watching.id) : false}
        next={upNext && upNext.id !== watching?.id ? upNext : null}
        onClose={() => setWatching(null)}
        onWatchedChange={setWatched}
        onPlayNext={(video) => setWatching(videos.find((item) => item.id === video.id) ?? null)}
      />
    </div>
  );
}

function GuideTile({
  icon: Icon,
  title,
  onClick,
  className,
}: {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-h-[56px] items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors duration-150 hover:border-brand/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" />
      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{title}</span>
      <ArrowRight
        className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}
