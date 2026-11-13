import { useState, useEffect, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ChatAttachment } from './ChatContext';
import { clearUnsentDraft, readUnsentDraft, rememberUnsentDraft } from '@/lib/unsentDraft';

export interface ChatInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void | "kept" | Promise<void | "kept">;
  isLoading: boolean;
  disabled?: boolean;
  preloadedPrompt?: string;
  placeholder?: string;
}

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

export function ChatInput({ onSend, isLoading, disabled, preloadedPrompt, placeholder }: ChatInputProps) {
  const [input, setInput] = useState(() => readUnsentDraft());
  const [hasPreloaded, setHasPreloaded] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow the box with the message (capped by max-h, then scrolls)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Pre-load a prompt into the input field (once)
  useEffect(() => {
    if (preloadedPrompt && !hasPreloaded && !readUnsentDraft()) {
      setInput(preloadedPrompt);
      setHasPreloaded(true);
    }
  }, [preloadedPrompt, hasPreloaded]);

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (list.length === 0) {
      toast.error('Only image screenshots are supported.');
      return;
    }
    const room = MAX_ATTACHMENTS - attachments.length;
    if (room <= 0) {
      toast.error(`Max ${MAX_ATTACHMENTS} images per message.`);
      return;
    }
    const toAdd: ChatAttachment[] = [];
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
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length > 0 && files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault();
      void addFiles(files);
    }
  };

  const handleSend = async () => {
    const hasContent = input.trim() || attachments.length > 0;
    if (!hasContent || isLoading || disabled) return;
    const snapshot = input;
    const keptAttachments = attachments;
    const outgoing = input.trim() || '(screenshot attached)';
    setInput('');
    setAttachments([]);
    try {
      const result = await onSend(outgoing, keptAttachments.length ? keptAttachments : undefined);
      if (result === "kept") {
        setInput(snapshot);
        setAttachments(keptAttachments);
        rememberUnsentDraft(snapshot);
        textareaRef.current?.focus();
        return;
      }
      clearUnsentDraft();
    } catch {
      setInput(snapshot);
      setAttachments(keptAttachments);
      rememberUnsentDraft(snapshot);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((a, i) => (
            <div key={i} className="relative group">
              <img
                src={a.url}
                alt={a.name || 'attachment'}
                className="h-16 w-16 object-cover rounded border border-border"
              />
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-1 -right-1 bg-background border border-border rounded-full p-0.5 shadow-sm opacity-90 hover:opacity-100"
                aria-label="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end" data-testid="help-chat-composer">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-12 w-12 flex-shrink-0"
          disabled={isLoading || disabled || attachments.length >= MAX_ATTACHMENTS}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach screenshot"
        >
          <Paperclip className="w-5 h-5" />
        </Button>
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder || "Type your message or paste a screenshot..."}
          disabled={isLoading || disabled}
          className="min-h-[48px] max-h-[40vh] resize-none flex-1 overflow-y-auto"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={(!input.trim() && attachments.length === 0) || isLoading || disabled}
          size="icon"
          className="h-12 w-12 flex-shrink-0" aria-label="Send message">
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
