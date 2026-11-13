import { Button } from "@/components/ui/button";
import { supportSmsUrl } from "@/lib/supportContact";

/** Trailing space is locked so the SMS composer stays after the colon. */
export const FUNNEL_SUCCESS_SMS_BODY =
  "i just opted in and want to work with andrew, this is what i do and what i need: ";

const INSTAGRAM_HREF = "https://www.instagram.com/andrewpreneurship/";
const YOUTUBE_HREF = "https://www.youtube.com/@andrewpreneurship";

/**
 * Shared next-step links under a non-kit funnel thanks state.
 * Additive: callers keep their own promise copy and locked trial buttons.
 */
export function FunnelSuccessLinktree() {
  return (
    <section className="mx-auto mt-6 w-full max-w-[420px] space-y-3 text-center">
      <h3 className="text-lg font-extrabold text-foreground">Easy next steps</h3>
      <div className="grid gap-3">
        <Button asChild className="webinar-2-cta h-12 w-full rounded-xl text-base font-bold">
          <a href={supportSmsUrl(FUNNEL_SUCCESS_SMS_BODY)}>Text us</a>
        </Button>
        <Button
          asChild
          variant="outline"
          className="one-feature-choice h-12 w-full rounded-full border-2 font-bold whitespace-normal"
        >
          <a href={INSTAGRAM_HREF} target="_blank" rel="noopener noreferrer">
            Instagram @andrewpreneurship
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          className="one-feature-choice h-12 w-full rounded-full border-2 font-bold whitespace-normal"
        >
          <a href={YOUTUBE_HREF} target="_blank" rel="noopener noreferrer">
            YouTube @andrewpreneurship
          </a>
        </Button>
      </div>
    </section>
  );
}
