import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebPaywall } from "../renderer/create-web-paywall";
import type { ApiClient } from "./api";
import { createPageCheckout } from "./checkout";
import { parsePayload } from "./payload";
import { textsFor } from "./rendered-texts";

const data = {
  title: { en: "From {{ products[0].formatted_price }}" },
  plans: [
    { product: { bundle_id: "b-stripe" }, title: "{{ product.price }}" },
    { product: { bundle_id: "b-both" }, title: "{{ product.price }}" },
  ],
};

// Every pass has every Liquid field, as the backend renders them.
const rendered = {
  stripe: {
    "$title.text": "stripe top",
    "$plans.0.title": "stripe 0",
    "$plans.1.title": "stripe 1",
  },
  paddle: {
    "$title.text": "paddle top",
    "$plans.0.title": "paddle 0",
    "$plans.1.title": "paddle 1",
  },
  none: {
    "$title.text": "none top",
    "$plans.0.title": "none 0",
    "$plans.1.title": "none 1",
  },
};

const payloadWith = (overrides: Record<string, unknown> = {}) =>
  parsePayload({
    screen: { html: "<h1></h1>", css: "", data },
    customer: { id: "cust-1", locale: "en", environment: "production" },
    api_key: "k",
    api_host: "https://api.example.com",
    providers: [
      { id: "p-stripe", kind: "stripe", identifier: "acct", token: "pk" },
      { id: "p-paddle", kind: "paddle", identifier: "", token: "tok" },
    ],
    payment_kinds: { "b-stripe": ["stripe"], "b-both": ["paddle", "stripe"] },
    rendered_texts: rendered,
    ...overrides,
  });

afterEach(() => {
  document.body.innerHTML = "";
});

describe("textsFor", () => {
  it("takes the selected kind where a plan has it, else the plan's first", () => {
    expect(textsFor(payloadWith(), "paddle")).toEqual({
      "$title.text": "paddle top",
      // the plan sells through Stripe only
      "$plans.0.title": "stripe 0",
      "$plans.1.title": "paddle 1",
    });
    expect(textsFor(payloadWith(), "stripe")).toEqual({
      "$title.text": "stripe top",
      "$plans.0.title": "stripe 0",
      "$plans.1.title": "stripe 1",
    });
  });

  it("takes the first kind without a selected one, also in a preview", () => {
    const first = {
      "$title.text": "stripe top",
      "$plans.0.title": "stripe 0",
      "$plans.1.title": "stripe 1",
    };
    expect(textsFor(payloadWith(), null)).toEqual(first);
    // no customer, no providers: payment_kinds as they are, not `none`
    expect(textsFor(payloadWith({ customer: null }), null)).toEqual(first);
  });

  it("takes the first kind of the page for a field outside the plans", () => {
    const payload = payloadWith({
      providers: [{ id: "p", kind: "paddle", identifier: "", token: "t" }],
    });
    // the page sells through Paddle only: Stripe is not a kind of it
    expect(textsFor(payload, "stripe")?.["$title.text"]).toBe("paddle top");
  });

  it("falls to none without a kind, and gives nothing without texts", () => {
    expect(textsFor(payloadWith({ providers: [] }), null)).toEqual(
      rendered.none,
    );
    expect(
      textsFor(payloadWith({ payment_kinds: {} }), "stripe")?.[
        "$plans.1.title"
      ],
    ).toBe("none 1");
    expect(textsFor(payloadWith({ rendered_texts: undefined }), null)).toBe(
      null,
    );
  });

  it("leaves a field out when the chosen kind has no text for it", () => {
    const payload = payloadWith({
      rendered_texts: { stripe: {}, paddle: { "$plans.1.title": "p" } },
    });
    expect(textsFor(payload, "stripe")).toEqual({});
  });
});

describe("the page checkout's kind", () => {
  it("reports the kind of the current plan's form as the plan changes", async () => {
    const payload = payloadWith({
      payment_kinds: { "b-stripe": [], "b-both": ["paddle"] },
    });
    const html = `
      <div data-list="plans">
        <template><div class="plan"><span data-item-bind="title"></span></div></template>
      </div>
      <div data-checkout></div>
    `;
    const host = document.createElement("div");
    document.body.append(host);
    const onKind = vi.fn();
    const paywall = createWebPaywall(host.attachShadow({ mode: "open" }), {
      templates: [{ name: "t", title: "", html, css: "", schema: [], data }],
      checkout: createPageCheckout({
        payload,
        // the transaction never answers: only the kind matters here
        api: { post: vi.fn(() => new Promise(() => {})) } as never as ApiClient,
        host,
        complete: vi.fn(),
        loadPaddle: vi.fn(() => new Promise<undefined>(() => {})),
        onKind,
      }),
    });
    await paywall.ready;
    expect(onKind.mock.calls).toEqual([[null]]);

    paywall.setPlan(1);
    paywall.setPlan(1);
    expect(onKind.mock.calls).toEqual([[null], ["paddle"]]);
    paywall.destroy();
  });
});
