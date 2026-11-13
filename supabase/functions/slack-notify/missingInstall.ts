/** An agency with no Slack install is a skip, not a failed delivery. */
export function missingSlackInstallResult(agencyId: string) {
  return {
    logLevel: "info" as const,
    status: 200,
    body: { ok: true as const, skipped: "no_slack_install" as const, agency_id: agencyId },
  };
}
