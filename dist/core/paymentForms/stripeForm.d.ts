import { PaymentForm, PaymentProviderFormOptions, User, StripeSubscriptionOptions, ProductBundle } from "../../types";
import FormBuilder from "./formBuilder";
declare class StripeForm implements PaymentForm {
    private user;
    private providerId;
    private accountId;
    private formBuilder;
    private stripe;
    private elements;
    private paymentElement;
    private subscription;
    private submit;
    private submitReadyText;
    private submitProcessingText;
    private submitErrorText;
    private customer;
    private productBundle;
    private currentProductId;
    private currentPaywallId;
    private currentPlacementId;
    private subscriptionOptions?;
    private elementIDs;
    private buttonStateSetter?;
    private formElement;
    private submitHandler;
    private paymentRequest;
    constructor(user: User, providerId: string, accountId: string, formBuilder: FormBuilder);
    private injectStyles;
    private displayError;
    /**
     * Show Stripe form
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     * @param subscriptionOptions - Optional subscription options
     */
    show(productId: string, paywallId: string | undefined, placementId: string | undefined, options?: PaymentProviderFormOptions, subscriptionOptions?: StripeSubscriptionOptions, productBundle?: ProductBundle): Promise<void>;
    private setButtonState;
    /**
     * Create subscription
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param customerId - customer id
     * @param paymentMethodId - payment method id
     * @private
     */
    private createSubscription;
    private createCustomer;
    /**
     * Initialize Apple Pay
     * @private
     * @param options - Payment form options
     */
    private initializeApplePay;
    /**
     * Initialize Stripe elements
     * @private
     * @param options - Payment form options including Stripe UI customization
     */
    private initStripe;
    /**
     * Find form element on page and set handler for submit action
     * @param options - success url / failure url
     * @private
     */
    private setupForm;
    /**
     * Handle successful payment
     * @param options - success url / failure url
     * @private
     */
    private handleSuccessfulPayment;
    /**
     * Clean up form event listeners to prevent duplicates
     */
    cleanupFormListeners(): void;
    private ensureHttpsUrl;
}
export default StripeForm;
//# sourceMappingURL=stripeForm.d.ts.map