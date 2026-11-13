import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX, Maximize } from "lucide-react";

interface CustomVideoPlayerProps {
  src: string;
  poster?: string;
  videoId?: string;
  onEnded?: () => void;
}

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

const CustomVideoPlayer = ({ src, poster, videoId = "support-hero-video", onEnded }: CustomVideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrent(v.currentTime);
      setDuration(v.duration || 0);
      setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  const start = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.volume = 1;
    v.currentTime = 0;
    setMuted(false);
    try {
      await v.play();
    } catch {
      v.muted = true;
      setMuted(true);
      await v.play().catch(() => undefined);
    }
    setStarted(true);
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
  };

  return (
    <div className="group relative mx-auto max-w-3xl overflow-hidden rounded-xl bg-black shadow-dialog">
      <video
        ref={videoRef}
        id={videoId}
        data-track-video={videoId}
        src={src}
        poster={poster}
        playsInline
        muted
        preload="metadata"
        onEnded={onEnded}
        onClick={started ? toggle : undefined}
        className="w-full aspect-video object-cover"
      />

      {!started && (
        <button
          type="button"
          onClick={start}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/25 transition-colors duration-150 hover:bg-black/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          aria-label="Play support video with sound"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full px-brand-fill transition-transform duration-200 group-hover:scale-105">
            <Play className="ml-1 h-9 w-9 fill-current" />
          </span>
          <span className="flex items-center gap-2 text-sm font-medium text-white/95">
            <Volume2 className="h-4 w-4" /> Tap to play with sound
          </span>
        </button>
      )}

      {started && (
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-8 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100">
          <div
            className="mb-2 h-1.5 w-full cursor-pointer rounded-full bg-white/30"
            onClick={seek}
            role="presentation"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center gap-3 text-white">
            <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="hover:text-white/70">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                v.muted = !v.muted;
                setMuted(v.muted);
              }}
              aria-label={muted ? "Unmute" : "Mute"}
              className="hover:text-white/70"
            >
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="text-xs font-medium tabular-nums text-white/90">
              {fmt(current)} / {fmt(duration)}
            </span>
            <button
              type="button"
              onClick={async () => {
                const v = videoRef.current;
                const container = v?.parentElement;
                try {
                  if (v && v.requestFullscreen) {
                    await v.requestFullscreen();
                  } else if (container && container.requestFullscreen) {
                    await container.requestFullscreen();
                  }
                } catch {
                  // Fallback: try container fullscreen if video fullscreen failed
                  try {
                    if (container && container.requestFullscreen) {
                      await container.requestFullscreen();
                    }
                  } catch {
                    // Browser does not support fullscreen
                  }
                }
              }}
              aria-label="Fullscreen"
              className="ml-auto hover:text-white/70"
            >
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomVideoPlayer;