import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api";
import { mount, type MountedPage } from "./page";

// Provider scripts never load here: the forms just wait for them.
vi.mock("@stripe/stripe-js-endive/pure", () => ({
  loadStripe: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@paddle/paddle-js", () => ({
  initializePaddle: vi.fn(() => new Promise(() => {})),
}));

const screen = {
  html: `
    <h1 class="title" data-bind="title"></h1>
    <div data-list="plans" role="radiogroup">
      <template><div class="plan" data-press><span data-item-bind="title"></span></div></template>
    </div>
    <div data-checkout></div>
    <div id="wp-error"><span id="wp-error-text"></span></div>
    <button type="button" id="wp-cta"><span id="wp-cta-label" data-plan-bind="cta"></span></button>
  `,
  css: ".wp { color: red; }",
  data: {
    title: { en: "Go premium", ru: "Премиум" },
    plans: [{ product: { bundle_id: "b1" }, title: "Yearly", cta: "Buy" }],
    theme: { mode: "dark" },
    theme_dark: { background: "#05080F" },
  },
};

const payload = (overrides: Record<string, unknown> = {}) => ({
  screen,
  customer: {
    id: "9f1c2b7e-0000-4000-8000-000000000001",
    locale: "ru",
    environment: "production",
  },
  email_required: false,
  environment: "production",
  api_key: "app_key",
  api_host: "https://api.example.com",
  paywall_id: "pw",
  placement_id: "pl",
  variation_id: "var",
  providers: [],
  payment_kinds: { b1: ["stripe"] },
  return_urls: null,
  success_url: null,
  ...overrides,
});

const fetchMock = vi.fn();
let page: MountedPage | null = null;

const host = () => {
  const el = document.createElement("div");
  el.id = "apphud-paywall";
  document.body.append(el);
  return el;
};

const sentEvents = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url,
    headers: init.headers,
    body: JSON.parse(init.body),
  }));

beforeEach(() => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ data: { results: null } }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  page?.destroy();
  page = null;
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("hosted page", () => {
  it("renders the screen in a shadow root in the customer's language", async () => {
    const el = host();
    page = mount(el, JSON.stringify(payload()));
    await page.paywall.ready;
    const root = el.shadowRoot?.getElementById("wp-root");

    expect(root?.querySelector(".title")?.textContent).toBe("Премиум");
    expect(
      el.shadowRoot?.querySelector("style[data-wp-template]")?.textContent,
    ).toBe(".wp { color: red; }");
    // the hosted page keeps env() insets, not the builder's device frame
    expect(el.shadowRoot?.querySelector("style")?.textContent).not.toContain(
      "47px",
    );
    expect(document.documentElement.style.background).toMatch(
      /#05080f|rgb\(5, 8, 15\)/i,
    );
    // the only plan sells through Stripe, and the page has no Stripe
    // provider: the light-DOM frame shows no form and the pay button is hidden
    const projection = root?.querySelector("[data-checkout] > slot");
    expect(projection?.getAttribute("name")).toBe("apphud-checkout");
    const frame = el.querySelector('[slot="apphud-checkout"]');
    expect(frame?.querySelector<HTMLElement>(".aph-providers")?.hidden).toBe(
      true,
    );
    expect(frame?.lastElementChild?.childNodes).toHaveLength(0);
    expect(root?.querySelector<HTMLElement>("#wp-cta")?.style.display).toBe(
      "none",
    );
    expect(document.querySelector("[data-apphud-sandbox]")).toBeNull();
  });

  it("shows the server's texts in the server's language", async () => {
    const el = host();
    page = mount(
      el,
      payload({
        customer: null,
        locale: "es",
        rendered_texts: {
          stripe: { "$plans.0.title": "Anual 9,99 $" },
          none: { "$plans.0.title": "Anual" },
        },
      }),
    );
    await page.paywall.ready;
    const root = el.shadowRoot?.getElementById("wp-root");

    expect(root?.lang).toBe("es");
    // a preview: the plan's first kind of payment_kinds, Stripe
    expect(root?.querySelector(".plan")?.textContent).toBe("Anual 9,99 $");
    // no text in `es` and no key: the default language, as before
    expect(root?.querySelector(".title")?.textContent).toBe("Go premium");
  });

  describe("rendered texts by the kind of the selected plan", () => {
    const kindsScreen = {
      html: `
        <h1 class="title" data-bind="title.text"></h1>
        <div data-list="plans">
          <template><div class="plan"><span data-item-bind="title"></span></div></template>
        </div>
        <div data-checkout></div>
        <button type="button" id="wp-cta"><span id="wp-cta-label" data-plan-bind="cta"></span></button>
      `,
      css: "",
      data: {
        title: { text: { en: "{{ products[0].price }}" } },
        plans: [
          { product: { bundle_id: "b-stripe" }, title: "{{ product.price }}" },
          { product: { bundle_id: "b-paddle" }, title: "{{ product.price }}" },
          { product: { bundle_id: "b-both" }, title: "{{ product.price }}" },
        ],
        plans_settings: { default_plan: 2 },
      },
    };
    const pass = (kind: string) => ({
      "$payment.provider_stripe": `${kind} tab`,
      "$title.text": `${kind} top`,
      "$plans.0.title": `${kind} 0`,
      "$plans.1.title": `${kind} 1`,
      "$plans.2.title": `${kind} 2`,
    });
    const kindsPayload = (overrides: Record<string, unknown> = {}) =>
      payload({
        screen: kindsScreen,
        locale: "en",
        providers: [
          { id: "p-stripe", kind: "stripe", identifier: "acct", token: "pk" },
          { id: "p-paddle", kind: "paddle", identifier: "", token: "tok" },
        ],
        payment_kinds: {
          "b-stripe": ["stripe"],
          "b-paddle": ["paddle"],
          "b-both": ["stripe", "paddle"],
        },
        rendered_texts: {
          stripe: pass("stripe"),
          paddle: pass("paddle"),
          none: pass("none"),
        },
        ...overrides,
      });
    const shadowText = (el: HTMLElement, selector: string) =>
      el.shadowRoot?.querySelector(selector)?.textContent;
    const clickPlan = (el: HTMLElement, index: number) =>
      el.shadowRoot?.querySelectorAll<HTMLElement>(".plan")[index]?.click();

    it("follows the plan in a preview, which has no checkout", async () => {
      const el = host();
      page = mount(el, kindsPayload({ customer: null }));
      await page.paywall.ready;

      // the default plan sells through Paddle only
      expect(shadowText(el, ".title")).toBe("paddle top");
      clickPlan(el, 0);
      expect(shadowText(el, ".title")).toBe("stripe top");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("follows the plan and the buyer's Stripe or Paddle choice", async () => {
      const el = host();
      page = mount(el, kindsPayload());
      await page.paywall.ready;
      await Promise.resolve();
      const tab = (kind: string) =>
        el.querySelector<HTMLButtonElement>(
          `.aph-providers button[data-kind="${kind}"]`,
        );

      expect(shadowText(el, ".title")).toBe("paddle top");
      clickPlan(el, 2);
      expect(shadowText(el, ".title")).toBe("stripe top");
      expect(shadowText(el, ".plan:nth-of-type(3)")).toBe("stripe 2");
      // the tabs drawn for this plan already take the new kind's texts
      expect(tab("stripe")?.textContent).toBe("stripe tab");

      tab("paddle")?.click();
      expect(shadowText(el, ".title")).toBe("paddle top");
      // a plan field follows the choice; a Stripe-only plan stays on Stripe
      const cards = el.shadowRoot?.querySelectorAll(".plan");
      expect(cards?.[2]?.textContent).toBe("paddle 2");
      expect(cards?.[0]?.textContent).toBe("stripe 0");

      // the buyer's Paddle stays for a plan that sells through both
      clickPlan(el, 1);
      clickPlan(el, 2);
      expect(shadowText(el, ".title")).toBe("paddle top");

      clickPlan(el, 0);
      expect(shadowText(el, ".title")).toBe("stripe top");
    });

    it("follows the plan when the template has no place for the form", async () => {
      const el = host();
      page = mount(
        el,
        kindsPayload({
          screen: {
            ...kindsScreen,
            html: kindsScreen.html.replace("<div data-checkout></div>", ""),
          },
        }),
      );
      await page.paywall.ready;

      expect(shadowText(el, ".title")).toBe("paddle top");
      clickPlan(el, 0);
      expect(shadowText(el, ".title")).toBe("stripe top");
    });

    it("skips a malformed language for the next one", async () => {
      const el = host();
      page = mount(el, kindsPayload({ locale: "*" }));
      await page.paywall.ready;
      // the customer's `ru`
      expect(el.shadowRoot?.getElementById("wp-root")?.lang).toBe("ru");
    });
  });

  it("sends paywall_shown once, by customer_id, with the link's ids", async () => {
    page = mount(host(), payload());
    await page.paywall.ready;
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [{ url, headers, body }] = sentEvents();
    expect(url).toBe("https://api.example.com/v1/events");
    expect(headers).toMatchObject({
      Authorization: "Bearer app_key",
      "X-Platform": "web2web",
    });
    expect(body).toEqual({
      customer_id: "9f1c2b7e-0000-4000-8000-000000000001",
      events: [
        {
          name: "paywall_shown",
          properties: {
            paywall_id: "pw",
            placement_id: "pl",
            variation_id: "var",
          },
          user_properties: {},
          timestamp: expect.any(Number),
          insert_id: expect.any(String),
        },
      ],
    });
  });

  it("points the success page at the return URL of the platform", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile",
    );
    const el = host();
    page = mount(
      el,
      payload({
        return_urls: {
          ios: "https://ddd.aphd.cc/_apphud/return",
          android: "apphudtestapp://ddd.aphd.cc/_apphud/return",
        },
      }),
    );
    await page.paywall.ready;
    page.paywall.preview("success");
    const button = el.shadowRoot?.querySelector<HTMLAnchorElement>(
      ".aph-success__button",
    );
    expect(button?.hidden).toBe(false);
    expect(button?.getAttribute("href")).toBe(
      "apphudtestapp://ddd.aphd.cc/_apphud/return?status=success",
    );
  });

  it("asks to go back to the app without return URLs", async () => {
    const el = host();
    page = mount(el, payload());
    await page.paywall.ready;
    page.paywall.preview("success");
    const root = el.shadowRoot;
    expect(
      root?.querySelector<HTMLElement>(".aph-success__button")?.hidden,
    ).toBe(true);
    expect(root?.querySelector<HTMLElement>(".aph-success__hint")?.hidden).toBe(
      false,
    );
  });

  it("shows the sandbox banner outside the paywall", async () => {
    const el = host();
    page = mount(
      el,
      payload({
        environment: "sandbox",
        customer: {
          id: "9f1c2b7e-0000-4000-8000-000000000001",
          locale: "en",
          environment: "sandbox",
        },
      }),
    );
    await page.paywall.ready;
    const banner = document.querySelector<HTMLElement>("[data-apphud-sandbox]");
    expect(banner?.textContent).toBe("Sandbox — test payments");
    expect(banner?.parentElement).toBe(document.body);
    expect(el.shadowRoot?.querySelector("[data-apphud-sandbox]")).toBeNull();

    page.destroy();
    page = null;
    expect(document.querySelector("[data-apphud-sandbox]")).toBeNull();
  });

  it("renders a preview without a customer: no events, browser language", async () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    const el = host();
    page = mount(
      el,
      payload({
        customer: null,
        email_required: null,
        api_key: "k",
        providers: [],
      }),
    );
    await page.paywall.ready;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el.shadowRoot?.querySelector(".title")?.textContent).toBe(
      "Go premium",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a preview the mock payment form, and its pay button starts nothing", async () => {
    const el = host();
    page = mount(el, payload({ customer: null, api_key: "k" }));
    await page.paywall.ready;
    await new Promise((resolve) => setTimeout(resolve, 0));
    const root = el.shadowRoot;

    expect(root?.querySelector("[data-checkout] .aph-mock__fields")).not.toBeNull();
    const cta = root?.querySelector<HTMLButtonElement>("#wp-cta");
    expect(cta?.style.display).toBe("");

    root
      ?.querySelectorAll<HTMLInputElement>(".aph-mock input")
      .forEach((input, index) => {
        input.value = ["4242424242424242", "1230", "123"][index] ?? "";
      });
    cta?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(page.paywall.state.status).toBe("idle");
    expect(page.paywall.state.error).toBeNull();
    expect(root?.getElementById("wp-root")?.classList.contains("is-processing")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides the page's scroll bar and leaves the page as it was on destroy", () => {
    page = mount(host(), payload());
    const style = document.querySelector("style[data-apphud-page]");

    expect(style?.textContent).toContain("scrollbar-width: none");
    expect(style?.textContent).toContain("::-webkit-scrollbar { display: none; }");

    page.destroy();
    page = null;
    expect(document.querySelector("style[data-apphud-page]")).toBeNull();
  });
});

describe("page API client", () => {
  it("retries a 5xx and returns other statuses as they are", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ errors: [] }), { status: 422 }),
      );
    const api = createApiClient({
      apiHost: "https://api.example.com",
      apiKey: "k",
      retryDelay: 1,
    });
    const response = await api.post("/v1/x", { a: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response).toEqual({ status: 422, body: { errors: [] } });
  });

  it("gives up after the retries", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const api = createApiClient({
      apiHost: "https://api.example.com",
      apiKey: "k",
      retries: 1,
      retryDelay: 1,
    });
    await expect(api.post("/v1/x", {})).rejects.toThrow("offline");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
