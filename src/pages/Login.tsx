import { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { navigateWithParams } from '@/utils/preserveParams';
import { readNextPath, markSkipOnboarding, markCommunityTour, isCommunityPath } from '@/utils/deepLink';
import { fetchAuthAccountState } from '@/lib/authAccount';
import { isKitDeepLink, resetPasswordRedirect } from '@/lib/kitLoginFlow';
import { consumeKitHomeReturn } from '@/lib/kitReturn';
import { PasswordCodeForm } from '@/components/auth/PasswordCodeForm';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { EntryShell } from '@/components/premium/entry/EntryShell';
import { EmailSummary, Field, FormMessage, OrDivider, PasswordField, SubmitButton, friendlyAuthError } from '@/components/premium/entry/fields';
import { WhiteGoogleButton } from '@/components/auth/WhiteGoogleButton';
import AuthBackButton from '@/components/AuthBackButton';
import AppleSignInButton from '@/components/AppleSignInButton';
import { signInWithStoreProvider } from '@/lib/nativeOAuth';
import { attachKitPurchases } from '@/lib/kitPurchases';
import { isRetryableSignupError, presentSignupError, retrySignupStep } from '@/lib/signupAttempt';

const Login = () => {
  useMetaPixel();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'email' | 'password' | 'not-approved'>('email');
  const [userApproval, setUserApproval] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [needsCode, setNeedsCode] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const navigate = useNavigate();
  const { user, setUser } = useUser();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const previewOnly = searchParams.has('preview') && searchParams.get('preview') !== '0';
  // The first step renders without motion so the form is usable on first paint.
  const stepChanged = useRef(false);
  useEffect(() => {
    stepChanged.current = true;
  }, []);
  // One-shot kit home armed by the success page. Read once per visit to this
  // screen, then it is gone. A missing key keeps today's /app fallback.
  // Starting Google or Apple from this page still uses readNextPath() || /app.
  const kitHomeOnce = useRef<string | null | undefined>(undefined);
  const destinationAfterAuth = () => {
    if (kitHomeOnce.current === undefined) kitHomeOnce.current = consumeKitHomeReturn();
    return kitHomeOnce.current || readNextPath();
  };
  // Deep link the visitor was headed to before hitting the auth wall.
  // Resolved at redirect time so a deep link stashed mid-flow is not missed.

  useEffect(() => {
    const onOAuthError = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (message) setError(message);
      setLoading(false);
    };
    window.addEventListener('ss-oauth-error', onOAuthError);
    return () => window.removeEventListener('ss-oauth-error', onOAuthError);
  }, []);

  useEffect(() => {
    const oauthProvider = searchParams.get('oauth');
    const hasOAuthCode = searchParams.has('code');
    if (oauthProvider === 'google' || hasOAuthCode) {
      setLoading(true);
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          if (session?.user) {
            void attachKitPurchases();
            const next = destinationAfterAuth();
            if (next && isKitDeepLink(next)) markSkipOnboarding();
            navigate(next || navigateWithParams('/app'), { replace: true });
          }
        })
        .finally(() => setLoading(false));
    }

    // Check for email in URL parameters (from email confirmation)
    const emailFromUrl = searchParams.get('email');
    if (emailFromUrl) {
      setEmail(emailFromUrl);
      // Auto-check the user's approval status
      handleEmailCheck(emailFromUrl);
    }

    // Check if we're coming from email confirmation
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('type') === 'signup' || urlParams.get('confirmation_url')) {
      setEmailConfirmed(true);
      toast({
        title: "Email confirmed successfully",
        description: "You can now log in with your password.",
      });
    }
  }, [searchParams]);

  useEffect(() => {
    // Redirect if already logged in and approved.
    // UI preview only: /login?preview (or ?preview=1) keeps the page open while the demo session is signed in.
    if (user && !previewOnly) {
      const next = destinationAfterAuth();
      if (next && isKitDeepLink(next)) markSkipOnboarding();
      navigate(next || navigateWithParams('/app'));
    }
  }, [user, navigate]);

  const openNext = () => {
    const next = destinationAfterAuth();
    if (next && (isKitDeepLink(next) || !/^\/(app\/)?copilot/.test(next))) {
      markSkipOnboarding();
      if (isCommunityPath(next)) markCommunityTour();
    }
    navigate(next || navigateWithParams('/app'));
  };

  const handleEmailCheck = async (emailToCheck: string) => {
    const normalizedEmail = emailToCheck.trim().toLowerCase();
    setLoading(true);
    setError('');

    try {
      const [state, approvalResult] = await Promise.all([
        fetchAuthAccountState(normalizedEmail),
        supabase.rpc('get_user_approval_by_email', { user_email: normalizedEmail }),
      ]);
      const approvalStatus = approvalResult.data;
      const userStatus = approvalStatus?.[0];
      if (userStatus?.approval === 'NO') {
        setUserApproval('NO');
        setStep('not-approved');
        return;
      }
      if (userStatus) setUserApproval(userStatus.approval);

      if (state === 'password') {
        setHasPassword(true);
        setNeedsCode(false);
        setStep('password');
        if (userStatus?.has_auth_account) {
          void supabase.rpc('update_user_access', { user_email: normalizedEmail });
        }
        return;
      }
      if (state === 'needs_password') {
        setHasPassword(false);
        setNeedsCode(true);
        setStep('password');
        return;
      }
      if (!approvalStatus || approvalStatus.length === 0) {
        setError('Account not found. Please sign up first.');
        setStep('email');
        return;
      }
      setHasPassword(false);
      setNeedsCode(false);
      setStep('password');
    } catch (error: any) {
      setError(error.message || 'Error checking user status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmail(email.trim().toLowerCase());
    await handleEmailCheck(email);
  };

  const handleCreatePassword = async () => {
    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const redirectUrl = `${window.location.origin}${navigateWithParams(`/login?email=${encodeURIComponent(normalizedEmail)}`)}`;
      
      let { data, error } = await retrySignupStep(() => supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: redirectUrl
        }
      }));
      if (error && isRetryableSignupError(error)) {
        const signedIn = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (!signedIn.error && signedIn.data.session) {
          data = signedIn.data;
          error = null;
        }
      }

      if (error) throw error;

      if (data.user && !data.session) {
        toast({
          title: "Password created successfully",
          description: "Please check your email to confirm your account.",
        });
      } else if (data.session) {
        setUser(normalizedEmail, data.user.id, userApproval);
        void attachKitPurchases();
        openNext();
      }
    } catch (error: any) {
      setError(presentSignupError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    setError('');

    try {
      const redirectUrl = resetPasswordRedirect(window.location.origin, readNextPath());
      
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: redirectUrl
      });

      if (error) throw error;

      toast({
        title: "Password reset email sent",
        description: "Check your email for the password reset link.",
      });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check if user has access to multiple accounts
        const [adminResult, ownResult] = await Promise.all([
          supabase
            .from('account_admins')
            .select('owner_email')
            .ilike('admin_email', normalizedEmail)
            .in('status', ['accepted', 'pending']),
          supabase
            .from('saas_suite_users')
            .select('email')
            .ilike('email', normalizedEmail)
            .maybeSingle(),
        ]);
        const adminAccounts = adminResult.data;
        const ownAccount = ownResult.data;

        const hasMultipleAccounts = (adminAccounts && adminAccounts.length > 0) && ownAccount;
        const hasOnlyAdminAccounts = (adminAccounts && adminAccounts.length > 0) && !ownAccount;
        const hasMultipleAdminAccounts = adminAccounts && adminAccounts.length > 1;

        void attachKitPurchases();
        if (hasMultipleAccounts || hasMultipleAdminAccounts) {
          // User has access to multiple accounts, redirect to account selector
          setUser(normalizedEmail, data.user.id, userApproval);
          void supabase.rpc('record_user_login', { user_email: normalizedEmail });
          navigate(navigateWithParams('/select-account'));
        } else if (hasOnlyAdminAccounts && adminAccounts.length === 1) {
          sessionStorage.setItem('selectedAccountEmail', adminAccounts[0].owner_email);
          setUser(normalizedEmail, data.user.id, userApproval);
          void supabase.rpc('update_user_access', { user_email: normalizedEmail });
          void supabase.rpc('record_user_login', { user_email: normalizedEmail });
          openNext();
        } else {
          setUser(normalizedEmail, data.user.id, userApproval);
          void supabase.rpc('update_user_access', { user_email: normalizedEmail });
          void supabase.rpc('record_user_login', { user_email: normalizedEmail });
          openNext();
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const helmet = (
    <Helmet>
      <title>Login | SaaSSuite</title>
      <meta name="description" content="Log in to your SaaSSuite account." />
      <link rel="canonical" href="https://saassuite.ai/login" />
      <meta property="og:title" content="Login | SaaSSuite" />
      <meta property="og:description" content="Log in to your SaaSSuite account." />
      <meta property="og:url" content="https://saassuite.ai/login" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Login | SaaSSuite" />
      <meta name="twitter:description" content="Log in to your SaaSSuite account." />
    </Helmet>
  );

  const shownError = friendlyAuthError(error);
  const accountMissing = /account not found/i.test(error);
  const backToEmail = () => setStep('email');

  return (
    <EntryShell
      title={step === 'not-approved' ? 'Your access is paused' : 'Welcome back'}
      description={
        step === 'email'
          ? 'Sign in to your SaaSSuite account.'
          : step === 'password'
            ? hasPassword
              ? 'Enter your password to continue.'
              : needsCode
                ? 'Set a password to finish signing in.'
                : 'Create a password to finish setting up your account.'
            : 'Your trial has ended or access was turned off. Upgrade to pick up where you left off.'
      }
      back={<AuthBackButton />}
      footer={
        step === 'email' ? (
          <>
            New to SaaSSuite?{' '}
            <button
              type="button"
              onClick={() => navigate(navigateWithParams('/signup'))}
              className="font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline focus-visible:outline-none focus-visible:underline"
            >
              Create an account
            </button>
          </>
        ) : null
      }
    >
      {helmet}
      <motion.div
        key={step}
        initial={stepChanged.current ? { opacity: 0, y: 6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.base, ease: EASE_OUT }}
      >
        {step === 'email' && (
          <div className="space-y-5">
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <Field
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@agency.com"
                aria-invalid={error ? true : undefined}
              />
              {error && (
                <FormMessage>
                  {accountMissing ? (
                    <>
                      We couldn't find an account for that email. Check the spelling, or{' '}
                      <button
                        type="button"
                        className="font-semibold underline underline-offset-2"
                        onClick={() => navigate(navigateWithParams('/signup'))}
                      >
                        create an account
                      </button>
                      .
                    </>
                  ) : (
                    shownError
                  )}
                </FormMessage>
              )}
              <SubmitButton type="submit" loading={loading} loadingLabel="Checking your email">
                Continue
              </SubmitButton>
            </form>

            <OrDivider />

            <div className="space-y-3 [&>button]:h-11">
              <WhiteGoogleButton
                label="Sign in with Google"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  setError('');
                  const message = await signInWithStoreProvider('google', readNextPath() || navigateWithParams('/app'), () => setLoading(false));
                  if (message) {
                    setError(message);
                    setLoading(false);
                  }
                }}
              />

              <AppleSignInButton
                redirectPath={readNextPath() || navigateWithParams('/app')}
                disabled={loading}
                onStart={() => setLoading(true)}
                onBrowserClosed={() => setLoading(false)}
                onError={(message) => {
                  setError(message);
                  setLoading(false);
                }}
              />
            </div>
          </div>
        )}

        {step === 'password' && (
          <div className="space-y-4">
            <EmailSummary email={email} onChange={backToEmail} changeLabel="Change email" />

            {hasPassword ? (
              // User has password - show login form
              <form onSubmit={handleSignIn} className="space-y-4">
                <PasswordField
                  id="password"
                  label="Password"
                  autoComplete="current-password"
                  autoFocus
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword(!showPassword)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  minLength={6}
                  aria-invalid={error ? true : undefined}
                  labelAction={
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={loading}
                      className="text-small font-medium text-brand underline-offset-4 hover:text-brand-hover hover:underline disabled:opacity-50"
                    >
                      Forgot password?
                    </button>
                  }
                />
                {emailConfirmed && (
                  <FormMessage tone="success">Email confirmed. Sign in with your password.</FormMessage>
                )}
                {error && <FormMessage>{shownError}</FormMessage>}
                <SubmitButton type="submit" loading={loading} loadingLabel="Signing in">
                  Sign in
                </SubmitButton>
              </form>
            ) : needsCode ? (
              <PasswordCodeForm
                email={email.trim().toLowerCase()}
                nextPath={readNextPath()}
                onSuccess={openNext}
              />
            ) : (
              // Profile exists, but there is no auth user yet.
              <div className="space-y-4">
                <PasswordField
                  id="password"
                  label="Create a password"
                  autoComplete="new-password"
                  autoFocus
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword(!showPassword)}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="At least 6 characters"
                  minLength={6}
                  hint="Use 6 or more characters."
                />
                {error && <FormMessage>{shownError}</FormMessage>}
                <SubmitButton
                  type="button"
                  onClick={() => {
                    if (!password || password.length < 6) {
                      setError('Choose a password with at least 6 characters.');
                      return;
                    }
                    void handleCreatePassword();
                  }}
                  loading={loading}
                  loadingLabel="Creating your password"
                >
                  Create password
                </SubmitButton>
              </div>
            )}
          </div>
        )}

        {step === 'not-approved' && (
          <div className="space-y-4">
            <EmailSummary email={email} onChange={backToEmail} changeLabel="Change email" />
            <FormMessage tone="info">
              Your workspace and settings are saved. Choose a plan to open them again.
            </FormMessage>
            <SubmitButton type="button" onClick={() => window.open('https://saassuite.ai/pricing', '_blank')}>
              See plans
              <ArrowUpRight aria-hidden="true" />
            </SubmitButton>
          </div>
        )}
      </motion.div>
    </EntryShell>
  );
};

export default Login;
