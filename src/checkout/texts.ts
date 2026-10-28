import type { CheckoutContext } from "../renderer/types";

// Texts the page's checkout draws itself. A template overrides them by the same
// data path; without it the buyer gets these (en, ru).
const DEFAULTS: Record<string, Record<string, string>> = {
  "payment.divider": { en: "or", ru: "или" },
  "payment.email_placeholder": { en: "Email", ru: "Эл. почта" },
  "payment.provider_stripe": { en: "Card", ru: "Карта" },
  "payment.provider_paddle": { en: "Other methods", ru: "Другие способы" },
  "errors.email": {
    en: "Enter a valid email.",
    ru: "Введите корректный email.",
  },
};

export function checkoutText(ctx: CheckoutContext, path: string): string {
  const defaults = DEFAULTS[path] ?? {};
  const locale = ctx.locale();
  return (
    ctx.text(path) ||
    defaults[locale] ||
    defaults[locale.split("-")[0]] ||
    defaults.en ||
    ""
  );
}
