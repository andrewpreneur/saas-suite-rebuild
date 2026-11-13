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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff } from 'lucide-react';
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
    // Redirect if already logged in and approved
    if (user) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
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
      <Card className="relative w-full max-w-md">
        <AuthBackButton />
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>
            {step === 'email' && 'Enter your email to login'}
            {step === 'password' && 'Enter your password to continue'}
            {step === 'not-approved' && 'Access Required'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Checking...' : 'Continue'}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or
                  </span>
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
                  const message = await signInWithStoreProvider('google', readNextPath() || navigateWithParams('/app'), () => setLoading(false));
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
                Sign in with Google
              </Button>

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
              
              <div className="text-center">
                <Button 
                  type="button" 
                  variant="link" 
                  onClick={() => navigate(navigateWithParams('/signup'))}
                  className="text-sm"
                >
                  Don't have an account? Sign up
                </Button>
              </div>
            </form>
          )}

          {step === 'password' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-display">Email</Label>
                <Input
                  id="email-display"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              {hasPassword ? (
                // User has password - show login form
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Enter your password"
                        minLength={6}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {emailConfirmed && (
                    <Alert>
                      <AlertDescription>
                        Email confirmed! You can now log in with your password.
                      </AlertDescription>
                    </Alert>
                  )}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Logging in...' : 'Login'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={handleForgotPassword}
                    disabled={loading}
                    className="w-full"
                  >
                    Forgot Password?
                  </Button>
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
                  <Alert>
                    <AlertDescription>
                      Welcome back! Create a password to complete your account setup.
                    </AlertDescription>
                  </Alert>
                  <div className="space-y-2">
                    <Label htmlFor="password">Create Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="Create a new password (minimum 6 characters)"
                        minLength={6}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <Button 
                    type="button" 
                    onClick={handleCreatePassword}
                    disabled={loading || !password || password.length < 6}
                    className="w-full"
                  >
                    {loading ? 'Creating Password...' : 'Create Password'}
                  </Button>
                </div>
              )}
              
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setStep('email')}
                className="w-full"
              >
                ← Back to Email
              </Button>
            </div>
          )}

          {step === 'not-approved' && (
            <div className="space-y-4 text-center">
              <div className="space-y-2">
                <Label htmlFor="email-display">Email</Label>
                <Input
                  id="email-display"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <Alert variant="destructive">
                <AlertDescription>
                  Your trial has ended or access has been revoked. Please upgrade to continue using SAASSuite.AI.
                </AlertDescription>
              </Alert>
              
              <Button 
                type="button"
                onClick={() => window.open('https://saassuite.ai/pricing', '_blank')}
                className="w-full"
              >
                Upgrade Now
              </Button>
              
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setStep('email')}
                className="w-full"
              >
                ← Back to Email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;