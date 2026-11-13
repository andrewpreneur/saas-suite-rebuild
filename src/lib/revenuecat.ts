import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { isNativeApp, nativePlatform } from '@/utils/nativeApp';
import { REVENUECAT_API_KEYS, STORE_PLANS, type StoreEntitlement } from '@/config/storeProducts';

let configured = false;
let configuredFor: string | null = null;
let initTail: Promise<boolean> = Promise.resolve(false);

export const storeBillingConfigured = (): boolean => {
  const platform = nativePlatform();
  if (platform === 'web') return false;
  return Boolean(REVENUECAT_API_KEYS[platform]);
};

/** Play subscriptions arrive as `productId:basePlanId`. The catalog uses the product id. */
const storeProductId = (raw?: string | null) => (raw ?? '').split(':')[0].trim();

export interface StoreEntitlementState {
  active: StoreEntitlement[];
  productIds: string[];
  expiresAt: string | null;
}

const readEntitlements = (info: any): StoreEntitlementState => {
  const active = Object.values(info?.entitlements?.active ?? {}) as any[];
  return {
    active: active.map((e) => e.identifier).filter(Boolean),
    productIds: active.map((e) => storeProductId(e.productIdentifier)).filter(Boolean),
    expiresAt: active.map((e) => e.expirationDate).filter(Boolean)[0] ?? null,
  };
};

const configureStoreBilling = async (): Promise<boolean> => {
  if (configured) return true;
  const platform = nativePlatform() as 'ios' | 'android';
  try {
    await Purchases.setLogLevel({ level: LOG_LEVEL.WARN });
  } catch { /* ignore */ }
  try {
    // Configure with only the API key — identify via logIn afterwards.
    await Purchases.configure({ apiKey: REVENUECAT_API_KEYS[platform] });
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? '').toLowerCase();
    if (!msg.includes('already') && !msg.includes('configured')) {
      console.error('[RevenueCat] configure failed:', e);
      return false;
    }
  }
  configured = true;
  return true;
};

/**
 * Posts this device's App Store / Play receipt onto the signed-in customer.
 * RevenueCat only aliases an anonymous purchase when the account is new.
 * Logging into an account that already exists leaves that purchase behind
 * unless the receipt is synced here.
 */
const claimDevicePurchases = async (created: boolean, beforeIds: string[], afterIds: string[]) => {
  const after = new Set(afterIds);
  const leftBehind = beforeIds.some((id) => !after.has(id));
  if (created && !leftBehind) return;
  try {
    await Purchases.syncPurchases();
  } catch (e) {
    console.error('[RevenueCat] sync after login failed:', e);
  }
};

const initStoreBillingNow = async (email?: string | null): Promise<boolean> => {
  if (!isNativeApp() || !storeBillingConfigured()) return false;
  const appUserId = email?.trim().toLowerCase() || null;
  if (!(await configureStoreBilling())) return false;

  if (!appUserId || appUserId === configuredFor) return true;

  let beforeIds: string[] = [];
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    beforeIds = readEntitlements(customerInfo).productIds;
  } catch { /* anonymous customer may not be readable yet */ }

  try {
    const result = await Purchases.logIn({ appUserID: appUserId });
    configuredFor = appUserId;
    const afterIds = readEntitlements(result?.customerInfo).productIds;
    await claimDevicePurchases(Boolean(result?.created), beforeIds, afterIds);
  } catch (e) {
    console.error('[RevenueCat] logIn failed:', e);
    return false;
  }
  return true;
};

/**
 * Configures RevenueCat once per app launch and identifies the signed-in user
 * by their email so store purchases land on the right SaaSSuite account.
 */
export const initStoreBilling = (email?: string | null): Promise<boolean> => {
  const run = initTail.then(() => initStoreBillingNow(email), () => initStoreBillingNow(email));
  initTail = run.then(() => true, () => false);
  return run;
};

export const logOutStoreBilling = async () => {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    /* anonymous users cannot log out — safe to ignore */
  }
  configuredFor = null;
};

export interface StoreOffering {
  productId: string;
  pkg: PurchasesPackage;
  priceString: string;
}

/** Live store prices/packages, keyed by our product identifiers. */
export const loadStoreOfferings = async (): Promise<StoreOffering[]> => {
  if (!isNativeApp() || !storeBillingConfigured()) return [];
  try {
    const { all } = await Purchases.getOfferings();
    const packages = Object.values(all ?? {}).flatMap((offering) => offering?.availablePackages ?? []);
    const known = new Set(STORE_PLANS.map((p) => p.productId));

    const seen = new Set<string>();
    const result: StoreOffering[] = [];
    for (const pkg of packages) {
      const productId = storeProductId(pkg.product?.identifier);
      if (!productId || !known.has(productId) || seen.has(productId)) continue;
      seen.add(productId);
      result.push({ productId, pkg, priceString: pkg.product?.priceString ?? '' });
    }
    return result;
  } catch (e) {
    console.error('[RevenueCat] offerings failed:', e);
    return [];
  }
};

export const getStoreEntitlements = async (): Promise<StoreEntitlementState> => {
  if (!isNativeApp() || !storeBillingConfigured()) {
    return { active: [], productIds: [], expiresAt: null };
  }
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return readEntitlements(customerInfo);
  } catch (e) {
    console.error('[RevenueCat] customer info failed:', e);
    return { active: [], productIds: [], expiresAt: null };
  }
};

export const purchaseStorePackage = async (
  pkg: PurchasesPackage,
): Promise<{ ok: boolean; cancelled?: boolean; error?: string; state?: StoreEntitlementState }> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return { ok: true, state: readEntitlements(customerInfo) };
  } catch (e: any) {
    if (e?.code === '1' || e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: e?.message ?? 'Purchase failed' };
  }
};

export const restoreStorePurchases = async (): Promise<StoreEntitlementState> => {
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return readEntitlements(customerInfo);
  } catch (e) {
    console.error('[RevenueCat] restore failed:', e);
    return { active: [], productIds: [], expiresAt: null };
  }
};
