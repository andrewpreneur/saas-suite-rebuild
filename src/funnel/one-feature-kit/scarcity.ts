const CHICAGO = "America/Chicago";

export type ChicagoClock = {
  hour: number;
  minute: number;
  weekday: string;
};

/** Wall clock in America/Chicago. hourCycle h23 follows DST; midnight can format as 24. */
export function chicagoClock(now = new Date()): ChicagoClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHICAGO,
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(read("hour"));
  if (hour === 24) hour = 0;
  return { hour, minute: Number(read("minute")), weekday: read("weekday") };
}

/**
 * Done-for-you setups still open today, Chicago time.
 * Midnight–11:59 → 5, noon → 4, 3pm → 3, 5pm → 2, 7pm–midnight → 1.
 */
export function kitSlotsLeft(now = new Date()): number {
  const { hour, minute } = chicagoClock(now);
  const minutes = hour * 60 + minute;
  if (minutes >= 19 * 60) return 1;
  if (minutes >= 17 * 60) return 2;
  if (minutes >= 15 * 60) return 3;
  if (minutes >= 12 * 60) return 4;
  return 5;
}

/** LIVE bar copy. Singular when one setup remains. */
export function kitLiveNotice(now = new Date()): string {
  const { weekday } = chicagoClock(now);
  const left = kitSlotsLeft(now);
  const noun = left === 1 ? "setup" : "setups";
  return `LIVE: Only ${left} done-for-you ${noun} left today (${weekday})`;
}

/** Shorter LIVE line so the bar stays on one line on a phone. */
export function kitLiveNoticeShort(now = new Date()): string {
  const left = kitSlotsLeft(now);
  return `LIVE: Only ${left} left today`;
}

/** Launch Pack line. Singular at one spot, and it ends with a full stop. */
export function kitDailyCapLine(now = new Date()): string {
  const left = kitSlotsLeft(now);
  const noun = left === 1 ? "spot" : "spots";
  return `Only ${left} done-for-you ${noun} left today.`;
}
