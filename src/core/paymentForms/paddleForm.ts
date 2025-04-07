import {log, logError, getAmplitudeId} from "../../utils";
import {initializePaddle, Paddle, CheckoutOpenOptions, PaddleEventData, DisplayMode, AvailablePaymentMethod, Variant} from '@paddle/paddle-js'
import {PaymentForm, PaymentProviderFormOptions, User, PaymentProvider, Subscription, PaddleSubscriptionOptions} from "../../types";
import FormBuilder from "./formBuilder";
import {config} from "../config/config";
import api from "../api";
import {setCookie} from "../../cookies";
import {DeepLinkURL, SelectedProductDuration, PaymentProviderKey} from "../config/constants";

class PaddleForm implements PaymentForm {
    private paddle: Paddle | null | undefined = null
    private currentOptions: PaymentProviderFormOptions | null = null
    private subscription: Subscription | null = null

    constructor(private user: User, private provider: PaymentProvider, private formBuilder: FormBuilder) {
        this.initializePaddleInstance()
    }

    private async initializePaddleInstance(): Promise<void> {
        try {
            if (!this.provider.token) {
                throw new Error("Missing Paddle provider token");
            }
            
            const environment = config.debug || this.user.is_sandbox ? "sandbox" : "production"
            this.paddle = await initializePaddle({
                environment,
                token: this.provider.token,
                eventCallback: (event: PaddleEventData) => {
                    log("Paddle event received:", event.name)
                    this.handlePaddleEvent(event, this.currentOptions)
                }
            })
            
            if (this.paddle) {
                log("Paddle initialized successfully")
            } else {
                throw new Error("Paddle not initialized")
            }
        } catch (error) {
            logError("Failed to initialize Paddle", error, true)
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

        log("Initializing Paddle payment form for product:", productId)
        this.formBuilder.emit("payment_form_initialized", { 
            paymentProvider: "paddle", 
            event: { 
                selector: `#${options?.id}`
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

        const settings = options?.paddleSettings || {}

        if (!this.currentOptions?.id) {
            logError("Paddle form id is required", true)
            return
        }

        const baseConfig = {
            settings: {
                locale: this.user.locale || "en",
                displayMode: (settings.displayMode || "overlay") as DisplayMode,
                theme: settings.theme || "light",
                variant: settings.variant as Variant,
                frameTarget: this.currentOptions?.id,
                frameInitialHeight: settings.frameInitialHeight,
                frameStyle: settings.frameStyle,
                allowedPaymentMethods: settings.allowedPaymentMethods as AvailablePaymentMethod[]
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
        
        this.setButtonState("processing")

        try {
            if (!this.paddle) {
                throw new Error("Paddle not initialized")
            }
            this.paddle.Checkout.open(checkoutConfig)
        } catch (error) {
            logError("Failed to open Paddle checkout:", error, true)
            this.setButtonState("ready")

            if (settings.errorCallback) {
                settings.errorCallback(error instanceof Error ? error.message : "Payment failed")
            }
        }

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

                setCookie(PaymentProviderKey, "paddle", SelectedProductDuration)

                this.formBuilder.emit("payment_success", {
                    paymentProvider: "paddle",
                    event: {
                        user_id: this.user.id,
                    }
                })

                setTimeout(() => {
                    if (options?.onSuccess) {
                        options.onSuccess()
                    } else if (options?.successUrl && options.successUrl !== 'undefined') {
                        document.location.href = options?.successUrl
                    } else {
                        document.location.href = config.baseSuccessURL + '/' + deepLink
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
                if (this.currentOptions?.paddleSettings?.errorCallback) {
                    this.currentOptions.paddleSettings.errorCallback(
                        typeof event.data === "string" ? event.data : "Payment failed"
                    )
                }
                break;
                
            case "checkout.loaded":
                log("Checkout loaded successfully")
                this.setButtonState("ready")
                this.formBuilder.emit("payment_form_ready", { 
                    paymentProvider: "paddle", 
                    event: {} 
                })
                break;

            case "checkout.payment.failed":
                logError("Payment failed", event.data, true)
                this.formBuilder.emit("payment_failure", {
                    paymentProvider: "paddle",
                    event: { error: event.data }
                })
                this.setButtonState("ready")
                if (this.currentOptions?.paddleSettings?.errorCallback) {
                    this.currentOptions.paddleSettings.errorCallback(
                        typeof event.data === "string" ? event.data : "Payment failed"
                    )
                }
                break;
        }
    }

    /**
     * Set payment button state
     * @param state - Button state: "loading" | "ready" | "processing"
     * @private
     */
    private setButtonState(state: "loading" | "ready" | "processing"): void {
        if (this.currentOptions?.buttonStateSetter) {
            this.currentOptions.buttonStateSetter(state)
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
        const amplitudeId = getAmplitudeId();
        
        const payload = {
            product_id: productId,
            paywall_id: paywallId,
            placement_id: placementId,
            user_id: this.user.id,
            ...(subscriptionOptions?.discountId && { discount_id: subscriptionOptions.discountId }),
            metadata: {
                ...(amplitudeId && { amplitude_id: amplitudeId })
            },
        }

        log('Creating subscription for product:', productId);
        this.subscription = await api.createSubscription(this.provider.id, payload)

        if (!this.subscription) {
            logError(`Failed to create subscription for product`, productId)
            return
        }
        
        log('Subscription created', this.subscription)
    }
}

export default PaddleForm