import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { isNativeApp } from '@/utils/nativeApp';
import { STORE_PLANS, currentStoreProductIds, type StorePlan } from '@/config/storeProducts';
import {
  initStoreBilling,
  loadStoreOfferings,
  getStoreEntitlements,
  purchaseStorePackage,
  restoreStorePurchases,
  storeBillingConfigured,
} from '@/lib/revenuecat';

export interface StorePlanOption extends StorePlan {
  /** Live localized store price when available, otherwise the configured one. */
  displayPrice: string;
  available: boolean;
  owned: boolean;
}

/**
 * In-app subscription state for the iOS / Android apps.
 *
 * Inside the app, purchases go through the App Store / Google Play (required by
 * both stores). On the web this hook stays inert and card checkout is untouched.
 */
export const useStoreSubscription = () => {
  const { effectiveEmail, plan, refetchUserData } = useUser();
  const native = isNativeApp();

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(native);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [options, setOptions] = useState<StorePlanOption[]>([]);
  const [activeProductIds, setActiveProductIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  /** Paid access that came from website card billing, not from a store purchase. */
  const hasWebSubscription =
    (plan === 'BASIC' || plan === 'ADVANCED') && activeProductIds.length === 0;

  const buildOptions = useCallback(
    (prices: Record<string, string>, owned: string[], availableIds: Set<string>) =>
      STORE_PLANS.map((p) => ({
        ...p,
        displayPrice: prices[p.productId] || p.priceDisplay,
        available: availableIds.has(p.productId),
        owned: owned.includes(p.productId),
      })),
    [],
  );

  const syncWithServer = useCallback(async () => {
    // Not signed in yet: the purchase stays on the anonymous store customer and
    // is linked to the account automatically after login/signup.
    if (!effectiveEmail) {
      try { localStorage.setItem('ss_pending_store_purchase', '1'); } catch { /* ignore */ }
      return null;
    }
    try {
      const { data, error: fnError } = await supabase.functions.invoke('sync-store-subscription');
      if (fnError) throw fnError;
      const ids: string[] = data?.activeProductIds ?? [];
      // An empty server reply must not clear a plan the phone already showed.
      if (ids.length > 0) setActiveProductIds(currentStoreProductIds(ids));
      await refetchUserData();
      return ids;
    } catch (e) {
      console.error('[StoreSubscription] sync failed:', e);
      return null;
    }
  }, [refetchUserData, effectiveEmail]);

  const refresh = useCallback(async () => {
    if (!native) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const ok = await initStoreBilling(effectiveEmail);
    setReady(ok);

    if (!ok) {
      setOptions(buildOptions({}, [], new Set()));
      setLoading(false);
      if (!storeBillingConfigured()) {
        setError('In-app purchases are not configured yet.');
      }
      return;
    }

    const [offerings, entitlements] = await Promise.all([
      loadStoreOfferings(),
      getStoreEntitlements(),
    ]);

    const prices: Record<string, string> = {};
    const availableIds = new Set<string>();
    for (const o of offerings) {
      if (o.priceString) prices[o.productId] = o.priceString;
      availableIds.add(o.productId);
    }

    const currentIds = currentStoreProductIds(entitlements.productIds);
    setActiveProductIds(currentIds);
    setOptions(buildOptions(prices, currentIds, availableIds));

    // Server-side verification keeps the account plan honest.
    if (effectiveEmail) void syncWithServer();

    setLoading(false);
  }, [native, effectiveEmail, buildOptions, syncWithServer]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onPurchased = () => { void refresh(); };
    window.addEventListener('ss-store-purchase', onPurchased);
    return () => window.removeEventListener('ss-store-purchase', onPurchased);
  }, [refresh]);

  const purchase = useCallback(
    async (productId: string) => {
      setError(null);
      const offerings = await loadStoreOfferings();
      const match = offerings.find((o) => o.productId === productId);
      if (!match) {
        setError('That plan is not available in the store right now.');
        return { ok: false };
      }

      setPurchasing(productId);
      const result = await purchaseStorePackage(match.pkg);
      if (result.ok) {
        await syncWithServer();
        await refresh();
      } else if (!result.cancelled) {
        setError(result.error ?? 'Purchase failed');
      }
      setPurchasing(null);
      return result;
    },
    [refresh, syncWithServer],
  );

  const restore = useCallback(async () => {
    setError(null);
    setLoading(true);
    const state = await restoreStorePurchases();
    setActiveProductIds(currentStoreProductIds(state.productIds));
    await syncWithServer();
    await refresh();
    return state;
  }, [refresh, syncWithServer]);

  return {
    isNativeApp: native,
    ready,
    loading,
    purchasing,
    options,
    activeProductIds,
    hasStoreSubscription: activeProductIds.length > 0,
    hasWebSubscription,
    error,
    purchase,
    restore,
    refresh,
  };
};
