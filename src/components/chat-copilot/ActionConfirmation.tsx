import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionConfirmationProps {
  message: string;
  className?: string;
}

export function ActionConfirmation({ message, className }: ActionConfirmationProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/20 rounded-lg animate-fade-in',
        className
      )}
    >
      <div className="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center animate-scale-in">
        <Check className="w-3 h-3 text-white" />
      </div>
      <span className="text-sm text-green-700 dark:text-green-400">{message}</span>
    </div>
  );
}
