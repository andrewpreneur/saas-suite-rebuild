import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { supportSmsUrl } from "../src/lib/supportContact";

const LOCKED_HREF =
  "sms:+13372270501?body=i%20just%20opted%20in%20and%20want%20to%20work%20with%20andrew%2C%20this%20is%20what%20i%20do%20and%20what%20i%20need%3A%20";

const shell = readFileSync("src/components/funnel/FunnelSuccessLinktree.tsx", "utf8");
const agents = readFileSync("src/pages/AgentsApply.tsx", "utf8");
const work = readFileSync("src/pages/WorkWithUs.tsx", "utf8");
const high = readFileSync("src/pages/HighLevelers.tsx", "utf8");
const kit = readFileSync("src/pages/OneFeatureTrainingSuccess.tsx", "utf8");

function smsBody(): string {
  const match = shell.match(/FUNNEL_SUCCESS_SMS_BODY =\s*"([^"]*)"/);
  if (!match) throw new Error("missing locked SMS body");
  return match[1];
}

test("Text us reuses supportSmsUrl with the locked body and ?body=", () => {
  const body = smsBody();
  expect(body.endsWith(" ")).toBe(true);
  expect(body).toBe(
    "i just opted in and want to work with andrew, this is what i do and what i need: ",
  );
  expect(supportSmsUrl(body)).toBe(LOCKED_HREF);
  expect(decodeURIComponent(LOCKED_HREF.split("?body=")[1])).toBe(body);
  expect(shell).toContain("supportSmsUrl(FUNNEL_SUCCESS_SMS_BODY)");
  expect(shell).not.toContain("?&body=");
  expect(shell).not.toContain("tel:");
  expect(shell).toContain('target="_blank" rel="noopener noreferrer"');
  expect(shell).toContain("https://www.instagram.com/andrewpreneurship/");
  expect(shell).toContain("https://www.youtube.com/@andrewpreneurship");
  expect(shell).toContain("webinar-2-cta");
  expect(shell).toContain("one-feature-choice");
  expect(shell).toContain(">Text us</a>");
  expect(shell).toContain("Instagram @andrewpreneurship");
  expect(shell).toContain("YouTube @andrewpreneurship");
  expect(shell).toContain("Easy next steps");
});

test("the four non-kit thanks states include the linktree, including return visits", () => {
  const agentsThanks = agents.slice(
    agents.indexOf("function Thanks"),
    agents.indexOf("export default AgentsApply"),
  );
  expect(agentsThanks).toContain("<FunnelSuccessLinktree />");
  expect(agentsThanks).toContain("You've already applied");
  expect(agentsThanks).toContain("hear back within 48 hours");
  expect(agentsThanks).toContain("Start My Free GoHighLevel Trial →");
  expect(agentsThanks).toContain("Affiliate disclosure");

  const workThanks = work.slice(
    work.indexOf('{(step === "end" || step === "already") && ('),
    work.indexOf('<p className="text-xs text-muted-foreground">Saved as you go.'),
  );
  expect(workThanks).toContain("<FunnelSuccessLinktree />");
  expect(workThanks).toContain("You've already applied");
  expect(workThanks).toContain("within 48 hours");
  expect(workThanks).toContain("Andrew reviews every application himself");

  expect(high).toMatch(
    /step === "thanks" \|\| step === "claimed"[\s\S]{0,700}<FunnelSuccessLinktree \/>/,
  );
  expect(high).toContain("You've already claimed your install");
  expect(high).toContain("Start My Free GoHighLevel Trial →");
  expect(high).toContain("We'll match your account by email.");
  expect(high).toContain("Our team reviews every request and reaches out with your next step.");
});

test("kit success stays free of the non-kit linktree", () => {
  expect(kit).not.toContain("FunnelSuccessLinktree");
  expect(kit).not.toContain("FUNNEL_SUCCESS_SMS_BODY");
  expect(kit).toContain("You're in. Here's your next step.");
});
