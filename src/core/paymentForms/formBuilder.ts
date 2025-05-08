import {
    LifecycleEventName,
    PaymentForm,
    PaymentFormBuilder, LifecycleEventCallback,
    PaymentProvider,
    PaymentProviderFormOptions,
    User, LifecycleEvents,
    ProductBundle,
    StripeSubscriptionOptions,
    PaddleSubscriptionOptions
} from "../../types";
import StripeForm from "./stripeForm";
import PaddleForm from "./paddleForm";
import {log} from "../../utils";

class FormBuilder implements PaymentFormBuilder {
    private events: LifecycleEvents = {}
    private currentForms: Map<string, PaymentForm> = new Map();

    constructor(private provider: PaymentProvider, private user: User) {}

    /**
     * Generate a unique key for a payment form based on its type
     */
    private getFormKey(provider: string, options: PaymentProviderFormOptions): string {
        let formType = "default";
        
        if (provider === "stripe") {
            if (options.applePay === true) {
                formType = "apple_pay";
            }
            // Add additional form types as needed in the future (e.g., Google Pay)
        }
        
        return `${provider}:${formType}`;
    }

    /**
     * Show form on page
     * @param productId - Product ID
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     */
    async show(
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions = {},
        bundle?: ProductBundle
    ): Promise<void> {
        // Clean up only the specific form type being requested
        const formKey = this.getFormKey(this.provider.kind, options);
        this.cleanup(formKey);

        let form: PaymentForm

        const introOffer = bundle?.properties?.introductory_offer;
        
        let subscriptionOptions: StripeSubscriptionOptions | PaddleSubscriptionOptions | undefined;

        switch (this.provider.kind) {
            case "stripe":
                subscriptionOptions = introOffer ? {
                    trialDays: introOffer.stripe_free_trial_days ? 
                        parseInt(introOffer.stripe_free_trial_days) : undefined,
                    couponId: introOffer.stripe_coupon_id
                } : undefined;
                
                form = new StripeForm(this.user, this.provider, this)
                log("Start stripe form for account_id:", this.provider.identifier)
                break
            case "paddle":
                subscriptionOptions = introOffer ? {
                    discountId: introOffer.paddle_discount_id
                } : undefined;
                
                form = new PaddleForm(this.user, this.provider, this)
                log("Start paddle form for account_id:", this.provider.identifier)
                break
            default:
                throw new Error("Unsupported type " + this.provider.kind)
        }

        // Store the current form with its unique key
        this.currentForms.set(formKey, form);

        await form.show(
            productId, 
            paywallId, 
            placementId, 
            options, 
            subscriptionOptions,
            bundle
        )
    }

    /**
     * Clean up specific form event listeners or all if no key is provided
     * @param formKey - Optional key to identify specific form to clean up
     */
    public cleanup(formKey?: string): void {
        if (formKey) {
            // Clean up only the specific form type
            const form = this.currentForms.get(formKey);
            if (form) {
                if (form instanceof StripeForm) {
                    form.cleanupFormListeners();
                }
                this.currentForms.delete(formKey);
            }
        } else {
            // Clean up all forms if no specific key is provided
            this.cleanupAll();
        }
    }
    
    /**
     * Clean up all form event listeners
     */
    public cleanupAll(): void {
        this.currentForms.forEach((form, key) => {
            if (form instanceof StripeForm) {
                form.cleanupFormListeners();
            }
        });
        this.currentForms.clear();
    }

    /**
     * Track event
     * @param eventName - event name
     * @param callback - callback function
     */
    public on(eventName: LifecycleEventName, callback: LifecycleEventCallback): void {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        this.events[eventName].push(callback);
    }

    public emit(eventName: LifecycleEventName, event: any): void {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(event));
        }
    }
}

export default FormBuilder
