import type { CardAdapter } from "./types";

// The builder never charges: mock fields only. Real payment forms are mounted
// by Apphud.js on the hosted page.
export interface AdapterContext {
  doc: Document;
  $: (id: string) => HTMLElement | null;
  text: (path: string) => string;
  fieldsFocus: (on: boolean) => void;
  setBrand: (brand: string) => void;
  clearError: () => void;
  sleep: (ms: number) => Promise<void>;
}

type FieldKey = "number" | "expiry" | "cvc";

const FIELD_CONTAINERS: Record<FieldKey, string> = {
  number: "wp-card-number",
  expiry: "wp-card-expiry",
  cvc: "wp-card-cvc",
};

const clearContainers = (ctx: AdapterContext) => {
  Object.values(FIELD_CONTAINERS).forEach((id) => {
    const box = ctx.$(id);
    if (box) box.textContent = "";
  });
};

// ------------------------------------------------------------------- mock

const digits = (value: string, max: number) =>
  value.replace(/\D/g, "").slice(0, max);

const cardBrand = (value: string) =>
  /^3[47]/.test(value)
    ? "amex"
    : /^4/.test(value)
      ? "visa"
      : /^(5[1-5]|2[2-7])/.test(value)
        ? "mastercard"
        : "";

const groupCard = (value: string, brand: string) =>
  (brand === "amex"
    ? [value.slice(0, 4), value.slice(4, 10), value.slice(10, 15)]
    : value.match(/.{1,4}/g) ?? []
  )
    .filter(Boolean)
    .join(" ");

type ApplePayWindow = Window & {
  ApplePaySession?: { canMakePayments: () => boolean };
};

export const MOCK_DECLINED_CARD = "4000000000000002";

export function createMockAdapter(ctx: AdapterContext): CardAdapter {
  let fields: Record<FieldKey, HTMLInputElement> | null = null;
  let listeners: AbortController | null = null;

  const mockInput = (
    key: FieldKey,
    attrs: Record<string, string>,
    signal: AbortSignal,
  ) => {
    const input = ctx.doc.createElement("input");
    Object.entries(attrs).forEach(([name, value]) =>
      input.setAttribute(name, value),
    );
    input.type = "text";
    input.addEventListener("focus", () => ctx.fieldsFocus(true), { signal });
    input.addEventListener("blur", () => ctx.fieldsFocus(false), { signal });
    const box = ctx.$(FIELD_CONTAINERS[key]);
    if (box) {
      box.textContent = "";
      box.append(input);
      box.parentElement?.addEventListener("click", () => input.focus(), {
        signal,
      });
    }
    return input;
  };

  const refresh = () => {
    if (!fields) return;
    fields.number.placeholder = ctx.text("payment.number_placeholder");
    fields.expiry.placeholder = ctx.text("payment.expiry_placeholder");
    fields.cvc.placeholder = ctx.text("payment.cvc_placeholder");
  };

  return {
    mount() {
      listeners = new AbortController();
      const { signal } = listeners;
      const number = mockInput(
        "number",
        { inputmode: "numeric", autocomplete: "cc-number", name: "cardnumber" },
        signal,
      );
      const expiry = mockInput(
        "expiry",
        { inputmode: "numeric", autocomplete: "cc-exp", name: "exp-date" },
        signal,
      );
      const cvc = mockInput(
        "cvc",
        { inputmode: "numeric", autocomplete: "cc-csc", name: "cvc" },
        signal,
      );
      number.addEventListener(
        "input",
        () => {
          const value = digits(number.value, 19);
          const brand = cardBrand(value);
          number.value = groupCard(value, brand);
          ctx.setBrand(brand);
          ctx.clearError();
        },
        { signal },
      );
      expiry.addEventListener(
        "input",
        () => {
          let value = digits(expiry.value, 4);
          if (value.length === 1 && value > "1") value = "0" + value;
          expiry.value =
            value.length > 2
              ? `${value.slice(0, 2)} / ${value.slice(2)}`
              : value;
          ctx.clearError();
        },
        { signal },
      );
      cvc.addEventListener(
        "input",
        () => {
          cvc.value = digits(cvc.value, 4);
          ctx.clearError();
        },
        { signal },
      );
      fields = { number, expiry, cvc };
      ctx.setBrand("");
      refresh();
    },
    refresh,
    unmount() {
      listeners?.abort();
      listeners = null;
      clearContainers(ctx);
      fields = null;
    },
    focus() {
      fields?.number.focus({ preventScroll: true });
    },
    async detectWallet() {
      try {
        const session = (ctx.doc.defaultView as ApplePayWindow | null)
          ?.ApplePaySession;
        return !!session?.canMakePayments();
      } catch {
        return false;
      }
    },
    validate() {
      if (!fields) return "incomplete";
      const number = digits(fields.number.value, 19);
      const expiry = digits(fields.expiry.value, 4);
      const cvc = digits(fields.cvc.value, 4);
      const month = Number(expiry.slice(0, 2));
      const complete =
        number.length >= (cardBrand(number) === "amex" ? 15 : 16) &&
        expiry.length === 4 &&
        cvc.length >= 3;
      return complete && month >= 1 && month <= 12 ? null : "incomplete";
    },
    async payCard() {
      await ctx.sleep(1500);
      const number = digits(fields?.number.value ?? "", 19);
      return number === MOCK_DECLINED_CARD
        ? { error: "declined" }
        : { ok: true };
    },
    async payWallet() {
      await ctx.sleep(1300);
      return { ok: true };
    },
  };
}
