import type { PaddleEventData } from "@paddle/paddle-js";
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
    { product: { bundle_id: "b-paddle" }, title: "Yearly", cta: "Continue" },
    { product: { bundle_id: "b-stripe" }, title: "Monthly", cta: "Continue" },
  ],
  errors: {
    declined: { en: "Your card was declined." },
    generic: { en: "Something went wrong." },
  },
  payment: { processing: { en: "Processing…" } },
};

const payload = parsePayload({
  screen: { html, css: "", data },
  customer: { id: "cust-1", locale: "en", environment: "sandbox" },
  environment: "sandbox",
  api_key: "k",
  api_host: "https://api.example.com",
  paywall_id: "pw",
  placement_id: "pl",
  variation_id: "var",
  providers: [
    { id: "prov-paddle", kind: "paddle", identifier: "", token: "test_tok" },
  ],
  payment_kinds: { "b-paddle": ["paddle"], "b-stripe": ["stripe"] },
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const setup = (answer: ApiResponse) => {
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  const post = vi.fn(async () => answer);
  let emit: (event: PaddleEventData) => void = () => {};
  const paddle = { Checkout: { open: vi.fn(), close: vi.fn() } };
  const loadPaddle = vi.fn(
    async (options: { eventCallback?: (e: PaddleEventData) => void }) => {
      emit = options.eventCallback ?? emit;
      return paddle as never;
    },
  );
  const complete = vi.fn(async (): Promise<PayResult> => ({ ok: true }));
  const events: [string, Record<string, unknown>][] = [];
  const paywall = createWebPaywall(shadow, {
    templates: [{ name: "t", title: "", html, css: "", schema: [], data }],
    template: "t",
    checkout: createPageCheckout({
      payload,
      api: { post } as ApiClient,
      host,
      complete,
      loadPaddle,
    }),
    onEvent: (name, properties) => events.push([name, properties]),
  });
  const root = () => shadow.getElementById("wp-root") as HTMLElement;
  const cta = () => root().querySelector<HTMLElement>("#wp-cta") as HTMLElement;
  return {
    host,
    paywall,
    post,
    paddle,
    loadPaddle,
    complete,
    events,
    root,
    cta,
    emit: (event: PaddleEventData) => emit(event),
  };
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Paddle on the hosted page", () => {
  it("opens the transaction inline, then pays, fails, retries and syncs", async () => {
    const page = setup({
      status: 200,
      body: { data: { results: { id: "txn_1", customer_id: "ctm_1" } } },
    });
    await page.paywall.ready;
    expect(page.loadPaddle).toHaveBeenCalledWith(
      expect.objectContaining({ environment: "sandbox", token: "test_tok" }),
    );
    expect(page.cta().style.display).toBe("");

    page.cta().click();
    expect(page.paywall.state.status).toBe("processing");
    await flush();

    expect(page.post).toHaveBeenCalledWith(
      "/v1/payment_providers/prov-paddle/subscriptions",
      {
        user_id: "cust-1",
        paywall_id: "pw",
        bundle_id: "b-paddle",
        placement_id: "pl",
        variation_id: "var",
        environment: "sandbox",
      },
    );
    expect(page.paddle.Checkout.open).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "txn_1",
        customer: { id: "ctm_1" },
        settings: expect.objectContaining({
          displayMode: "inline",
          frameTarget: "apphud-paddle-frame",
          locale: "en",
        }),
      }),
    );
    // Paddle finds its frame in the document: a light-DOM child of the host
    expect(
      document.getElementsByClassName("apphud-paddle-frame")[0]?.parentElement,
    ).toBe(page.host);
    expect(page.paywall.state.status).toBe("idle");
    expect(page.cta().style.display).toBe("none");
    expect(page.events.map(([name]) => name)).not.toContain(
      "checkout_initiated",
    );

    page.emit({ name: "checkout.payment.initiated" } as PaddleEventData);
    expect(page.paywall.state.status).toBe("processing");
    expect(page.events.at(-1)).toEqual([
      "checkout_initiated",
      { method: "paddle", bundle_id: "b-paddle" },
    ]);

    page.emit({
      name: "checkout.payment.failed",
      code: "card_declined",
      detail: "Card declined by issuer",
    } as unknown as PaddleEventData);
    await flush();
    expect(page.paywall.state.status).toBe("idle");
    expect(page.root().querySelector("#wp-error-text")?.textContent).toBe(
      "Your card was declined.",
    );
    expect(page.events.at(-1)).toEqual([
      "payment_error",
      {
        provider: "paddle",
        code: "card_declined",
        message: "Card declined by issuer",
        bundle_id: "b-paddle",
      },
    ]);

    page.emit({ name: "checkout.payment.initiated" } as PaddleEventData);
    page.emit({ name: "checkout.completed" } as PaddleEventData);
    await flush();
    expect(page.complete).toHaveBeenCalledWith({
      kind: "paddle",
      providerId: "prov-paddle",
      purchaseId: "txn_1",
    });
    expect(page.paywall.state.status).toBe("success");
    page.paywall.destroy();
  });

  it("closes Paddle on another plan and hides the button for a Stripe-only plan", async () => {
    const page = setup({
      status: 200,
      body: { data: { results: { id: "txn_1", customer_id: null } } },
    });
    await page.paywall.ready;
    page.cta().click();
    await flush();
    expect(page.paddle.Checkout.open).toHaveBeenCalledWith(
      expect.not.objectContaining({ customer: expect.anything() }),
    );

    page.paywall.setPlan(1);
    await flush();
    expect(page.paddle.Checkout.close).toHaveBeenCalled();
    expect(page.cta().style.display).toBe("none");
    expect(page.host.querySelector(".apphud-paddle-frame")).toBeNull();

    page.paywall.setPlan(0);
    expect(page.cta().style.display).toBe("");
    page.paywall.destroy();
    expect(page.host.querySelector('[slot="apphud-checkout"]')).toBeNull();
  });

  it("keeps the button and shows an error when the transaction is refused", async () => {
    const page = setup({
      status: 422,
      body: { errors: [{ title: "Bundle has no Paddle product" }] },
    });
    await page.paywall.ready;
    page.cta().click();
    await flush();

    expect(page.paddle.Checkout.open).not.toHaveBeenCalled();
    expect(page.paywall.state.status).toBe("idle");
    expect(page.paywall.state.error).toBe("generic");
    expect(page.cta().style.display).toBe("");
    expect(page.events.map(([name]) => name)).not.toContain("payment_error");
    page.paywall.destroy();
  });
});
