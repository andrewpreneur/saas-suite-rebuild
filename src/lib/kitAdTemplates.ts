import {
  KIT_AD_TEMPLATE_COUNT,
  KIT_AD_TEMPLATE_META,
  allowedKitAdTemplateIds,
  type KitAdTemplateMeta,
} from "../../supabase/functions/_shared/kit-ad-templates";

export { KIT_AD_TEMPLATE_COUNT, allowedKitAdTemplateIds };

const IMAGE_CLOSE = `Upload this creative and your logo. Keep the layout, composition, and visual style. Replace the brand name and logo with [YOUR BUSINESS NAME] and the logo you uploaded. Replace the offer and the body copy with [YOUR OFFER]. Leave a placeholder in the copy when a detail is still missing.

Then make 5 distinct variations. Change the headline, the supporting line, and the call to action in each variation. Keep the same layout, colors, and style.`;

const VIDEO_CLOSE = `Write a shot-by-shot script and storyboard for a square video in this style. Keep it under 10 seconds.

Replace the brand and logo with [YOUR BUSINESS NAME] and the logo I uploaded. Replace the offer with [YOUR OFFER]. Leave a placeholder when a detail is still missing.

Then write 5 distinct variations of that script. Change the opening line, the card contents, and the closing line. Keep the same square format, colors, and pacing.`;

function imagePrompt(look: string): string {
  return `${look}\n\n${IMAGE_CLOSE}`;
}

const PROMPTS: Record<string, string> = {
  "vibe-code-for-free": imagePrompt(
    `This is a square graphic on a deep navy background. A label at the top says "60 Day Free Trial" and the line under it is "with [Your Brand]". The center headline is large white type: "Vibe Code for Free with AI Studio". A product preview in the middle reads "Let's build something amazing". The bottom line says "Free through our white-label," beside a YOUR LOGO block.`,
  ),
  "vibe-code-flat-illustration": imagePrompt(
    `This is a square graphic on a blue-to-black background. The top is a product window with a YOUR LOGO label, a page canvas, and simple layout blocks. No person is shown. Under it, white type says "VIBE CODE FOR FREE", then "Using our [Your Brand] White-Label". A struck-through price reads "$97/month", and a bright green button says "FREE".`,
  ),
  "vibe-code-one-feature": imagePrompt(
    `This is a tall vertical ad on a deep navy background. White type says "Vibe Code For Free." then "Build a business in seconds.", "Launch on a custom domain.", and "No card required." A phone screen shows an app icon labeled "YOUR LOGO" and the line "Join our [Your Brand] White-Label for free Vibe Coding access." The bottom has a YOUR LOGO block and a PARTNER LOGO block.`,
  ),
  "vibe-code-problem-hook": imagePrompt(
    `This is a square graphic on a deep navy background. The white headline is "Vibe Code For FREE" with the line "with [Your Brand]". Under it: "Build a business in seconds.", "Launch on a custom domain.", and "No card required." A product preview reads "Let's build something amazing". The bottom line says "Free through our white-label," beside a YOUR LOGO block.`,
  ),
  "vibe-code-build-your-way": imagePrompt(
    `This is a square graphic on a deep navy background. The large white headline is "Vibe Code For FREE." Under it, a product preview reads "Let's build something amazing". The bottom has a YOUR LOGO block and a PARTNER LOGO block.`,
  ),
  "vibe-code-all-in-one": imagePrompt(
    `This is a square graphic on a deep navy background. The white headline is "Vibe Code For FREE." The lines under it say "Build a business in seconds.", "Launch on a custom domain.", and "No card required." A product preview reads "Let's build something amazing". The bottom has a YOUR LOGO block and a PARTNER LOGO block.`,
  ),
  "claude-abstract": imagePrompt(
    `This is a square graphic on a warm terracotta background. The large headline is "The Code Modernization Playbook", with the line "Transforming Legacy Systems with AI" under it. A dark outlined YOUR LOGO block sits near the bottom. There is open space and no button.`,
  ),
  "intercom-helpdesk": imagePrompt(
    `This is a square split ad. The left side is a dark headline, "Unmatched accuracy for complex financial queries." The right side is a help-desk screenshot: a conversation with "[Your Product] • AI Agent", the greeting "Hi [Name], how can I help?", and a customer message about a charge. A YOUR LOGO block sits at the top of the right side, and a button says "SEE [YOUR PRODUCT] IN ACTION".`,
  ),
  "kinsta-performance": imagePrompt(
    `This is a square light-gray ad. The headline is "Get daily automatic updates for your themes and plugins", with three checks: system-generated backups, visual regression tests, and free for the first month. A status card is titled "[Your Brand] Automatic Updates status". The bottom bar has a white YOUR LOGO block and the line "[Your tagline here]."`,
  ),
  "monday-dashboard": imagePrompt(
    `This is a square light graphic. The large headline is "Streamline all your workflows". A colorful project board fills most of the frame, and a navy outlined YOUR LOGO block sits on the graphic.`,
  ),
  "pdf-documents": imagePrompt(
    `This is a square graphic on a deep navy background. Large white type says "Tell me you're not sending PDFs to actual prospects." There is no logo block and no person.`,
  ),
  "settle-payments": imagePrompt(
    `This is a tall graphic on a dark green background. The headline is "Know Your Margins. Every Time." The supporting line is "Real-time inventory + bill pay in one platform." A margin figure reads "+43%", with three checks: SKU-level accuracy, faster month-end close, and built for CPG. A white YOUR LOGO block is on the graphic.`,
  ),
  "text-message": imagePrompt(
    `This is a tall graphic of a phone text thread on a white background. The bubbles say the sender is a well-connected individual and ask if the reader knows anybody who works for [Company Name]. The reply says they don't know anyone at [Company]. A later bubble mentions an AI on [Platform] called [Your Product] that calls, asks what you're looking for, and makes an email intro. The thread closes with a line about meeting interesting people through him.`,
  ),
  "gusto-payroll": `This is a 7-second square video on a coral background. It opens on the line "Run payroll as many times as you need." and a red outlined YOUR LOGO pill. It then shows a payroll screen titled "Payroll submitted", with an employee list and gray silhouette avatars. The end card is the same coral field with a white outlined YOUR LOGO block. The frame stays square while the phone scrolls and exits.\n\n${VIDEO_CLOSE}`,
  "viktor-flat-fee": imagePrompt(
    `This is a tall purple graphic. The headline is "I hired [Your Product] instead of a $90K ops role." The line under it says "What founders say after [Your Product] pays for itself in week one." A post card shows a lavender silhouette, the name "[Name]", and a short quote about hiring [Your Product] instead of a third ops person. A tile reads "YOUR LOGO", and the footer is "yourwebsite.com".`,
  ),
  "viktor-testimonial": imagePrompt(
    `This is a tall graphic. The headline is "15 dashboards open?" and the next line is "Help yourself." The supporting line says "Every account, every platform, one view in [Your App]." Tiles on the graphic read "LOGO", small dashboard titles use "[Platform]", and the footer is "yourwebsite.com".`,
  ),
  "viktor-question-hook": imagePrompt(
    `This is a tall graphic. The headline is "3 ad managers?" and the next line is "Help yourself." Under it is an analytics dashboard titled "[Platform] Ads Analytics", with tiles that read "LOGO". The footer is "yourwebsite.com".`,
  ),
};

const FILES: Record<string, { src: string; poster?: string }> = {
  "vibe-code-for-free": { src: "/kit/ad-templates/highlevel/vibe-code-for-free.png" },
  "vibe-code-flat-illustration": { src: "/kit/ad-templates/highlevel/vibe-code-flat-illustration.png" },
  "vibe-code-one-feature": { src: "/kit/ad-templates/highlevel/vibe-code-one-feature.png" },
  "vibe-code-problem-hook": { src: "/kit/ad-templates/highlevel/vibe-code-problem-hook.png" },
  "vibe-code-build-your-way": { src: "/kit/ad-templates/highlevel/vibe-code-build-your-way.png" },
  "vibe-code-all-in-one": { src: "/kit/ad-templates/highlevel/vibe-code-all-in-one.png" },
  "claude-abstract": { src: "/kit/ad-templates/saas/claude-abstract.jpeg" },
  "intercom-helpdesk": { src: "/kit/ad-templates/saas/intercom-helpdesk.jpeg" },
  "kinsta-performance": { src: "/kit/ad-templates/saas/kinsta-performance.jpeg" },
  "monday-dashboard": { src: "/kit/ad-templates/saas/monday-dashboard.jpeg" },
  "pdf-documents": { src: "/kit/ad-templates/saas/pdf-documents.jpeg" },
  "settle-payments": { src: "/kit/ad-templates/saas/settle-payments.jpeg" },
  "text-message": { src: "/kit/ad-templates/saas/text-message.jpeg" },
  "gusto-payroll": {
    src: "/kit/ad-templates/saas/gusto-payroll.mp4",
    poster: "/kit/ad-templates/saas/gusto-payroll-poster.jpg",
  },
  "viktor-flat-fee": { src: "/kit/ad-templates/viktor/flat-fee.jpeg" },
  "viktor-testimonial": { src: "/kit/ad-templates/viktor/testimonial.jpeg" },
  "viktor-question-hook": { src: "/kit/ad-templates/viktor/question-hook.jpeg" },
};

export type KitAdTemplate = KitAdTemplateMeta & {
  src: string;
  poster: string | null;
  prompt: string;
};

export const KIT_AD_TEMPLATES: KitAdTemplate[] = KIT_AD_TEMPLATE_META.map(item => {
  const file = FILES[item.id];
  const prompt = PROMPTS[item.id];
  if (!file || !prompt) throw new Error(`Missing ad template asset for ${item.id}`);
  return { ...item, src: file.src, poster: file.poster ?? null, prompt };
});

export const KIT_BASE_AD_TEMPLATE_ID = "vibe-code-for-free";

export const KIT_AD_GROUPS = [
  { id: "highlevel", label: "Vibe Code" },
  { id: "saas", label: "More creatives" },
  { id: "viktor", label: "More layouts" },
] as const;
