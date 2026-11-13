import {
  getStoredAttribution,
  getStoredFbclid,
  getStoredFbc,
  getStoredFbp,
  captureAttribution,
  captureFbclid,
  captureFbCookies,
} from "@/utils/fbAttribution";
import { isTestTraffic } from "@/utils/testTraffic";

const val = (root: ParentNode, cls: string): string | undefined => {
  const el = root.querySelector<HTMLInputElement>(`.${cls}`);
  const v = el?.value?.trim();
  return v || undefined;
};

const sent = new Set<string>();

/** Where the just-registered email is stashed for the thank-you page. */
export const REG_EMAIL_KEY = "wk_reg_email";
/** Name + email kept for the confirmation page (not cleared by the Lead claim). */
export const REG_CONTACT_KEY = "wk_reg_contact";

/**
 * Reads what the visitor typed into the WebinarKit registration form and sends it,
 * with ad attribution (fbclid, utm, referrer), to our own capture endpoint.
 * Never blocks or interferes with WebinarKit's own submission.
 */
export function captureWebinarRegistration(form: ParentNode) {
  try {
    captureFbclid();
    captureFbCookies();
    captureAttribution();

    const email = val(form, "wk_registration_form_email")?.toLowerCase();
    // The click fires before WebinarKit validates the form, so skip
    // half-typed addresses instead of sending them (the server rejects them).
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    const attribution = getStoredAttribution();
    const payload = {
      webinar_id:
        form
          .querySelector<HTMLElement>("[data-wk-webinar-id]")
          ?.getAttribute("data-wk-webinar-id") ?? undefined,
      first_name: val(form, "wk_registration_form_first_name"),
      last_name: val(form, "wk_registration_form_last_name"),
      email,
      phone: val(form, "wk_registration_form_phone"),
      do_you_have_highlevel: val(form, "wk_registration_form_custom_field_1"),
      session_date_text:
        val(form, "wk_registration_form_date_text") ||
        form.querySelector<HTMLSelectElement>(".wk_registration_form_date")
          ?.selectedOptions?.[0]?.textContent?.trim() ||
        undefined,
      fbclid: getStoredFbclid() ?? undefined,
      fbc: getStoredFbc() ?? undefined,
      fbp: getStoredFbp() ?? undefined,
      ...attribution,
      page: window.location.pathname,
      page_url: window.location.href,
      is_test: isTestTraffic(),
    };

    const key = `${email}|${payload.session_date_text ?? ""}`;
    if (sent.has(key)) return;
    sent.add(key);

    // The thank-you page uses this to claim the registration's Meta event id.
    try {
      localStorage.setItem(REG_EMAIL_KEY, email);
      localStorage.setItem(REG_CONTACT_KEY, JSON.stringify({ email, first_name: payload.first_name || "" }));
    } catch {
      /* ignore */
    }

    // WebinarKit redirects immediately after submit, so this must survive
    // the page unload: keepalive keeps the request alive through navigation.
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webinar-register-capture`;
    void fetch(url, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(payload),
    }).catch((e) => console.warn("registration capture failed", e));
  } catch (e) {
    console.warn("registration capture error", e);
  }
}

/**
 * Watches the page for WebinarKit "SAVE MY SEAT" clicks and captures each one.
 * Returns a cleanup function.
 */
export function watchWebinarRegistrationForms(): () => void {
  const onClick = (event: Event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLElement>('[onclick*="webinar_registration_submit"]');
    if (!button) return;
    const form = button.closest(".wk_registration_form") ?? document;
    captureWebinarRegistration(form);
  };

  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
