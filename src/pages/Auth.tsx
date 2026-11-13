import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMetaPixel } from '@/hooks/useMetaPixel';
import { supabase } from '@/integrations/supabase/client';
import { signupErrorMessage } from '@/lib/signupError';
import { isRetryableSignupError, presentSignupError, retrySignupStep } from '@/lib/signupAttempt';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { fetchAuthAccountState } from '@/lib/authAccount';
import { isKitDeepLink, resetPasswordRedirect } from '@/lib/kitLoginFlow';
import { markSkipOnboarding, readNextPath } from '@/utils/deepLink';
import { PasswordCodeForm } from '@/components/auth/PasswordCodeForm';
import { Eye, EyeOff } from 'lucide-react';
import AuthBackButton from '@/components/AuthBackButton';

const Auth = () => {
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

  useEffect(() => {
    // If the user landed here from a password recovery email (hash contains
    // type=recovery), forward them to /reset-password BEFORE the auth state
    // listener treats this as a normal sign-in and bounces them to /app.
    const hash = window.location.hash || '';
    if (hash.includes('type=recovery') && hash.includes('access_token=')) {
      window.location.replace(`/reset-password${hash}`);
      return;
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
      const next = readNextPath();
      if (isKitDeepLink(next)) markSkipOnboarding();
      navigate(next || '/app');
    }
  }, [user, navigate]);

  const handleEmailCheck = async (emailToCheck: string) => {
    const normalizedEmail = emailToCheck.trim().toLowerCase();
    setEmail(normalizedEmail);
    setLoading(true);
    setError('');

    try {
      // Use the new function to check user approval status by email
      const { data: approvalStatus, error: approvalError } = await supabase.rpc('get_user_approval_by_email', {
        user_email: normalizedEmail
      });

      if (approvalError) {
        setError('Error checking user status. Please try again.');
        setLoading(false);
        return;
      }

      if (!approvalStatus || approvalStatus.length === 0) {
        // No SaaSSuite profile — but an auth user may still exist (ghost account
        // from an interrupted signup). If so, skip registration and let them sign in.
        try {
          const state = await fetchAuthAccountState(normalizedEmail);
          if (state === 'password' || state === 'needs_password') {
            setUserApproval('YES');
            setHasPassword(state === 'password');
            setNeedsCode(state === 'needs_password');
            setStep('password');
            if (state === 'password') {
              toast({ title: "Account exists", description: "This email is already registered. Please sign in." });
            }
            return;
          }
        } catch {}

        // User not found - register as free STARTER user.
        // Pull affiliate from URL/localStorage so /auth signups attribute too.
        const urlParams = new URLSearchParams(window.location.search);
        const affiliateId =
          urlParams.get('ref') ||
          localStorage.getItem('affiliate_id') ||
          localStorage.getItem('affiliate_ref') ||
          null;
        const { error: registerError } = await retrySignupStep(() => supabase.rpc('register_starter_user', {
          user_email: normalizedEmail,
          user_affiliate_id: affiliateId
        }));

        if (registerError) {
          // Registration failed — if the auth user exists, treat as a returning
          // user and send them to sign in instead of dead-ending on an error.
          try {
            const state = await fetchAuthAccountState(normalizedEmail);
            if (state === 'password' || state === 'needs_password') {
              setUserApproval('YES');
              setHasPassword(state === 'password');
              setNeedsCode(state === 'needs_password');
              setStep('password');
              if (state === 'password') {
                toast({ title: "Account exists", description: "This email is already registered. Please sign in." });
              }
              return;
            }
          } catch {}
          setError(signupErrorMessage(registerError));
          return;
        }

        // Persist UTM / referrer / landing page attribution onto the user row
        try {
          const { persistAttribution } = await import('@/utils/fbAttribution');
          await persistAttribution(normalizedEmail);
        } catch {}
        
        setUserApproval('YES');
        setHasPassword(false);
        setStep('password');
      } else {
        const userStatus = approvalStatus[0];
        setUserApproval(userStatus.approval);
        
        if (userStatus.approval !== 'NO') {
          // Set whether they have an auth account (password status)
          setHasPassword(userStatus.has_auth_account);
          
          // Update user access timestamp if they have an auth account
          if (userStatus.has_auth_account) {
            await supabase.rpc('update_user_access', {
              user_email: normalizedEmail
            });
          }
          
          setStep('password');
        } else {
          setStep('not-approved');
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleEmailCheck(email.trim().toLowerCase());
  };

  const handleCreatePassword = async () => {
    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const redirectUrl = `${window.location.origin}/auth?email=${encodeURIComponent(normalizedEmail)}`;
      
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
        // Auto-login after password creation
        setUser(normalizedEmail, data.user.id, userApproval);
        navigate('/app');
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
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
        // Check if user has admin invitations - if so, route to account selector
        const { data: adminInvites } = await supabase
          .from('account_admins')
          .select('id')
          .ilike('admin_email', normalizedEmail)
          .in('status', ['accepted', 'pending'])
          .limit(1);

        // Use the already fetched user approval status
        setUser(normalizedEmail, data.user.id, userApproval);
        
        // Update last accessed
        await supabase.rpc('update_user_access', {
          user_email: normalizedEmail
        });
        void supabase.rpc('record_user_login', { user_email: normalizedEmail });

        if (adminInvites && adminInvites.length > 0) {
          navigate('/account-selector');
        } else {
          const next = readNextPath();
          if (isKitDeepLink(next)) markSkipOnboarding();
          navigate(next || '/app');
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
      <Card className="relative w-full max-w-md">
        <AuthBackButton />
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to SAASSuite.AI</CardTitle>
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
                  onSuccess={() => {
                    const next = readNextPath();
                    if (isKitDeepLink(next)) markSkipOnboarding();
                    navigate(next || '/app');
                  }}
                />
              ) : (
                // Profile exists, but there is no auth user yet.
                <div className="space-y-4">
                  {emailConfirmed ? (
                    <Alert>
                      <AlertDescription>
                        Email confirmed! You can now log in with your password.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert>
                      <AlertDescription>
                        Welcome! You need to create a password to access your account.
                      </AlertDescription>
                    </Alert>
                  )}
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

export default Auth;
