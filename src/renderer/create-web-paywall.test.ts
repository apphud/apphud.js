import { afterEach, describe, expect, it, vi } from "vitest";
import { WEB_PAYWALL_TEMPLATES } from "./__fixtures__/templates";
import { createWebPaywall } from "./create-web-paywall";
import type { CreateWebPaywallOptions, JsonObject } from "./types";

// Microtasks stay real (vitest does not fake queueMicrotask by default): onChange
// is batched through it, and a faked queue would count as a pending "timer".
const useFakeTimers = () => vi.useFakeTimers();

const createHost = () => {
  const host = document.createElement("div");
  document.body.append(host);
  return { host, shadow: host.attachShadow({ mode: "open" }) };
};

const create = (
  shadow: ShadowRoot,
  options: Partial<CreateWebPaywallOptions> = {},
) =>
  createWebPaywall(shadow, {
    templates: WEB_PAYWALL_TEMPLATES,
    ...options,
  });

const rootOf = (shadow: ShadowRoot) => {
  const root = shadow.getElementById("wp-root");
  if (!root) throw new Error("#wp-root is not rendered");
  return root;
};

const planNodes = (root: HTMLElement) =>
  Array.from(
    root.querySelectorAll<HTMLElement>('[data-list="plans"] > [data-index]'),
  );

const submitCard = (root: HTMLElement) =>
  root
    .querySelector("#wp-card")
    ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

const typeInto = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("createWebPaywall lifecycle", () => {
  it("leaves no listeners, timers, lang or head styles after 10 cycles", async () => {
    useFakeTimers();
    document.documentElement.lang = "xx";
    const headBefore = document.head.innerHTML;
    // jsdom's selector engine (nwsapi) adds its own hover listeners to the
    // document on the first query; run one before counting ours.
    document.querySelector(":hover");
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const onChange = vi.fn();

    for (let i = 0; i < 10; i++) {
      const { host, shadow } = createHost();
      const template = WEB_PAYWALL_TEMPLATES[i % 3].name;
      const paywall = create(shadow, {
        template,
        locale: i % 2 ? "ru" : "en",
        onChange,
        onEvent: vi.fn(),
      });
      await paywall.ready;

      expect(rootOf(shadow).dataset.template).toBe(template);
      expect(rootOf(shadow).lang).toBe(i % 2 ? "ru" : "en");
      if (template === "packages_app") {
        // the countdown is running, so the zero count below means something
        expect(vi.getTimerCount()).toBeGreaterThan(0);
      }

      paywall.destroy();
      const callsAtDestroy = onChange.mock.calls.length;
      await Promise.resolve();
      expect(onChange).toHaveBeenCalledTimes(callsAtDestroy);
      expect(shadow.childNodes).toHaveLength(0);
      expect(host.childNodes).toHaveLength(0);
      host.remove();
    }

    const active = add.mock.calls.filter(([type, listener, options]) => {
      const signal = typeof options === "object" ? options.signal : undefined;
      if (signal?.aborted) return false;
      return !remove.mock.calls.some(
        ([removedType, removed]) =>
          removedType === type && removed === listener,
      );
    });
    expect(add.mock.calls.length).toBeGreaterThanOrEqual(30);
    expect(active).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(document.documentElement.lang).toBe("xx");
    expect(document.head.innerHTML).toBe(headBefore);
  });
});

describe("createWebPaywall states", () => {
  it("switches plan, preview state and theme on #wp-root", async () => {
    const events: string[] = [];
    const payloads: Record<string, unknown>[] = [];
    const { shadow } = createHost();
    const paywall = create(shadow, {
      template: "apphud_branded",
      wallet: "apple_pay",
      onEvent: (event, payload) => {
        events.push(event);
        payloads.push(payload);
      },
    });
    await paywall.ready;
    const root = rootOf(shadow);

    expect(planNodes(root)).toHaveLength(2);
    expect(planNodes(root)[0].classList.contains("is-selected")).toBe(true);
    expect(root.classList.contains("has-wallet")).toBe(true);
    expect(root.classList.contains("is-card-open")).toBe(false);
    expect(events).toEqual(["wallet", "template", "shown"]);

    planNodes(root)[1].click();
    expect(paywall.state.plan).toBe(1);
    expect(planNodes(root)[1].getAttribute("aria-checked")).toBe("true");
    expect(planNodes(root)[0].classList.contains("is-selected")).toBe(false);
    expect(root.querySelector("#wp-cta-label")?.textContent).toBe(
      "Subscribe for $9.99",
    );
    expect(payloads[events.indexOf("plan_selected")]).toEqual({
      index: 1,
      bundle_id: "",
    });
    // flat slugs: card brands are their own collection
    expect(root.querySelectorAll("#wp-brands img")).toHaveLength(3);

    paywall.preview("error");
    expect(root.classList.contains("has-error")).toBe(true);
    expect(root.classList.contains("is-card-open")).toBe(true);
    expect(root.querySelector("#wp-error-text")?.textContent).toBe(
      "Your card was declined. Try another card.",
    );

    paywall.preview("success");
    expect(root.classList.contains("is-success")).toBe(true);
    expect(root.classList.contains("has-error")).toBe(false);

    expect(root.dataset.theme).toBe("dark");
    paywall.setTheme("light");
    expect(root.dataset.theme).toBe("light");
    expect(root.style.getPropertyValue("--wp-background")).toBe("#F4F7FB");

    paywall.destroy();
  });

  it("runs the mock card checkout: incomplete, processing, declined", async () => {
    useFakeTimers();
    const events: string[] = [];
    const { shadow } = createHost();
    const paywall = create(shadow, {
      template: "apphud_branded",
      wallet: "none",
      onEvent: (event) => events.push(event),
    });
    await paywall.ready;
    const root = rootOf(shadow);
    expect(root.classList.contains("is-card-open")).toBe(true);

    submitCard(root);
    expect(paywall.state.error).toBe("incomplete");
    expect(root.querySelector("#wp-fields")?.classList).toContain("is-invalid");

    const [number, expiry, cvc] = Array.from(
      root.querySelectorAll<HTMLInputElement>(".wp__control input"),
    );
    typeInto(number, "4000000000000002");
    typeInto(expiry, "1230");
    typeInto(cvc, "123");
    expect(number.value).toBe("4000 0000 0000 0002");
    expect(expiry.value).toBe("12 / 30");
    expect(paywall.state.error).toBeNull();

    submitCard(root);
    expect(paywall.state.status).toBe("processing");
    expect(root.classList.contains("is-processing")).toBe(true);
    expect(root.querySelector("#wp-cta-label")?.textContent).toBe(
      "Processing…",
    );
    expect(events).toContain("checkout_initiated");

    await vi.advanceTimersByTimeAsync(1500);
    expect(paywall.state.status).toBe("idle");
    expect(paywall.state.error).toBe("declined");
    expect(root.classList.contains("has-error")).toBe(true);
    expect(events).not.toContain("purchased");

    paywall.destroy();
  });

  it("reads the flat lists and the default plan from plans_settings", async () => {
    const { shadow } = createHost();
    const paywall = create(shadow, { template: "packages_app" });
    await paywall.ready;
    const root = rootOf(shadow);

    expect(
      root.querySelectorAll('[data-list="reviews"] > [data-index]'),
    ).toHaveLength(3);
    expect(
      root.querySelectorAll('[data-list="features"] > [data-index]'),
    ).toHaveLength(3);

    paywall.updateData((draft) => {
      const plans = draft.plans as Record<string, unknown>[];
      plans.push({ ...plans[0], title: { en: "Second" } });
      draft.plans_settings = { default_plan: 2 };
    });
    paywall.setPlan(-1);
    expect(paywall.state.plan).toBe(1);
    expect(planNodes(root)[1].classList.contains("is-selected")).toBe(true);
    paywall.destroy();
  });

  it("sends the plan's bundle_id with checkout_initiated", async () => {
    useFakeTimers();
    const payloads: Record<string, unknown>[] = [];
    const { shadow } = createHost();
    const paywall = create(shadow, {
      template: "baby_cry",
      wallet: "apple_pay",
      onEvent: (event, payload) => {
        if (event === "checkout_initiated") payloads.push(payload);
      },
    });
    await paywall.ready;
    paywall.updateData((draft) => {
      (draft.plans as JsonObject[])[0].product = { bundle_id: " bundle-1 " };
    });
    rootOf(shadow).querySelector<HTMLButtonElement>("#wp-applepay")?.click();
    expect(payloads).toEqual([{ method: "apple_pay", bundle_id: "bundle-1" }]);
    paywall.destroy();
  });

  it("leaves an onerror/script payload from template html inert", async () => {
    const marker = window as Window & { __xss?: boolean };
    marker.__xss = false;
    const { shadow } = createHost();
    const paywall = create(shadow, {
      template: "evil",
      wallet: "none",
      templates: [
        {
          name: "evil",
          title: "Evil",
          css: ".wp{}",
          schema: [],
          data: { features: [{}] },
          html: `
            <p id="kept">Safe copy</p>
            <img id="live" src="x" alt="" onerror="window.__xss = true">
            <script>window.__xss = true</script>
            <iframe src="javascript:window.__xss = true"></iframe>
            <object data="javascript:window.__xss = true"></object>
            <embed src="javascript:window.__xss = true">
            <a id="js-link" href="javascript:window.__xss = true">go</a>
            <a id="ok-link" href="https://example.com/terms">terms</a>
            <div data-list="features">
              <template>
                <div>
                  <img src="x" alt="" onerror="window.__xss = true">
                  <script>window.__xss = true</script>
                  <a href="javascript:window.__xss = true">x</a>
                </div>
              </template>
            </div>
          `,
        },
      ],
    });
    await paywall.ready;
    const root = rootOf(shadow);

    expect(marker.__xss).toBe(false);
    expect(root.querySelector("#kept")?.textContent).toBe("Safe copy");
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector("iframe")).toBeNull();
    expect(root.querySelector("object")).toBeNull();
    expect(root.querySelector("embed")).toBeNull();
    const live = root.querySelector<HTMLImageElement>("#live");
    expect(live?.hasAttribute("onerror")).toBe(false);
    expect(live?.onerror).toBeNull();
    expect(root.querySelector("#js-link")?.hasAttribute("href")).toBe(false);
    expect(root.querySelector("#ok-link")?.getAttribute("href")).toBe(
      "https://example.com/terms",
    );

    const row = root.querySelector('[data-list="features"] > [data-index]');
    expect(row).not.toBeNull();
    expect(row?.querySelector("script")).toBeNull();
    expect(row?.querySelector("img")?.hasAttribute("onerror")).toBe(false);
    expect(row?.querySelector("a")?.getAttribute("href") ?? "").not.toMatch(
      /javascript:/i,
    );
    const stored = root.querySelector("template");
    expect(stored?.content.querySelector("script")).toBeNull();
    expect(stored?.content.querySelector("img")?.hasAttribute("onerror")).toBe(
      false,
    );

    paywall.destroy();
    delete marker.__xss;
  });

  it("keeps edits per template in the saved drafts", async () => {
    const saved = {};
    const { shadow } = createHost();
    const paywall = create(shadow, { template: "baby_cry", saved });
    await paywall.ready;

    paywall.updateData((draft) => {
      draft.title = { text: { en: "Edited title" } };
    });
    await paywall.mount("packages_app");
    await paywall.mount("baby_cry");
    expect(rootOf(shadow).querySelector(".wp__title")?.textContent).toBe(
      "Edited title",
    );

    paywall.resetData();
    expect(rootOf(shadow).querySelector(".wp__title")?.textContent).toBe(
      "Select your payment method",
    );
    paywall.destroy();
  });
});
