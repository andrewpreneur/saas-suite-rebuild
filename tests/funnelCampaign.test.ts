import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  AGENTS_SMS_CONSENT_TEXT,
  FOUNDERS_PLAN_SMS_CONSENT_TEXT,
  FOUNDERS_PLAN_TEXT_US_BODY,
  FOUNDERS_PLAN_TEXT_US_HREF,
  FOUNDERS_PLAN_TEXT_US_LABEL,
  ghlAffiliateUrl,
  detectMetaInAppBrowser,
  isMetaInAppBrowser,
  isPaidSocialVisit,
  OUTCOME_HEADLINE_A,
  toE164,
  trainingGhlHref,
  trainingPageAllowed,
  WORK_WITH_US_EMAIL_CONSENT_TEXT,
} from "../src/lib/funnelContracts";
import { emailLooksValid, suggestEmail, toAgentPhone } from "../src/lib/agentsApply";
import { GHL_AFFILIATE_SIGNUP_URL, GHL_AFFILIATE_TRIAL_URL } from "../src/constants/ghlAffiliate";
import { ghlYesNo } from "../supabase/functions/_shared/ghl-yes-no.ts";
import { parseTrainingLeadWrite } from "../supabase/functions/_shared/one-feature-lead-body.ts";

function clearPaidSocial() {
  const store = new Map<string, string>();
  const memory = {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key: string) { return store.has(key) ? store.get(key)! : null; },
    setItem(key: string, value: string) { store.set(key, String(value)); },
    removeItem(key: string) { store.delete(key); },
    key(index: number) { return [...store.keys()][index] ?? null; },
  };
  Object.defineProperty(globalThis, "sessionStorage", { value: memory, configurable: true });
}

test("agents email typos never block and phones become E.164", () => {
  expect(suggestEmail("a@gmial.com")).toBe("a@gmail.com");
  expect(suggestEmail("a@gmail.com")).toBe(null);
  expect(emailLooksValid("a@agency.com")).toBe(true);
  expect(emailLooksValid("not-an-email")).toBe(false);
  expect(toAgentPhone("(337) 227-0501", "US")).toBe("+13372270501");
  expect(toAgentPhone("555-010-1999", "US")).toBe("+15550101999");
  expect(toAgentPhone("(555) 010-1999", "US")).toBe("+15550101999");
  expect(toAgentPhone("+1 555-010-1999", "US")).toBe("+15550101999");
  expect(toAgentPhone("555-010-199", "US")).toBe(null);
  expect(toAgentPhone("123", "US")).toBe(null);
});

test("training pages include the quiz and multi-digit variants", () => {
  expect(trainingPageAllowed("onefeaturetraining-2")).toBe(true);
  expect(trainingPageAllowed("onefeaturetraining-5")).toBe(true);
  expect(trainingPageAllowed("onefeaturetraining-12")).toBe(true);
  expect(trainingPageAllowed("onefeaturetraining-quiz")).toBe(true);
  expect(trainingPageAllowed("onefeaturetraining-success")).toBe(true);
  expect(trainingPageAllowed("agents")).toBe(false);
});

test("paid social visits use Russell and everyone else uses the trial link", () => {
  clearPaidSocial();
  expect(isPaidSocialVisit("?fbclid=abc")).toBe(true);
  expect(isPaidSocialVisit("?utm_source=facebook")).toBe(true);
  expect(isPaidSocialVisit("?utm_source=instagram")).toBe(true);
  expect(isPaidSocialVisit("?utm_source=ig")).toBe(true);
  expect(isPaidSocialVisit("?utm_medium=cpc")).toBe(false);
  expect(isPaidSocialVisit("?utm_medium=paid")).toBe(false);
  expect(isPaidSocialVisit("?utm_medium=paid_social")).toBe(false);
  expect(isPaidSocialVisit("?utm_source=google")).toBe(false);
  expect(ghlAffiliateUrl("")).toBe(GHL_AFFILIATE_TRIAL_URL);
  expect(trainingGhlHref("")).toBe(GHL_AFFILIATE_TRIAL_URL);
  expect(trainingGhlHref("?utm_source=google")).toBe(GHL_AFFILIATE_TRIAL_URL);
  expect(trainingGhlHref("?utm_medium=cpc")).toBe(GHL_AFFILIATE_TRIAL_URL);
  expect(ghlAffiliateUrl("?fbclid=abc")).toBe(GHL_AFFILIATE_SIGNUP_URL);
  expect(trainingGhlHref("?utm_source=ig")).toBe(GHL_AFFILIATE_SIGNUP_URL);
  expect(trainingGhlHref("")).toBe(GHL_AFFILIATE_SIGNUP_URL);
  clearPaidSocial();
  expect(trainingGhlHref("")).toBe(GHL_AFFILIATE_TRIAL_URL);
});

test("meta in-app browsers and phone numbers", () => {
  expect(isMetaInAppBrowser("Mozilla FBAN/FBIOS")).toBe(true);
  expect(isMetaInAppBrowser("Instagram 10")).toBe(true);
  expect(isMetaInAppBrowser("Chrome")).toBe(false);
  expect(detectMetaInAppBrowser({ userAgent: "Barcelona" })).toBe("threads");
  expect(detectMetaInAppBrowser({ userAgent: "MessengerForiOS" })).toBe("messenger");
  expect(detectMetaInAppBrowser({ userAgent: "Chrome", search: "?fbclid=abc" })).toBe(null);
  expect(detectMetaInAppBrowser({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel) AppleWebKit Chrome; wv)", search: "?fbclid=abc" })).toBe("facebook");
  expect(detectMetaInAppBrowser({ userAgent: "Chrome", search: "?iab=1", preview: true })).toBe("facebook");
  expect(detectMetaInAppBrowser({ userAgent: "Instagram", search: "?iab=0", preview: true })).toBe(null);
  expect(detectMetaInAppBrowser({ userAgent: "Instagram", search: "?iab=0", preview: false })).toBe("instagram");
  expect(toE164("(337) 227-0501")).toBe("+13372270501");
  expect(toE164("+447911123456")).toBe("+447911123456");
  expect(toE164("123")).toBe(null);
});

test("apply webhooks stay in env and highlevelers posts on its own secret", () => {
  const fn = readFileSync("supabase/functions/funnel-apply/index.ts", "utf8");
  expect(fn).toContain("GHL_AGENTS_INBOUND_WEBHOOK_URL");
  expect(fn).not.toContain("GHL_WWU_INBOUND_WEBHOOK_URL");
  expect(fn).not.toContain("work_with_us");
  expect(fn).not.toContain("release_lead_only");
  expect(fn).toContain("sweepStuckHighlevelers");
  expect(fn).toContain("STUCK_MS = 60 * 60 * 1000");
  expect(fn).toContain('row.status === "submitted"');
  expect(fn).toContain("stuck_sent_at");
  expect(fn).toContain('mode === "stuck"');
  expect(fn).not.toContain("stuck === true");
  expect(fn).toContain('.is("handoff_sent_at", null)');
  expect(fn).toContain("has_highlevel: ghlYesNo(has)");
  expect(fn).toContain("has_highlevel: ghlYesNo(payload.has_highlevel)");
  expect(fn).toContain("JSON.stringify(outbound)");
  expect(fn).not.toContain("has_highlevel: has");
  expect(ghlYesNo(true)).toBe("yes");
  expect(ghlYesNo(false)).toBe("no");
  expect(ghlYesNo("false")).toBe("no");
  expect(ghlYesNo("true")).toBe("no");
  expect(ghlYesNo("yes")).toBe("yes");
  expect(ghlYesNo("No")).toBe("no");
  expect(fn).toContain(AGENTS_SMS_CONSENT_TEXT);
  expect(fn).toContain("sms_consent: true");
  expect(fn).not.toContain("sms_consent: false");
  expect(fn).toContain("AGENTS_INBOUND_WEBHOOK_URL");
  expect(fn).toContain("TODO: GHL_AGENTS_INBOUND_WEBHOOK_URL is not set");
  expect(fn).toContain("GHL_HL_INBOUND_WEBHOOK_URL");
  expect(fn).toContain("TODO: GHL_HL_INBOUND_WEBHOOK_URL is not set");
  expect(fn).toContain("Deno.env.get(\"GHL_HL_INBOUND_WEBHOOK_URL\")");
  expect(fn).toContain("GHL_FOUNDERS_PLAN_INBOUND_WEBHOOK_URL");
  expect(fn).toContain("TODO: GHL_FOUNDERS_PLAN_INBOUND_WEBHOOK_URL is not set");
  expect(fn).toContain("Deno.env.get(\"GHL_FOUNDERS_PLAN_INBOUND_WEBHOOK_URL\")");
  expect(fn).toContain(FOUNDERS_PLAN_SMS_CONSENT_TEXT);
  expect(fn).toContain('funnel: "founders_plan"');
  expect(fn).toContain('leadContent = "founders_plan_optin"');
  expect(fn).toContain("content_name: leadContent");
  expect(fn).not.toContain("saasupgrade");
  expect(fn).toContain("_ghl");
  expect(fn).not.toContain(WORK_WITH_US_EMAIL_CONSENT_TEXT);
  expect(fn).not.toContain("leadconnector");
  expect(fn).toContain('funnel === "highlevelers" || funnel === "highlevelers_upgrade"');
  expect(fn).toContain('step === "optin" && (prior.step === "done" || prior.status === "submitted")');
  expect(fn).toContain("lead_already_sent");
  const lead = readFileSync("supabase/functions/one-feature-lead/index.ts", "utf8");
  const leadBody = readFileSync("supabase/functions/_shared/one-feature-lead-body.ts", "utf8");
  expect(lead).toContain("parseTrainingLeadWrite");
  expect(leadBody).toContain("has_ghl");
  expect(lead).toContain('body.action === "highlevel"');
  expect(lead).toContain("created: false");
  expect(lead).toContain("const stable = `lead_${data.id}`");
  expect(lead).toContain("!parsed.quiz");
  expect(lead).toContain('body.action === "update"');
  expect(lead).toContain("not_sure");
  expect(lead).toContain("ghl_signup_via_affiliate");
  expect(lead).toContain("AbortSignal.timeout(5000)");
  expect(leadBody).toContain("onefeaturetraining-(?:\\d+|success|quiz)");
  const oft5 = parseTrainingLeadWrite({
    action: "create",
    name: "Pat",
    email: "pat@example.com",
    phone: "555-010-1999",
    via: "form",
    page: "onefeaturetraining-5",
    form: "bonuses",
  });
  expect(oft5?.has).toBe(null);
  expect(oft5?.earlyBonus).toBe(true);
  const quizEmail = parseTrainingLeadWrite({
    action: "create",
    name: "Pat",
    email: "pat@example.com",
    phone: "",
    page: "onefeaturetraining-quiz",
    form: "quiz_email",
    via: "email",
  });
  expect(quizEmail?.phone).toBe("");
  expect(quizEmail?.quiz).toBe(true);
  expect(parseTrainingLeadWrite({
    action: "create",
    name: "Pat",
    email: "pat@example.com",
    page: "onefeaturetraining-quiz",
    form: "quiz_email",
  })?.phone).toBe("");
  expect(parseTrainingLeadWrite({
    name: "Pat",
    email: "pat@example.com",
    phone: "3372270501",
    has_highlevel: true,
    page: "onefeaturetraining-2",
    form: "watch_popup",
  })?.has).toBe(true);
  expect(parseTrainingLeadWrite({
    name: "Pat",
    email: "pat@example.com",
    phone: "3372270501",
    page: "onefeaturetraining-2",
    form: "watch_popup",
  })).toBe(null);
  expect(parseTrainingLeadWrite({
    name: "Pat",
    email: "pat@example.com",
    phone: "",
    has_highlevel: false,
    page: "onefeaturetraining-2",
    form: "watch_popup",
  })).toBe(null);
});

test("campaign pages keep the locked copy and leave Part D soft", () => {
  const app = readFileSync("src/App.tsx", "utf8");
  const strategy = readFileSync("src/pages/OneFeatureStrategy.tsx", "utf8");
  const agents = readFileSync("src/pages/AgentsApply.tsx", "utf8");
  const work = readFileSync("src/pages/WorkWithUs.tsx", "utf8");
  const high = readFileSync("src/pages/HighLevelers.tsx", "utf8");
  expect(app).toContain(
    'path="/onefeaturetraining-2" element={<OneFeatureTraining variant={2} />}',
  );
  expect(app).not.toContain('from="/onefeaturetraining-2"');
  expect(strategy).toContain("OUTCOME_HEADLINE_A");
  expect(OUTCOME_HEADLINE_A).toBe("Sell ONE GoHighLevel Feature as Your Own Software, and We'll Set It Up For You");
  expect(strategy).toContain("FREE BONUS");
  expect(strategy).toContain('action: "create"');
  expect(strategy).toContain("trainingGhlHref");
  expect(strategy).not.toContain("{{GHL_DEFAULT_URL}}");
  expect(strategy).not.toContain("has_highlevel: null");
  expect(strategy).toContain("variant !== 5");
  const quiz = readFileSync("src/pages/OneFeatureQuiz.tsx", "utf8");
  const quizVisible = quiz.replace(/`[^`]*`/g, "").replace(/\/[^/\n]+\/[gimsuy]*/g, "");
  expect(quizVisible).not.toContain("$");
  expect(quiz).not.toContain("/checkout");
  expect(quiz.toLowerCase()).not.toContain("payment");
  expect(quiz).not.toContain("ss_lead_only");
  expect(quiz).not.toContain("signup_source");
  expect(quiz).toContain("signInWithOtp");
  expect(quiz).toContain("Connecting to Google");
  expect(quiz).toContain('action: "create"');
  expect(quiz).toContain('page: "onefeaturetraining-quiz"');
  expect(quiz).toContain('form: "quiz_email"');
  expect(quiz).toContain('phone: ""');
  expect(quiz).not.toContain("has_highlevel");
  const success = readFileSync("src/pages/OneFeatureTrainingSuccess.tsx", "utf8");
  expect(success).toContain("You're in. Here's your next step.");
  expect(success).toContain("src === \"quiz\"");
  expect(success).toContain("Start My Free GoHighLevel Trial →");
  expect(success).not.toContain("about 5");
  expect(success).toContain("trainingGhlHref");
  expect(success).not.toContain("{{GHL_DEFAULT_URL}}");
  expect(success).not.toContain("{{KIT_");
  expect(success).toContain("Coming soon");
  expect(success).toContain("https://lynkific.com/vibe");
  expect(success).toContain("KIT_HOME_PATH");
  expect(success).not.toContain('href: "/app"');
  expect(success).not.toContain("delivery email");
  expect(success).toContain('phone: ""');
  expect(success).toContain("WhiteGoogleButton");
  expect(success).toContain("GOOGLE_CTA");
  expect(success).toContain("OPEN_KIT_CTA");
  expect(success).not.toContain("Sign in with Google");
  expect(success).not.toContain("rememberNextPath");
  const bridgeCopy = readFileSync("src/lib/trainingSuccessCopy.ts", "utf8");
  expect(bridgeCopy).toContain("We'll confirm the best path for you");
  expect(bridgeCopy).toContain("Log in to open your One Feature Kit");
  expect(bridgeCopy).toContain("Open your One Feature Kit →");
  expect(success).not.toContain("[G]");
  expect(success).not.toContain("Request My Free Setup");
  expect(strategy).toContain("Start My Free GoHighLevel Trial →");
  expect(strategy).toContain("Start My FREE GHL Trial");
  expect(strategy).not.toContain("about 5");
  expect(quiz).not.toContain("about 5");
  expect(strategy).toContain("Free with Your GoHighLevel Account");
  expect(strategy).toContain("Advanced is free for new affiliate signups only.");
  expect(agents).toContain("Use Every Feature of GHL Without Ever Logging In");
  expect(agents).toContain("Free with Your GoHighLevel Account");
  expect(agents).toContain("1,200+ agencies");
  expect(agents).toContain("agents_beta_apply");
  expect(agents).not.toContain("If you can do it in GoHighLevel, you can ask an agent");
  expect(agents).not.toContain("limited spots");
  expect(agents).not.toContain('href="/app"');
  expect(agents).not.toContain('href="/login"');
  expect(agents).toContain("Example");
  expect(agents).not.toContain("real screen recording");
  expect(agents).toContain("{AGENTS_SMS_CONSENT_TEXT}");
  expect(agents).toContain("Built and used inside 7–8 figure agencies");
  expect(agents).toContain("trainingGhlHref");
  expect(agents).not.toContain("{{GHL_DEFAULT_URL}}");
  expect(agents).toContain("We'll use this if we need to reach you. You'll hear back within 48 hours.");
  expect(agents).not.toContain("ghlAffiliateUrl");
  expect(agents).not.toContain("andrewgeorge");
  expect(agents).toContain("How fast will I hear back");
  expect(agents).toContain("within 48 hours");
  expect(agents).toContain("Andrew reviews every application himself");
  expect(agents).toContain("10 credits");
  expect(agents).toContain("300 credits");
  expect(agents).toContain("150 credits a week");
  expect(agents).not.toContain("email invite");
  expect(agents).not.toContain("Watch your inbox");
  const agentDollars = (agents.match(/\$\d[\d,]*/g) || []);
  expect(agentDollars.every((amount) => amount === "$297")).toBe(true);
  expect(agentDollars).toContain("$297");
  expect(agents).not.toContain("PLACEHOLDER");
  expect(agents).not.toContain("NEEDS ANDREW");
  expect(app).toContain('path="/agents/thanks" element={<PreserveSearchRedirect to="/agents" />}');
  expect(work).toContain("$2,500");
  expect(work).toContain("Email Me My Application Link");
  expect(work).toContain("signInWithOAuth");
  expect(work).toContain("signInWithOtp");
  expect(work).toContain('prompt: "select_account"');
  expect(work).toContain("detectMetaInAppBrowser");
  expect(work).toContain('ss_lead_only: "true"');
  expect(work).toContain('signup_source: WWU_SIGNUP_SOURCE');
  expect(work).toContain('params.set("magic", "1")');
  expect(work).toContain('params.set("s", wwuSessionId())');
  expect(work).toContain("We'll share how it works for your account when we reply.");
  expect(work).toContain("Async by default. No calls.");
  expect(work).not.toContain("still being confirmed");
  expect(work.toLowerCase()).not.toContain("full audit");
  expect(work).not.toContain("funnel-apply");
  expect(work.toLowerCase()).not.toContain("calendly");
  expect(work.toLowerCase()).not.toContain("book a call");
  expect(work.toLowerCase()).not.toContain("schedule");
  const workDollars = work.match(/\$\d[\d,]*/g) || [];
  expect(workDollars.every((amount) => amount === "$2,500")).toBe(true);
  const apply = readFileSync("supabase/functions/work-with-us-apply/index.ts", "utf8");
  const config = readFileSync("supabase/config.toml", "utf8");
  expect(apply).toContain('funnel: "work_with_us"');
  expect(apply).toContain("GHL_WWU_INBOUND_WEBHOOK_URL");
  expect(apply).toContain('content_name: "work_with_us_apply"');
  expect(apply).toContain("ss_lead_only");
  expect(apply).toContain("magic_link");
  expect(apply).toContain("magic_requested");
  expect(apply).toContain("signup_source");
  expect(apply).not.toContain("GHL_AGENTS_INBOUND_WEBHOOK_URL");
  expect(apply).not.toContain("AGENTS_INBOUND_WEBHOOK_URL");
  expect(apply).toContain("_ghl");
  expect(apply).toContain("TODO: GHL_WWU_INBOUND_WEBHOOK_URL is not set");
  expect(apply).toContain(WORK_WITH_US_EMAIL_CONSENT_TEXT);
  expect(config).toMatch(/\[functions\.work-with-us-apply\]\nverify_jwt = true/);
  const client = readFileSync("src/lib/workWithUsApply.ts", "utf8");
  expect(client).toContain("/functions/v1/work-with-us-apply");
  expect(high).toContain("trainingGhlHref");
  expect(high).not.toContain("{{GHL_DEFAULT_URL}}");
  expect(high).toContain('"/creatives/D/og-start-right-1200x630.png"');
  expect(high).toContain('"/creatives/D/og-burned-before-1200x630.png"');
  expect(high).not.toContain("D-timeline-7day");
  expect(high).not.toContain("Day 1");
  expect(high).not.toContain("6 Figure");
  expect(high).toContain("Let Us Install Our SaaS System in Your Agency For Free");
  expect(high).toContain("upgrade or get set up with us");
  expect(high).toContain("From access to live in 7 days");
  expect(high).not.toContain("Day 7: Live");
  expect(high).not.toContain("We'll email");
  expect(high).not.toContain("Watch your inbox");
  expect(high).not.toContain("watch your inbox");
  expect(high).toContain("Free with Your GoHighLevel Account");
  expect(high).toContain("1,200+ agencies");
  expect(high).toContain("Claim My Free Install");
  expect(high).toContain("Get My Free Install");
  expect(high).toContain("highlevelers_optin");
  expect(high).not.toContain("still being confirmed");
  expect(high).not.toContain("NEEDS ANDREW");
  expect(high).not.toContain('href="{{GHL_DEFAULT_URL}}"');
  expect(high).not.toContain("installs/day");
  expect(high.toLowerCase()).not.toContain("won't delete");
  expect(high.toLowerCase()).not.toContain("will not delete");
  expect(high).not.toMatch(/\$\d/);
});

test("founders plan primary CTA is text us to learn more", () => {
  const page = readFileSync("src/pages/FoundersPlan.tsx", "utf8");
  const contracts = readFileSync("src/lib/funnelContracts.ts", "utf8");
  const app = readFileSync("src/App.tsx", "utf8");
  const migration = readFileSync("supabase/migrations/20261027181500_founders_plan_funnel.sql", "utf8");
  expect(FOUNDERS_PLAN_TEXT_US_BODY).toBe("I have a question about the Founders Plan:");
  expect(FOUNDERS_PLAN_TEXT_US_LABEL).toBe("Text Us to Learn More");
  expect(FOUNDERS_PLAN_TEXT_US_HREF).toBe(
    "sms:+13372270501?&body=I%20have%20a%20question%20about%20the%20Founders%20Plan%3A",
  );
  expect(contracts).not.toContain("FOUNDERS_PLAN_TRIAL_URL");
  expect(contracts).not.toContain("FOUNDERS_PLAN_UPGRADE_URL");
  expect(app).toContain('path="/founders-plan" element={<FoundersPlan />}');
  expect(app).not.toContain('path="/founders-plan/thanks"');
  expect(page).toContain("FOUNDERS_PLAN_TEXT_US_HREF");
  expect(page).toContain("FOUNDERS_PLAN_TEXT_US_LABEL");
  expect(page).toContain("href={FOUNDERS_PLAN_TEXT_US_HREF}");
  expect(page).toContain("{FOUNDERS_PLAN_TEXT_US_LABEL}");
  expect(page.match(/<TextUsCta /g)?.length).toBe(5);
  expect(page).not.toContain("FOUNDERS_PLAN_TRIAL_URL");
  expect(page).not.toContain("FOUNDERS_PLAN_UPGRADE_URL");
  expect(page).not.toContain("TrialLink");
  expect(page).not.toContain("gohighlevel.com");
  expect(page).not.toContain("affiliate-upgrade");
  expect(page).not.toContain("crm-pricing-reviews");
  expect(page).not.toContain("fp_ref=");
  expect(page).not.toContain("fp_sid=");
  expect(page).not.toContain("Start a 14 Day Free Trial");
  expect(page).not.toContain("Start Your Trial");
  expect(page).not.toContain("14 Day Free Trial");
  expect(page).not.toContain("Upgrade Now");
  expect(page).not.toContain("Upgrade here");
  expect(page).not.toContain("Open upgrade link");
  expect(page).toContain("Ready to be a");
  expect(page).toContain("Formerly the Agency Pro Plan - Now Supercharged");
  expect(page).toContain("$497");
  expect(page).toContain("Payment Commissions");
  expect(page).toContain("AdFuel Program");
  expect(page).toContain("Who is the HighLevel Founder Plan designed for?");
  expect(page).toContain("/founders-plan/levelup-founder-hero.jpg");
  expect(page).toContain("HighLevel Founder Plan — Build Your Fortune with AI & Automation");
  expect(page).toContain("HighLevel Founder Plan — $497/mo Reimagined");
  expect(page).toContain("Tell me where to send the bonuses.");
  expect(page).toContain("Send My Bonuses →");
  expect(page).toContain("{FOUNDERS_PLAN_SMS_CONSENT_TEXT}");
  expect(page).toContain('step: "optin"');
  expect(page).toContain('step: "done"');
  expect(page).toContain('funnel: "founders_plan"');
  expect(page).toContain("noindex");
  expect(page).not.toContain("saasupgrade");
  expect(page).not.toContain("GHL_UPGRADE_497_URL");
  expect(page).not.toContain("trainingGhlHref");
  expect(page).not.toContain("/checkout");
  expect(migration).toContain("'founders_plan'");
  expect(readFileSync("scripts/seo-routes.ts", "utf8")).not.toContain("/founders-plan");
});
