/** Ticket counts and ticket rows must refresh together, including realtime updates. */
export async function refreshSupportInbox(
  refreshThreadsAndCounts: () => Promise<void>,
  refreshTickets: () => Promise<void>,
): Promise<void> {
  await Promise.all([refreshThreadsAndCounts(), refreshTickets()]);
}