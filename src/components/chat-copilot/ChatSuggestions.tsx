import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { getRandomSuggestions } from '@/constants/copilotSuggestions';
import { RefreshCw } from 'lucide-react';

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
        <span className="text-xs text-muted-foreground">Suggestions</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshSuggestions}
          disabled={disabled}
          className="h-6 w-6 p-0"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSuggestionClick(suggestion)}
            disabled={disabled}
            className="text-xs h-auto py-1.5 px-3 whitespace-normal text-left"
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
