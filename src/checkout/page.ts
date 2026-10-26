import { createWebPaywall } from "../renderer/create-web-paywall";
import type { WebPaywall, WebPaywallCheckout } from "../renderer/types";
import { createApiClient } from "./api";
import { showSandboxBanner } from "./banner";
import { createPageEvents } from "./events";
import { parsePayload, type PagePayload } from "./payload";

export interface MountedPage {
  readonly payload: PagePayload;
  readonly paywall: WebPaywall;
  destroy: () => void;
}

// Checkout is not wired yet (apphud-js-plan.md п. 7–11): the slot stays empty
// and, with no submit, the template's pay button stays hidden.
const createInertCheckout = (): WebPaywallCheckout => ({
  mount() {},
  setPlan() {},
  unmount() {},
});

// Language of the template texts: data keys are `en`, `ru`, …
const language = (locale: string | null | undefined) =>
  (locale || "en").split(/[-_]/)[0].toLowerCase() || "en";

const PAGE_CSS = "html, body { margin: 0; padding: 0; }";

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
 * preview: no checkout and no events.
 */
export function mount(el: HTMLElement, raw: unknown): MountedPage {
  const payload = parsePayload(raw);
  const doc = el.ownerDocument;
  const view = doc.defaultView;
  const api = payload.customer
    ? createApiClient({ apiHost: payload.apiHost, apiKey: payload.apiKey })
    : null;
  const events = createPageEvents(api, payload);

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
    checkout: createInertCheckout(),
    returnUrl: null,
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
