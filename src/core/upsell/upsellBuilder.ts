import {
    LifecycleEventName,
    LifecycleEventCallback,
    PaymentProvider,
    UpsellSubscriptionOptions,
    User,
    LifecycleEvents,
    ProductBundle,
    UpsellForm,
} from "../../types";
import StripeUpsellForm from "./stripeUpsell";
import PaddleUpsellForm from "./paddleUpsell";
import {log, logError} from "../../utils";

class UpsellBuilder {
    private events: LifecycleEvents = {}
    private currentForm: UpsellForm | null = null;

    constructor(
        private provider: PaymentProvider, 
        private user: User, 
        private paywallId: string, 
        private placementId: string, 
        private bundle: ProductBundle,
        private productId: string
    ) {}

    /**
     * Process upsell subscription
     * @param options - Upsell options including success URL / callbacks
     */
    async process(options: UpsellSubscriptionOptions = {}): Promise<boolean> {
        let form: UpsellForm;
        const introOffer = this.bundle.properties?.introductory_offer;

        try {
            switch (this.provider.kind) {
                case "stripe":
                    form = new StripeUpsellForm(
                        this.user, 
                        this.provider.id, 
                        this.paywallId, 
                        this.placementId, 
                        this.productId,
                        this
                    );
                    log("Processing Stripe upsell for account_id:", this.provider.identifier);
                    break;
                    
                case "paddle":
                    form = new PaddleUpsellForm(
                        this.user, 
                        this.provider, 
                        this.paywallId, 
                        this.placementId, 
                        this.productId,
                        this
                    );
                    log("Processing Paddle upsell for account_id:", this.provider.identifier);
                    break;
                    
                default:
                    throw new Error(`Unsupported payment provider type: ${this.provider.kind}`);
            }

            this.currentForm = form;
            
            // Process the upsell subscription
            const success = await form.process(options, introOffer);
            return success;
            
        } catch (error) {
            logError(`Failed to process ${this.provider.kind} upsell:`, error, true);
            this.emit("upsell_failure", {
                paymentProvider: this.provider.kind,
                event: { error }
            });
            return false;
        }
    }

    /**
     * Register event listener
     * @param eventName - event name
     * @param callback - callback function
     */
    public on(eventName: LifecycleEventName, callback: LifecycleEventCallback): void {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }

        this.events[eventName].push(callback);
    }

    /**
     * Emit event to registered listeners
     * @param eventName - event name
     * @param event - event data
     */
    public emit(eventName: LifecycleEventName, event: any): void {
        if (this.events[eventName]) {
            this.events[eventName].forEach(callback => callback(event));
        }
    }
}

export default UpsellBuilder; 