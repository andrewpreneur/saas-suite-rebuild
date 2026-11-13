import {
  BRIDGE_BODY,
  BRIDGE_MEANTIME,
  BRIDGE_TITLE,
  KIT_ROW_LABELS,
  NEXT_STEPS,
  successSub,
} from "@/lib/trainingSuccessCopy";

function firstNameFromStore(): string {
  try {
    const stored = localStorage.getItem("oft_quiz_name");
    if (stored) return stored.split(" ")[0] || "there";
  } catch {
    /* private mode */
  }
  return "there";
}

/**
 * Painted while the success-page chunk is still loading.
 * The route Suspense fallback is otherwise an empty full-screen div, which
 * leaves only the cookie banner after Activate on /onefeaturetraining-5.
 */
export function TrainingSuccessShell() {
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const src = params.get("src") || "";
  const via = params.get("via") || "";
  const firstName = firstNameFromStore();
  const sub = successSub(src, via);
  const headline =
    via === "google" || via === "email"
      ? `You're in, ${firstName}.`
      : src === "oft5" || src === "oft4"
        ? `Done, ${firstName}. You're all set.`
        : "You're in. Here's your next step.";

  return (
    <div className="min-h-screen bg-background">
      <main className="webinar-2-hero mx-auto max-w-3xl space-y-8 px-4 py-10 text-center sm:px-6">
        <img
          src="/assets/saassuite-logo.png"
          alt="SaaSSuite"
          width={48}
          height={48}
          className="mx-auto h-10 w-10 object-contain sm:h-12 sm:w-12"
        />
        <header>
          <h1 className="text-[32px] font-extrabold leading-tight text-foreground sm:text-[40px]">
            {headline}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">{sub}</p>
        </header>
        <section className="mx-auto max-w-xl space-y-3 text-left">
          <h2 className="text-center text-2xl font-extrabold">{BRIDGE_TITLE}</h2>
          <p>{BRIDGE_BODY}</p>
          <p>{BRIDGE_MEANTIME}</p>
        </section>
        <section className="mx-auto max-w-xl space-y-3 text-left">
          <h2 className="text-center text-2xl font-extrabold">Your One Feature Kit</h2>
          <ul className="space-y-3">
            {KIT_ROW_LABELS.map((label) => (
              <li key={label} className="glass-card rounded-2xl px-4 py-3 text-left">
                Locked · {label}
              </li>
            ))}
          </ul>
        </section>
        <section className="mx-auto max-w-xl space-y-3 text-left">
          <h2 className="text-2xl font-extrabold">What happens next</h2>
          <ol className="list-decimal space-y-1 pl-5">
            {NEXT_STEPS.map(([title, detail]) => (
              <li key={title}>
                <b>{title}</b> {detail}
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
