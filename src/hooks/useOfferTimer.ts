import { useState, useEffect } from 'react';
import { formatTimeRemaining, isOfferExpired } from '@/utils/offerTimer';

/**
 * Custom hook for real-time countdown timer
 * Updates every second and provides formatted time remaining
 */
export const useOfferTimer = (expiresAt: Date | null) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft('');
      setExpired(false);
      return;
    }

    const updateTimer = () => {
      const timeRemaining = formatTimeRemaining(expiresAt);
      const isExpired = isOfferExpired(expiresAt);
      
      setTimeLeft(timeRemaining);
      setExpired(isExpired);
    };

    // Update immediately
    updateTimer();
    
    // Update every second for real-time accuracy
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return { timeLeft, expired };
};