/**
 * Shared presentation for every Copilot surface (full page, docked panel, Help chat).
 * Nothing here holds chat logic: these are the brand mark, message shells, the
 * "Thinking…" row, the suggested-prompt chips, the greeting and the widget card.
 */
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Headset, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { riseItem, staggerParent } from "@/lib/motion";
import { SectionCard } from "@/components/premium/SectionCard";
import { TextShimmer } from "@/components/premium/21st/text-shimmer";

/** Reading styles shared by every assistant reply. */
export const COPILOT_PROSE =
  "prose prose-sm max-w-none break-words text-[15px] leading-relaxed text-foreground dark:prose-invert " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-1 [&_li]:pl-0.5 [&_li>p]:my-0 [&_li::marker]:text-muted-foreground [&_strong]:font-semibold [&_a]:text-brand [&_a]:underline-offset-4 " +
  "[&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto [&>*:first-child]:mt-0 [&>*:last-child]:mb-0";

const MARK_SIZES = {
  xs: "size-5 [&_svg]:size-3",
  sm: "size-7 [&_svg]:size-3.5",
  md: "size-9 [&_svg]:size-[18px]",
  lg: "size-14 [&_svg]:size-7",
} as const;

/** The Copilot avatar. `team` marks a reply written by a person on the support team. */
export function CopilotMark({
  size = "sm",
  tone = "brand",
  className,
}: {
  size?: keyof typeof MARK_SIZES;
  tone?: "brand" | "team";
  className?: string;
}) {
  const Icon = tone === "team" ? Headset : Sparkles;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full",
        tone === "team" ? "bg-success text-success-foreground" : "px-brand-fill",
        MARK_SIZES[size],
        className,
      )}
    >
      <Icon strokeWidth={2.2} />
    </span>
  );
}

/** A message arriving: fades in and rises (riseItem). */
export function MessageRise({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={riseItem} initial="hidden" animate="show" className={cn("min-w-0", className)}>
      {children}
    </motion.div>
  );
}

/** What the person typed: a brand bubble on the right. */
export function UserBubble({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <MessageRise className="flex justify-end">
      <div
        className={cn(
          "min-w-0 max-w-[85%] whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-brand-foreground",
          className,
        )}
      >
        {children}
      </div>
    </MessageRise>
  );
}

/** An assistant reply: a small name row, then a clean card. Widgets sit under the card. */
export function AssistantMessage({
  name,
  tone = "brand",
  showName = true,
  children,
  after,
  className,
}: {
  name: string;
  tone?: "brand" | "team";
  showName?: boolean;
  children?: ReactNode;
  after?: ReactNode;
  className?: string;
}) {
  return (
    <MessageRise className={cn("space-y-2", className)}>
      {showName && (
        <div className="flex items-center gap-2">
          <CopilotMark size="xs" tone={tone} />
          <span className="text-caption text-muted-foreground">{name}</span>
        </div>
      )}
      {children ? (
        <div className="px-surface w-fit min-w-0 max-w-full rounded-tl-sm border border-border/60 px-4 py-3">{children}</div>
      ) : null}
      {after}
    </MessageRise>
  );
}

/** "Thinking…" while a reply is on its way. */
export function ThinkingRow({ name, label = "Thinking…" }: { name: string; label?: string }) {
  return (
    <motion.div
      variants={riseItem}
      initial="hidden"
      animate="show"
      role="status"
      aria-label={`${name} is typing`}
      className="flex items-center gap-2 py-1"
    >
      <CopilotMark size="xs" className="animate-pulse motion-reduce:animate-none" />
      <TextShimmer
        as="span"
        duration={1.4}
        className="text-sm font-medium [--base-color:hsl(var(--muted-foreground))] [--base-gradient-color:hsl(var(--brand))] dark:[--base-color:hsl(var(--muted-foreground))] dark:[--base-gradient-color:hsl(var(--brand))]"
      >
        {label}
      </TextShimmer>
    </motion.div>
  );
}

export type CopilotPrompt = { label: string; prompt?: string; icon?: LucideIcon };

/** Tappable suggested prompts. */
export function PromptChips({
  prompts,
  onPick,
  disabled,
  align = "center",
  scroll = false,
  className,
}: {
  prompts: CopilotPrompt[];
  onPick: (prompt: string) => void;
  disabled?: boolean;
  align?: "center" | "start";
  /** One row that scrolls sideways, for tight spaces above a composer. */
  scroll?: boolean;
  className?: string;
}) {
  return (
    <motion.ul
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className={cn(
        "flex gap-2",
        scroll ? "-mx-1 flex-nowrap overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex-wrap",
        align === "center" && !scroll ? "justify-center" : "justify-start",
        className,
      )}
    >
      {prompts.map(({ label, prompt, icon: Icon }) => (
        <motion.li key={label} variants={riseItem} className={scroll ? "shrink-0" : "min-w-0"}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(prompt || label)}
            className={cn(
              "inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-left text-sm text-foreground shadow-card sm:min-h-9",
              "transition-[transform,border-color,color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand hover:shadow-raised active:translate-y-0 active:scale-[0.98]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0 text-brand" aria-hidden="true" /> : null}
            <span className={scroll ? "whitespace-nowrap" : "min-w-0"}>{label}</span>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}

export function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** The empty state: mark, warm greeting, one line of help, then whatever the surface adds (composer, chips). */
export function CopilotGreeting({
  firstName,
  assistantName,
  heading: Heading = "h1",
  compact = false,
  children,
  className,
}: {
  firstName?: string | null;
  assistantName: string;
  heading?: "h1" | "h2";
  compact?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerParent}
      initial="hidden"
      animate="show"
      className={cn("mx-auto flex w-full max-w-2xl flex-col items-center text-center", className)}
    >
      <motion.div variants={riseItem} className="relative">
        <span aria-hidden="true" className="px-brand-wash absolute -inset-3 rounded-full opacity-80" />
        <CopilotMark size={compact ? "md" : "lg"} className="relative" />
      </motion.div>
      <motion.div variants={riseItem} className={compact ? "mt-4" : "mt-6"}>
        <Heading className={cn("text-balance text-foreground", compact ? "text-h4" : "text-h3 sm:text-h2")}>
          {greetingFor()}
          {firstName ? `, ${firstName}` : ""}
        </Heading>
        <p className={cn("mx-auto mt-2 max-w-md text-pretty text-muted-foreground", compact ? "text-small" : "text-body")}>
          I'm {assistantName}. Ask me to set up onboarding, support, branding or your HighLevel install.
        </p>
      </motion.div>
      {children ? (
        <motion.div variants={riseItem} className={cn("w-full", compact ? "mt-4" : "mt-8")}>
          {children}
        </motion.div>
      ) : null}
    </motion.div>
  );
}

/** A card the assistant renders inside the chat. One primary action each. */
export function CopilotCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <SectionCard
      as="h3"
      title={title}
      description={description}
      icon={icon}
      actions={actions}
      className={cn("mt-3 min-w-0 border border-border/60 p-4 text-left sm:p-4", className)}
      bodyClassName="min-w-0 space-y-3 text-sm"
    >
      {children}
    </SectionCard>
  );
}
