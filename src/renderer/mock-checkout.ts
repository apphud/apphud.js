import { resolveIcon } from "./icons";
import { APPLE_PAY_LABELS, lang } from "./macros";
import type {
  CheckoutContext,
  PayResult,
  WalletMode,
  WebPaywallCheckout,
} from "./types";

// The builder never charges: the mock fills [data-checkout] with fields that
// look like a payment form. The hosted page mounts the real one from Apphud.js.
export interface MockCheckoutOptions {
  wallet: () => WalletMode;
  onWallet: (available: boolean) => void;
  // The renderer's sleep: cleared on destroy, so a pending payment never resolves.
  sleep: (ms: number) => Promise<void>;
}

export const MOCK_DECLINED_CARD = "4000000000000002";

const MOCK_CSS = `
.aph-mock { display: flex; flex-direction: column; gap: 10px; font: inherit; }
.aph-mock__wallet {
  display: none; align-items: center; justify-content: center; gap: 6px;
  height: 50px; border: 0; border-radius: var(--wp-radius, 12px);
  background: var(--wp-text, #000); color: var(--wp-background, #fff);
  font: inherit; font-size: 17px; font-weight: 600; cursor: pointer;
}
.aph-mock__wallet img { width: 18px; height: 18px; }
.wp[data-theme="light"] .aph-mock__wallet img { filter: invert(1); }
.aph-mock.has-wallet .aph-mock__wallet { display: flex; }
.aph-mock__or { display: none; color: var(--wp-text-tertiary, #888); font-size: 13px; text-align: center; }
.aph-mock.has-wallet .aph-mock__or { display: block; }
.aph-mock__fields {
  display: grid; grid-template-columns: 1fr 1fr; overflow: hidden;
  border: 1px solid var(--wp-field-border, #ccc); border-radius: var(--wp-radius, 12px);
  background: var(--wp-field, transparent);
}
.aph-mock__fields.is-invalid { border-color: var(--wp-danger, #e5344f); }
.aph-mock__number { position: relative; grid-column: 1 / -1; border-bottom: 1px solid var(--wp-field-border, #ccc); }
.aph-mock__cvc { border-left: 1px solid var(--wp-field-border, #ccc); }
.aph-mock__brand { position: absolute; top: 50%; right: 12px; width: 30px; height: 20px; transform: translateY(-50%); }
.aph-mock input {
  box-sizing: border-box; width: 100%; height: 48px; padding: 0 14px; border: 0; outline: 0;
  background: transparent; color: var(--wp-text, inherit); font: inherit; font-size: 16px;
}
.aph-mock input::placeholder { color: var(--wp-text-tertiary, #888); }
`;

type FieldKey = "number" | "expiry" | "cvc";

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
    : (value.match(/.{1,4}/g) ?? [])
  )
    .filter(Boolean)
    .join(" ");

type ApplePayWindow = Window & {
  ApplePaySession?: { canMakePayments: () => boolean };
};

export function createMockCheckout(
  options: MockCheckoutOptions,
): WebPaywallCheckout {
  let ctx: CheckoutContext | null = null;
  let slot: HTMLElement | null = null;
  let box: HTMLElement | null = null;
  let fields: Record<FieldKey, HTMLInputElement> | null = null;
  let listeners: AbortController | null = null;
  // Bumped on unmount: a wallet check that outlives its mount is dropped.
  let seq = 0;
  // Wallet mode of the last check: refresh() re-checks only when it changed.
  let checkedMode: WalletMode | null = null;

  const el = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string,
  ) => {
    const node = (ctx as CheckoutContext).doc.createElement(tag);
    node.className = className;
    return node;
  };

  const fieldsBox = () => box?.querySelector(".aph-mock__fields");

  const refreshTexts = () => {
    if (!ctx || !box || !fields) return;
    fields.number.placeholder = ctx.text("payment.number_placeholder");
    fields.expiry.placeholder = ctx.text("payment.expiry_placeholder");
    fields.cvc.placeholder = ctx.text("payment.cvc_placeholder");
    const type = ctx.text("payment.apple_pay_type");
    const labels = APPLE_PAY_LABELS[type] ?? APPLE_PAY_LABELS.subscribe;
    const label = box.querySelector(".aph-mock__wallet-label");
    if (label) label.textContent = labels[lang(ctx.locale())] ?? labels.en;
    const or = box.querySelector(".aph-mock__or");
    if (or) or.textContent = ctx.text("payment.divider");
  };

  const detectWallet = async () => {
    try {
      const session = (ctx?.doc.defaultView as ApplePayWindow | null)
        ?.ApplePaySession;
      return !!session?.canMakePayments();
    } catch {
      return false;
    }
  };

  const refreshWallet = async () => {
    const token = seq;
    const mode = options.wallet();
    checkedMode = mode;
    const available =
      mode === "apple_pay"
        ? true
        : mode === "none"
          ? false
          : await detectWallet();
    if (token !== seq || !box) return;
    box.classList.toggle("has-wallet", available);
    options.onWallet(available);
  };

  const setInvalid = (on: boolean) =>
    fieldsBox()?.classList.toggle("is-invalid", on);

  const clearError = () => {
    setInvalid(false);
    ctx?.clearError();
  };

  const validate = () => {
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
  };

  const payCard = async (): Promise<PayResult> => {
    await options.sleep(1500);
    const number = digits(fields?.number.value ?? "", 19);
    return number === MOCK_DECLINED_CARD
      ? { error: "declined", provider: "mock", code: "card_declined" }
      : { ok: true };
  };

  const payWallet = async (): Promise<PayResult> => {
    await options.sleep(1300);
    return { ok: true };
  };

  return {
    async mount(target, context) {
      ctx = context;
      slot = target;
      listeners = new AbortController();
      const { signal } = listeners;

      const style = el("style", "");
      style.textContent = MOCK_CSS;
      box = el("div", "aph-mock");

      const wallet = el("button", "aph-mock__wallet");
      wallet.type = "button";
      const icon = el("img", "");
      icon.src = resolveIcon("@apple");
      icon.alt = "";
      const pay = el("span", "");
      pay.textContent = "Pay";
      wallet.append(el("span", "aph-mock__wallet-label"), icon, pay);
      wallet.addEventListener(
        "click",
        () => {
          if (ctx && !ctx.busy()) {
            clearError();
            void ctx.pay("apple_pay", payWallet);
          }
        },
        { signal },
      );

      const input = (key: FieldKey, attrs: Record<string, string>) => {
        const node = el("input", "");
        Object.entries(attrs).forEach(([name, value]) =>
          node.setAttribute(name, value),
        );
        node.type = "text";
        node.dataset.field = key;
        return node;
      };
      const number = input("number", {
        inputmode: "numeric",
        autocomplete: "cc-number",
        name: "cardnumber",
      });
      const expiry = input("expiry", {
        inputmode: "numeric",
        autocomplete: "cc-exp",
        name: "exp-date",
      });
      const cvc = input("cvc", {
        inputmode: "numeric",
        autocomplete: "cc-csc",
        name: "cvc",
      });
      const brand = el("img", "aph-mock__brand");
      brand.alt = "";
      const setBrand = (name: string) => {
        brand.src = resolveIcon(name ? "@" + name : "@card_generic");
      };
      setBrand("");

      number.addEventListener(
        "input",
        () => {
          const value = digits(number.value, 19);
          const name = cardBrand(value);
          number.value = groupCard(value, name);
          setBrand(name);
          clearError();
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
          clearError();
        },
        { signal },
      );
      cvc.addEventListener(
        "input",
        () => {
          cvc.value = digits(cvc.value, 4);
          clearError();
        },
        { signal },
      );

      const numberBox = el("div", "aph-mock__number");
      numberBox.append(number, brand);
      const cvcBox = el("div", "aph-mock__cvc");
      cvcBox.append(cvc);
      const grid = el("div", "aph-mock__fields");
      grid.append(numberBox, expiry, cvcBox);
      box.append(wallet, el("div", "aph-mock__or"), grid);
      target.append(style, box);
      fields = { number, expiry, cvc };
      refreshTexts();
      await refreshWallet();
    },
    setPlan() {
      /* the mock sells any plan */
    },
    submit() {
      if (!ctx || ctx.busy()) return;
      clearError();
      const invalid = validate();
      if (invalid) {
        setInvalid(true);
        ctx.fail({ error: invalid });
        return;
      }
      void ctx.pay("card", payCard);
    },
    async refresh() {
      refreshTexts();
      if (options.wallet() !== checkedMode) await refreshWallet();
    },
    unmount() {
      seq++;
      checkedMode = null;
      listeners?.abort();
      listeners = null;
      if (slot) slot.textContent = "";
      slot = null;
      box = null;
      fields = null;
      ctx = null;
    },
  };
}
