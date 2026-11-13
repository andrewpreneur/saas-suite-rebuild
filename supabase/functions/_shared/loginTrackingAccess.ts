/**
 * Andrew is confirming whether login tracking really requires Advanced.
 * Flip this one constant to restore the hard gate. While it is false, free
 * accounts get the explanation (there is no login-tracking video) and hear
 * the Advanced upgrade once.
 */
export const LOGIN_TRACKING_REQUIRES_ADVANCED = false;

export function loginTrackingUserReply(planRank: number): string {
  const explanation = "Login tracking shows which Client Hub users sign in and when, so you can see who is actually using the account. With auto-navigate on, a customer's first HighLevel login opens your Client Hub. There isn't a separate login-tracking training video.";
  if (planRank >= 2) return explanation;
  const once = "Advanced ($97/month) is the plan that lists login tracking.";
  if (LOGIN_TRACKING_REQUIRES_ADVANCED) {
    return `${explanation}\n\n${once} I can walk through turning it on after that upgrade.\n[[widget:upgrade]]`;
  }
  return `${explanation}\n\n${once}\n[[widget:upgrade]]`;
}

export function loginTrackingGuidance(planRank: number): string {
  if (LOGIN_TRACKING_REQUIRES_ADVANCED && planRank < 2) {
    return "LOGIN TRACKING: it requires Advanced ($97/month). Explain what it does in one short paragraph, mention the upgrade once with [[widget:upgrade]], and do not walk through turning it on. There is no login-tracking training video. Do not substitute another feature's video. Do not mention connecting HighLevel unless they asked to install.";
  }
  const upgrade = planRank < 2
    ? "Their plan is below Advanced. Mention once that Advanced ($97/month) is the plan that lists login tracking, with [[widget:upgrade]], then keep explaining. If an earlier message already mentioned that upgrade, do not mention it again."
    : "They already have Advanced or higher. Do not push an upgrade.";
  return `LOGIN TRACKING: Explain it to every plan, including free Starter. It records which Client Hub users sign in and can open the Client Hub on their first HighLevel login. There is no dedicated login-tracking training video — say that plainly and do not reuse the menu-removal, branding, or installation video as if it were the login-tracking video. ${upgrade}`;
}
