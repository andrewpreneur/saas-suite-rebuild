/**
 * PLACEHOLDER copy for the team-user block on /one-feature-kit/thank-you.
 * Landing Pages will replace this file. The address to add is the one string
 * below; the page and the done-for-you note both read it from here.
 */
export const THANK_YOU_COPY = {
  teamLead: "Add this user to your GoHighLevel agency:",
  teamEmail: "team@yoursoftwareonboarding.com",
  copyButton: "Copy email",
  copied: "Copied",
  teamNote: "Add them as a user. Do not send us your password.",
  dfyBefore: "Add ",
  dfyAfter: " as a user. Do not send us your password.",
} as const;

export function applyThankYouCopy(root: ParentNode) {
  const lead = root.querySelector("#ofk-team-lead");
  const email = root.querySelector("#ofk-team-email");
  const button = root.querySelector("#ofk-copy-team");
  const note = root.querySelector("#ofk-team-note");
  const dfy = root.querySelector("#ofk-dfy-team");
  if (lead) lead.textContent = THANK_YOU_COPY.teamLead;
  if (email) email.textContent = THANK_YOU_COPY.teamEmail;
  if (button) button.textContent = THANK_YOU_COPY.copyButton;
  if (note) note.textContent = THANK_YOU_COPY.teamNote;
  if (dfy) dfy.textContent = `${THANK_YOU_COPY.dfyBefore}${THANK_YOU_COPY.teamEmail}${THANK_YOU_COPY.dfyAfter}`;
}
