import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from './ChatContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSuggestions } from './ChatSuggestions';
import { useChatCoPilot } from '@/hooks/useChatCoPilot';
import { PendingSuggestions } from './PendingSuggestions';
import { UserCheck } from 'lucide-react';
import { CopilotMark, ThinkingRow } from '@/components/premium/copilot/CopilotBits';
import { useUiSounds } from '@/hooks/useUiSounds';
import {
  humanThreadIsQuiet,
  latestTeamReplyAt,
  messageIsTeamReply,
  showHandoverWaitingNote,
  teamReplyWithinQuietWindow,
} from '../../../supabase/functions/chat-copilot/handoverQuiet';

interface ChatCoPilotContentProps {
  preloadedPrompt?: string;
  onExchangeCountChange?: (count: number) => void;
  hideHeader?: boolean;
  onPromptConsumed?: () => void;
}

function ChatCoPilotContent({ preloadedPrompt, onExchangeCountChange, hideHeader, onPromptConsumed }: ChatCoPilotContentProps) {
  const { sendMessage, isLoading } = useChatCoPilot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages: contextMessages, userExchangeCount, isHandedOver, aiResumedAt } = useChatContext();
  const hasTeamReply = contextMessages.some((message) => messageIsTeamReply(message));
  const humanQuiet = humanThreadIsQuiet({
    isHandedOver,
    hasRecentTeamReply: teamReplyWithinQuietWindow(contextMessages),
    resumedAt: aiResumedAt,
    latestTeamReplyAt: latestTeamReplyAt(contextMessages),
  });
  const waitingNote = showHandoverWaitingNote({ isHandedOver, hasTeamReply });
  const { playSend, playReceive } = useUiSounds();
  const lastAssistantIdRef = useRef<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [contextMessages]);

  // Play a subtle chime when a new assistant message arrives.
  useEffect(() => {
    const last = contextMessages[contextMessages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (last.id === 'initial') { lastAssistantIdRef.current = last.id; return; }
    if (lastAssistantIdRef.current !== last.id) {
      lastAssistantIdRef.current = last.id;
      playReceive();
    }
  }, [contextMessages, playReceive]);

  // Notify parent of exchange count changes
  useEffect(() => {
    onExchangeCountChange?.(userExchangeCount);
  }, [userExchangeCount, onExchangeCountChange]);

  const handleSend = (msg: string, attachments?: any[]) => {
    playSend();
    const result = sendMessage(msg, attachments as any);
    onPromptConsumed?.();
    return result;
  };

  const handleSuggestionClick = (suggestion: string) => handleSend(suggestion);

  return (
    <div className="px-canvas flex h-full flex-col">
      {/* Header (hidden when the shell renders its own) */}
      {!hideHeader && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <CopilotMark size="md" />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">SaaSSuite Copilot</h2>
            <p className="truncate text-caption text-muted-foreground">Your setup assistant</p>
          </div>
        </div>
      )}

      {/* Pending suggestions from webhook */}
      {!humanQuiet && <PendingSuggestions onApply={sendMessage} />}

      {/* Messages */}
      <ScrollArea
        className="flex-1 w-full min-w-0 p-4 [&>div>div]:!block [&>div>div]:!w-full [&>div>div]:!min-w-0"
        ref={scrollRef}
      >
        <div className="w-full min-w-0 space-y-4 pb-4">
          {contextMessages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && <ThinkingRow name="Copilot" />}
        </div>
      </ScrollArea>

      {/* Suggestions and Input. Handover never removes the reply box. */}
      <div className="space-y-3 border-t border-border bg-card/60 p-3 sm:p-4">
        {waitingNote && (
          <div data-testid="help-chat-waiting-note" className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            <UserCheck className="h-4 w-4 flex-shrink-0 text-success" />
            <span>AI replies are paused for human support. You can leave a message here or text our team.</span>
          </div>
        )}
        {!humanQuiet && (
          <ChatSuggestions
            onSuggestionClick={handleSuggestionClick}
            disabled={isLoading}
          />
        )}
        <ChatInput
          onSend={handleSend}
          isLoading={isLoading}
          preloadedPrompt={humanQuiet ? undefined : preloadedPrompt}
          placeholder={humanQuiet ? "Reply to the team..." : undefined}
        />
      </div>
    </div>
  );
}

interface ChatCoPilotProps {
  preloadedPrompt?: string;
  onExchangeCountChange?: (count: number) => void;
  hideHeader?: boolean;
  onPromptConsumed?: () => void;
}

export function ChatCoPilot({ preloadedPrompt, onExchangeCountChange, hideHeader, onPromptConsumed }: ChatCoPilotProps) {
  // ChatProvider is provided by CoPilotShell so voice + text share one context.
  return (
    <ChatCoPilotContent
      preloadedPrompt={preloadedPrompt}
      onExchangeCountChange={onExchangeCountChange}
      hideHeader={hideHeader}
      onPromptConsumed={onPromptConsumed}
    />
  );
}
