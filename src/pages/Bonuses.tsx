import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { navigateWithParams } from '@/utils/preserveParams';
import { supabase } from '@/integrations/supabase/client';
import { signInWithStoreProvider } from '@/lib/nativeOAuth';
import LandingPage from '@/components/LandingPage';
import SEO from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle, Sparkles, Laptop, Palette, Video } from 'lucide-react';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const formatPhoneE164 = (raw: string): string => {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  // Try parsing as-is (handles +44..., +52..., etc.)
  const parsed = parsePhoneNumberFromString(trimmed);
  if (parsed && parsed.isValid()) return parsed.number;
  // Fallback: assume US if no country code
  const us = parsePhoneNumberFromString(trimmed, 'US');
  if (us && us.isValid()) return us.number;
  // Last resort: strip non-digits and prepend +1 if it looks like a US 10-digit
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return trimmed.startsWith('+') ? trimmed : `+${digits}`;
};

const Bonuses = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false);
  const [googleName, setGoogleName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googlePhone, setGooglePhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fireBonusesWebhook = async (payload: { email: string; full_name: string; phone: string; signup_method: 'email' | 'google' }) => {
    try {
      await fetch('https://services.leadconnectorhq.com/hooks/T69cI1milcirIORef4Ib/webhook-trigger/ab67f5f0-91b7-4d55-a885-021031a1e24d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, source: 'bonuses-dallas', submitted_at: new Date().toISOString() }),
      });
    } catch (e) {
      console.error('Bonuses webhook failed', e);
    }
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes scaleInBounce {
        0% { transform: scale(0); opacity: 0; }
        60% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const handleEmailSubmit = async ({
    email,
    name,
    phone,
  }: {
    email: string;
    name: string;
    phone: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const cleanedEmail = email.trim().toLowerCase();
      const { error: registerError } = await supabase.rpc('register_bonuses_user', {
        user_email: cleanedEmail,
        user_affiliate_id: null,
        user_full_name: name,
        user_phone: phone,
      });
      if (registerError) throw new Error('Error claiming your bonuses. Please try again.');
      setConfirmedEmail(cleanedEmail);
      setSuccess(true);
      fireBonusesWebhook({ email: cleanedEmail, full_name: name, phone: formatPhoneE164(phone), signup_method: 'email' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    sessionStorage.setItem('bonuses_signup', 'true');
    const message = await signInWithStoreProvider('google', '/bonuses?google=1', () => setLoading(false));
    if (message) {
      setError(message);
      setLoading(false);
    }
  };

  // Finalize after Google OAuth returns
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') !== '1') return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email;
      if (!userEmail) return;
      const meta = (session?.user?.user_metadata || {}) as Record<string, any>;
      const nameFromGoogle =
        meta.full_name || meta.name ||
        [meta.given_name, meta.family_name].filter(Boolean).join(' ') ||
        '';
      sessionStorage.removeItem('bonuses_signup');
      setGoogleEmail(userEmail);
      setGoogleName(nameFromGoogle);
      setPhoneDialogOpen(true);
    })();
  }, []);

  const handleGooglePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    if (!googleName.trim() || !googlePhone.trim()) {
      setPhoneError('Please enter your name and phone number.');
      return;
    }
    setLoading(true);
    try {
      const { error: registerError } = await supabase.rpc('register_bonuses_user', {
        user_email: googleEmail.toLowerCase(),
        user_affiliate_id: null,
        user_full_name: googleName.trim(),
        user_phone: googlePhone.trim(),
      });
      if (registerError) throw new Error('Error claiming your bonuses. Please try again.');
      setConfirmedEmail(googleEmail);
      setPhoneDialogOpen(false);
      setSuccess(true);
      fireBonusesWebhook({
        email: googleEmail.toLowerCase(),
        full_name: googleName.trim(),
        phone: formatPhoneE164(googlePhone),
        signup_method: 'google',
      });
    } catch (err: any) {
      setPhoneError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Claim Your SaaSSuite Bonuses — Dallas GHL Chapter"
        description="Free SaaSSuite BASIC account + next week's exclusive webinar for Dallas GoHighLevel chapter attendees."
      />
      <LandingPage
        bonusesMode
        bonusesLoading={loading}
        bonusesError={error}
        onBonusesEmailSubmit={handleEmailSubmit}
        onBonusesGoogle={handleGoogle}
      />

      {success && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-xl border-primary/20 shadow-2xl my-4 sm:my-8">
            <CardHeader className="text-center space-y-4">
              <div
                className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center"
                style={{ animation: 'scaleInBounce 0.6s ease-out forwards' }}
              >
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <CardTitle className="text-3xl font-bold">You're In! 🎉</CardTitle>
              <CardDescription className="text-base">
                Your free <span className="font-semibold text-foreground">SaaSSuite BASIC</span> account is officially live for{' '}
                <span className="font-semibold text-foreground">{confirmedEmail}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border bg-card p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <Video className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Your webinar invite is on the way</p>
                    <p className="text-sm text-muted-foreground">Check your inbox over the next few days for the invite to next week's training.</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <Laptop className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Finish setup on your laptop tonight</p>
                    <p className="text-sm text-muted-foreground">When you get home, log in at <span className="font-mono">saassuite.ai/login</span> with this email and complete your onboarding.</p>
                  </div>
                </div>
                <Separator />
                <div className="flex items-start gap-3">
                  <Palette className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">White‑label your GHL account in under 10 minutes</p>
                    <p className="text-sm text-muted-foreground">You'll add full white‑labeled branding to your HighLevel account and stand up your video onboarding system — even without the $497 plan.</p>
                  </div>
                </div>
              </div>

              <Alert className="border-primary/30 bg-primary/5">
                <Sparkles className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Save this for tonight: <strong>saassuite.ai/login</strong> — same email, no password needed yet.
                </AlertDescription>
              </Alert>

              <Button
                onClick={() => navigate(navigateWithParams('/login'))}
                className="w-full"
                size="lg"
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={phoneDialogOpen} onOpenChange={setPhoneDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>One more step</DialogTitle>
            <DialogDescription>
              Confirm your details so we can send you the webinar invite and your bonuses.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGooglePhoneSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-name">Full name</Label>
              <Input
                id="g-name"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                placeholder="Your full name"
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-email">Email</Label>
              <Input id="g-email" type="email" value={googleEmail} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-phone">Phone number</Label>
              <Input
                id="g-phone"
                type="tel"
                value={googlePhone}
                onChange={(e) => setGooglePhone(e.target.value)}
                placeholder="(555) 555-5555"
                required
                maxLength={30}
              />
            </div>
            {phoneError && (
              <Alert variant="destructive">
                <AlertDescription>{phoneError}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Claiming...' : 'Claim My Bonuses'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Bonuses;