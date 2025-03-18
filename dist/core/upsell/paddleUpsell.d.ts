import { UpsellForm } from "../../types/upsellForm";
import { IntroductoryOffer, PaymentProvider, UpsellSubscriptionOptions } from "../../types";
import UpsellBuilder from "./upsellBuilder";
declare class PaddleUpsellForm implements UpsellForm {
    private user;
    private provider;
    private paywallId;
    private placementId;
    private productId;
    private upsellBuilder;
    private paddle;
    private subscription;
    private currentOptions;
    constructor(user: any, provider: PaymentProvider, paywallId: string, placementId: string, productId: string, upsellBuilder: UpsellBuilder);
    /**
     * Process Paddle upsell subscription
     * @param options - Upsell options
     * @param introOffer - Optional introductory offer details
     */
    process(options: UpsellSubscriptionOptions, introOffer?: IntroductoryOffer): Promise<boolean>;
    /**
     * Initialize Paddle instance
     * @private
     */
    private initializePaddleInstance;
    /**
     * Handle Paddle checkout events
     * @param event - Paddle event data
     * @private
     */
    private handlePaddleEvent;
    /**
     * Build Paddle checkout configuration
     * @private
     */
    private buildCheckoutConfig;
    /**
     * Create subscription
     * @param introOffer - Optional introductory offer details
     * @private
     */
    private createSubscription;
}
export default PaddleUpsellForm;
//# sourceMappingURL=paddleUpsell.d.ts.map