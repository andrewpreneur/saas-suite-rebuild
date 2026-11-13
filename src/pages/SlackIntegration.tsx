import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MoreMenu, type MoreMenuItem } from "@/components/premium/MoreMenu";
import { Disclosure, StatusRow } from "@/components/premium/settings/Page";
import { ArrowLeft, ArrowRight, ExternalLink, RefreshCw, Workflow } from "lucide-react";
import { toast } from "sonner";
import slackLogoAsset from "@/assets/slack-logo.webp.asset.json";
import { useUser } from "@/contexts/UserContext";

const SLACK_LOGO = slackLogoAsset.url;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const INSTALL_ENDPOINT = `${SUPABASE_URL}/functions/v1/slack-install`;

type Slide = {
  title: string;
  cmd?: string;
  subhead: string;
  workflow?: boolean;
};

const SLIDES: Slide[] = [
  { title: "Support Status", cmd: "/support-status <email>", subhead: "See a customer's support status at a glance." },
  { title: "User Info", cmd: "/user-info <email>", subhead: "Pull up a customer's activity and engagement." },
  { title: "Ticket Status", cmd: "/ticket-status <email>", subhead: "Review a customer's most recent support tickets." },
  { title: "Report", cmd: "/report", subhead: "Get an agency-wide summary of activity and health." },
  { title: "CoPilot", cmd: "/copilot <question>", subhead: "Ask your AI CoPilot anything, straight from Slack." },
  { title: "Workflows", subhead: "Setup workflows to go to Slack alongside webhooks inside of SaaSSuite.", workflow: true },
];

type SlackInstallRow = {
  agency_id: string;
  team_domain: string | null;
};

function SuccessView({ teamId }: { teamId: string | null }) {
  const navigate = useNavigate();
  const iconRef = useRef<HTMLDivElement>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    const fire = () => {
      const el = iconRef.current;
      const rect = el?.getBoundingClientRect();
      const origin = rect
        ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
        : { x: 0.5, y: 0.35 };
      confetti({ particleCount: 120, spread: 90, startVelocity: 45, origin, scalar: 1.1 });
      setTimeout(() => confetti({ particleCount: 80, spread: 120, origin, scalar: 0.9 }), 250);
      setTimeout(() => confetti({ particleCount: 60, spread: 160, origin, scalar: 0.8 }), 550);
    };
    const t = setTimeout(fire, 200);
    return () => clearTimeout(t);
  }, []);

  const openSlack = () => {
    const deepLink = teamId ? `slack://open?team=${encodeURIComponent(teamId)}` : "slack://open";
    const webFallback = teamId
      ? `https://app.slack.com/client/${encodeURIComponent(teamId)}`
      : "https://slack.com/signin";
    const start = Date.now();
    window.location.href = deepLink;
    setTimeout(() => {
      if (Date.now() - start < 1600 && document.visibilityState === "visible") {
        window.open(webFallback, "_blank", "noopener,noreferrer");
      }
    }, 1200);
  };

  const slide = SLIDES[slideIdx];
  const goPrev = () => setSlideIdx((i) => Math.max(0, i - 1));
  const goNext = () => setSlideIdx((i) => Math.min(SLIDES.length - 1, i + 1));

  return (
    <div className="px-canvas flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl space-y-8 text-center">
        <div ref={iconRef} className="mx-auto flex h-24 w-24 items-center justify-center animate-scale-in">
          <img src={SLACK_LOGO} alt="Slack" className="h-20 w-20" />
        </div>

        <div className="space-y-2 animate-fade-in">
          <h1 className="text-h3 tracking-tight text-foreground sm:text-h2">Slack is connected</h1>
          <p className="text-muted-foreground">
            Your SaaSSuite workspace is live in Slack. Swipe through what you can do:
          </p>
        </div>

        <div className="px-surface overflow-hidden">
          <div
            key={slideIdx}
            className="flex min-h-[240px] flex-col items-center justify-center gap-4 p-6 animate-fade-in motion-reduce:animate-none sm:p-8"
          >
            {slide.workflow ? (
              <span className="px-icon-chip [&_svg]:size-5" aria-hidden="true">
                <Workflow />
              </span>
            ) : null}
            <h2 className="text-h4 text-foreground">{slide.title}</h2>
            {slide.cmd && (
              <code className="rounded-md bg-brand-subtle px-3 py-1.5 font-mono text-sm text-brand">
                {slide.cmd}
              </code>
            )}
            <p className="text-sm text-muted-foreground max-w-md">{slide.subhead}</p>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <Button variant="ghost" size="icon" aria-label="Previous slide" onClick={goPrev} disabled={slideIdx === 0}>
              <ArrowLeft />
            </Button>
            <div className="flex items-center gap-1.5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setSlideIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === slideIdx ? "w-6 bg-brand" : "w-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
            <Button variant="ghost" size="icon" aria-label="Next slide" onClick={goNext} disabled={slideIdx === SLIDES.length - 1}>
              <ArrowRight />
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2 animate-fade-in">
          <Button size="lg" variant="accent" onClick={openSlack}>
            <img src={SLACK_LOGO} alt="" className="h-5 w-5" />
            Open Slack
            <ExternalLink className="h-4 w-4 opacity-70" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/app")}>
            <ArrowLeft className="h-4 w-4" />
            Back to SaaSSuite
          </Button>
        </div>
      </div>
    </div>
  );
}

type InstallViewProps = {
  /** Reports the connection once it is known, so a list row can show it. */
  onStatus?: (status: { connected: boolean; name?: string | null }) => void;
  /** Extra entries for the page's "..." menu. */
  moreItems?: MoreMenuItem[];
  /** Rendered between the connection status and the list of slash commands. */
  children?: ReactNode;
};

function InstallView({ onStatus, moreItems = [], children }: InstallViewProps) {
  const { email: effectiveEmail } = useUser();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState<string>("");
  const [connectedInstall, setConnectedInstall] = useState<{ teamDomain?: string | null; agencyId?: string | null } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const lookupEmail = (effectiveEmail || user?.email || "").trim().toLowerCase();
      if (lookupEmail) {
        setUserEmail(lookupEmail);
        const { data: profile } = await supabase
          .from("saas_suite_users")
          .select("agency_id, agency_id_basic, agency_id_advanced, agency_id_elite")
          .eq("email", lookupEmail)
          .maybeSingle();
        const agencyIds = Array.from(
          new Set(
            [profile?.agency_id, profile?.agency_id_basic, profile?.agency_id_advanced, profile?.agency_id_elite].filter(
              Boolean,
            ) as string[],
          ),
        );

        if (profile?.agency_id) setAgencyId(profile.agency_id);
        else if (agencyIds[0]) setAgencyId(agencyIds[0]);

        if (agencyIds.length > 0) {
          const { data: installs } = await supabase
            .from("slack_channel_agency_map")
            .select("agency_id, team_domain, installed_at, updated_at")
            .in("agency_id", agencyIds)
            .eq("is_active", true)
            .order("installed_at", { ascending: false, nullsFirst: false })
            .order("updated_at", { ascending: false, nullsFirst: false })
            .limit(1);
          const install = installs?.[0] as SlackInstallRow | undefined;
          if (install) {
            setConnectedInstall({ teamDomain: install.team_domain, agencyId: install.agency_id });
          }
        }
      }
      setLoading(false);
    })();
  }, [effectiveEmail]);

  const installHref = agencyId
    ? `${INSTALL_ENDPOINT}?agency_id=${encodeURIComponent(agencyId)}&email=${encodeURIComponent(userEmail ?? "")}`
    : "#";
  const blockedReason = () => (loading ? "Loading your agency ID" : "No agency ID found for your account.");

  const onStatusRef = useRef(onStatus);
  onStatusRef.current = onStatus;
  useEffect(() => {
    if (!loading) onStatusRef.current?.({ connected: !!connectedInstall, name: connectedInstall?.teamDomain });
  }, [loading, connectedInstall]);

  // Inside Settings the page already has its card, back link and title.
  const embedded = useLocation().pathname.startsWith("/app");
  const commands = SLIDES.filter((slide) => slide.cmd);

  const body = (
    <>
      <div data-tip-target="slack-header">
        {loading ? (
          <div className="px-skeleton h-12 rounded-lg" aria-busy="true" aria-label="Loading Slack connection" />
        ) : (
          <StatusRow
            inline={!!connectedInstall}
            tone={connectedInstall ? "on" : "off"}
            label={
              connectedInstall
                ? `Connected to ${connectedInstall.teamDomain || "your Slack workspace"}`
                : "Not connected"
            }
            detail={
              connectedInstall
                ? "SaaSSuite posts into the channel you picked."
                : "One click installs the app. Slack asks which channel it should post into."
            }
          >
            {!connectedInstall ? (
              <span data-tip-target="slack-install" className="flex flex-1 sm:flex-none">
                <Button asChild variant="accent" className="h-11 flex-1 sm:h-10 sm:flex-none">
                  <a
                    href={installHref}
                    onClick={(e) => {
                      if (!agencyId) {
                        e.preventDefault();
                        toast.error(blockedReason());
                      }
                    }}
                  >
                    <img src={SLACK_LOGO} alt="" className="size-4" />
                    Connect Slack
                  </a>
                </Button>
              </span>
            ) : null}
            <span data-tip-target={connectedInstall ? "slack-install" : undefined}>
              <MoreMenu
                label="More Slack actions"
                items={[
                  ...(connectedInstall
                    ? [
                        {
                          label: "Reconnect Slack",
                          icon: <RefreshCw />,
                          onSelect: () => {
                            if (!agencyId) toast.error(blockedReason());
                            else window.location.href = installHref;
                          },
                        },
                      ]
                    : []),
                  ...moreItems,
                ]}
              />
            </span>
          </StatusRow>
        )}
      </div>

      {children}

      <div data-tip-target="slack-commands">
        <Disclosure label={`Slash commands (${commands.length})`}>
          <ul className="divide-y divide-border/70 text-sm">
            {commands.map((slide) => (
              <li key={slide.cmd} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                <code className="w-fit shrink-0 rounded-sm bg-muted px-2 py-1 font-mono text-xs text-foreground sm:w-56">{slide.cmd}</code>
                <span className="text-muted-foreground">{slide.subhead}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Each workspace gets its own private bot token, stored encrypted. Uninstall any time from Slack settings.
          </p>
        </Disclosure>
      </div>
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <div className="px-canvas min-h-screen p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <img src={SLACK_LOGO} alt="" className="size-10 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-h3 tracking-tight text-foreground sm:text-h2">Slack</h1>
            <p className="text-sm text-muted-foreground">Run SaaSSuite commands from your Slack workspace.</p>
          </div>
        </div>
        <div className="px-surface p-4 sm:p-6">{body}</div>
      </div>
    </div>
  );
}

export default function SlackIntegration(props: InstallViewProps) {
  const [searchParams] = useSearchParams();
  const installed = searchParams.get("installed") === "1";
  const teamId = searchParams.get("team_id");

  const [resolvedTeamId, setResolvedTeamId] = useState<string | null>(teamId);

  useEffect(() => {
    if (!installed || resolvedTeamId) return;
    (async () => {
      const { data } = await supabase
        .from("slack_workspace_links")
        .select("team_id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.team_id) setResolvedTeamId(data.team_id);
    })();
  }, [installed, resolvedTeamId]);

  return installed ? <SuccessView teamId={resolvedTeamId} /> : <InstallView {...props} />;
}