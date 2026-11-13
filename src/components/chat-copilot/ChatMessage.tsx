import { Headset } from 'lucide-react';
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
import { AssistantMessage, COPILOT_PROSE, UserBubble } from '@/components/premium/copilot/CopilotBits';

interface ChatMessageProps {
  message: ChatMessageType;
  isLast?: boolean;
}

function Attachments({ message, onBrand }: { message: ChatMessageType; onBrand?: boolean }) {
  if (!message.attachments || message.attachments.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-2', message.content ? 'mb-2' : '')}>
      {message.attachments.map((a, i) => (
        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={a.url}
            alt={a.name || 'attachment'}
            className={cn('max-h-40 rounded-md border', onBrand ? 'border-white/30' : 'border-border')}
          />
        </a>
      ))}
    </div>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isAssistant = message.role === 'assistant';
  const { agencyId } = useGhl();
  const [helpOpen, setHelpOpen] = useState(false);

  const isTeamMember =
    isAssistant &&
    Array.isArray(message.actions) &&
    message.actions.some((a) => a?.tool === 'admin_reply');

  const { text, widgets } = isAssistant ? parseAssistant(message.content) : { text: message.content, widgets: [] };

  if (!isAssistant) {
    return (
      <UserBubble>
        <Attachments message={message} onBrand />
        {renderMessageContent(message.content)}
      </UserBubble>
    );
  }

  return (
    <>
      <AssistantMessage
        name={isTeamMember ? 'Team member' : 'Copilot'}
        tone={isTeamMember ? 'team' : 'brand'}
        after={
          <>
            {widgets.length > 0 && (
              <div className="space-y-3">
                {widgets.map((w, i) => w.kind === 'screenshot' ? <GuideScreenshot key={i} k={w.key} /> : w.kind === 'widget' && w.name === 'human_help' ? <Button key={i} size="sm" variant="outline" onClick={() => setHelpOpen(true)}><Headset className="h-4 w-4" />Text us for human help</Button> : w.kind === 'widget' && w.name === 'menu_removal_setup' ? <MenuRemovalSetupCard key={i} agencyId={agencyId} onHelp={() => setHelpOpen(true)} onConnect={() => { window.location.href = '/app/copilot'; }} onUpgrade={() => { window.location.href = '/app/copilot'; }} /> : w.kind === 'widget' ? <Button key={i} size="sm" variant="outline" onClick={() => { window.location.href = '/app/copilot'; }}>Continue in full-screen Copilot</Button> : null)}
              </div>
            )}
            {/* Action confirmations */}
            {!isTeamMember && message.actions && message.actions.length > 0 && (
              <div className="space-y-2">
                {message.actions.map((action, index) => (
                  <ActionConfirmation key={index} message={action.message} />
                ))}
              </div>
            )}
          </>
        }
      >
        {(text || (message.attachments && message.attachments.length > 0)) ? (
          <>
            <Attachments message={message} />
            <div className={COPILOT_PROSE}>
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  code: ({ children }) => (
                    <code className="rounded-sm bg-muted px-1 py-0.5 text-xs">{children}</code>
                  ),
                }}
              >
                {text}
              </ReactMarkdown>
            </div>
          </>
        ) : null}
      </AssistantMessage>
      <TextUsDialog open={helpOpen} onOpenChange={setHelpOpen} title="Need a hand?" description="Text our team for human support." message={`I need human support with SaaSSuite. Agency: ${agencyId || "loading"}.`} />
    </>
  );
}
