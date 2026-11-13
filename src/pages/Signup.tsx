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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Pencil, Eye, EyeOff } from 'lucide-react';
import AuthBackButton from '@/components/AuthBackButton';
import AppleSignInButton from '@/components/AppleSignInButton';
import { PasswordCodeForm } from '@/components/auth/PasswordCodeForm';
import { Separator } from '@/components/ui/separator';

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

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInFromBlur {
        0% { opacity: 0; filter: blur(8px); transform: translateY(20px); }
        100% { opacity: 1; filter: blur(0px); transform: translateY(0); }
      }
      @keyframes slideDown {
        0% { opacity: 0; max-height: 0; }
        100% { opacity: 1; max-height: 200px; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
        <div>
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
              <CardDescription>We've sent you a confirmation link at {email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Once you confirm your email, you'll have access to SAASSuite.AI.</AlertDescription>
              </Alert>
              <Button onClick={() => navigate(navigateWithParams(loginHref))} className="w-full">Back to Login</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const title = mode === 'sign-in'
    ? 'Sign in'
    : mode === 'set-password'
      ? 'Set your password'
      : 'Create your account';
  const description = mode === 'sign-in'
    ? `Enter the password for ${email}`
    : mode === 'set-password'
      ? `This account does not have a password yet.`
      : mode === 'create'
        ? `You're signing up with ${email}`
        : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
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
      <div>
        <Card className="relative w-full max-w-md" data-testid="signup-card" data-mode={mode}>
          <AuthBackButton />
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div>
                <img src="/assets/new-saas-logo.png" alt="SAASSuite.AI" className="h-16" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">{title}</CardTitle>
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (mode !== 'email') resetToEmail();
                  }}
                  required
                  placeholder="Enter your email"
                  disabled={mode !== 'email'}
                  className={mode !== 'email' ? 'pr-10 opacity-70' : ''}
                />
                {mode !== 'email' && (
                  <button
                    type="button"
                    onClick={resetToEmail}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Edit email"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>

              {mode === 'set-password' ? (
                <PasswordCodeForm email={email.trim().toLowerCase()} nextPath={nextPath} onSuccess={() => openDestination(false)} />
              ) : (
                <form onSubmit={mode === 'email' ? handleEmailSubmit : mode === 'sign-in' ? handleSignIn : handleSignup} className="space-y-4">
                  {mode !== 'email' && (
                    <div className="space-y-2" style={{ animation: 'slideDown 0.3s ease-out forwards' }}>
                      <Label htmlFor="password">Password</Label>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          required
                          placeholder={mode === 'sign-in' ? 'Enter your password' : 'Create a password (minimum 6 characters)'}
                          minLength={6}
                          autoFocus
                          className="pr-16"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute inset-y-0 right-0 flex items-center gap-1 px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>
                  )}

                  {mode === 'create' && (
                    <div className="flex items-start gap-2">
                      <input
                        id="signup-terms"
                        type="checkbox"
                        required
                        className="mt-1 h-4 w-4 rounded border-input accent-primary"
                      />
                      <label htmlFor="signup-terms" className="text-xs text-muted-foreground">
                        I agree to the{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Terms of Service
                        </a>,{' '}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Privacy Policy
                        </a>,{' '}
                        <a href="/cookies" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Cookie Policy
                        </a>, and{' '}
                        <a href="/refunds" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Refund Policy
                        </a>{' '}(all fees are non-refundable).
                      </label>
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading
                      ? (mode === 'email' ? 'Checking...' : mode === 'sign-in' ? 'Signing in...' : 'Creating Account...')
                      : (mode === 'email' ? 'Continue' : mode === 'sign-in' ? 'Sign in' : 'Create Account')}
                  </Button>

                  {mode === 'sign-in' && (
                    <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={handleForgotPassword}>
                      Forgot password?
                    </Button>
                  )}
                </form>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
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
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

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

              <div className="text-center">
                <Button asChild variant="link" className="text-sm">
                  <a id="signup-login-link" href={loginHref}>Already have an account? Login</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
