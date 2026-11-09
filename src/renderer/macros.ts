export interface MacroContext {
  locale: string;
  defaultLocale: string;
  now?: () => Date;
  // The hosted page: Liquid this cannot compute is erased, none reaches the
  // buyer. Otherwise (the builder) it stays as written, so the developer sees
  // what did not resolve.
  erase?: boolean;
}

type MacroValue = string | number | Date | null | undefined;

export const APPLE_PAY_LABELS: Record<string, Record<string, string>> = {
  subscribe: { en: "Subscribe with", ru: "Подписаться через" },
  buy: { en: "Buy with", ru: "Купить с" },
  continue: { en: "Continue with", ru: "Продолжить с" },
  "check-out": { en: "Check out with", ru: "Оплатить через" },
  "set-up": { en: "Set up", ru: "Настроить" },
  plain: { en: "", ru: "" },
};

// Locale for built-in word tables (Apple Pay labels).
export const lang = (locale: string) =>
  APPLE_PAY_LABELS.subscribe[locale] ? locale : "en";

export const getPath = (source: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value == null ? undefined : (value as Record<string, unknown>)[key],
      source,
    );

// Localized value = { en, ru, … } or a plain string.
export const translate = (value: unknown, ctx: MacroContext): string => {
  if (value == null) return "";
  if (typeof value === "object") {
    const map = value as Record<string, unknown>;
    const text = map[ctx.locale] ?? map[ctx.defaultLocale || "en"] ?? "";
    return String(text);
  }
  return String(value);
};

const FILTERS: Record<
  string,
  (value: MacroValue, arg: MacroValue, now: Date) => MacroValue
> = {
  add_days: (value, days, now) =>
    new Date(
      (value instanceof Date ? value : now).getTime() + Number(days) * 864e5,
    ),
};

// `today` with `add_days: <number>` filters is all computed here (trial end
// dates). Prices and the rest of Liquid come rendered by the server
// (`setTexts`); any other macro is unknown.
const ADD_DAYS = /^add_days\s*:\s*-?\d+(\.\d+)?$/;
const isKnown = (expr: string) => {
  const [head, ...filters] = expr.split("|").map((part) => part.trim());
  return head === "today" && filters.every((filter) => ADD_DAYS.test(filter));
};

export const evalMacro = (expr: string, ctx: MacroContext): string => {
  if (!isKnown(expr)) return "";
  const now = ctx.now?.() ?? new Date();
  const [, ...filters] = expr.split("|").map((part) => part.trim());
  let value: MacroValue = now;
  filters.forEach((filter) => {
    const [name, arg] = filter.split(":").map((part) => part.trim());
    const apply = FILTERS[name];
    if (apply) value = apply(value, arg, now);
  });
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return new Intl.DateTimeFormat(ctx.locale, {
      month: "short",
      day: "numeric",
    }).format(value);
  }
  return String(value ?? "");
};

// Liquid tags. Only a field the server sent no text for gets here (an older
// backend): the page drops the tags and keeps the words around them.
const TAG = /\{%[\s\S]*?%\}/g;
const MACRO = /\{\{\s*([^}]+?)\s*\}\}/g;

// Localized text with v4-style macros: {{ today | add_days: 3 }}. The rest of
// Liquid stays as written, or is erased with `erase` (the hosted page).
export const formatText = (value: unknown, ctx: MacroContext): string => {
  const text = translate(value, ctx);
  if (!ctx.erase) {
    return text.replace(MACRO, (match, expr: string) =>
      isKnown(expr) ? evalMacro(expr, ctx) : match,
    );
  }
  return text
    .replace(TAG, "")
    .replace(MACRO, (_, expr: string) => evalMacro(expr, ctx));
};
