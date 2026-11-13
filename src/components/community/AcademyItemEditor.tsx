import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2, Upload } from "lucide-react";
import { STAGES, type Stage } from "@/constants/academyContent";
import {
  deleteAcademyItem,
  saveAcademyItem,
  uploadAcademyAsset,
  type AcademyKind,
  type AcademyRow,
} from "@/hooks/useAcademyContent";

const KIND_LABELS: Record<AcademyKind, string> = {
  lesson: "Lesson",
  prompt: "Prompt",
  skill: "Skill",
  tech: "Tech library link",
};

export default function AcademyItemEditor({
  open,
  kind,
  item,
  onClose,
  onSaved,
}: {
  open: boolean;
  kind: AcademyKind;
  /** Existing row to edit, or null to create a new one. */
  item: AcademyRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Partial<AcademyRow>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(
      item ?? {
        kind,
        stage: kind === "tech" ? null : "foundation",
        title: "",
        is_published: true,
        is_new: false,
        owner_only: false,
        sort_order: 0,
      },
    );
  }, [open, item, kind]);

  const set = <K extends keyof AcademyRow>(key: K, value: AcademyRow[K] | null) =>
    setDraft((prev) => ({ ...prev, [key]: value as AcademyRow[K] }));

  const handleUpload = async (file: File, field: "file_url" | "thumbnail_url" | "video_url") => {
    setUploading(field);
    try {
      const reference = await uploadAcademyAsset(file, kind);
      set(field, reference);
      if (field === "file_url") set("file_label", file.name);
      toast({ title: "Uploaded", description: file.name });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!draft.title?.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await saveAcademyItem({ ...draft, kind });
      toast({ title: `${KIND_LABELS[kind]} saved` });
      onSaved();
      onClose();
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item?.id || item.id.startsWith("fallback-")) return;
    setBusy(true);
    try {
      await deleteAcademyItem(item.id);
      toast({ title: `${KIND_LABELS[kind]} deleted` });
      onSaved();
      onClose();
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const UploadButton = ({
    field,
    label,
    accept,
  }: {
    field: "file_url" | "thumbnail_url" | "video_url";
    label: string;
    accept?: string;
  }) => (
    <Button size="sm" variant="outline" className="gap-2" asChild disabled={uploading === field}>
      <label>
        {uploading === field ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {label}
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleUpload(file, field);
          }}
        />
      </label>
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {item ? `Edit ${KIND_LABELS[kind].toLowerCase()}` : `New ${KIND_LABELS[kind].toLowerCase()}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={draft.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </div>

          {kind !== "tech" && (
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select
                value={(draft.stage as string) ?? "foundation"}
                onValueChange={(value) => set("stage", value as Stage)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          {kind === "lesson" && (
            <>
              <div className="space-y-1.5">
                <Label>Video URL (YouTube embed, or upload a file)</Label>
                <div className="flex gap-2">
                  <Input
                    value={draft.video_url ?? ""}
                    onChange={(e) => set("video_url", e.target.value)}
                    placeholder="https://www.youtube.com/embed/..."
                  />
                  <UploadButton field="video_url" label="Upload" accept="video/*" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Thumbnail URL (optional — upload or paste)</Label>
                <div className="flex gap-2">
                  <Input
                    value={draft.thumbnail_url ?? ""}
                    onChange={(e) => set("thumbnail_url", e.target.value)}
                  />
                  <UploadButton field="thumbnail_url" label="Upload" accept="image/*" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    value={draft.duration_minutes ?? ""}
                    onChange={(e) =>
                      set("duration_minutes", e.target.value === "" ? null : Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Format</Label>
                  <Input
                    value={draft.format ?? ""}
                    onChange={(e) => set("format", e.target.value)}
                    placeholder="Presentation"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>External watch link (opens in a new tab instead of embedding)</Label>
                <Input
                  value={draft.external_url ?? ""}
                  onChange={(e) => set("external_url", e.target.value)}
                />
              </div>
            </>
          )}

          {kind === "prompt" && (
            <>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Input value={draft.category ?? ""} onChange={(e) => set("category", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Prompt text</Label>
                <Textarea
                  rows={12}
                  className="font-mono text-xs"
                  value={draft.prompt_text ?? ""}
                  onChange={(e) => set("prompt_text", e.target.value)}
                />
              </div>
            </>
          )}

          {kind === "skill" && (
            <>
              <div className="space-y-1.5">
                <Label>Skill file (upload, or paste a URL/path)</Label>
                <div className="flex gap-2">
                  <Input
                    value={draft.file_url ?? ""}
                    onChange={(e) => set("file_url", e.target.value)}
                    placeholder="/skills/my-skill.md"
                  />
                  <UploadButton field="file_url" label="Upload" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Download file name</Label>
                <Input
                  value={draft.file_label ?? ""}
                  onChange={(e) => set("file_label", e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label>Owner only</Label>
                  <p className="text-xs text-muted-foreground">Locked for everyone but you.</p>
                </div>
                <Switch
                  checked={Boolean(draft.owner_only)}
                  onCheckedChange={(value) => set("owner_only", value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <Label>Show NEW badge</Label>
                  <p className="text-xs text-muted-foreground">Highlights the card.</p>
                </div>
                <Switch
                  checked={Boolean(draft.is_new)}
                  onCheckedChange={(value) => set("is_new", value)}
                />
              </div>
            </>
          )}

          {kind === "tech" && (
            <div className="space-y-1.5">
              <Label>Website URL</Label>
              <Input
                value={draft.external_url ?? ""}
                onChange={(e) => set("external_url", e.target.value)}
                placeholder="https://"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Sort order</Label>
              <Input
                type="number"
                value={draft.sort_order ?? 0}
                onChange={(e) => set("sort_order", Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>Published</Label>
              <Switch
                checked={draft.is_published ?? true}
                onCheckedChange={(value) => set("is_published", value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {item && !item.id.startsWith("fallback-") ? (
            <Button variant="destructive" size="sm" className="gap-2" disabled={busy} onClick={() => void remove()}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button variant="accent" size="sm" className="gap-2" onClick={() => void save()} disabled={busy}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
