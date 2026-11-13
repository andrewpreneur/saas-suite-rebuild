// Backdrop for the entry pages (sign in, sign up, reset, account picker, 404).
// Technique from 21st.dev "Floating Gradient" by @moumensoliman (demo id 19381), see
// ../21st/floating-gradient.tsx. Rebuilt here as a full-page layer in brand tokens.
import { motion } from "framer-motion";

const blobs = [
  { cls: "bg-brand/25", pos: { top: "-12%", left: "-8%" }, x: [0, 80, 0], y: [0, 40, 0], scale: [1, 1.15, 1], duration: 14 },
  { cls: "bg-info/15", pos: { bottom: "-18%", right: "-10%" }, x: [0, -70, 0], y: [0, -40, 0], scale: [1, 1.2, 1], duration: 18 },
  { cls: "bg-brand-hover/15", pos: { top: "38%", left: "52%" }, x: [0, 40, 0], y: [0, -60, 0], scale: [1, 1.1, 1], duration: 22 },
] as const;

/** Soft drifting brand glow. Decorative only: hidden from assistive tech, never intercepts input. */
export function EntryBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((blob, index) => (
        <motion.div
          key={index}
          className={`absolute h-[28rem] w-[28rem] rounded-full blur-3xl ${blob.cls}`}
          style={blob.pos}
          animate={{ x: [...blob.x], y: [...blob.y], scale: [...blob.scale] }}
          transition={{ duration: blob.duration, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(var(--canvas))]" />
    </div>
  );
}

export default EntryBackdrop;
