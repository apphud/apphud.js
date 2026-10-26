import type { PayResult } from "../renderer/types";
import type { ApiClient } from "./api";
import type { PagePayload, PaymentKind } from "./payload";
import { syncPurchase, type SyncOptions } from "./sync";

// What happens after the provider confirms a payment (apphud-js-plan.md
// п. 12–13): sync, then the Apphud success page or the store's own one.

const withQuery = (url: string, params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  const hash = url.indexOf("#");
  const base = hash < 0 ? url : url.slice(0, hash);
  const fragment = hash < 0 ? "" : url.slice(hash);
  return base + (base.includes("?") ? "&" : "?") + query + fragment;
};

// Android gets the app's scheme from the deeplink config (an intent opens the
// app), everything else the universal link.
export function returnUrlFor(
  payload: PagePayload,
  userAgent: string,
): string | null {
  const urls = payload.returnUrls;
  if (!urls) return null;
  const url = /android/i.test(userAgent) ? urls.android : urls.ios;
  return withQuery(url, { status: "success" });
}

// The store's own success page gets the status, where to return and the ids;
// the names are a contract for developers (README).
export function successRedirectUrl(
  payload: PagePayload,
  returnUrl: string | null,
): string | null {
  if (!payload.successUrl) return null;
  const params: Record<string, string> = { status: "success" };
  if (returnUrl) params.return_url = returnUrl;
  if (payload.paywallId) params.paywall_id = payload.paywallId;
  if (payload.placementId) params.placement_id = payload.placementId;
  if (payload.variationId) params.variation_id = payload.variationId;
  if (payload.customer) params.apphud_user_id = payload.customer.id;
  return withQuery(payload.successUrl, params);
}

export interface CompletedPayment {
  kind: PaymentKind;
  providerId: string;
  purchaseId: string;
}

export interface PurchaseOptions {
  api: ApiClient;
  payload: PagePayload;
  returnUrl: string | null;
  redirect: (url: string) => void;
  sync?: SyncOptions;
}

/**
 * Turns a payment the provider confirmed into the renderer's result: `ok`
 * shows the success page; with a `success_url` the page leaves and the
 * promise never settles, so the paywall stays in `processing`.
 */
export function createPurchaseCompleter(options: PurchaseOptions) {
  const { api, payload, returnUrl, redirect } = options;

  return async function complete(
    payment: CompletedPayment,
  ): Promise<PayResult> {
    const customerId = payload.customer?.id;
    if (!customerId) return { error: "generic", provider: payment.kind };

    const result = await syncPurchase(
      api,
      {
        providerId: payment.providerId,
        customerId,
        purchaseId: payment.purchaseId,
      },
      options.sync,
    );
    if (result.status === "failed") {
      // the backend's text goes to the event; the buyer sees errors.generic
      return {
        error: "generic",
        provider: payment.kind,
        code: `sync_${result.httpStatus}`,
        detail: result.message ?? undefined,
      };
    }

    const target = successRedirectUrl(payload, returnUrl);
    if (target) {
      redirect(target);
      return new Promise<PayResult>(() => {});
    }
    return { ok: true };
  };
}
