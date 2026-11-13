
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { attachKitPurchases } from '@/lib/kitPurchases';
import type { User, Session } from '@supabase/supabase-js';
import { resolveEffectiveEmail } from '@/lib/effectiveEmail';
import { isPlatformAdminEmail, PLATFORM_ADMIN_EMAILS } from '@/lib/platformAdmins';

function loginRecordedKey(email: string) {
  return `loginRecorded:${email.toLowerCase()}`;
}

/** Count a sign-in once per browser tab. A failed call clears the flag so the next attempt can retry. */
function recordLoginOnce(email: string) {
  try {
    const key = loginRecordedKey(email);
    if (sessionStorage.getItem(key) === "1") return;
    sessionStorage.setItem(key, "1");
    void supabase.rpc("record_user_login", { user_email: email }).then(({ error }) => {
      if (error) {
        sessionStorage.removeItem(key);
        console.error("Error recording login:", error);
      }
    });
  } catch (error) {
    console.error("Error recording login:", error);
  }
}

function metadataAdminName(meta: { role?: unknown; admin_name?: unknown } | null | undefined): { role: string; name: string } {
  const role = typeof meta?.role === 'string' ? meta.role : '';
  const name = typeof meta?.admin_name === 'string' ? meta.admin_name.trim() : '';
  return { role, name };
}

/** Accepted admin display name. Prefer the row for the account they are acting on. */
async function loadAcceptedAdminName(adminEmail: string, ownerEmail: string | null): Promise<string | null> {
  const { data, error } = await supabase
    .from('account_admins')
    .select('admin_name, owner_email')
    .ilike('admin_email', adminEmail)
    .eq('status', 'accepted');
  if (error || !data?.length) return null;
  const owner = ownerEmail?.trim().toLowerCase() || null;
  const named = data.filter((row) => (row.admin_name || '').trim());
  const match = owner
    ? named.find((row) => (row.owner_email || '').toLowerCase() === owner)
    : null;
  return (match || named[0])?.admin_name?.trim() || null;
}

function clearLoginRecordedFlags() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("loginRecorded:")) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    /* sessionStorage can be unavailable */
  }
}

interface UserContextType {
  email: string | null;
  userId: string | null;
  approval: string | null;
  plan: string | null;
  isApproved: boolean;
  user: User | null;
  session: Session | null;
  setUser: (email: string, userId: string, approval?: string) => void;
  clearUser: () => void;
  isLoading: boolean;
  initialQuestionsCompleted: boolean | null;
  emailWarmupAccess: boolean;
  freeLeadsAccess: boolean;
  brandingToolAccess: boolean;
  isAffiliate: boolean;
  snapshotAccess: boolean;
  hideBonuses: boolean;
  setHideBonuses: (value: boolean) => void;
  // Impersonation support
  isImpersonating: boolean;
  effectiveEmail: string | null;
  actualEmail: string | null;
  /** account_admins.admin_name for the signed-in person, when they are an accepted admin. */
  signedInAdminName: string | null;
  // For confirmation polling
  refetchUserData: () => Promise<void>;
}

// Keep one context instance across hot reloads so an already-mounted provider
// and freshly reloaded consumers always share the same context object.
const UserContext: React.Context<UserContextType | undefined> =
  ((globalThis as any).__ssUserContext ??= createContext<UserContextType | undefined>(undefined));

const USER_STORAGE_KEY = 'saas_suite_user';

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [actualEmail, setActualEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [approval, setApproval] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initialQuestionsCompleted, setInitialQuestionsCompleted] = useState<boolean | null>(null);
  const [emailWarmupAccess, setEmailWarmupAccess] = useState(false);
  const [freeLeadsAccess, setFreeLeadsAccess] = useState(false);
  const [brandingToolAccess, setBrandingToolAccess] = useState(false);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [snapshotAccess, setSnapshotAccess] = useState(false);
  const [hideBonuses, setHideBonusesState] = useState(false);
  const [signedInAdminName, setSignedInAdminName] = useState<string | null>(null);
  const adminNameLoadRef = React.useRef(0);

  const getSessionEmail = (authSession: Session | null) => {
    const identityEmail = authSession?.user?.identities
      ?.map((identity) => identity.identity_data?.email)
      .find(Boolean);

    return (
      authSession?.user?.email ||
      authSession?.user?.user_metadata?.email ||
      identityEmail ||
      null
    )?.trim().toLowerCase() || null;
  };

  const resetUserState = () => {
    adminNameLoadRef.current += 1;
    setSignedInAdminName(null);
    setActualEmail(null);
    setUserId(null);
    setApproval(null);
    setPlan(null);
    setInitialQuestionsCompleted(null);
    setEmailWarmupAccess(false);
    setFreeLeadsAccess(false);
    setBrandingToolAccess(false);
    setHideBonusesState(false);
    setIsAffiliate(false);
    setSnapshotAccess(false);
  };

  // Impersonation / account switching only apply with a live auth session;
  // stale sessionStorage state after sign-out must never look signed in.
  const { effectiveEmail, isImpersonating, isAccountSwitched } = resolveEffectiveEmail({
    actualEmail,
    selectedAccountEmail: sessionStorage.getItem('selectedAccountEmail'),
    impersonatingFlag: sessionStorage.getItem('isImpersonating') === 'true',
    impersonatedBy: sessionStorage.getItem('impersonatedBy'),
    adminEmail: PLATFORM_ADMIN_EMAILS[0],
    adminEmails: PLATFORM_ADMIN_EMAILS,
  });
  
  const email = effectiveEmail;

  // A single hung network call must never leave the app on an endless spinner.
  const withTimeout = async <T,>(work: Promise<T>, ms: number, fallback: T): Promise<T> => {
    let timer: number | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<T>((resolve) => {
          timer = window.setTimeout(() => resolve(fallback), ms);
        }),
      ]);
    } catch {
      return fallback;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  };

  // Strip the OAuth callback tokens / handoff token off the address bar once the
  // session is live, so the URL is clean and route effects that skip while a
  // callback is in flight can run normally.
  const cleanAuthCallbackUrl = () => {
    if (typeof window === 'undefined') return;
    const hasHashTokens = /access_token=|refresh_token=|provider_token=/.test(window.location.hash);
    const params = new URLSearchParams(window.location.search);
    const hadToken = params.has('attribution_token');
    if (!hasHashTokens && !hadToken) return;
    params.delete('attribution_token');
    const query = params.toString();
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}`
    );
  };

  const normalizeApproval = (value?: string | null) => value === 'NO' ? 'NO' : 'YES';
  const normalizePlan = (value?: string | null) => {
    const upper = value?.toUpperCase();
    return upper === 'BASIC' || upper === 'ADVANCED' ? upper : 'STARTER';
  };

  // One round trip for everything the shell needs off saas_suite_users.
  // This used to be two separate requests (approval/plan and the access flags),
  // which doubled the time the app sat on its loading spinner.
  const fetchAccountRow = async (userEmail: string) => {
    try {
      const { data, error } = await supabase
        .from('saas_suite_users')
        .select('approval, plan, email_warmup_access, free_leads_access, hide_bonuses, branding_tool_access, is_affiliate, snapshot_access')
        .ilike('email', userEmail)
        .maybeSingle();

      if (error) {
        console.error('Error fetching account row:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error fetching account row:', error);
      return null;
    }
  };

  // Helper function to fetch initial questions status
  const fetchInitialQuestionsStatus = async (userEmail: string) => {
    try {
      const { data, error } = await supabase.rpc('get_user_initial_questions_status', {
        user_email: userEmail
      });
      
      if (error) {
        console.error('Error fetching initial questions status:', error);
        return false;
      }
      
      return data || false;
    } catch (error) {
      console.error('Error fetching initial questions status:', error);
      return false;
    }
  };

  // An affiliate record linked by either the application email or the linked
  // login email is enough to unlock the affiliate dashboard, even if the
  // is_affiliate flag on saas_suite_users was never toggled.
  const hasAffiliateRecord = async (userEmail: string) => {
    try {
      const normalized = userEmail.trim().toLowerCase();
      const { data } = await supabase
        .from('affiliates')
        .select('id')
        .or(`email.ilike.${normalized},user_email_linked.ilike.${normalized}`)
        .limit(1);
      return !!(data && data.length > 0);
    } catch {
      return false;
    }
  };

  // Removed: access flags now come from fetchAccountRow's single request.

  // Auto-switch to owner account if user is an invited admin with no real subscription
  const autoSwitchToOwnerAccount = async (userEmail: string): Promise<string | null> => {
    // Skip if already switched or impersonating
    const existingSelection = sessionStorage.getItem('selectedAccountEmail');
    // A stale selection of the admin's own email must not keep them out of
    // the account they were invited to.
    if (existingSelection && existingSelection.toLowerCase() !== userEmail.toLowerCase()) return null;

    try {
      // Check if user has accepted admin invitations. Pending invites are
      // visible to the invited admin, but owner-account RLS only opens after
      // the invite is accepted, so accept before auto-switching.
      const { data: adminAccounts } = await supabase
        .from('account_admins')
        .select('owner_email, status, accepted_at, created_at')
        .ilike('admin_email', userEmail)
        .in('status', ['accepted', 'pending']);

      if (!adminAccounts || adminAccounts.length === 0) return null;

      if (adminAccounts.some((account) => account.status === 'pending')) {
        await supabase.rpc('admin_accept_invitation', { p_admin_email: userEmail });
      }

      // Being added as an admin means the account they were added to is the
      // default — even if they also have their own account. With several,
      // default to the most recently added one; they can switch any time.
      const others = adminAccounts.filter(
        (a) => a.owner_email && a.owner_email.toLowerCase() !== userEmail.toLowerCase(),
      );
      if (others.length === 0) return null;
      const latest = [...others].sort((a, b) =>
        String(b.accepted_at || b.created_at || '').localeCompare(String(a.accepted_at || a.created_at || '')),
      )[0];
      const ownerEmail = latest.owner_email;
      sessionStorage.setItem('selectedAccountEmail', ownerEmail);
      return ownerEmail;

    } catch (error) {
      console.error('Error checking admin accounts for auto-switch:', error);
    }
    return null;
  };

  // Function to load data for the effective user (handles impersonation)
  const loadEffectiveUserData = async (emailToLoad: string) => {
    const [row, questionsCompleted] = await Promise.all([
      fetchAccountRow(emailToLoad),
      fetchInitialQuestionsStatus(emailToLoad)
    ]);
    setApproval(normalizeApproval(row?.approval));
    setPlan(normalizePlan(row?.plan));
    setInitialQuestionsCompleted(questionsCompleted);
    setEmailWarmupAccess(row?.email_warmup_access || false);
    setFreeLeadsAccess(row?.free_leads_access || false);
    setBrandingToolAccess(row?.branding_tool_access || false);
    setHideBonusesState(row?.hide_bonuses || false);
    setSnapshotAccess((row as any)?.snapshot_access || false);
    setIsAffiliate(row?.is_affiliate || false);

    // The affiliate fallback lookup is a second request and nothing in the
    // shell blocks on it, so never make the user wait for it.
    if (!row?.is_affiliate) {
      void hasAffiliateRecord(emailToLoad).then((found) => {
        if (found) setIsAffiliate(true);
      });
    }
  };

  const loadedSessionUserRef = React.useRef<string | null>(null);
  const inFlightSessionUserRef = React.useRef<string | null>(null);

  const loadAuthenticatedSession = async (authSession: Session, event?: string) => {
    const userEmail = getSessionEmail(authSession);
    // Record before the same-user early return. A token refresh often loads the
    // session first; the sign-in event then returned here and never counted.
    const isLoginEvent = !event || event === "SIGNED_IN" || event === "INITIAL_SESSION";
    if (userEmail && isLoginEvent) recordLoginOnce(userEmail);
    // Supabase re-emits SIGNED_IN / TOKEN_REFRESHED on tab focus and refreshes.
    // Re-running the whole account load each time re-registered the user and
    // re-fetched everything in a loop, leaving the app spinning. Only refresh the
    // session object when the same user is already loaded or loading.
    const uid = authSession.user.id;
    const meta = metadataAdminName(authSession.user.user_metadata);
    const isNewUser = loadedSessionUserRef.current !== uid && inFlightSessionUserRef.current !== uid;
    if (isNewUser) {
      setSignedInAdminName(meta.role === 'account_admin' && meta.name ? meta.name : null);
    }
    if (loadedSessionUserRef.current === uid || inFlightSessionUserRef.current === uid) {
      setSession(authSession);
      setUser(authSession.user);
      return;
    }
    inFlightSessionUserRef.current = uid;
    setSession(authSession);
    setUser(authSession.user);
    setActualEmail(userEmail);
    setUserId(authSession.user.id);
    if (userEmail) void attachKitPurchases();

    if (!userEmail) {
      setIsLoading(false);
      return;
    }

    try {
      // OAuth can create auth.users before the app row exists. Always make this idempotent.
      //
      // The Google clause is qualified by the auth event on purpose: without it,
      // every page load / token refresh for a Google user re-ran
      // register_starter_user and re-fired the signup conversions, writing
      // garbage into both the DB and Meta. INITIAL_SESSION is still allowed for
      // Google so the very first post-OAuth render (which sometimes arrives as
      // INITIAL_SESSION rather than SIGNED_IN) provisions the row — that is
      // guarded further down by the once-per-event flags.
      const isGoogle = authSession.user.app_metadata?.provider === 'google';
      const isFirstOAuthRender =
        isGoogle &&
        event === 'INITIAL_SESSION' &&
        typeof window !== 'undefined' &&
        (new URLSearchParams(window.location.search).has('attribution_token') ||
          window.location.hash.includes('access_token') ||
          !!sessionStorage.getItem('signup_attribution_handoff'));

      // /work-with-us is a lead-only visit. Google may create auth.users, and this
      // path must not also create a Starter app row or fire signup conversions.
      const leadOnlyVisit =
        typeof window !== 'undefined' && window.location.pathname.startsWith('/work-with-us');

      if (!leadOnlyVisit && (event === 'SIGNED_IN' || isFirstOAuthRender)) {
        // Resolve affiliate from any signal available: explicit OAuth-stash, or
        // the ?ref slug captured into localStorage by useAffiliateTracking. Without
        // this fallback, Google OAuth signups never attribute to the affiliate even
        // though the view/click event was tracked.
        const affiliateId =
          sessionStorage.getItem('google_oauth_affiliate_id') ||
          (typeof window !== 'undefined'
            ? localStorage.getItem('affiliate_id') ||
              localStorage.getItem('affiliate_ref')
            : null);
        // The auth trigger also creates this row. Don't make the shell wait on
        // a second insert that often times out and then succeeds on retry.
        void withTimeout(
          supabase.rpc('register_starter_user', {
            user_email: userEmail,
            user_affiliate_id: affiliateId
          }) as unknown as Promise<unknown>,
          6000,
          null
        );

        // Attribution, conversion tracking, and lead notifications are
        // best-effort side effects. Never make the signed-in user wait for
        // third-party calls before the app can open.
        void (async () => {
          try {
            const { claimStagedAttribution, persistAttribution, fireLeadWebhook } = await import('@/utils/fbAttribution');
            await claimStagedAttribution();
            await persistAttribution(userEmail);
            if (authSession.user.app_metadata?.provider === 'google') {
              void fireLeadWebhook(userEmail, 'google_oauth');
            }
          } catch {}

          try {
            const { trackSignupComplete } = await import('@/utils/metaCapi');
            await trackSignupComplete(userEmail, authSession.user.id);
          } catch {}
        })();

        if (affiliateId) {
          sessionStorage.removeItem('google_oauth_affiliate_id');
        }

        // Affiliate signup flow: mark user as affiliate, skip onboarding, link affiliates row
        const affiliateSignupPending = sessionStorage.getItem('affiliate_signup_pending') === '1';
        const affiliateSignupSlug = sessionStorage.getItem('affiliate_signup_slug');
        if (affiliateSignupPending) {
          void supabase.rpc('register_affiliate_user', {
            user_email: userEmail,
            user_affiliate_slug: affiliateSignupSlug || affiliateId || '',
          });
          sessionStorage.removeItem('affiliate_signup_pending');
          sessionStorage.removeItem('affiliate_signup_slug');
        }
      }

      await withTimeout(autoSwitchToOwnerAccount(userEmail), 2500, null);

      const impersonating = sessionStorage.getItem('isImpersonating') === 'true';
      const impersonatedBy = sessionStorage.getItem('impersonatedBy');
      const selectedEmail = sessionStorage.getItem('selectedAccountEmail');
      const shouldImpersonate = impersonating &&
        isPlatformAdminEmail(impersonatedBy) &&
        isPlatformAdminEmail(userEmail) &&
        impersonatedBy?.toLowerCase() === userEmail.toLowerCase() &&
        selectedEmail;
      const isAccountSwitch = selectedEmail &&
        selectedEmail.toLowerCase() !== userEmail.toLowerCase() &&
        !shouldImpersonate;

      const emailToLoad = shouldImpersonate ? selectedEmail! :
                          isAccountSwitch ? selectedEmail! : userEmail;
      if (!shouldImpersonate) {
        const loadId = ++adminNameLoadRef.current;
        void loadAcceptedAdminName(userEmail, isAccountSwitch ? emailToLoad : null).then((adminName) => {
          if (loadId !== adminNameLoadRef.current || !adminName) return;
          setSignedInAdminName(adminName);
        });
      }
      await withTimeout(loadEffectiveUserData(emailToLoad), 4000, undefined);
      if (!shouldImpersonate && !isAccountSwitch && !leadOnlyVisit) {
        void import('@/lib/loginInstallationAudit').then(({ auditInstallationOnLogin }) => auditInstallationOnLogin(userEmail));
      }
    } catch (error) {
      console.error('Error loading authenticated user:', error);
      setApproval(null);
      setPlan(null);
    } finally {
      loadedSessionUserRef.current = uid;
      inFlightSessionUserRef.current = null;
      setIsLoading(false);
      cleanAuthCallbackUrl();
    }
  };

  // Function to update hide_bonuses in the database
  const setHideBonuses = async (value: boolean) => {
    if (!effectiveEmail) return;
    
    setHideBonusesState(value);
    
    try {
      await supabase
        .from('saas_suite_users')
        .update({ hide_bonuses: value })
        .ilike('email', effectiveEmail);
    } catch (error) {
      console.error('Error updating hide_bonuses:', error);
    }
  };

  // Set up auth state listener and check for existing session
  useEffect(() => {
    let mounted = true;
    // Absolute backstop: the app must never sit on the loading spinner, whatever
    // a slow network or provider does.
    const loadingBackstop = window.setTimeout(() => {
      if (!mounted) return;
      // Always leave the spinner. A second session load started from here used
      // to return early and leave the screen blank for the rest of its timeouts.
      setIsLoading(false);
    }, 8000);

    const isAuthCallbackUrl = () => {
      const hash = typeof window !== 'undefined' ? window.location.hash : '';
      const search = typeof window !== 'undefined' ? window.location.search : '';
      return (
        hash.includes('access_token=') ||
        hash.includes('refresh_token=') ||
        hash.includes('type=recovery') ||
        search.includes('code=')
      );
    };

    const resolveSessionWithRetry = async (event?: string) => {
      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get('code');

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (data.session?.user) {
          await loadAuthenticatedSession(data.session, event);
          return true;
        }
        if (error) {
          console.warn('OAuth session exchange did not complete:', error.message);
        }
      }

      // A normal page load needs one session check. Retries are only useful
      // while Supabase is actively completing an OAuth callback.
      const maxAttempts = isAuthCallbackUrl() ? 10 : 1;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return true;
        if (session?.user) {
          await loadAuthenticatedSession(session, event);
          return true;
        }
        if (attempt < maxAttempts - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      return false;
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          // Meta Manual Advanced Matching: re-init pixels with the user's
          // email (hashed browser-side) so all events match the person.
          import("@/utils/metaCapi").then(({ identifyMetaPixel }) =>
            identifyMetaPixel(session.user?.email),
          );
          setTimeout(() => void loadAuthenticatedSession(session, event), 0);
        } else if (event === 'SIGNED_OUT') {
          void import('@/lib/loginInstallationAudit').then(({ clearInstallationAuditSession }) => clearInstallationAuditSession());
          clearLoginRecordedFlags();
          loadedSessionUserRef.current = null;
          inFlightSessionUserRef.current = null;
          sessionStorage.removeItem('selectedAccountEmail');
          sessionStorage.removeItem('isImpersonating');
          sessionStorage.removeItem('impersonatedBy');
          setSession(null);
          setUser(null);
          resetUserState();
          setIsLoading(false);
        }
      }
    );

    resolveSessionWithRetry().then((restored) => {
      if (!mounted || restored || inFlightSessionUserRef.current || loadedSessionUserRef.current) {
        return;
      }
      sessionStorage.removeItem('selectedAccountEmail');
      sessionStorage.removeItem('isImpersonating');
      sessionStorage.removeItem('impersonatedBy');
      setSession(null);
      setUser(null);
      resetUserState();
      setIsLoading(false);
    }).catch((error) => {
      console.error('Unable to restore authentication session:', error);
      if (!mounted) return;
      setSession(null);
      setUser(null);
      resetUserState();
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      window.clearTimeout(loadingBackstop);
      subscription.unsubscribe();
    };
  }, []);

  // Reload permissions whenever the effective account changes (admin "Login As",
  // account switching). Without this the sidebar keeps the admin's own flags.
  const lastLoadedEmailRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!effectiveEmail) {
      lastLoadedEmailRef.current = null;
      return;
    }
    if (lastLoadedEmailRef.current === effectiveEmail) return;
    lastLoadedEmailRef.current = effectiveEmail;
    void loadEffectiveUserData(effectiveEmail);
  }, [effectiveEmail]);

  const setUserWithApproval = (userEmail: string, userUserId: string, userApproval?: string) => {
    setActualEmail(userEmail);
    setUserId(userUserId);
    setApproval(userApproval || null);
  };

  const clearUser = async () => {
    try {
      adminNameLoadRef.current += 1;
      setSignedInAdminName(null);
      sessionStorage.removeItem('selectedAccountEmail');
      sessionStorage.removeItem('isImpersonating');
      sessionStorage.removeItem('impersonatedBy');
      try {
        const { clearNativeOAuthState } = await import('@/lib/nativeOAuthState');
        clearNativeOAuthState();
      } catch { /* ignore */ }

      // Detach the store purchase identity in the iOS / Android app so the next
      // person signing in never inherits these subscriptions.
      void import('@/lib/revenuecat').then((m) => m.logOutStoreBilling()).catch(() => {});

      await (await import("@/lib/hardSignOut")).hardSignOut();

      
      setActualEmail(null);
      setUserId(null);
      setApproval(null);
      setPlan(null);
      setInitialQuestionsCompleted(null);
      setEmailWarmupAccess(false);
      setFreeLeadsAccess(false);
      setBrandingToolAccess(false);
      setHideBonusesState(false);
      setIsAffiliate(false);
      setSnapshotAccess(false);
      setUser(null);
      setSession(null);
      
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
      setActualEmail(null);
      setUserId(null);
      setApproval(null);
      setPlan(null);
      setInitialQuestionsCompleted(null);
      setEmailWarmupAccess(false);
      setFreeLeadsAccess(false);
      setBrandingToolAccess(false);
      setHideBonusesState(false);
      setIsAffiliate(false);
      setSnapshotAccess(false);
      setUser(null);
      setSession(null);
      window.location.href = '/';
    }
  };

  // Only an explicit NO means the account is suspended.
  const isApproved = approval !== "NO";

  const refetchUserData = async () => {
    if (effectiveEmail) {
      await loadEffectiveUserData(effectiveEmail);
    }
  };

  return (
    <UserContext.Provider value={{ 
      email,
      userId, 
      approval,
      plan,
      isApproved, 
      user, 
      session, 
      setUser: setUserWithApproval, 
      clearUser, 
      isLoading,
      initialQuestionsCompleted,
      emailWarmupAccess,
      freeLeadsAccess,
      brandingToolAccess,
      isAffiliate,
      snapshotAccess,
      hideBonuses,
      setHideBonuses,
      isImpersonating,
      effectiveEmail,
      actualEmail,
      signedInAdminName,
      refetchUserData
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
