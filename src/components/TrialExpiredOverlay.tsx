import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Lock, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TrialExpiredOverlay = () => {
  const { approval } = useUser();
  const navigate = useNavigate();

  // Only shown for accounts we manually blocked (approval = "NO").
  // Billing problems (failed payment / canceled subscription) never land here —
  // those accounts stay logged in and see the red PastDueBanner instead.
  if (approval !== "NO") {
    return null;
  }


  const handleContactSupport = () => {
    window.open('mailto:support@saassuite.ai', '_blank');
  };

  const handleSignOut = async () => {
    try {
      await (await import("@/lib/hardSignOut")).hardSignOut();
      navigate('/');
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Error signing out');
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Lock className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">
            Access Suspended
          </CardTitle>
          <CardDescription>
            Your account has been suspended by our team. Reach out and we'll get it sorted.
          </CardDescription>

        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleContactSupport}
            className="w-full flex items-center gap-2"
            size="lg"
          >
            <Crown className="h-4 w-4" />
            Contact Support
          </Button>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="w-full flex items-center gap-2"
            size="lg"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Please contact our support team if you believe this is an error or to resolve any payment issues.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TrialExpiredOverlay;
