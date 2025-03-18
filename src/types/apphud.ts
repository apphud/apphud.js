import {
    LifecycleEventCallback,
    PaymentProviderFormOptions
} from "./paymentForm";

export type ApphudHash = { [key: string]: any }

export type ApphudFunc = (...args: any[]) => void

export interface Message {
    message: string
}

export interface SuccessMessage {
    success: boolean
}

export interface User {
    id: string
    user_id: string
    email: string | undefined | null
    locale?: string
    is_sandbox?: boolean
    paywalls?: Paywall[]
    placements?: Placement[]
    prices?: Price[]
    payment_providers?: PaymentProvider[]
    currency: Currency
}

export type PaymentProviderKind = "stripe" | "paddle"
export type AttributionData = Record<string, string | Record<string, null | string | string[]>>
export interface PaymentProvider {
    id: string
    identifier: string
    kind: PaymentProviderKind
    name: string,
    token?: string
}

export interface Placement {
    id: string
    identifier: string
    name: string
    paywalls: Paywall[]
}

export interface Price {
    price: number
    product: Product
    currency: Currency
    readProperty: (key: string) => string | null
}

export interface Currency {
    code: string
    country_code: string
}

export interface Product {
    id: string
    product_id: string
    base_plan_id: string
    name: string
    payment_provider_id: string
    store: PaymentProviderKind
    created_automatically?: boolean
    db_id?: string
    store_id?: string
}

export interface ProductBundle {
    id: string
    name: string
    products: Product[]
    properties?: {
        [language: string]: {
            [key: string]: string
        }
    }
}

export interface Paywall {
    id: string
    default: boolean
    experiment_id: string | null
    identifier: string
    json: string
    items_v2: ProductBundle[]
}

export interface Apphud {
    /**
     * Initializes the Apphud SDK with the provided configuration options.
     * @param {Config} options - The configuration options for initialization.
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     */
    init: (options: Config) => Promise<void>;

    /**
     * Tracks an event with the specified name and properties.
     * @param {string} name - The name of the event to track.
     * @param {ApphudHash} properties - Event-specific properties.
     * @param {ApphudHash} userProperties - User-specific properties.
     * @returns {boolean} True if tracking was successful, otherwise false.
     */
    track: (name: string, properties: ApphudHash, userProperties: ApphudHash) => boolean;

    /**
     * Sets the email address for the current user.
     * @param {string} email - The user's email address.
     * @returns {Promise<void>} A promise that resolves when the email is set.
     */
    setEmail: (email: string) => Promise<void>;

    /**
     * Displays a payment form with the provided options.
     * @param {PaymentProviderFormOptions} options - Options for the payment form.
     */
    paymentForm: (options: PaymentProviderFormOptions) => void;

    /**
     * Performs operations on app-defined variables.
     */
    operateVariables: () => void;

    /**
     * Retrieves the current user ID.
     * @returns {string | undefined} The user ID, or undefined if not available.
     */
    getUserID: () => string | undefined;

    /**
     * Resets the Apphud SDK state.
     * @returns {boolean} True if the reset was successful, otherwise false.
     */
    reset: () => boolean;

    /**
     * Gets the current user details.
     * @type {User | undefined}
     */
    user: User | undefined;

    /**
     * Retrieves the current product.
     * @returns {Product | null} The current product, or null if none is selected.
     */
    currentProduct: () => Product | null;

    /**
     * Retrieves the current placement.
     * @returns {Placement | null} The current placement, or null if none is selected.
     */
    currentPlacement: () => Placement | null;

    /**
     * Retrieves the current paywall.
     * @returns {Paywall | null} The current paywall, or null if none is selected.
     */
    currentPaywall: () => Paywall | null;

    /**
     * Retrieves the current product bundle.
     * @returns {ProductBundle | null} The current product bundle, or null if none is selected.
     */
    currentBundle: () => ProductBundle | null;

    /**
     * A list of available placements.
     * @type {Placement[]}
     */
    placements: Placement[];

    /**
     * Map of current payment providers by their kind.
     * @type {Map<PaymentProviderKind, PaymentProvider>}
     */
    currentPaymentProviders: Map<PaymentProviderKind, PaymentProvider>;

    /**
     * Selects a product for a given placement index.
     * @param {string} placementIndex - The index of the placement.
     * @param {number} productIndex - The index of the product bundle within the placement.
     */
    selectPlacementProduct: (placementIndex: string, productIndex: number) => void;

    /**
     * Sets attribution data for the user.
     * @param {string} queryParams - URL query parameters
     * @param {AttributionData} data - Attribution data to be set.
     */
    setAttribution: (queryParams: string, data: AttributionData) => void;

    /**
     * Sets the user's preferred language.
     * @param {string} language - The language to set.
     */
    setLanguage: (language: string) => void;

    /**
     * Retrieves the current deep link for the user.
     * @returns {string | null} The deep link, or null if not available.
     */
    getDeepLink: () => string | null;

    /**
     * Subscribes to an event with the given name.
     * @param {LifecycleEventName} eventName - The name of the event.
     * @param {LifecycleEventCallback} callback - The callback to execute when the event occurs.
     */
    on: (eventName: LifecycleEventName, callback: LifecycleEventCallback) => void;
}

export type Config = {
    apiKey: string
    baseURL: string
    baseSuccessURL: string
    redirectDelay: number
    debug: boolean
    language: string
    websiteVersion: string
    httpRetriesCount: number
    httpRetryDelay: number
    headers: HeadersInit
    stripeLiveKey: string
    stripeTestKey: string
}

export interface EventData {
    id?: string
    name: string
    properties: ApphudHash | undefined | null
    user_properties?: ApphudHash | undefined | null
    insert_id?: string | null | undefined
    timestamp?: number
    device_id?: string | null
    user_id?: string | null
}

export interface Events {
    events?: EventData[]
    device_id?: string | null
    user_id?: string | null
    events_json?: string
}

export interface CustomerData {
    user_id?: string
    device_id?: string
    locale: string
    email?: string | undefined | null
    time_zone: string
    is_sandbox: boolean
    is_debug: boolean
    currency_code: string | undefined
    country_code: string
    country_iso_code: string
    device_type?: string
    device_family?: string
    platform: string
    os_version: string
    app_version: string
    start_app_version: string
    referrer?: string | null
    need_paywalls: boolean
    need_placements: boolean
    page_url: string
    user_agent: string
}
export type LifecycleEventName = "payment_form_initialized" | "ready" | "payment_form_ready" | "payment_success" | "payment_failure" | "product_changed" | "payment_provider_changed" | "upsell_initiated" | "upsell_success" | "upsell_failure"
