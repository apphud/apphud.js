import type { ApiClient } from "./api";
import type { PagePayload } from "./payload";

// Page analytics (apphud-js-plan.md п. 14): POST /v1/events by customer_id,
// every event with the paywall, placement and variation of the link.
export type PageEventName =
  "paywall_shown" | "paywall_checkout_initiated" | "paywall_payment_error";

export interface PageEvents {
  track: (name: PageEventName, properties?: Record<string, unknown>) => void;
}

const insertId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const compact = (properties: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );

export function createPageEvents(
  api: ApiClient | null,
  payload: PagePayload,
): PageEvents {
  const customerId = payload.customer?.id;
  // once per page, as the funnel does per paywall and placement
  const once = new Set<PageEventName>([
    "paywall_shown",
    "paywall_checkout_initiated",
  ]);
  const sent = new Set<PageEventName>();

  return {
    track(name, properties = {}) {
      // a preview has no customer to own the event
      if (!api || !customerId) return;
      if (once.has(name)) {
        if (sent.has(name)) return;
        sent.add(name);
      }
      const event = {
        name,
        properties: compact({
          ...properties,
          paywall_id: payload.paywallId,
          placement_id: payload.placementId,
          variation_id: payload.variationId,
        }),
        user_properties: {},
        timestamp: Date.now() / 1000,
        insert_id: insertId(),
      };
      api
        .post("/v1/events", { customer_id: customerId, events: [event] })
        .then((response) => {
          if (response.status >= 400) {
            console.error(`Apphud: ${name} rejected`, response.body);
          }
        })
        .catch((error) => console.error(`Apphud: ${name} not sent`, error));
    },
  };
}
