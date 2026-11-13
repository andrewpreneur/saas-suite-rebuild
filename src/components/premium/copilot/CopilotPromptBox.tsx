// Source: 21st.dev "AI prompt Box" by @jahed (demo id 2321). Adapted for the SaaSSuite design system.
//
// This is the Copilot build of `PromptInputBox` (src/components/premium/21st/ai-prompt-box.tsx): the same
// rounded box, text area on top, action row underneath and morphing send / voice button, recolored to the
// brand tokens and wired to our own handlers (unsent drafts, "kept" sends, screenshot attachments, voice mode).
import { useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, AudioLines, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY, popIn } from "@/lib/motion";
import { COMPOSER_MAX_LINES } from "@/lib/copilotWorkspace";
import { clearUnsentDraft, readUnsentDraft, rememberUnsentDraft } from "@/lib/unsentDraft";

export type PromptAttachment = { url: string; name?: string; mimeType?: string };
type SendResult = void | "kept";

export interface CopilotPromptBoxProps {
  placeholder: string;
  onSend: (text: string, attachments?: PromptAttachment[]) => SendResult | Promise<SendResult>;
  /** Opens voice mode. Shown in place of Send while the box is empty. */
  onVoice?: () => void;
  /** Blocks sending (a reply is in flight). Typing stays possible. */
  disabled?: boolean;
  /** Shows the spinner on the send button. */
  isLoading?: boolean;
  /** Screenshot attachments: paperclip, paste and drop. */
  allowAttachments?: boolean;
  autoFocus?: boolean;
  initialValue?: string;
  /** Filled in once, unless an unsent draft is already waiting. */
  preloadedPrompt?: string;
  textareaId?: string;
  testId?: string;
  /** Quiet extras on the left of the action row. */
  leading?: ReactNode;
  className?: string;
}

const LINE_PX = 24;
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_ATTACHMENTS = 3;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const roundButton =
  "inline-grid size-11 shrink-0 place-items-center rounded-full transition-[transform,background-color,color,filter] duration-200 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 active:scale-95 disabled:pointer-events-none disabled:opacity-40 " +
  "motion-reduce:transition-none sm:size-9";

export function CopilotPromptBox({
  placeholder,
  onSend,
  onVoice,
  disabled,
  isLoading,
  allowAttachments = false,
  autoFocus = false,
  initialValue = "",
  preloadedPrompt,
  textareaId = "copilot-composer",
  testId,
  leading,
  className,
}: CopilotPromptBoxProps) {
  const [value, setValue] = useState(initialValue);
  const [attachments, setAttachments] = useState<PromptAttachment[]>([]);
  const [hasPreloaded, setHasPreloaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Grows one line at a time up to COMPOSER_MAX_LINES, then scrolls.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const max = LINE_PX * COMPOSER_MAX_LINES;
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  useEffect(() => {
    if (preloadedPrompt && !hasPreloaded && !readUnsentDraft()) {
      setValue(preloadedPrompt);
      setHasPreloaded(true);
    }
  }, [preloadedPrompt, hasPreloaded]);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) {
      toast.error("Only image screenshots are supported.");
      return;
    }
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast.error(`Max ${MAX_ATTACHMENTS} images per message.`);
      return;
    }
    const toAdd: PromptAttachment[] = [];
    for (const file of list.slice(0, room)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} is over 4MB. Please resize and try again.`);
        continue;
      }
      const url = await fileToDataUrl(file);
      toAdd.push({ url, name: file.name, mimeType: file.type });
    }
    if (toAdd.length) setAttachments((prev) => [...prev, ...toAdd]);
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (!allowAttachments) return;
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length > 0 && files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!allowAttachments) return;
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files);
  };

  const hasContent = value.trim() !== "" || attachments.length > 0;
  const blocked = Boolean(disabled || isLoading);

  const submit = async () => {
    if (!hasContent || blocked) return;
    const snapshot = value;
    const keptAttachments = attachments;
    const outgoing = value.trim() || "(screenshot attached)";
    setValue("");
    setAttachments([]);
    try {
      const result = await onSend(outgoing, keptAttachments.length ? keptAttachments : undefined);
      if (result === "kept") {
        setValue(snapshot);
        setAttachments(keptAttachments);
        rememberUnsentDraft(snapshot);
        ref.current?.focus();
        return;
      }
      clearUnsentDraft();
    } catch {
      setValue(snapshot);
      setAttachments(keptAttachments);
      rememberUnsentDraft(snapshot);
    }
    requestAnimationFrame(() => ref.current?.focus());
  };

  const showVoice = !hasContent && !!onVoice && !isLoading;

  return (
    <div
      data-testid={testId}
      onDragOver={allowAttachments ? (e) => { e.preventDefault(); setDragging(true); } : undefined}
      onDragLeave={allowAttachments ? () => setDragging(false) : undefined}
      onDrop={allowAttachments ? handleDrop : undefined}
      className={cn(
        "w-full min-w-0 rounded-xl border border-border bg-card p-2 shadow-raised",
        "transition-[border-color,box-shadow] duration-200 focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10",
        dragging && "border-brand/60 ring-4 ring-brand/15",
        className,
      )}
    >
      <AnimatePresence initial={false}>
        {attachments.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2 overflow-hidden px-1"
          >
            {attachments.map((a, i) => (
              <motion.li key={`${a.name}-${i}`} variants={popIn} initial="hidden" animate="show" className="relative mb-1 mt-1">
                <img src={a.url} alt={a.name || "attachment"} className="size-16 rounded-md border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 inline-grid size-5 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-card hover:text-foreground"
                  aria-label="Remove attachment"
                >
                  <X className="size-3" />
                </button>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <label htmlFor={textareaId} className="sr-only">{placeholder}</label>
      <textarea
        id={textareaId}
        ref={ref}
        rows={1}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onPaste={handlePaste}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void submit();
          }
        }}
        enterKeyHint="send"
        className="block w-full min-w-0 resize-none bg-transparent px-2.5 pb-1 pt-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none"
        style={{ lineHeight: `${LINE_PX}px` }}
      />

      <div className="flex items-center gap-1 pt-1">
        {allowAttachments && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={blocked || attachments.length >= MAX_ATTACHMENTS}
              aria-label="Attach screenshot"
              title="Attach a screenshot"
              className={cn(roundButton, "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              <Paperclip className="size-[18px]" />
            </button>
          </>
        )}
        <div className="flex min-w-0 flex-1 items-center gap-1">{leading}</div>
        <AnimatePresence mode="wait" initial={false}>
          {showVoice ? (
            <motion.button
              key="voice"
              type="button"
              onClick={onVoice}
              disabled={disabled}
              aria-label="Voice mode"
              title="Talk instead of typing"
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.6, transition: { duration: 0.08 } }}
              transition={SPRING_SNAPPY}
              className={cn(roundButton, "bg-brand-subtle text-brand hover:brightness-95")}
            >
              <AudioLines className="size-[18px]" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              type="button"
              onClick={() => void submit()}
              disabled={!hasContent || blocked}
              aria-label="Send message"
              title="Send"
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.6, transition: { duration: 0.08 } }}
              transition={SPRING_SNAPPY}
              className={cn(roundButton, "px-brand-fill hover:brightness-110")}
            >
              {isLoading ? <Loader2 className="size-[18px] animate-spin" /> : <ArrowUp className="size-[18px]" strokeWidth={2.4} />}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
