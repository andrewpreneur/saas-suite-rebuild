import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/utils/nativeApp';
import { beginNativeOAuthRun } from '@/lib/nativeOAuthState';

/** Custom scheme the phone apps catch so sign-in can return from the in-app browser. */
export const NATIVE_AUTH_SCHEME = 'ai.saassuite.app://auth';

/**
 * Plain HTML page that opens the app. Must stay HTTPS for both iPhone and Android.
 * A direct custom-scheme redirectTo makes Safari/Chrome keep the login on the website.
 */
const NATIVE_CALLBACK = 'https://saassuite.ai/auth-native-return.html';

/**
 * Address the in-app browser should open so the phone app receives the sign-in result.
 * Chrome Custom Tabs drop a plain custom-scheme redirect, so Android uses an intent link.
 */
export const nativeAppReturnUrl = (search: string, hash: string, android: boolean): string => {
  const params = new URLSearchParams(search);
  if (hash.startsWith('#') && hash.length > 1) {
    new URLSearchParams(hash.slice(1)).forEach((value, key) => {
      if (!params.has(key)) params.append(key, value);
    });
  }
  // Prefer the short login code so the app link is not too long for iOS.
  const compact = new URLSearchParams();
  const code = params.get('code');
  if (code) {
    compact.set('code', code);
  } else {
    for (const key of ['access_token', 'refresh_token', 'expires_in', 'token_type', 'provider_token']) {
      const value = params.get(key);
      if (value) compact.set(key, value);
    }
  }
  for (const key of ['next', 'attribution_token', 'error', 'error_description', 'state', 'ss_run']) {
    const value = params.get(key);
    if (value) compact.set(key, value);
  }
  const query = compact.toString();
  if (!query) {
    return android
      ? 'intent://auth#Intent;scheme=ai.saassuite.app;package=ai.saassuite.app;end'
      : NATIVE_AUTH_SCHEME;
  }
  if (android) {
    return `intent://auth#Intent;scheme=ai.saassuite.app;package=ai.saassuite.app;S.ss_oauth=${encodeURIComponent(query)};end`;
  }
  return `${NATIVE_AUTH_SCHEME}?${query}`;
};

let nativeAuthReturned = false;

/** True once the app has received the sign-in result from the in-app browser. */
export const markNativeAuthReturn = () => {
  nativeAuthReturned = true;
};

/**
 * Opens Google or Apple sign-in.
 *
 * On the website this is a normal redirect. Inside the iOS and Android apps
 * it opens the in-app browser (Chrome Custom Tabs on Android, Safari view on
 * iPhone) so the person can cancel and their saved Google accounts appear.
 * The browser then hands the result back to the app.
 */
export const signInWithStoreProvider = async (
  provider: 'google' | 'apple',
  nextPath: string,
  onBrowserClosed?: () => void,
): Promise<string | null> => {
  if (!isNativeApp()) {
    let redirectTo = new URL(nextPath, window.location.origin).toString();
    try {
      const { buildAttributedOAuthRedirect } = await import('@/utils/fbAttribution');
      redirectTo = await buildAttributedOAuthRedirect(nextPath);
    } catch (attributionError) {
      console.error('Unable to stage sign-in attribution:', attributionError);
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
    return error?.message ?? null;
  }

  let token = '';
  try {
    const { buildAttributedOAuthRedirect } = await import('@/utils/fbAttribution');
    const attributed = await buildAttributedOAuthRedirect(nextPath);
    token = new URL(attributed).searchParams.get('attribution_token') || '';
  } catch (attributionError) {
    console.error('Unable to stage sign-in attribution:', attributionError);
  }

  // New run id so a leftover return from the previous login is ignored.
  nativeAuthReturned = false;
  const run = beginNativeOAuthRun();
  const redirectTo = new URL(NATIVE_CALLBACK);
  redirectTo.searchParams.set('next', nextPath.startsWith('/') ? nextPath : '/app');
  redirectTo.searchParams.set('ss_run', run);
  if (token) redirectTo.searchParams.set('attribution_token', token);

  const { Browser } = await import('@capacitor/browser');
  // A previous Safari/Chrome sheet left open blocks the next return into the app.
  try {
    await Browser.close();
  } catch { /* none open */ }
  await new Promise((resolve) => window.setTimeout(resolve, 250));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: redirectTo.toString(), skipBrowserRedirect: true },
  });
  if (error) return error.message;
  if (!data?.url) return 'Could not start sign-in.';

  const finished = await Browser.addListener('browserFinished', () => {
    void finished.remove();
    onBrowserClosed?.();
    window.setTimeout(() => {
      if (nativeAuthReturned) return;
      window.dispatchEvent(new CustomEvent('ss-oauth-error', {
        detail: 'Sign-in did not finish. Try again.',
      }));
    }, 2500);
  });
  await Browser.open({ url: data.url, presentationStyle: 'fullscreen' });
  return null;
};
