import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebPaywall } from "../renderer/create-web-paywall";
import type { PayResult } from "../renderer/types";
import type { ApiClient, ApiResponse } from "./api";
import { createPageCheckout } from "./checkout";
import { parsePayload } from "./payload";

const html = `
  <div data-list="plans">
    <template><div class="plan"><span data-item-bind="title"></span></div></template>
  </div>
  <div data-checkout></div>
  <div id="wp-error"><span id="wp-error-text"></span></div>
  <button type="button" id="wp-cta"><span id="wp-cta-label" data-plan-bind="cta"></span></button>
`;

const data = {
  plans: [
    { product: { bundle_id: "b-stripe" }, title: "Monthly", cta: "Continue" },
    { product: { bundle_id: "b-both" }, title: "Yearly", cta: "Continue" },
  ],
  errors: {
    incomplete: { en: "Enter your full card details." },
    declined: { en: "Your card was declined." },
    generic: { en: "Something went wrong." },
  },
  payment: { processing: { en: "Processing…" } },
};

const pagePayload = (overrides: Record<string, unknown> = {}) =>
  parsePayload({
    screen: { html, css: "", data },
    customer: { id: "cust-1", locale: "en", environment: "sandbox" },
    email_required: false,
    environment: "sandbox",
    api_key: "k",
    api_host: "https://api.example.com",
    paywall_id: "pw",
    placement_id: "pl",
    variation_id: "var",
    providers: [
      { id: "prov-stripe", kind: "stripe", identifier: "acct_1", token: "pk" },
      { id: "prov-paddle", kind: "paddle", identifier: "", token: "test_tok" },
    ],
    payment_kinds: { "b-stripe": ["stripe"], "b-both": ["paddle", "stripe"] },
    ...overrides,
  });

const created: ApiResponse = {
  status: 200,
  body: { data: { results: { id: "cs_1", client_secret: "cs_1_secret" } } },
};

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

type Handler = (event: unknown) => void;

// Stripe.js v9 as far as the page uses it: a Checkout Elements SDK per session
// with an Express Checkout Element and a Payment Element.
const fakeStripe = () => {
  const handlers: Record<"express" | "card", Record<string, Handler>> = {
    express: {},
    card: {},
  };
  const element = (name: "express" | "card") => ({
    on: vi.fn((event: string, handler: Handler) => {
      handlers[name][event] = handler;
    }),
    mount: vi.fn(),
    destroy: vi.fn(),
    focus: vi.fn(),
  });
  let express: ReturnType<typeof element> | null = null;
  let card: ReturnType<typeof element> | null = null;
  const actions = {
    confirm: vi.fn(async (): Promise<unknown> => ({
      type: "success",
      session: { id: "cs_1" },
    })),
    updateEmail: vi.fn(async (): Promise<unknown> => ({ type: "success" })),
  };
  const sdk = {
    loadActions: vi.fn(async () => ({ type: "success", actions })),
    changeAppearance: vi.fn(),
    createExpressCheckoutElement: vi.fn(() => (express = element("express"))),
    createPaymentElement: vi.fn(() => (card = element("card"))),
    getExpressCheckoutElement: () => express,
    getPaymentElement: () => card,
  };
  const stripe = { initCheckoutElementsSdk: vi.fn(() => sdk) };
  return {
    stripe,
    sdk,
    actions,
    handlers,
    card: () => card,
    loadStripe: vi.fn(async () => stripe as never),
  };
};

const setup = (
  answers: ApiResponse[],
  payload = pagePayload(),
  defaultPlan?: number,
) => {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const post = vi.fn(async () => answers.shift() ?? created);
  const stripe = fakeStripe();
  const paddle = { Checkout: { open: vi.fn(), close: vi.fn() } };
  const complete = vi.fn(async (): Promise<PayResult> => ({ ok: true }));
  const events: [string, Record<string, unknown>][] = [];
  const paywall = createWebPaywall(shadow, {
    templates: [
      {
        name: "t",
        title: "",
        html,
        css: "",
        schema: [],
        data:
          defaultPlan == null
            ? data
            : { ...data, plans_settings: { default_plan: defaultPlan } },
      },
    ],
    template: "t",
    checkout: createPageCheckout({
      payload,
      api: { post } as ApiClient,
      host,
      complete,
      loadStripe: stripe.loadStripe,
      loadPaddle: vi.fn(async () => paddle as never),
    }),
    onEvent: (name, properties) => events.push([name, properties]),
  });
  const root = () => shadow.getElementById("wp-root") as HTMLElement;
  const cta = () => root().querySelector<HTMLElement>("#wp-cta") as HTMLElement;
  const frame = () =>
    host.querySelector('[slot="apphud-checkout"]') as HTMLElement;
  const tab = (kind: string) =>
    frame().querySelector<HTMLButtonElement>(
      `.aph-providers button[data-kind="${kind}"]`,
    ) as HTMLButtonElement;
  return {
    host,
    paywall,
    post,
    paddle,
    complete,
    events,
    root,
    cta,
    frame,
    tab,
    ...stripe,
  };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Stripe on the hosted page", () => {
  it("opens the plan's session, checks the card, confirms and syncs", async () => {
    const page = setup([]);
    await page.paywall.ready;
    await flush();

    expect(page.loadStripe).toHaveBeenCalledWith("pk", {
      stripeAccount: "acct_1",
      locale: "en",
    });
    expect(page.post).toHaveBeenCalledWith(
      "/v1/payment_providers/prov-stripe/subscriptions",
      {
        user_id: "cust-1",
        paywall_id: "pw",
        bundle_id: "b-stripe",
        placement_id: "pl",
        variation_id: "var",
        environment: "sandbox",
      },
    );
    expect(page.stripe.initCheckoutElementsSdk).toHaveBeenCalledWith(
      expect.objectContaining({ clientSecret: "cs_1_secret" }),
    );
    expect(page.sdk.createExpressCheckoutElement).toHaveBeenCalledWith({
      paymentMethods: expect.objectContaining({
        link: "never",
        paypal: "never",
      }),
    });
    expect(page.sdk.createPaymentElement).toHaveBeenCalledWith(
      expect.objectContaining({
        wallets: { applePay: "never", googlePay: "never", link: "never" },
      }),
    );
    // Stripe's iframes mount into the light-DOM frame behind the slot
    const cardBox = page.frame().querySelector(".aph-stripe__card");
    expect(page.card()?.mount).toHaveBeenCalledWith(cardBox);
    expect(
      page.frame().querySelector<HTMLElement>(".aph-providers")?.hidden,
    ).toBe(true);
    expect(page.cta().style.display).toBe("");

    // an empty card: no payment, no event
    page.cta().click();
    expect(page.paywall.state.error).toBe("incomplete");
    expect(page.card()?.focus).toHaveBeenCalled();
    expect(page.actions.confirm).not.toHaveBeenCalled();
    expect(page.events.map(([name]) => name)).not.toContain(
      "checkout_initiated",
    );

    page.handlers.card.change({ complete: true });
    page.cta().click();
    expect(page.paywall.state.status).toBe("processing");
    await flush();
    expect(page.actions.confirm).toHaveBeenCalledWith({
      redirect: "if_required",
      returnUrl: location.href,
    });
    expect(page.actions.updateEmail).not.toHaveBeenCalled();
    expect(page.complete).toHaveBeenCalledWith({
      kind: "stripe",
      providerId: "prov-stripe",
      purchaseId: "cs_1",
    });
    expect(page.paywall.state.status).toBe("success");
    expect(page.events.find(([name]) => name === "checkout_initiated")).toEqual(
      ["checkout_initiated", { method: "card", bundle_id: "b-stripe" }],
    );
    page.paywall.destroy();
  });

  it("shows a decline and reports it, then pays again in the same session", async () => {
    const page = setup([]);
    await page.paywall.ready;
    await flush();
    page.handlers.card.change({ complete: true });
    page.actions.confirm.mockResolvedValueOnce({
      type: "error",
      error: {
        code: "paymentFailed",
        message: "Your card has insufficient funds.",
        paymentFailed: { declineCode: "insufficient_funds" },
      },
    });

    page.cta().click();
    await flush();
    expect(page.paywall.state.status).toBe("idle");
    expect(page.root().querySelector("#wp-error-text")?.textContent).toBe(
      "Your card was declined.",
    );
    expect(page.events.at(-1)).toEqual([
      "payment_error",
      {
        provider: "stripe",
        code: "insufficient_funds",
        message: "Your card has insufficient funds.",
        bundle_id: "b-stripe",
      },
    ]);

    page.cta().click();
    await flush();
    expect(page.post).toHaveBeenCalledTimes(1);
    expect(page.paywall.state.status).toBe("success");
    page.paywall.destroy();
  });

  it("pays with a wallet from the Express Checkout Element", async () => {
    const page = setup([]);
    await page.paywall.ready;
    await flush();
    const stripeBox = page.frame().querySelector(".aph-stripe");
    expect(stripeBox?.classList.contains("has-wallet")).toBe(false);
    page.handlers.express.ready({
      availablePaymentMethods: { applePay: true, googlePay: false },
    });
    expect(stripeBox?.classList.contains("has-wallet")).toBe(true);
    expect(stripeBox?.querySelector(".aph-stripe__or")?.textContent).toBe("or");

    const event = { expressPaymentType: "apple_pay", paymentFailed: vi.fn() };
    page.handlers.express.confirm(event);
    await flush();
    expect(page.actions.confirm).toHaveBeenCalledWith({
      expressCheckoutConfirmEvent: event,
      redirect: "if_required",
      returnUrl: location.href,
    });
    expect(event.paymentFailed).not.toHaveBeenCalled();
    expect(page.events.find(([name]) => name === "checkout_initiated")).toEqual(
      ["checkout_initiated", { method: "apple_pay", bundle_id: "b-stripe" }],
    );
    expect(page.paywall.state.status).toBe("success");
    page.paywall.destroy();
  });

  it("asks for the email when the store requires it", async () => {
    const page = setup([], pagePayload({ email_required: true }));
    await page.paywall.ready;
    await flush();
    const email = page
      .frame()
      .querySelector<HTMLInputElement>(
        ".aph-stripe__email",
      ) as HTMLInputElement;
    expect(email.placeholder).toBe("Email");
    page.handlers.card.change({ complete: true });

    email.value = "nope";
    page.cta().click();
    expect(email.classList.contains("is-invalid")).toBe(true);
    expect(page.root().querySelector("#wp-error-text")?.textContent).toBe(
      "Enter a valid email.",
    );
    expect(page.actions.updateEmail).not.toHaveBeenCalled();

    email.value = " buyer@example.com ";
    email.dispatchEvent(new Event("input"));
    expect(email.classList.contains("is-invalid")).toBe(false);
    page.cta().click();
    await flush();
    expect(page.actions.updateEmail).toHaveBeenCalledWith("buyer@example.com");
    expect(page.actions.confirm).toHaveBeenCalled();
    expect(page.paywall.state.status).toBe("success");
    page.paywall.destroy();
  });

  it("lets the buyer choose between Stripe and Paddle", async () => {
    const page = setup([], pagePayload(), 2);
    await page.paywall.ready;
    await flush();
    expect(
      page.frame().querySelector<HTMLElement>(".aph-providers")?.hidden,
    ).toBe(false);
    expect(page.tab("stripe").getAttribute("aria-selected")).toBe("true");
    expect(page.tab("stripe").textContent).toBe("Card");
    expect(page.tab("paddle").textContent).toBe("Other methods");
    expect(page.post).toHaveBeenCalledTimes(1);

    page.tab("paddle").click();
    expect(page.card()?.destroy).toHaveBeenCalled();
    expect(page.frame().querySelector(".aph-stripe")).toBeNull();
    expect(page.tab("paddle").getAttribute("aria-selected")).toBe("true");
    page.cta().click();
    await flush();
    expect(page.post).toHaveBeenLastCalledWith(
      "/v1/payment_providers/prov-paddle/subscriptions",
      expect.objectContaining({ bundle_id: "b-both" }),
    );
    expect(page.paddle.Checkout.open).toHaveBeenCalled();

    // the Stripe-only plan has no choice; back on the yearly plan the
    // buyer's Paddle stays
    page.paywall.setPlan(0);
    await flush();
    expect(
      page.frame().querySelector<HTMLElement>(".aph-providers")?.hidden,
    ).toBe(true);
    page.paywall.setPlan(1);
    expect(page.tab("paddle").getAttribute("aria-selected")).toBe("true");

    // going back to Stripe reuses the plan's session
    page.tab("stripe").click();
    await flush();
    const stripeCalls = page.post.mock.calls.filter(([path]) =>
      String(path).includes("prov-stripe"),
    );
    expect(
      stripeCalls.map(([, body]) => (body as { bundle_id: string }).bundle_id),
    ).toEqual(["b-both", "b-stripe"]);
    expect(page.sdk.createPaymentElement).toHaveBeenCalledTimes(3);
    page.paywall.destroy();
  });

  it("shows an error when the session is refused and retries on the pay button", async () => {
    const page = setup([
      { status: 422, body: { errors: [{ title: "No Stripe product" }] } },
    ]);
    await page.paywall.ready;
    await flush();
    expect(page.paywall.state.error).toBe("generic");
    expect(page.sdk.createPaymentElement).not.toHaveBeenCalled();
    expect(page.events.map(([name]) => name)).not.toContain("payment_error");
    expect(page.cta().style.display).toBe("");

    page.cta().click();
    expect(page.paywall.state.status).toBe("processing");
    await flush();
    expect(page.post).toHaveBeenCalledTimes(2);
    expect(page.paywall.state.status).toBe("idle");
    expect(page.paywall.state.error).toBeNull();
    expect(page.sdk.createPaymentElement).toHaveBeenCalledTimes(1);
    expect(page.actions.confirm).not.toHaveBeenCalled();
    page.paywall.destroy();
  });
});
