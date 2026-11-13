import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

export interface DropFile {
  file: File;
  previewUrl: string;
}

const MAX_FILES = 10;

export function filesToDropFiles(list: FileList | File[] | null | undefined): DropFile[] {
  const out: DropFile[] = [];
  Array.from(list || []).forEach((file) => {
    if (!file.type.startsWith("image/")) {
      toast.error(`${file.name} isn't an image — only images can be attached.`);
      return;
    }
    out.push({ file, previewUrl: URL.createObjectURL(file) });
  });
  return out;
}

interface Props {
  value: DropFile[];
  onChange: (v: DropFile[]) => void;
  disabled?: boolean;
  label?: string;
}

/** Drag-and-drop (or click) area that accepts several image attachments at once. */
export function MultiAttachmentDropzone({ value, onChange, disabled, label = "Attachments" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const add = (list: FileList | File[] | null) => {
    const next = [...value, ...filesToDropFiles(list)].slice(0, MAX_FILES);
    if (value.length + (list?.length || 0) > MAX_FILES) toast.info(`Up to ${MAX_FILES} attachments.`);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) add(e.dataTransfer.files); }}
        className={`rounded-md border-2 border-dashed p-4 text-center text-xs cursor-pointer transition-colors ${
          over ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-muted/40"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <ImagePlus className="w-5 h-5 mx-auto mb-1" />
        Drag & drop images here, or click to choose (multiple allowed)
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => { add(e.target.files); e.target.value = ""; }}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((f, i) => (
            <div key={f.previewUrl} className="relative">
              <img src={f.previewUrl} alt={f.file.name} className="h-16 w-16 object-cover rounded border border-border" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                disabled={disabled}
                className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-0.5 shadow-sm hover:bg-muted"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
