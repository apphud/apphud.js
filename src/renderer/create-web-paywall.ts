import { createMockAdapter, type AdapterContext } from "./card-adapters";
import { resolveIcon } from "./icons";
import {
  APPLE_PAY_LABELS,
  formatText,
  getPath,
  lang,
  type MacroContext,
} from "./macros";
import { cssUrl, safeHref } from "./safe-url";
import { neutralizeWebPaywallHtml } from "./sanitize-html";
import { STAGE_CSS } from "./stage-css";
import type {
  CardAdapter,
  CreateWebPaywallOptions,
  JsonObject,
  PayResult,
  PlanProduct,
  PreviewStatus,
  PaywallStatus,
  ThemeMode,
  WalletMode,
  WebPaywall,
  WebPaywallData,
  WebPaywallDraft,
  WebPaywallEventName,
  WebPaywallEventPayload,
  WebPaywallState,
} from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

// Plan cards: the template's `plans` collection, one node per item.
const PLAN_NODES = '[data-list="plans"] > [data-index]';

/**
 * Port of the prototype's `wp-js` runtime without global side effects: it
 * renders into `container` (a ShadowRoot in the builder), which it fully owns,
 * and everything it attaches outside of it is released by `destroy()`.
 */
export function createWebPaywall(
  container: HTMLElement | ShadowRoot,
  options: CreateWebPaywallOptions,
): WebPaywall {
  const { templates, onEvent, onChange } = options;
  const saved: Record<string, WebPaywallDraft> = options.saved ?? {};
  const userId = options.userId ?? null;
  const doc = container.ownerDocument ?? document;
  const view = doc.defaultView;
  const nativeApplePay =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("-webkit-appearance", "-apple-pay-button");

  container.textContent = "";
  const stageStyle = doc.createElement("style");
  stageStyle.textContent = STAGE_CSS;
  const templateStyle = doc.createElement("style");
  templateStyle.setAttribute("data-wp-template", "");
  const root = doc.createElement("div");
  root.className = "wp";
  root.id = "wp-root";
  container.append(stageStyle, templateStyle, root);

  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`);

  const state: WebPaywallState = {
    template: null,
    locale: options.locale ?? "en",
    theme: options.theme ?? null,
    wallet: options.wallet ?? "auto",
    plan: null,
    walletAvailable: false,
    cardOpen: false,
    status: "idle",
    error: null,
  };
  let data: WebPaywallData = {};
  let destroyed = false;

  // ------------------------------------------------------- lifecycle helpers
  const listeners = new AbortController();
  const { signal } = listeners;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  // Cleared on destroy: an in-flight mock payment then simply never resolves.
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => later(resolve, ms));
  let frame = 0;

  let changeQueued = false;
  const scheduleChange = () => {
    if (changeQueued || !onChange) return;
    changeQueued = true;
    queueMicrotask(() => {
      changeQueued = false;
      if (!destroyed) onChange();
    });
  };

  const emit = (
    event: WebPaywallEventName,
    payload: WebPaywallEventPayload = {},
  ) => {
    if (!destroyed) onEvent?.(event, payload);
  };

  // ---------------------------------------------------------- data + macros
  const plans = (): JsonObject[] =>
    Array.isArray(data.plans) ? data.plans.filter(isObject) : [];

  const macroContext = (): MacroContext => ({
    locale: state.locale,
    defaultLocale: options.defaultLocale || "en",
  });
  const txt = (value: unknown) => formatText(value, macroContext());
  const text = (path: string) => txt(getPath(data, path));

  const currentPlan = () =>
    state.plan == null ? undefined : plans()[state.plan];
  const currentProduct = (): PlanProduct | null => {
    const product = currentPlan()?.product;
    if (!isObject(product)) return null;
    const id = product.bundle_id;
    return { bundle_id: typeof id === "string" ? id.trim() : "" };
  };
  const productRef = () => ({ bundle_id: currentProduct()?.bundle_id });

  // ----------------------------------------------------------------- render
  const setGlyph = (node: HTMLElement, value: unknown) =>
    node.style.setProperty("--wp-icon", cssUrl(resolveIcon(value)));

  function applyTheme() {
    const theme = isObject(data.theme) ? data.theme : {};
    const mode =
      state.theme || (typeof theme.mode === "string" ? theme.mode : "dark");
    root.dataset.theme = mode;
    // colors live in their own slugs: theme_dark / theme_light
    const tokens = data[`theme_${mode}`];
    if (isObject(tokens)) {
      Object.entries(tokens).forEach(([key, value]) => {
        root.style.setProperty("--wp-" + key.replace(/_/g, "-"), String(value));
      });
    }
    if (theme.font) {
      root.style.setProperty("--wp-font-family", JSON.stringify(theme.font));
    }
    if (theme.heading_font) {
      root.style.setProperty(
        "--wp-heading-font-family",
        JSON.stringify(theme.heading_font),
      );
    }
    if (theme.radius != null) {
      root.style.setProperty("--wp-radius", theme.radius + "px");
    }
  }

  // data-bind[-src|-href|-icon] = schema data paths; data-item-bind|-src|-href|-icon = relative to a list item
  function bind(scope: HTMLElement, source: unknown, prefix = "") {
    const attr = (suffix: string) =>
      prefix
        ? `data-${prefix}${suffix.slice(1) || "bind"}`
        : `data-bind${suffix}`;
    const each = (
      suffix: string,
      fn: (node: HTMLElement, path: string) => void,
    ) =>
      scope
        .querySelectorAll<HTMLElement>(`[${attr(suffix)}]`)
        .forEach((node) => fn(node, node.getAttribute(attr(suffix)) ?? ""));
    each("", (node, path) => {
      const value = txt(getPath(source, path));
      node.textContent = value;
      node.classList.toggle("is-empty", !value);
    });
    each("-src", (node, path) =>
      node.setAttribute("src", resolveIcon(getPath(source, path))),
    );
    each("-href", (node, path) =>
      node.setAttribute("href", safeHref(getPath(source, path))),
    );
    each("-icon", (node, path) => setGlyph(node, getPath(source, path)));
  }

  function renderLists() {
    root.querySelectorAll<HTMLElement>("[data-list]").forEach((list) => {
      const children = Array.from(list.children);
      const tpl = children.find(
        (node): node is HTMLTemplateElement =>
          node instanceof HTMLTemplateElement,
      );
      const proto = tpl?.content.firstElementChild;
      if (!proto) return;
      const value = getPath(data, list.dataset.list ?? "");
      const items = Array.isArray(value) ? value : [];
      children.forEach((node) => {
        if (node !== tpl) node.remove();
      });
      items.forEach((item, i) => {
        const node = proto.cloneNode(true) as HTMLElement;
        node.style.setProperty("--i", String(i));
        node.dataset.index = String(i);
        if (isObject(item) && typeof item.icon_mode === "string") {
          node.dataset.iconMode = item.icon_mode;
        }
        bind(node, item, "item-");
        list.append(node);
      });
      const hidden =
        !items.length ||
        (list.hasAttribute("data-hide-single") && items.length < 2);
      list.classList.toggle("is-empty", hidden);
    });
  }

  const planNodes = () => root.querySelectorAll<HTMLElement>(PLAN_NODES);

  function renderPlans() {
    const count = plans().length;
    if (state.plan == null || state.plan >= count || state.plan < 0) {
      const preferred =
        Number(getPath(data, "plans_settings.default_plan")) || 1;
      state.plan = Math.max(0, Math.min(count - 1, preferred - 1));
    }
    selectPlan(state.plan, true);
  }

  function selectPlan(index: number, silent = false) {
    state.plan = index;
    planNodes().forEach((node) => {
      const on = Number(node.dataset.index) === index;
      node.classList.toggle("is-selected", on);
      node.setAttribute("aria-checked", String(on));
    });
    root.querySelectorAll<HTMLElement>("[data-plan-bind]").forEach((node) => {
      const value = txt(currentPlan()?.[node.dataset.planBind ?? ""]);
      node.textContent = value;
      node.classList.toggle("is-empty", !value);
    });
    renderCtaLabel();
    if (!silent) {
      clearError();
      emit("plan_selected", { index, ...productRef() });
    }
    scheduleChange();
  }

  function renderCtaLabel() {
    const label = $("wp-cta-label");
    if (!label) return;
    if (state.status === "processing") {
      label.textContent = text("payment.processing");
    } else if (label.dataset.planBind) {
      label.textContent = txt(currentPlan()?.[label.dataset.planBind]);
    } else {
      label.textContent = text(label.dataset.bind ?? "");
    }
  }

  function renderPayment() {
    const pay = isObject(data.payment) ? data.payment : {};
    const type =
      typeof pay.apple_pay_type === "string" &&
      APPLE_PAY_LABELS[pay.apple_pay_type]
        ? pay.apple_pay_type
        : "subscribe";
    const auto = root.dataset.theme === "dark" ? "white" : "black";
    const style =
      typeof pay.apple_pay_style === "string" && pay.apple_pay_style !== "auto"
        ? pay.apple_pay_style
        : auto;
    const button = $<HTMLButtonElement>("wp-applepay");
    const label =
      APPLE_PAY_LABELS[type][lang(state.locale)] ?? APPLE_PAY_LABELS[type].en;
    if (button) {
      button.className = `wp__applepay is-type-${type} is-style-${style}${nativeApplePay ? " is-native" : ""}`;
      button.setAttribute("aria-label", `${label} Apple Pay`.trim());
    }
    const buttonLabel = $("wp-applepay-label");
    if (buttonLabel) buttonLabel.textContent = label;

    const brands = $("wp-brands");
    if (brands) {
      brands.textContent = "";
      (Array.isArray(data.card_brands) ? data.card_brands : [])
        .filter(isObject)
        .forEach(({ brand }) => {
          const img = doc.createElement("img");
          img.src = resolveIcon(brand);
          img.alt = "";
          brands.append(img);
        });
    }

    root.classList.toggle("has-wallet", state.walletAvailable);
    root.classList.toggle(
      "is-card-open",
      !state.walletAvailable || state.cardOpen,
    );
    adapter.refresh();
    scheduleChange();
  }

  function setStatus(status: PaywallStatus) {
    state.status = status;
    root.classList.toggle("is-processing", status === "processing");
    root.classList.toggle("is-success", status === "success");
    const cta = $<HTMLButtonElement>("wp-cta");
    if (cta) cta.disabled = status === "processing";
    const applePay = $<HTMLButtonElement>("wp-applepay");
    if (applePay) applePay.disabled = status === "processing";
    renderCtaLabel();
    scheduleChange();
  }

  function showError(key: string, message?: string) {
    state.error = key;
    const errorText = $("wp-error-text");
    if (errorText) {
      errorText.textContent =
        message || text("errors." + key) || text("errors.generic");
    }
    root.classList.add("has-error");
    $("wp-fields")?.classList.toggle(
      "is-invalid",
      key === "incomplete" || key === "declined",
    );
    scheduleChange();
  }

  function clearError() {
    state.error = null;
    root.classList.remove("has-error");
    $("wp-fields")?.classList.remove("is-invalid");
    scheduleChange();
  }

  const fieldsFocus = (on: boolean) =>
    $("wp-fields")?.classList.toggle("is-focus", on);

  const setBrand = (brand: string) => {
    $("wp-card-brand")?.setAttribute(
      "src",
      resolveIcon(brand ? "@" + brand : "@card_generic"),
    );
  };

  // countdown for any [data-countdown] node: minutes from data path, restarts on mount
  let countdownTimer: ReturnType<typeof setInterval> | undefined;
  let countdownEnd = 0;
  function renderExtras() {
    const nodes = root.querySelectorAll<HTMLElement>("[data-countdown]");
    clearInterval(countdownTimer);
    countdownTimer = undefined;
    if (!nodes.length) return;
    const tick = () => {
      const left = Math.max(0, Math.round((countdownEnd - Date.now()) / 1000));
      const value = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
      nodes.forEach((node) => {
        node.textContent = value;
      });
    };
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function renderAll() {
    root.lang = state.locale;
    applyTheme();
    renderLists();
    bind(root, data);
    renderPlans();
    renderPayment();
    setStatus(state.status);
    renderExtras();
  }

  // --------------------------------------------------------------- adapters
  const adapterContext: AdapterContext = {
    doc,
    $,
    text,
    fieldsFocus,
    setBrand,
    clearError,
    sleep,
  };

  let adapter: CardAdapter = createMockAdapter(adapterContext);
  let adapterSeq = 0;

  const unmountAdapter = () => {
    try {
      adapter.unmount();
    } catch {
      /* already gone */
    }
  };

  async function refreshWallet(token: number) {
    let available: boolean;
    if (state.wallet === "apple_pay") available = true;
    else if (state.wallet === "none") available = false;
    else available = await adapter.detectWallet().catch(() => false);
    if (destroyed || token !== adapterSeq) return;
    state.walletAvailable = available;
    renderPayment();
    emit("wallet", { available, source: state.wallet });
  }

  async function mountAdapter() {
    const token = ++adapterSeq;
    unmountAdapter();
    adapter = createMockAdapter(adapterContext);
    adapter.mount();
    scheduleChange();
    await refreshWallet(token);
  }

  // ------------------------------------------------------------------ flows
  async function pay(
    method: "apple_pay" | "card",
    run: () => Promise<PayResult>,
  ) {
    setStatus("processing");
    emit("checkout_initiated", { method, ...productRef() });
    const result = await run().catch(
      (e): PayResult => ({ error: "generic", message: errorMessage(e) }),
    );
    if (!destroyed) finish(result);
  }

  function payWithWallet() {
    if (state.status === "processing") return;
    clearError();
    void pay("apple_pay", () => adapter.payWallet());
  }

  function payWithCard(event: Event) {
    event.preventDefault();
    if (state.status === "processing") return;
    clearError();
    const invalid = adapter.validate();
    if (invalid) {
      showError(invalid);
      return;
    }
    void pay("card", () => adapter.payCard());
  }

  function finish(result: PayResult) {
    if (result.ok) {
      setStatus("success");
      return;
    }
    setStatus("idle");
    if (result.cancelled) return;
    if (!state.cardOpen) {
      state.cardOpen = true;
      renderPayment();
    }
    showError(result.error || "generic", result.message);
  }

  function openMethod(card: boolean) {
    if (state.status === "processing") return;
    state.cardOpen = card;
    clearError();
    renderPayment();
    if (!card || !view) return;
    view.cancelAnimationFrame(frame);
    frame = view.requestAnimationFrame(() => {
      if (destroyed) return;
      $("wp-card")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      adapter.focus();
    });
  }

  const eventElement = (e: Event) =>
    e.target instanceof Element ? e.target : null;

  function bindPress() {
    let pressed: Element | null = null;
    let pressedAt = 0;
    const down = (e: Event) => {
      const node = eventElement(e)?.closest("[data-press]");
      if (!node || !root.contains(node)) return;
      pressed = node;
      pressedAt = Date.now();
      node.classList.add("is-press");
    };
    const up = () => {
      if (!pressed) return;
      const node = pressed;
      pressed = null;
      later(
        () => node.classList.remove("is-press"),
        Math.max(0, 220 - (Date.now() - pressedAt)),
      );
    };
    root.addEventListener("touchstart", down, { passive: true, signal });
    root.addEventListener(
      "mousedown",
      (e) => {
        if (e.button === 0) down(e);
      },
      { signal },
    );
    // release can happen outside the paywall, hence document
    (["touchend", "touchcancel", "mouseup"] as const).forEach((type) =>
      doc.addEventListener(type, up, { signal }),
    );
  }

  // listeners live on #wp-root, so they survive template re-mounts
  root.addEventListener(
    "click",
    (e) => {
      const target = eventElement(e);
      if (!target) return;
      if (target.closest("#wp-applepay")) {
        payWithWallet();
        return;
      }
      const action = target.closest<HTMLElement>("[data-action]");
      if (action && root.contains(action)) {
        const name = action.dataset.action;
        if (name === "open-card") openMethod(true);
        if (name === "open-wallet") openMethod(false);
        if (name === "scroll-to-pay") {
          $("wp-card")?.scrollIntoView?.({
            behavior: "smooth",
            block: "center",
          });
        }
        return;
      }
      const plan = target.closest<HTMLElement>(PLAN_NODES);
      if (plan && state.status !== "processing") {
        selectPlan(Number(plan.dataset.index));
      }
    },
    { signal },
  );
  root.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const plan = eventElement(e)?.closest<HTMLElement>(PLAN_NODES);
      if (!plan) return;
      e.preventDefault();
      selectPlan(Number(plan.dataset.index));
    },
    { signal },
  );
  root.addEventListener(
    "submit",
    (e) => {
      if (eventElement(e)?.id === "wp-card") payWithCard(e);
    },
    { signal },
  );

  // ------------------------------------------------------------------ mount
  const findTemplate = (name?: string) =>
    templates.find((tpl) => tpl.name === name) ?? templates[0];

  const saveDraft = () => {
    if (!state.template) return;
    saved[state.template] = { data: clone(data) };
  };

  async function mount(name?: string, nextData?: WebPaywallData) {
    const tpl = findTemplate(name);
    saveDraft();
    unmountAdapter();
    templateStyle.textContent = tpl.css;
    root.className = "wp";
    root.removeAttribute("style");
    root.dataset.template = tpl.name;
    // API html shares this page's origin. Strip script, iframe, object, embed,
    // on* handlers and javascript: URLs before the nodes are inserted.
    root.replaceChildren(neutralizeWebPaywallHtml(tpl.html, doc));
    data = clone(nextData ?? saved[tpl.name]?.data ?? tpl.data);
    const minutes = Number(getPath(data, "timer.minutes")) || 0;
    countdownEnd = Date.now() + minutes * 60000;
    if (state.template) state.theme = null;
    Object.assign(state, {
      template: tpl.name,
      plan: null,
      cardOpen: false,
      status: "idle",
      error: null,
    });
    renderAll();
    await mountAdapter();
    if (!destroyed) emit("template", { template: tpl.name });
    return data;
  }

  bindPress();
  const ready = mount(options.template).then(() =>
    emit("shown", { user_id: userId }),
  );

  return {
    state,
    ready,
    get templates() {
      return templates.map(({ name, title }) => ({ name, title }));
    },
    get defaults() {
      return findTemplate(state.template ?? undefined).data;
    },
    get data() {
      return data;
    },
    mount,
    setData(next: WebPaywallData) {
      data = next;
      renderAll();
    },
    updateData(recipe: (draft: WebPaywallData) => void) {
      const next = clone(data);
      recipe(next);
      data = next;
      renderAll();
    },
    resetData() {
      data = clone(findTemplate(state.template ?? undefined).data);
      state.plan = null;
      renderAll();
      return data;
    },
    setPlan(index: number) {
      state.plan = index;
      renderPlans();
    },
    setLocale(locale: string) {
      state.locale = locale;
      renderAll();
    },
    setTheme(mode: ThemeMode) {
      state.theme = mode;
      renderAll();
    },
    async setWallet(mode: WalletMode) {
      state.wallet = mode;
      state.cardOpen = false;
      await refreshWallet(adapterSeq);
    },
    preview(status: PreviewStatus) {
      clearError();
      if (status === "error") {
        setStatus("idle");
        state.cardOpen = true;
        renderPayment();
        showError("declined");
      } else {
        setStatus(status);
      }
    },
    format: (value: unknown) => txt(value),
    destroy() {
      if (destroyed) return;
      saveDraft();
      destroyed = true;
      adapterSeq++;
      listeners.abort();
      clearInterval(countdownTimer);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      view?.cancelAnimationFrame(frame);
      unmountAdapter();
      container.textContent = "";
    },
  };
}
