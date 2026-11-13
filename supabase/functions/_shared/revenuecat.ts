// Shared helpers for turning RevenueCat data into SaaSSuite plan grants.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface StoreProductMap {
  plan: "BASIC" | "ADVANCED" | null;
  premiumSupport: boolean;
  entitlement: string;
  /** Agency seats granted while this product is active. */
  seats?: number;
}

/**
 * Mirror of src/config/storeProducts.ts. Keep both in sync when a store
 * product is added.
 */
export const STORE_PRODUCTS: Record<string, StoreProductMap> = {
  ss_basic_monthly: { plan: "BASIC", premiumSupport: false, entitlement: "basic" },
  ss_basic_yearly: { plan: "BASIC", premiumSupport: false, entitlement: "basic" },
  ss_advanced_monthly: { plan: "ADVANCED", premiumSupport: false, entitlement: "advanced" },
  ss_advanced_yearly: { plan: "ADVANCED", premiumSupport: false, entitlement: "advanced" },
  ss_premium_support_monthly: { plan: "ADVANCED", premiumSupport: true, entitlement: "premium_support" },
  ss_premium_support_annual: { plan: "ADVANCED", premiumSupport: true, entitlement: "premium_support" },
  ss_agency_seat_monthly: { plan: null, premiumSupport: false, entitlement: "agency_seat", seats: 1 },
};

/** Strips the Google Play base-plan suffix (`product:base-plan`). */
export const normalizeProductId = (raw?: string | null) =>
  (raw ?? "").split(":")[0].trim();

export const storeLabel = (raw?: string | null) => {
  const s = (raw ?? "").toUpperCase();
  if (s.includes("APP_STORE") || s === "IOS" || s.includes("MAC")) return "apple";
  if (s.includes("PLAY") || s === "ANDROID") return "google";
  return (raw ?? "unknown").toLowerCase();
};

/** Subscriber snapshot from the RevenueCat REST API, verified server-side. */
export const fetchSubscriber = async (appUserId: string, secretKey: string) => {
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`,
    { headers: { Authorization: `Bearer ${secretKey}` } },
  );
  if (!res.ok) {
    throw new Error(`RevenueCat lookup failed (${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return json?.subscriber ?? null;
};

export interface ActiveGrant {
  productId: string;
  entitlement: string;
  plan: "BASIC" | "ADVANCED" | null;
  premiumSupport: boolean;
  seats: number;
  expiresAt: string | null;
  store: string;
  active: boolean;
}

/** Every known product on the subscriber, with its current active state. */
export const grantsFromSubscriber = (subscriber: any): ActiveGrant[] => {
  const now = Date.now();
  const entitlements = subscriber?.entitlements ?? {};
  const subscriptions = subscriber?.subscriptions ?? {};
  const grants: ActiveGrant[] = [];

  for (const [rawProductId, sub] of Object.entries<any>(subscriptions)) {
    const productId = normalizeProductId(rawProductId);
    const mapped = STORE_PRODUCTS[productId];
    if (!mapped) continue;

    const expires = sub?.expires_date ? Date.parse(sub.expires_date) : null;
    const active = expires === null ? false : expires > now;

    grants.push({
      productId,
      entitlement: mapped.entitlement,
      plan: mapped.plan,
      premiumSupport: mapped.premiumSupport,
      seats: mapped.seats ?? 0,
      expiresAt: sub?.expires_date ?? null,
      store: storeLabel(sub?.store),
      active,
    });
  }

  // Entitlements can outlive a specific subscription record (e.g. plan change).
  for (const [id, ent] of Object.entries<any>(entitlements)) {
    const productId = normalizeProductId(ent?.product_identifier);
    const mapped = STORE_PRODUCTS[productId];
    if (!mapped) continue;
    const expires = ent?.expires_date ? Date.parse(ent.expires_date) : null;
    const active = expires === null ? false : expires > now;
    const existing = grants.find((g) => g.productId === productId);
    if (existing) {
      existing.active = existing.active || active;
      if (active) existing.expiresAt = ent?.expires_date ?? existing.expiresAt;
    } else {
      grants.push({
        productId,
        entitlement: id,
        plan: mapped.plan,
        premiumSupport: mapped.premiumSupport,
        seats: mapped.seats ?? 0,
        expiresAt: ent?.expires_date ?? null,
        store: "unknown",
        active,
      });
    }
  }

  return grants;
};
