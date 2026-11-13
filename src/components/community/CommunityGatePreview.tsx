import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Library,
  LifeBuoy,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  Package,
  PlayCircle,
  Sparkles,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveAcademyImageUrls } from "@/hooks/useAcademyContent";
import { appendTrackingParams } from "@/utils/preserveParams";
import { rememberNextPath } from "@/utils/deepLink";
import { resolveCommunityDeepLink } from "./CommunityHub";

type Row = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  stage: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration_minutes: number | null;
  format: string | null;
  is_new: boolean | null;
};

const SECTION_META: Record<
  string,
  { kind: string; label: string; icon: typeof Wrench; blurb: string }
> = {
  lessons: {
    kind: "lesson",
    label: "Academy Lessons",
    icon: PlayCircle,
    blurb: "Step-by-step video lessons that take you from setup to paying SaaS customers.",
  },
  prompts: {
    kind: "prompt",
    label: "Prompt Library",
    icon: Sparkles,
    blurb: "Copy-and-paste AI prompts built for agency owners selling software.",
  },
  skills: {
    kind: "skill",
    label: "Skills Library",
    icon: Wrench,
    blurb: "Downloadable AI skill files that turn your assistant into a HighLevel expert.",
  },
  tech: {
    kind: "tech",
    label: "Tech Library",
    icon: Library,
    blurb: "The exact tools, apps and integrations we use to run and scale a SaaS agency.",
  },
};

const PAGE_META: Record<string, { label: string; icon: typeof Wrench; blurb: string }> = {
  feed: {
    label: "Community Feed",
    icon: MessageSquare,
    blurb: "Wins, questions and behind-the-scenes from other SaaS agency owners.",
  },
  snapshots: {
    label: "Snapshot Vault",
    icon: Package,
    blurb: "Done-for-you HighLevel snapshots you can load into your account today.",
  },
  ideas: {
    label: "Ideas Board",
    icon: Lightbulb,
    blurb: "Request features and vote on what we build next.",
  },
  ask: {
    label: "Message the Team",
    icon: LifeBuoy,
    blurb: "Get answers straight from our team inside the community.",
  },
};

/** Fake sidebar so the gated view feels like the real app behind the glass. */
const SIDEBAR_ITEMS = [
  "Dashboard",
  "Client Hub",
  "Branding",
  "Onboarding",
  "Community",
  "Snapshots",
  "Support",
  "Settings",
];

export default function CommunityGatePreview({ slug }: { slug?: string }) {
  const link = resolveCommunityDeepLink(slug);
  const sectionId = link?.tab === "academy" ? link.section ?? "lessons" : undefined;
  const section = sectionId ? SECTION_META[sectionId] : undefined;
  const page = link && link.tab !== "academy" ? PAGE_META[link.tab] : undefined;
  const heading = section?.label ?? page?.label ?? "SaaSSuite Community";
  const blurb =
    section?.blurb ??
    page?.blurb ??
    "Courses, prompts, snapshots and a private community for agency owners selling software.";
  const Icon = section?.icon ?? page?.icon ?? GraduationCap;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const target = useMemo(() => {
    const path = `${window.location.pathname}${window.location.search}`;
    return path.startsWith("/app/community") ? path : "/app/community/academy";
  }, []);

  // Signup / login must bring them straight back to this exact page.
  useEffect(() => {
    rememberNextPath(target);
  }, [target]);

  const authHref = (base: "/signup" | "/login") => {
    const path = appendTrackingParams(base);
    return `${path}${path.includes("?") ? "&" : "?"}next=${encodeURIComponent(target)}`;
  };

  useEffect(() => {
    let cancelled = false;
    const kind = section?.kind ?? "lesson";
    void (async () => {
      const { data } = await supabase
        .from("academy_content")
        .select(
          "id, title, description, category, stage, thumbnail_url, video_url, duration_minutes, format, is_new",
        )
        .eq("kind", kind)
        .eq("is_published", true)
        .eq("owner_only", false)
        .order("sort_order", { ascending: true })
        .limit(9);
      if (cancelled) return;
      const list = (data as Row[] | null) ?? [];
      setRows(list);
      const refs = list.map((r) => r.thumbnail_url).filter((r): r is string => !!r);
      if (refs.length) {
        const map = await resolveAcademyImageUrls(refs).catch(() => ({}));
        if (!cancelled) setThumbs(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section?.kind]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="mx-auto flex max-w-7xl">
        {/* Greyed-out app shell */}
        <aside
          aria-hidden
          className="hidden w-56 shrink-0 select-none border-r border-slate-200/70 bg-white/60 px-4 py-6 opacity-50 blur-[1.5px] lg:block"
        >
          <div className="mb-6 h-8 w-32 rounded bg-slate-200" />
          <div className="space-y-2">
            {SIDEBAR_ITEMS.map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400"
              >
                <div className="h-4 w-4 rounded bg-slate-200" />
                {item}
              </div>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-subtle text-brand">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {heading}
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">{blurb}</p>
            </div>
          </div>

          {/* Signup gate */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8 overflow-hidden rounded-2xl border border-brand/20 bg-white p-5 shadow-lg sm:p-7"
          >
            <Badge className="mb-3">Free account required</Badge>
            <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
              Create your free account to unlock {heading.toLowerCase()}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              It takes about 30 seconds. You'll come right back to this page with everything
              unlocked — no card needed.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to={authHref("/signup")}>Create free account</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link to={authHref("/login")}>I already have an account</Link>
              </Button>
            </div>
          </motion.div>

          {/* Locked preview of the real content */}
          <div className="relative">
            {rows === null ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => {
                  const ytId = row.video_url?.match(
                    /(?:embed\/|v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
                  )?.[1];
                  const thumb =
                    (row.thumbnail_url ? thumbs[row.thumbnail_url] : null) ??
                    (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null);
                  return (
                    <Card
                      key={row.id}
                      className="relative h-full overflow-hidden border-slate-200 bg-white"
                    >
                      {thumb && (
                        <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                          <img
                            src={thumb}
                            alt={row.title}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <CardContent className="space-y-2 p-4">
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-slate-400" />
                          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                            Locked
                          </span>
                          {row.is_new && <Badge variant="secondary">New</Badge>}
                        </div>
                        <h3 className="font-semibold leading-snug text-slate-900">{row.title}</h3>
                        {row.description && (
                          <p className="line-clamp-2 text-sm text-slate-500 blur-[2px] select-none">
                            {row.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {rows !== null && rows.length === 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="h-full border-slate-200 bg-white/70">
                    <div className="aspect-video w-full bg-slate-100" />
                    <CardContent className="space-y-2 p-4">
                      <div className="h-4 w-3/4 rounded bg-slate-200" />
                      <div className="h-3 w-full rounded bg-slate-100" />
                      <div className="h-3 w-2/3 rounded bg-slate-100" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-center">
            <Button asChild size="lg">
              <Link to={authHref("/signup")}>Sign up free to unlock everything</Link>
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
