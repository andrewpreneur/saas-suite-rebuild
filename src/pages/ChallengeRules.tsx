import { useState } from "react";
import { Link } from "react-router-dom";
import MarketingLayout from "@/components/MarketingLayout";
import PageSEO from "@/components/PageSEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trophy, Check } from "lucide-react";
import { useUser } from "@/contexts/UserContext";
import { useGiveaway } from "@/hooks/useGiveaway";
import { navigateWithParams } from "@/utils/preserveParams";
import {
  GIVEAWAY_END_LABEL,
  GIVEAWAY_RULES_PATH,
  GIVEAWAY_START_LABEL,
  GIVEAWAY_WEEKS,
  GIVEAWAY_START_SHORT,
  GIVEAWAY_END_SHORT,
  GIVEAWAY_WINNERS_LABEL,
  GIVEAWAY_LEVELUP_URL,
} from "@/constants/giveaway";

const SPONSOR_ADDRESS = "5830 E 2nd St, Ste 7000 #8368, Casper, WY 82609";
const LAST_UPDATED = "October 23, 2026";

/** Section wrapper with a stable anchor id for deep links. */
const Section = ({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="scroll-mt-24 space-y-3">
    <h2 className="text-lg font-bold text-foreground md:text-xl">{title}</h2>
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
  </section>
);

const Row = ({ cells, head = false }: { cells: string[]; head?: boolean }) => (
  <tr className="border-b border-border last:border-0">
    {cells.map((c) => (
      <td
        key={c}
        className={
          head
            ? "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-foreground"
            : "px-3 py-2 align-top"
        }
      >
        {c}
      </td>
    ))}
  </tr>
);

const ChallengeRules = () => {
  const { email } = useUser();
  const { isEntered, isOptingIn, optIn, stats } = useGiveaway();
  const [name, setName] = useState("");
  const [accepted, setAccepted] = useState(false);

  const handleEnter = async () => {
    if (!name.trim()) {
      toast.error("Enter your full legal name to continue");
      return;
    }
    if (!accepted) {
      toast.error("You must agree to the Official Rules to enter");
      return;
    }
    const res = await optIn(name, true);
    if (res.ok) toast.success("You're entered. Points start tracking from right now.");
    else toast.error(res.error || "Could not enter the challenge");
  };

  return (
    <MarketingLayout>
      <PageSEO
        title="Move Your SaaS Challenge — Official Rules | SaaSSuite"
        description="Official Rules for the Move Your SaaS Challenge: $10,000 in grand prizes plus six weekly bonus sessions. No purchase necessary. Skill-based contest. 18+, U.S. residents only."
        path={GIVEAWAY_RULES_PATH}
      />

      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <Badge className="mb-4">Official Rules</Badge>
        <h1 className="text-3xl font-extrabold leading-tight text-foreground md:text-4xl">
          Move Your SaaS Challenge — Official Rules
        </h1>
        <p className="mt-4 text-sm font-semibold uppercase leading-relaxed tracking-wide text-foreground">
          No purchase or payment of any kind is necessary to enter or win. A purchase will not
          increase your chances of winning. This is a skill-based contest. Winners are determined by
          objective performance measurement, not by chance or random drawing. Void where prohibited
          or restricted by law.
        </p>

        {/* Entry form */}
        <Card className="mt-8 border-primary/20 bg-primary/5" id="enter">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Enter the Challenge</h2>
            </div>
            <p className="text-sm font-semibold text-foreground">
              Official dates: {GIVEAWAY_START_SHORT} → {GIVEAWAY_END_SHORT}
            </p>
            <p className="text-sm text-muted-foreground">
              Entry is free. Contest runs {GIVEAWAY_START_LABEL} through {GIVEAWAY_END_LABEL}.
              Winners are announced {GIVEAWAY_WINNERS_LABEL}.
              {stats ? ` ${stats.entrants.toLocaleString()} entrants so far.` : ""}
            </p>

            {!email ? (
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href={navigateWithParams(`/signup?next=${encodeURIComponent(GIVEAWAY_RULES_PATH)}`)}>
                    Create a free account
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={navigateWithParams(`/login?next=${encodeURIComponent(GIVEAWAY_RULES_PATH)}`)}>
                    Log in to enter
                  </a>
                </Button>
              </div>
            ) : isEntered ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Check className="h-4 w-4 text-primary" /> You are entered.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link to="/app/dashboard">See your standings</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rules-name">Full legal name</Label>
                  <Input
                    id="rules-name"
                    value={name}
                    maxLength={80}
                    placeholder="Your full legal name"
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="rules-accept"
                    checked={accepted}
                    onCheckedChange={(v) => setAccepted(v === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="rules-accept"
                    className="text-xs font-normal leading-relaxed text-muted-foreground"
                  >
                    I have read and agree to the Official Rules. I am 18 or older and a legal
                    resident of the 50 United States or the District of Columbia.
                  </Label>
                </div>
                <Button onClick={handleEnter} disabled={isOptingIn || !accepted || !name.trim()}>
                  {isOptingIn ? "Entering…" : "Enter the Challenge"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-10 space-y-10">
          <Section id="sponsor" title="1. Sponsor">
            <p>
              The Move Your SaaS Challenge (the "Contest") is sponsored and administered by{" "}
              <strong className="text-foreground">DNA Media Consulting LLC</strong>, a Wyoming
              limited liability company, {SPONSOR_ADDRESS} ("Sponsor," "we," "us").
            </p>
            <p className="font-semibold text-foreground">
              The Contest is in no way sponsored, endorsed, administered by, or associated with Meta
              Platforms, Inc. (Facebook or Instagram), Google LLC (YouTube), Slack Technologies,
              LLC, HighLevel Inc., or any other platform.
            </p>
            <p>
              By entering, you release each of those platforms from any and all liability arising
              from or related to the Contest. Any questions, comments, or complaints must be
              directed to Sponsor at{" "}
              <a className="text-primary underline" href="mailto:support@saassuite.ai">
                support@saassuite.ai
              </a>
              , and not to any platform.
            </p>
            <p>
              Sponsor is not affiliated with, endorsed by, or sponsored by HighLevel Inc. or Slack
              Technologies, LLC. All trademarks are the property of their respective owners.
            </p>
          </Section>

          <Section id="period" title="2. Contest Period and Entry Period">
            <p>
              The Contest begins <strong className="text-foreground">{GIVEAWAY_START_LABEL}</strong>{" "}
              and ends <strong className="text-foreground">{GIVEAWAY_END_LABEL}</strong> (the
              "Contest Period"), consisting of ten (10) consecutive weekly scoring periods (each, a
              "Weekly Period"). Weeks 1 through 9 each run Monday 12:00:00 a.m. CT through Sunday
              11:59:59 p.m. CT. Week 10 runs Monday, October 19, 2026 at 12:00:00 a.m. CT through
              the end of the Contest Period. Winners are announced{" "}
              <strong className="text-foreground">{GIVEAWAY_WINNERS_LABEL}</strong>:
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody>
                  <Row head cells={["Weekly Period", "Dates (Central Time)"]} />
                  {GIVEAWAY_WEEKS.map((w) => (
                    <Row key={w.week} cells={[w.week, w.dates]} />
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Entries will be accepted from{" "}
              <strong className="text-foreground">
                {GIVEAWAY_START_LABEL} through {GIVEAWAY_END_LABEL}
              </strong>{" "}
              (the "Entry Period"). Entries submitted after the close of the Entry Period will not be
              accepted.
            </p>
            <p className="font-semibold text-foreground">
              IMPORTANT — SCORING WINDOWS VARY BY ENTRANT.
            </p>
            <p>
              An entrant's score accumulates only from the date and time that entrant completes
              entry (the entrant's "Entry Date") through the end of the Contest Period. Activity
              occurring before an entrant's Entry Date is not counted for any purpose. Entrants who
              enter earlier in the Entry Period will therefore have a longer scoring window than
              entrants who enter later. By entering, you acknowledge and accept this.
            </p>
            <p>Sponsor's systems are the official timekeeping devices for the Contest.</p>
          </Section>

          <Section id="eligibility" title="3. Eligibility">
            <p>The Contest is open only to individuals who, as of the date of entry:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>are eighteen (18) years of age or older; and</li>
              <li>
                are legal residents of the fifty (50) United States or the District of Columbia.
              </li>
            </ul>
            <p>
              Entries submitted on behalf of a business entity must be submitted by an individual
              authorized to bind that entity. Only one (1) entry per person and per business entity
              is permitted, regardless of the number of individuals associated with that entity or
              the number of SaaSSuite accounts controlled by it.
            </p>
            <p>
              <strong className="text-foreground">Not eligible:</strong> members, managers, officers,
              employees, contractors, and agents of Sponsor and its parent, affiliates,
              subsidiaries, and advertising or promotional agencies, and the immediate family members
              (spouse, parent, child, sibling, and their respective spouses) and household members of
              each.
            </p>
            <p className="font-semibold text-foreground">
              The Contest is void in Puerto Rico, all U.S. territories and possessions, and anywhere
              else prohibited or restricted by law. The Contest is not open to residents of any
              country other than the United States.
            </p>
            <p>
              Participation constitutes your full and unconditional agreement to these Official Rules
              and to Sponsor's decisions, which are final and binding in all matters relating to the
              Contest.
            </p>
          </Section>

          <Section id="how-to-enter" title="4. How to Enter">
            <p>
              Entry is <strong className="text-foreground">free</strong>. To enter, during the Entry
              Period:
            </p>
            <ol className="list-decimal space-y-1 pl-6">
              <li>
                Create a SaaSSuite account at{" "}
                <a className="text-primary underline" href="https://saassuite.ai">
                  https://saassuite.ai
                </a>{" "}
                (free);
              </li>
              <li>
                Navigate to the Contest page at{" "}
                <a className="text-primary underline" href={GIVEAWAY_RULES_PATH}>
                  https://saassuite.ai{GIVEAWAY_RULES_PATH}
                </a>
                ;
              </li>
              <li>Enter your full legal name in the field provided;</li>
              <li>
                Check the box reading "I have read and agree to the Official Rules"; and
              </li>
              <li>Click the "Enter the Challenge" button.</li>
            </ol>
            <p className="font-semibold text-foreground">
              You are not entered in the Contest until you complete step 5.
            </p>
            <p>
              Merely creating a SaaSSuite account, installing SaaSSuite, or using the SaaSSuite
              platform does not enter you in the Contest. Sponsor will record the date and time of
              your click as your Entry Date.
            </p>
            <p>
              Creating a SaaSSuite account, installing SaaSSuite into a connected account, and
              entering the Contest are all free. No purchase, subscription, payment, or financial
              commitment of any kind is required to enter, to earn points, or to win any prize.
              Entrants who purchase a paid SaaSSuite plan receive no scoring advantage of any kind by
              virtue of that purchase.
            </p>
            <p>
              Limit one (1) entry per person and per business entity. Multiple accounts, duplicate
              entries, or entries made through any automated, robotic, or scripted means will void
              all entries and all points associated with that entrant.
            </p>
          </Section>

          <Section id="no-chance" title="5. No Chance Element">
            <p>
              Winners of all prizes are determined solely by measured performance against the
              objective criteria in Section 6 and, for Weekly Bonus Prizes, by qualified judges
              applying the criteria in Section 8.{" "}
              <strong className="text-foreground">
                No prize in this Contest is awarded by random drawing, lottery, raffle, or any other
                method involving chance.
              </strong>
            </p>
          </Section>

          <Section id="scoring" title="6. Scoring">
            <p>
              Beginning on an entrant's Entry Date and continuing through the end of the Contest
              Period, each entrant accrues points based on verified activity within that entrant's
              own SaaSSuite-connected account, as recorded by Sponsor's systems:
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody>
                  <Row head cells={["Scored Activity", "Points"]} />
                  <Row
                    cells={["Each net-new end user onboarded to the entrant's account", "1 point"]}
                  />
                  <Row
                    cells={[
                      "Each SaaSSuite training video opened and marked complete by an end user of the entrant's account",
                      "1 point",
                    ]}
                  />
                  <Row
                    cells={[
                      "Each onboarding checklist completed by an end user of the entrant's account",
                      "1 point",
                    ]}
                  />
                  <Row
                    cells={[
                      "Installation of the SaaSSuite Slack application by the entrant (one time only, per entrant)",
                      "20 points",
                    ]}
                  />
                  <Row
                    cells={[
                      "Each calendar day on which an end user of the entrant's account logs in",
                      "1 point",
                    ]}
                  />
                </tbody>
              </table>
            </div>
            <p className="font-semibold text-foreground">Definitions.</p>
            <p>
              "Net-new end user" means a unique end user account created within the entrant's
              connected account on or after the entrant's Entry Date, that is associated with a
              genuine third party distinct from the entrant, and that remains active and in good
              standing as of the end of the Contest Period.
            </p>
            <p>
              Login points are capped at one (1) point per unique end user per calendar day.
              Multiple logins by the same end user on the same calendar day earn one point in total.
            </p>
            <p>
              "Active user" means, for any Weekly Period, a unique end user of the entrant's account
              who logged in at least once during that Weekly Period.
            </p>
            <p>
              Sponsor's measurement of all scored activity is final. The Contest leaderboard
              displayed at{" "}
              <a className="text-primary underline" href="https://saassuite.ai">
                https://saassuite.ai
              </a>{" "}
              is provided for informational purposes only; all displayed standings are provisional
              and subject to change pending verification under Section 9. The official score of
              record is the score computed and verified by Sponsor's systems following the close of
              the Contest Period.
            </p>
            <p>
              <strong className="text-foreground">
                Activity that will not be counted and that may result in disqualification
              </strong>{" "}
              includes, without limitation: end user accounts created with false, duplicate,
              disposable, temporary, or auto-generated email addresses or identities; end user
              accounts created by, controlled by, or created on behalf of the entrant rather than by
              genuine third parties; end users who do not represent bona fide business
              relationships; logins, video completions, or checklist completions generated by
              automation, scripting, session manipulation, shared credentials, or any incentivized
              or coordinated scheme; end user accounts that are refunded, charged back, cancelled, or
              that lapse within fourteen (14) days of creation; activity from accounts sharing an IP
              address, device fingerprint, payment instrument, or email domain in a pattern Sponsor
              determines to be artificial; and any activity Sponsor determines, in its sole
              discretion, to be inconsistent with normal, good-faith use of the SaaSSuite platform.
            </p>
          </Section>

          <Section id="grand-prizes" title="7. Grand Prizes">
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody>
                  <Row head cells={["Place", "Prize", "Approximate Retail Value"]} />
                  <Row cells={["1st", "$5,000 USD", "$5,000"]} />
                  <Row cells={["2nd", "$3,000 USD", "$3,000"]} />
                  <Row cells={["3rd", "$2,000 USD", "$2,000"]} />
                </tbody>
              </table>
            </div>
            <p>
              The three (3) entrants with the highest verified total scores at the close of the
              Contest Period will be awarded first, second, and third place respectively.
            </p>
            <p>
              <strong className="text-foreground">Tie-breaker.</strong> In the event of a tie in
              total score, the tie will be broken in favor of the entrant who first reached that
              score, as recorded by Sponsor's systems. If a tie remains, it will be broken in favor
              of the entrant with the greater number of net-new end users onboarded. If a tie still
              remains, Sponsor will award the tied entrants the average of the prize values for the
              tied positions.
            </p>
            <p>
              Grand Prizes will be paid by ACH transfer within thirty (30) days after the end of the
              Contest Period, provided that the winner has returned all documentation required under
              Section 10 and provided valid banking details. Delivery of any prize is contingent on
              receipt of that documentation; delay or failure by a winner to provide it will delay or
              forfeit payment.
            </p>
            <p>
              <strong className="text-foreground">LevelUp ticket opportunity (bonus).</strong> The
              three (3) entrants ranked first, second, and third on the leaderboard at the close of
              the Contest Period ({GIVEAWAY_END_LABEL}) will each receive a chance at winning one (1)
              free ticket to LevelUp (
              <a
                className="text-primary underline"
                href={GIVEAWAY_LEVELUP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                summit.gohighlevel.com
              </a>
              ), HighLevel's annual summit in Dallas, Texas. This is an opportunity only: a free
              ticket is <strong className="text-foreground">not guaranteed</strong>, is awarded at
              Sponsor's sole discretion and subject to ticket availability from the event organizer,
              and does not include travel, lodging, meals, or any other expense. This bonus uses the
              same final standings as the Grand Prizes.
            </p>
          </Section>

          <Section id="weekly-bonus" title="8. Weekly Bonus Prize">
            <p>
              In each of the final six (6) Weekly Periods (Weeks 5 through 10, September 14 through{" "}
              {GIVEAWAY_END_SHORT}), Sponsor will award one (1) Weekly Bonus Prize
              consisting of a one-on-one working session with a member of Sponsor's team, conducted
              and recorded live on Sponsor's YouTube channel, during which Sponsor will build one
              marketing or automation asset of the winner's choosing (such as an ad campaign, funnel,
              course, or automation), together with temporary administrative access as reasonably
              required to complete that build. Approximate retail value: $500.
            </p>
            <p>
              The Weekly Bonus Prize is judged, not drawn. Sponsor's judges will select the winner
              from among entrants who accrued points during that Weekly Period, based on the
              following equally weighted criteria:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>demonstrated effort and execution during the Weekly Period (50%)</li>
              <li>clarity and specificity of the entrant's stated build objective (50%)</li>
            </ul>
            <p>
              Judges' decisions are final and binding. In the event of a tie, a tie-breaking judge
              designated by Sponsor will select the winner applying the same criteria.
            </p>
            <p>
              An entrant may win a Weekly Bonus Prize only once during the Contest Period. Winning a
              Weekly Bonus Prize neither improves nor diminishes an entrant's standing for the Grand
              Prizes.
            </p>
            <p>
              The Weekly Bonus Prize must be claimed within fourteen (14) days of the date Sponsor
              notifies the winner, or it is forfeited. The prize is subject to Sponsor's and the
              winner's scheduling availability and to reasonable scope limitations communicated to
              the winner in advance. Sponsor will not build any asset that is unlawful, infringing,
              deceptive, or that Sponsor reasonably determines to be outside the scope of the prize.
            </p>
          </Section>

          <Section id="prize-terms" title="9. General Prize Terms">
            <p>
              Total approximate retail value of all prizes:{" "}
              <strong className="text-foreground">$13,000</strong> (three Grand Prizes totaling
              $10,000, plus six Weekly Bonus Prizes at $500 each).
            </p>
            <p>
              Prizes are non-transferable, non-assignable, and no substitution or cash equivalent is
              permitted except by Sponsor, who reserves the right to substitute a prize of equal or
              greater value if an advertised prize becomes unavailable. All prize details not
              expressly stated are at Sponsor's sole discretion. Any portion of a prize not accepted
              or used is forfeited.
            </p>
            <p className="font-semibold text-foreground">
              All potential winners are subject to verification by Sponsor, whose decisions are final
              and binding. An entrant is not a winner of any prize — even if the public leaderboard,
              an email, a livestream, or any other Sponsor communication indicates otherwise — unless
              and until that entrant's eligibility and score have been verified and the entrant has
              been notified in writing that verification is complete.
            </p>
            <p>
              Sponsor reserves the right, in its sole discretion, to disqualify any entrant and void
              all of that entrant's accrued points if Sponsor determines that the entrant has:
            </p>
            <ul className="list-disc space-y-1 pl-6">
              <li>violated these Official Rules or the SaaSSuite Terms of Service;</li>
              <li>
                generated or attempted to generate scored activity through fraudulent, artificial,
                automated, or otherwise illegitimate means;
              </li>
              <li>
                tampered with the entry process, the scoring process, or the operation of the Contest
                or the SaaSSuite platform;
              </li>
              <li>
                acted in a manner that is disruptive, abusive, threatening, or in bad faith toward
                Sponsor, other entrants, or any end user; or
              </li>
              <li>
                provided false or misleading information, including a name that is not the entrant's
                full legal name.
              </li>
            </ul>
            <p className="font-semibold text-foreground">
              CAUTION: Any attempt to deliberately damage, undermine, or interfere with the
              legitimate operation of the Contest may be a violation of criminal and civil law, and
              Sponsor reserves the right to seek damages and other remedies to the fullest extent
              permitted by law.
            </p>
          </Section>

          <Section id="notification" title="10. Winner Notification and Claim Requirements">
            <p>
              Potential winners will be notified by email at the address associated with their
              SaaSSuite account within seven (7) business days after the close of the applicable
              scoring or judging period.
            </p>
            <p>
              Each potential winner must respond to the notification within five (5) business days.
              Failure to respond within that period, an undeliverable notification, or a potential
              winner's failure to comply with any requirement of these Official Rules will result in
              forfeiture of the prize, and Sponsor may award the prize to the next highest-scoring
              eligible entrant (or, for a Weekly Bonus Prize, to the next-ranked entrant selected by
              the judges).
            </p>
            <p>
              Each potential Grand Prize winner must execute and return, within ten (10) days of
              receipt, an Affidavit of Eligibility, a Liability Release, a Publicity Release (except
              where prohibited by law), and a completed IRS Form W-9 before any prize is delivered.
            </p>
          </Section>

          <Section id="taxes" title="11. Taxes">
            <p>
              All federal, state, and local taxes on any prize are the sole responsibility of the
              winner. Sponsor will issue an IRS Form 1099-MISC to any winner whose aggregate prize
              value equals or exceeds $600 in a calendar year, and winners must supply a valid
              taxpayer identification number to receive a prize. Winners are advised to consult their
              own tax advisors.
            </p>
          </Section>

          <Section id="publicity" title="12. Publicity">
            <p>
              Except where prohibited by law, participation in the Contest constitutes each
              entrant's consent to Sponsor's and its designees' use of the entrant's name, business
              name, likeness, voice, statements, city and state, and Contest-related activity, score,
              and results for advertising, promotional, and trade purposes worldwide, in any and all
              media now known or hereafter developed, in perpetuity, without further notice, review,
              approval, or compensation.
            </p>
            <p className="font-semibold text-foreground">
              Entrants specifically acknowledge that the Contest leaderboard is public and will
              display each entrant's name or business name alongside that entrant's provisional
              score.
            </p>
            <p>
              Weekly Bonus Prize winners further acknowledge and agree that their prize session will
              be livestreamed and permanently published on a public YouTube channel, and that they
              are solely responsible for ensuring that no confidential information belonging to them
              or to any third party (including their clients or end users) is disclosed during the
              session.
            </p>
          </Section>

          <Section id="privacy" title="13. Privacy and Communications">
            <p>
              Information collected from entrants is subject to Sponsor's Privacy Policy, available
              at{" "}
              <Link className="text-primary underline" to="/privacy">
                https://saassuite.ai/privacy
              </Link>
              . Sponsor, and not any platform, is collecting your information.
            </p>
            <p>
              By entering, you consent to receive Contest-related email communications from Sponsor
              at the address associated with your account. You may opt out of non-Contest marketing
              email at any time using the unsubscribe link in any message; opting out of marketing
              email will not affect your eligibility, your score, or your ability to win.
            </p>
            <p>
              Consent to receive text messages is optional and is not a condition of entry,
              eligibility, scoring, or winning. If you separately and affirmatively opt in to SMS,
              message and data rates may apply, message frequency varies, you may reply HELP for
              help, and you may opt out at any time by replying STOP.
            </p>
          </Section>

          <Section id="liability" title="14. Limitation of Liability">
            <p>
              By entering, each entrant agrees to release, discharge, indemnify, and hold harmless
              Sponsor and its parent, affiliates, subsidiaries, advertising and promotional agencies,
              and each of their respective members, managers, officers, employees, and agents
              (collectively, the "Released Parties") from and against any and all claims, injuries,
              losses, damages, costs, and expenses of any kind arising out of or relating to
              participation in the Contest or the acceptance, receipt, possession, use, or misuse of
              any prize.
            </p>
            <p>
              The Released Parties are not responsible for: lost, late, incomplete, misdirected, or
              undeliverable entries or notifications; technical, hardware, software, network, or
              transmission failures or errors of any kind; inaccurate or incomplete capture,
              recording, display, or transmission of entry or scoring data, including errors in the
              public leaderboard; unauthorized human or non-human intervention; or any injury or
              damage to any person's device related to or resulting from participation in the
              Contest.
            </p>
            <p>
              If for any reason the Contest is not capable of running as planned — including by
              reason of infection by computer virus, bug, tampering, unauthorized intervention,
              fraud, technical failure, or any other cause that in Sponsor's sole opinion corrupts or
              affects the administration, security, fairness, integrity, or proper conduct of the
              Contest — Sponsor reserves the right, in its sole discretion, to disqualify any
              affected entrant and to modify, suspend, or terminate the Contest. If the Contest is
              terminated before its scheduled end, Sponsor will award the Grand Prizes based on the
              verified scores of record at the time of termination among all eligible, non-affected
              entrants.
            </p>
            <p>
              Sponsor reserves the right to modify these Official Rules at any time. Material changes
              will be posted at{" "}
              <a className="text-primary underline" href={GIVEAWAY_RULES_PATH}>
                https://saassuite.ai{GIVEAWAY_RULES_PATH}
              </a>{" "}
              and will take effect prospectively only.
            </p>
          </Section>

          <Section id="disputes" title="15. Disputes and Governing Law">
            <p>
              These Official Rules are governed by the laws of the State of Wyoming, without regard
              to conflict-of-law principles. Each entrant agrees that any dispute arising out of or
              relating to the Contest shall be resolved individually, without resort to any form of
              class action, and exclusively in the state or federal courts located in Natrona County,
              Wyoming, and each entrant consents to the personal jurisdiction of those courts.
            </p>
            <p>
              Each entrant waives all rights to claim punitive, incidental, consequential, or any
              other damages other than out-of-pocket expenses actually incurred, and waives all
              rights to have damages multiplied or otherwise increased.
            </p>
            <p>
              If any provision of these Official Rules is held invalid or unenforceable, that
              provision will be modified only to the extent necessary to make it enforceable, and the
              remaining provisions will remain in full force and effect.
            </p>
          </Section>

          <Section id="winners-list" title="16. Winners List">
            <p>
              For the names of the Grand Prize winners, send a self-addressed stamped envelope to
              Move Your SaaS Challenge Winners List, DNA Media Consulting LLC, {SPONSOR_ADDRESS}, to
              be received no later than January 23, 2027. Winners will also be published at{" "}
              <a className="text-primary underline" href={GIVEAWAY_RULES_PATH}>
                https://saassuite.ai{GIVEAWAY_RULES_PATH}
              </a>{" "}
              within thirty (30) days after the close of the Contest Period.
            </p>
          </Section>

          <p className="border-t border-border pt-6 text-xs italic text-muted-foreground">
            These Official Rules were last updated on {LAST_UPDATED}.
          </p>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default ChallengeRules;