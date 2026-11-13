import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadNotice({
  loading = false,
  error = null,
  onRetry,
  label = "Loading…",
}: {
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  label?: string;
}) {
  if (error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card px-4 py-6">
        <p className="text-sm text-foreground">{error}</p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }
  if (!loading) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      {label}
    </div>
  );
}
