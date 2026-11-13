export const AFFILIATE_SALES_PAGES = [
  { id: "home", label: "Homepage", path: "/" },
  { id: "one-feature-kit", label: "One Feature Kit", path: "/one-feature-kit" },
  { id: "branding-tool", label: "Branding Tool", path: "/branding-tool" },
  { id: "email-warmup", label: "Email Warmup", path: "/email-warmup" },
  { id: "support", label: "AI + Human Support", path: "/support" },
  { id: "webinar", label: "Webinar", path: "/webinar" },
  { id: "go", label: "Go (Free Trial Funnel)", path: "/go" },
  { id: "breakdown", label: "Breakdown (Free Trial Funnel)", path: "/breakdown" },
  { id: "go-paid", label: "Paid Plans Only", path: "/go-paid" },
  { id: "breakdown-paid", label: "Paid Plans Only + Breakdown", path: "/breakdown-paid" },
  { id: "go-paid-27", label: "$27 Plan ONLY", path: "/go-paid-27" },
  { id: "breakdown-paid-27", label: "$27 Plan ONLY + Breakdown", path: "/breakdown-paid-27" },
  { id: "go-paid-97", label: "$97 Plan ONLY", path: "/go-paid-97" },
  { id: "breakdown-paid-97", label: "$97 Plan ONLY + Breakdown", path: "/breakdown-paid-97" },
];

/** Same shape as the other affiliate links: saassuite.ai + path + this affiliate's ref. */
export function affiliateShareUrl(path: string, slug: string): string {
  return `https://saassuite.ai${path}?ref=${slug}`;
}
