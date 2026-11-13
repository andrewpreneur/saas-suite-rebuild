import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageSEO from "@/components/PageSEO";
import { OtherFunnelPage, SalesDocument, useEntryFunnelChrome } from "@/funnel/one-feature-kit/FunnelDocument";
import { canonicalFunnelPath, isKitHost, KIT_SITE, publicFunnelPath } from "@/funnel/one-feature-kit/host";
import { bindKitGhlOpener } from "@/funnel/one-feature-kit/kitGhlBridge";
import { FUNNEL_META, FUNNEL_PAGE_BY_PATH, type FunnelPageId } from "@/funnel/one-feature-kit/markup";
import { FUNNEL_ROUTES, loadDraft, saveDraft, ONE_FEATURE_KIT_PAYMENTS_LIVE, ONE_FEATURE_KIT_REVIEW_CHROME } from "@/funnel/one-feature-kit/order";
import { bindSalesFacades } from "@/funnel/one-feature-kit/salesFacade";
import { funnelWireBoot } from "@/funnel/one-feature-kit/bootTiming";
import { scheduleInteractOrIdle, yieldToMain } from "@/funnel/one-feature-kit/scheduleTask";
import "@/funnel/one-feature-kit/funnel.css";
import { lazyRoute } from "@/lib/lazyRoute";

const NotFound = lazyRoute(() => import("./NotFound"));
const KitGhlDialog = lazy(() =>
  import("@/funnel/one-feature-kit/KitGhlDialog").then((mod) => ({ default: mod.KitGhlDialog })),
);

type WireModule = typeof import("@/funnel/one-feature-kit/wire");

let wirePromise: Promise<WireModule> | null = null;
let wireMod: WireModule | null = null;
let enhancedPath: string | null = null;

function loadWire(): Promise<WireModule> {
  wirePromise ??= import("@/funnel/one-feature-kit/wire").then((mod) => {
    wireMod = mod;
    return mod;
  });
  return wirePromise;
}

function ensureEnhanced(root: HTMLElement, path: string) {
  return loadWire().then((mod) => {
    if (enhancedPath !== path) {
      mod.enhancePage(root, path);
      enhancedPath = path;
    }
    return mod;
  });
}

const missingFallback = (
  <div role="status" aria-label="Loading" style={{ minHeight: "100vh", background: "#fff" }} />
);

/**
 * GoHighLevel One Feature Kit funnel.
 * On onefeaturekit.com the sales page is /. On saassuite.ai it stays under /one-feature-kit.
 * Payments stay stubbed until the Price IDs in stripe.ts are filled in.
 */
const OneFeatureKit = () => {
  const { pathname, search } = useLocation();
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [confirmedSession, setConfirmedSession] = useState<string | null>(null);
  const [ghlOpen, setGhlOpen] = useState(false);
  const navigate = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const canonical = canonicalFunnelPath(pathname, hostname);
  const pageId: FunnelPageId | undefined = canonical ? FUNNEL_PAGE_BY_PATH[canonical] : undefined;
  const kitHost = isKitHost(hostname);
  const returnSession = ONE_FEATURE_KIT_PAYMENTS_LIVE && canonical === FUNNEL_ROUTES.ghl
    ? new URLSearchParams(search).get("session_id") : null;
  const verifying = Boolean(returnSession && confirmedSession !== returnSession);
  // confirmKitCheckout copies the verify response contact onto the draft.
  const confirmedBuyerEmail = returnSession && confirmedSession === returnSession
    ? loadDraft().contact.email.trim().toLowerCase()
    : "";

  useEffect(() => {
    if (!returnSession) return;
    let active = true;
    void import("@/funnel/one-feature-kit/payment").then(({ confirmKitCheckout }) =>
      confirmKitCheckout(loadDraft(), returnSession).then(result => {
        if (!active) return;
        saveDraft(result.draft);
        void import("@/funnel/one-feature-kit/tracking").then(({ trackKitCheckoutPurchase }) => {
          trackKitCheckoutPurchase({
            sessionId: returnSession,
            amountTotal: result.amountTotal,
            comped: result.comped,
            lines: result.draft.lines,
          });
        });
        setConfirmedSession(returnSession);
        setPaymentError(null);
      }).catch(error => {
        if (!active) return;
        setPaymentError(error instanceof Error ? error.message : "Payment isn't confirmed. Please try checkout again.");
        navigate(FUNNEL_ROUTES.checkout, { replace: true });
      }),
    );
    return () => { active = false; };
  }, [returnSession, navigate]);

  useEffect(() => {
    bindKitGhlOpener(() => setGhlOpen(true));
    return () => bindKitGhlOpener(null);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" } as ScrollToOptions);
    const root = contentRef.current;
    if (!root || !pageId || verifying) return;
    const path = canonical ?? pathname;
    let cancel = false;

    // A stored checkout, a cs_live_ id, or a purchase query loads thank-you
    // tracking in this turn. A cold visit still waits so network idle stays fast.
    const boot = funnelWireBoot(pageId, search);
    const deferThankYou = pageId === "thankyou" && boot === "deferred";
    const runTrack = () => {
      const start = () => {
        if (cancel) return;
        void import("@/funnel/one-feature-kit/tracking").then((mod) => {
          if (!cancel) mod.trackKitStepView(path);
        });
        void import("@/components/siteFunnelPageview").then((mod) => {
          if (!cancel) mod.trackFunnelPageview(path, confirmedBuyerEmail);
        });
      };
      if (deferThankYou) void yieldToMain().then(start);
      else start();
    };
    const cancelTrack = deferThankYou
      ? scheduleInteractOrIdle(runTrack, 12_000)
      : (() => {
          const timer = window.setTimeout(runTrack, 0);
          return () => window.clearTimeout(timer);
        })();

    const enhance = () => {
      if (cancel) return;
      void ensureEnhanced(root, path);
    };
    // Kit-host URLs (/checkout, /launch-pack, /thank-you) share the homepage
    // shell and insert their markup a moment later. Binding before that misses
    // the contact fields and the add-on buttons.
    const markupReady = (id: FunnelPageId) => {
      if (id === "checkout") return !!root.querySelector("#ofk-name");
      if (id === "launch" || id === "webinar" || id === "upsell1") return !!root.querySelector("a.btn");
      if (id === "thankyou") return !!root.querySelector("#ofk-onboard, #ofk-ty-name");
      return true;
    };
    let markupWatch: MutationObserver | null = null;
    const startWire = () => {
      if (cancel) return;
      if (markupReady(pageId)) {
        enhance();
        return;
      }
      markupWatch = new MutationObserver(() => {
        if (cancel || !markupReady(pageId)) return;
        markupWatch?.disconnect();
        markupWatch = null;
        enhance();
      });
      markupWatch.observe(root, { childList: true, subtree: true });
    };
    // Sales wire pulls checkout, Stripe, and training media. The hero thumbnail
    // is mounted on its own so the snapshot still has an LCP image.
    // Checkout, launch, and webinar bind in this effect, before the next click.
    const deferWire = boot === "deferred";
    const cancelSchedule = deferWire
      ? scheduleInteractOrIdle(startWire, pageId === "sales" ? 10_000 : 12_000)
      : (() => {
          startWire();
          return () => markupWatch?.disconnect();
        })();
    const facadeTimer = pageId === "sales"
      ? window.setTimeout(() => {
          if (!cancel) bindSalesFacades(root);
        }, 0)
      : 0;

    return () => {
      cancel = true;
      cancelTrack();
      if (facadeTimer) window.clearTimeout(facadeTimer);
      cancelSchedule();
      if (wireMod && enhancedPath === path) {
        wireMod.releaseFunnelPage();
        enhancedPath = null;
      }
    };
  }, [pathname, pageId, canonical, verifying, search, confirmedBuyerEmail]);

  const chrome = useEntryFunnelChrome(pathname, pageId);

  if (!pageId) {
    return (
      <Suspense fallback={missingFallback}>
        <NotFound />
      </Suspense>
    );
  }

  const meta = FUNNEL_META[pageId];
  const publicPath = canonical ? publicFunnelPath(canonical, hostname) : pathname;

  return (
    <>
      <PageSEO
        title={meta.title}
        description={meta.description}
        path={publicPath}
        site={kitHost ? KIT_SITE : undefined}
      />
      <div className={ONE_FEATURE_KIT_REVIEW_CHROME ? "ofk ofk-show-review" : "ofk"}>
        {paymentError && <p role="alert" className="ofk-error">{paymentError}</p>}
        {verifying ? <p role="status">Confirming your payment…</p> :
        <div
          ref={contentRef}
          onClick={(event) => {
            const root = contentRef.current;
            if (!root) return;
            const target = event.target as HTMLElement | null;
            if (target?.closest("button.ofk-facade")) return;
            const link = target?.closest("a");
            const href = link?.getAttribute("href") ?? "";
            const internal = href.startsWith("/") && !href.startsWith("//");
            const interactive = Boolean(target?.closest("a.btn, a.nothanks, button, [data-ofk-add], .bump .head, #ofk-complete, #ofk-promo-apply"));
            // Stop the browser from following the href before the wire handler runs.
            if (internal || interactive) event.preventDefault();
            const path = canonical ?? pathname;
            void ensureEnhanced(root, path).then((mod) => mod.handleFunnelClick(root, path, event, navigate));
          }}
        >
          {chrome.liveHtml != null && (
            <div className="ofk-live" role="status" dangerouslySetInnerHTML={{ __html: chrome.liveHtml }} />
          )}
          {pageId === "sales" ? <SalesDocument /> : <OtherFunnelPage pageId={pageId} />}
          {chrome.stickyHtml != null && (
            <div className="ofk-sticky-cta" hidden dangerouslySetInnerHTML={{ __html: chrome.stickyHtml }} />
          )}
        </div>}
        {ghlOpen && (
          <Suspense fallback={null}>
            <KitGhlDialog
              open={ghlOpen}
              onOpenChange={setGhlOpen}
              onContinue={() => {
                setGhlOpen(false);
                navigate(FUNNEL_ROUTES.launch);
              }}
            />
          </Suspense>
        )}
      </div>
    </>
  );
};

export default OneFeatureKit;
