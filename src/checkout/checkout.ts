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
import { createStripeCheckout, type StripeCheckoutOptions } from "./stripe";
import { checkoutText } from "./texts";

export interface PageCheckoutOptions {
  payload: PagePayload;
  api: ApiClient;
  // The paywall's host element, outside its shadow root (see below).
  host: HTMLElement;
  // Called once the provider confirms a payment: sync and the success page.
  complete: (payment: CompletedPayment) => Promise<PayResult>;
  loadPaddle?: PaddleCheckoutOptions["loadPaddle"];
  loadStripe?: StripeCheckoutOptions["loadStripe"];
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

// Kinds the page can pay with, the first preferred when a plan sells through
// both: Stripe shows the wallets and the card right in the paywall.
const SUPPORTED: PaymentKind[] = ["stripe", "paddle"];

// Provider forms look their mount point up in the document (Paddle by class
// name) and wallets dislike shadow DOM, so they live in a light-DOM child of
// the host that the template's [data-checkout] shows through a <slot>.
const SLOT_NAME = "apphud-checkout";

const PROVIDERS_CSS = `
.aph-providers { display: flex; gap: 8px; margin-bottom: 12px; }
.aph-providers[hidden] { display: none; }
.aph-providers button {
  flex: 1; height: 40px; padding: 0 12px; cursor: pointer;
  border: 1px solid var(--wp-field-border, #ccc); border-radius: var(--wp-radius, 12px);
  background: var(--wp-field, transparent); color: var(--wp-text, inherit);
  font: inherit; font-size: 15px;
}
.aph-providers button[aria-selected="true"] { border-color: var(--wp-accent, currentColor); }
`;

/**
 * The checkout of the hosted page: picks the provider of the selected plan
 * from `payment_kinds` and the page's providers, and hands the slot to it.
 * A plan sold through both Stripe and Paddle gets buttons to choose.
 */
export function createPageCheckout(
  options: PageCheckoutOptions,
): WebPaywallCheckout {
  const { payload, api, host, complete } = options;
  const doc = host.ownerDocument;
  const providers = new Map(payload.providers.map((p) => [p.kind, p]));
  // one form per kind for the page: Paddle.js and Stripe.js initialize once
  const forms = new Map<PaymentKind, WebPaywallCheckout>();
  let ctx: CheckoutContext | null = null;
  // the template's [data-checkout], inside the shadow root
  let slot: HTMLElement | null = null;
  let frame: HTMLElement | null = null;
  let tabs: HTMLElement | null = null;
  let body: HTMLElement | null = null;
  let listeners: AbortController | null = null;
  let plan: PlanProduct | null = null;
  // the buyer's choice, kept while the next plan sells through it
  let chosen: PaymentKind | null = null;
  let current: { kind: PaymentKind; form: WebPaywallCheckout } | null = null;

  const theme = () =>
    slot?.closest("[data-theme]")?.getAttribute("data-theme") ?? "dark";

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
    }
    if (!form && provider && kind === "stripe") {
      form = createStripeCheckout({
        api,
        payload,
        provider,
        complete,
        theme,
        loadStripe: options.loadStripe,
      });
    }
    if (form) forms.set(kind, form);
    return form ?? null;
  };

  const kindsFor = (product: PlanProduct | null): PaymentKind[] => {
    const kinds = product?.bundle_id
      ? (payload.paymentKinds[product.bundle_id] ?? [])
      : [];
    return SUPPORTED.filter(
      (kind) => kinds.includes(kind) && providers.has(kind),
    );
  };

  const renderTabs = (kinds: PaymentKind[], active: PaymentKind | null) => {
    if (!tabs || !ctx) return;
    tabs.hidden = kinds.length < 2;
    tabs.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const kind = button.dataset.kind as PaymentKind;
      button.hidden = !kinds.includes(kind);
      button.setAttribute("aria-selected", String(kind === active));
      button.textContent = checkoutText(
        ctx as CheckoutContext,
        `payment.provider_${kind}`,
      );
    });
  };

  const switchTo = (kind: PaymentKind | null) => {
    if (current?.kind === kind) return;
    current?.form.unmount();
    current = null;
    if (body) body.textContent = "";
    const form = kind && formFor(kind);
    if (!ctx || !body || !kind || !form) {
      ctx?.setSubmit(false);
      return;
    }
    current = { kind, form };
    ctx.setSubmit(!!form.submit);
    void form.mount(body, ctx);
  };

  const apply = () => {
    const kinds = kindsFor(plan);
    const kind = chosen && kinds.includes(chosen) ? chosen : (kinds[0] ?? null);
    renderTabs(kinds, kind);
    switchTo(kind);
    current?.form.setPlan(plan);
  };

  return {
    mount(target, context) {
      ctx = context;
      slot = target;
      listeners = new AbortController();
      const projection = doc.createElement("slot");
      projection.name = SLOT_NAME;
      target.append(projection);

      frame = doc.createElement("div");
      frame.slot = SLOT_NAME;
      const style = doc.createElement("style");
      style.textContent = PROVIDERS_CSS;
      tabs = doc.createElement("div");
      tabs.className = "aph-providers";
      tabs.setAttribute("role", "tablist");
      tabs.hidden = true;
      SUPPORTED.forEach((kind) => {
        const button = doc.createElement("button");
        button.type = "button";
        button.setAttribute("role", "tab");
        button.dataset.kind = kind;
        button.addEventListener(
          "click",
          () => {
            if (!ctx || ctx.busy() || current?.kind === kind) return;
            chosen = kind;
            ctx.clearError();
            apply();
          },
          { signal: listeners?.signal },
        );
        tabs?.append(button);
      });
      body = doc.createElement("div");
      frame.append(style, tabs, body);
      host.append(frame);
      ctx.setSubmit(false);
    },
    setPlan(product) {
      plan = product;
      apply();
    },
    submit() {
      current?.form.submit?.();
    },
    refresh() {
      if (current) renderTabs(kindsFor(plan), current.kind);
      return current?.form.refresh?.();
    },
    unmount() {
      current?.form.unmount();
      current = null;
      listeners?.abort();
      listeners = null;
      frame?.remove();
      frame = tabs = body = slot = null;
      ctx = null;
    },
  };
}
