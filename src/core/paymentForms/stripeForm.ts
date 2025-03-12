import {documentReady, log, logError} from "../../utils"
import api from '../api'
import {
    DeepLinkURL,
    SelectedProductDuration,
    PaymentProviderKey
} from "../config/constants"
import {CustomerSetup, PaymentForm, PaymentProviderFormOptions, Subscription, User, StripeSubscriptionOptions} from "../../types"
import {
    loadStripe,
    Stripe,
    StripeElements,
    StripeElementsOptions,
    StripePaymentElement,
    StripePaymentElementChangeEvent
} from "@stripe/stripe-js";
import {setCookie} from "../../cookies";
import {config} from "../config/config";
import FormBuilder from "./formBuilder";

const ELEMENT_IDS = {
    new: {
        form: "apphud-stripe-payment-form",
        payment: "stripe-payment-element",
        submit: "stripe-submit",
        error: "stripe-error-message"
    },
    old: {
        form: "apphud-payment-form",
        payment: "payment-element",
        submit: "submit",
        error: "error-message"
    }
}

class StripeForm implements PaymentForm {
    private stripe: Stripe | null = null
    private elements: StripeElements | undefined = undefined
    private paymentElement: StripePaymentElement | null = null
    private subscription: Subscription | null = null
    private submit: HTMLButtonElement | null = null
    private submitReadyText = "Subscribe"
    private submitProcessingText = "Please wait..."
    private submitErrorText = "Error occurred"
    private customer: CustomerSetup | null = null;
    private currentProductId: string | null = null;
    private currentPaywallId: string | undefined;
    private currentPlacementId: string | undefined;
    private subscriptionOptions?: StripeSubscriptionOptions;
    private elementIDs: { [key: string]: string } = ELEMENT_IDS.old;
    private buttonStateSetter?: (state: "loading" | "ready" | "processing" | "error") => void | undefined;

    constructor(private user: User, private providerId: string, private accountId: string, private formBuilder: FormBuilder) {
        documentReady(async () => {
            this.injectStyles();
            let key = config.stripeLiveKey

            if (config.debug) {
                key = config.stripeTestKey
            }

            this.stripe = await loadStripe(key, {stripeAccount: this.accountId})
        })
    }

    private injectStyles(): void {
        const styleId = 'apphud-stripe-styles';
        if (document.getElementById(styleId)) {
            return;
        }

        const styles = `
            .stripe-element-container {
                padding: 10px 0;
            }

            #${ELEMENT_IDS.new.payment},
            #${ELEMENT_IDS.old.payment} {
                width: 100%;
            }
        `;

        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    private displayError(message: string): void {
        const errorElement = document.querySelector(`#${this.elementIDs.error}`)
        if (errorElement) {
            errorElement.textContent = message
        }
    }

    /**
     * Show Stripe form
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     * @param subscriptionOptions - Optional subscription options
     */
    public async show(
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions = {},
        subscriptionOptions?: StripeSubscriptionOptions
    ): Promise<void> {
        this.currentProductId = productId;
        this.currentPaywallId = paywallId;
        this.currentPlacementId = placementId;
        this.subscriptionOptions = subscriptionOptions;
        this.formBuilder.emit("payment_form_initialized", { paymentProvider: "stripe", event: { selector: "#apphud-stripe-payment-form" } })
        this.buttonStateSetter = options.buttonStateSetter

        // Detect which form type is present
        if (options.id) {
            this.elementIDs = {}

            for (const key in ELEMENT_IDS.new) {
                this.elementIDs[key] = `${options.id}-${ELEMENT_IDS.new[key as keyof typeof ELEMENT_IDS.new]}`
            }
        } else if (document.getElementById(ELEMENT_IDS.new.form)) {
            this.elementIDs = ELEMENT_IDS.new
        }
        
        const submitButton = document.querySelector(`#${this.elementIDs.submit}`)

        if (!submitButton) {
            logError(`Submit button is required. Add <button id="${this.elementIDs.submit}">Pay</button>`)
            return
        }

        this.submit = submitButton as HTMLButtonElement
        this.setButtonState("loading")

        if (this.submit.innerText !== "") {
            this.submitReadyText = this.submit.innerText
        }

        // Create customer
        await this.createCustomer(options);
        
        // Initialize Stripe elements
        this.initStripe(options);
        
        // Setup form submission handler
        this.setupForm(options);
    }

    private setButtonState(state: "loading" | "ready" | "processing" | "error"): void {
        if (!this.submit) {
            logError("Submit button not found. Failed to set state:", state, true)
            return
        }

        if (this.buttonStateSetter && state !== "error") {
            this.buttonStateSetter(state)
            return
        }

        switch (state) {
            case "loading":
                this.submit.setAttribute("disabled", "disabled")
                break
            case "ready":
                this.submit.removeAttribute("disabled")
                this.submit.innerText = this.submitReadyText
                break
            case "processing":
                this.submit.setAttribute("disabled", "disabled")
                this.submit.innerText = this.submitProcessingText
                break
            case "error":
                this.submit.setAttribute("disabled", "disabled")
                this.submit.innerText = this.submitErrorText
                break
        }
    }

    /**
     * Create subscription
     * @param productId - stripe price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param customerId - customer id
     * @param paymentMethodId - payment method id
     * @private
     */
    private async createSubscription(
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        customerId: string, 
        paymentMethodId: string
    ): Promise<void> {
        const payload = {
            product_id: productId,
            paywall_id: paywallId,
            placement_id: placementId,
            user_id: this.user.id,
            customer_id: customerId,
            payment_method_id: paymentMethodId,
            ...(this.subscriptionOptions?.trialDays && { trial_period_days: this.subscriptionOptions.trialDays }),
            ...(this.subscriptionOptions?.couponId && { discount_id: this.subscriptionOptions.couponId })
        };

        try {
            log('Creating subscription for product:', productId);
            this.subscription = await api.createSubscription(this.providerId, payload);
    
            if (!this.subscription) {
                logError('Failed to create subscription for product:', productId);
                return;
            }
    
            log('Subscription created', this.subscription);
        } catch (error) {
            logError('Network error creating subscription:', error);
            throw new Error('Failed to create subscription due to network error');
        }
    }    

    private async createCustomer(options: PaymentProviderFormOptions): Promise<void> {
        const defaultPaymentMethods = ['card', 'sepa_debit', 'bancontact'];
        
        const paymentMethods = options.stripePaymentMethods?.length 
            ? options.stripePaymentMethods 
            : defaultPaymentMethods;

        log("Creating customer for user", this.user.id);
        this.customer = await api.createCustomer(this.providerId, {
            user_id: this.user.id,
            payment_methods: paymentMethods,
            debug: config.debug
        });

        if (!this.customer) {
            logError('Failed to create customer for user', this.user.id);
            return;
        }

        log('Customer created', this.customer);
    }
    

    /**
     * Initialize Stripe elements
     * @private
     * @param options - Payment form options including Stripe UI customization
     */
    private initStripe(options?: PaymentProviderFormOptions): void {
        if (!this.stripe) {
            logError('Failed to initialize Stripe', true)
            this.displayError('Failed to initialize payment form. Please try again.')
            this.setButtonState("error")
            return
        }

        if (!this.customer) {
            logError('Failed to initialize Stripe, customer not initialized', true)
            this.displayError('Failed to initialize payment form. Please try again.')
            this.setButtonState("error")
            return
        }

        const stripeAppearance = options?.stripeAppearance && {
            theme: options.stripeAppearance.theme,
            variables: options.stripeAppearance.variables,
            rules: options.stripeAppearance.rules,
            disableAnimations: options.stripeAppearance.disableAnimations,
            labels: options.stripeAppearance.labels,
        }

        // Define elements options
        const elementsOptions: StripeElementsOptions = {
            clientSecret: this.customer.client_secret,
            appearance: stripeAppearance,
            loader: "always"
        }

        this.elements = this.stripe.elements(elementsOptions)
        
        // Create and mount the Payment Element
        const paymentElement = this.elements.create('payment', {
            layout: options?.stripeAppearance?.layout
        })
        
        const paymentElementContainer = document.getElementById(this.elementIDs.payment);
        if (paymentElementContainer) {
            paymentElementContainer.innerHTML = '<div class="stripe-element-container"></div>';
            paymentElement.mount(`#${this.elementIDs.payment} .stripe-element-container`);
        }

        this.paymentElement = paymentElement;

        // Event listener for ready state
        paymentElement.on('ready', (e) => {
            this.setButtonState("ready")
            this.formBuilder.emit("payment_form_ready", { paymentProvider: "stripe", event: e })
        });

        // Event listener for change events
        paymentElement.on('change', (event: StripePaymentElementChangeEvent) => {
            const displayError = document.querySelector(`#${this.elementIDs.error}`)
            if (displayError) {
                // Clear any previous error messages when the form is valid
                if (event.complete) {
                    displayError.textContent = "";
                }
            }
        });

        // Add a separate error event listener for loader errors
        paymentElement.on('loaderror', (event) => {
            if (event.error) {
                logError("Failed to load payment form", event.error, true)
                this.displayError("Failed to load payment form");
                this.setButtonState("error")
            }
        });
    }

    /**
     * Find form element on page and set handler for submit action
     * @param options - success url / failure url
     * @private
     */
    private async setupForm(options?: PaymentProviderFormOptions): Promise<void> {
        const form = document.querySelector(`#${this.elementIDs.form}`)

        if (!form) {
            logError("Payment form: no form provided", true)
            return
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault()
            this.setButtonState("processing")

            if (!this.stripe) {
                logError("Stripe not initialized", true)
                this.displayError('Failed to initialize payment form. Please try again.')
                return
            }

            if (!this.elements) {
                logError("Elements not initialized", true)
                this.displayError('Failed to initialize payment form. Please try again.')
                return
            }

            // Step 1: Confirm SetupIntent
            const { error: setupError, setupIntent } = await this.stripe.confirmSetup({
                elements: this.elements,
                confirmParams: {
                    return_url: this.ensureHttpsUrl(options?.successUrl || window.location.href),
                },
                redirect: 'if_required'
            });

            if (setupError) {
                logError("Failed to confirm setup", setupError, true)
                this.setButtonState("ready")
                this.displayError("Failed to process payment. Please try again.")
                
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "stripe",
                    event: { error: setupError }
                })
                return
            }

            // Step 2: Create subscription using the payment method
            try {
                const paymentMethodId = setupIntent.payment_method as string;
                await this.createSubscription(
                    this.currentProductId!, 
                    this.currentPaywallId, 
                    this.currentPlacementId, 
                    this.customer!.id, 
                    paymentMethodId
                );
            } catch (error) {
                logError("Subscription creation failed:", error)
                this.setButtonState("error")
                this.displayError("Failed to create subscription. Please try again.")

                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "stripe",
                    event: { error }
                })
                return
            }

            if (!this.subscription) {
                logError("Failed to create subscription")
                this.setButtonState("error")
                this.displayError("Failed to create subscription. Please try again.")
                
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "stripe",
                    event: { error: new Error("Failed to create subscription") }
                })
                return
            }

            // Step 3: Confirm payment if needed (subscription returned client_secret)
            if (this.subscription.client_secret) {
                const { error: confirmError } = await this.stripe.confirmCardPayment(
                    this.subscription.client_secret
                );
                
                if (confirmError) {
                    logError("Failed to confirm card payment", confirmError, true)
                    this.setButtonState("error")
                    this.displayError("Failed to confirm payment. Please try again.")
                    
                    this.formBuilder.emit("payment_failure", {
                        paymentProvider: "stripe",
                        event: { error: confirmError }
                    })
                    return
                }
            }

            // Handle successful subscription
            const deepLink = this.subscription.deep_link;
            if (deepLink) {
                setCookie(DeepLinkURL, deepLink, SelectedProductDuration);
            }
                
            setCookie(PaymentProviderKey, "stripe", SelectedProductDuration);
                
            setTimeout(() => {
                if (options?.onSuccess) {
                    options.onSuccess()
                } else if (options?.successUrl && options.successUrl !== 'undefined') {
                    document.location.href = options.successUrl;
                } else {
                    document.location.href = config.baseSuccessURL + '/' + deepLink;
                }
            }, config.redirectDelay);
        })
    }

    // Add this helper method to ensure the URL has a scheme
    private ensureHttpsUrl(url: string): string {
        if (!/^https?:\/\//i.test(url)) {
            return `https://${url}`;
        }
        return url;
    }
}

export default StripeForm