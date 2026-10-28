import type { ApiClient } from "./api";
import type { PagePayload, PageProvider } from "./payload";

// New checkout contract (apphud-js-plan.md п. 8, backend 1.4): the page names
// the paywall, the bundle and the link's ids; price, trial and coupon come
// from the paywall item on the server. No product_id, trial_period_days,
// discount_id or Stripe customer_id.

export type CreatedSubscription =
  | {
      ok: true;
      // Paddle: the transaction `txn_…` and its customer `ctm_…`. Stripe: the
      // Checkout Session `cs_…` and its client secret (assumed until backend
      // 1.4 fixes the Stripe answer).
      id: string;
      customerId: string | null;
      clientSecret: string | null;
    }
  | { ok: false; status: number; message: string | null };

const record = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};

const firstError = (body: unknown): string | null => {
  const errors = record(body).errors;
  const first = Array.isArray(errors) ? errors[0] : null;
  if (typeof first === "string") return first;
  const { title, detail } = record(first);
  const text = title ?? detail;
  return typeof text === "string" ? text : null;
};

export async function createSubscription(
  api: ApiClient,
  payload: PagePayload,
  provider: PageProvider,
  bundleId: string,
): Promise<CreatedSubscription> {
  const body = {
    user_id: payload.customer?.id,
    paywall_id: payload.paywallId,
    bundle_id: bundleId,
    placement_id: payload.placementId,
    variation_id: payload.variationId,
    environment: payload.environment,
  };
  let status = 0;
  let responseBody: unknown = null;
  try {
    const response = await api.post(
      `/v1/payment_providers/${encodeURIComponent(provider.id)}/subscriptions`,
      body,
    );
    status = response.status;
    responseBody = response.body;
  } catch (error) {
    return { ok: false, status: 0, message: String(error) };
  }

  const results = record(record(record(responseBody).data).results);
  if (status === 200 && typeof results.id === "string") {
    return {
      ok: true,
      id: results.id,
      customerId:
        typeof results.customer_id === "string" ? results.customer_id : null,
      clientSecret:
        typeof results.client_secret === "string"
          ? results.client_secret
          : null,
    };
  }
  return { ok: false, status, message: firstError(responseBody) };
}
