import { useState, useEffect } from 'react';
import { getRandomSuggestions } from '@/constants/copilotSuggestions';
import { RefreshCw } from 'lucide-react';
import { PromptChips } from '@/components/premium/copilot/CopilotBits';

interface ChatSuggestionsProps {
  onSuggestionClick: (suggestion: string) => void;
  disabled?: boolean;
}

export function ChatSuggestions({ onSuggestionClick, disabled }: ChatSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    setSuggestions(getRandomSuggestions(4));
  }, []);

  const refreshSuggestions = () => {
    setSuggestions(getRandomSuggestions(4));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="px-eyebrow">Try asking</span>
        <button
          type="button"
          onClick={refreshSuggestions}
          disabled={disabled}
          aria-label="Show other suggestions"
          title="Show other suggestions"
          className="inline-grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" />
        </button>
      </div>
      <PromptChips
        key={suggestions.join('|')}
        align="start"
        scroll
        prompts={suggestions.map((label) => ({ label }))}
        onPick={onSuggestionClick}
        disabled={disabled}
      />
    </div>
  );
}
