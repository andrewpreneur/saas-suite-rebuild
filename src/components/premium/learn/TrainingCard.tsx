import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, Clock, Play } from "lucide-react";
import { popIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * One training in the library: a 16:9 thumbnail, the title, its length and a
 * watched tick. Videos open the player; lessons open the screen they teach.
 */
export function TrainingCard({
  title,
  length,
  topic,
  poster,
  icon,
  kind,
  watched,
  onOpen,
}: {
  title: string;
  length: string;
  topic: string;
  poster?: string;
  icon: ReactNode;
  kind: "video" | "lesson";
  watched: boolean;
  onOpen: () => void;
}) {
  const isVideo = kind === "video";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${isVideo ? "Watch" : "Open"} ${title}${watched ? " (watched)" : ""}`}
      className="px-surface-interactive group flex h-full w-full flex-col overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {poster ? (
          <img
            src={poster}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="px-brand-wash flex h-full w-full flex-col items-center justify-center gap-2 text-brand">
            {isVideo ? (
              <span className="size-12" />
            ) : (
              <span className="flex size-12 items-center justify-center rounded-lg bg-card shadow-card [&_svg]:size-6">
                {icon}
              </span>
            )}
            <span className="px-eyebrow">{topic}</span>
          </div>
        )}
        {isVideo ? (
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors duration-200 group-hover:bg-foreground/20">
            <span className="flex size-12 items-center justify-center rounded-full bg-card/95 text-brand shadow-raised transition-transform duration-200 ease-out group-hover:scale-110">
              <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
            </span>
          </span>
        ) : null}
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-sm bg-foreground/80 px-1.5 py-0.5 text-xs font-medium text-background">
          <Clock className="size-3" aria-hidden="true" />
          {length}
        </span>
        {watched ? (
          <motion.span
            variants={popIn}
            initial="hidden"
            animate="show"
            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground"
          >
            <Check className="size-3" aria-hidden="true" />
            Watched
          </motion.span>
        ) : null}
      </div>
      <div className="flex flex-1 items-start justify-between gap-2 p-3 sm:gap-3 sm:p-4">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isVideo ? "Video" : "Lesson"} · {topic}
          </p>
        </div>
        {isVideo ? null : (
          <ArrowUpRight
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              "group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand",
            )}
            aria-hidden="true"
          />
        )}
      </div>
    </button>
  );
}
