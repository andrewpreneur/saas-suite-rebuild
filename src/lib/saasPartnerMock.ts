import { evaluateSaasPartnerSubmission, type SaasPartnerRow } from "../../supabase/functions/_shared/saasPartnerWaitlist";

export type SaasPartnerMockEntry = {
  email: string;
  website: string;
  affiliate_link: string | null;
  has_logo: boolean;
  business_name: string;
};

export type SaasPartnerMockLog = {
  submissions: SaasPartnerMockEntry[];
  discarded: string[];
  last: SaasPartnerRow | null;
};

function mockLog(): SaasPartnerMockLog {
  const host = globalThis as typeof globalThis & { __ssSaasPartner?: SaasPartnerMockLog };
  if (!host.__ssSaasPartner) {
    host.__ssSaasPartner = { submissions: [], discarded: [], last: null };
  }
  return host.__ssSaasPartner;
}

function mockMode(): string | null {
  try {
    return sessionStorage.getItem("ss_saas_partner_mode");
  } catch {
    return null;
  }
}

/** In-memory stand-in used by the dev platform mock. It never calls the network. */
export function mockSaasPartnerInvoke(body: Record<string, unknown> | undefined) {
  const decision = evaluateSaasPartnerSubmission(body || {}, Date.now());
  const log = mockLog();
  if (decision.kind === "honeypot") {
    log.discarded.push("honeypot");
    log.last = null;
    return { data: { ok: true }, error: null };
  }
  if (decision.kind === "invalid") {
    log.last = null;
    return { data: { ok: false, error: decision.error, field: decision.field, fields: decision.fields }, error: null };
  }
  log.last = decision.row;
  if (mockMode() === "error") {
    return {
      data: { ok: false, error: "We couldn't add you to the waitlist. Please try again." },
      error: null,
    };
  }
  const duplicate = log.submissions.some(
    (row) => row.email === decision.row.email && row.website === decision.row.website,
  );
  if (duplicate) {
    return {
      data: {
        ok: false,
        error: "This business is already on the waitlist.",
        field: "email",
        fields: { email: "This business is already on the waitlist." },
      },
      error: null,
    };
  }
  log.submissions.push({
    email: decision.row.email,
    website: decision.row.website,
    affiliate_link: decision.row.affiliate_link,
    has_logo: Boolean(decision.logo),
    business_name: decision.row.business_name,
  });
  return { data: { ok: true, id: crypto.randomUUID() }, error: null };
}
