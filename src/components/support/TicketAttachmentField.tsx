import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ImagePlus, X } from "lucide-react";

export interface TicketAttachmentValue {
  file: File;
  previewUrl: string;
}

interface Props {
  value: TicketAttachmentValue | null;
  onChange: (v: TicketAttachmentValue | null) => void;
  disabled?: boolean;
}

export function TicketAttachmentField({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    onChange({ file, previewUrl: URL.createObjectURL(file) });
  };

  return (
    <div>
      <Label className="text-sm font-medium mb-1 block">Attach an image (optional)</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative inline-block">
          <img
            src={value.previewUrl}
            alt="Attachment preview"
            className="max-h-40 rounded border border-border"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 shadow-sm hover:bg-muted"
            aria-label="Remove attachment"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="w-4 h-4 mr-1" />
          Attach image
        </Button>
      )}
    </div>
  );
}