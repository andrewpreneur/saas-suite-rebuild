const PAGE_RE = /^onefeaturetraining-(?:\d+|success|quiz)$/;
const clip = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function trainingLeadHasAnswer(body: Record<string, unknown>): boolean | null {
  if (typeof body.has_highlevel === "boolean") return body.has_highlevel;
  if (typeof body.has_ghl === "boolean") return body.has_ghl;
  return null;
}

export type TrainingLeadWrite = {
  name: string;
  email: string;
  /** Empty when the quiz omits a phone. The row stores null, not "". */
  phone: string;
  page: string;
  form: string;
  has: boolean | null;
  /** Contact saved before Yes/No. The webhook waits for the later highlevel update. */
  earlyBonus: boolean;
  quiz: boolean;
};

/**
 * `/onefeaturetraining-5` posts `action: "create"` before Yes/No, so `has_highlevel` may be absent.
 * Quiz email create may omit `phone` or send "". Other training pages still require a phone of 7+ characters.
 */
export function parseTrainingLeadWrite(body: Record<string, unknown>): TrainingLeadWrite | null {
  const name = clip(body.name, 100);
  const email = clip(body.email, 255).toLowerCase();
  const phone = clip(body.phone, 30);
  const page = clip(body.page, 60);
  const form = clip(body.form, 40);
  const has = trainingLeadHasAnswer(body);
  const quiz = page === "onefeaturetraining-quiz";
  const earlyBonus = form === "bonuses" && has === null;
  const phoneOk = quiz ? phone === "" || phone.length >= 7 : phone.length >= 7;
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phoneOk || !PAGE_RE.test(page) || !form) return null;
  if (!quiz && !earlyBonus && has === null) return null;
  return { name, email, phone, page, form, has, earlyBonus, quiz };
}
