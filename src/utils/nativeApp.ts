import { Capacitor } from '@capacitor/core';

/** True only inside the packaged iOS / Android app (never in a mobile browser). */
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const nativePlatform = (): 'ios' | 'android' | 'web' => {
  try {
    const p = Capacitor.getPlatform();
    return p === 'ios' || p === 'android' ? p : 'web';
  } catch {
    return 'web';
  }
};

/**
 * Apple and Google both forbid pointing users at outside payment flows for
 * digital subscriptions, so card checkout must never render inside the app.
 */
export const shouldUseStoreBilling = (): boolean => isNativeApp();
