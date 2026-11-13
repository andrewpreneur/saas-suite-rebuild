import { useCallback, useEffect, useState } from "react";

const key = (email: string | null | undefined) =>
  `ss_learn_watched_v1:${(email || "anon").trim().toLowerCase()}`;

function read(email: string | null | undefined): string[] {
  try {
    const raw = localStorage.getItem(key(email));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Which trainings this person has finished. Kept on this device, per account. */
export function useWatched(email: string | null | undefined) {
  const [watched, setWatched] = useState<string[]>(() => read(email));

  useEffect(() => {
    setWatched(read(email));
  }, [email]);

  const setOne = useCallback(
    (id: string, done: boolean) => {
      setWatched((prev) => {
        const next = done ? Array.from(new Set([...prev, id])) : prev.filter((item) => item !== id);
        try {
          localStorage.setItem(key(email), JSON.stringify(next));
        } catch {
          // Private mode: the tick still shows for this visit.
        }
        return next;
      });
    },
    [email],
  );

  return { watched, isWatched: (id: string) => watched.includes(id), setWatched: setOne };
}
