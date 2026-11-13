import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Mail, CheckCircle2, Clock, Rocket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { PageHeader } from "@/components/platform/PageHeader";
import { LoadNotice } from "@/components/platform/LoadNotice";
import { LOAD_TIMEOUT_MESSAGE, armLoadDeadline, loadErrorText } from "@/lib/loadSettle";

interface WarmupRequest {
  id: string;
  agency_name: string;
  sender_name: string;
  sender_email: string;
  profile_image_link: string;
  status: string;
  created_at: string;
  warmed_domain?: string | null;
}

const EmailWarmupRequest = () => {
  const { email } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [existingRequest, setExistingRequest] = useState<WarmupRequest | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [recentRequests, setRecentRequests] = useState<WarmupRequest[]>([]);
  
  // Form state
  const [agencyName, setAgencyName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [profileImageLink, setProfileImageLink] = useState("");
  const [confirmedDomain, setConfirmedDomain] = useState(false);
  const [confirmedAdmin, setConfirmedAdmin] = useState(false);

  useEffect(() => {
    loadExistingRequest();
  }, [email, loadAttempt]);

  const loadExistingRequest = async () => {
    if (!email) {
      setIsLoading(false);
      setLoadError(null);
      return;
    }
    const stop = armLoadDeadline(() => {
      setIsLoading(false);
      setLoadError(LOAD_TIMEOUT_MESSAGE);
    });

    try {
      const { data: userRow } = await supabase
        .from('saas_suite_users')
        .select('email_warmup_credits')
        .ilike('email', email)
        .maybeSingle();
      setCredits(((userRow as { email_warmup_credits?: number } | null)?.email_warmup_credits) ?? 0);

      const { data: list, error } = await supabase
        .from('email_warmup_requests')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading warmup request:', error);
      } else if (list && list.length > 0) {
        setExistingRequest(list[0] as WarmupRequest);
        setRecentRequests(list as WarmupRequest[]);
      }
      setLoadError(null);
    } catch (error) {
      console.error('Error loading warmup request:', error);
      setLoadError(loadErrorText(error, "Couldn't load email warmup."));
    } finally {
      stop();
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!confirmedDomain || !confirmedAdmin) {
      toast.error("Please confirm both checkboxes before submitting");
      return;
    }

    if (!email) {
      toast.error("User email not found");
      return;
    }

    setIsSaving(true);

    try {
      // Wallet flow: if user has credits, submit via edge function which
      // decrements credits + fires the webhook. Otherwise fall back to
      // legacy single-request insert.
      if (credits > 0) {
        const { data, error } = await supabase.functions.invoke('submit-email-warmup', {
          body: {
            agency_name: agencyName,
            sender_name: senderName,
            sender_email: senderEmail,
            profile_image_link: profileImageLink,
          },
        });
        if (error || (data as { error?: string } | null)?.error) {
          const msg = (data as { error?: string } | null)?.error || error?.message || 'Failed to submit';
          toast.error(msg);
          return;
        }
      } else {
        const { error } = await supabase
          .from('email_warmup_requests')
          .insert({
            user_email: email,
            agency_name: agencyName,
            sender_name: senderName,
            sender_email: senderEmail,
            profile_image_link: profileImageLink,
            status: 'sent'
          });

        if (error) {
          console.error('Error submitting warmup request:', error);
          toast.error("Failed to submit warmup request");
          return;
        }
      }

      toast.success("Warmup request submitted successfully!");
      
      // Clear form
      setAgencyName("");
      setSenderName("");
      setSenderEmail("");
      setProfileImageLink("");
      setConfirmedDomain(false);
      setConfirmedAdmin(false);
      
      // Reload to show the submitted request
      await loadExistingRequest();
    } catch (error) {
      console.error('Error submitting warmup request:', error);
      toast.error("Failed to submit warmup request");
    } finally {
      setIsSaving(false);
    }
  };

  const isWarmupComplete = (request: WarmupRequest) => {
    const submittedDate = new Date(request.created_at);
    const fourWeeksLater = new Date(submittedDate.getTime() + 28 * 24 * 60 * 60 * 1000);
    return new Date() >= fourWeeksLater;
  };

  const getStatusBadge = (request: WarmupRequest) => {
    if (isWarmupComplete(request)) {
      return (
        <Badge className="bg-green-100 text-green-800">
          Complete
        </Badge>
      );
    }

    const statusColors: { [key: string]: string } = {
      'sent': 'bg-blue-100 text-blue-800',
      'in progress': 'bg-yellow-100 text-yellow-800',
    };

    return (
      <Badge className={statusColors[request.status.toLowerCase()] || 'bg-gray-100 text-gray-800'}>
        {request.status}
      </Badge>
    );
  };

  const getDaysRemaining = (request: WarmupRequest) => {
    const submittedDate = new Date(request.created_at);
    const fourWeeksLater = new Date(submittedDate.getTime() + 28 * 24 * 60 * 60 * 1000);
    const remaining = Math.ceil((fourWeeksLater.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, remaining);
  };

  if (loadError || isLoading) {
    return (
      <LoadNotice
        loading={isLoading}
        error={loadError}
        label="Loading email warmup…"
        onRetry={() => setLoadAttempt((attempt) => attempt + 1)}
      />
    );
  }

  // Users with a credit wallet can always submit additional requests,
  // so we skip the "in progress" lockout and show the form below the history.
  if (credits === 0 && existingRequest && (existingRequest.status === 'sent' || existingRequest.status === 'in progress')) {
    const completed = isWarmupComplete(existingRequest);
    return (
      <div className="space-y-4">
        <PageHeader
          title="Email warmup"
          subtitle="Ask SaaSSuite to warm a sending domain before you email your clients."
        />
        {renderInProgress(existingRequest, completed)}
      </div>
    );
  }

  if (credits === 0 && existingRequest && existingRequest.status === 'complete') {
    return (
      <div className="space-y-4">
      <PageHeader
        title="Email warmup"
        subtitle="Ask SaaSSuite to warm a sending domain before you email your clients."
      />
      <Card className="shadow-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Rocket className="w-5 h-5 text-green-600" />
              <CardTitle>Email Warmup Complete</CardTitle>
            </div>
            <Badge className="bg-green-100 text-green-800">Complete</Badge>
          </div>
          <CardDescription>Your domain has been successfully warmed up</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">Warmed Domain</p>
                <p className="text-base font-mono text-green-900">{existingRequest.warmed_domain || existingRequest.sender_email}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Your sending reputation is established — you can now send from this domain with confidence.
          </p>
        </CardContent>
      </Card>
      </div>
    );
  }

  function renderInProgress(existingRequest: WarmupRequest, completed: boolean) {
    
    return (
      <Card className="shadow-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {completed ? <Rocket className="w-5 h-5 text-green-600" /> : <Mail className="w-5 h-5 text-primary" />}
              <CardTitle>Email Warmup {completed ? "Complete" : "Request"}</CardTitle>
            </div>
            {getStatusBadge(existingRequest)}
          </div>
          <CardDescription>
            {completed 
              ? "Your email warmup is complete — you're ready to send!" 
              : "Your warmup request is being processed"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div className="flex items-start space-x-2">
              <Clock className="w-4 h-4 mt-1 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Submitted on</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(existingRequest.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-muted-foreground">Agency Name</p>
                <p className="text-sm font-medium">{existingRequest.agency_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sender Name</p>
                <p className="text-sm font-medium">{existingRequest.sender_name}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-muted-foreground">Sender Email</p>
                <p className="text-sm font-medium">{existingRequest.sender_email}</p>
              </div>
            </div>
          </div>
          
          {completed ? (
            <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-900">Your email warmup is complete! 🎉</p>
                <p className="text-sm text-green-800 mt-1">
                  You're now ready to start sending emails and get guaranteed inbox placement from your GoHighLevel account. 
                  Your sending reputation has been established — go ahead and start your outreach campaigns with confidence!
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <p className="text-sm text-blue-900">
                  Your warmup is in progress. Approximately <strong>{getDaysRemaining(existingRequest)} days</strong> remaining until completion.
                </p>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((28 - getDaysRemaining(existingRequest)) / 28) * 100)}%` }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
    <PageHeader
      title="Email warmup"
      subtitle="Ask SaaSSuite to warm a sending domain before you email your clients."
    />
    {credits > 0 && (
      <Card className="shadow-card border-border bg-primary/5">
        <CardContent className="py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">Warmup Wallet</p>
              <p className="text-xs text-muted-foreground">Each submission uses one credit</p>
            </div>
          </div>
          <Badge className="bg-primary text-primary-foreground text-base px-3 py-1">
            {credits} credit{credits === 1 ? '' : 's'} remaining
          </Badge>
        </CardContent>
      </Card>
    )}
    {credits > 0 && recentRequests.length > 0 && (
      <Card className="shadow-card border-border">
        <CardHeader>
          <CardTitle className="text-base">Recent submissions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentRequests.slice(0, 5).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2 last:pb-0">
              <div>
                <p className="font-medium">{r.sender_email}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()} — {r.agency_name}
                </p>
              </div>
              {getStatusBadge(r)}
            </div>
          ))}
        </CardContent>
      </Card>
    )}
    <Card className="shadow-card border-border">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Mail className="w-5 h-5 text-primary" />
          <CardTitle>Email Warmup Request</CardTitle>
        </div>
        <CardDescription>
          Submit a request to warm up your email for better deliverability
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="agency-name">Agency Name</Label>
              <Input
                id="agency-name"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="Your Agency Name"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="sender-name">Sender Name</Label>
              <Input
                id="sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="John Doe"
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="sender-email">Sender Email</Label>
            <Input
              id="sender-email"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="name@mail.yourdomain.com"
              required
            />
          </div>

          <div className="flex items-start space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="confirmed-domain"
              checked={confirmedDomain}
              onCheckedChange={(checked) => setConfirmedDomain(!!checked)}
              required
            />
            <Label htmlFor="confirmed-domain" className="text-sm leading-relaxed cursor-pointer">
              I confirm I have added the above email as a dedicated sending domain in GHL
            </Label>
          </div>

          <div>
            <Label htmlFor="profile-image">1x1 Profile Image Link</Label>
            <Input
              id="profile-image"
              type="url"
              value={profileImageLink}
              onChange={(e) => setProfileImageLink(e.target.value)}
              placeholder="https://example.com/profile.jpg"
              required
            />
          </div>

          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
            <p className="text-sm text-yellow-900">
              <strong>Note:</strong> Add admin@howtousehighlevel.com to your subaccount as an admin before submitting
            </p>
            <p className="text-xs text-yellow-800">
              Our team will import our custom list of contacts, email them and only them, and we will not interact with any other parts of the subaccount.
            </p>
          </div>

          <div className="flex items-start space-x-2 p-3 bg-muted rounded-lg">
            <Checkbox
              id="confirmed-admin"
              checked={confirmedAdmin}
              onCheckedChange={(checked) => setConfirmedAdmin(!!checked)}
              required
            />
            <Label htmlFor="confirmed-admin" className="text-sm leading-relaxed cursor-pointer">
              I confirm that I have added the above email to my agency to request my warmup
            </Label>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSaving || !confirmedDomain || !confirmedAdmin}
          >
            {isSaving ? "Submitting..." : "Submit Warmup Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
    </div>
  );
};

export default EmailWarmupRequest;
