import { sendMetaPurchase } from "./meta-capi.ts";
import { postKitServerPurchase, stapePurchaseUrl } from "./kit-stape.ts";
import { kitMetaUserData, type KitMetaPurchase } from "./kit-meta.ts";
import { metaSendPlan, metaTestEventCode } from "./test-traffic.ts";
import {
  purchaseRoutePlan,
  routeServerPurchase,
  stapePurchaseFromKit,
  type PurchaseRoute,
} from "./stape-purchase.ts";

export function kitPurchaseRoute(user: ReturnType<typeof kitMetaUserData>): PurchaseRoute {
  return purchaseRoutePlan({
    serverUrl: Deno.env.get("STAPE_SERVER_URL"),
    purchasePath: Deno.env.get("STAPE_PURCHASE_PATH"),
    eventName: Deno.env.get("STAPE_EVENT_NAME"),
    isTest: user.isTest === true,
    utmSource: user.utmSource,
    explicitTestEventCode: user.testEventCode,
    stapeTestEventCode: Deno.env.get("STAPE_TEST_EVENT_CODE"),
    metaTestEventCode: Deno.env.get("META_TEST_EVENT_CODE"),
  });
}

/**
 * Stape Data Client when STAPE_SERVER_URL is set.
 * Otherwise the existing GA4 Stape URL or direct meta-capi Purchase.
 */
export async function sendKitRoutedPurchase(input: {
  route: PurchaseRoute;
  purchase: KitMetaPurchase;
  user: ReturnType<typeof kitMetaUserData>;
  externalId: string | null;
}): Promise<boolean> {
  const eventTimeSec = Math.floor(Date.now() / 1000);
  const fields = stapePurchaseFromKit(input.purchase, input.user, input.externalId, eventTimeSec);
  const result = await routeServerPurchase({
    plan: input.route,
    orderId: input.purchase.orderId,
    purchase: fields,
    post: async (url, body, headers) => {
      const res = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(4000) });
      console.log("purchase route stape http", input.purchase.orderId, res.status);
      return { ok: res.ok };
    },
    sendDirect: async () => {
      const tracked = await postKitServerPurchase({
        stapeUrl: stapePurchaseUrl(Deno.env.get("STAPE_PURCHASE_URL")),
        measurementId: Deno.env.get("STAPE_MEASUREMENT_ID"),
        apiSecret: Deno.env.get("STAPE_API_SECRET"),
        stapeToken: Deno.env.get("STAPE_PURCHASE_TOKEN"),
        purchase: {
          eventId: input.purchase.eventId,
          eventTimeSec,
          value: input.purchase.value,
          currency: input.purchase.currency,
          orderId: input.purchase.orderId,
          email: input.user.email,
          phone: input.user.phone,
          firstName: input.user.firstName,
          fbp: input.user.fbp,
          fbc: input.user.fbc,
          fbclid: input.user.fbclid,
          eventSourceUrl: input.user.pageUrl,
          clientIp: input.user.clientIp,
          clientUserAgent: input.user.clientUa,
          externalId: input.externalId,
          contentIds: input.purchase.contentIds,
          contents: input.purchase.contents,
          contentType: input.purchase.contentType,
          contentName: input.purchase.contentName,
          numItems: input.purchase.numItems,
          testEventCode: metaSendPlan(
            input.user.isTest === true,
            metaTestEventCode(Deno.env.get("META_TEST_EVENT_CODE")),
          ).testEventCode,
        },
        post: async (url, raw, headers) => {
          const res = await fetch(url, { method: "POST", headers, body: raw, signal: AbortSignal.timeout(4000) });
          return { ok: res.ok };
        },
        sendMeta: () => sendMetaPurchase({
          orderId: input.purchase.orderId,
          email: input.user.email,
          value: input.purchase.value,
          currency: input.purchase.currency,
          fbclid: input.user.fbclid,
          fbc: input.user.fbc,
          fbp: input.user.fbp,
          eventSourceUrl: input.user.pageUrl,
          phone: input.user.phone,
          firstName: input.user.firstName,
          externalId: input.externalId,
          clientIp: input.user.clientIp,
          clientUserAgent: input.user.clientUa,
          contentIds: input.purchase.contentIds,
          contents: input.purchase.contents,
          contentType: input.purchase.contentType,
          contentName: input.purchase.contentName,
          numItems: input.purchase.numItems,
          isTest: input.user.isTest,
        }),
      });
      if (!tracked.ok) console.error("kit purchase tracking", tracked.via, input.purchase.orderId);
      return tracked.ok;
    },
  });
  return result.via === "skip" ? true : result.ok;
}
