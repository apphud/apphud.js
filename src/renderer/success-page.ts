import { resolveIcon } from "./icons";
import { cssUrl, safeReturnUrl } from "./safe-url";

// One success page for every template (apphud-js-plan.md п. 13). The markup and
// base CSS live here; the screen's `success_page` model holds the texts and
// extra CSS. It covers the paywall while #wp-root is `is-success`.
export const SUCCESS_FIELDS = [
  "title",
  "subtitle",
  "button",
  "no_return_text",
] as const;
export type SuccessField = (typeof SUCCESS_FIELDS)[number];

const DEFAULTS: Record<SuccessField, Record<string, string>> = {
  title: { en: "Payment successful", ru: "Оплата прошла" },
  subtitle: {
    en: "Your subscription is active.",
    ru: "Подписка активна.",
  },
  button: { en: "Return to the app", ru: "Вернуться в приложение" },
  no_return_text: {
    en: "Go back to the app to start using your subscription.",
    ru: "Вернитесь в приложение, чтобы начать пользоваться подпиской.",
  },
};

export const defaultSuccessText = (field: SuccessField, locale: string) =>
  DEFAULTS[field][locale] ??
  DEFAULTS[field][locale.split("-")[0]] ??
  DEFAULTS[field].en;

export const SUCCESS_CSS = `
.aph-success {
  position: fixed; z-index: 20; inset: 0;
  display: none; flex-direction: column; align-items: center; justify-content: center;
  gap: 12px; box-sizing: border-box;
  padding: calc(var(--wp-inset-top, 0px) + 24px) 24px calc(var(--wp-inset-bottom, 0px) + 24px);
  background: var(--wp-background, #fff); color: var(--wp-text, #111);
  font-family: var(--wp-font, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
  text-align: center;
}
#wp-root.is-success > .aph-success { display: flex; }
.aph-success__icon {
  width: 88px; height: 88px; margin-bottom: 20px; border-radius: 50%;
  background: var(--wp-success, #20bf55);
}
.aph-success__icon::after {
  content: ""; display: block; width: 100%; height: 100%;
  background: #fff; -webkit-mask: var(--aph-check) center / 44px no-repeat; mask: var(--aph-check) center / 44px no-repeat;
}
.aph-success__title { margin: 0; font-size: 26px; font-weight: 800; line-height: 1.15; }
.aph-success__subtitle, .aph-success__hint {
  max-width: 320px; margin: 0; color: var(--wp-text-secondary, #666); font-size: 15px; line-height: 1.4;
}
.aph-success__subtitle:empty, .aph-success__hint:empty { display: none; }
.aph-success__button {
  display: flex; align-items: center; justify-content: center; box-sizing: border-box;
  width: 100%; max-width: 360px; min-height: 54px; margin-top: 20px; padding: 0 20px;
  border-radius: var(--wp-radius, 16px); background: var(--wp-accent, #0084ff); color: var(--wp-on-accent, #fff);
  font-size: 17px; font-weight: 700; text-decoration: none; cursor: pointer;
}
.aph-success__button[hidden], .aph-success__hint[hidden] { display: none; }
`;

export interface SuccessPage {
  readonly node: HTMLElement;
  render: (text: (field: SuccessField) => string) => void;
}

// `returnUrl`: string — the button opens it; null — no button, a hint to go
// back to the app; undefined — builder preview, the button shows without a link.
export function createSuccessPage(
  doc: Document,
  returnUrl: string | null | undefined,
): SuccessPage {
  const el = (tag: string, className: string) => {
    const node = doc.createElement(tag);
    node.className = className;
    return node;
  };
  const node = el("section", "aph-success");
  node.setAttribute("aria-live", "polite");
  const icon = el("div", "aph-success__icon");
  icon.style.setProperty("--aph-check", cssUrl(resolveIcon("@check")));
  const title = el("h2", "aph-success__title");
  const subtitle = el("p", "aph-success__subtitle");
  const hint = el("p", "aph-success__hint");
  const button = el("a", "aph-success__button");
  const href = returnUrl === undefined ? null : safeReturnUrl(returnUrl);
  // A universal link or an app scheme opens the app only from a user's tap.
  if (href) button.setAttribute("href", href);
  const showButton = returnUrl === undefined || !!href;
  button.hidden = !showButton;
  hint.hidden = showButton;
  node.append(icon, title, subtitle, button, hint);

  return {
    node,
    render(text) {
      title.textContent = text("title");
      subtitle.textContent = text("subtitle");
      button.textContent = text("button");
      hint.textContent = text("no_return_text");
    },
  };
}
