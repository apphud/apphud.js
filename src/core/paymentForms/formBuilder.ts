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
    private currentForm: PaymentForm | null = null;

    constructor(private provider: PaymentProvider, private user: User) {}

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
        this.cleanup();
        
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
                
                form = new StripeForm(this.user, this.provider.id, this.provider.identifier, this)
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

        this.currentForm = form;

        await form.show(
            productId, 
            paywallId, 
            placementId, 
            options, 
            subscriptionOptions
        )
    }

    /**
     * Clean up any existing form event listeners
     */
    public cleanup(): void {
        if (this.currentForm) {
            if (this.currentForm instanceof StripeForm) {
                this.currentForm.cleanupFormListeners();
            }
            
            this.currentForm = null;
        }
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
