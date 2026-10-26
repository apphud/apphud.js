import { describe, expect, it } from "vitest";
import { PayloadError, parsePayload } from "./payload";

const screen = { html: "<h1>Hi</h1>", css: ".wp{}", data: { title: "Hi" } };

const full = {
  screen,
  customer: {
    id: "9f1c2b7e-0000-4000-8000-000000000001",
    locale: "ru_RU",
    environment: "sandbox",
  },
  email_required: true,
  environment: "sandbox",
  api_key: "app_key",
  api_host: "https://api.apphud.com/",
  paywall_id: "pw",
  placement_id: "pl",
  variation_id: null,
  providers: [
    { id: "p1", kind: "stripe", identifier: "acct_1", token: "pk_test_1" },
    { id: "p2", kind: "paypal", identifier: "x", token: "t" },
    { id: "p3", kind: "paddle", identifier: "", token: "" },
  ],
  payment_kinds: { b1: ["paddle", "stripe"], b2: [], b3: ["cash"] },
  return_urls: {
    ios: "https://ddd.aphd.cc/_apphud/return",
    android: "apphudtestapp://ddd.aphd.cc/_apphud/return",
  },
  success_url: null,
  some_future_field: { ignored: true },
};

describe("parsePayload", () => {
  it("reads the backend payload", () => {
    expect(parsePayload(JSON.stringify(full))).toEqual({
      screen,
      customer: {
        id: "9f1c2b7e-0000-4000-8000-000000000001",
        locale: "ru_RU",
        environment: "sandbox",
      },
      emailRequired: true,
      environment: "sandbox",
      apiKey: "app_key",
      apiHost: "https://api.apphud.com",
      paywallId: "pw",
      placementId: "pl",
      variationId: null,
      providers: [
        { id: "p1", kind: "stripe", identifier: "acct_1", token: "pk_test_1" },
      ],
      paymentKinds: { b1: ["paddle", "stripe"], b2: [], b3: [] },
      returnUrls: {
        ios: "https://ddd.aphd.cc/_apphud/return",
        android: "apphudtestapp://ddd.aphd.cc/_apphud/return",
      },
      successUrl: null,
    });
  });

  it("reads a preview: no customer, no providers, production", () => {
    const payload = parsePayload({
      screen,
      customer: null,
      email_required: null,
      environment: "sandbox",
      providers: full.providers,
      payment_kinds: { b1: ["stripe"] },
    });
    expect(payload.customer).toBeNull();
    expect(payload.providers).toEqual([]);
    expect(payload.emailRequired).toBe(false);
    expect(payload.environment).toBe("production");
    expect(payload.paymentKinds).toEqual({ b1: ["stripe"] });
    expect(payload.returnUrls).toBeNull();
  });

  it("gives android the ios return URL when it is missing", () => {
    const payload = parsePayload({
      ...full,
      return_urls: { ios: "https://ddd.aphd.cc/_apphud/return" },
    });
    expect(payload.returnUrls).toEqual({
      ios: "https://ddd.aphd.cc/_apphud/return",
      android: "https://ddd.aphd.cc/_apphud/return",
    });
  });

  it("rejects a payload without a screen or a customer without keys", () => {
    expect(() => parsePayload({ customer: null })).toThrow(PayloadError);
    expect(() => parsePayload("[]")).toThrow(PayloadError);
    expect(() => parsePayload({ ...full, api_key: null })).toThrow(
      PayloadError,
    );
  });
});
