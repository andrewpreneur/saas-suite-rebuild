import type { GhlLocation, GhlMenu } from "./useGhl";

type Request = <T = any>(action: string, agencyId: string) => Promise<T>;

/** Sync must finish before reading either saved list. */
export async function loadGhlSnapshot(request: Request, agencyId: string, force: boolean, withMenus: boolean) {
  const status = await request<{ connection?: { connected?: boolean } }>("status", agencyId);
  const connected = !!status.connection?.connected;
  // Installation lists must reflect links created/renamed outside SaaSSuite, even on first open.
  if (connected && (force || withMenus)) await request("sync", agencyId);
  const locations = connected ? (await request<{ locations: GhlLocation[] }>("locations", agencyId)).locations || [] : [];
  const menus = withMenus && connected ? (await request<{ menus: GhlMenu[] }>("menus", agencyId)).menus || [] : [];
  return { connected, locations, menus };
}