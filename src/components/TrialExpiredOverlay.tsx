import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Tag } from '@/components/ui/tag';
import { LifeBuoy, Lock, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { popIn } from '@/lib/motion';
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
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="access-suspended-title"
      aria-describedby="access-suspended-body"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/70 p-4 backdrop-blur-md"
    >
      <motion.div
        variants={popIn}
        initial="hidden"
        animate="show"
        className="w-full max-w-md rounded-xl border border-border/60 bg-card p-6 text-center shadow-dialog sm:p-8"
      >
        <div className="mb-4 flex justify-center">
          <Tag tone="danger">
            <Lock aria-hidden="true" />
            Access suspended
          </Tag>
        </div>
        <h2 id="access-suspended-title" className="text-h3 text-balance text-foreground">
          Your account is on hold
        </h2>
        <p id="access-suspended-body" className="mt-2 text-small text-pretty text-muted-foreground">
          Our team suspended this account. Your workspace and settings are safe. Write to support and we'll get it
          sorted, including any payment issue or if you think this is a mistake.
        </p>
        <div className="mt-6 space-y-3">
          <Button onClick={handleContactSupport} variant="accent" className="h-11 w-full">
            <LifeBuoy aria-hidden="true" />
            Contact support
          </Button>
          <Button onClick={handleSignOut} variant="outline" className="h-11 w-full">
            <LogOut aria-hidden="true" />
            Sign out
          </Button>
        </div>
        <p className="mt-4 text-caption font-normal text-muted-foreground">support@saassuite.ai</p>
      </motion.div>
    </div>
  );
};

export default TrialExpiredOverlay;
