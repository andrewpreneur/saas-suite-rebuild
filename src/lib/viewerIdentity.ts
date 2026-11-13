// Who the signed-in person is, separate from the agency account they are acting on.
// An accepted account admin is switched onto the owner's saas_suite_users row so
// plan, agency, and permissions stay the agency's. That row's full_name is the
// owner. The profile must keep the admin's own name and email.

export interface ViewerIdentityInput {
  actualEmail: string | null;
  effectiveEmail: string | null;
  isImpersonating: boolean;
  /** saas_suite_users.full_name for the effective account email. */
  accountFullName: string | null;
  /** account_admins.admin_name, or the invite stored on the auth user. */
  adminName: string | null;
  authRole?: string | null;
}

export interface ViewerIdentity {
  displayName: string;
  displayEmail: string;
  /** True when the profile must not present the agency owner as the signed-in person. */
  showsAccountAdmin: boolean;
}

function text(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function emailOf(value: string | null | undefined): string | null {
  const trimmed = text(value);
  return trimmed ? trimmed.toLowerCase() : null;
}

function localPart(email: string | null): string {
  if (!email) return "";
  return email.split("@")[0] || email;
}

export function resolveViewerIdentity(input: ViewerIdentityInput): ViewerIdentity {
  const actual = emailOf(input.actualEmail);
  const effective = emailOf(input.effectiveEmail);
  const accountName = text(input.accountFullName);
  const adminName = text(input.adminName);
  const roleIsAdmin = (input.authRole || "").trim().toLowerCase() === "account_admin";
  const viewingAnotherAccount =
    !!actual && !!effective && actual !== effective && !input.isImpersonating;

  if (!actual && !effective) {
    return { displayName: "", displayEmail: "", showsAccountAdmin: false };
  }

  // Platform "login as" is supposed to look like the customer account.
  if (input.isImpersonating) {
    const email = effective || actual || "";
    return {
      displayName: accountName || localPart(email),
      displayEmail: email,
      showsAccountAdmin: false,
    };
  }

  // Team admin operating the owner's account. Never label them with the owner row.
  if (viewingAnotherAccount) {
    const email = actual || "";
    return {
      displayName: adminName || localPart(email),
      displayEmail: email,
      showsAccountAdmin: true,
    };
  }

  if (roleIsAdmin) {
    const email = actual || effective || "";
    return {
      displayName: adminName || accountName || localPart(email),
      displayEmail: email,
      showsAccountAdmin: true,
    };
  }

  const email = effective || actual || "";
  return {
    displayName: accountName || localPart(email),
    displayEmail: email,
    showsAccountAdmin: false,
  };
}
