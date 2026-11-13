export type KitAdTemplateMeta = {
  id: string;
  title: string;
  group: "highlevel" | "saas" | "viktor";
  kind: "image" | "video";
  /** Included with the $27 kit. Every creative is included with the Launch Pack. */
  inKit: boolean;
};

/** Generic ad creatives: 16 images and 1 video. Display order is the library order. */
export const KIT_AD_TEMPLATE_META: KitAdTemplateMeta[] = [
  { id: "vibe-code-for-free", title: "60 Day Free Trial", group: "highlevel", kind: "image", inKit: true },
  { id: "vibe-code-flat-illustration", title: "Free Instead of $97", group: "highlevel", kind: "image", inKit: false },
  { id: "vibe-code-one-feature", title: "Build a Business in Seconds", group: "highlevel", kind: "image", inKit: false },
  { id: "vibe-code-problem-hook", title: "Free White-Label Offer", group: "highlevel", kind: "image", inKit: false },
  { id: "vibe-code-build-your-way", title: "Let's Build Something Amazing", group: "highlevel", kind: "image", inKit: false },
  { id: "vibe-code-all-in-one", title: "No Card Required", group: "highlevel", kind: "image", inKit: false },
  { id: "claude-abstract", title: "Code Modernization Playbook", group: "saas", kind: "image", inKit: false },
  { id: "intercom-helpdesk", title: "Unmatched Accuracy", group: "saas", kind: "image", inKit: false },
  { id: "kinsta-performance", title: "Automatic Updates", group: "saas", kind: "image", inKit: false },
  { id: "monday-dashboard", title: "Streamline Your Workflows", group: "saas", kind: "image", inKit: false },
  { id: "pdf-documents", title: "Stop Sending PDFs", group: "saas", kind: "image", inKit: false },
  { id: "settle-payments", title: "Know Your Margins", group: "saas", kind: "image", inKit: false },
  { id: "text-message", title: "Text Message Thread", group: "saas", kind: "image", inKit: false },
  { id: "gusto-payroll", title: "Run Payroll", group: "saas", kind: "video", inKit: false },
  { id: "viktor-flat-fee", title: "Hired Instead of a $90K Role", group: "viktor", kind: "image", inKit: false },
  { id: "viktor-testimonial", title: "15 Dashboards Open", group: "viktor", kind: "image", inKit: false },
  { id: "viktor-question-hook", title: "3 Ad Managers", group: "viktor", kind: "image", inKit: false },
];

export const KIT_AD_TEMPLATE_COUNT = KIT_AD_TEMPLATE_META.length;

const byId = new Map(KIT_AD_TEMPLATE_META.map(item => [item.id, item]));

export function kitAdTemplateMeta(id: string): KitAdTemplateMeta | null {
  return byId.get(id) ?? null;
}

/** Launch Pack owns every creative. The kit owns only the Vibe Code template. */
export function allowedKitAdTemplateIds(lineIds: Iterable<string>): string[] {
  const owned = new Set(lineIds);
  const launch = owned.has("launch");
  const kit = owned.has("kit");
  return KIT_AD_TEMPLATE_META.filter(item => launch || (kit && item.inKit)).map(item => item.id);
}
