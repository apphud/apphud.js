import { createWebPaywall } from "../renderer/create-web-paywall";
import type { WebPaywall } from "../renderer/types";
import { createApiClient } from "./api";
import { showSandboxBanner } from "./banner";
import { createPageCheckout } from "./checkout";
import { createPageEvents } from "./events";
import { parsePayload, type PagePayload } from "./payload";
import { createPurchaseCompleter, returnUrlFor } from "./purchase";

export interface MountedPage {
  readonly payload: PagePayload;
  readonly paywall: WebPaywall;
  destroy: () => void;
}

// Language of the template texts: data keys are `en`, `ru`, …
const language = (locale: string | null | undefined) =>
  (locale || "en").split(/[-_]/)[0].toLowerCase() || "en";

// The page scrolls as on a phone, without a scroll bar: a desktop browser
// (and the dashboard's preview frame) would draw one over the paywall.
const PAGE_CSS = `html, body { margin: 0; padding: 0; }
html { scrollbar-width: none; }
html::-webkit-scrollbar { display: none; }`;

const pageStyle = (doc: Document) => {
  let style = doc.querySelector<HTMLStyleElement>("style[data-apphud-page]");
  if (!style) {
    style = doc.createElement("style");
    style.setAttribute("data-apphud-page", "");
    doc.head.append(style);
  }
  style.textContent = PAGE_CSS;
  return style;
};

/**
 * Renders the hosted web paywall from its page payload into `el` (a shadow root
 * keeps the template's CSS and the page apart). Without a customer it is a
 * preview: a mock payment form whose buttons do nothing, and no events.
 */
export function mount(el: HTMLElement, raw: unknown): MountedPage {
  const doc = el.ownerDocument;
  const view = doc.defaultView;
  const payload = parsePayload(raw, view?.location.search);
  const api = payload.customer
    ? createApiClient({ apiHost: payload.apiHost, apiKey: payload.apiKey })
    : null;
  const events = createPageEvents(api, payload);
  const returnUrl = returnUrlFor(payload, view?.navigator.userAgent ?? "");
  const checkout = api
    ? createPageCheckout({
        payload,
        api,
        host: el,
        complete: createPurchaseCompleter({
          api,
          payload,
          returnUrl,
          redirect: (url) => view?.location.replace(url),
        }),
      })
    : undefined;

  const style = pageStyle(doc);
  doc.querySelector("[data-apphud-sandbox]")?.remove();
  const banner =
    payload.environment === "sandbox" ? showSandboxBanner(doc) : null;

  const shadow = el.shadowRoot ?? el.attachShadow({ mode: "open" });
  const paywall = createWebPaywall(shadow, {
    templates: [
      {
        name: "paywall",
        title: "",
        html: payload.screen.html,
        css: payload.screen.css,
        schema: [],
        data: payload.screen.data,
      },
    ],
    template: "paywall",
    locale: language(payload.customer?.locale ?? view?.navigator.language),
    defaultLocale: "en",
    hosted: true,
    checkout,
    // a preview: the renderer's mock form, and no payment starts
    simulatePayments: false,
    returnUrl,
    onEvent: (event, properties) => {
      if (event === "shown") events.track("paywall_shown");
      if (event === "checkout_initiated") {
        events.track("paywall_checkout_initiated", {
          bundle_id: properties.bundle_id,
        });
      }
      if (event === "payment_error") {
        events.track("paywall_payment_error", {
          provider: properties.provider,
          code: properties.code,
          message: properties.message,
          bundle_id: properties.bundle_id,
        });
      }
    },
  });

  // Overscroll and the area under a short paywall take the template background.
  void paywall.ready.then(() => {
    const background = shadow
      .getElementById("wp-root")
      ?.style.getPropertyValue("--wp-background");
    // set through CSSOM: the token is screen data, never CSS text
    if (background) doc.documentElement.style.background = background;
  });

  return {
    payload,
    paywall,
    destroy() {
      paywall.destroy();
      banner?.remove();
      style.remove();
      doc.documentElement.style.removeProperty("background");
    },
  };
}
