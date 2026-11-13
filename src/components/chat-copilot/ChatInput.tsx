import { useState } from 'react';
import type { ChatAttachment } from './ChatContext';
import { readUnsentDraft } from '@/lib/unsentDraft';
import { CopilotPromptBox } from '@/components/premium/copilot/CopilotPromptBox';

export interface ChatInputProps {
  onSend: (message: string, attachments?: ChatAttachment[]) => void | "kept" | Promise<void | "kept">;
  isLoading: boolean;
  disabled?: boolean;
  preloadedPrompt?: string;
  placeholder?: string;
}

/** Help chat composer: the brand prompt box with screenshot attachments (paperclip, paste or drop). */
export function ChatInput({ onSend, isLoading, disabled, preloadedPrompt, placeholder }: ChatInputProps) {
  const [draft] = useState(() => readUnsentDraft());
  return (
    <div className="flex flex-col gap-2" data-testid="help-chat-composer">
      <CopilotPromptBox
        textareaId="help-chat-input"
        placeholder={placeholder || "Type your message or paste a screenshot..."}
        onSend={(message, attachments) => onSend(message, attachments as ChatAttachment[] | undefined)}
        isLoading={isLoading}
        disabled={disabled}
        allowAttachments
        initialValue={draft}
        preloadedPrompt={preloadedPrompt}
      />
    </div>
  );
}
