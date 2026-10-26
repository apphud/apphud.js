import type { ApiClient } from "./api";

// Purchase sync (apphud-js-plan.md п. 12): after the provider confirms the
// payment, the page asks the backend to take the purchase from the provider
// instead of waiting for the webhook.
//   200 — the subscription is in Apphud;
//   202 — paid, not finished yet (also a passing provider failure): repeat;
//   429 — rate limit: repeat a bit later;
//   422 — not paid, cancelled or expired; 404 — not this customer's purchase.
// After ~15 s of 202 the page still shows success: the app retries on return
// and the webhook finishes the job.

export type SyncResult =
  | { status: "synced"; subscription: unknown }
  | { status: "pending" }
  | { status: "failed"; httpStatus: number; message: string | null };

export interface SyncRequest {
  providerId: string;
  customerId: string;
  // `txn_…` of Paddle, the Checkout Session id of Stripe
  purchaseId: string;
}

export interface SyncOptions {
  timeoutMs?: number;
  intervalMs?: number;
  rateLimitMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const results = (body: unknown) =>
  typeof body === "object" && body !== null
    ? ((body as { data?: { results?: unknown } }).data?.results ?? null)
    : null;

const errorMessage = (body: unknown): string | null => {
  const errors =
    typeof body === "object" && body !== null
      ? (body as { errors?: unknown }).errors
      : null;
  const first = Array.isArray(errors) ? (errors[0] as unknown) : null;
  if (typeof first === "string") return first;
  if (typeof first === "object" && first !== null) {
    const { title, detail, message } = first as Record<string, unknown>;
    const text = title ?? detail ?? message;
    return typeof text === "string" ? text : null;
  }
  return null;
};

export async function syncPurchase(
  api: ApiClient,
  request: SyncRequest,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const {
    timeoutMs = 15000,
    intervalMs = 1500,
    rateLimitMs = 2000,
    now = Date.now,
    sleep = defaultSleep,
  } = options;
  const deadline = now() + timeoutMs;
  const path = `/v1/payment_providers/${encodeURIComponent(request.providerId)}/subscriptions/sync`;
  const body = { user_id: request.customerId, id: request.purchaseId };

  for (;;) {
    let wait = intervalMs;
    try {
      const response = await api.post(path, body);
      if (response.status === 200) {
        return { status: "synced", subscription: results(response.body) };
      }
      if (response.status === 422 || response.status === 404) {
        return {
          status: "failed",
          httpStatus: response.status,
          message: errorMessage(response.body),
        };
      }
      if (response.status === 429) wait = rateLimitMs;
      // 202 and anything unexpected: not ready yet
    } catch {
      // the provider already took the money: a network failure is not a payment error
    }
    if (now() + wait > deadline) return { status: "pending" };
    await sleep(wait);
  }
}
