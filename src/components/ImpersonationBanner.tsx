import { LogOut, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChromeStrip } from '@/components/premium/entry/chrome';
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
    <ChromeStrip
      tone="brand"
      icon={UserCog}
      title="Admin view."
      actions={
        <Button type="button" size="sm" variant="outline" onClick={handleStopImpersonating} aria-label="Exit admin view">
          <LogOut aria-hidden="true" />
          Exit
        </Button>
      }
    >
      You're viewing the app as <span className="break-all font-medium">{effectiveEmail}</span>.
    </ChromeStrip>
  );
};
