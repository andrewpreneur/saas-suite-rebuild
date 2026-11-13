import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useLocation } from 'react-router-dom';
import { navigateWithParams, appendTrackingParams } from '@/utils/preserveParams';
import { readNextPath, clearNextPath, markSkipOnboarding, isCommunityPath, markCommunityTour } from '@/utils/deepLink';
import { LEARNING_HUB_PATH } from '@/lib/onboardingArrival';
import { supabase } from '@/integrations/supabase/client';
import { signupErrorMessage } from '@/lib/signupError';
import { isRetryableSignupError, presentSignupError, retrySignupStep } from '@/lib/signupAttempt';
import { attachKitPurchases } from '@/lib/kitPurchases';
import { fetchAuthAccountState } from '@/lib/authAccount';
import {
  accountExistsLoginPath,
  isKitDeepLink,
  modeAfterAlreadyRegistered,
  resetPasswordRedirect,
  signupModeForState,
  type SignupMode,
} from '@/lib/kitLoginFlow';
import { signInWithStoreProvider } from '@/lib/nativeOAuth';
import { useToast } from '@/hooks/use-toast';
import { MailCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { DURATION, EASE_OUT } from '@/lib/motion';
import { EntryShell } from '@/components/premium/entry/EntryShell';
import { EmailSummary, Field, FormMessage, OrDivider, PasswordField, SubmitButton, friendlyAuthError } from '@/components/premium/entry/fields';
import { WhiteGoogleButton } from '@/components/auth/WhiteGoogleButton';
import AuthBackButton from '@/components/AuthBackButton';
import AppleSignInButton from '@/components/AppleSignInButton';
import { PasswordCodeForm } from '@/components/auth/PasswordCodeForm';

const Signup = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [mode, setMode] = useState<SignupMode>('email');
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [isAffiliateSignup, setIsAffiliateSignup] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const nextPath = readNextPath();
  const loginHref = appendTrackingParams(accountExistsLoginPath(email, nextPath));

  const openDestination = (markQuestions = false) => {
    if (nextPath && !/^\/(app\/)?copilot/.test(nextPath)) {
      // Lets the kit dashboard render. InitialQuestionsGuard clears this once that page is open,
      // so a later visit to /app/settings is not held on settings for the rest of the tab.
      markSkipOnboarding();
      if (isCommunityPath(nextPath)) markCommunityTour();
      if (markQuestions) {
        void supabase.from('saas_suite_users').update({ initial_questions_completed: true }).eq('email', email);
      }
    } else if (isKitDeepLink(nextPath)) {
      markSkipOnboarding();
    }
    if (nextPath) clearNextPath();
    navigate(nextPath || (markQuestions ? LEARNING_HUB_PATH : '/app'), { replace: true });
  };

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
    const searchParams = new URLSearchParams(location.search);
    const amId = searchParams.get('am_id');
    const refSlug = searchParams.get('ref');
    const emailParam = searchParams.get('email');
    const affiliateSignupFlag = searchParams.get('affiliate_signup');

    if (affiliateSignupFlag === '1') {
      setIsAffiliateSignup(true);
      sessionStorage.setItem('affiliate_signup_pending', '1');
      if (refSlug) sessionStorage.setItem('affiliate_signup_slug', refSlug);
    }

    if (emailParam) {
      setEmail(emailParam.trim().toLowerCase());
    }

    if (amId) {
      setAffiliateId(amId);
    } else if (refSlug) {
      localStorage.setItem('affiliate_ref', refSlug);
      setAffiliateId(refSlug);
    } else {
      const storedRef = localStorage.getItem('affiliate_ref');
      if (storedRef) {
        setAffiliateId(storedRef);
      } else {
        const storedAffiliateId = sessionStorage.getItem('affiliate_id');
        if (storedAffiliateId) setAffiliateId(storedAffiliateId);
      }
    }
  }, [location.search]);

  const resetToEmail = () => {
    setMode('email');
    setPassword('');
    setError('');
  };

  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (cleanEmail !== email) setEmail(cleanEmail);
    setLoading(true);
    setError('');
    try {
      try {
        const { fireLeadWebhook, stageSignupAttribution } = await import('@/utils/fbAttribution');
        void stageSignupAttribution().then(() => fireLeadWebhook(cleanEmail, 'email_entry')).catch(() => {});
      } catch { /* attribution is best-effort */ }
      const state = await fetchAuthAccountState(cleanEmail);
      setMode(signupModeForState(state));
      setPassword('');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Error checking account status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!password || password.length < 6) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInError) throw signInError;
      toast({ title: 'Welcome back', description: 'Opening your kit.' });
      void attachKitPurchases();
      openDestination(false);
    } catch (reason: unknown) {
      setError(presentSignupError(reason));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    setLoading(true);
    setError('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: resetPasswordRedirect(window.location.origin, nextPath),
      });
      if (resetError) throw resetError;
      toast({
        title: 'Password reset email sent',
        description: 'Check your email for the password reset link.',
      });
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not send the reset email.');
    } finally {
      setLoading(false);
    }
  };

  const switchExistingAccount = async (cleanEmail: string) => {
    const state = await fetchAuthAccountState(cleanEmail).catch(() => 'password' as const);
    setMode(modeAfterAlreadyRegistered(state));
    setPassword('');
    setError('');
    toast({
      title: 'Account exists',
      description: state === 'needs_password'
        ? 'Set a password with the one-time code. This page keeps your kit link.'
        : 'Sign in with your password. This page keeps your kit link.',
    });
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'email') {
      await handleEmailSubmit(event);
      return;
    }
    if (mode === 'sign-in') {
      await handleSignIn(event);
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    if (!password || password.length < 6) {
      setError('Please choose a password with at least 6 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: registerError } = await retrySignupStep(() => supabase.rpc('register_starter_user', {
        user_email: cleanEmail,
        user_affiliate_id: affiliateId,
      }));
      if (registerError) {
        try {
          await switchExistingAccount(cleanEmail);
          return;
        } catch { /* fall through to the signup error */ }
        throw new Error(signupErrorMessage(registerError));
      }
      try {
        const { persistAttribution } = await import('@/utils/fbAttribution');
        await persistAttribution(cleanEmail);
      } catch { /* attribution is best-effort */ }
      const redirectPath = nextPath
        ? nextPath
        : isAffiliateSignup
          ? '/app/affiliate-dashboard'
          : LEARNING_HUB_PATH;
      const redirectUrl = `${window.location.origin}${navigateWithParams(redirectPath)}`;
      let { data, error: signUpError } = await retrySignupStep(() => supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { emailRedirectTo: redirectUrl },
      }));
      if (signUpError && isRetryableSignupError(signUpError)) {
        const signedIn = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (!signedIn.error && signedIn.data.session) {
          data = signedIn.data;
          signUpError = null;
        }
      }
      if (signUpError) {
        if (/already/i.test(signUpError.message)) {
          await switchExistingAccount(cleanEmail);
          return;
        }
        throw signUpError;
      }
      if (data.user && !data.session) {
        setSuccess(true);
        toast({ title: 'Account created successfully!', description: 'Please check your email to confirm your account.' });
      } else if (data.session) {
        if (isAffiliateSignup) {
          await supabase.rpc('register_affiliate_user', {
            user_email: email,
            user_affiliate_slug: affiliateId || '',
          });
          sessionStorage.removeItem('affiliate_signup_pending');
          sessionStorage.removeItem('affiliate_signup_slug');
          toast({ title: 'Welcome aboard, affiliate!', description: 'Your dashboard is ready.' });
          navigate('/app/affiliate-dashboard');
          return;
        }
        toast({ title: 'Welcome to SAASSuite.AI!', description: 'Your account has been created successfully.' });
        void attachKitPurchases();
        if (nextPath && !/^\/(app\/)?copilot/.test(nextPath)) {
          openDestination(true);
          return;
        }
        navigate(navigateWithParams(LEARNING_HUB_PATH));
      }
    } catch (reason: unknown) {
      setError(presentSignupError(reason));
    } finally {
      setLoading(false);
    }
  };

  const helmet = (
    <Helmet>
      <title>Sign Up | SaaSSuite</title>
      <meta name="description" content="Create your SaaSSuite account and start white-labeling HighLevel today." />
      <link rel="canonical" href="https://saassuite.ai/signup" />
      <meta property="og:title" content="Sign Up | SaaSSuite" />
      <meta property="og:description" content="Create your SaaSSuite account and start white-labeling HighLevel today." />
      <meta property="og:url" content="https://saassuite.ai/signup" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Sign Up | SaaSSuite" />
      <meta name="twitter:description" content="Create your SaaSSuite account and start white-labeling HighLevel today." />
    </Helmet>
  );

  if (success) {
    return (
      <EntryShell
        title="Check your email"
        description={<>We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>.</>}
        mark={
          <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
        }
      >
        <div className="space-y-4">
          <FormMessage tone="success">Open the link to confirm your email, then sign in. It can take a minute to arrive.</FormMessage>
          <SubmitButton type="button" onClick={() => navigate(navigateWithParams(loginHref))}>
            Back to sign in
          </SubmitButton>
        </div>
      </EntryShell>
    );
  }

  const title = mode === 'sign-in'
    ? 'Sign in'
    : mode === 'set-password'
      ? 'Set your password'
      : 'Create your account';
  const description = mode === 'sign-in'
    ? 'You already have an account. Enter your password to continue.'
    : mode === 'set-password'
      ? 'This account does not have a password yet.'
      : mode === 'create'
        ? 'Choose a password to finish.'
        : 'Start white-labeling HighLevel in a few minutes.';

  return (
    <EntryShell
      title={title}
      description={description}
      back={<AuthBackButton />}
      cardProps={{ 'data-testid': 'signup-card', 'data-mode': mode }}
      footer={
        <>
          Already have an account?{' '}
          <a
            id="signup-login-link"
            href={loginHref}
            className="font-semibold text-brand underline-offset-4 hover:text-brand-hover hover:underline"
          >
            Sign in
          </a>
        </>
      }
    >
      {helmet}
      <div className="space-y-5">
        <div className="space-y-4">
          {mode === 'email' ? (
            <Field
              id="email"
              form="signup-form"
              label="Work email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@agency.com"
              aria-invalid={error ? true : undefined}
            />
          ) : (
            <EmailSummary email={email} onChange={resetToEmail} changeLabel="Edit email" />
          )}

          {mode === 'set-password' ? (
            <PasswordCodeForm email={email.trim().toLowerCase()} nextPath={nextPath} onSuccess={() => openDestination(false)} />
          ) : (
            <form
              id="signup-form"
              onSubmit={mode === 'email' ? handleEmailSubmit : mode === 'sign-in' ? handleSignIn : handleSignup}
              className="space-y-4"
            >
              {mode !== 'email' && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: DURATION.base, ease: EASE_OUT }}
                >
                  <PasswordField
                    id="password"
                    label="Password"
                    autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
                    visible={showPassword}
                    onToggleVisible={() => setShowPassword((current) => !current)}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    placeholder={mode === 'sign-in' ? 'Enter your password' : 'At least 6 characters'}
                    hint={mode === 'create' ? 'Use 6 or more characters.' : undefined}
                    minLength={6}
                    autoFocus
                    aria-invalid={error ? true : undefined}
                    labelAction={
                      mode === 'sign-in' ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={handleForgotPassword}
                          className="text-small font-medium text-brand underline-offset-4 hover:text-brand-hover hover:underline disabled:opacity-50"
                        >
                          Forgot password?
                        </button>
                      ) : undefined
                    }
                  />
                </motion.div>
              )}

              {mode === 'create' && (
                <div className="flex items-start gap-3 text-left">
                  <input
                    id="signup-terms"
                    type="checkbox"
                    required
                    className="mt-0.5 size-4 shrink-0 rounded-sm border-input accent-[hsl(var(--brand))]"
                  />
                  <label htmlFor="signup-terms" className="text-caption font-normal leading-5 text-muted-foreground">
                    I agree to the{' '}
                    <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                      Terms of Service
                    </a>,{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                      Privacy Policy
                    </a>,{' '}
                    <a href="/cookies" target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                      Cookie Policy
                    </a>, and{' '}
                    <a href="/refunds" target="_blank" rel="noopener noreferrer" className="font-medium text-brand hover:underline">
                      Refund Policy
                    </a>{' '}(all fees are non-refundable).
                  </label>
                </div>
              )}

              {error && <FormMessage>{friendlyAuthError(error)}</FormMessage>}

              <SubmitButton
                type="submit"
                loading={loading}
                loadingLabel={mode === 'email' ? 'Checking your email' : mode === 'sign-in' ? 'Signing in' : 'Creating your account'}
              >
                {mode === 'email' ? 'Continue' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
              </SubmitButton>
            </form>
          )}
        </div>

        <OrDivider />

        <div className="space-y-3 [&>button]:h-11">
          <WhiteGoogleButton
            label="Continue with Google"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError('');
              if (nextPath && !/^\/(app\/)?copilot/.test(nextPath)) markSkipOnboarding();
              if (isCommunityPath(nextPath)) markCommunityTour();
              const redirectPath = nextPath
                ? nextPath
                : isAffiliateSignup
                  ? '/app/affiliate-dashboard'
                  : '/app';
              if (affiliateId) sessionStorage.setItem('google_oauth_affiliate_id', affiliateId);
              const message = await signInWithStoreProvider('google', navigateWithParams(redirectPath), () => setLoading(false));
              if (message) {
                setError(message);
                setLoading(false);
              }
            }}
          />

          <AppleSignInButton
            redirectPath={navigateWithParams(nextPath ? nextPath : isAffiliateSignup ? '/app/affiliate-dashboard' : '/app')}
            label="Continue with Apple"
            disabled={loading}
            onStart={() => {
              setLoading(true);
              if (nextPath && !/^\/(app\/)?copilot/.test(nextPath)) markSkipOnboarding();
              if (isCommunityPath(nextPath)) markCommunityTour();
              if (affiliateId) sessionStorage.setItem('google_oauth_affiliate_id', affiliateId);
            }}
            onBrowserClosed={() => setLoading(false)}
            onError={(message) => {
              setError(message);
              setLoading(false);
            }}
          />
        </div>
      </div>
    </EntryShell>
  );
};

export default Signup;
