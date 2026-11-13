/**
 * SaaSSuite Premium motion rules. Every animation in the app uses these, so
 * the whole product moves the same way.
 *
 * - Enter with EASE_OUT (fast start, soft landing). Leave with EASE_IN at ~75% of the time.
 * - Animate transform and opacity only. Nothing that blocks input runs longer than 500ms.
 * - Motion explains a relationship (where something came from). If it only decorates, cut it.
 * - framer-motion honors prefers-reduced-motion through <MotionConfig reducedMotion="user"> in the shell.
 */
import type { Transition, Variants } from "framer-motion";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN = [0.4, 0, 1, 1] as const;
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export const DURATION = { fast: 0.12, base: 0.2, slow: 0.32, page: 0.36 } as const;

/** Snappy spring for things that follow the pointer or a selection (highlights, indicators). */
export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 520, damping: 40, mass: 0.7 };
/** Softer spring for panels, cards and dialogs. */
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 };

/** A page or panel arriving: fades in and rises 8px. */
export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.page, ease: EASE_OUT } },
  exit: { opacity: 0, y: -4, transition: { duration: DURATION.base, ease: EASE_IN } },
};

/** Parent for a staggered reveal. Cap the children at about six. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

/** Child of staggerParent: fades in and rises 10px. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};

/** Something popping into place (badges, checkmarks, toasts). */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: SPRING_SNAPPY },
  exit: { opacity: 0, scale: 0.96, transition: { duration: DURATION.fast, ease: EASE_IN } },
};

/** Step content that slides in from the direction of travel (wizards, onboarding). */
export const slideStep = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 28 : -28 }),
  center: { opacity: 1, x: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -20 : 20,
    transition: { duration: DURATION.base, ease: EASE_IN },
  }),
};
