import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X } from "lucide-react";

export interface ChatAttachmentValue {
  file: File;
  previewUrl: string;
}

interface Props {
  value: ChatAttachmentValue | null;
  onChange: (v: ChatAttachmentValue | null) => void;
  disabled?: boolean;
}

/** Paperclip button for chat composers — pick one image to send with the reply. */
export function ChatAttachButton({ value, onChange, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file || !file.type.startsWith("image/")) return;
          onChange({ file, previewUrl: URL.createObjectURL(file) });
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label="Attach image"
        title="Attach image"
      >
        <Paperclip className="w-4 h-4" />
      </Button>
    </>
  );
}

export function ChatAttachmentPreview({
  value,
  onRemove,
  disabled,
}: {
  value: ChatAttachmentValue | null;
  onRemove: () => void;
  disabled?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="relative inline-block max-w-full mb-2">
      <img
        src={value.previewUrl}
        alt="Attachment preview"
        className="max-h-24 max-w-full object-contain rounded border border-border"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="absolute -top-2 -right-2 bg-background border border-border rounded-full p-1 shadow-sm hover:bg-muted"
        aria-label="Remove attachment"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
