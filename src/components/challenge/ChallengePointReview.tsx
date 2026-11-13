import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/integrations/supabase/types";

type Review = Tables<"challenge_point_reviews">;
const centralTime = (value: string) => new Date(value).toLocaleString("en-US", {
  timeZone: "America/Chicago", month: "short", day: "numeric", year: "numeric",
  hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short",
});

export default function ChallengePointReview() {
  const { effectiveEmail } = useUser();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setReviews([]);
    setFailed(false);
    if (!effectiveEmail) return;
    void supabase.rpc("challenge_my_point_reviews", { _owner_email: effectiveEmail.trim().toLowerCase() })
      .then(({ data, error }) => {
        if (!active) return;
        setFailed(Boolean(error));
        setReviews(error ? [] : data ?? []);
      });
    return () => { active = false; };
  }, [effectiveEmail, attempt]);
  if (failed) return <div className="border-y border-border py-3 text-sm text-muted-foreground">
    Private points review could not load. <Button variant="outline" size="sm" onClick={() => setAttempt(n => n + 1)}>Try again</Button>
  </div>;
  if (!reviews.length) return null;
  const removed = new Set(reviews.flatMap(review => review.completion_ids)).size;
  return <section aria-label="Your private points review" className="space-y-3 border-y border-border py-5">
    <h2 className="text-lg font-semibold text-foreground">Your points review: {removed.toLocaleString()} points removed</h2>
    <p className="text-sm text-muted-foreground">These video-completion points were identified as suspicious because at least 10 lessons were marked complete within two minutes, with no more than 10 seconds between consecutive marks. This is not verified viewing time or a finding of cheating. Only the challenge points were removed; learning progress is unchanged.</p>
    <p className="text-xs text-muted-foreground">This review is private to your account. Each completion below contributed one removed point.</p>
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-foreground">View evidence ({reviews.length} completion bursts)</summary>
      <div className="mt-3 space-y-3">
        {reviews.map(review => <article key={review.id} className="border-b border-border pb-3">
          <p className="font-semibold text-foreground">{review.user_name} · {review.completion_ids.length} points removed</p>
          <p className="text-muted-foreground">{centralTime(review.started_at)} → {centralTime(review.ended_at)}</p>
          <p className="text-muted-foreground">{review.completion_ids.length} completions in {((Date.parse(review.ended_at) - Date.parse(review.started_at)) / 1000).toFixed(1)} seconds.</p>
          <p className="mt-1 text-muted-foreground">{review.reason}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-muted-foreground">Completion records</summary>
            <ul className="mt-2 space-y-1 break-all text-xs text-muted-foreground">
              {review.completion_ids.map((id, index) => <li key={id}>{review.module_ids[index]} · {id}</li>)}
            </ul>
          </details>
        </article>)}
      </div>
    </details>
  </section>;
}