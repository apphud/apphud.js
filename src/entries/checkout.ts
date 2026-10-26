// Hosted web paywall page (web/v3/apphud-checkout.js): renderer, checkout core
// and page wiring. No customer creation, cookies or attribution here.
import { mount } from "../checkout/page";

export { mount };

const PAYWALL_ID = "apphud-paywall";
const PAYLOAD_ID = "apphud-paywall-payload";

// The backend page holds both elements and loads this script after them.
function autoMount() {
  const el = document.getElementById(PAYWALL_ID);
  const source = document.getElementById(PAYLOAD_ID);
  if (!el || !source) return;
  try {
    mount(el, source.textContent ?? "");
  } catch (error) {
    console.error("Apphud: the web paywall was not mounted", error);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount, { once: true });
  } else {
    autoMount();
  }
}
