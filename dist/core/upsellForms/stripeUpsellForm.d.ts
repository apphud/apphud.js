import { UpsellForm } from "../../types/upsellForm";
import { IntroductoryOffer, UpsellSubscriptionOptions } from "../../types";
import UpsellBuilder from "./upsellBuilder";
declare class StripeUpsellForm implements UpsellForm {
    private user;
    private providerId;
    private paywallId;
    private placementId;
    private productId;
    private upsellBuilder;
    constructor(user: any, providerId: string, paywallId: string, placementId: string, productId: string, upsellBuilder: UpsellBuilder);
    /**
     * Process Stripe upsell subscription
     * @param options - Upsell options
     * @param introOffer - Optional introductory offer details
     */
    process(options: UpsellSubscriptionOptions, introOffer?: IntroductoryOffer): Promise<boolean>;
}
export default StripeUpsellForm;
//# sourceMappingURL=stripeUpsellForm.d.ts.map