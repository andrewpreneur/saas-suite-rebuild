import { motion } from "framer-motion";

export default function CommunityWelcome({ name }: { name?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="relative flex h-28 w-28 items-center justify-center rounded-full bg-primary/10"
      >
        <motion.span
          className="absolute inset-0 rounded-full bg-primary/20"
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
        />
        <svg viewBox="0 0 52 52" className="h-16 w-16">
          <motion.circle
            cx="26"
            cy="26"
            r="23"
            fill="none"
            stroke="hsl(142 71% 45%)"
            strokeWidth="3"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
          <motion.path
            d="M15 27 L23 35 L38 19"
            fill="none"
            stroke="hsl(142 71% 45%)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.5, ease: "easeOut" }}
          />
        </svg>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
        className="mt-8 text-2xl font-bold text-foreground"
      >
        You're in{name ? `, ${name.split(" ")[0]}` : ""}!
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="mt-2 max-w-sm text-sm text-muted-foreground"
      >
        Loading your community feed…
      </motion.p>
    </div>
  );
}