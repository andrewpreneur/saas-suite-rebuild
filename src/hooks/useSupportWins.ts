import { useEffect, useState } from "react";

export type SupportCase = {
  id: string;
  channel: "ai" | "human";
  initials: string;
  headline: string;
  quote: string;
  questions: string[];
  summary: string;
  solution: string[];
  satisfaction: string;
  time_to_result: string;
  tags: string[];
  at: string;
  screenshots?: string[];
};

export type SupportWinStats = {
  ai_conversations: number;
  ai_questions_answered: number;
  ai_median_response_seconds: number | null;
  ai_no_human_needed_pct: number | null;
  human_replies_sent: number;
  human_fastest_minutes: number | null;
  human_median_hours: number | null;
  human_same_day_pct: number | null;
  positive_mentions: number;
  thumbs_up: number;
  thumbs_down: number;
};

export type SupportWinsData = {
  generated_at: string;
  stats: SupportWinStats;
  cases: SupportCase[];
  ai_cases: SupportCase[];
  human_cases: SupportCase[];
  raw_considered?: { ai: number; human: number };
};

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-wins`;

export function useSupportWins(limit = 12, refresh = false) {
  const [data, setData] = useState<SupportWinsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${ENDPOINT}?limit=${limit}${refresh ? "&refresh=1" : ""}`, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return (await res.json()) as SupportWinsData;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [limit, refresh]);

  return { data, loading, error };
}
