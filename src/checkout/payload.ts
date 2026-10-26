import type { WebPaywallData } from "../renderer/types";

// The hosted page's payload (backend WebPaywalls::PagePayload). One release of
// apphud-checkout.js serves every live page, so it reads the payload leniently:
// a missing optional field gets its default, an unknown one is ignored.

export type Environment = "production" | "sandbox";
export type PaymentKind = "stripe" | "paddle";

export interface PageScreen {
  html: string;
  css: string;
  data: WebPaywallData;
}

export interface PageCustomer {
  id: string;
  locale: string | null;
  environment: Environment;
}

export interface PageProvider {
  id: string;
  kind: PaymentKind;
  identifier: string;
  token: string;
}

export interface PagePayload {
  screen: PageScreen;
  // null: a preview (no apphud_user_id in the link), checkout and events stay off
  customer: PageCustomer | null;
  emailRequired: boolean;
  environment: Environment;
  apiKey: string;
  apiHost: string;
  paywallId: string | null;
  placementId: string | null;
  variationId: string | null;
  providers: PageProvider[];
  // Payment kinds per bundle_id; empty: the plan cannot be bought
  paymentKinds: Record<string, PaymentKind[]>;
  returnUrls: { ios: string; android: string } | null;
  successUrl: string | null;
}

export class PayloadError extends Error {}

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string | null =>
  typeof value === "string" && value !== "" ? value : null;

const environment = (value: unknown): Environment =>
  value === "sandbox" ? "sandbox" : "production";

const isKind = (value: unknown): value is PaymentKind =>
  value === "stripe" || value === "paddle";

const readScreen = (value: unknown): PageScreen => {
  if (!isObject(value) || typeof value.html !== "string") {
    throw new PayloadError("payload has no screen html");
  }
  return {
    html: value.html,
    css: typeof value.css === "string" ? value.css : "",
    data: isObject(value.data) ? (value.data as WebPaywallData) : {},
  };
};

const readCustomer = (
  value: unknown,
  env: Environment,
): PageCustomer | null => {
  const id = isObject(value) ? str(value.id) : null;
  if (!id || !isObject(value)) return null;
  return {
    id,
    locale: str(value.locale),
    environment: value.environment ? environment(value.environment) : env,
  };
};

const readProviders = (value: unknown): PageProvider[] =>
  (Array.isArray(value) ? value : []).flatMap((item): PageProvider[] => {
    if (!isObject(item) || !isKind(item.kind)) return [];
    const id = str(item.id);
    const token = str(item.token);
    if (!id || !token) return [];
    return [
      { id, kind: item.kind, identifier: str(item.identifier) ?? "", token },
    ];
  });

const readPaymentKinds = (value: unknown): Record<string, PaymentKind[]> =>
  Object.fromEntries(
    Object.entries(isObject(value) ? value : {}).map(([bundleId, kinds]) => [
      bundleId,
      Array.isArray(kinds) ? kinds.filter(isKind) : [],
    ]),
  );

const readReturnUrls = (value: unknown): PagePayload["returnUrls"] => {
  if (!isObject(value)) return null;
  const ios = str(value.ios);
  const android = str(value.android) ?? ios;
  return ios && android ? { ios, android } : null;
};

export function parsePayload(raw: unknown): PagePayload {
  const value = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  if (!isObject(value)) throw new PayloadError("payload is not an object");

  const env = environment(value.environment);
  const customer = readCustomer(value.customer, env);
  const apiKey = str(value.api_key);
  const apiHost = str(value.api_host)?.replace(/\/+$/, "");
  if (customer && (!apiKey || !apiHost)) {
    throw new PayloadError("payload has a customer but no api_key or api_host");
  }

  return {
    screen: readScreen(value.screen),
    customer,
    emailRequired: customer ? value.email_required === true : false,
    // a preview never pays, so it is never a sandbox page
    environment: customer ? customer.environment : "production",
    apiKey: apiKey ?? "",
    apiHost: apiHost ?? "",
    paywallId: str(value.paywall_id),
    placementId: str(value.placement_id),
    variationId: str(value.variation_id),
    providers: customer ? readProviders(value.providers) : [],
    paymentKinds: readPaymentKinds(value.payment_kinds),
    returnUrls: readReturnUrls(value.return_urls),
    successUrl: str(value.success_url),
  };
}
