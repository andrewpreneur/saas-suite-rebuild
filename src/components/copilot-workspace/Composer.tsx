import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPOSER_MAX_LINES } from "@/lib/copilotWorkspace";
import { clearUnsentDraft, rememberUnsentDraft } from "@/lib/unsentDraft";
import { Button } from "@/components/ui/button";

const LINE_PX = 24;

interface Props {
  placeholder: string;
  disabled?: boolean;
  onSend: (text: string) => void | "kept" | Promise<void | "kept">;
  onVoice?: () => void;
  autoFocus?: boolean;
  initialValue?: string;
}

/** ChatGPT-style composer: grows one line at a time up to ~10 lines, then scrolls. */
export function Composer({ placeholder, disabled, onSend, onVoice, autoFocus = true, initialValue = "" }: Props) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const max = LINE_PX * COMPOSER_MAX_LINES;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  useEffect(() => { if (autoFocus && !disabled) ref.current?.focus(); }, [autoFocus, disabled]);

  const submit = async () => {
    const t = value.trim();
    if (!t || disabled) return;
    const snapshot = value;
    setValue("");
    try {
      const result = await onSend(t);
      if (result === "kept") {
        setValue(snapshot);
        rememberUnsentDraft(snapshot);
        ref.current?.focus();
        return;
      }
      clearUnsentDraft();
    } catch {
      setValue(snapshot);
      rememberUnsentDraft(snapshot);
    }
    requestAnimationFrame(() => ref.current?.focus());
  };

  return (
    <div className="w-full min-w-0 rounded-[28px] border border-border bg-card shadow-sm px-4 py-2.5 flex items-end gap-2 focus-within:ring-2 focus-within:ring-ring/30 transition-shadow">
      <label htmlFor="copilot-composer" className="sr-only">{placeholder}</label>
      <textarea
        id="copilot-composer"
        ref={ref}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
        }}
        enterKeyHint="send"
        className="flex-1 min-w-0 resize-none bg-transparent text-base leading-6 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none"
        style={{ lineHeight: `${LINE_PX}px` }}
      />
      {value.trim() ? (
        <Button size="icon"
          type="button" onClick={submit} disabled={disabled} aria-label="Send message"
          className="mb-0.5 h-9 w-9 shrink-0 rounded-full bg-foreground text-background flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40"
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
      ) : (
        <Button size="icon" disabled={disabled || !onVoice}
          type="button" onClick={onVoice} aria-label="Voice mode"
          className={cn("mb-0.5 h-9 w-9 shrink-0 rounded-full bg-foreground text-background flex items-center justify-center transition-transform active:scale-95", !onVoice && "opacity-40")}
        >
          <AudioLines className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
}
