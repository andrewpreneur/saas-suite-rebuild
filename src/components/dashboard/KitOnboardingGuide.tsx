import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";
import { kitStepLocation, rememberKitReturn, withKitReturn } from "@/lib/kitReturn";
import {
  emptyKitProgress,
  kitOnboardingSteps,
  kitStepProgress,
  readKitProgress,
  resolveSelectedStep,
  withStepCompleted,
  withStepSelected,
  writeKitProgress,
  type KitOnboardingProgress,
  type KitOnboardingStep,
  type KitStepAction,
} from "@/lib/kitOnboarding";
import {
  emptyKitTrackerSignals,
  kitAccountChecks,
  kitConfirmedStepIds,
  kitProgressIds,
  kitStepVerificationNote,
  kitStepVisualStatus,
  type KitTrackerSignals,
} from "@/lib/kitTracker";
import { KitLandingPageField } from "@/components/dashboard/KitLandingPageField";
import { kitProgressStepIds, syncKitOnboardingProgress } from "@/lib/kitProgressSync";
import { Check, ExternalLink } from "lucide-react";

function isExternal(href: string): boolean {
  return href.startsWith("http");
}

const primaryActionClass =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-purple-700 px-6 text-base font-semibold text-white shadow-sm hover:bg-purple-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 focus-visible:ring-offset-2 dark:bg-purple-300 dark:text-purple-950 dark:hover:bg-purple-200 dark:focus-visible:ring-purple-200 sm:w-auto";

const quietLinkClass =
  "text-sm font-medium text-purple-800 underline decoration-purple-400 underline-offset-4 hover:text-purple-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700 dark:text-purple-200 dark:hover:text-purple-50";

export type KitStage =
  | "Not started"
  | "In progress"
  | "Marked done"
  | "Confirmed"
  | "Purchased"
  | "Included"
  | "Locked";

export function KitStagePill({ stage }: { stage: KitStage }) {
  const done =
    stage === "Confirmed" || stage === "Marked done" || stage === "Purchased" || stage === "Included";
  const current = stage === "In progress";
  return (
    <span
      data-kit-stage={stage}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        done && "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100",
        current && "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-100",
        !done && !current && "bg-muted text-foreground",
      )}
    >
      {stage}
    </span>
  );
}

function leaveForKitStep(stepId: string | undefined, href: string) {
  if (!stepId || !href.startsWith("/app/")) return;
  rememberKitReturn(kitStepLocation(stepId));
}

export function KitResourceLink({
  href,
  label,
  stepId,
  quiet = false,
}: {
  href: string;
  label: string;
  stepId?: string;
  quiet?: boolean;
}) {
  const dest = stepId ? withKitReturn(href, stepId) : href;
  const className = quiet ? quietLinkClass : primaryActionClass;
  const onClick = () => leaveForKitStep(stepId, dest);
  if (quiet) {
    if (isExternal(dest) || dest.startsWith("#")) {
      return (
        <a
          href={dest}
          className={className}
          onClick={onClick}
          {...(isExternal(dest) ? { target: "_blank", rel: "noreferrer" } : {})}
        >
          {label}
        </a>
      );
    }
    return (
      <Link to={dest} className={className} onClick={onClick}>
        {label}
      </Link>
    );
  }
  if (isExternal(dest) || dest.startsWith("#")) {
    return (
      <a
        href={dest}
        className={className}
        data-testid="kit-primary-action"
        onClick={onClick}
        {...(isExternal(dest) ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {label}
        {isExternal(dest) && <ExternalLink className="h-4 w-4" aria-hidden="true" />}
      </a>
    );
  }
  return (
    <Link to={dest} className={className} data-testid="kit-primary-action" onClick={onClick}>
      {label}
    </Link>
  );
}

function KitSnapshotLink({ label, stepId }: { label: string; stepId?: string }) {
  const { email: viewedEmail } = useUser();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "locked">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const email = (
        viewedEmail ||
        session?.user?.email ||
        ""
      )
        .trim()
        .toLowerCase();
      if (!email) {
        if (!cancelled) setState("locked");
        return;
      }
      const { data } = await supabase.functions.invoke("chat-copilot", {
        body: { action: "snapshot_link", userEmail: email },
      });
      if (cancelled) return;
      if (typeof data?.url === "string" && data.url) {
        setUrl(data.url);
        setState("ready");
      } else {
        setState("locked");
      }
    })().catch(() => {
      if (!cancelled) setState("locked");
    });
    return () => {
      cancelled = true;
    };
  }, [viewedEmail]);

  if (state === "loading")
    return <p className="text-sm text-muted-foreground">Checking snapshot access…</p>;
  if (state !== "ready" || !url) {
    return (
      <p className="text-sm text-muted-foreground">
        The snapshot link opens for an active account. Refresh if this stays here.
      </p>
    );
  }
  return <KitResourceLink href={url} label={label} stepId={stepId} />;
}

export function KitActionList({ actions, stepId }: { actions: KitStepAction[]; stepId?: string }) {
  const usable = actions.filter((action) => action.kind === "snapshot" || action.href);
  const missing = actions.filter((action) => action.kind !== "snapshot" && !action.href);
  const primary = usable[0] ?? null;
  const secondary = usable[1] ?? null;
  if (!primary && missing.length === 0) return null;
  return (
    <div className="flex flex-col items-start gap-3">
      {primary?.kind === "snapshot" ? (
        <KitSnapshotLink label={primary.label} stepId={stepId} />
      ) : primary?.href ? (
        <KitResourceLink href={primary.href} label={primary.label} stepId={stepId} />
      ) : null}
      {secondary?.kind === "snapshot" ? (
        <KitSnapshotLink label={secondary.label} stepId={stepId} />
      ) : secondary?.href ? (
        <KitResourceLink href={secondary.href} label={secondary.label} stepId={stepId} quiet />
      ) : null}
      {missing.map((action) => (
        <p key={action.label} className="text-sm text-muted-foreground">
          {action.label} isn't linked in the app yet.
        </p>
      ))}
    </div>
  );
}

function stepStage(status: "confirmed" | "marked" | "open", selected: boolean): KitStage {
  if (status === "confirmed") return "Confirmed";
  if (status === "marked") return "Marked done";
  if (selected) return "In progress";
  return "Not started";
}

function StepButton({
  step,
  index,
  selected,
  status,
  onSelect,
}: {
  step: KitOnboardingStep;
  index: number;
  selected: boolean;
  status: "confirmed" | "marked" | "open";
  onSelect: (id: string) => void;
}) {
  const stage = stepStage(status, selected);
  const done = status !== "open";
  return (
    <button
      type="button"
      aria-current={selected ? "step" : undefined}
      data-kit-step={step.id}
      data-kit-step-status={status}
      data-kit-step-state={selected ? "current" : done ? "complete" : "upcoming"}
      onClick={() => onSelect(step.id)}
      className={cn(
        "flex w-full min-w-0 items-start gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-700",
        selected &&
          "border-purple-700 bg-purple-700 text-white dark:border-purple-300 dark:bg-purple-300 dark:text-purple-950",
        !selected &&
          done &&
          "border-green-600 bg-green-50 text-green-950 hover:bg-green-100 dark:border-green-400 dark:bg-green-950 dark:text-green-50",
        !selected &&
          !done &&
          "border-transparent text-foreground hover:border-purple-200 hover:bg-purple-50 dark:hover:border-purple-800 dark:hover:bg-purple-950/50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
          selected &&
            "border-white/70 bg-white/15 text-white dark:border-purple-950/30 dark:text-purple-950",
          !selected && done && "border-green-700 bg-green-600 text-white dark:border-green-200",
          !selected &&
            !done &&
            "border-purple-300 text-purple-800 dark:border-purple-700 dark:text-purple-200",
        )}
        aria-hidden="true"
      >
        {done ? <Check className="h-3 w-3" /> : index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium leading-snug">{step.title}</span>
        <span
          data-kit-stage={stage}
          className={cn(
            "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
            selected && "bg-white/20 text-inherit",
            !selected && done && "bg-green-800 text-white",
            !selected &&
              !done &&
              "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-100",
          )}
        >
          {stage}
        </span>
      </span>
    </button>
  );
}

function StepMenu({
  steps,
  selectedId,
  manual,
  confirmed,
  onSelect,
}: {
  steps: KitOnboardingStep[];
  selectedId: string | null;
  manual: string[];
  confirmed: string[];
  onSelect: (id: string) => void;
}) {
  return (
    <ol className="space-y-1" data-testid="kit-step-list">
      {steps.map((step, index) => (
        <li key={step.id}>
          <StepButton
            step={step}
            index={index}
            selected={step.id === selectedId}
            status={kitStepVisualStatus(step.id, manual, confirmed)}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ol>
  );
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function KitOnboardingGuide({
  lineIds,
  userId,
  signals = emptyKitTrackerSignals(),
  syncUrl = true,
  onLandingPageSaved,
}: {
  lineIds: string[];
  userId: string | null;
  signals?: KitTrackerSignals;
  /** Wait until the real purchase list is known before writing the step into the URL. */
  syncUrl?: boolean;
  onLandingPageSaved?: (url: string) => void;
}) {
  const steps = useMemo(() => kitOnboardingSteps(lineIds), [lineIds]);
  const [progress, setProgress] = useState<KitOnboardingProgress>(emptyKitProgress);
  const [ready, setReady] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const onKitPage = location.pathname === "/app/dashboard";

  useEffect(() => {
    const local = readKitProgress(userId, browserStorage());
    setProgress(local);
    setReady(true);
    if (!userId) return;
    let cancelled = false;
    void supabase
      .from("kit_onboarding_progress")
      .select("completed")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !Array.isArray(data?.completed)) return;
        const remote = kitProgressStepIds(
          data.completed.filter((id): id is string => typeof id === "string"),
        );
        setProgress((current) => {
          const completed = kitProgressStepIds([...current.completed, ...remote]);
          if (
            completed.length === current.completed.length &&
            completed.every((id, index) => id === current.completed[index])
          ) {
            return current;
          }
          const next = { ...current, completed };
          writeKitProgress(userId, next, browserStorage());
          if (completed.length !== remote.length) void syncKitOnboardingProgress(userId, completed);
          return next;
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const confirmedIds = useMemo(() => kitConfirmedStepIds(signals), [signals]);
  const counted = kitProgressIds(progress.completed, confirmedIds);
  const summary = kitStepProgress(steps, counted);
  const urlStep = searchParams.get("step");
  const urlSelected = urlStep && steps.some((step) => step.id === urlStep) ? urlStep : null;
  const selectedId = urlSelected ?? resolveSelectedStep(steps, { ...progress, completed: counted });
  const selected = steps.find((step) => step.id === selectedId) ?? null;
  const selectedIndex = steps.findIndex((step) => step.id === selectedId);
  const hasNext = selectedIndex >= 0 && selectedIndex < steps.length - 1;
  const selectedStatus = selectedId
    ? kitStepVisualStatus(selectedId, progress.completed, confirmedIds)
    : "open";
  const percent =
    summary.total === 0 ? 0 : Math.round((summary.completedCount / summary.total) * 100);
  const checks = kitAccountChecks(lineIds, signals);
  const verification = selected
    ? kitStepVerificationNote(selected.id, selectedStatus, signals)
    : null;

  const persist = (next: KitOnboardingProgress) => {
    const completed = kitProgressStepIds(next.completed);
    const saved = completed.length === next.completed.length ? next : { ...next, completed };
    setProgress(saved);
    writeKitProgress(userId, saved, browserStorage());
    void syncKitOnboardingProgress(userId, saved.completed);
  };

  const select = (id: string) => {
    persist(withStepSelected(progress, id));
    if (!onKitPage) return;
    const next = new URLSearchParams(searchParams);
    next.set("view", "kit");
    next.set("step", id);
    setSearchParams(next);
  };

  useEffect(() => {
    if (!onKitPage || !syncUrl || !ready || !selectedId) return;
    if (searchParams.get("view") === "kit" && searchParams.get("step") === selectedId) return;
    if (urlStep && steps.some((step) => step.id === urlStep)) return;
    const next = new URLSearchParams(searchParams);
    next.set("view", "kit");
    next.set("step", selectedId);
    setSearchParams(next, { replace: true });
  }, [onKitPage, syncUrl, ready, selectedId, searchParams, setSearchParams, steps, urlStep]);

  useEffect(() => {
    if (!ready || !urlSelected || progress.selected === urlSelected) return;
    persist(withStepSelected(progress, urlSelected));
    // The address bar is the source of truth for a deep link or Back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, urlSelected]);

  if (steps.length === 0 || !selected) {
    return (
      <section className="space-y-2" data-testid="kit-onboarding">
        <h3 className="text-lg font-semibold text-foreground">One Feature Training</h3>
        <p className="text-sm text-muted-foreground">
          Training steps will show here when your kit is ready.
        </p>
      </section>
    );
  }

  const stepNumber = selectedIndex + 1;
  const crumb = `Step ${stepNumber}: ${selected.title}`;

  return (
    <section
      className="space-y-3 rounded-xl bg-white p-3 text-foreground dark:bg-background sm:p-4"
      data-testid="kit-onboarding"
      id="kit-onboarding"
    >
      <nav aria-label="Breadcrumb" data-testid="kit-breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-purple-950 dark:text-purple-100">
          <li>
            <Link to="/app/dashboard" className={quietLinkClass}>
              Dashboard
            </Link>
          </li>
          <li aria-hidden="true">&gt;</li>
          <li>
            <Link to={kitStepLocation(selected.id)} className={quietLinkClass}>
              One Feature Kit
            </Link>
          </li>
          <li aria-hidden="true">&gt;</li>
          <li aria-current="page" className="font-semibold">
            {crumb}
          </li>
        </ol>
      </nav>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200">
          One Feature Training
        </h3>
        <p className="text-sm text-muted-foreground">
          Take the steps in order. Your place is saved in this browser.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Onboarding steps" className="min-w-0 space-y-3 md:sticky md:top-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-purple-950 dark:text-purple-100">
              <span data-kit-step-position={`Step ${stepNumber} of ${steps.length}`}>
                Step {stepNumber} of {steps.length}
              </span>
              <span className="font-normal text-muted-foreground" data-kit-percent={percent}>
                {" "}
                · {percent}%
              </span>
            </p>
            <p className="sr-only" data-kit-progress={summary.label}>
              {summary.label} complete
            </p>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-purple-100 dark:bg-purple-950"
              aria-hidden="true"
            >
              <div
                className="h-full bg-green-600 dark:bg-green-400"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          <StepMenu
            steps={steps}
            selectedId={selectedId}
            manual={progress.completed}
            confirmed={confirmedIds}
            onSelect={select}
          />
          <ul className="space-y-1 border-t border-border pt-3" data-testid="kit-account-checks">
            {checks.map((check) => (
              <li
                key={check.id}
                data-kit-check={check.id}
                data-kit-check-status={check.status}
                className="text-xs leading-snug text-muted-foreground"
              >
                <span className="font-medium text-foreground">{check.label}. </span>
                {check.detail}
              </li>
            ))}
          </ul>
        </nav>
        <article
          className={cn(
            "min-w-0 space-y-4 rounded-xl border-2 bg-card p-4 text-card-foreground shadow sm:p-5",
            selectedStatus === "open"
              ? "border-purple-600 dark:border-purple-300"
              : "border-green-600 dark:border-green-400",
          )}
          aria-labelledby="kit-step-title"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                Step {stepNumber} of {steps.length}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <KitStagePill stage={stepStage(selectedStatus, true)} />
                {selectedStatus === "open" ? (
                  <button
                    type="button"
                    className={quietLinkClass}
                    onClick={() =>
                      persist(
                        withStepSelected(withStepCompleted(progress, selected.id), selected.id),
                      )
                    }
                  >
                    Mark complete
                  </button>
                ) : null}
              </div>
            </div>
            <h4
              id="kit-step-title"
              className="text-xl font-semibold text-purple-950 dark:text-purple-50"
            >
              {selected.title}
            </h4>
            <p className="text-sm text-foreground">{selected.subtitle}</p>
          </div>
          {selected.mediaSrc ? (
            <video
              key={selected.mediaSrc}
              aria-label={selected.title}
              controls
              playsInline
              preload="metadata"
              src={selected.mediaSrc}
              className="aspect-video w-full rounded-md border border-border bg-black"
            />
          ) : null}
          {selected.preview ? (
            <img
              src={selected.preview.src}
              alt={selected.preview.alt}
              className="w-full max-w-sm rounded-md border border-border"
            />
          ) : null}
          {selected.notes.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
              {selected.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ol>
          )}
          {verification ? <p className="text-sm text-muted-foreground">{verification}</p> : null}
          <KitActionList actions={selected.actions} stepId={selected.id} />
          {selected.id === "sales-page" ? (
            <KitLandingPageField savedUrl={signals.landingPageUrl} onSaved={onLandingPageSaved} />
          ) : null}
          {summary.completedCount === summary.total ? (
            <p className="text-sm text-foreground">
              Every training step is confirmed or marked done.
            </p>
          ) : !hasNext ? (
            <p className="text-sm text-muted-foreground">This is the last step.</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}
