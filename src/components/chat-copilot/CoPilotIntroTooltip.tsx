import { useState, useEffect } from 'react';
import { X, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CoPilotIntroTooltipProps {
  show: boolean;
  onDismiss: () => void;
  /** 'intro' = first tooltip explaining CoPilot, 'exit' = tooltip showing how to exit to classic mode */
  variant: 'intro' | 'exit';
  /** For 'exit' variant, the target element ref to position near */
  targetRef?: React.RefObject<HTMLElement>;
}

export function CoPilotIntroTooltip({ show, onDismiss, variant, targetRef }: CoPilotIntroTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setIsVisible(true), 300);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show]);

  if (!show) return null;

  if (variant === 'intro') {
    return (
      <div className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}>
        <div className={cn(
          "bg-card border border-border rounded-2xl shadow-2xl max-w-md mx-4 p-6 transform transition-all duration-500",
          isVisible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        )}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  Meet Your AI CoPilot
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                </h3>
                <p className="text-xs text-muted-foreground">Your personal setup assistant</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDismiss} aria-label="Close">
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            The AI CoPilot can help you configure your entire platform through simple conversation — 
            set up branding, toggle features, configure your client hub, and more. Just type what you want to do!
          </p>
          
          <p className="text-sm text-foreground font-medium mb-4">
            Try sending the pre-loaded message below to get started, or ask anything you'd like to set up.
          </p>

          <Button onClick={onDismiss} className="w-full">
            Got it, let's go!
          </Button>
        </div>
      </div>
    );
  }

  // 'exit' variant - smaller tooltip pointing at the Classic Mode button
  return (
    <div className={cn(
      "fixed z-50 transition-all duration-300",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    )} style={{ top: 60, right: 220 }}>
      <div className="bg-card border border-border rounded-xl shadow-xl max-w-xs p-4 relative">
        {/* Arrow pointing up-right */}
        <div className="absolute -top-2 right-8 w-4 h-4 bg-card border-l border-t border-border transform rotate-45" />
        
        <p className="text-sm text-foreground font-medium mb-2">
          You can switch to Classic Mode anytime to make changes yourself!
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Click the "Classic Mode" button above to access all tools and settings directly.
        </p>
        <Button size="sm" variant="outline" onClick={onDismiss} className="w-full">
          Got it!
        </Button>
      </div>
    </div>
  );
}
