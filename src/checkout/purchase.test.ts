import { describe, expect, it, vi } from "vitest";
import type { ApiClient, ApiResponse } from "./api";
import { parsePayload } from "./payload";
import {
  createPurchaseCompleter,
  returnUrlFor,
  successRedirectUrl,
} from "./purchase";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

const payload = (overrides: Record<string, unknown> = {}) =>
  parsePayload({
    screen: { html: "" },
    customer: { id: "cust-1", locale: "en", environment: "production" },
    api_key: "k",
    api_host: "https://api.example.com",
    paywall_id: "pw",
    placement_id: "pl",
    variation_id: null,
    return_urls: {
      ios: "https://ddd.aphd.cc/_apphud/return",
      android: "apphudtestapp://ddd.aphd.cc/_apphud/return",
    },
    success_url: null,
    ...overrides,
  });

const api = (...answers: ApiResponse[]) => {
  const post = vi.fn(async () => answers.shift() as ApiResponse);
  return { api: { post } as ApiClient, post };
};

const payment = {
  kind: "paddle" as const,
  providerId: "prov-1",
  purchaseId: "txn_1",
};
const noWait = { sleep: async () => {} };

describe("return URL", () => {
  it("takes the app scheme on Android and the universal link elsewhere", () => {
    expect(returnUrlFor(payload(), ANDROID)).toBe(
      "apphudtestapp://ddd.aphd.cc/_apphud/return?status=success",
    );
    expect(returnUrlFor(payload(), IPHONE)).toBe(
      "https://ddd.aphd.cc/_apphud/return?status=success",
    );
    expect(returnUrlFor(payload({ return_urls: null }), IPHONE)).toBeNull();
  });

  it("builds the store's success page link with the contract's params", () => {
    const url = successRedirectUrl(
      payload({ success_url: "https://example.com/thanks?from=paywall" }),
      "https://ddd.aphd.cc/_apphud/return?status=success",
    );
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe("https://example.com/thanks");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      from: "paywall",
      status: "success",
      return_url: "https://ddd.aphd.cc/_apphud/return?status=success",
      paywall_id: "pw",
      placement_id: "pl",
      apphud_user_id: "cust-1",
    });
    expect(successRedirectUrl(payload(), null)).toBeNull();
  });
});

describe("purchase completer", () => {
  it("shows the Apphud success page after a sync", async () => {
    const { api: client, post } = api(
      { status: 202, body: null },
      { status: 200, body: {} },
    );
    const redirect = vi.fn();
    const complete = createPurchaseCompleter({
      api: client,
      payload: payload(),
      returnUrl: null,
      redirect,
      sync: noWait,
    });
    await expect(complete(payment)).resolves.toEqual({ ok: true });
    expect(post).toHaveBeenCalledTimes(2);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("leaves for the store's success page and never settles", async () => {
    const { api: client } = api({ status: 200, body: {} });
    const redirect = vi.fn();
    const complete = createPurchaseCompleter({
      api: client,
      payload: payload({ success_url: "https://example.com/thanks" }),
      returnUrl: null,
      redirect,
      sync: noWait,
    });
    let settled = false;
    void complete(payment).then(() => (settled = true));
    await vi.waitFor(() => expect(redirect).toHaveBeenCalledTimes(1));
    expect(redirect.mock.calls[0][0]).toMatch(
      /^https:\/\/example\.com\/thanks\?status=success&/,
    );
    await Promise.resolve();
    expect(settled).toBe(false);
  });

  it("turns a rejected sync into a payment error with the template's text", async () => {
    const { api: client } = api({
      status: 422,
      body: { errors: [{ title: "Not paid" }] },
    });
    const complete = createPurchaseCompleter({
      api: client,
      payload: payload(),
      returnUrl: null,
      redirect: vi.fn(),
      sync: noWait,
    });
    await expect(complete(payment)).resolves.toEqual({
      error: "generic",
      provider: "paddle",
      code: "sync_422",
      detail: "Not paid",
    });
  });
});
