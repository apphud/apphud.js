import { resolveIcon } from "./icons";
import { formatText, getPath, type MacroContext } from "./macros";
import { createMockCheckout } from "./mock-checkout";
import { cssUrl, safeHref } from "./safe-url";
import { neutralizeWebPaywallHtml } from "./sanitize-html";
import { DEVICE_INSETS_CSS, STAGE_CSS } from "./stage-css";
import {
  createSuccessPage,
  defaultSuccessText,
  SUCCESS_CSS,
  type SuccessField,
} from "./success-page";
import type {
  CheckoutContext,
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
  WebPaywallCheckout,
  WebPaywallEventPayload,
  WebPaywallState,
} from "./types";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

// `$plans.0.price` → `plans.0`: the item a collection field belongs to (its
// product decides the field's rendered text too).
const COLLECTION_KEY = /^\$([^.]+\.\d+)(?:\.|$)/;
// Plan cards: the template's `plans` collection, one node per item.
const PLAN_NODES = '[data-list="plans"] > [data-index]';
// Where the checkout mounts its payment form; the renderer draws nothing inside.
const CHECKOUT_SLOT = "[data-checkout]";

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

  container.textContent = "";
  const stageStyle = doc.createElement("style");
  stageStyle.textContent =
    STAGE_CSS + (options.hosted ? "" : DEVICE_INSETS_CSS) + SUCCESS_CSS;
  const templateStyle = doc.createElement("style");
  templateStyle.setAttribute("data-wp-template", "");
  // `success_page.css` from the screen data, over the base success page CSS.
  const successStyle = doc.createElement("style");
  successStyle.setAttribute("data-wp-success", "");
  const root = doc.createElement("div");
  root.className = "wp";
  root.id = "wp-root";
  container.append(stageStyle, templateStyle, successStyle, root);
  const successPage = createSuccessPage(doc, options.returnUrl);

  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`);

  const state: WebPaywallState = {
    template: null,
    locale: options.locale ?? "en",
    theme: options.theme ?? null,
    wallet: options.wallet ?? "auto",
    plan: null,
    walletAvailable: false,
    status: "idle",
    error: null,
  };
  let data: WebPaywallData = {};
  let destroyed = false;
  // Texts rendered by the server, by key: `$title.text`, `$plans.0.price`.
  // They win over `data` for the language they were rendered in.
  let texts: Record<string, string> | null = options.texts ?? null;
  let textsLocale: string | null = null;

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
    erase: !!options.hosted,
  });
  const txt = (value: unknown) => formatText(value, macroContext());
  // The server's text of the data path `key`, else `value` through the macros.
  const keyed = (key: string, value: unknown) => {
    const rendered =
      texts && (textsLocale == null || textsLocale === state.locale)
        ? texts["$" + key]
        : undefined;
    return typeof rendered === "string" ? rendered : txt(value);
  };
  const text = (path: string) => keyed(path, getPath(data, path));
  // A field of the selected plan: `plans.<index>.<field>`.
  const planText = (field: string) =>
    state.plan == null
      ? txt(undefined)
      : keyed(`plans.${state.plan}.${field}`, currentPlan()?.[field]);

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
  // at `base` (`plans.0`), the key of its server texts.
  // `textsOnly`: a texts redraw, which leaves images, links and icons alone.
  function bind(
    scope: HTMLElement,
    source: unknown,
    prefix = "",
    base = "",
    textsOnly = false,
  ) {
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
      const value = keyed(
        base ? `${base}.${path}` : path,
        getPath(source, path),
      );
      node.textContent = value;
      node.classList.toggle("is-empty", !value);
    });
    if (textsOnly) return;
    each("-src", (node, path) =>
      node.setAttribute("src", resolveIcon(getPath(source, path))),
    );
    each("-href", (node, path) =>
      node.setAttribute("href", safeHref(getPath(source, path))),
    );
    each("-icon", (node, path) => setGlyph(node, getPath(source, path)));
  }

  // Items already drawn are bound again in place: new nodes would replay the
  // template's entry animations (and drop hover and focus) on every builder
  // edit. Only items beyond them are cloned, and nodes past the end go.
  function renderLists() {
    root.querySelectorAll<HTMLElement>("[data-list]").forEach((list) => {
      const children = Array.from(list.children);
      const tpl = children.find(
        (node): node is HTMLTemplateElement =>
          node instanceof HTMLTemplateElement,
      );
      const proto = tpl?.content.firstElementChild;
      if (!proto) return;
      const path = list.dataset.list ?? "";
      const value = getPath(data, path);
      const items = Array.isArray(value) ? value : [];
      const drawn: HTMLElement[] = [];
      children.forEach((node) => {
        if (node === tpl) return;
        const i = node instanceof HTMLElement ? Number(node.dataset.index) : -1;
        if (Number.isInteger(i) && i >= 0 && i < items.length && !drawn[i]) {
          drawn[i] = node as HTMLElement;
        } else {
          node.remove();
        }
      });
      items.forEach((item, i) => {
        let node = drawn[i];
        if (!node) {
          node = proto.cloneNode(true) as HTMLElement;
          node.dataset.index = String(i);
          list.insertBefore(node, drawn.slice(i + 1).find(Boolean) ?? null);
        }
        node.style.setProperty("--i", String(i));
        if (isObject(item) && typeof item.icon_mode === "string") {
          node.dataset.iconMode = item.icon_mode;
        } else {
          delete node.dataset.iconMode;
        }
        bind(node, item, "item-", `${path}.${i}`);
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

  // The selected plan's card and its texts, without telling the checkout.
  function paintPlan() {
    planNodes().forEach((node) => {
      const on = Number(node.dataset.index) === state.plan;
      node.classList.toggle("is-selected", on);
      node.setAttribute("aria-checked", String(on));
    });
    root.querySelectorAll<HTMLElement>("[data-plan-bind]").forEach((node) => {
      const value = planText(node.dataset.planBind ?? "");
      node.textContent = value;
      node.classList.toggle("is-empty", !value);
    });
    renderCtaLabel();
  }

  function selectPlan(index: number, silent = false) {
    state.plan = index;
    paintPlan();
    options.onPlan?.(currentProduct(), { setTexts });
    if (checkoutMounted) checkout.setPlan(currentProduct());
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
      label.textContent = planText(label.dataset.planBind);
    } else {
      label.textContent = text(label.dataset.bind ?? "");
    }
  }

  function renderSuccessPage() {
    const page = isObject(data.success_page) ? data.success_page : {};
    const css = typeof page.css === "string" ? page.css : "";
    // a texts redraw lands here too: no stylesheet re-parse for nothing
    if (successStyle.textContent !== css) successStyle.textContent = css;
    successPage.render(
      (field: SuccessField) =>
        keyed(`success_page.${field}`, page[field]) ||
        defaultSuccessText(field, state.locale),
    );
  }

  function setStatus(status: PaywallStatus) {
    state.status = status;
    root.classList.toggle("is-processing", status === "processing");
    root.classList.toggle("is-success", status === "success");
    const cta = $<HTMLButtonElement>("wp-cta");
    if (cta) cta.disabled = status === "processing";
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
    scheduleChange();
  }

  function clearError() {
    state.error = null;
    root.classList.remove("has-error");
    scheduleChange();
  }

  let submitVisible = true;
  function renderSubmit() {
    // Inline style: template CSS sets `display` on .wp__cta and beats [hidden].
    const cta = $("wp-cta");
    if (cta) cta.style.display = submitVisible ? "" : "none";
  }

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
    renderSubmit();
    renderSuccessPage();
    setStatus(state.status);
    renderExtras();
    if (checkoutMounted) void checkout.refresh?.();
  }

  // Only what texts change, in the nodes already there: no theme, countdown or
  // checkout calls, so the checkout itself may set texts while it handles a
  // plan, and the focused plan card and running animations stay.
  function renderTexts() {
    root.querySelectorAll<HTMLElement>("[data-list]").forEach((list) => {
      const path = list.dataset.list ?? "";
      const value = getPath(data, path);
      const items = Array.isArray(value) ? value : [];
      Array.from(list.children).forEach((node) => {
        if (!(node instanceof HTMLElement) || node.dataset.index == null)
          return;
        const i = Number(node.dataset.index);
        bind(node, items[i], "item-", `${path}.${i}`, true);
      });
    });
    bind(root, data, "", "", true);
    paintPlan();
    renderSuccessPage();
  }

  function setTexts(next: Record<string, string> | null, locale?: string) {
    const nextLocale = locale ?? null;
    if (nextLocale === textsLocale && sameTexts(texts, next)) return;
    texts = next ? { ...next } : null;
    textsLocale = nextLocale;
    if (!state.template) return;
    renderTexts();
    // The form draws its own texts (ctx.text). Later, not now: the checkout
    // may be setting these texts from inside its own plan handling.
    if (checkoutMounted) {
      queueMicrotask(() => {
        if (checkoutMounted && !destroyed) void checkout.refresh?.();
      });
    }
  }

  // An edit in the builder: the texts of changed fields are the old data's
  // until the next server answer, so they go and the field shows its own data.
  // A collection field compares itself and its item's product: a plan that
  // moved up keeps its text but not its bundle, and so not its price, while an
  // edit of another field of the plan (title, badge) keeps the price.
  function dropStaleTexts(prev: WebPaywallData, next: WebPaywallData) {
    if (!texts) return;
    const source = (from: WebPaywallData, key: string) => {
      const path = key.slice(1);
      const item = COLLECTION_KEY.exec(key);
      return JSON.stringify(
        item
          ? [getPath(from, path), getPath(from, `${item[1]}.product`)]
          : getPath(from, path),
      );
    };
    const kept = Object.fromEntries(
      Object.entries(texts).filter(
        ([key]) => source(prev, key) === source(next, key),
      ),
    );
    texts = Object.keys(kept).length ? kept : null;
  }

  const sameTexts = (
    a: Record<string, string> | null,
    b: Record<string, string> | null,
  ) => {
    if (!a || !b) return a === b;
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => b[key] === a[key])
    );
  };

  // --------------------------------------------------------------- checkout
  const checkout: WebPaywallCheckout =
    options.checkout ??
    createMockCheckout({
      wallet: () => state.wallet,
      onWallet: (available) => {
        if (destroyed) return;
        state.walletAvailable = available;
        scheduleChange();
        emit("wallet", { available, source: state.wallet });
      },
      sleep,
      simulatePayments: options.simulatePayments ?? true,
    });

  const checkoutContext: CheckoutContext = {
    doc,
    locale: () => state.locale,
    text,
    pay,
    fail: (result) => {
      if (!destroyed) showError(result.error || "generic", result.message);
    },
    clearError,
    wait: async (task) => {
      setStatus("processing");
      try {
        return await task();
      } finally {
        if (!destroyed && state.status === "processing") setStatus("idle");
      }
    },
    setSubmit: (visible) => {
      submitVisible = visible;
      renderSubmit();
    },
    busy: () => state.status !== "idle",
  };

  // setPlan and refresh reach the checkout only between mount and unmount.
  let checkoutMounted = false;
  const unmountCheckout = () => {
    checkoutMounted = false;
    try {
      checkout.unmount();
    } catch {
      /* already gone */
    }
  };

  async function mountCheckout() {
    unmountCheckout();
    submitVisible = !!checkout.submit;
    renderSubmit();
    const slot = root.querySelector<HTMLElement>(CHECKOUT_SLOT);
    if (!slot) return;
    slot.textContent = "";
    await checkout.mount(slot, checkoutContext);
    if (destroyed) return;
    checkoutMounted = true;
    checkout.setPlan(currentProduct());
  }

  // ------------------------------------------------------------------ flows
  async function pay(method: string, run: () => Promise<PayResult>) {
    if (destroyed || state.status !== "idle") return;
    clearError();
    setStatus("processing");
    emit("checkout_initiated", { method, ...productRef() });
    const result = await run().catch((e): PayResult => ({
      error: "generic",
      message: errorMessage(e),
    }));
    if (!destroyed) finish(result);
  }

  function finish(result: PayResult) {
    if (result.ok) {
      setStatus("success");
      return;
    }
    setStatus("idle");
    if (result.cancelled) return;
    showError(result.error || "generic", result.message);
    emit("payment_error", {
      provider: result.provider,
      code: result.code ?? result.error,
      message: result.message ?? result.detail,
      ...productRef(),
    });
  }

  function scrollToCheckout() {
    root
      .querySelector(CHECKOUT_SLOT)
      ?.scrollIntoView?.({ behavior: "smooth", block: "center" });
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
      if (target.closest(CHECKOUT_SLOT)) return;
      if (target.closest("#wp-cta")) {
        if (state.status === "idle") checkout.submit?.();
        return;
      }
      const action = target.closest<HTMLElement>("[data-action]");
      if (action && root.contains(action)) {
        if (action.dataset.action === "scroll-to-pay") scrollToCheckout();
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

  // ------------------------------------------------------------------ mount
  const findTemplate = (name?: string) =>
    templates.find((tpl) => tpl.name === name) ?? templates[0];

  const saveDraft = () => {
    if (!state.template) return;
    saved[state.template] = { data: clone(data) };
  };

  async function mount(name?: string, nextData?: WebPaywallData) {
    const tpl = findTemplate(name);
    // keys of another template's fields, or of the data being replaced
    if (state.template && (state.template !== tpl.name || nextData)) {
      texts = textsLocale = null;
    }
    saveDraft();
    unmountCheckout();
    templateStyle.textContent = tpl.css;
    root.className = "wp";
    root.removeAttribute("style");
    root.dataset.template = tpl.name;
    // API html shares this page's origin. Strip script, iframe, object, embed,
    // on* handlers and javascript: URLs before the nodes are inserted.
    root.replaceChildren(
      neutralizeWebPaywallHtml(tpl.html, doc),
      successPage.node,
    );
    data = clone(nextData ?? saved[tpl.name]?.data ?? tpl.data);
    const minutes = Number(getPath(data, "timer.minutes")) || 0;
    countdownEnd = Date.now() + minutes * 60000;
    if (state.template) state.theme = null;
    Object.assign(state, {
      template: tpl.name,
      plan: null,
      status: "idle",
      error: null,
    });
    renderAll();
    await mountCheckout();
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
      dropStaleTexts(data, next);
      data = next;
      renderAll();
    },
    updateData(recipe: (draft: WebPaywallData) => void) {
      const next = clone(data);
      recipe(next);
      dropStaleTexts(data, next);
      data = next;
      renderAll();
    },
    resetData() {
      // the texts were rendered from the data being dropped
      texts = textsLocale = null;
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
    setTexts,
    setTheme(mode: ThemeMode) {
      state.theme = mode;
      renderAll();
    },
    async setWallet(mode: WalletMode) {
      state.wallet = mode;
      if (checkoutMounted) await checkout.refresh?.();
    },
    preview(status: PreviewStatus) {
      clearError();
      if (status === "error") {
        setStatus("idle");
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
      listeners.abort();
      clearInterval(countdownTimer);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      unmountCheckout();
      container.textContent = "";
    },
  };
}
