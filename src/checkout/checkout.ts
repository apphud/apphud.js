import type {
  CheckoutContext,
  PayResult,
  PlanProduct,
  WebPaywallCheckout,
} from "../renderer/types";
import type { ApiClient } from "./api";
import { createPaddleCheckout, type PaddleCheckoutOptions } from "./paddle";
import type { PagePayload, PaymentKind } from "./payload";
import type { CompletedPayment } from "./purchase";

export interface PageCheckoutOptions {
  payload: PagePayload;
  api: ApiClient;
  // The paywall's host element, outside its shadow root (see below).
  host: HTMLElement;
  // Called once the provider confirms a payment: sync and the success page.
  complete: (payment: CompletedPayment) => Promise<PayResult>;
  loadPaddle?: PaddleCheckoutOptions["loadPaddle"];
}

// A preview (no customer) never pays: the slot stays empty and, with no
// submit, the template's pay button stays hidden.
export function createInertCheckout(): WebPaywallCheckout {
  return {
    mount() {},
    setPlan() {},
    unmount() {},
  };
}

// Kinds this release can pay with. Stripe waits for Checkout Sessions
// (apphud-js-plan.md п. 9): a plan sold only through Stripe shows no form yet.
const SUPPORTED: PaymentKind[] = ["paddle"];

// Provider forms look their mount point up in the document (Paddle by class
// name) and wallets dislike shadow DOM, so they live in a light-DOM child of
// the host that the template's [data-checkout] shows through a <slot>.
const SLOT_NAME = "apphud-checkout";

/**
 * The checkout of the hosted page: picks the provider of the selected plan
 * from `payment_kinds` and the page's providers, and hands the slot to it.
 */
export function createPageCheckout(
  options: PageCheckoutOptions,
): WebPaywallCheckout {
  const { payload, api, host, complete } = options;
  const doc = host.ownerDocument;
  const providers = new Map(payload.providers.map((p) => [p.kind, p]));
  // one form per kind for the page: Paddle.js initializes once
  const forms = new Map<PaymentKind, WebPaywallCheckout>();
  let ctx: CheckoutContext | null = null;
  let frame: HTMLElement | null = null;
  let current: { kind: PaymentKind; form: WebPaywallCheckout } | null = null;

  const formFor = (kind: PaymentKind) => {
    let form = forms.get(kind);
    const provider = providers.get(kind);
    if (!form && provider && kind === "paddle") {
      form = createPaddleCheckout({
        api,
        payload,
        provider,
        complete,
        loadPaddle: options.loadPaddle,
      });
      forms.set(kind, form);
    }
    return form ?? null;
  };

  const kindFor = (product: PlanProduct | null): PaymentKind | null => {
    const kinds = product?.bundle_id
      ? (payload.paymentKinds[product.bundle_id] ?? [])
      : [];
    return (
      SUPPORTED.find((kind) => kinds.includes(kind) && providers.has(kind)) ??
      null
    );
  };

  const switchTo = (kind: PaymentKind | null) => {
    if (current?.kind === kind) return;
    current?.form.unmount();
    current = null;
    if (frame) frame.textContent = "";
    const form = kind && formFor(kind);
    if (!ctx || !frame || !kind || !form) {
      ctx?.setSubmit(false);
      return;
    }
    current = { kind, form };
    ctx.setSubmit(!!form.submit);
    void form.mount(frame, ctx);
  };

  return {
    mount(slot, context) {
      ctx = context;
      const projection = doc.createElement("slot");
      projection.name = SLOT_NAME;
      slot.append(projection);
      frame = doc.createElement("div");
      frame.slot = SLOT_NAME;
      host.append(frame);
      ctx.setSubmit(false);
    },
    setPlan(product) {
      switchTo(kindFor(product));
      current?.form.setPlan(product);
    },
    submit() {
      current?.form.submit?.();
    },
    unmount() {
      current?.form.unmount();
      current = null;
      frame?.remove();
      frame = null;
      ctx = null;
    },
  };
}
