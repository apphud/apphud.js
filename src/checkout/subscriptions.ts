import type { CheckoutContext, PayResult } from "../renderer/types";
import type { ApiClient } from "./api";
import type { PagePayload, PageProvider, PaymentKind } from "./payload";
import { checkoutText } from "./texts";

// New checkout contract (apphud-js-plan.md п. 8, backend 1.4,
// POST /v2/payment_providers/:id/checkout): the page names the paywall, the
// bundle and the link's ids; the server decides the environment from `debug`
// and its test list, and takes price, trial and coupon from the paywall item.
// No environment, product_id, trial_period_days, discount_id or customer_id.

// The server created the payment in another environment than the page's:
// the test list or `debug` changed after the page loaded.
export const ENVIRONMENT_MISMATCH = "environment_mismatch";

export type CreatedSubscription =
  | {
      ok: true;
      // Paddle: the transaction `txn_…`. Stripe: the Checkout Session `cs_…`.
      id: string;
      // Paddle: `ctm_…`, null until the buyer has a Paddle customer.
      customerId: string | null;
      // Stripe: the Checkout Session's client secret.
      clientSecret: string | null;
      // Stripe: the session needs the buyer's email (its Stripe customer has
      // none); the page's own flag when the answer has no such field.
      emailRequired: boolean;
    }
  // `create_<status>` or ENVIRONMENT_MISMATCH
  | { ok: false; code: string; message: string | null };

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
    // the page's query value as is: the server reads only "true"
    ...(payload.debug !== null && { debug: payload.debug }),
  };
  let status = 0;
  let responseBody: unknown = null;
  try {
    const response = await api.post(
      `/v2/payment_providers/${encodeURIComponent(provider.id)}/checkout`,
      body,
    );
    status = response.status;
    responseBody = response.body;
  } catch (error) {
    return { ok: false, code: "create_0", message: String(error) };
  }

  const results = record(record(record(responseBody).data).results);
  if (status !== 200 || typeof results.id !== "string") {
    return {
      ok: false,
      code: `create_${status}`,
      message: firstError(responseBody),
    };
  }
  if (
    typeof results.environment === "string" &&
    results.environment !== payload.environment
  ) {
    return {
      ok: false,
      code: ENVIRONMENT_MISMATCH,
      message: `${results.environment} payment on a ${payload.environment} page`,
    };
  }
  return {
    ok: true,
    id: results.id,
    customerId:
      typeof results.customer_id === "string" ? results.customer_id : null,
    clientSecret:
      typeof results.client_secret === "string" ? results.client_secret : null,
    emailRequired:
      typeof results.email_required === "boolean"
        ? results.email_required
        : payload.emailRequired,
  };
}

// What the buyer sees when the payment was not created: a red label under the
// form, with no payment_error event (nothing was paid yet).
export function refusal(
  ctx: CheckoutContext | null,
  provider: PaymentKind,
  failure: { code: string; message: string | null },
): PayResult {
  if (failure.code === ENVIRONMENT_MISMATCH) {
    return {
      error: "reload",
      message: ctx ? checkoutText(ctx, "errors.reload") : undefined,
      provider,
      code: failure.code,
      detail: failure.message ?? undefined,
    };
  }
  return {
    error: "generic",
    provider,
    code: failure.code,
    detail: failure.message ?? undefined,
  };
}
