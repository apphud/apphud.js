import type { WebPaywallCheckout } from "../renderer/types";
import type { ApiClient } from "./api";
import type { PagePayload } from "./payload";
import type { createPurchaseCompleter } from "./purchase";

export interface PageCheckoutOptions {
  payload: PagePayload;
  api: ApiClient;
  // the checkout core calls it once the provider confirms a payment
  complete: ReturnType<typeof createPurchaseCompleter>;
}

// The checkout core (Stripe, Paddle, apphud-js-plan.md п. 7–11) is not wired
// yet: the slot stays empty and, with no submit, the template's pay button
// stays hidden. A preview (no customer) gets this one for good.
export function createInertCheckout(): WebPaywallCheckout {
  return {
    mount() {},
    setPlan() {},
    unmount() {},
  };
}

export function createPageCheckout(
  options: PageCheckoutOptions,
): WebPaywallCheckout {
  void options;
  return createInertCheckout();
}
