import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/contexts/UserContext';


export const ImpersonationBanner = () => {
  const { isImpersonating, effectiveEmail } = useUser();

  const handleStopImpersonating = () => {
    sessionStorage.removeItem('selectedAccountEmail');
    sessionStorage.removeItem('isImpersonating');
    sessionStorage.removeItem('impersonatedBy');
    
    toast.success('Returned to admin account');
    window.location.reload();
  };

  if (!isImpersonating) {
    return null;
  }

  return (
    <div className="fixed top-2 right-3 z-[60] flex items-center gap-1.5 rounded-full border border-border/60 bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
      <span className="truncate max-w-[220px]">
        Logged in as <span className="font-medium text-foreground">{effectiveEmail}</span>
      </span>
      <button
        type="button"
        onClick={handleStopImpersonating}
        aria-label="Exit admin view"
        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

