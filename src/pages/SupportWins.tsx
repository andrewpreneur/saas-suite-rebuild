import { useSupportWins, type SupportCase } from "@/hooks/useSupportWins";
import { Bot, Headphones, Quote, RefreshCw, Timer } from "lucide-react";
import PageSEO from "@/components/PageSEO";

const Metric = ({ value, label, tone }: { value: string; label: string; tone: string }) => (
  <div className={`rounded-2xl border p-4 ${tone}`}>
    <div className="text-2xl font-bold">{value}</div>
    <div className="mt-1 text-xs font-medium opacity-80">{label}</div>
  </div>
);

const Row = ({ item }: { item: SupportCase }) => (
  <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <header className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
          item.channel === "ai" ? "bg-blue-600" : "bg-purple-600"
        }`}
        aria-hidden="true"
      >
        {item.initials}
      </span>
      <span className="font-semibold text-gray-900">{item.headline}</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
        {item.channel === "ai" ? <Bot className="h-3 w-3" /> : <Headphones className="h-3 w-3" />}
        {item.channel === "ai" ? "AI support" : "Human support"}
      </span>
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
        <Timer className="h-3 w-3" /> {item.time_to_result}
      </span>
      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{item.satisfaction}</span>
      <span className="ml-auto text-xs text-gray-400">{new Date(item.at).toLocaleString()}</span>
    </header>

    <div className="mt-4 space-y-3 text-sm">
      {item.questions.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Asked</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-800">
            {item.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Summary</p>
        <p className="mt-1 text-gray-700">{item.summary}</p>
      </div>
      {item.solution.length ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">How we helped</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-gray-700">
            {item.solution.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="flex gap-2 rounded-xl bg-green-50 p-3 italic text-green-900">
        <Quote className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {item.quote}
      </p>
      {item.tags.length ? (
        <div className="flex flex-wrap gap-2">
          {item.tags.map((t) => (
            <span key={t} className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
              {t}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  </article>
);

const SupportWins = () => {
  const { data, loading, error } = useSupportWins(20);
  const s = data?.stats;

  return (
    <div className="min-h-screen bg-gray-50">
      <PageSEO title="Support Case Studies (Live)" description="Live anonymized support case studies." path="/support-wins" noindex />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Support case studies — live</h1>
            <p className="text-sm text-gray-600">
              Built from the database and packaged by AI. No names, agency names, emails or links are included.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </button>
        </div>

        {error ? <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-700">Couldn&apos;t load: {error}</p> : null}
        {loading ? <p className="mt-6 text-gray-500">Loading…</p> : null}

        {s ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric value={`${s.ai_median_response_seconds ?? "—"}s`} label="Median AI first reply" tone="border-blue-200 bg-blue-50 text-blue-900" />
            <Metric value={s.ai_conversations.toLocaleString()} label="AI conversations" tone="border-indigo-200 bg-indigo-50 text-indigo-900" />
            <Metric value={s.ai_questions_answered.toLocaleString()} label="Questions answered" tone="border-purple-200 bg-purple-50 text-purple-900" />
            <Metric
              value={s.ai_no_human_needed_pct != null ? `${s.ai_no_human_needed_pct}%` : "—"}
              label="No human needed"
              tone="border-green-200 bg-green-50 text-green-900"
            />
            <Metric value={s.human_replies_sent.toLocaleString()} label="Human replies sent" tone="border-amber-200 bg-amber-50 text-amber-900" />
            <Metric
              value={s.human_fastest_minutes != null ? `${s.human_fastest_minutes} min` : "—"}
              label="Fastest human reply"
              tone="border-emerald-200 bg-emerald-50 text-emerald-900"
            />
            <Metric
              value={s.human_median_hours != null ? `${s.human_median_hours} h` : "—"}
              label="Median human reply"
              tone="border-orange-200 bg-orange-50 text-orange-900"
            />
            <Metric value={s.positive_mentions.toLocaleString()} label="Thank-you messages" tone="border-pink-200 bg-pink-50 text-pink-900" />
          </div>
        ) : null}

        {data ? (
          <>
            <h2 className="mt-10 mb-3 text-lg font-bold text-gray-900">AI support cases ({data.ai_cases.length})</h2>
            <div className="space-y-3">
              {data.ai_cases.map((c) => (
                <Row key={c.id} item={c} />
              ))}
            </div>

            <h2 className="mt-10 mb-3 text-lg font-bold text-gray-900">Human support cases ({data.human_cases.length})</h2>
            <div className="space-y-3">
              {data.human_cases.map((c) => (
                <Row key={c.id} item={c} />
              ))}
            </div>

            <p className="mt-8 text-xs text-gray-400">
              Generated {new Date(data.generated_at).toLocaleString()}
              {data.raw_considered ? ` · ${data.raw_considered.ai} AI + ${data.raw_considered.human} human candidates considered` : ""}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default SupportWins;
