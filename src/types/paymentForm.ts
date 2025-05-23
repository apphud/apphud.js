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
        showApplePayInPaymentElement?: boolean;
    };
    hideTerms?: boolean;
}

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
