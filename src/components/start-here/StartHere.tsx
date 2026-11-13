import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Circle, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [type, setType] = useState("all");
  const [category, setCategory] = useState("all");
  const [watching, setWatching] = useState<StartHereVideo | null>(null);
  const [showWalkthroughs, setShowWalkthroughs] = useState(false);

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

  const lessons = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LESSONS.filter((lesson) => {
      if (type !== "all" && lesson.type !== type) return false;
      if (category !== "all" && lesson.category !== category) return false;
      if (!q) return true;
      return lesson.title.toLowerCase().includes(q);
    });
  }, [query, type, category]);

  const open = (id: string, path: string) => {
    navigate(startHereDestination(id, path, plan));
  };

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-8">
      <PageHeader
        title="Learning Hub"
        subtitle="Getting started with SaaSSuite, then the walkthroughs and resources for your agency."
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons and videos"
            className="pl-9"
            aria-label="Search lessons and videos"
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Type</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="lesson">Lessons</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Category</SelectItem>
            <SelectItem value="setup">Setup</SelectItem>
            <SelectItem value="client-hub">Client Hub</SelectItem>
            <SelectItem value="branding">Design</SelectItem>
            <SelectItem value="menu">Menu links</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <section aria-label="Getting started with SaaSSuite" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Getting started with SaaSSuite</h2>
          <span className="text-sm text-muted-foreground">
            {finished} / {SETUP_STEPS.length}
          </span>
        </div>
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {SETUP_STEPS.map((step, index) => {
            const complete = done(step.id);
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => open(step.id, step.path)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-muted/40"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${complete ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                    aria-hidden
                  >
                    {complete ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Circle className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {index + 1}. {step.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {complete ? "Done" : step.description}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={() => setShowWalkthroughs((open) => !open)}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          SaaSSuite walkthroughs and videos
        </button>
        {showWalkthroughs ? (
          <div className="space-y-2 rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              Everything past the three setup steps lives here. These are optional.
            </p>
            <Button type="button" variant="outline" onClick={() => startWalkthrough("nav")}>
              <Play className="h-4 w-4" />
              Start the interactive walkthrough
            </Button>
            <ul className="divide-y divide-border">
              {WALKTHROUGH_LINKS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between py-3 text-left text-sm font-medium"
                    onClick={() => open(item.id, item.path)}
                  >
                    {item.title}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-3 text-left text-sm font-medium"
                  onClick={() => navigate("/app/walkthrough")}
                >
                  Video walkthrough
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </li>
            </ul>
          </div>
        ) : null}
      </section>

      <section aria-label="Lessons" className="space-y-3">
        <h2 className="text-lg font-semibold">Lessons</h2>
        {lessons.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing matches that search.</p>
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                type="button"
                onClick={() =>
                  lesson.src
                    ? setWatching(lesson)
                    : open(lesson.id, LESSON_PATHS[lesson.id] || "/app/learning")
                }
                className="w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-card text-left"
              >
                <div className="flex h-28 items-center justify-center bg-muted">
                  {lesson.poster ? (
                    <img src={lesson.poster} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Play className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-medium">{lesson.title}</p>
                  <p className="text-xs text-muted-foreground">{lesson.duration}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Free resources" className="space-y-3">
        <h2 className="text-lg font-semibold">Free resources</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FREE_RESOURCES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.path)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card px-3 py-4 text-sm font-medium hover:bg-muted/40"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xs uppercase text-muted-foreground">
                {item.title.slice(0, 2)}
              </span>
              {item.title}
            </button>
          ))}
        </div>
      </section>

      <Dialog open={!!watching} onOpenChange={(open) => !open && setWatching(null)}>
        <DialogContent className="max-w-4xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{watching?.title}</DialogTitle>
            <DialogDescription>{watching?.duration}</DialogDescription>
          </DialogHeader>
          {watching?.src ? (
            <video
              controls
              preload="metadata"
              poster={watching.poster || undefined}
              src={watching.src}
              className="aspect-video w-full rounded-lg bg-muted"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
