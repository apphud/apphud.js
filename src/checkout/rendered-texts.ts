import {
  PAYMENT_KINDS,
  type PagePayload,
  type PaymentKind,
  type TextsKind,
} from "./payload";

type Raw = Record<string, unknown>;

const isObject = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Kinds a plan's bundle sells through, in `PAYMENT_KINDS` order. With a
 * customer only those the page has a provider of; a preview has none, so it
 * takes `payment_kinds` as is (else every preview would fall to `none`).
 */
export function kindsOf(
  payload: PagePayload,
  bundleId: string | null | undefined,
): PaymentKind[] {
  const kinds = bundleId ? (payload.paymentKinds[bundleId] ?? []) : [];
  const providers = new Set(payload.providers.map((p) => p.kind));
  return PAYMENT_KINDS.filter(
    (kind) =>
      kinds.includes(kind) && (!payload.customer || providers.has(kind)),
  );
}

// Plans: items of a data collection with a `product` (the web_product field),
// by `<slug>.<index>`, with their kinds.
const planKinds = (payload: PagePayload) => {
  const plans = new Map<string, PaymentKind[]>();
  Object.entries(payload.screen.data).forEach(([slug, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, i) => {
      if (!isObject(item) || !isObject(item.product)) return;
      const id = item.product.bundle_id;
      plans.set(
        `${slug}.${i}`,
        kindsOf(payload, typeof id === "string" ? id.trim() : null),
      );
    });
  });
  return plans;
};

const PLAN_KEY = /^\$([^.]+)\.(\d+)\./;

/**
 * The page's texts for the selected kind (the kind of the current plan's
 * form; null without one), by the rule shared with the backend:
 * - a plan's field: the selected kind if the plan has it, else the plan's first;
 * - any other field: the selected kind if the page has it, else the page's first;
 * - no kind at all: `none`.
 * null: the payload has no rendered texts.
 */
export function textsFor(
  payload: PagePayload,
  selected: PaymentKind | null,
): Record<string, string> | null {
  const rendered = payload.renderedTexts;
  if (!rendered) return null;
  const plans = planKinds(payload);
  const pageKinds = PAYMENT_KINDS.filter((kind) =>
    Array.from(plans.values()).some((kinds) => kinds.includes(kind)),
  );
  const pick = (kinds: PaymentKind[]): TextsKind =>
    selected && kinds.includes(selected) ? selected : (kinds[0] ?? "none");
  const pageKind = pick(pageKinds);

  const keys = new Set(
    Object.values(rendered).flatMap((texts) => Object.keys(texts ?? {})),
  );
  const result: Record<string, string> = {};
  keys.forEach((key) => {
    const plan = PLAN_KEY.exec(key);
    const kinds = plan ? plans.get(`${plan[1]}.${plan[2]}`) : undefined;
    const value = rendered[kinds ? pick(kinds) : pageKind]?.[key];
    if (typeof value === "string") result[key] = value;
  });
  return result;
}
