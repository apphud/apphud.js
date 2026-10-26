import { describe, expect, it, vi } from "vitest";
import type { ApiClient } from "./api";
import { createPageEvents } from "./events";
import { parsePayload } from "./payload";

const payload = (customer: unknown) =>
  parsePayload({
    screen: { html: "" },
    customer,
    api_key: "k",
    api_host: "https://api.example.com",
    paywall_id: "pw",
    placement_id: null,
    variation_id: "var",
  });

const customer = { id: "c-1", locale: "en", environment: "production" };

const fakeApi = () => {
  const post = vi.fn(async () => ({ status: 200, body: null }));
  return { api: { post } as ApiClient, post };
};

const names = (post: ReturnType<typeof fakeApi>["post"]) =>
  post.mock.calls.map(
    (call) =>
      (call as unknown as [string, { events: { name: string }[] }])[1].events[0]
        .name,
  );

describe("page events", () => {
  it("sends checkout_initiated once and every payment error", () => {
    const { api, post } = fakeApi();
    const events = createPageEvents(api, payload(customer));

    events.track("paywall_checkout_initiated", { bundle_id: "b1" });
    events.track("paywall_checkout_initiated", { bundle_id: "b1" });
    events.track("paywall_payment_error", {
      provider: "stripe",
      code: "card_declined",
    });
    events.track("paywall_payment_error", {
      provider: "stripe",
      code: "expired_card",
    });

    expect(names(post)).toEqual([
      "paywall_checkout_initiated",
      "paywall_payment_error",
      "paywall_payment_error",
    ]);
    const [, body] = post.mock.calls[1] as unknown as [
      string,
      { customer_id: string; events: { properties: unknown }[] },
    ];
    expect(body.customer_id).toBe("c-1");
    // undefined properties are left out; an id missing from the link stays null
    expect(body.events[0].properties).toEqual({
      provider: "stripe",
      code: "card_declined",
      paywall_id: "pw",
      variation_id: "var",
      placement_id: null,
    });
  });

  it("sends nothing in a preview", () => {
    const { api, post } = fakeApi();
    createPageEvents(api, payload(null)).track("paywall_shown");
    createPageEvents(null, payload(customer)).track("paywall_shown");
    expect(post).not.toHaveBeenCalled();
  });
});
