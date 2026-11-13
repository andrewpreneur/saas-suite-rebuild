import { useEffect } from 'react';
import { nativeAppReturnUrl } from '@/lib/nativeOAuth';
import { shouldAutoOpenNativeApp, webAuthContinueUrl } from '@/lib/nativeAuthReturn';

/**
 * Backup route if someone lands on /auth/native. The live Google/Apple return
 * uses the static auth-native-return.html page so the React app never boots
 * inside Chrome.
 * Desktop browsers stay on https. Only a phone should open the app scheme.
 */

const returnTarget = () => {
  if (typeof window === 'undefined') return '';
  if (!shouldAutoOpenNativeApp(navigator.userAgent)) {
    return webAuthContinueUrl(window.location.search, window.location.hash, window.location.origin);
  }
  return nativeAppReturnUrl(window.location.search, window.location.hash, /Android/i.test(navigator.userAgent));
};

const NativeAuthCallback = () => {
  useEffect(() => {
    const target = returnTarget();
    if (target) window.location.replace(target);
  }, []);

  const target = returnTarget();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-medium">Returning to SaaS Suite…</p>
      <a className="text-sm underline" href={target}>
        Open the app
      </a>
    </div>
  );
};

export default NativeAuthCallback;
