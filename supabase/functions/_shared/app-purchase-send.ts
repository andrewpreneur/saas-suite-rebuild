import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import {
  appPurchaseClaimKey,
  deliverClaimedStapePurchase,
  purchaseRoutePlan,
  type PurchaseActionDb,
  type PurchaseRoute,
  type StapeDataPurchaseInput,
  type StapePost,
} from "./stape-purchase.ts";

export function subscriptionPurchasePlan(input: {
  isTest: boolean;
  utmSource?: string | null;
  explicitTestEventCode?: string | null;
}): PurchaseRoute {
  return purchaseRoutePlan({
    serverUrl: Deno.env.get("STAPE_SERVER_URL"),
    purchasePath: Deno.env.get("STAPE_PURCHASE_PATH"),
    eventName: Deno.env.get("STAPE_EVENT_NAME"),
    isTest: input.isTest,
    utmSource: input.utmSource,
    explicitTestEventCode: input.explicitTestEventCode,
    stapeTestEventCode: Deno.env.get("STAPE_TEST_EVENT_CODE"),
    metaTestEventCode: Deno.env.get("META_TEST_EVENT_CODE"),
  });
}

export function stapePurchasePost(orderId: string): StapePost {
  return async (url, body, headers) => {
    const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(4000) });
    console.log("purchase route stape http", orderId, res.status);
    return { ok: res.ok };
  };
}

/** One JSON Purchase per app order. The claim key is purchase:<session id>, separate from kit meta:<id>. */
export async function sendClaimedSubscriptionPurchase(input: {
  plan: Extract<PurchaseRoute, { route: "stape" }>;
  orderId: string;
  purchase: StapeDataPurchaseInput;
}): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error("purchase route stape claim unavailable", input.orderId);
    return;
  }
  const db = createClient(supabaseUrl, serviceKey) as unknown as PurchaseActionDb;
  await deliverClaimedStapePurchase({
    plan: input.plan,
    purchase: input.purchase,
    orderId: input.orderId,
    db,
    claimKey: appPurchaseClaimKey(input.orderId),
    post: stapePurchasePost(input.orderId),
  });
}
