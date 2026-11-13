import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Loader2, AlertCircle, CheckCircle2, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { processTrainingDocContent } from "@/utils/compileTrainingDocContent";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TranscribeVideosButtonProps {
  /** Agency ID for the currently-selected plan (used to refresh the training doc). */
  planAgencyId: string | null;
  /** Tier name (basic / advanced / elite) for the currently-selected plan. */
  tier: string;
  /** Optional extra training-doc content to include after regen. */
  additionalContent?: string;
}

interface PreflightVideo {
  id: string;
  title: string;
}

interface PreflightFailure {
  id: string;
  title: string;
  error: string;
}

interface VideoListResponse {
  success?: boolean;
  videos?: PreflightVideo[];
  error?: string;
}

interface PreflightOneResponse {
  success?: boolean;
  result?: {
    id: string;
    title: string;
    valid: boolean;
    error?: string;
  };
  error?: string;
}

interface TranscribeOneResponse {
  success?: boolean;
  error?: string;
  result?: {
    transcribed?: boolean;
    error?: string;
  };
}

interface FailureItem {
  title?: string;
  video_id: string;
  error?: string;
}

const TranscribeVideosButton = ({ planAgencyId, tier, additionalContent }: TranscribeVideosButtonProps) => {
  const { email } = useUser();
  const [count, setCount] = useState<number>(0);
  const [primaryAgencyId, setPrimaryAgencyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [failures, setFailures] = useState<FailureItem[]>([]);
  const [showFailures, setShowFailures] = useState(false);
  const [stage, setStage] = useState<"idle" | "preflight" | "review" | "transcribing" | "rebuilding">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0, currentTitle: "" });
  const [preflightValid, setPreflightValid] = useState<PreflightVideo[]>([]);
  const [showPreflightReview, setShowPreflightReview] = useState(false);

  const loadCount = async () => {
    if (!email) return;
    setIsLoading(true);
    try {
      // Custom videos live on the user's PRIMARY agency_id, not the plan slug.
      const { data: userRow } = await supabase
        .from("saas_suite_users")
        .select("agency_id")
        .eq("email", email.trim().toLowerCase())
        .maybeSingle();
      const primary = userRow?.agency_id || null;
      setPrimaryAgencyId(primary);
      if (!primary) {
        setCount(0);
        return;
      }
      const { count: total } = await supabase
        .from("custom_onboarding_videos")
        .select("id", { count: "exact", head: true })
        .eq("agency_id", primary)
        .eq("is_embed", false);
      setCount(total || 0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const handleClick = async () => {
    if (count === 0) {
      toast.info("No custom videos to transcribe");
      return;
    }
    const targetEmail = email?.trim().toLowerCase();
    if (!targetEmail) {
      toast.error("No account email found for transcription");
      return;
    }
    setIsRunning(true);
    setFailures([]);
    setPreflightValid([]);
    setStage("preflight");
    setProgress({ done: 0, total: 0, currentTitle: "" });
    const valid: PreflightVideo[] = [];
    const invalid: FailureItem[] = [];
    try {
      // STAGE 1A — Get every video first. This request does no URL work, so one bad URL cannot stop discovery.
      const { data: listData, error: listErr } = await supabase.functions.invoke("transcribe-video", {
        body: { mode: "list", target_email: targetEmail },
      });
      const list = listData as VideoListResponse | null;
      if (listErr || !list?.success) {
        console.error("video list error:", listErr || list?.error);
        toast.error("Failed to load videos for preflight");
        return;
      }
      const videos = list.videos ?? [];
      if (videos.length === 0) {
        toast.info("No custom videos to validate");
        return;
      }

      // STAGE 1B — Validate one-by-one. Every item has its own try/catch and progress update.
      setProgress({ done: 0, total: videos.length, currentTitle: "" });
      for (let i = 0; i < videos.length; i++) {
        const v = videos[i];
        setProgress({ done: i, total: videos.length, currentTitle: v.title });
        try {
          const { data: preData, error: preErr } = await supabase.functions.invoke("transcribe-video", {
            body: { mode: "preflight_one", video_id: v.id, target_email: targetEmail },
          });
          const pre = preData as PreflightOneResponse | null;
          if (preErr || !pre?.success || !pre.result) {
            invalid.push({ video_id: v.id, title: v.title, error: preErr?.message || pre?.error || "Preflight request failed" });
          } else if (pre.result.valid) {
            valid.push({ id: pre.result.id, title: pre.result.title });
          } else {
            invalid.push({ video_id: pre.result.id, title: pre.result.title, error: pre.result.error || "Invalid video URL" });
          }
        } catch (e: unknown) {
          invalid.push({ video_id: v.id, title: v.title, error: e instanceof Error ? e.message : "Preflight exception" });
        }
        setFailures([...invalid]);
        setPreflightValid([...valid]);
        setProgress({ done: i + 1, total: videos.length, currentTitle: v.title });
      }

      setFailures(invalid);
      setPreflightValid(valid);
      setStage("review");
      setShowPreflightReview(true);

      if (valid.length === 0) {
        toast.warning(`No transcribable videos found (${invalid.length} skipped)`);
        return;
      }

      toast.info(`Preflight done — ${valid.length} ready, ${invalid.length} skipped. Review, then proceed.`);
    } catch (err) {
      console.error("transcribe-video preflight exception:", err);
      toast.error("Failed to validate videos");
    } finally {
      setIsRunning(false);
    }
  };

  const handleProceed = async () => {
    const valid = preflightValid;
    if (valid.length === 0) {
      toast.info("No transcribable videos to run");
      return;
    }
    const targetEmail = email?.trim().toLowerCase();
    if (!targetEmail) {
      toast.error("No account email found for transcription");
      return;
    }
    setShowPreflightReview(false);
    setIsRunning(true);
    setStage("transcribing");
    setProgress({ done: 0, total: valid.length, currentTitle: "" });
    const allFailures = [...failures];
    try {
      // STAGE 2 — Transcribe one-by-one so progress is visible
      let succeeded = 0;

      for (let i = 0; i < valid.length; i++) {
        const v = valid[i];
        setProgress({ done: i, total: valid.length, currentTitle: v.title });
        try {
          const { data: one, error: oneErr } = await supabase.functions.invoke("transcribe-video", {
            body: { mode: "transcribe_one", video_id: v.id, target_email: targetEmail },
          });
          const r = (one as TranscribeOneResponse | null);
          if (oneErr) {
            allFailures.push({ video_id: v.id, title: v.title, error: oneErr.message || "Transcription request failed" });
          } else if (!r?.success) {
            allFailures.push({ video_id: v.id, title: v.title, error: r?.error || "Transcription request failed" });
          } else {
            if (r.result?.transcribed) {
              succeeded++;
            } else {
              allFailures.push({ video_id: v.id, title: v.title, error: r.result?.error || "Failed" });
            }
          }
        } catch (e: unknown) {
          allFailures.push({ video_id: v.id, title: v.title, error: e instanceof Error ? e.message : "Exception" });
        }
        setProgress({ done: i + 1, total: valid.length, currentTitle: v.title });
      }

      // STAGE 3 — Rebuild training doc
      setStage("rebuilding");
      // Rebuild against the PRIMARY agency_id (where videos & transcriptions live).
      // The selected plan's tier still controls which built-in modules are visible.
      const rebuildAgencyId = primaryAgencyId || planAgencyId;
      if (rebuildAgencyId) {
        await processTrainingDocContent(rebuildAgencyId, tier, additionalContent);
      }

      setFailures(allFailures);
      const totalAttempted = valid.length + failures.length;
      if (allFailures.length === 0) {
        toast.success(`Transcribed all ${succeeded} video${succeeded === 1 ? "" : "s"}`);
      } else {
        toast.success(`Transcribed ${succeeded} of ${totalAttempted} videos (${allFailures.length} skipped/failed)`);
      }
    } catch (err) {
      console.error("transcribe-video exception:", err);
      toast.error("Failed to transcribe videos");
    } finally {
      setIsRunning(false);
      setStage("idle");
      setPreflightValid([]);
    }
  };

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={stage === "review" ? () => setShowPreflightReview(true) : handleClick}
        disabled={isRunning || isLoading || count === 0}
        className="w-full"
      >
        {isRunning ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {stage === "preflight" && (progress.total > 0 ? `Validating ${Math.min(progress.done + 1, progress.total)} of ${progress.total}...` : "Loading videos...")}
            {stage === "transcribing" && `Transcribing ${progress.done + 1} of ${progress.total}...`}
            {stage === "rebuilding" && "Updating training document..."}
            {stage === "review" && "Ready to proceed"}
            {stage === "idle" && "Working..."}
          </>
        ) : stage === "review" && preflightValid.length > 0 ? (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Review {preflightValid.length} transcribable video{preflightValid.length === 1 ? "" : "s"}
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 mr-2" />
            Transcribe {count} custom video{count === 1 ? "" : "s"}
          </>
        )}
      </Button>
      {isRunning && stage === "transcribing" && progress.total > 0 && (
        <div className="space-y-1">
          <Progress value={(progress.done / progress.total) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground truncate">
            {progress.done}/{progress.total} — {progress.currentTitle || "starting..."}
          </p>
        </div>
      )}
      {isRunning && stage === "preflight" && progress.total > 0 && (
        <div className="space-y-1">
          <Progress value={(progress.done / progress.total) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground truncate">
            Checking {progress.done}/{progress.total} — {progress.currentTitle || "starting..."}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Sends each custom video URL to ElevenLabs and appends successful transcripts to your training document.
      </p>
      {stage === "review" && preflightValid.length > 0 && (
        <div className="space-y-2 rounded-md border border-border p-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Preflight complete</p>
              <p className="text-xs text-muted-foreground">
                {preflightValid.length} can be transcribed, {failures.length} skipped.
              </p>
            </div>
            <Button type="button" size="sm" onClick={handleProceed} disabled={isRunning}>
              <Play className="w-4 h-4 mr-2" />
              Proceed
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreflightReview(true)} className="w-full">
            View preflight results
          </Button>
        </div>
      )}
      {failures.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowFailures(true)}
          className="w-full text-destructive hover:text-destructive"
        >
          <AlertCircle className="w-4 h-4 mr-2" />
          View {failures.length} failure{failures.length === 1 ? "" : "s"}
        </Button>
      )}
      <Dialog open={showFailures} onOpenChange={setShowFailures}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Transcription failures</DialogTitle>
            <DialogDescription>
              These videos couldn't be transcribed. The most common reason is that the URL is a player page (Vimeo, YouTube, Loom) rather than a direct .mp4/.mp3 file — ElevenLabs requires a directly downloadable media URL.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto space-y-2 mt-2">
            {failures.map((f) => (
              <div key={f.video_id} className="text-sm border rounded p-2">
                <div className="font-medium">{f.title || f.video_id}</div>
                <div className="text-xs text-muted-foreground mt-1">{f.error || "Unknown error"}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showPreflightReview} onOpenChange={setShowPreflightReview}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Preflight results</DialogTitle>
            <DialogDescription>
              Review which videos can be transcribed before starting. Proceed only runs the transcribable videos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Can transcribe ({preflightValid.length})
              </div>
              <div className="max-h-[24vh] overflow-y-auto space-y-2 mt-2">
                {preflightValid.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No transcribable videos found.</p>
                ) : (
                  preflightValid.map((v) => (
                    <div key={v.id} className="text-sm border rounded p-2">
                      <div className="font-medium">{v.title || v.id}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="w-4 h-4 text-destructive" />
                Skipped / failed preflight ({failures.length})
              </div>
              <div className="max-h-[24vh] overflow-y-auto space-y-2 mt-2">
                {failures.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No videos skipped.</p>
                ) : (
                  failures.map((f) => (
                    <div key={f.video_id} className="text-sm border rounded p-2">
                      <div className="font-medium">{f.title || f.video_id}</div>
                      <div className="text-xs text-muted-foreground mt-1">{f.error || "Unknown error"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <Button type="button" className="w-full" onClick={handleProceed} disabled={preflightValid.length === 0 || isRunning}>
              <Play className="w-4 h-4 mr-2" />
              Proceed with {preflightValid.length} video{preflightValid.length === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TranscribeVideosButton;