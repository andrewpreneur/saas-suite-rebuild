import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, Mail, Mic, Video, Workflow, Users, Rocket } from "lucide-react";
import { EmptyState, EmptyStateIllustration } from "@/components/premium/21st/empty-state";
import { UpgradePrompt } from "./shared";

// Seeded install baselines that drip upward each day.
const INSTALL_SEEDS: Record<string, { base: number; perDay: number }> = {
  "Email Marketing Snapshot": { base: 115, perDay: 3 },
  "SaaS Mode Webinar API Snapshot": { base: 56, perDay: 2 },
  "Voice AI Onboarding Snapshot": { base: 20, perDay: 1 },
};
const INSTALL_ANCHOR = Date.parse("2026-08-01T00:00:00Z");

// Fallback graphic: icon + gradient + one-line "what it does" derived from the title.
const GRAPHICS: {
  match: RegExp;
  icon: typeof Mail;
  gradient: string;
  blurb: string;
}[] = [
  {
    match: /email/i,
    icon: Mail,
    gradient: "from-sky-500/25 via-sky-500/10 to-transparent",
    blurb: "Email campaigns & nurture automations",
  },
  {
    match: /webinar/i,
    icon: Video,
    gradient: "from-violet-500/25 via-violet-500/10 to-transparent",
    blurb: "Webinar funnel, reminders & replays",
  },
  {
    match: /voice/i,
    icon: Mic,
    gradient: "from-emerald-500/25 via-emerald-500/10 to-transparent",
    blurb: "Voice AI onboarding call flow",
  },
  {
    match: /onboard/i,
    icon: Rocket,
    gradient: "from-amber-500/25 via-amber-500/10 to-transparent",
    blurb: "Client onboarding sequence",
  },
  {
    match: /lead|crm|pipeline/i,
    icon: Users,
    gradient: "from-rose-500/25 via-rose-500/10 to-transparent",
    blurb: "Lead capture & pipeline automation",
  },
];

const graphicFor = (title: string) =>
  GRAPHICS.find((g) => g.match.test(title)) ?? {
    match: /./,
    icon: Workflow,
    gradient: "from-primary/25 via-primary/10 to-transparent",
    blurb: "Ready-to-import GoHighLevel workflow",
  };

const displayedInstalls = (title: string, actual: number) => {
  const seed = INSTALL_SEEDS[title];
  if (!seed) return actual;
  const days = Math.max(0, Math.floor((Date.now() - INSTALL_ANCHOR) / 86_400_000));
  return seed.base + days * seed.perDay + actual;
};

type Snapshot = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  thumbnail_url: string | null;
  share_link: string | null;
  min_tier: "free" | "paid";
  install_count: number;
};

export default function CommunitySnapshots({ isPaid }: { isPaid: boolean }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("community_snapshots")
        .select("*")
        .order("created_at", { ascending: false });
      setSnapshots((data || []) as Snapshot[]);
      setLoading(false);
    };
    void run();
  }, []);

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(snapshots.map((s) => s.category).filter(Boolean) as string[]))],
    [snapshots],
  );

  const visible = snapshots.filter((s) => category === "all" || s.category === category);

  const install = async (snapshot: Snapshot) => {
    if (snapshot.share_link) {
      window.open(snapshot.share_link, "_blank", "noopener,noreferrer");
    }
    setSnapshots((prev) =>
      prev.map((s) => (s.id === snapshot.id ? { ...s, install_count: s.install_count + 1 } : s)),
    );
    await supabase.rpc("community_increment_install", { _snapshot_id: snapshot.id });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Button
            key={cat}
            size="sm"
            variant={category === cat ? "default" : "outline"}
            onClick={() => setCategory(cat)}
            className="capitalize"
          >
            {cat}
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="px-surface">
          <EmptyState
            icon={
              <EmptyStateIllustration className="rounded-lg border-border bg-muted text-muted-foreground">
                <Download className="size-7" aria-hidden="true" />
              </EmptyStateIllustration>
            }
            title="No snapshots in this category yet"
            description="New import-ready snapshots are added here as agencies share them."
          />
        </div>
      ) : (
        <motion.div
          layout
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((snapshot, i) => {
            const locked = snapshot.min_tier === "paid" && !isPaid;
            const graphic = graphicFor(snapshot.title);
            const GraphicIcon = graphic.icon;
            return (
              <motion.div
                key={snapshot.id}
                layout
                initial={{ opacity: 0, y: 18, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: "easeOut" }}
                whileHover={{ y: -4 }}
                className="h-full"
              >
              <Card className="overflow-hidden flex h-full flex-col transition-colors hover:border-primary/40">
                <div className="relative h-36 bg-muted">
                  {snapshot.thumbnail_url ? (
                    <motion.img
                      whileHover={{ scale: locked ? 1.05 : 1.06 }}
                      transition={{ duration: 0.4 }}
                      src={snapshot.thumbnail_url}
                      alt={snapshot.title}
                      loading="lazy"
                      className={`h-full w-full object-cover ${locked ? "blur-sm scale-105" : ""}`}
                    />
                  ) : (
                    <div
                      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br px-4 text-center ${graphic.gradient} ${locked ? "blur-sm" : ""}`}
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-background/70 shadow-sm ring-1 ring-border">
                        <GraphicIcon className="h-5 w-5 text-primary" />
                      </span>
                      <span className="text-[11px] font-medium leading-snug text-muted-foreground">
                        {graphic.blurb}
                      </span>
                    </div>
                  )}
                  {snapshot.category && (
                    <Badge variant="secondary" className="absolute left-2 top-2 text-[10px] capitalize">
                      {snapshot.category}
                    </Badge>
                  )}
                </div>
                <CardContent className="flex flex-1 flex-col pt-4">
                  <h3 className="text-sm font-semibold text-foreground">{snapshot.title}</h3>
                  {snapshot.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{snapshot.description}</p>
                  )}
                  {(() => {
                    const shown = displayedInstalls(snapshot.title, snapshot.install_count);
                    return (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {shown} install{shown === 1 ? "" : "s"}
                      </p>
                    );
                  })()}
                  <div className="mt-auto pt-3">
                    {locked ? (
                      <UpgradePrompt
                        compact
                        title="Locked snapshot"
                        description="Available on Basic and Advanced."
                      />
                    ) : (
                      <Button size="sm" className="w-full gap-2" onClick={() => install(snapshot)}>
                        <Download className="w-3.5 h-3.5" />
                        Get Snapshot
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}