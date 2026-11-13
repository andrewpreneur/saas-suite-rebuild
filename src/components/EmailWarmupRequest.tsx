import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag } from "@/components/ui/tag";
import { Banner } from "@/components/ui/banner";
import { Progress } from "@/components/ui/progress";
import { SectionCard } from "@/components/premium/SectionCard";
import { Field, SectionFooter } from "@/components/premium/settings/Field";
import { CircleHelp, ClipboardCopy, FileText, Mail, CheckCircle2, Clock, Rocket } from "lucide-react";
import { SettingItem, SettingList } from "@/components/premium/SettingList";
import { StatStrip } from "@/components/premium/StatStrip";
import { HowItWorksDialog } from "@/components/premium/grow/HowItWorksDialog";
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
  const [howOpen, setHowOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

      toast.success("Warmup request submitted");
      
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
        <Tag tone="success">
          <CheckCircle2 aria-hidden="true" />
          Complete
        </Tag>
      );
    }
    const status = request.status.toLowerCase();
    return (
      <Tag tone={status === "sent" ? "info" : status === "in progress" ? "warning" : "neutral"} className="capitalize">
        <Clock aria-hidden="true" />
        {request.status}
      </Tag>
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

  const ADMIN_EMAIL = "admin@howtousehighlevel.com";
  const header = (
    <>
      <PageHeader
        eyebrow="Grow"
        title="Email warmup"
        subtitle="Ask SaaSSuite to warm a sending domain. It takes about four weeks."
        more={[
          { label: "How this works", icon: <CircleHelp />, onSelect: () => setHowOpen(true) },
          {
            label: "Copy admin email",
            icon: <ClipboardCopy />,
            onSelect: () => {
              void navigator.clipboard.writeText(ADMIN_EMAIL);
              toast.success("Admin email copied");
            },
          },
          ...(recentRequests.length > 0
            ? [{ label: "Recent submissions", icon: <Clock />, onSelect: () => setHistoryOpen(true) }]
            : []),
        ]}
      />
      <HowItWorksDialog
        open={howOpen}
        onOpenChange={setHowOpen}
        title="How email warmup works"
        intro="Warming builds the sending reputation that keeps you out of spam."
        steps={[
          { title: "Set up a dedicated sending domain", detail: "Add it in GoHighLevel and use an address on that domain as the sender email." },
          {
            title: "Add our admin to your subaccount",
            detail: (
              <>
                Add <span className="break-all font-mono">{ADMIN_EMAIL}</span> as an admin. Our team will import our custom list
                of contacts, email them and only them, and we will not interact with any other parts of the subaccount.
              </>
            ),
          },
          { title: "Send the request", detail: "Agency name, sender name, sender email and a square profile image link." },
          { title: "Wait about four weeks", detail: "Nothing else is needed from you. This page shows the days remaining." },
        ]}
      />
    </>
  );
  const historyList = (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {recentRequests.slice(0, 5).map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{r.sender_email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleDateString()} · {r.agency_name}
            </p>
          </div>
          {getStatusBadge(r)}
        </li>
      ))}
    </ul>
  );
  const historyCard =
    recentRequests.length > 0 ? (
      <SettingList>
        <SettingItem
          icon={<Clock />}
          title="Recent submissions"
          value={`Latest: ${recentRequests[0].sender_email}`}
          status={`${Math.min(5, recentRequests.length)} shown`}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          panel={{ description: "Your last five warmup requests." }}
          testId="warmup-history-row"
        >
          {historyList}
        </SettingItem>
      </SettingList>
    ) : null;

  // Users with a credit wallet can always submit additional requests,
  // so we skip the "in progress" lockout and show the form below the history.
  if (credits === 0 && existingRequest && (existingRequest.status === 'sent' || existingRequest.status === 'in progress')) {
    const completed = isWarmupComplete(existingRequest);
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
        {header}
        {renderInProgress(existingRequest, completed)}
      </div>
    );
  }

  if (credits === 0 && existingRequest && existingRequest.status === 'complete') {
    return (
      <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
        {header}
      <SectionCard
        icon={<Rocket />}
        title="Email warmup complete"
        description="Your domain has been warmed up."
        actions={<Tag tone="success"><CheckCircle2 aria-hidden="true" />Complete</Tag>}
      >
        <Banner tone="success" title="Warmed domain:">
          <span className="break-all font-mono">{existingRequest.warmed_domain || existingRequest.sender_email}</span>
        </Banner>
        <p className="mt-4 text-sm text-muted-foreground">
          Your sending reputation is established. You can now send from this domain with confidence.
        </p>
      </SectionCard>
      </div>
    );
  }

  function renderInProgress(existingRequest: WarmupRequest, completed: boolean) {
    
    const daysLeft = getDaysRemaining(existingRequest);
    return (
      <SectionCard
        icon={completed ? <Rocket /> : <Mail />}
        title={completed ? "Email warmup complete" : "Warmup in progress"}
        description={
          completed
            ? "Your email warmup is complete. You're ready to send."
            : "We are warming your sending domain. Nothing else is needed from you."
        }
        actions={getStatusBadge(existingRequest)}
      >
        <div className="space-y-4">
          {completed ? (
            <Banner tone="success" title="Your email warmup is complete.">
              You're ready to start sending emails and get guaranteed inbox placement from your GoHighLevel account.
              Your sending reputation has been established, so you can start your outreach campaigns with confidence.
            </Banner>
          ) : (
            <div className="px-brand-wash rounded-lg p-4">
              <div className="mb-2 flex items-end justify-between gap-3">
                <p className="text-sm text-foreground">
                  About <strong className="text-h4 tabular-nums">{daysLeft}</strong> days remaining
                </p>
                <span className="text-xs tabular-nums text-muted-foreground">Day {28 - daysLeft} of 28</span>
              </div>
              <Progress
                value={Math.min(100, ((28 - daysLeft) / 28) * 100)}
                aria-label={`Warmup progress: day ${28 - daysLeft} of 28`}
                className="bg-card"
              />
            </div>
          )}
          <SettingList>
            <SettingItem
              icon={<FileText />}
              title="Request details"
              value={`${existingRequest.sender_email} · ${existingRequest.agency_name}`}
              panel={{ description: "What you sent us for this warmup." }}
              testId="warmup-details-row"
            >
          <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Agency name</dt>
              <dd className="truncate text-sm font-medium text-foreground">{existingRequest.agency_name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Sender name</dt>
              <dd className="truncate text-sm font-medium text-foreground">{existingRequest.sender_name}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Sender email</dt>
              <dd className="break-all text-sm font-medium text-foreground">{existingRequest.sender_email}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Submitted on</dt>
              <dd className="text-sm font-medium text-foreground">
                {new Date(existingRequest.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </dd>
            </div>
          </dl>
            </SettingItem>
          </SettingList>
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
        {header}
    {credits > 0 && (
      <StatStrip
        stats={[
          { label: "Warmup credits", value: credits, hint: "one per submission" },
          { label: "Submissions", value: recentRequests.length },
          { label: "Warming now", value: recentRequests.filter((r) => !isWarmupComplete(r)).length },
        ]}
      />
    )}
    {credits > 0 && historyCard}
    <section className="px-surface p-4 sm:p-6" aria-label="Request a warmup">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Agency name" htmlFor="agency-name">
            <Input
              id="agency-name"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Your agency name"
              autoComplete="organization"
              required
            />
          </Field>
          <Field label="Sender name" htmlFor="sender-name">
            <Input
              id="sender-name"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="John Doe"
              autoComplete="name"
              required
            />
          </Field>
          <Field
            label="Sender email"
            htmlFor="sender-email"
            hint="Use an address on your dedicated sending domain."
          >
            <Input
              id="sender-email"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="name@mail.yourdomain.com"
              required
            />
          </Field>
          <Field label="Profile image link" htmlFor="profile-image" hint="A square (1x1) image URL.">
            <Input
              id="profile-image"
              type="url"
              value={profileImageLink}
              onChange={(e) => setProfileImageLink(e.target.value)}
              placeholder="https://example.com/profile.jpg"
              required
            />
          </Field>
        </div>

        <Banner tone="warning" title="Before you submit:">
          add <span className="break-all font-mono">{ADMIN_EMAIL}</span> to your subaccount as an admin.
        </Banner>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-foreground">Confirm both to continue</legend>
          <label
            htmlFor="confirmed-domain"
            className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand-subtle"
          >
            <Checkbox
              id="confirmed-domain"
              className="mt-0.5"
              checked={confirmedDomain}
              onCheckedChange={(checked) => setConfirmedDomain(!!checked)}
              required
            />
            <span className="text-sm leading-relaxed text-foreground">
              I confirm I have added the above email as a dedicated sending domain in GHL
            </span>
          </label>
          <label
            htmlFor="confirmed-admin"
            className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40 has-[[data-state=checked]]:border-brand has-[[data-state=checked]]:bg-brand-subtle"
          >
            <Checkbox
              id="confirmed-admin"
              className="mt-0.5"
              checked={confirmedAdmin}
              onCheckedChange={(checked) => setConfirmedAdmin(!!checked)}
              required
            />
            <span className="text-sm leading-relaxed text-foreground">
              I confirm that I have added the above email to my agency to request my warmup
            </span>
          </label>
        </fieldset>

        <SectionFooter
          note={!confirmedDomain || !confirmedAdmin ? "Tick both confirmations to submit your request." : undefined}
        >
          <Button type="submit" variant="accent" disabled={isSaving || !confirmedDomain || !confirmedAdmin}>
            {isSaving ? "Submitting..." : "Submit warmup request"}
          </Button>
        </SectionFooter>
      </form>
    </section>
    </div>
  );
};

export default EmailWarmupRequest;
