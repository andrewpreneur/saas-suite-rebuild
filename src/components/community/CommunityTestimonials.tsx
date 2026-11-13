import { Marquee } from "@/components/ui/marquee";
import { MemberAvatar } from "./shared";

const TESTIMONIALS = [
  {
    name: "Tyler P.",
    handle: "tylerp",
    quote:
      "SaaSSuite paid for itself in the first week. My clients finally onboard themselves without me on a call.",
  },
  {
    name: "Sam B.",
    handle: "samb",
    quote: "The white-labeled onboarding hub made my agency look 10x bigger than it is.",
  },
  {
    name: "Marcus D.",
    handle: "marcusd",
    quote: "Churn dropped noticeably once clients had a walkthrough and AI support in their own portal.",
  },
  {
    name: "Priya R.",
    handle: "priyar",
    quote: "Setup took an afternoon. Support tickets to me personally went way down after that.",
  },
  {
    name: "Jordan K.",
    handle: "jordank",
    quote: "Snapshots plus the branded hub is the fastest way I've ever launched a new SaaS offer.",
  },
  {
    name: "Alicia M.",
    handle: "aliciam",
    quote: "My clients think we built the whole platform. That alone justifies the price.",
  },
];

function TestimonialCard({ name, handle, quote }: (typeof TESTIMONIALS)[number]) {
  return (
    <figure className="relative w-64 shrink-0 cursor-default overflow-hidden rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-brand/40">
      <div className="flex items-center gap-2">
        <MemberAvatar name={name} className="h-8 w-8" />
        <div className="flex flex-col">
          <figcaption className="text-sm font-medium text-foreground">{name}</figcaption>
          <p className="text-xs text-muted-foreground">@{handle}</p>
        </div>
      </div>
      <blockquote className="mt-2 text-sm text-muted-foreground">{quote}</blockquote>
    </figure>
  );
}

export default function CommunityTestimonials() {
  return (
    <section className="relative pt-4">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        What members say
      </p>
      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
        <Marquee pauseOnHover className="[--duration:36s]">
          {TESTIMONIALS.map((t) => (
            <TestimonialCard key={t.handle} {...t} />
          ))}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:36s]">
          {TESTIMONIALS.slice().reverse().map((t) => (
            <TestimonialCard key={`r-${t.handle}`} {...t} />
          ))}
        </Marquee>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6 bg-gradient-to-r from-background" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6 bg-gradient-to-l from-background" />
      </div>
    </section>
  );
}