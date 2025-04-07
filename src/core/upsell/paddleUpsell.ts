import { UpsellForm } from "../../types/upsellForm";
import { IntroductoryOffer, PaymentProvider, UpsellSubscriptionOptions, Subscription } from "../../types";
import { log, logError, getAmplitudeId } from "../../utils";
import api from "../api";
import { config } from "../config/config";
import { DeepLinkURL, SelectedProductDuration, PaymentProviderKey } from "../config/constants";
import { setCookie } from "../../cookies";
import UpsellBuilder from "./upsellBuilder";
import { 
    initializePaddle, 
    Paddle, 
    CheckoutOpenOptions, 
    PaddleEventData, 
    DisplayMode, 
    AvailablePaymentMethod, 
    Variant 
} from '@paddle/paddle-js';

class PaddleUpsellForm implements UpsellForm {
    private paddle: Paddle | null | undefined = null;
    private subscription: Subscription | null = null;
    private currentOptions: UpsellSubscriptionOptions | null = null;

    constructor(
        private user: any,
        private provider: PaymentProvider,
        private paywallId: string,
        private placementId: string,
        private productId: string,
        private upsellBuilder: UpsellBuilder
    ) {}

    /**
     * Process Paddle upsell subscription
     * @param options - Upsell options
     * @param introOffer - Optional introductory offer details
     */
    public async process(options: UpsellSubscriptionOptions, introOffer?: IntroductoryOffer): Promise<boolean> {
        try {
            this.currentOptions = options;
            
            this.upsellBuilder.emit("upsell_initiated", {
                paymentProvider: "paddle",
                event: {
                    paywallId: this.paywallId,
                    placementId: this.placementId
                }
            });

            // Create subscription
            await this.createSubscription(introOffer);
            
            if (!this.subscription) {
                throw new Error("Failed to create subscription");
            }

            // Save deep link if available
            if (this.subscription.deep_link) {
                setCookie(DeepLinkURL, this.subscription.deep_link, SelectedProductDuration);
            }

            // Save payment provider type
            setCookie(PaymentProviderKey, "paddle", SelectedProductDuration);

            // Initialize Paddle and open checkout
            await this.initializePaddleInstance();
            
            if (!this.paddle) {
                throw new Error("Failed to initialize Paddle");
            }
            
            // Open Paddle checkout
            const checkoutConfig = this.buildCheckoutConfig();
            log("Opening Paddle checkout with config:", checkoutConfig);
            this.paddle.Checkout.open(checkoutConfig);
            
            // Return true as we've successfully initiated the checkout process
            return true;
        } catch (error) {
            logError("Failed to process Paddle upsell:", error, true);
            this.upsellBuilder.emit("upsell_failure", {
                paymentProvider: "paddle",
                event: { error }
            });
            return false;
        }
    }

    /**
     * Initialize Paddle instance
     * @private
     */
    private async initializePaddleInstance(): Promise<void> {
        try {
            if (!this.provider.token) {
                throw new Error("Missing Paddle provider token");
            }
            
            const environment = config.debug || this.user.is_sandbox ? "sandbox" : "production";
            this.paddle = await initializePaddle({
                environment,
                token: this.provider.token,
                eventCallback: (event: PaddleEventData) => {
                    log("Paddle event received:", event.name);
                    this.handlePaddleEvent(event);
                }
            });
            
            if (this.paddle) {
                log("Paddle initialized successfully for upsell");
            } else {
                throw new Error("Paddle not initialized");
            }
        } catch (error) {
            logError("Failed to initialize Paddle for upsell", error, true);
            throw error;
        }
    }

    /**
     * Handle Paddle checkout events
     * @param event - Paddle event data
     * @private
     */
    private handlePaddleEvent(event: PaddleEventData): void {
        switch (event.name) {
            case "checkout.completed":
                log("Paddle upsell payment completed successfully");
                
                this.upsellBuilder.emit("upsell_success", {
                    paymentProvider: "paddle",
                    event: {
                        subscription: this.subscription
                    }
                });
                
                setTimeout(() => {
                    if (this.currentOptions?.onSuccess) {
                        this.currentOptions.onSuccess();
                    } else if (this.currentOptions?.successUrl && this.currentOptions.successUrl !== 'undefined') {
                        document.location.href = this.currentOptions.successUrl;
                    } else if (this.subscription?.deep_link) {
                        document.location.href = config.baseSuccessURL + '/' + this.subscription.deep_link;
                    }
                }, config.redirectDelay);
                break;
                
            case "checkout.error":
            case "checkout.payment.failed":
                logError("Paddle upsell payment failed:", event.data, true);
                this.upsellBuilder.emit("upsell_failure", {
                    paymentProvider: "paddle",
                    event: { error: event.data }
                });
                break;
                
            case "checkout.loaded":
                log("Paddle upsell checkout loaded successfully");
                break;
        }
    }

    /**
     * Build Paddle checkout configuration
     * @private
     */
    private buildCheckoutConfig(): CheckoutOpenOptions {
        const paddleSettings = this.currentOptions?.paddleSettings || {};
        
        // Create base config with settings
        const baseConfig = {
            settings: {
                locale: this.user.locale || "en",
                displayMode: "overlay" as DisplayMode,
                theme: paddleSettings.theme || "light",
                variant: paddleSettings.variant as Variant || "multi-page",
                allowedPaymentMethods: paddleSettings.allowedPaymentMethods as AvailablePaymentMethod[]
            }
        };
        
        // Ensure transaction ID is defined
        if (!this.subscription?.id) {
            throw new Error("Transaction ID is required for Paddle checkout");
        }
        
        // Create final config with transaction ID
        const checkoutConfig: CheckoutOpenOptions = {
            ...baseConfig,
            transactionId: this.subscription.id
        };
        
        if (this.subscription.auth_token) {
            checkoutConfig.customerAuthToken = this.subscription.auth_token;
        } else if (this.subscription.customer_id) {
            (checkoutConfig as any).customer = {
                id: this.subscription.customer_id
            };
        }
        
        if (this.subscription.payment_method) {
            checkoutConfig.savedPaymentMethodId = this.subscription.payment_method;
        }
        
        return checkoutConfig;
    }

    /**
     * Create subscription
     * @param introOffer - Optional introductory offer details
     * @private
     */
    private async createSubscription(introOffer?: IntroductoryOffer): Promise<void> {
        const amplitudeId = getAmplitudeId();
        
        const subscriptionPayload: any = {
            product_id: this.productId,
            paywall_id: this.paywallId,
            placement_id: this.placementId,
            user_id: this.user.id,
            upsell: true,
            metadata: {
                ...(amplitudeId && { amplitude_id: amplitudeId })
            },
        };

        if (introOffer?.paddle_discount_id) {
            subscriptionPayload.discount_id = introOffer.paddle_discount_id;
        }

        log('Creating upsell subscription for product:', this.productId);
        this.subscription = await api.createSubscription(this.provider.id, subscriptionPayload);

        if (!this.subscription) {
            logError(`Failed to create upsell subscription for product`, this.productId);
            throw new Error("Failed to create subscription");
        }
        
        log('Upsell subscription created', this.subscription);
    }
}

export default PaddleUpsellForm; 