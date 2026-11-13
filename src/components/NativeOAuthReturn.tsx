import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { isNativeApp } from '@/utils/nativeApp';
import { NATIVE_AUTH_SCHEME, markNativeAuthReturn } from '@/lib/nativeOAuth';
import {
  OAUTH_HANDLED_KEY,
  OAUTH_LAUNCH_CONSUMED_KEY,
  currentNativeOAuthRun,
} from '@/lib/nativeOAuthState';

const hasAuthPayload = (params: URLSearchParams) =>
  !!(params.get('code') || params.get('access_token') || params.get('error') || params.get('error_description'));

const payloadId = (params: URLSearchParams) =>
  params.get('code')
  || params.get('access_token')?.slice(0, 48)
  || params.get('error_description')
  || params.get('error')
  || '';

const wasHandled = (id: string) => {
  if (!id) return false;
  try {
    const list = JSON.parse(sessionStorage.getItem(OAUTH_HANDLED_KEY) || '[]') as string[];
    return Array.isArray(list) && list.includes(id);
  } catch {
    return false;
  }
};

const markHandled = (id: string) => {
  if (!id) return;
  try {
    const list = JSON.parse(sessionStorage.getItem(OAUTH_HANDLED_KEY) || '[]') as string[];
    const next = Array.isArray(list) ? list.filter((item) => item !== id) : [];
    next.push(id);
    sessionStorage.setItem(OAUTH_HANDLED_KEY, JSON.stringify(next.slice(-12)));
  } catch {
    /* ignore */
  }
};

/** Completes a Google / Apple sign-in that the in-app browser handed back. */
const NativeOAuthReturn = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    let pendingBareReturn: number | undefined;
    let busy = false;

    const finish = async (url: string, fromLaunchUrl = false) => {
      if (!url.startsWith(NATIVE_AUTH_SCHEME) && !url.startsWith('ai.saassuite.app:/auth')) return;
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        return;
      }

      if (parsed.hash.length > 1) {
        new URLSearchParams(parsed.hash.slice(1)).forEach((value, key) => {
          if (!parsed.searchParams.has(key)) parsed.searchParams.append(key, value);
        });
      }

      // Capacitor keeps getLaunchUrl() forever. After the first success, ignore it
      // so a later login is not fed the old return link.
      if (fromLaunchUrl) {
        try {
          if (sessionStorage.getItem(OAUTH_LAUNCH_CONSUMED_KEY) === '1') return;
        } catch { /* ignore */ }
      }

      if (!hasAuthPayload(parsed.searchParams)) {
        if (pendingBareReturn) window.clearTimeout(pendingBareReturn);
        pendingBareReturn = window.setTimeout(() => {
          if (cancelled) return;
          const message = 'Sign-in did not include a login code. Try again.';
          toast.error(message);
          window.dispatchEvent(new CustomEvent('ss-oauth-error', { detail: message }));
        }, 3500);
        return;
      }

      const expectedRun = currentNativeOAuthRun();
      const gotRun = parsed.searchParams.get('ss_run') || '';
      // Drop leftover returns from a previous login in this same app session.
      if (expectedRun && gotRun && gotRun !== expectedRun) return;
      if (expectedRun && !gotRun && fromLaunchUrl) return;

      const id = payloadId(parsed.searchParams);
      if (!id || wasHandled(id) || busy) return;
      busy = true;
      markHandled(id);

      if (pendingBareReturn) {
        window.clearTimeout(pendingBareReturn);
        pendingBareReturn = undefined;
      }
      markNativeAuthReturn();
      try {
        sessionStorage.setItem(OAUTH_LAUNCH_CONSUMED_KEY, '1');
      } catch { /* ignore */ }

      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
      } catch { /* already closed */ }
      window.setTimeout(async () => {
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close();
        } catch { /* ignore */ }
      }, 300);

      const description = parsed.searchParams.get('error_description') || parsed.searchParams.get('error');
      if (description) {
        busy = false;
        const message = description.replace(/\+/g, ' ');
        toast.error(message);
        window.dispatchEvent(new CustomEvent('ss-oauth-error', { detail: message }));
        return;
      }

      const code = parsed.searchParams.get('code');
      const accessToken = parsed.searchParams.get('access_token');
      const refreshToken = parsed.searchParams.get('refresh_token');

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          throw new Error('Sign-in did not include a login code. Try again.');
        }
      } catch (error) {
        busy = false;
        const message = error instanceof Error ? error.message : 'Sign-in failed. Try again.';
        toast.error(message);
        window.dispatchEvent(new CustomEvent('ss-oauth-error', { detail: message }));
        return;
      }

      const next = parsed.searchParams.get('next') || '/app';
      const dest = new URL(next, 'https://saassuite.ai');
      const token = parsed.searchParams.get('attribution_token');
      if (token) dest.searchParams.set('attribution_token', token);
      navigate(`${dest.pathname}${dest.search}`, { replace: true });
      busy = false;
    };

    (async () => {
      const { App } = await import('@capacitor/app');
      if (cancelled) return;
      const onCustom = (event: Event) => {
        const detail = (event as CustomEvent<string>).detail;
        if (detail) void finish(detail, false);
      };
      window.addEventListener('ss-native-auth', onCustom);
      const sub = await App.addListener('appUrlOpen', (event) => {
        void finish(event.url, false);
      });
      remove = () => {
        window.removeEventListener('ss-native-auth', onCustom);
        void sub.remove();
      };
      const launch = await App.getLaunchUrl();
      if (!cancelled && launch?.url) void finish(launch.url, true);
    })().catch((error) => console.error('[NativeOAuth] listener failed:', error));

    return () => {
      cancelled = true;
      if (pendingBareReturn) window.clearTimeout(pendingBareReturn);
      remove?.();
    };
  }, [navigate]);

  return null;
};

export default NativeOAuthReturn;
