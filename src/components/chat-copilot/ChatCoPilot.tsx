import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatContext } from './ChatContext';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatSuggestions } from './ChatSuggestions';
import { useChatCoPilot } from '@/hooks/useChatCoPilot';
import { PendingSuggestions } from './PendingSuggestions';
import { Bot, Sparkles, UserCheck } from 'lucide-react';
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
    <div className="flex flex-col h-full bg-background">
      {/* Header (hidden when the shell renders its own) */}
      {!hideHeader && (
      <div className="flex items-center gap-2 md:gap-3 p-3 md:p-4 border-b">
        <div className="w-7 h-7 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-sm md:text-lg flex items-center gap-1.5 md:gap-2">
            SaaSSuite CoPilot
            <Sparkles className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
          </h2>
          <p className="text-[10px] md:text-xs text-muted-foreground">
            AI-powered configuration assistant
          </p>
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
          {isLoading && (
            <div className="flex gap-2 md:gap-3 justify-start">
              <div className="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <Bot className="w-3 h-3 md:w-4 md:h-4 text-white" />
              </div>
              <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 md:px-4 md:py-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggestions and Input. Handover never removes the reply box. */}
      <div className="border-t p-4 space-y-3">
        {waitingNote && (
          <div data-testid="help-chat-waiting-note" className="flex items-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground text-sm">
            <UserCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
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
