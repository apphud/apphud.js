import {log, logError} from "../../utils";
import {initializePaddle, Paddle, CheckoutOpenOptions, PaddleEventData} from '@paddle/paddle-js'
import {PaymentForm, PaymentProviderFormOptions, User, PaymentProvider, Subscription, PaddleSubscriptionOptions} from "../../types";
import FormBuilder from "./formBuilder";
import {config} from "../config/config";
import api from "../api";
import {setCookie} from "../../cookies";
import {DeepLinkURL, SelectedProductDuration} from "../config/constants";

class PaddleForm implements PaymentForm {
    // Add support for both new and old element IDs
    private readonly elementIDs = {
        new: {
            form: "apphud-paddle-payment-form",
            submit: "paddle-submit",
            error: "paddle-error-message"
        },
        old: {
            form: "apphud-payment-form",
            submit: "submit",
            error: "error-message"
        }
    }
    
    // Add formType detection
    private formType: 'new' | 'old' = 'new';
    
    private paddle: Paddle | null | undefined = null
    private submit: HTMLButtonElement | null = null
    private submitReadyText = "Subscribe"
    private submitProcessingText = "Please wait..."
    private currentOptions: PaymentProviderFormOptions | null = null
    private subscription: Subscription | null = null

    constructor(private user: User, private provider: PaymentProvider, private formBuilder: FormBuilder) {
        this.initializePaddleInstance()
    }

    private async initializePaddleInstance(): Promise<void> {
        try {
            const environment = config.debug || this.user.is_sandbox ? "sandbox" : "production"
            this.paddle = await initializePaddle({
                environment,
                token: this.provider.token || "",
                eventCallback: (event: PaddleEventData) => {
                    log("Paddle event received:", event.name)
                    this.handlePaddleEvent(event, this.currentOptions)
                }
            })
            log("Paddle initialized successfully")
        } catch (error) {
            logError("Failed to initialize Paddle:", error, true)
        }
    }

    /**
     * Show Paddle payment form
     * @param productId - paddle price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options including success URL and appearance customization
     * @param subscriptionOptions - Subscription options for the subscription
     */
    public async show(
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions = {},
        subscriptionOptions?: PaddleSubscriptionOptions
    ): Promise<void> {
        this.currentOptions = options
        
        // Create subscription first, before initializing the form
        await this.createSubscription(productId, paywallId, placementId, subscriptionOptions)

        if (!this.subscription) {
            logError("Failed to create subscription")
            return
        }
        
        // Detect which form type is present
        this.formType = document.getElementById(this.elementIDs.new.form) ? 'new' : 'old';
        
        log("Initializing Paddle payment form for product:", productId)
        this.formBuilder.emit("payment_form_initialized", { 
            paymentProvider: "paddle", 
            event: { 
                selector: `#${this.elementIDs[this.formType].form}` 
            } 
        })

        // Wait for Paddle to be initialized if it hasn't been yet
        if (!this.paddle) {
            await this.initializePaddleInstance()
        }

        // Verify Paddle is available
        if (!this.paddle) {
            logError("Paddle failed to initialize", true)
            return
        }

        // Setup form elements
        await this.setupFormElements()
        
        // Setup checkout configuration
        await this.setupCheckout(productId, paywallId, placementId, options)
    }

    private async setupFormElements(): Promise<void> {
        const form = document.querySelector(`#${this.elementIDs[this.formType].form}`)
        if (!form) {
            throw new Error("Payment form container not found")
        }

        // Update submit button selector
        const submitButton = document.querySelector(`#${this.elementIDs[this.formType].submit}`)
        if (!submitButton) {
            logError(`Submit button is required. Add <button id="${this.elementIDs[this.formType].submit}">Pay</button>`)
            return
        }

        this.submit = submitButton as HTMLButtonElement
        this.setButtonState("loading")

        if (this.submit.innerText !== "") {
            this.submitReadyText = this.submit.innerText
        }

        // Update error message container ID
        if (!document.querySelector(`#${this.elementIDs[this.formType].error}`)) {
            const errorDiv = document.createElement('div')
            errorDiv.id = this.elementIDs[this.formType].error
            form.appendChild(errorDiv)
        }
    }

    /**
     * Setup checkout configuration and form submission handler
     * @param productId - paddle price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options including success URL and appearance customization
     * @private
     */
    private async setupCheckout(
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined, 
        options: PaymentProviderFormOptions
    ): Promise<void> {
        const form = document.querySelector(`#${this.elementIDs[this.formType].form}`)

        if (!form) {
            throw new Error("Payment form: no form provided")
        }

        const baseConfig = {
            settings: {
                displayMode: "overlay" as const,
                theme: options?.paddleAppearance?.theme || "light",
                locale: this.user.locale || "en"
            },
            customData: {
                apphud_client_id: this.user.id,
                paywall_id: paywallId ?? "unknown",
                placement_id: placementId ?? "unknown",
            },
            customer: {
                id: this.subscription?.customer_id!,
            }
        }

        const checkoutConfig: CheckoutOpenOptions = this.subscription?.id 
            ? {
                ...baseConfig,
                transactionId: this.subscription.id
            }
            : {
                ...baseConfig,
                items: [{
                    priceId: productId,
                    quantity: 1
                }]
            }

        form.addEventListener('submit', async (event) => {
            event.preventDefault()
            this.setButtonState("processing")

            try {
                if (!this.paddle) {
                    throw new Error("Paddle not initialized")
                }
                await this.paddle.Checkout.open(checkoutConfig)
            } catch (error) {
                logError("Failed to open Paddle checkout:", error, true)
                this.setButtonState("ready")
                
                const errorElement = document.querySelector(`#${this.elementIDs[this.formType].error}`)
                if (errorElement) {
                    errorElement.textContent = error instanceof Error ? error.message : "Payment failed"
                }
            }
        })

        // Form is ready
        this.setButtonState("ready")
        this.formBuilder.emit("payment_form_ready", { 
            paymentProvider: "paddle", 
            event: {} 
        })
    }

    /**
     * Handle Paddle checkout events
     * @param event - Paddle event data
     * @param options - Form options for handling success/failure redirects
     * @private
     */
    private async handlePaddleEvent(event: PaddleEventData, options: PaymentProviderFormOptions | null): Promise<void> {
        switch (event.name) {
            case "checkout.completed":
                log("Payment completed successfully")
                
                const deepLink = this.subscription?.deep_link

                if (deepLink) {
                    setCookie(DeepLinkURL, deepLink, SelectedProductDuration)
                }

                this.formBuilder.emit("payment_success", {
                    paymentProvider: "paddle",
                    event: {
                        user_id: this.user.id,
                    }
                })

                setTimeout(() => {
                    if (options?.successUrl && options.successUrl !== 'undefined') {
                        document.location.href = options?.successUrl
                    } else {
                        document.location.href = config.baseSuccessURL+'/'+deepLink
                    }
                }, config.redirectDelay)
                break;
                
            case "checkout.error":
                logError("Payment failed:", event.data, true)
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "paddle",
                    event: { error: event.data }
                })
                this.setButtonState("ready")
                break;
                
            case "checkout.loaded":
                log("Checkout loaded successfully")
                this.setButtonState("ready")
                this.formBuilder.emit("payment_form_ready", { 
                    paymentProvider: "paddle", 
                    event: {} 
                })
                break;
        }
    }

    /**
     * Set payment button state
     * @param state - Button state: "loading" | "ready" | "processing"
     * @private
     */
    private setButtonState(state: "loading" | "ready" | "processing"): void {
        if (!this.submit) {
            logError("Submit button not found. Failed to set state:", state, true)
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
        }
    }

    /**
     * Add new method for subscription creation
     * @param productId - paddle price_id
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param subscriptionOptions - Subscription options for the subscription
     * @private
     */
    private async createSubscription(
        productId: string, 
        paywallId: string | undefined, 
        placementId: string | undefined,
        subscriptionOptions?: PaddleSubscriptionOptions
    ): Promise<void> {
        const payload = {
            product_id: productId,
            paywall_id: paywallId,
            placement_id: placementId,
            user_id: this.user.id,
            ...(subscriptionOptions?.discountId && { discount_id: subscriptionOptions.discountId })
        }

        log('Creating subscription with payload:', payload);
        this.subscription = await api.createSubscription(this.provider.id, payload)

        if (!this.subscription) {
            logError(`Subscription was not created for price_id`, productId)
        } else {
            log('Subscription created', this.subscription)
        }
    }
}

export default PaddleForm