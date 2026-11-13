import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import UpgradeDialog from './UpgradeDialog';

interface SpinningWheelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isUrgent?: boolean;
}

interface SpinResult {
  discount: number;
  code: string;
  color: string;
}

const discounts: SpinResult[] = [
  { discount: 5, code: 'SUPAFLY5', color: '#FF6B8A' },
  { discount: 5, code: 'LUCKY5', color: '#4ECDC4' },
  { discount: 10, code: 'ZEN10', color: '#45B7D1' },
  { discount: 10, code: 'SAVE10', color: '#96CEB4' },
  { discount: 15, code: 'DREAM15', color: '#FECA57' },
  { discount: 20, code: 'ROARIN20', color: '#FF9FF3' }
];

export const SpinningWheel = ({ open, onOpenChange, isUrgent = false }: SpinningWheelProps) => {
  const { email } = useUser();
  const { toast } = useToast();
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [spinsUsed, setSpinsUsed] = useState(0);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);

  // Load spin count from localStorage
  useEffect(() => {
    if (email) {
      const saved = localStorage.getItem(`spin-count-${email}`);
      setSpinsUsed(saved ? parseInt(saved) : 0);
    }
  }, [email]);

  const saveSpinCount = (count: number) => {
    if (email) {
      localStorage.setItem(`spin-count-${email}`, count.toString());
      setSpinsUsed(count);
    }
  };

  const spinWheel = () => {
    if (spinsUsed >= 3) return;

    setIsSpinning(true);
    
    // Random result
    const randomResult = discounts[Math.floor(Math.random() * discounts.length)];
    
    // Calculate rotation (multiple full spins + final position)
    const baseRotation = 2520; // 7 full spins for slower, smoother animation
    const segmentSize = 360 / discounts.length;
    const resultIndex = discounts.findIndex(d => d.code === randomResult.code);
    const finalRotation = wheelRotation + baseRotation + (resultIndex * segmentSize);
    
    setWheelRotation(finalRotation);

    // Show result after spin animation (longer for slower spin)
    setTimeout(() => {
      setResult(randomResult);
      setIsSpinning(false);
      saveSpinCount(spinsUsed + 1);
    }, 8000);
  };

  const claimDiscount = () => {
    if (result) {
      toast({
        title: "Discount Claimed!",
        description: `Your ${result.discount}% discount code: ${result.code}`,
      });
    }
  };

  const copyCode = () => {
    if (result) {
      navigator.clipboard.writeText(result.code);
      toast({
        title: "Code Copied!",
        description: `${result.code} copied to clipboard`,
      });
    }
  };

  const spinAgain = () => {
    if (spinsUsed < 3) {
      setResult(null);
    }
  };

  const upgradeWithCoupon = () => {
    setShowUpgrade(true);
  };

  const canSpin = spinsUsed < 3 && !result;
  const hasSpinsLeft = spinsUsed < 3;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-center">
              {isUrgent ? 'Last Chance Spin!' : 'Spin to Win!'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Wheel */}
            <div className="flex justify-center">
              <div className="relative">
                <div 
                  className="w-80 h-80 rounded-full border-8 border-yellow-400 relative overflow-hidden transition-transform duration-[8000ms] ease-in-out shadow-2xl"
                  style={{ 
                    transform: `rotate(${wheelRotation}deg)`,
                    boxShadow: '0 0 50px rgba(255, 215, 0, 0.5)'
                  }}
                >
                  {discounts.map((discount, index) => {
                    const angle = (360 / discounts.length) * index;
                    const nextAngle = (360 / discounts.length) * (index + 1);
                    return (
                      <div
                        key={discount.code}
                        className="absolute w-full h-full flex items-center justify-center text-white font-bold shadow-inner"
                        style={{
                          background: `linear-gradient(135deg, ${discount.color}, ${discount.color}dd)`,
                          clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((angle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((angle - 90) * Math.PI / 180)}%, ${50 + 50 * Math.cos((nextAngle - 90) * Math.PI / 180)}% ${50 + 50 * Math.sin((nextAngle - 90) * Math.PI / 180)}%)`
                        }}
                      >
                        <div 
                          className="text-xl font-black text-white drop-shadow-lg transform"
                          style={{ 
                            transform: `rotate(${angle + (360 / discounts.length) / 2}deg) translateY(-80px) rotate(${-(angle + (360 / discounts.length) / 2)}deg)`,
                            textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                          }}
                        >
                          {discount.discount}%
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Pointer */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-3 z-10">
                  <div className="w-0 h-0 border-l-6 border-r-6 border-b-12 border-l-transparent border-r-transparent border-b-yellow-600 drop-shadow-lg"></div>
                </div>
                
                {/* Center circle */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-yellow-400 rounded-full border-4 border-yellow-600 flex items-center justify-center shadow-lg z-10">
                  <div className="text-yellow-800 font-bold text-xs">SPIN</div>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Spins used: {spinsUsed}/3
              </p>
              {isUrgent && (
                <p className="text-orange-600 font-medium text-sm">
                  Last chance to apply your discount and save your progress!
                </p>
              )}
            </div>

            {/* Result Display */}
            {result && (
              <div className="bg-gradient-to-r from-primary/10 to-primary-glow/10 rounded-lg p-4 text-center space-y-3">
                <h3 className="text-xl font-bold text-primary">
                  You won {result.discount}% off! 🎉
                </h3>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-lg bg-gray-100 px-3 py-1 rounded">
                    {result.code}
                  </span>
                  <Button size="sm" variant="outline" onClick={copyCode}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {!result ? (
                <Button 
                  onClick={spinWheel}
                  disabled={!canSpin || isSpinning}
                  className="w-full"
                  size="lg"
                >
                  {isSpinning ? (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                      Spinning...
                    </>
                  ) : (
                    `Spin the Wheel ${hasSpinsLeft ? `(${3 - spinsUsed} left)` : ''}`
                  )}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button 
                      onClick={claimDiscount}
                      className="flex-1"
                      variant="default"
                    >
                      Claim Discount
                    </Button>
                    {hasSpinsLeft && (
                      <Button 
                        onClick={spinAgain}
                        variant="outline"
                        className="flex-1"
                      >
                        Spin Again
                      </Button>
                    )}
                  </div>
                  <Button 
                    onClick={upgradeWithCoupon}
                    className="w-full bg-gradient-to-r from-primary to-primary-glow text-white"
                    size="lg"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Upgrade With Coupon
                  </Button>
                </div>
              )}
              
              {!hasSpinsLeft && !result && (
                <p className="text-center text-sm text-muted-foreground">
                  You've used all your spins! Check your previous discount.
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeDialog 
        open={showUpgrade} 
        onOpenChange={setShowUpgrade}
        isTrialMode={true}
      />
    </>
  );
};