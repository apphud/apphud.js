// /pure: Stripe.js loads only when a plan sells through Stripe
import { loadStripe as loadStripeJs } from "@stripe/stripe-js-dahlia/pure";
import type {
  Appearance,
  Stripe,
  StripeCheckoutConfirmResult,
  StripeCheckoutElementsSdk,
  StripeCheckoutExpressCheckoutElementOptions,
  StripeCheckoutLoadActionsSuccess,
  StripeConstructorOptions,
  StripeElementLocale,
  StripeExpressCheckoutElementConfirmEvent,
} from "@stripe/stripe-js-dahlia";
import type {
  CheckoutContext,
  PayResult,
  PlanProduct,
  WebPaywallCheckout,
} from "../renderer/types";
import type { ApiClient } from "./api";
import type { PagePayload, PageProvider } from "./payload";
import type { CompletedPayment } from "./purchase";
import { createSubscription } from "./subscriptions";
import { checkoutText } from "./texts";

// Stripe on the hosted page (apphud-js-plan.md п. 9). Each plan gets a Checkout
// Session of the new contract (ui_mode: elements) when it is selected; its
// Express Checkout Element (Apple Pay, Google Pay) and Payment Element fill the
// slot. The template's pay button confirms the card, a wallet confirms itself;
// the session id goes to sync. Link and PayPal stay hidden: they fail in
// WebViews. Stripe.js is v9, the release train of the backend's API version
// (2026-03-25.dahlia).

export interface StripeCheckoutOptions {
  api: ApiClient;
  payload: PagePayload;
  provider: PageProvider;
  complete: (payment: CompletedPayment) => Promise<PayResult>;
  // The template's theme (`dark`, `light`): Stripe's fields follow it.
  theme: () => string;
  loadStripe?: (
    token: string,
    options?: StripeConstructorOptions,
  ) => Promise<Stripe | null>;
}

interface Session {
  sdk: StripeCheckoutElementsSdk;
  actions: StripeCheckoutLoadActionsSuccess;
}

type Prepared =
  { ok: true; session: Session } | { ok: false; error: PayResult };

const STYLE = `
.aph-stripe { display: flex; flex-direction: column; gap: 10px; font: inherit; }
.aph-stripe__or { display: none; color: var(--wp-text-tertiary, #888); font-size: 13px; text-align: center; }
.aph-stripe.has-wallet .aph-stripe__or { display: block; }
.aph-stripe__email {
  box-sizing: border-box; width: 100%; height: 48px; padding: 0 14px; outline: 0;
  border: 1px solid var(--wp-field-border, #ccc); border-radius: var(--wp-radius, 12px);
  background: var(--wp-field, transparent); color: var(--wp-text, inherit);
  font: inherit; font-size: 16px;
}
.aph-stripe__email::placeholder { color: var(--wp-text-tertiary, #888); }
.aph-stripe__email.is-invalid { border-color: var(--wp-danger, #e5344f); }
`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HEX = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

const EXPRESS_OPTIONS = {
  paymentMethods: {
    link: "never",
    paypal: "never",
    amazonPay: "never",
    klarna: "never",
  },
} as StripeCheckoutExpressCheckoutElementOptions;

export function createStripeCheckout(
  options: StripeCheckoutOptions,
): WebPaywallCheckout {
  const { api, payload, provider, complete } = options;
  const loadStripe = options.loadStripe ?? loadStripeJs;
  let ctx: CheckoutContext | null = null;
  let frame: HTMLElement | null = null;
  let box: {
    root: HTMLElement;
    express: HTMLElement;
    or: HTMLElement;
    email: HTMLInputElement | null;
    card: HTMLElement;
  } | null = null;
  let listeners: AbortController | null = null;
  let bundleId = "";
  // the session whose elements are in the slot
  let shown: Session | null = null;
  let cardComplete = false;
  // Bumped on every plan switch: a session that arrives late is not shown.
  let seq = 0;
  let stripe: Promise<Stripe | null> | null = null;
  // One session per plan for the page: going back to a plan reuses it.
  const sessions = new Map<string, Promise<Prepared>>();

  const failure = (code: string, detail?: string | null): Prepared => ({
    ok: false,
    error: {
      error: "generic",
      provider: "stripe",
      code,
      detail: detail ?? undefined,
    },
  });

  const ensureStripe = () => {
    stripe ??= loadStripe(provider.token, {
      // providers are connected accounts
      ...(provider.identifier && { stripeAccount: provider.identifier }),
      locale: (ctx?.locale() ?? "auto") as StripeElementLocale,
    }).catch((error) => {
      stripe = null;
      throw error;
    });
    return stripe;
  };

  // Stripe's fields take the template's colors from the slot's CSS tokens.
  const appearance = (): Appearance => {
    const style =
      frame && frame.ownerDocument.defaultView?.getComputedStyle(frame);
    const token = (name: string) =>
      style?.getPropertyValue(name).trim() || undefined;
    const background = token("--wp-background");
    const variables = Object.fromEntries(
      Object.entries({
        colorPrimary: token("--wp-accent"),
        colorDanger: token("--wp-danger"),
        borderRadius: token("--wp-radius"),
        // Stripe takes no gradients or transparency here
        colorBackground: background && HEX.test(background) ? background : "",
      }).filter(([, value]) => value),
    );
    return {
      theme: options.theme() === "light" ? "stripe" : "night",
      variables,
    };
  };

  const returnUrl = () => frame?.ownerDocument.defaultView?.location.href;

  function prepare(bundle: string): Promise<Prepared> {
    const cached = sessions.get(bundle);
    if (cached) return cached;
    const pending = (async (): Promise<Prepared> => {
      const [instance, created] = await Promise.all([
        ensureStripe().catch(() => null),
        createSubscription(api, payload, provider, bundle),
      ]);
      if (!created.ok) {
        return failure(`create_${created.status}`, created.message);
      }
      if (!instance) {
        stripe = null;
        return failure("stripe_unavailable");
      }
      if (!created.clientSecret) return failure("no_client_secret");
      const sdk = instance.initCheckoutElementsSdk({
        clientSecret: created.clientSecret,
        elementsOptions: { appearance: appearance() },
      });
      const loaded = await sdk.loadActions();
      if (loaded.type === "error") {
        return failure("load_actions", loaded.error.message);
      }
      return { ok: true, session: { sdk, actions: loaded.actions } };
    })().catch((error) => failure("stripe_error", String(error)));
    sessions.set(bundle, pending);
    // a plan that failed asks for a new session next time
    void pending.then((prepared) => {
      if (!prepared.ok) sessions.delete(bundle);
    });
    return pending;
  }

  const settle = (
    result: StripeCheckoutConfirmResult,
  ): Promise<PayResult> | PayResult => {
    if (result.type === "success") {
      return complete({
        kind: "stripe",
        providerId: provider.id,
        purchaseId: result.session.id,
      });
    }
    const { error } = result;
    if (error.code === "paymentFailed") {
      return {
        error: "declined",
        provider: "stripe",
        code: error.paymentFailed.declineCode ?? "payment_failed",
        detail: error.message,
      };
    }
    // Stripe's own text for the buyer, e.g. an incomplete card
    return {
      error: "generic",
      message: error.message,
      provider: "stripe",
      code: "confirm_failed",
    };
  };

  async function payCard(
    bundle: string,
    email: string,
    emailError: string,
  ): Promise<PayResult> {
    const prepared = await prepare(bundle);
    if (!prepared.ok) return prepared.error;
    const { actions } = prepared.session;
    if (payload.emailRequired) {
      const updated = await actions.updateEmail(email);
      if (updated.type === "error") {
        return {
          error: "email",
          message: emailError,
          provider: "stripe",
          code: updated.error.code,
          detail: updated.error.message,
        };
      }
    }
    return settle(
      await actions.confirm({
        redirect: "if_required",
        returnUrl: returnUrl(),
      }),
    );
  }

  function payWallet(
    session: Session,
    event: StripeExpressCheckoutElementConfirmEvent,
  ) {
    if (!ctx || ctx.busy() || shown !== session) {
      event.paymentFailed({ reason: "fail" });
      return;
    }
    void ctx.pay(event.expressPaymentType, async () =>
      settle(
        await session.actions.confirm({
          expressCheckoutConfirmEvent: event,
          redirect: "if_required",
          returnUrl: returnUrl(),
        }),
      ),
    );
  }

  function hide() {
    if (shown) {
      shown.sdk.getExpressCheckoutElement()?.destroy();
      shown.sdk.getPaymentElement()?.destroy();
      shown = null;
    }
    cardComplete = false;
    box?.root.classList.remove("has-wallet");
  }

  function attach(session: Session) {
    if (!box) return;
    shown = session;
    session.sdk.changeAppearance(appearance());

    const express = session.sdk.createExpressCheckoutElement(EXPRESS_OPTIONS);
    express.on("ready", (event) => {
      const available = Object.values(event.availablePaymentMethods ?? {}).some(
        Boolean,
      );
      box?.root.classList.toggle("has-wallet", available);
    });
    express.on("confirm", (event) => payWallet(session, event));
    express.mount(box.express);

    const card = session.sdk.createPaymentElement({
      paymentMethodOrder: ["card"],
      wallets: { applePay: "never", googlePay: "never", link: "never" },
    });
    card.on("change", (event) => {
      cardComplete = event.complete;
    });
    card.mount(box.card);
  }

  // Shows the selected plan's form; `wait` keeps the paywall in processing
  // until it is there (the pay button was pressed before it loaded).
  async function show(wait: boolean) {
    const token = ++seq;
    hide();
    if (!ctx || !bundleId) {
      ctx?.setSubmit(false);
      return;
    }
    ctx.setSubmit(true);
    const bundle = bundleId;
    const prepared = await (wait
      ? ctx.wait(() => prepare(bundle))
      : prepare(bundle));
    if (token !== seq || !ctx || !box) return;
    if (!prepared.ok) {
      ctx.fail(prepared.error);
      return;
    }
    attach(prepared.session);
  }

  function renderTexts() {
    if (!ctx || !box) return;
    box.or.textContent = checkoutText(ctx, "payment.divider");
    if (box.email) {
      box.email.placeholder = checkoutText(ctx, "payment.email_placeholder");
    }
  }

  return {
    mount(target, context) {
      ctx = context;
      frame = target;
      listeners = new AbortController();
      const doc = target.ownerDocument;
      const el = <K extends keyof HTMLElementTagNameMap>(
        tag: K,
        className: string,
      ) => {
        const node = doc.createElement(tag);
        node.className = className;
        return node;
      };

      const style = el("style", "");
      style.textContent = STYLE;
      const root = el("div", "aph-stripe");
      const express = el("div", "aph-stripe__express");
      const or = el("div", "aph-stripe__or");
      const card = el("div", "aph-stripe__card");
      let email: HTMLInputElement | null = null;
      root.append(express, or);
      if (payload.emailRequired) {
        email = el("input", "aph-stripe__email");
        email.type = "email";
        email.name = "email";
        email.autocomplete = "email";
        email.inputMode = "email";
        email.addEventListener(
          "input",
          () => {
            email?.classList.remove("is-invalid");
            ctx?.clearError();
          },
          { signal: listeners.signal },
        );
        root.append(email);
      }
      root.append(card);
      target.append(style, root);
      box = { root, express, or, email, card };
      renderTexts();
      // warm up Stripe.js while the buyer reads the paywall
      void ensureStripe().catch(() => {});
    },
    setPlan(product: PlanProduct | null) {
      const next = product?.bundle_id ?? "";
      if (next === bundleId && shown) return;
      bundleId = next;
      void show(false);
    },
    submit() {
      if (!ctx || ctx.busy() || !bundleId) return;
      ctx.clearError();
      if (!shown) {
        // pressed before the form loaded, or after it failed to
        void show(true);
        return;
      }
      const email = box?.email?.value.trim() ?? "";
      const emailError = checkoutText(ctx, "errors.email");
      if (payload.emailRequired && !EMAIL.test(email)) {
        box?.email?.classList.add("is-invalid");
        box?.email?.focus();
        ctx.fail({ error: "email", message: emailError });
        return;
      }
      if (!cardComplete) {
        shown.sdk.getPaymentElement()?.focus();
        ctx.fail({ error: "incomplete" });
        return;
      }
      const bundle = bundleId;
      void ctx.pay("card", () => payCard(bundle, email, emailError));
    },
    refresh() {
      renderTexts();
      shown?.sdk.changeAppearance(appearance());
    },
    unmount() {
      seq++;
      hide();
      listeners?.abort();
      listeners = null;
      if (frame) frame.textContent = "";
      frame = null;
      box = null;
      bundleId = "";
      ctx = null;
    },
  };
}
