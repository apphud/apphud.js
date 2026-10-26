export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

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
  cardOpen: boolean;
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
  | "checkout_initiated";

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
  setTheme: (mode: ThemeMode) => void;
  setWallet: (mode: WalletMode) => Promise<void>;
  preview: (status: PreviewStatus) => void;
  format: (value: unknown) => string;
  destroy: () => void;
}

export interface PayResult {
  ok?: boolean;
  cancelled?: boolean;
  error?: string;
  message?: string;
}

export interface CardAdapter {
  mount: () => Promise<void> | void;
  refresh: () => void;
  unmount: () => void;
  focus: () => void;
  detectWallet: () => Promise<boolean>;
  validate: () => string | null;
  payCard: () => Promise<PayResult>;
  payWallet: () => Promise<PayResult>;
}
