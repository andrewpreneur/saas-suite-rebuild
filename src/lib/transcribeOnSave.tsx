import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

/**
 * Transcribe one saved custom video and add it to the support documentation.
 * Shows a loading toast, then a success or a failure toast that explains why.
 */
export async function transcribeVideoOnSave(videoId: string, title: string, email: string | null | undefined, isEmbed: boolean): Promise<boolean> {
  const target_email = email?.trim().toLowerCase();
  const label = `"${title}"`;
  if (isEmbed) {
    toast.error(`Couldn't transcribe ${label}`, { description: "Embed codes can't be transcribed. Use a direct video link instead." });
    return false;
  }
  if (!target_email) {
    toast.error(`Couldn't transcribe ${label}`, { description: "No account email was found." });
    return false;
  }
  const id = toast.loading(`Transcribing ${label} for your support documentation…`);
  try {
    const { data: pre, error: preErr } = await supabase.functions.invoke("transcribe-video", {
      body: { mode: "preflight_one", video_id: videoId, target_email },
    });
    const p = pre as any;
    if (preErr || !p?.success || !p?.result?.valid) {
      throw new Error(p?.result?.error || p?.error || preErr?.message || "The video link couldn't be checked.");
    }
    const { data: one, error: oneErr } = await supabase.functions.invoke("transcribe-video", {
      body: { mode: "transcribe_one", video_id: videoId, target_email },
    });
    const r = one as any;
    if (oneErr || !r?.success || !r?.result?.transcribed) {
      throw new Error(r?.result?.error || r?.error || oneErr?.message || "Transcription failed.");
    }
    toast.success(`${label} transcribed and added to support documentation`, { id });
    return true;
  } catch (e) {
    toast.error(`Couldn't transcribe ${label}`, { id, description: e instanceof Error ? e.message : "Unknown error" });
    return false;
  }
}

export function TranscribeOnSaveCheckbox({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(c) => onChange(!!c)} />
      <Label htmlFor={id} className="text-xs text-muted-foreground cursor-pointer">
        Automatically transcribe video and add to support documentation
      </Label>
    </div>
  );
}
