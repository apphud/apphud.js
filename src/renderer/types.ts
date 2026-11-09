export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

// Template-specific schema data (future V5 `data`): texts, icons, theme tokens.
export type WebPaywallData = JsonObject;

// Value of a plan's `product` field (backend schema type `web_product`): the
// paywall's product bundle the plan sells. Price and terms come from its item.
export interface PlanProduct {
  bundle_id: string;
}

// Same shape as the backend `Screen::Schema` (one entry per data slug).
export interface WebPaywallSchemaField {
  id: string;
  type: string;
  label?: string;
  info?: string;
  default?: JsonValue;
  options?: { name: string; value: string }[];
}

export interface WebPaywallSchemaItem {
  name: string;
  slug: string;
  collection?: boolean;
  fields: WebPaywallSchemaField[];
}

export interface WebPaywallTemplate {
  name: string;
  title: string;
  html: string;
  css: string;
  schema: WebPaywallSchemaItem[];
  data: WebPaywallData;
}

export type ThemeMode = "dark" | "light";
// Mock checkout only: the builder previews the page with or without a wallet.
export type WalletMode = "auto" | "apple_pay" | "none";
export type PaywallStatus = "idle" | "processing" | "success";
export type PreviewStatus = PaywallStatus | "error";

export interface WebPaywallState {
  template: string | null;
  locale: string;
  theme: string | null;
  wallet: WalletMode;
  plan: number | null;
  walletAvailable: boolean;
  status: PaywallStatus;
  error: string | null;
}

export interface WebPaywallDraft {
  data: WebPaywallData;
}

export type WebPaywallEventName =
  | "shown"
  | "template"
  | "plan_selected"
  | "wallet"
  | "checkout_initiated"
  | "payment_error";

export type WebPaywallEventPayload = Record<string, unknown>;

export interface CreateWebPaywallOptions {
  templates: WebPaywallTemplate[];
  template?: string;
  locale?: string;
  // Fallback for texts missing in `locale`.
  defaultLocale?: string;
  theme?: ThemeMode | null;
  wallet?: WalletMode;
  userId?: string | null;
  // Mounted into the template's [data-checkout] slot. Without it the mock
  // checkout runs: the builder never charges.
  checkout?: WebPaywallCheckout;
  // Mock checkout only. true (default): its pay buttons play a payment out
  // (processing, then success or a decline). false: they do nothing, for the
  // hosted page's preview, where the form shows and no payment starts.
  simulatePayments?: boolean;
  // Return button of the success page, already with its query. null: no
  // return link, the page asks to go back to the app. Omitted (builder
  // preview): the button shows without a link.
  returnUrl?: string | null;
  // The hosted page: the device's own safe area instead of the builder's
  // device frame insets.
  hosted?: boolean;
  // Texts the server rendered (Liquid), by key: `$title.text`, `$plans.0.price`.
  // A key here wins over its data path; see `WebPaywall.setTexts`.
  texts?: Record<string, string> | null;
  // Every plan selection, the first one and each redraw included. `paywall`
  // works already during the first render, inside createWebPaywall.
  onPlan?: (
    product: PlanProduct | null,
    paywall: Pick<WebPaywall, "setTexts">,
  ) => void;
  // Per-template drafts; the engine writes into it on template switch and destroy.
  saved?: Record<string, WebPaywallDraft>;
  onEvent?: (
    event: WebPaywallEventName,
    payload: WebPaywallEventPayload,
  ) => void;
  onChange?: () => void;
}

export interface WebPaywall {
  readonly state: WebPaywallState;
  readonly ready: Promise<void>;
  readonly templates: { name: string; title: string }[];
  readonly defaults: WebPaywallData;
  readonly data: WebPaywallData;
  mount: (name?: string, nextData?: WebPaywallData) => Promise<WebPaywallData>;
  setData: (next: WebPaywallData) => void;
  updateData: (recipe: (draft: WebPaywallData) => void) => void;
  resetData: () => WebPaywallData;
  setPlan: (index: number) => void;
  setLocale: (locale: string) => void;
  // Texts the server rendered, by key (`$title.text`, `$plans.0.price`): each
  // shows instead of its data path; a path without a key renders as before.
  // `data` keeps the Liquid. With `locale`, they show only in that language.
  // null drops them, and so do a switch to another template and resetData.
  // An empty text shows empty, except where the paywall has a text of its own
  // to fall back to: success page, checkout labels, error messages.
  // The same texts again redraw nothing.
  setTexts: (texts: Record<string, string> | null, locale?: string) => void;
  setTheme: (mode: ThemeMode) => void;
  setWallet: (mode: WalletMode) => Promise<void>;
  preview: (status: PreviewStatus) => void;
  format: (value: unknown) => string;
  destroy: () => void;
}

export interface PayResult {
  // Paid and synced: the renderer shows the success page.
  ok?: boolean;
  // Closed by the user: no error.
  cancelled?: boolean;
  // Key in the template's `errors` texts (`declined`, `incomplete`, `generic`).
  error?: string;
  // Shown instead of the `errors` text, e.g. the provider's own message.
  message?: string;
  // Only for the `payment_error` event: the provider's text the buyer does not see.
  detail?: string;
  // For the `payment_error` event.
  provider?: string;
  code?: string;
}

// What the renderer gives the checkout mounted into [data-checkout].
export interface CheckoutContext {
  readonly doc: Document;
  locale: () => string;
  // Localized text by data path, e.g. `payment.processing`.
  text: (path: string) => string;
  // Runs a payment the user has started: processing until `run` settles,
  // `checkout_initiated` first, then the success page or the error.
  pay: (method: string, run: () => Promise<PayResult>) => Promise<void>;
  // Shows an error that is not a payment attempt, e.g. incomplete fields.
  fail: (result: PayResult) => void;
  // Processing while `task` runs, with no events: the checkout prepares itself
  // (e.g. creates the provider's transaction) before the user can pay.
  wait: <T>(task: () => Promise<T>) => Promise<T>;
  clearError: () => void;
  // Shows or hides the template's pay button (#wp-cta): Paddle has its own.
  setSubmit: (visible: boolean) => void;
  busy: () => boolean;
}

export interface WebPaywallCheckout {
  mount: (slot: HTMLElement, ctx: CheckoutContext) => Promise<void> | void;
  // The selected plan; null when it has no bundle.
  setPlan: (product: PlanProduct | null) => void;
  // The template's pay button (#wp-cta) was pressed.
  submit?: () => void;
  // Locale, theme, data or wallet mode changed.
  refresh?: () => Promise<void> | void;
  unmount: () => void;
}
