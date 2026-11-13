import { Bot, User, Headset } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChatMessage as ChatMessageType } from './ChatContext';
import { ActionConfirmation } from './ActionConfirmation';
import ReactMarkdown from 'react-markdown';
import { renderMessageContent } from '@/lib/renderChatContent';
import { parseAssistant } from '@/lib/copilotWorkspace';
import { MenuRemovalSetupCard, GuideScreenshot } from '../copilot-workspace/MenuRemovalSetupCard';
import { TextUsDialog } from '@/components/dashboard/SetupHelpPopup';
import { Button } from '@/components/ui/button';
import { useGhl } from '../highlevel/useGhl';
import { useState } from 'react';

interface ChatMessageProps {
  message: ChatMessageType;
  isLast?: boolean;
}

export function ChatMessage({ message, isLast }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';
  const { agencyId } = useGhl();
  const [helpOpen, setHelpOpen] = useState(false);
  
  const isTeamMember =
    isAssistant &&
    Array.isArray(message.actions) &&
    message.actions.some((a) => a?.tool === 'admin_reply');

  const { text, widgets } = isAssistant ? parseAssistant(message.content) : { text: message.content, widgets: [] };

  return (
    <div
      className={cn(
        'flex gap-2 md:gap-3 animate-fade-in',
        isAssistant ? 'justify-start' : 'justify-end'
      )}
    >
      {isAssistant && (
        <div
          className={cn(
            'flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center bg-gradient-to-br',
            isTeamMember
              ? 'from-emerald-500 to-teal-600'
              : 'from-purple-500 to-blue-500'
          )}
        >
          {isTeamMember ? (
            <Headset className="w-3 h-3 md:w-4 md:h-4 text-white" />
          ) : (
            <Bot className="w-3 h-3 md:w-4 md:h-4 text-white" />
          )}
        </div>
      )}

      <div
        className={cn(
          'min-w-0 max-w-[85%] overflow-hidden break-words rounded-2xl px-3 py-2 md:px-4 md:py-3',
          isAssistant
            ? 'bg-muted text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        )}
      >
        {message.attachments && message.attachments.length > 0 && (
          <div className={cn('flex flex-wrap gap-2', (message.content ? 'mb-2' : ''))}>
            {message.attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                <img
                  src={a.url}
                  alt={a.name || 'attachment'}
                  className="max-h-40 rounded border border-border/40"
                />
              </a>
            ))}
          </div>
        )}
        {isAssistant ? (
          <div className="prose prose-sm dark:prose-invert max-w-none break-words text-xs md:text-sm [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto">
            {isTeamMember && (
              <div className="mb-1 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 not-prose">
                Team Member
              </div>
            )}
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                code: ({ children }) => (
                  <code className="px-1 py-0.5 bg-background/50 rounded text-xs">{children}</code>
                ),
              }}
            >
              {text}
            </ReactMarkdown>
            
            {widgets.length > 0 && (
              <div className="mt-3 space-y-3 not-prose">
                {widgets.map((w, i) => w.kind === 'screenshot' ? <GuideScreenshot key={i} k={w.key} /> : w.kind === 'widget' && w.name === 'human_help' ? <Button key={i} size="sm" variant="outline" onClick={() => setHelpOpen(true)}><Headset className="h-4 w-4" />Text us for human help</Button> : w.kind === 'widget' && w.name === 'menu_removal_setup' ? <MenuRemovalSetupCard key={i} agencyId={agencyId} onHelp={() => setHelpOpen(true)} onConnect={() => { window.location.href = '/app/copilot'; }} onUpgrade={() => { window.location.href = '/app/copilot'; }} /> : w.kind === 'widget' ? <Button key={i} size="sm" variant="outline" onClick={() => { window.location.href = '/app/copilot'; }}>Continue in full-screen Copilot</Button> : null)}
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs md:text-sm">{renderMessageContent(message.content)}</div>
        )}

        {/* Action confirmations */}
        {!isTeamMember && message.actions && message.actions.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.actions.map((action, index) => (
              <ActionConfirmation key={index} message={action.message} />
            ))}
          </div>
        )}
      </div>

      <TextUsDialog open={helpOpen} onOpenChange={setHelpOpen} title="Need a hand?" description="Text our team for human support." message={`I need human support with SaaSSuite. Agency: ${agencyId || "loading"}.`} />

      {!isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <User className="w-4 h-4 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
