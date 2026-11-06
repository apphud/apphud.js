import { PaymentProviderKind, ProductBundle } from "./apphud";
import { Appearance, Layout } from "@stripe/stripe-js";

export interface PaymentForm {
    show: (
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions,
        subscriptionOptions?: SubscriptionOptions,
        productBundle?: ProductBundle
    ) => Promise<void>
    cancel?: () => void
}

export type LifecycleEvents = { [eventName: string]: LifecycleEventCallback[] }

export interface PaymentFormBuilder {
    show: (
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions,
        bundle?: ProductBundle
    ) => Promise<void>
}

export interface PaymentProviderFormOptions {
    paymentProvider?: PaymentProviderKind;
    successUrl?: string
    failureUrl?: string
    onSuccess?: () => void
    stripeAppearance?: StripeAppearanceOptions
    stripePaymentMethods?: string[]
    stripePaymentFields?: {
        name?: "auto" | "never";
        email?: "auto" | "never";
        phone?: "auto" | "never";
        address?:"auto" | "never" | {
            line1?: "auto" | "never";
            line2?: "auto" | "never";
            city?: "auto" | "never";
            state?: "auto" | "never";
            country?: "auto" | "never";
            postalCode?: "auto" | "never";
        };
        

    }
    stripePaymentWallets?: string[]
    paddleSettings?: PaddleSettingsOptions
    id?: string
    buttonStateSetter?: (state: "loading" | "ready" | "processing" | "error") => void
    applePay?: boolean;
    applePayConfig?: {
        priceMacro?: string;
        productMacro?: string;
        productLabel?: string;
        staticPrice?: {
            currency: string;
            amount: number;
        };
        requestPayerName?: boolean;
        requestPayerEmail?: boolean;
        requestPayerPhone?: boolean;
        onApplePayAvailable?: (isAvailable: boolean) => void;
        onApplePayUnavailable?: () => void;
        merchantIdentifier?: string;
        showApplePayInPaymentElement?: boolean;
    };
    hideTerms?: boolean;
    /**
     * Custom metadata for Stripe objects. Use it to find the user from your own Stripe webhooks.
     *
     * - `customer` is sent to the Stripe Customer.
     * - `subscription` is sent to the Stripe Subscription for a recurring price, or to the Invoice for a one-time price.
     *
     * Each object must be flat. Numbers and booleans are converted to strings.
     * `null`, empty strings, nested objects and arrays are dropped silently.
     * Keys that start with `apphud_` (any case) are reserved: they are dropped with a console warning.
     *
     * Limits: at most 40 keys per object (`amplitude_id`, added by the SDK, counts toward them);
     * keys up to 40 characters, without `[` or `]`; values up to 500 characters
     * (`amplitude_id` up to 100). The SDK drops keys that break these limits, with a console warning.
     * Key names reserved by the server (such as `hash`, `to_hash`, `send`) are not checked
     * by the SDK: the server rejects them.
     *
     * If the server rejects the metadata (422, code `invalid_metadata`), checkout stops: the SDK
     * does not switch to a fallback Stripe account, writes the reason to the console and emits
     * `payment_failure` with `{ error, code: "invalid_metadata", message }`. The pay buttons
     * of that form then ignore clicks.
     *
     * The Stripe Customer is requested when the form is shown and is reused by all forms
     * on the page. Set `customer` before the first `paymentForm()` call: later changes on
     * the same page are not sent. On a later page load the server merges `customer` into
     * the existing Stripe Customer; keys that are no longer passed stay on it, so use the
     * same key names in every session (Stripe allows at most 50 keys per object).
     *
     * @example
     * apphud.paymentForm({
     *   stripeMetadata: {
     *     customer: { userId: "42" },
     *     subscription: { user: "42", type: "self" },
     *   },
     * })
     */
    stripeMetadata?: {
        customer?: StripeMetadataValues;
        subscription?: StripeMetadataValues;
    };
}

/**
 * Flat metadata object. Numbers and booleans are converted to strings, empty values are dropped.
 */
export type StripeMetadataValues = Record<string, string | number | boolean | null | undefined>;

export interface Country {
    name: string
    code: string
}

export interface LifecycleEvent {
    paymentProvider: PaymentProviderKind
    event: any
}

export type LifecycleEventCallback = (event: LifecycleEvent) => void

export interface StripeAppearanceOptions {
    theme?: Appearance['theme'];
    variables?: Appearance['variables'];
    layout?: Layout
    rules?: Appearance['rules']
    disableAnimations?: boolean
    labels?: Appearance['labels']
}

export interface PaddleSettingsOptions {
    variant?: string;
    frameInitialHeight?: number;
    frameStyle?: string;
    displayMode?: string;
    allowedPaymentMethods?: string[];
    theme?: 'light' | 'dark';
    errorCallback?: (error: string) => void;
}

export interface SubscriptionOptions {
    trialDays?: number;
    discountId?: string;
    couponId?: string;
}

export interface StripeSubscriptionOptions {
    trialDays?: number;
    couponId?: string;
}

export interface PaddleSubscriptionOptions {
    discountId?: string;
}

export interface UpsellSubscriptionOptions {
    successUrl?: string;
    onSuccess?: () => void;
    paddleSettings?: PaddleSettingsOptions;
}

export interface IntroductoryOffer {
    stripe_free_trial_days?: string;
    stripe_coupon_id?: string;
    paddle_discount_id?: string;
}
