import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Inbox, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PendingSuggestion {
  id: string;
  message: string;
  target_field: string | null;
  operation: string;
  source: string | null;
  created_at: string;
}

const TARGET_LABELS: Record<string, string> = {
  prompt_personality: 'AI Personality',
  prompt_goals: 'AI Goals',
  prompt_additional_instructions: 'AI Instructions',
  prompt_training_doc: 'AI Training Doc',
  general: 'General',
};

interface Props {
  onApply: (prompt: string) => void;
}

export function PendingSuggestions({ onApply }: Props) {
  const { email } = useUser();
  const [suggestions, setSuggestions] = useState<PendingSuggestion[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!email) return;
    const { data, error } = await supabase
      .from('copilot_pending_suggestions')
      .select('id, message, target_field, operation, source, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (!error && data) setSuggestions(data as PendingSuggestion[]);
  }, [email]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const dismiss = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase
      .from('copilot_pending_suggestions')
      .update({ status: 'dismissed' })
      .eq('id', id);
    setBusyId(null);
    if (error) {
      toast.error('Failed to dismiss');
      return;
    }
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const apply = async (s: PendingSuggestion) => {
    setBusyId(s.id);
    const targetLabel = s.target_field ? TARGET_LABELS[s.target_field] || s.target_field : null;
    let prompt = '';
    if (targetLabel && s.target_field !== 'general') {
      const verb = s.operation === 'replace' ? 'Replace' : 'Add to';
      prompt = `${verb} my ${targetLabel}: ${s.message}`;
    } else {
      prompt = s.message;
    }

    const { error } = await supabase
      .from('copilot_pending_suggestions')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', s.id);

    setBusyId(null);
    if (error) {
      toast.error('Failed to mark applied');
      return;
    }
    setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
    onApply(prompt);
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto border-b border-border bg-muted/40 p-3">
      <div className="px-eyebrow flex items-center gap-2">
        <Inbox className="size-3.5" />
        {suggestions.length} pending suggestion{suggestions.length === 1 ? '' : 's'}
      </div>
      {suggestions.map((s) => (
        <div key={s.id} className="px-surface space-y-2 border border-border/60 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {s.target_field && (
              <Badge variant="secondary" className="text-[10px]">
                {TARGET_LABELS[s.target_field] || s.target_field}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">{s.operation}</Badge>
            {s.source && (
              <span className="text-caption text-muted-foreground">via {s.source}</span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{s.message}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="accent"
              disabled={busyId === s.id}
              onClick={() => apply(s)}
            >
              {busyId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Apply suggestion
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busyId === s.id}
              onClick={() => dismiss(s.id)}
            >
              <X className="size-3.5" />
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
