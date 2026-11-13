import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { popIn } from '@/lib/motion';

interface ActionConfirmationProps {
  message: string;
  className?: string;
}

/** "What just happened": a change Copilot made, confirmed in place. */
export function ActionConfirmation({ message, className }: ActionConfirmationProps) {
  return (
    <motion.div
      variants={popIn}
      initial="hidden"
      animate="show"
      className={cn('flex items-center gap-2 rounded-md border border-success/20 bg-success/10 px-3 py-2', className)}
    >
      <span className="inline-grid size-5 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <Check className="size-3" strokeWidth={3} />
      </span>
      <span className="text-sm text-foreground">{message}</span>
    </motion.div>
  );
}
