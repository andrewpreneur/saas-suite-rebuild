import { useUser } from "@/contexts/UserContext";
import { resolveViewerIdentity } from "@/lib/viewerIdentity";

/** Profile name and email for the signed-in person, not the agency owner they may be acting as. */
export function useViewerIdentity(accountFullName?: string | null) {
  const { actualEmail, email, isImpersonating, user, signedInAdminName } = useUser();
  const meta = (user?.user_metadata ?? {}) as { admin_name?: unknown; role?: unknown };
  const metaName = typeof meta.admin_name === "string" ? meta.admin_name : null;
  const authRole = typeof meta.role === "string" ? meta.role : null;
  return resolveViewerIdentity({
    actualEmail,
    effectiveEmail: email,
    isImpersonating,
    accountFullName: accountFullName ?? null,
    adminName: signedInAdminName || metaName,
    authRole,
  });
}
