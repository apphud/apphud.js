import {documentReady, log, logError, getAmplitudeId, getValueByPath, trackFacebookPurchaseEvent} from "../../utils"
import { extractCurrencyFromPrice } from "../../utils/currencies"
import api from '../api'
import {
    DeepLinkURL,
    SelectedProductDuration,
    PaymentProviderKey
} from "../config/constants"
import {CustomerSetup, PaymentForm, PaymentProviderFormOptions, Subscription, User, StripeSubscriptionOptions, ProductBundle, PaymentProvider} from "../../types"
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
    private applePayButtonHandler: ((event: Event) => void) | null = null;
    private applePayButton: HTMLElement | null = null;
    private isActive: boolean = true;

    constructor(private user: User, private provider: PaymentProvider, private formBuilder: FormBuilder) {
        documentReady(async () => {
            this.injectStyles();
            
            if (!this.provider.token) {
                logError("Missing Stripe provider token", true);
                return;
            }
            
            this.stripe = await loadStripe(this.provider.token, {stripeAccount: this.provider.identifier});
        })
    }

    /**
     * Cancel this form instance and prevent any pending async operations from completing.
     * This is called when a new product is selected while the current form is still initializing.
     * Prevents race conditions where an old form might attach event listeners after being replaced.
     */
    public cancel(): void {
        this.isActive = false;
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

        // Detect which form type is present
        if (options.id) {
            this.elementIDs = {}

            for (const key in ELEMENT_IDS.new) {
                this.elementIDs[key] = `${options.id}-${ELEMENT_IDS.new[key as keyof typeof ELEMENT_IDS.new]}`
            }
        } else if (document.getElementById(ELEMENT_IDS.new.form)) {
            this.elementIDs = ELEMENT_IDS.new
        }
        
        // Only setup submit button if not using Apple Pay exclusively
        if (!options.applePay) {
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
        }

        // Create customer
        await this.createCustomer(options);
        
        if (!this.isActive) return;
        
        if (!options.applePay) {
            this.initStripe(options);
            this.setupForm(options);
        }
        
        // Initialize Apple Pay if product bundle exists 
        // Only enable Apple Pay when explicitly requested or not explicitly disabled
        if (options.applePay) {
            this.initializeApplePay(options);
        }
        
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
            this.subscription = await api.createSubscription(this.provider.id, payload);
    
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
        
        const customerData: any = {
            user_id: this.user.id,
            metadata: {
                ...(amplitudeId && { amplitude_id: amplitudeId })
            },
        };
        
        // Only include payment_methods if Apple Pay is not enabled
        if (!options.applePay) {
            customerData.payment_methods = paymentMethods;
        }
        
        this.customer = await api.createCustomer(this.provider.id, customerData);

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
            logError('Failed to initialize Apple Pay: Stripe not initialized', true);
            return;
        }

        if (!this.productBundle) {
            logError('Failed to initialize Apple Pay: Product bundle is missing', true);
            return;
        }
        
        // Get product price info from bundle
        let amount = 0;
        let currency = 'usd';
        let productName = 'Subscription';
        
        // Check if static price is provided in options
        if (options?.applePayConfig?.staticPrice) {
            const staticPrice = options.applePayConfig.staticPrice;
            
            currency = staticPrice.currency || 'usd';
            amount = staticPrice.amount || 0;
        }
        
        // Get price from bundle if not using static price
        if (!options?.applePayConfig?.staticPrice && this.productBundle.properties) {
            // Get the selected price macro from options, or use "new-price" as default
            const priceMacro = options?.applePayConfig?.priceMacro || "new-price";
            
            const priceString = getValueByPath(this.productBundle.properties, priceMacro);
            
            if (priceString) {
                // Extract numeric value from price string
                const numericValue = parseFloat(priceString.replace(/[^0-9.]/g, ''));
                if (!isNaN(numericValue)) {
                    // Convert to cents for Stripe
                    amount = Math.round(numericValue * 100);
                } else {
                    logError(`Failed to parse price from macro ${priceMacro}: ${priceString}`, true);
                    return;
                }
                
                // Extract currency from price string
                currency = extractCurrencyFromPrice(priceString, 'usd');
            } else {
                logError(`No price found for macro ${priceMacro} in bundle properties`, true);
                return;
            }
        }
        
        // Get product name based on product configuration
        if (options?.applePayConfig?.productLabel) {
            // Direct product label has highest priority
            productName = options.applePayConfig.productLabel;
        } else if (options?.applePayConfig?.productMacro && this.productBundle.properties) {
            // Get product name from the specified macro if available
            const productValue = getValueByPath(this.productBundle.properties, options.applePayConfig.productMacro);
            if (productValue) {
                productName = productValue;
            }
        } else if (this.productBundle.name) {
            // Fallback to bundle name if available
            productName = this.productBundle.name;
        }
        
        // Define payment request for Apple Pay
        this.paymentRequest = this.stripe.paymentRequest({
            country: 'US',
            currency: currency,
            total: {
                label: productName,
                amount: amount,
            },
            requestPayerName: options?.applePayConfig?.requestPayerName || false,
            requestPayerEmail: options?.applePayConfig?.requestPayerEmail || false,
            requestPayerPhone: options?.applePayConfig?.requestPayerPhone || false,
        });

        log("Setting up Apple Pay payment request");

        // Check if Apple Pay is available
        this.paymentRequest.canMakePayment().then((result: any) => {
            if (result && result.applePay) {
                // Call onApplePayAvailable callback directly if provided in options
                if (options?.applePayConfig?.onApplePayAvailable) {
                    options.applePayConfig.onApplePayAvailable(true);
                }
                
                // Emit an event when Apple Pay is available
                this.formBuilder.emit("apple_pay_available", {
                   paymentProvider: "stripe",
                   event: { 
                       available: true,
                       buttonId: this.elementIDs.applePayButton
                   }
                });
                
                // Show Apple Pay button if available
                const applePayButton = document.getElementById(this.elementIDs.applePayButton);
                if (applePayButton) {
                    applePayButton.style.display = 'block';
                    
                    // Store references to button and handler
                    this.applePayButton = applePayButton;
                    
                    // Create handler function
                    this.applePayButtonHandler = () => {
                        // Set button state to processing when clicked
                        if (this.buttonStateSetter) {
                            this.buttonStateSetter("processing");
                        }
                        this.paymentRequest?.show();
                    };
                    
                    // Add event listener
                    this.applePayButton.addEventListener('click', this.applePayButtonHandler);
                } else {
                    logError('Apple Pay button element not found with ID: ' + this.elementIDs.applePayButton, true);
                }
            } else {
                log('Apple Pay not available on this device/browser');
            }
        }).catch(error => {
            logError('Error checking Apple Pay availability:', error, true);
        });
        
        // Handle payment method selection with Apple Pay
        this.paymentRequest.on('paymentmethod', async (event: any) => {
            try {
                if (!this.customer) {
                    const error = new Error('Customer not initialized');
                    logError('Apple Pay - Customer not initialized', error, true);
                    throw error;
                }
                
                // Create subscription with the payment method from Apple Pay
                await this.createSubscription(
                    this.currentProductId!,
                    this.currentPaywallId,
                    this.currentPlacementId,
                    this.customer.id,
                    event.paymentMethod.id
                );
                
                if (!this.subscription) {
                    const error = new Error('Failed to create subscription');
                    logError('🍎 Apple Pay [ERROR] - Failed to create subscription', error);
                    event.complete('fail');
                    this.displayError('Failed to create subscription');
                    
                    // Reset button state on failure
                    if (this.buttonStateSetter) {
                        this.buttonStateSetter("error");
                        // Return to ready state after a short delay
                        setTimeout(() => {
                            if (this.buttonStateSetter) {
                                this.buttonStateSetter("ready");
                            }
                        }, 1500);
                    }
                    return;
                }
                
                // Handle 3DS if needed
                if (this.subscription.client_secret) {
                    const { error: confirmError } = await this.stripe!.confirmCardPayment(
                        this.subscription.client_secret,
                        { payment_method: event.paymentMethod.id },
                        { handleActions: false }
                    );
                    
                    if (confirmError) {
                        logError('Apple Pay - 3DS verification failed:', confirmError, true);
                        event.complete('fail');
                        this.displayError(confirmError.message || 'Payment confirmation failed');
                        
                        // Reset button state on 3DS verification failure
                        if (this.buttonStateSetter) {
                            this.buttonStateSetter("error");
                            // Return to ready state after a short delay
                            setTimeout(() => {
                                if (this.buttonStateSetter) {
                                    this.buttonStateSetter("ready");
                                }
                            }, 1500);
                        }
                        
                        this.formBuilder.emit("payment_failure", {
                            paymentProvider: "stripe",
                            event: { error: confirmError }
                        });
                        return;
                    }
                }
                
                event.complete('success');
                
                // Handle successful payment
                this.handleSuccessfulPayment(options);
                
            } catch (error) {
                logError("Apple Pay - Payment processing error:", error, true);
                event.complete('fail');
                this.displayError((error as Error).message || 'Payment failed');
                
                // Reset button state on error
                if (this.buttonStateSetter) {
                    this.buttonStateSetter("error");
                    // Return to ready state after a short delay
                    setTimeout(() => {
                        if (this.buttonStateSetter) {
                            this.buttonStateSetter("ready");
                        }
                    }, 1500);
                }
                
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "stripe",
                    event: { error }
                });
            }
        });

        // Handle cancellation of Apple Pay sheet
        this.paymentRequest.on('cancel', () => {
            // Reset button state to ready when the Apple Pay sheet is dismissed
            if (this.buttonStateSetter) {
                this.buttonStateSetter("ready");
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

        // Create payment element options
        const paymentElementOptions: StripePaymentElementOptions = {
            layout: options?.stripeAppearance?.layout,
            wallets: {
                applePay: options?.applePayConfig?.showApplePayInPaymentElement === false ? "never" : "auto"
            }
        };
        
        // Set terms to 'never' if hideTerms is true
        if (options?.hideTerms) {
            paymentElementOptions.terms = {
                applePay: 'never',
                auBecsDebit: 'never',
                bancontact: 'never',
                card: 'never',
                cashapp: 'never',
                googlePay: 'never',
                ideal: 'never',
                paypal: 'never',
                sepaDebit: 'never',
                sofort: 'never',
                usBankAccount: 'never'
            };
        }

        // Create and mount the Payment Element
        const paymentElement = this.elements.create('payment', paymentElementOptions);
        
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
        if (!this.isActive) return; // Don't attach listeners if form was cancelled
        
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
        
        // Track Facebook Pixel event
        if (this.subscription) {
            trackFacebookPurchaseEvent(this.subscription);
        }
            
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
        // Clean up form submit handler
        if (this.formElement && this.submitHandler) {
            this.formElement.removeEventListener('submit', this.submitHandler);
            this.submitHandler = null;
        }
        
        // Clean up Apple Pay button handler
        if (this.applePayButton && this.applePayButtonHandler) {
            this.applePayButton.removeEventListener('click', this.applePayButtonHandler);
            this.applePayButtonHandler = null;
            this.applePayButton = null;
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