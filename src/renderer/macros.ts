export interface MacroContext {
  locale: string;
  defaultLocale: string;
  now?: () => Date;
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

// Prices are plain text since `products[n]` was dropped: `today` is the only
// operand left (trial end dates).
export const evalMacro = (expr: string, ctx: MacroContext): string => {
  const now = ctx.now?.() ?? new Date();
  const [head, ...filters] = expr.split("|").map((part) => part.trim());
  let value: MacroValue = head === "today" ? now : "";
  filters.forEach((filter) => {
    const [name, arg] = filter.split(":").map((part) => part.trim());
    const apply = FILTERS[name];
    if (apply) value = apply(value, arg, now);
  });
  if (value instanceof Date) {
    return new Intl.DateTimeFormat(ctx.locale, {
      month: "short",
      day: "numeric",
    }).format(value);
  }
  return String(value ?? "");
};

// Localized text with v4-style macros: {{ today | add_days: 3 }}.
export const formatText = (value: unknown, ctx: MacroContext): string =>
  translate(value, ctx).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) =>
    evalMacro(expr, ctx),
  );
