import {
  initializePaddle,
  type InitializePaddleOptions,
  type Paddle,
  type PaddleEventData,
} from "@paddle/paddle-js";
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

// Paddle on the hosted page (apphud-js-plan.md п. 10). The template's pay
// button creates the transaction on the new contract and opens Paddle's inline
// checkout in the slot; Paddle's own button pays. Paddle asks for the email
// itself.

export interface PaddleCheckoutOptions {
  api: ApiClient;
  payload: PagePayload;
  provider: PageProvider;
  complete: (payment: CompletedPayment) => Promise<PayResult>;
  loadPaddle?: (
    options: InitializePaddleOptions,
  ) => Promise<Paddle | undefined>;
}

// Paddle mounts an inline checkout into the element with this class, looked
// up in the document: the slot holds a light-DOM element (see checkout.ts).
const FRAME_CLASS = "apphud-paddle-frame";
const FRAME_STYLE =
  "width: 100%; min-width: 312px; background-color: transparent; border: none;";
const FRAME_HEIGHT = 450;

const FAILURES = new Set([
  "checkout.payment.failed",
  "checkout.payment.error",
  "checkout.error",
  "checkout.failed",
]);

export function createPaddleCheckout(
  options: PaddleCheckoutOptions,
): WebPaywallCheckout {
  const { api, payload, provider, complete } = options;
  const loadPaddle = options.loadPaddle ?? initializePaddle;
  let ctx: CheckoutContext | null = null;
  let frame: HTMLElement | null = null;
  let bundleId = "";
  // the transaction open in the frame, null while the pay button shows
  let transactionId: string | null = null;
  let paddle: Promise<Paddle | undefined> | null = null;
  // the payment Paddle started, settled by its completion or failure
  let settle: ((result: Promise<PayResult> | PayResult) => void) | null = null;

  const paid = (): Promise<PayResult> =>
    transactionId
      ? complete({
          kind: "paddle",
          providerId: provider.id,
          purchaseId: transactionId,
        })
      : Promise.resolve({ error: "generic", provider: "paddle" });

  function onEvent(event: PaddleEventData) {
    if (!ctx) return;
    if (event.name === "checkout.payment.initiated") {
      // a retry after a failure in the same frame starts a new payment
      void ctx.pay(
        "paddle",
        () =>
          new Promise<PayResult>((resolve) => {
            settle = resolve;
          }),
      );
      return;
    }
    if (event.name === "checkout.completed") {
      if (settle) {
        settle(paid());
        settle = null;
      } else {
        void ctx.pay("paddle", paid);
      }
      return;
    }
    if (event.name && FAILURES.has(event.name) && settle) {
      settle({
        error:
          event.name === "checkout.payment.failed" ? "declined" : "generic",
        provider: "paddle",
        code: event.code || event.name,
        detail: event.detail,
      });
      settle = null;
    }
  }

  const ensurePaddle = () => {
    paddle ??= loadPaddle({
      environment: payload.environment,
      token: provider.token,
      eventCallback: onEvent,
    }).catch((error) => {
      paddle = null;
      throw error;
    });
    return paddle;
  };

  function close() {
    if (!transactionId) return;
    transactionId = null;
    void paddle?.then((instance) => instance?.Checkout.close()).catch(() => {});
    if (frame) {
      frame.textContent = "";
      frame.classList.remove(FRAME_CLASS);
    }
    ctx?.setSubmit(!!bundleId);
  }

  async function open() {
    if (!ctx || !frame || !bundleId) return;
    const opened = await ctx.wait(async () => {
      const [instance, subscription] = await Promise.all([
        ensurePaddle().catch(() => undefined),
        createSubscription(api, payload, provider, bundleId),
      ]);
      return { instance, subscription };
    });
    const { instance, subscription } = opened;
    if (!ctx || !frame) return;
    if (!subscription.ok || !instance) {
      ctx.fail({
        error: "generic",
        provider: "paddle",
        code: subscription.ok
          ? "paddle_unavailable"
          : `create_${subscription.status}`,
        detail: subscription.ok
          ? undefined
          : (subscription.message ?? undefined),
      });
      return;
    }
    transactionId = subscription.id;
    ctx.setSubmit(false);
    frame.classList.add(FRAME_CLASS);
    instance.Checkout.open({
      transactionId: subscription.id,
      ...(subscription.customerId && {
        customer: { id: subscription.customerId },
      }),
      settings: {
        displayMode: "inline",
        frameTarget: FRAME_CLASS,
        frameInitialHeight: FRAME_HEIGHT,
        frameStyle: FRAME_STYLE,
        locale: ctx.locale(),
        theme: "light",
      },
    });
  }

  return {
    mount(target, context) {
      ctx = context;
      frame = target;
      // warm up Paddle.js while the buyer reads the paywall
      void ensurePaddle().catch(() => {});
    },
    setPlan(product: PlanProduct | null) {
      const next = product?.bundle_id ?? "";
      if (next === bundleId && transactionId) return;
      bundleId = next;
      close();
      ctx?.setSubmit(!!bundleId);
    },
    submit() {
      if (!transactionId) void open();
    },
    unmount() {
      close();
      settle = null;
      ctx = null;
      frame = null;
    },
  };
}
