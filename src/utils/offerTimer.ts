/**
 * Centralized timer utility for trial offers
 * Provides consistent calculation of offer periods and expiration times
 */

export interface OfferPeriod {
  type: 'six-months-free' | 'spin-to-win';
  startDay: number;
  endDay: number;
  expiresAt: Date;
}

/**
 * Calculate which offer period the user is in based on trial days remaining
 */
export const getCurrentOfferPeriod = (trialDaysRemaining: number | null): OfferPeriod | null => {
  if (trialDaysRemaining === null) return null;
  
  const trialDay = 7 - trialDaysRemaining + 1; // Convert to day 1-7
  
  // Days 4-5: Show upgrade banner (48 hours)
  if (trialDay >= 4 && trialDay <= 5) {
    return {
      type: 'six-months-free',
      startDay: 4,
      endDay: 5,
      expiresAt: calculateOfferExpiration(5, trialDay)
    };
  }
  // Days 6-7: Show spinner promo
  else if (trialDay >= 6 && trialDay <= 7) {
    return {
      type: 'spin-to-win',
      startDay: 6,
      endDay: 7,
      expiresAt: calculateOfferExpiration(7, trialDay)
    };
  }
  
  return null;
};

/**
 * Calculate when an offer expires based on the end day and current trial day
 */
export const calculateOfferExpiration = (endDay: number, currentTrialDay: number): Date => {
  const now = new Date();
  const daysUntilExpiration = endDay - currentTrialDay + 1;
  
  // Set to end of the expiration day (23:59:59)
  const expiresAt = new Date(now);
  expiresAt.setDate(now.getDate() + daysUntilExpiration - 1);
  expiresAt.setHours(23, 59, 59, 999);
  
  return expiresAt;
};

/**
 * Format time remaining as "Xd:Xh:Xm"
 */
export const formatTimeRemaining = (expiresAt: Date): string => {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();
  
  if (diff <= 0) {
    return 'Expired';
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${days}d:${hours}h:${minutes}m`;
};

/**
 * Check if an offer has expired
 */
export const isOfferExpired = (expiresAt: Date): boolean => {
  return new Date().getTime() >= expiresAt.getTime();
};