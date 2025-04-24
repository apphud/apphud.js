import {documentReady, log, logError, getAmplitudeId, getValueByPath} from "../../utils"
import api from '../api'
import {
    DeepLinkURL,
    SelectedProductDuration,
    PaymentProviderKey
} from "../config/constants"
import {CustomerSetup, PaymentForm, PaymentProviderFormOptions, Subscription, User, StripeSubscriptionOptions, ProductBundle} from "../../types"
import {
    loadStripe,
    Stripe,
    StripeElements,
    StripeElementsOptions,
    StripePaymentElement,
    StripePaymentElementChangeEvent,
    StripePaymentElementOptions,
    PaymentRequest as StripePaymentRequest
} from "@stripe/stripe-js";
import {setCookie} from "../../cookies";
import {config} from "../config/config";
import FormBuilder from "./formBuilder";

const ELEMENT_IDS = {
    new: {
        form: "apphud-stripe-payment-form",
        payment: "stripe-payment-element",
        submit: "stripe-submit",
        error: "stripe-error-message",
        applePayButton: "apphud-apple-pay-button"
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
    private productBundle: ProductBundle | null = null;
    private currentProductId: string | null = null;
    private currentPaywallId: string | undefined;
    private currentPlacementId: string | undefined;
    private subscriptionOptions?: StripeSubscriptionOptions;
    private elementIDs: { [key: string]: string } = ELEMENT_IDS.old;
    private buttonStateSetter?: (state: "loading" | "ready" | "processing" | "error") => void | undefined;
    private formElement: HTMLElement | null = null;
    private submitHandler: ((event: Event) => Promise<void>) | null = null;
    private paymentRequest: StripePaymentRequest | null = null;

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
            
            #${ELEMENT_IDS.new.applePayButton} {
                background-color: black;
                color: white;
                border-radius: 5px;
                padding: 10px;
                height: 40px;
                margin-bottom: 15px;
                display: none;
                width: 100%;
                cursor: pointer;
                border: none;
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
        subscriptionOptions?: StripeSubscriptionOptions,
        productBundle?: ProductBundle
    ): Promise<void> {
        this.productBundle = productBundle || null;
        this.currentProductId = productId;
        this.currentPaywallId = paywallId;
        this.currentPlacementId = placementId;
        this.subscriptionOptions = subscriptionOptions;
        this.formBuilder.emit("payment_form_initialized", { paymentProvider: "stripe", event: { selector: "#apphud-stripe-payment-form" } })
        this.buttonStateSetter = options.buttonStateSetter

        log("🍎 Apple Pay - product bundle from show:", productBundle);

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
        
        // Initialize Apple Pay
        this.initializeApplePay(options);
        
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
        const amplitudeId = getAmplitudeId();
        
        const payload = {
            product_id: productId,
            paywall_id: paywallId,
            placement_id: placementId,
            user_id: this.user.id,
            customer_id: customerId,
            payment_method_id: paymentMethodId,
            ...(this.subscriptionOptions?.trialDays && { trial_period_days: this.subscriptionOptions.trialDays }),
            ...(this.subscriptionOptions?.couponId && { discount_id: this.subscriptionOptions.couponId }),
            metadata: {
                ...(amplitudeId && { amplitude_id: amplitudeId })
            },
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
        const amplitudeId = getAmplitudeId();
        this.customer = await api.createCustomer(this.providerId, {
            user_id: this.user.id,
            payment_methods: paymentMethods,
            metadata: {
                ...(amplitudeId && { amplitude_id: amplitudeId })
            },
        });

        if (!this.customer) {
            logError('Failed to create customer for user', this.user.id);
            return;
        }

        log('Customer created', this.customer);
    }
    
    /**
     * Initialize Apple Pay
     * @private
     * @param options - Payment form options
     */
    private initializeApplePay(options?: PaymentProviderFormOptions): void {
        if (!this.stripe) {
            logError('🍎 Apple Pay [ERROR] - Failed to initialize Apple Pay: Stripe not initialized');
            return;
        }

        if (!this.productBundle) {
            logError('🍎 Apple Pay [ERROR] - Failed to initialize Apple Pay: Product bundle is missing');
            return;
        }

        log('🍎 Apple Pay [1] - Starting initialization with product bundle:', this.productBundle);
        
        // Get product price info from bundle
        let amount = 0;
        let currency = 'usd';
        let productName = 'Subscription';
        
        // Extract price from bundle properties
        if (this.productBundle.properties) {
            const priceString = getValueByPath(this.productBundle.properties, 'new-price');
            log('🍎 Apple Pay [2] - Price string from bundle:', priceString);
            
            if (priceString) {
                // Extract numeric value from price string
                const numericValue = parseFloat(priceString.replace(/[^0-9.]/g, ''));
                if (!isNaN(numericValue)) {
                    // Convert to cents for Stripe
                    amount = Math.round(numericValue * 100);
                    log('🍎 Apple Pay [3] - Converted price to cents:', amount);
                } else {
                    logError('🍎 Apple Pay [ERROR] - Failed to parse price from:', priceString);
                    return;
                }
                
                // Try to extract currency
                const currencyMatch = priceString.match(/[£€$₹¥₽₩₴₿]/);
                if (currencyMatch) {
                    const currencySymbol = currencyMatch[0];
                    // Map common currency symbols to codes
                    const currencyMap: {[key: string]: string} = {
                        '$': 'usd',
                        '€': 'eur',
                        '£': 'gbp',
                        '¥': 'jpy',
                        '₹': 'inr'
                    };
                    currency = currencyMap[currencySymbol] || 'usd';
                    log('🍎 Apple Pay [4] - Detected currency:', currency);
                }
            } else {
                logError('🍎 Apple Pay [ERROR] - No price found in bundle properties');
                return;
            }
        } else {
            logError('🍎 Apple Pay [ERROR] - Bundle has no properties');
            return;
        }
        
        // Get product name
        if (this.productBundle.name) {
            productName = this.productBundle.name;
            log('🍎 Apple Pay [5] - Using product name:', productName);
        } else {
            log('🍎 Apple Pay [5] - Using default product name:', productName);
        }
        
        log('🍎 Apple Pay [6] - Creating payment request with:', { currency, amount, productName });
        
        // Create payment request for Apple Pay
        this.paymentRequest = this.stripe.paymentRequest({
            country: 'US',
            currency: currency,
            total: {
                label: productName,
                amount: amount,
            },
            requestPayerName: true,
            requestPayerEmail: true,
        });

        log("🍎 Apple Pay - payment request:", this.paymentRequest);

        // Check if Apple Pay is available
        this.paymentRequest.canMakePayment().then((result: any) => {
            log('🍎 Apple Pay [7] - Availability check result:', result);
            
            if (result && result.applePay) {
                log('🍎 Apple Pay [8] - Available, looking for button element with ID:', this.elementIDs.applePayButton);
                // Show Apple Pay button if available
                const applePayButton = document.getElementById(this.elementIDs.applePayButton);
                if (applePayButton) {
                    log('🍎 Apple Pay [9] - Button element found, displaying it');
                    applePayButton.style.display = 'block';
                    
                    // Handle Apple Pay button click
                    applePayButton.addEventListener('click', () => {
                        log('🍎 Apple Pay [10] - Button clicked, showing payment sheet');
                        this.paymentRequest?.show();
                    });
                } else {
                    logError('🍎 Apple Pay [ERROR] - Button element not found with ID:', this.elementIDs.applePayButton);
                }
            } else {
                log('🍎 Apple Pay [11] - Not available on this device/browser');
            }
        }).catch(error => {
            logError('🍎 Apple Pay [ERROR] - Error checking Apple Pay availability:', error);
        });
        
        // Handle payment method selection with Apple Pay
        this.paymentRequest.on('paymentmethod', async (event: any) => {
            log('🍎 Apple Pay [12] - Payment method received:', event.paymentMethod.id);
            
            try {
                if (!this.customer) {
                    const error = new Error('Customer not initialized');
                    logError('🍎 Apple Pay [ERROR] - Customer not initialized');
                    throw error;
                }
                
                // Create subscription with the payment method from Apple Pay
                log('🍎 Apple Pay [13] - Creating subscription');
                
                await this.createSubscription(
                    this.currentProductId!,
                    this.currentPaywallId,
                    this.currentPlacementId,
                    this.customer.id,
                    event.paymentMethod.id
                );
                
                log('🍎 Apple Pay [14] - Subscription created');
                
                if (!this.subscription) {
                    const error = new Error('Failed to create subscription');
                    logError('🍎 Apple Pay [ERROR] - Failed to create subscription');
                    event.complete('fail');
                    this.displayError('Failed to create subscription');
                    return;
                }
                
                // Handle 3DS if needed
                if (this.subscription.client_secret) {
                    log('🍎 Apple Pay [15] - 3DS verification needed');
                    
                    const { error: confirmError } = await this.stripe!.confirmCardPayment(
                        this.subscription.client_secret,
                        { payment_method: event.paymentMethod.id },
                        { handleActions: false }
                    );
                    
                    if (confirmError) {
                        logError('🍎 Apple Pay [ERROR] - 3DS verification failed:', confirmError);
                        event.complete('fail');
                        this.displayError(confirmError.message || 'Payment confirmation failed');
                        
                        this.formBuilder.emit("payment_failure", {
                            paymentProvider: "stripe",
                            event: { error: confirmError }
                        });
                        return;
                    }
                    
                    log('🍎 Apple Pay [16] - 3DS verification successful');
                }
                
                log('🍎 Apple Pay [17] - Payment completed successfully');
                event.complete('success');
                
                // Handle successful payment
                this.handleSuccessfulPayment(options);
                
            } catch (error) {
                logError("🍎 Apple Pay [ERROR] - Payment processing error:", error);
                event.complete('fail');
                this.displayError((error as Error).message || 'Payment failed');
                
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "stripe",
                    event: { error }
                });
            }
        });
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
        });
        
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
        this.cleanupFormListeners();
        
        const form = document.querySelector(`#${this.elementIDs.form}`)

        if (!form) {
            logError("Payment form: no form provided", true)
            return
        }
        
        this.formElement = form as HTMLElement;
        
        this.submitHandler = async (event) => {
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

            // Handle successful payment
            this.handleSuccessfulPayment(options);
        };
        
        this.formElement.addEventListener('submit', this.submitHandler);
    }
    
    /**
     * Handle successful payment
     * @param options - success url / failure url
     * @private
     */
    private handleSuccessfulPayment(options?: PaymentProviderFormOptions): void {
        // Handle successful subscription
        const deepLink = this.subscription?.deep_link;
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
    }

    /**
     * Clean up form event listeners to prevent duplicates
     */
    public cleanupFormListeners(): void {
        if (this.formElement && this.submitHandler) {
            this.formElement.removeEventListener('submit', this.submitHandler);
            this.submitHandler = null;
        }
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