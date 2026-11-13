import { useEffect, useRef, useState } from "react";
import { Check, Clock, Play, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tag } from "@/components/ui/tag";

export interface PlayerVideo {
  id: string;
  title: string;
  duration: string;
  src: string;
  poster?: string;
}

/**
 * The focused player: one video on a dark stage, its title and length, and the
 * two things people do next (mark it watched, play the next one).
 */
export function VideoPlayerDialog({
  video,
  topic,
  watched,
  next,
  onClose,
  onWatchedChange,
  onPlayNext,
}: {
  video: PlayerVideo | null;
  topic?: string;
  watched: boolean;
  next?: PlayerVideo | null;
  onClose: () => void;
  onWatchedChange: (id: string, watched: boolean) => void;
  onPlayNext?: (video: PlayerVideo) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setStarted(false);
  }, [video?.id]);

  const play = () => {
    setStarted(true);
    void ref.current?.play().catch(() => undefined);
  };

  return (
    <Dialog open={!!video} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-24px)] w-[calc(100vw-24px)] max-w-4xl gap-0 overflow-y-auto rounded-xl p-0">
        <DialogHeader className="space-y-1 p-4 pr-12 text-left sm:p-6 sm:pr-14">
          {topic ? <p className="px-eyebrow">{topic}</p> : null}
          <DialogTitle className="text-lg sm:text-xl">{video?.title}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" />
              {video?.duration}
            </span>
            {watched ? (
              <Tag tone="success">
                <Check aria-hidden="true" />
                Watched
              </Tag>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {video ? (
          <div className="relative aspect-video w-full bg-black">
            <video
              key={video.id}
              ref={ref}
              controls={started}
              playsInline
              preload="metadata"
              poster={video.poster || undefined}
              src={video.src}
              onPlay={() => setStarted(true)}
              onEnded={() => onWatchedChange(video.id, true)}
              className="h-full w-full bg-black object-contain"
            />
            {!started ? (
              <button
                type="button"
                onClick={play}
                autoFocus
                aria-label={`Play ${video.title}`}
                className="group absolute inset-0 flex items-center justify-center bg-black/30 transition-colors duration-200 hover:bg-black/40 focus-visible:outline-none"
              >
                <span className="px-brand-fill flex size-16 items-center justify-center rounded-full transition-transform duration-200 ease-out group-hover:scale-105 group-focus-visible:ring-4 group-focus-visible:ring-white/60 sm:size-20">
                  <Play className="ml-1 size-7 fill-current sm:size-8" aria-hidden="true" />
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {video ? (
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <Button
              type="button"
              variant={watched ? "outline" : "secondary"}
              className="h-11 sm:h-10"
              onClick={() => onWatchedChange(video.id, !watched)}
            >
              <Check />
              {watched ? "Mark as not watched" : "Mark as watched"}
            </Button>
            {next && onPlayNext ? (
              <Button
                type="button"
                variant="accent"
                className="h-11 min-w-0 sm:h-10"
                onClick={() => onPlayNext(next)}
              >
                <SkipForward />
                <span className="truncate">Up next: {next.title}</span>
              </Button>
            ) : (
              <Button type="button" variant="accent" className="h-11 sm:h-10" onClick={onClose}>
                Back to trainings
              </Button>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
